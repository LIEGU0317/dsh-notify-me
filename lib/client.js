// dsh-notify-me — browser half (client plugin bundle).
//
// Loaded by dsh-client-modules at /plugins/dsh-notify-me/client.js and
// executed through the vendored cordis Loader's lazy-CJS module table
// (window.__ModuleLoader__.load). The factory body is plain CJS with
// require() resolved against the shell's module table — the same shape the
// shipped ui-* packages' tsdown bundles emit. react is part of the platform
// base, so require("react") resolves to the shell-seeded instance (same as
// every shipped ui-* bundle); the settings page is skipped when react or the
// slots/locale services are absent, keeping the reminder core self-contained.
//
// What this plugin does (all client-side, no settings transport needed):
//   - watches two services, because pending interactions and the running bit
//     have different owners on current hosts:
//       * "uiSession" -> the pending-interaction source, whose *store* changed
//         shape once and is therefore read through one adapter:
//           - DSH 0.1.2-alpha.2 .. 0.1.5-rc.3: `pendingInteractions`, a
//             Map<sessionId, interaction> whose values carry kind
//             'approval' | 'plan-review' | 'question' (the controller snapshots
//             stopped carrying `pending` in 0.1.2-alpha.2, so that store was the
//             only live source back then);
//           - DSH 0.1.6-alpha.2 and later (including 0.2.0-rc.2):
//             `sessionStatus`, a Map<sessionId, {running, pendingInteraction,
//             completionUnread}>; the old store is gone, so this is the only
//             live source on those hosts.
//         Both are resolved through ctx.get() — cordis throws on a plain
//         ctx.uiSession read for any name absent from the plugin's inject map;
//       * "sessions" -> the selected session's ConversationSnapshot (running)
//         and the session-list summaries of every other session (running /
//         completed), which carry the "reply finished" edge on every version.
//         The host's completion-unread level flag backs that edge up and owns
//         the "完成未读" title marker: `sessionStatus.completionUnread` on
//         0.1.6+ (armed when a background session finishes, cleared when it is
//         opened / re-runs / disappears), the list row's `completed` reminder
//         bit on older hosts. The edge path stays the reporter for the on-screen
//         session (its snippet comes from the face snapshot); the two views of
//         one completion are collapsed by reportDone's short dedupe window.
//         The selected ("current") session is read from the list snapshot's
//         `current` field where it exists (<= 0.1.5-rc.3) and otherwise derived
//         from the mainView retention count (0.1.6+, the way the shipped
//         DocumentTitle / ui-session pick it);
//   - mutes background subagent child sessions by default
//     (config.ignoreSubagent): DSH lists them as ordinary rows carrying
//     `origin: 'subagent'`, but their waits and finish edges are steps of the
//     parent conversation's turn. The subagent session the user has open is not
//     muted — it is on screen like any other conversation and alerts by the
//     normal rules;
//   - fires a Windows desktop Notification (+ optional sound) when the agent
//     needs the user's input — pending interaction kinds 'approval',
//     'plan-review' or 'question' — and when a reply/turn finishes;
//   - quick-decides approvals from the toast itself (option, on by default):
//     approval notifications carry 同意/拒绝 action buttons and one click on a
//     button settles the request through the interaction's own
//     answer('allowed-once' | 'rejected') — the exact verb the in-page approval
//     card uses. Action buttons only exist on persistent notifications, so this
//     file is dual-context: registered as a Service Worker as well, whose
//     notificationclick relays the chosen button back to this page (broadcast +
//     client postMessage) and, on a body click, raises exactly one window
//     (client.focus()) and routes the conversation switch to that window alone. Where a worker cannot run (insecure context, no
//     bundle URL) the plugin degrades to today's plain toast;
//   - registers a "通知提醒 / Notify me" page into DSH Settings
//     (settings.section slot) exposing an on/off master switch, per-channel
//     toggles, volume and the notification language (follow-interface /
//     Simplified Chinese / English);
//   - preferences persist in localStorage (origin-scoped, like other
//     third-party client plugins) and are tweakable on window.__dshNotifyMe.

// One file, two jobs. The DSH module loader evaluates this script in the page
// (registering the factory below), and the very same served bytes are also
// registered as the plugin's Service Worker — see the bridge at the bottom of
// this wrapper.
(function (root) {
    if (!root) return;

    // ──────────────── service-worker half (notification bridge) ────────────
    var BRIDGE_CHANNEL = "dsh-notify-me:bridge";
    // A real Service Worker global is the only context with a registration and
    // no document; the page (and any test harness) never matches.
    function isServiceWorkerScope(g) {
      return !!g && typeof g.registration === "object" && g.registration !== null &&
        typeof g.addEventListener === "function" && typeof g.document === "undefined";
    }
    // The worker never decides anything: it only relays which button was
    // clicked to the page that owns the pending interaction. Both a
    // BroadcastChannel and a direct client postMessage are used — the channel
    // covers every same-origin page, the postMessage covers environments where
    // the worker cannot open one.
    function installNotificationBridge(g) {
      function relay(msg) {
        try {
          if (typeof g.BroadcastChannel === "function") {
            var ch = new g.BroadcastChannel(BRIDGE_CHANNEL);
            ch.postMessage(msg);
            try { ch.close(); } catch (e) {}
          }
        } catch (e) {}
        try {
          if (g.clients && typeof g.clients.matchAll === "function") {
            g.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
              for (var i = 0; i < list.length; i++) {
                try { list[i].postMessage(msg); } catch (e) {}
              }
            }, function () {});
          }
        } catch (e) {}
      }
      // One relayed click; `navigate` says whether the receiving page may
      // steer its window (raise it + switch to the alerted conversation).
      function clickMsg(base, navigate) {
        return {
          source: base.source,
          type: base.type,
          action: base.action,
          key: base.key,
          sessionId: base.sessionId,
          navigate: navigate
        };
      }
      // A body click means "take me there", and both halves of that request are
      // this handler's job. The window raise belongs here because only a
      // notificationclick carries the click's user activation — the page-side
      // window.focus() a plain relay triggers afterwards can lose the OS
      // foreground race and leave DSH behind other windows. So exactly one
      // window client is picked (a visible one first), that client alone gets
      // `navigate: true` plus the focus() call, and every other recipient gets
      // `navigate: false` and stays put: several open DSH tabs must not fight
      // over focus or all switch their own conversation at once. Buttons stay
      // hands-off — deciding from the toast must not drag a window up. The
      // `data.focus` flag (the autoFocus setting at show time) keeps the
      // "off = clicking does nothing" promise even though a worker cannot read
      // the page's config; toasts from older versions carry no flag and keep
      // the previous best-effort behavior.
      function deliverClick(base, wantsFocus) {
        var send = function (list) {
          list = list || [];
          var best = null;
          if (wantsFocus) {
            for (var i = 0; i < list.length; i++) {
              var c = list[i];
              if (!c || typeof c.postMessage !== "function") continue;
              if (c.visibilityState === "visible") { best = c; break; }
              if (!best) best = c;
            }
          }
          for (var j = 0; j < list.length; j++) {
            try { list[j].postMessage(clickMsg(base, wantsFocus && list[j] === best)); } catch (e) {}
          }
          try {
            if (typeof g.BroadcastChannel === "function") {
              var ch = new g.BroadcastChannel(BRIDGE_CHANNEL);
              ch.postMessage(clickMsg(base, false));
              try { ch.close(); } catch (e) {}
            }
          } catch (e) {}
          if (best && typeof best.focus === "function") {
            try {
              var fp = best.focus();
              if (fp && typeof fp.then === "function") fp.then(null, function () {});
            } catch (e) {}
          }
        };
        try {
          if (g.clients && typeof g.clients.matchAll === "function") {
            var p = g.clients.matchAll({ type: "window", includeUncontrolled: true });
            if (p && typeof p.then === "function") {
              p.then(send, function () { relay(clickMsg(base, wantsFocus)); });
              return;
            }
          }
        } catch (e) {}
        relay(clickMsg(base, wantsFocus));
      }
      g.addEventListener("notificationclick", function (event) {
        try {
          var n = event.notification;
          var data = (n && n.data) || {};
          var action = event.action || "";
          var base = {
            source: "dsh-notify-me",
            type: "notification",
            action: action,
            key: data.key || null,
            sessionId: data.sessionId || null
          };
          try { if (n && typeof n.close === "function") n.close(); } catch (e) {}
          var run = action
            ? function () { relay(base); }
            : function () { deliverClick(base, data.focus !== false); };
          if (typeof event.waitUntil === "function") {
            event.waitUntil(Promise.resolve().then(run));
          } else {
            run();
          }
        } catch (e) {}
      });
    }
    if (isServiceWorkerScope(root)) { installNotificationBridge(root); return; }
    if (!root.__ModuleLoader__ || typeof root.__ModuleLoader__.load !== "function") return;

    root.__ModuleLoader__.load({
      id: "dsh-notify-me",
      factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    // react is externalized into the loader module table; never required by
    // the reminder core, only by the optional Settings page.
    var React = null;
    try { React = require("react") || null; } catch (e) { React = null; }

    // ───────────────────────── configuration ─────────────────────────
    var LS_CONFIG = "dshNotifyMe.config";
    var DEFAULTS = {
      enabled: true, // master switch: off = no toast/sound/title marker at all
      // language of the notification copy: 'auto' follows the DSH UI locale,
      // 'zh' and 'en' pin Simplified Chinese / English.
      language: "auto",
      // Which host environment this page runs in: 'auto' detects from the page
      // protocol (dsh-app:// = the packaged DSH Desktop shell), 'desktop' and
      // 'web' force it. The desktop rides the dsh:// deep-link raise path and
      // cannot carry quick-decision buttons at all; the browser uses
      // window.focus() and the Service Worker bridge.
      hostEnv: "auto",
      // toast + sound are only useful while the user is elsewhere; the tab
      // being hidden is the reliable "away" signal.
      attentionHiddenOnly: false, // needs-input alerts even while the page is visible
      // A wait inside the conversation already on screen needs no toast: the
      // approval card is right there, and a toast lands on top of it. Leaving
      // the page brings that alert back (see flushQuieted).
      currentHiddenOnly: true, // the visible session's own waits stay silent
      doneHiddenOnly: true, // reply-finished alerts only when the page is hidden
      // Background subagent child sessions are steps of another conversation's
      // turn: DSH lists each of them as its own row (origin: 'subagent'), so
      // their waits and finish edges would toast noise the user cannot act on.
      // Muted by default; the list row's own origin field is the only thing this
      // keys on, plus "not the session on screen" — an open subagent session is
      // just another conversation to alert for.
      ignoreSubagent: true,
      toast: true,
      sound: true,
      // Where each alert's cue comes from (per kind, so "needs you" and "reply
      // finished" stay independent):
      //   'synth'  — the built-in WebAudio cue (default, needs no asset)
      //   'custom' — an audio file the user picked, kept in its own
      //              localStorage key and played through an <audio> element
      //   'system' — no plugin cue at all: the toast is raised un-silenced so
      //              the operating system plays its own notification sound
      soundDone: "synth",
      soundAttention: "synth",
      volume: 0.5,
      autoFocus: true, // clicking the toast raises DSH and switches to the alerted conversation
      // Approval toasts carry 同意/拒绝 buttons and settle the request on one
      // click (the same answer('allowed-once' | 'rejected') the in-page
      // approval card sends). Buttons need persistent notifications, served
      // through the Service Worker half of this same file; where that cannot
      // run, the toast simply falls back to its plain form.
      quickActions: true,
      // Where the alert is drawn. The OS toast always lands on the primary
      // display — Windows offers no setting (and Chromium no API) to aim a
      // banner at another monitor — so a user whose DSH window lives on a
      // second screen never sees one. This option draws the same alert inside
      // the page instead: it appears on whatever screen the window is on, needs
      // no notification permission, and can carry the approval buttons even on
      // the desktop shell (whose dsh-app:// page cannot run the Service Worker
      // that OS action buttons need). Independent of `toast`; neither replaces
      // the other, so "both" is a valid setup.
      overlay: false,
      // Which corner of this window the overlay cards stack in. The screen
      // follows the window — the page cannot aim it anywhere else either.
      overlayCorner: "bottom-right", // bottom-right | bottom-left | top-right | top-left
      // External forwarding: mirror every alert the plugin actually delivers to
      // webhook endpoints (Discord / Bark / Gotify / custom), so a phone or
      // another box can tell the user to come back. Off by default — nothing
      // leaves the browser until the user fills in an endpoint of their own.
      externalEnabled: false,
      externalAttention: true, // forward the "needs you" alerts
      externalDone: true, // forward the "reply finished" alerts
      // [{ id: string, type: 'discord' | 'bark' | 'gotify' | 'custom', url: string }]
      externalTargets: []
    };
    function readConfig() {
      var cfg = {};
      try {
        var raw = localStorage.getItem(LS_CONFIG);
        if (raw) cfg = JSON.parse(raw);
      } catch (e) { /* corrupt storage -> defaults */ }
      for (var k in DEFAULTS) if (!(k in cfg)) cfg[k] = DEFAULTS[k];
      return cfg;
    }
    function writeConfig(patch) {
      var cfg = readConfig();
      for (var k in patch) cfg[k] = patch[k];
      try { localStorage.setItem(LS_CONFIG, JSON.stringify(cfg)); } catch (e) {}
      return cfg;
    }
    var config = readConfig();
    // Persist a patch, swap the live module config and re-apply any active
    // title marker (its prefix follows the notification language).
    function setConfigLocal(patch) {
      config = writeConfig(patch);
      applyTitle();
      // Overlay re-apply: switching it off takes the cards down at once and a
      // new corner moves the layer without waiting for the next alert.
      try {
        if (!config.overlay) clearOverlays();
        else if (overlayLayer) overlayLayer.className = "dnm-ov-layer dnm-ov-" + overlayCorner();
      } catch (e) {}
      return config;
    }

    // Picked cue files live in their own localStorage keys, never inside the
    // config JSON: a data URL is ~1.37x the file size, and the config is parsed
    // on every readConfig() — which happens on every alert.
    var LS_SOUND = { done: "dshNotifyMe.sound.done", attention: "dshNotifyMe.sound.attention" };
    // 1 MiB of source audio is ~1.37 MiB once base64-encoded; localStorage
    // grants ~5 MiB per origin, and the other kind plus the config must fit too.
    var SOUND_MAX_BYTES = 1048576;
    function soundMode(kind) {
      var v = kind === "attention" ? config.soundAttention : config.soundDone;
      return (v === "custom" || v === "system") ? v : "synth";
    }
    // True when the platform, not this plugin, should make the noise: only then
    // is the toast raised un-silenced. The master Sound switch still mutes it.
    function systemCue(kind) { return config.sound && soundMode(kind) === "system"; }
    function readSound(kind) {
      try {
        var raw = localStorage.getItem(LS_SOUND[kind]);
        if (!raw) return null;
        var rec = JSON.parse(raw);
        return (rec && typeof rec.data === "string" && rec.data) ? rec : null;
      } catch (e) { return null; }
    }
    // false = the record did not fit (quota) or storage is unavailable; the
    // caller reports it and the previous record stays in place.
    function writeSound(kind, rec) {
      try {
        if (rec) localStorage.setItem(LS_SOUND[kind], JSON.stringify(rec));
        else localStorage.removeItem(LS_SOUND[kind]);
        return true;
      } catch (e) { return false; }
    }

    // ───────────────────────── copy tables ─────────────────────────
    // Notification copy, keyed by language id. Selected through
    // effectiveLang() so a pinned language stays pinned even while the DSH UI
    // speaks the other one.
    var TXT = {
      zh: {
        kind: { approval: "审批请求", "plan-review": "方案待确认", question: "提问" },
        kindDefault: "需要操作",
        bodyKind: { approval: "有审批待处理", "plan-review": "方案待确认", question: "有提问待回答" },
        bodyDefault: "需要你操作",
        current: "当前对话",
        doneTitle: "DSH · 回复完成",
        doneBody: "回复已完成",
        background: "后台会话",
        marker: "🔔 需要你 · ",
        doneMarker: "✅ 回复完成 · ",
        sep: "：",
        approve: "同意",
        reject: "拒绝",
        dismiss: "关闭这条提醒",
        testAttention: "这是一条测试提醒：DSH 需要你的操作",
        testDone: "测试提醒 · 回复完成示例",
        testApproval: "这是一条测试审批：点「同意 / 拒绝」试试快捷裁决",
        testApproved: "测试提醒 · 已模拟「同意」（仅测试，未改动任何会话）",
        testRejected: "测试提醒 · 已模拟「拒绝」（仅测试，未改动任何会话）",
        testExternalTitle: "外部通知测试",
        testExternalBody: "这是一条测试消息：外部通知通道工作正常"
      },
      en: {
        kind: { approval: "Approval request", "plan-review": "Plan review", question: "Question" },
        kindDefault: "Action needed",
        bodyKind: {
          approval: "An approval is waiting for you",
          "plan-review": "A plan awaits your review",
          question: "A question is waiting for you"
        },
        bodyDefault: "Your input is needed",
        current: "Current conversation",
        doneTitle: "DSH · Reply finished",
        doneBody: "Reply finished",
        background: "Background session",
        marker: "🔔 Action needed · ",
        doneMarker: "✅ Reply finished · ",
        sep: ": ",
        approve: "Approve",
        reject: "Reject",
        dismiss: "Dismiss this alert",
        testAttention: "This is a test alert: DSH is waiting for your input",
        testDone: "Test alert · reply-finished sample",
        testApproval: "This is a test approval: try the Approve / Reject buttons to settle it",
        testApproved: "Test alert · simulated \"Approve\" (test only, nothing changed)",
        testRejected: "Test alert · simulated \"Reject\" (test only, nothing changed)",
        testExternalTitle: "External notification test",
        testExternalBody: "Test message: the external notification channel works"
      }
    };
    // Locale service handle (registered on the client context by dsh-client-locale).
    var localeSvc = null;
    // Current DSH UI language: 'zh' | 'en' | null (unknown). Used by the
    // 'auto' notification-language mode.
    function currentUILang() {
      try {
        if (localeSvc && typeof localeSvc.getLocale === "function") {
          var a = localeSvc.getLocale().active;
          if (typeof a === "string" && a) {
            if (a.indexOf("zh") === 0) return "zh";
            if (a.indexOf("en") === 0) return "en";
          }
        }
      } catch (e) {}
      try {
        var dl = (document.documentElement && document.documentElement.lang) || "";
        if (dl.indexOf("zh") === 0) return "zh";
        if (dl.indexOf("en") === 0) return "en";
      } catch (e) {}
      return null;
    }
    function effectiveLang() {
      if (!config.language || config.language === "auto") return currentUILang() || "zh";
      return config.language === "en" ? "en" : "zh";
    }
    function texts() { return TXT[effectiveLang()] || TXT.zh; }

    // ─────────────────────── notification plumbing ───────────────────
    var permAsked = false;
    function requestPermission() {
      if (!("Notification" in window) || permAsked) return;
      permAsked = true;
      try {
        if (Notification.permission === "default") {
          Notification.requestPermission().catch(function () {});
        }
      } catch (e) {}
    }
    function canToast() {
      if (!config.toast) return false;
      try {
        return "Notification" in window && Notification.permission === "granted";
      } catch (e) { return false; } // a policy-disabled Notification must not break delivery
    }
    // True on the packaged desktop shell, where the app page lives under
    // dsh-app://app inside Electron. The desktop needs its own raise path
    // (raiseWindow below) and cannot carry quick-decision buttons at all.
    // Detection is a page-protocol read; the hostEnv setting can override it
    // for hosts where detection comes out wrong.
    function detectedDesktop() {
      try { return location.protocol === "dsh-app:"; } catch (e) { return false; }
    }
    function isDesktopShell() {
      if (config.hostEnv === "desktop") return true;
      if (config.hostEnv === "web") return false;
      return detectedDesktop();
    }
    // Bring the OS window forward. A browser tab answers to window.focus();
    // the Electron shell does not — DOM focus() never touches the native
    // window, so a toast click there left the session switched but the window
    // buried. The desktop rides the app's own dsh://open deep link instead:
    // the URL is fired through a hidden iframe (the shell's will-navigate and
    // window-open handlers intercept top-level navigations and window.open()
    // to non-http(s) URLs, but not subframe navigations), the OS hands it to
    // the protocol registration, and the single-instance owner restores,
    // shows and focuses the window — the same path the login completion page
    // uses to bring DSH forward.
    //
    // Verified on the real shell (DSH Desktop 0.2.0-rc.2, issue #9): a click
    // on the notification raises the window and switches the conversation in
    // one step, reproducibly. The fire must sit in a user-gesture context —
    // the page-side Notification onclick carries one, and Chromium drops
    // external-protocol navigations launched without it. That is also why
    // gesture-less injections (CDP evaluate, scripted iframe appends) silently
    // produce no protocol launch at all, which read like the channel being
    // blocked when the gesture was the only difference.
    function raiseWindow() {
      try { window.focus(); } catch (e) {}
      if (!isDesktopShell()) return;
      try {
        var f = document.createElement("iframe");
        f.setAttribute("aria-hidden", "true");
        f.setAttribute("tabindex", "-1");
        f.style.cssText = "position:fixed;left:-10px;top:-10px;width:0;height:0;border:0;visibility:hidden";
        f.src = "dsh://open";
        (document.body || document.documentElement).appendChild(f);
        setTimeout(function () {
          try { if (f.parentNode) f.parentNode.removeChild(f); } catch (e) {}
        }, 4000);
      } catch (e) {}
    }
    // Bring the window forward and make the alerted session the current one,
    // so a click on the toast lands on the conversation that needs the user
    // instead of just the app. Navigation moved with the host API: `sessions`
    // exposed open(id) through 0.1.5-rc.3, and 0.1.6+ routes the same action
    // through `uiWorkspace.openSession(id)`. Every failure here is non-fatal: a
    // session that left the list, an older host without either verb, or a
    // cordis service that cannot be resolved must still leave a usable window
    // in front.
    function focusSession(sessionId) {
      raiseWindow();
      if (!sessionId) return;
      try {
        var st = listStore && listStore.getSnapshot();
        if (st && st.byId && !st.byId[sessionId] && currentSessionId() !== sessionId) return;
        var svc = lookupService("sessions");
        if (svc && typeof svc.open === "function") { svc.open(sessionId); return; }
        var ws = lookupService("uiWorkspace");
        if (ws && typeof ws.openSession === "function") ws.openSession(sessionId);
      } catch (e) {}
    }
    // ─────────────── approval quick-decision bridge ───────────────
    // Action buttons exist only on persistent notifications
    // (ServiceWorkerRegistration.showNotification); the Notification()
    // constructor throws on an `actions` option. The worker half lives at the
    // bottom of this file's wrapper and only relays clicks back here, where the
    // pending interaction's own answer() settles the request.
    var BRIDGE_CHANNEL = "dsh-notify-me:bridge";
    var swRegistration = null;
    var swState = "idle"; // idle | disabled | registering | active | unsupported:* | failed:*
    var bridgeListening = false;
    var actionChannel = null;
    // Keyed by interaction key: every toast that carries buttons has a record
    // here, so a click can only ever decide the exact request it was raised
    // for. { sessionId, interaction, tag, test }
    var pendingActions = Object.create(null);
    // The single-record combo URL of THIS bundle — the only URL that may be
    // registered as a worker, since a multi-plugin combo would evaluate every
    // other plugin's factory in the worker and fail the registration. The boot
    // graph publishes it per entry ({id, url, rev}).
    function selfBundleUrl() {
      try {
        var boot = window.__DSH_BOOT__;
        var entries = boot && boot.entries;
        if (Array.isArray(entries)) {
          for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            if (e && e.id === "dsh-notify-me" && typeof e.url === "string" && e.url) return e.url;
          }
        }
      } catch (e) {}
      return null;
    }
    function ensureActionBridge() {
      if (!config.quickActions) { swState = "disabled"; return; }
      if (swState === "active" || swState === "registering") return;
      listenBridge();
      try {
        if (typeof navigator === "undefined" || !navigator.serviceWorker) {
          swState = "unsupported: no service worker";
          return;
        }
        if (window.isSecureContext === false) {
          swState = "unsupported: insecure context";
          return;
        }
        var url = selfBundleUrl();
        if (!url) {
          swState = "unsupported: bundle url unknown";
          return;
        }
        swState = "registering";
        navigator.serviceWorker.register(url).then(function (reg) {
          try {
            swRegistration = reg || null;
            if (!reg) { swState = "failed: no registration"; return; }
            if (reg.active) { swState = "active"; return; }
            var w = reg.installing || reg.waiting;
            if (!w) { swState = "active"; return; }
            var settle = function () {
              try {
                if (reg.active || w.state === "activated") swState = "active";
                else if (w.state === "redundant") swState = "failed: worker redundant";
              } catch (e) {}
            };
            try { w.addEventListener("statechange", settle); } catch (e) {}
            settle();
          } catch (e) {
            swState = "failed: " + ((e && e.message) || e);
          }
        }, function (err) {
          swState = "failed: " + ((err && err.message) || err);
        });
      } catch (e) {
        swState = "failed: " + ((e && e.message) || e);
      }
    }
    function bridgeActive() {
      return !!(swRegistration && swState === "active");
    }
    // Both relay paths end here; the worker's broadcast goes to every
    // same-origin page and the postMessage to every window client, so the
    // handler must be idempotent (decidePending() is a one-shot per key).
    function listenBridge() {
      if (bridgeListening) return;
      bridgeListening = true;
      try {
        if (typeof navigator !== "undefined" && navigator.serviceWorker &&
            typeof navigator.serviceWorker.addEventListener === "function") {
          navigator.serviceWorker.addEventListener("message", function (ev) {
            try { onBridgeMessage(ev && ev.data); } catch (e) {}
          });
        }
      } catch (e) {}
      try {
        if (typeof BroadcastChannel === "function") {
          actionChannel = new BroadcastChannel(BRIDGE_CHANNEL);
          actionChannel.onmessage = function (ev) {
            try { onBridgeMessage(ev && ev.data); } catch (e) {}
          };
        }
      } catch (e) {}
    }
    function onBridgeMessage(msg) {
      if (!msg || msg.source !== "dsh-notify-me" || msg.type !== "notification") return;
      if (msg.action === "approve") { decidePending(msg.key, "allowed-once"); return; }
      if (msg.action === "reject") { decidePending(msg.key, "rejected"); return; }
      // The worker picks the one window a click should land on (see the bridge):
      // its `navigate: false` copies keep every other DSH tab from stealing
      // focus or switching its own conversation. A message from before that
      // flag existed carries none and falls back to the old best-effort route.
      if (msg.navigate === false) return;
      if (config.autoFocus) focusSession(msg.sessionId || null);
    }
    // The live interaction wins over the reference captured at alert time (the
    // wait may have been replaced), and a key with no live record is stale —
    // the notification outlived its request, so the click must decide nothing.
    function findPendingByKey(key) {
      try {
        var svc = lookupService("uiSession");
        var found = interactionStore(svc);
        if (!found) return null;
        var snap = found.store.getSnapshot();
        if (!snap || typeof snap.forEach !== "function") return null;
        var hit = null;
        snap.forEach(function (value) {
          if (hit) return;
          var it = pendingOf(value, found.source);
          if (it && it.key === key) hit = it;
        });
        return hit;
      } catch (e) { return null; }
    }
    function closeNotificationTag(tag) {
      if (!swRegistration || typeof swRegistration.getNotifications !== "function") return;
      try {
        var done = function (list) {
          for (var i = 0; i < (list || []).length; i++) {
            try { list[i].close(); } catch (e) {}
          }
        };
        var r = swRegistration.getNotifications({ tag: tag });
        if (r && typeof r.then === "function") r.then(done, function () {});
        else done(r);
      } catch (e) {}
    }
    // One toast button press. outcome: 'allowed-once' | 'rejected' — exactly
    // the two decisions the in-page approval card exposes.
    function decidePending(key, outcome) {
      var rec = key ? pendingActions[key] : null;
      if (!rec) return false; // already answered elsewhere, or a stale toast
      delete pendingActions[key];
      if (!rec.test) closeNotificationTag(rec.tag);
      closeOverlayForKey(key);
      if (rec.test) {
        // Test toasts settle nothing real; the feedback toast IS the proof that
        // the button clicked all the way through the worker bridge.
        deliver("done", texts().doneTitle, outcome === "allowed-once" ? texts().testApproved : texts().testRejected, null, null);
        notifyEvent("decision", { key: key, outcome: outcome, sessionId: rec.sessionId || null, test: true });
        return true;
      }
      var target = findPendingByKey(key) || rec.interaction;
      if (!target || target.key !== key || typeof target.answer !== "function") return false;
      try {
        var p = target.answer(outcome);
        if (p && typeof p.catch === "function") p.catch(function () {});
      } catch (e) { return false; }
      unmarkAttention(key);
      notifyEvent("decision", { key: key, outcome: outcome, sessionId: rec.sessionId || null });
      return true;
    }
    // Attach buttons to one alert. Only real approval interactions qualify:
    // they are the only kind whose decision is a plain binary, and the only one
    // whose object answers answer('allowed-once' | 'rejected').
    function quickFor(key, it, sessionId) {
      // The overlay can settle approvals without a worker, so it counts as a
      // button channel on its own — the desktop shell, where OS action buttons
      // cannot render, gets them this way.
      if (!config.quickActions || !(config.toast || config.overlay)) return null;
      if (!it || it.kind !== "approval" || typeof it.answer !== "function") return null;
      var q = {
        key: key,
        sessionId: sessionId || null,
        interaction: it,
        tag: "dsh-notify-me-attention-" + key,
        test: false
      };
      pendingActions[key] = q;
      return q;
    }
    function quickForTest(key) {
      var q = {
        key: key,
        sessionId: null,
        interaction: null,
        tag: "dsh-notify-me-attention-" + key,
        test: true
      };
      pendingActions[key] = q;
      return q;
    }

    function showToast(kind, title, body, sessionId, quick) {
      if (!canToast()) return;
      try {
        var tag = quick ? quick.tag : "dsh-notify-me-" + kind;
        if (quick && bridgeActive()) {
          var d = texts();
          try {
            swRegistration.showNotification(title, {
              body: body || "",
              tag: tag,
              renotify: true,
              // The plugin owns the audio (see showToast's silent note below),
              // except in the 'system' cue mode, which hands the sound back to
              // the platform on purpose.
              silent: !systemCue(kind),
              icon: (location.origin || "") + "/favicon.svg",
              data: { key: quick.key, sessionId: sessionId || null, kind: kind, test: !!quick.test, focus: config.autoFocus !== false },
              actions: [
                { action: "approve", title: d.approve },
                { action: "reject", title: d.reject }
              ]
            });
            // No auto-close on purpose: an unanswered approval stays clickable
            // (toast, then Action Center) until the request is settled — the
            // wait-teardown path closes it through closeNotificationTag().
            return;
          } catch (e) { /* worker notifications unavailable -> plain toast */ }
        }
        var n = new Notification(title, {
          body: body || "",
          tag: tag,
          renotify: true,
          // The plugin owns the audio: its WebAudio cues already differ per
          // kind (attention vs done) and answer the Sound toggle and volume
          // slider. Without this flag the platform plays its own chime on top
          // of the beep — two sounds stacked on one alert. The single exception
          // is the 'system' cue mode, which is precisely "let the platform play
          // it"; the master Sound switch still mutes that too.
          silent: !systemCue(kind),
          icon: (location.origin || "") + "/favicon.svg"
        });
        if (config.autoFocus) {
          n.onclick = function () {
            focusSession(sessionId);
            n.close();
          };
        }
        setTimeout(function () { n.close(); }, 15000);
      } catch (e) {}
    }

    // ─────────────────── page overlay reminders ──────────────────────
    // Windows draws notification banners on the primary display and exposes no
    // way to aim them at another monitor; a user who keeps DSH on a second
    // screen therefore never sees a toast. This overlay draws the same alert
    // inside the page instead, so it lands on whatever screen the DSH window
    // occupies. It also needs no notification permission, and — unlike OS
    // action buttons, which require the Service Worker the desktop shell cannot
    // run — it can carry the 同意/拒绝 buttons everywhere. Off by default;
    // independent of the toast switch.
    var OVERLAY_STYLE_ID = "dsh-notify-me/overlay";
    var OVERLAY_ID = "dsh-notify-me-overlay";
    var OVERLAY_MAX_CARDS = 4;
    // An approval card is actionable and stays until it is answered or closed;
    // the other kinds fade on the toast's own schedule (a toast closes at 15s).
    var OVERLAY_TTL = { attention: 20000, done: 8000 };
    var OVERLAY_CORNERS = ["bottom-right", "bottom-left", "top-right", "top-left"];
    var OVERLAY_CSS = "" +
      ".dnm-ov-layer{position:fixed;z-index:2147483000;display:flex;flex-direction:column;gap:10px;pointer-events:none;max-width:calc(100vw - 24px)}" +
      ".dnm-ov-bottom-right{right:16px;bottom:16px;align-items:flex-end}" +
      ".dnm-ov-bottom-left{left:16px;bottom:16px;align-items:flex-start}" +
      ".dnm-ov-top-right{right:16px;top:16px;align-items:flex-end}" +
      ".dnm-ov-top-left{left:16px;top:16px;align-items:flex-start}" +
      ".dnm-ov{pointer-events:auto;width:320px;max-width:calc(100vw - 32px);box-sizing:border-box;border-radius:12px;padding:10px 12px 11px;display:flex;flex-direction:column;gap:7px;font-size:13px;line-height:19px;color:var(--dsw-alias-label-primary,#f3f4f6);background:var(--dsw-alias-bg-layer-3,rgba(30,32,36,.97));border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));border-left-width:3px;box-shadow:0 12px 32px rgba(0,0,0,.32);cursor:pointer;animation:dnmOvIn .16s ease-out}" +
      ".dnm-ov-attention{border-left-color:var(--dsw-alias-state-warning-primary,#f59e0b)}" +
      ".dnm-ov-done{border-left-color:var(--dsw-alias-state-success-primary,#22c55e)}" +
      ".dnm-ov-head{display:flex;align-items:center;gap:7px}" +
      ".dnm-ov-dot{flex:none;width:7px;height:7px;border-radius:50%;background:currentColor;opacity:.55}" +
      ".dnm-ov-attention .dnm-ov-dot{color:var(--dsw-alias-state-warning-primary,#f59e0b);opacity:1}" +
      ".dnm-ov-done .dnm-ov-dot{color:var(--dsw-alias-state-success-primary,#22c55e);opacity:1}" +
      ".dnm-ov-title{flex:1;min-width:0;font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".dnm-ov-x{flex:none;border:0;background:transparent;color:inherit;opacity:.6;font-size:15px;line-height:15px;padding:0 2px;cursor:pointer;font-family:inherit}" +
      ".dnm-ov-x:hover{opacity:1}" +
      ".dnm-ov-body{color:var(--dsw-alias-label-secondary,rgba(220,222,226,.86));font-size:12px;line-height:18px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}" +
      ".dnm-ov-actions{display:flex;gap:8px;margin-top:2px}" +
      ".dnm-ov-btn{flex:1;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.4));background:var(--dsw-alias-bg-layer-1,rgba(255,255,255,.06));color:inherit;border-radius:8px;padding:5px 10px;font-size:12px;font-family:inherit;cursor:pointer}" +
      ".dnm-ov-btn:hover{background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.12))}" +
      ".dnm-ov-approve{border-color:transparent;background:var(--dsw-alias-state-business-primary,#3b82f6);color:#fff}" +
      ".dnm-ov-approve:hover{background:var(--dsw-alias-state-business-primary,#3b82f6);filter:brightness(1.06)}" +
      ".dnm-ov-reject{color:inherit}" +
      "@keyframes dnmOvIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}";
    var overlayLayer = null;
    var overlayCards = Object.create(null); // id -> { card, key, kind, timer }
    var overlaySeq = 0;
    function overlayCorner() {
      return OVERLAY_CORNERS.indexOf(config.overlayCorner) === -1 ? "bottom-right" : config.overlayCorner;
    }
    function injectOverlayStyle() {
      try {
        if (typeof document === "undefined" || typeof document.createElement !== "function") return;
        if (!document.head && !document.documentElement) return;
        var sel = "style[data-plugin-css=" + JSON.stringify(OVERLAY_STYLE_ID) + "]";
        var seen = false;
        try { seen = !!(document.querySelector && document.querySelector(sel)); } catch (e) {}
        if (seen) return;
        var s = document.createElement("style");
        s.dataset.plugin = "dsh-notify-me";
        s.dataset.pluginCss = OVERLAY_STYLE_ID;
        s.textContent = OVERLAY_CSS;
        (document.head || document.documentElement).appendChild(s);
      } catch (e) {}
    }
    // The fixed layer lives directly under <body> so no ancestor transform or
    // stacking context in the host app can drag the cards away from the corner.
    function ensureOverlayLayer() {
      try {
        if (typeof document === "undefined" || typeof document.createElement !== "function" || !document.body) return null;
        injectOverlayStyle();
        if (!overlayLayer || !overlayLayer.parentNode) {
          // A reload of this bundle can leave a previous layer behind; the id is
          // the only handle an HMR-free page gives us.
          var old = null;
          try { old = document.getElementById && document.getElementById(OVERLAY_ID); } catch (e) {}
          if (old && old.parentNode) old.parentNode.removeChild(old);
          overlayLayer = document.createElement("div");
          overlayLayer.id = OVERLAY_ID;
          overlayLayer.setAttribute("role", "status");
          overlayLayer.setAttribute("aria-live", "polite");
          document.body.appendChild(overlayLayer);
        }
        overlayLayer.className = "dnm-ov-layer dnm-ov-" + overlayCorner();
        return overlayLayer;
      } catch (e) { return null; }
    }
    function dismissOverlay(id) {
      var rec = overlayCards[id];
      if (!rec) return;
      delete overlayCards[id];
      if (rec.timer) { try { clearTimeout(rec.timer); } catch (e) {} }
      try { if (rec.card && rec.card.parentNode) rec.card.parentNode.removeChild(rec.card); } catch (e) {}
    }
    // An approval that gets answered elsewhere (the in-page card, another
    // toast, a session switch) must not leave a stale overlay behind.
    function closeOverlayForKey(key) {
      if (!key) return;
      var ids = Object.keys(overlayCards);
      for (var i = 0; i < ids.length; i++) {
        if (overlayCards[ids[i]].key === key) dismissOverlay(ids[i]);
      }
    }
    function clearOverlays() {
      var ids = Object.keys(overlayCards);
      for (var i = 0; i < ids.length; i++) dismissOverlay(ids[i]);
      if (overlayLayer) {
        try { if (overlayLayer.parentNode) overlayLayer.parentNode.removeChild(overlayLayer); } catch (e) {}
        overlayLayer = null;
      }
    }
    function overlayCount() { return Object.keys(overlayCards).length; }
    // Same inputs as showToast: `quick` is the approval record built by
    // quickFor(), and it is what lets an overlay settle the request in place.
    function showOverlay(kind, title, body, sessionId, quick) {
      if (!config.overlay) return false;
      var layer = ensureOverlayLayer();
      if (!layer) return false;
      var d = texts();
      try {
        var id = "ov" + (++overlaySeq);
        var card = document.createElement("div");
        card.className = "dnm-ov dnm-ov-" + (kind === "attention" ? "attention" : "done");
        card.setAttribute("role", kind === "attention" ? "alert" : "status");
        var head = document.createElement("div");
        head.className = "dnm-ov-head";
        var dot = document.createElement("span");
        dot.className = "dnm-ov-dot";
        var label = document.createElement("span");
        label.className = "dnm-ov-title";
        label.textContent = String(title == null ? "" : title);
        var close = document.createElement("button");
        close.type = "button";
        close.className = "dnm-ov-x";
        close.setAttribute("aria-label", d.dismiss);
        close.textContent = "×";
        close.onclick = function (ev) {
          if (ev && ev.stopPropagation) ev.stopPropagation();
          dismissOverlay(id);
        };
        head.appendChild(dot);
        head.appendChild(label);
        head.appendChild(close);
        card.appendChild(head);
        if (body) {
          var bodyEl = document.createElement("div");
          bodyEl.className = "dnm-ov-body";
          bodyEl.textContent = String(body);
          card.appendChild(bodyEl);
        }
        if (quick && typeof quick.key === "string") {
          var actions = document.createElement("div");
          actions.className = "dnm-ov-actions";
          var actionBtn = function (cls, text, outcome) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "dnm-ov-btn " + cls;
            b.textContent = text;
            b.onclick = function (ev) {
              if (ev && ev.stopPropagation) ev.stopPropagation();
              try { decidePending(quick.key, outcome); } catch (e) {}
              dismissOverlay(id);
            };
            return b;
          };
          actions.appendChild(actionBtn("dnm-ov-approve", d.approve, "allowed-once"));
          actions.appendChild(actionBtn("dnm-ov-reject", d.reject, "rejected"));
          card.appendChild(actions);
        }
        // A click on the card body opens the conversation, exactly like a toast
        // body click — and here it is an ordinary page gesture, so it reaches the
        // desktop's dsh:// raise path even though a worker click would not.
        card.onclick = function () {
          if (config.autoFocus) focusSession(sessionId || null);
          dismissOverlay(id);
        };
        layer.appendChild(card);
        var rec = { card: card, key: (quick && quick.key) ? quick.key : null, kind: kind, timer: null };
        overlayCards[id] = rec;
        var ids = Object.keys(overlayCards);
        for (var i = 0; i < ids.length - OVERLAY_MAX_CARDS; i++) dismissOverlay(ids[i]);
        if (!(quick && typeof quick.key === "string")) {
          var ttl = OVERLAY_TTL[kind === "attention" ? "attention" : "done"];
          if (ttl) rec.timer = setTimeout(function () { dismissOverlay(id); }, ttl);
        }
        return true;
      } catch (e) { return false; }
    }
    // Sound: WebAudio beeps (no asset needed). The context only runs after a
    // user gesture; we unlock it on the first pointer/key event.
    var audioCtx = null;
    function unlockAudio() {
      try {
        if (!audioCtx) {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          audioCtx = new AC();
        }
        if (audioCtx.state === "suspended") audioCtx.resume().catch(function () {});
      } catch (e) {}
    }
    function tone(freq, startIn, durMs, vol) {
      if (!audioCtx || audioCtx.state !== "running") return;
      try {
        var t0 = audioCtx.currentTime + startIn;
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t0);
        osc.stop(t0 + durMs / 1000 + 0.05);
      } catch (e) {}
    }
    // 'custom' plays the file the user picked. Anything short of a started
    // element — no file stored, a browser without the element, a constructor or
    // play() that throws — falls through to the built-in cue, so an alert is
    // never silent merely because a stored file went missing or unreadable.
    // The last failure mode is different in kind: a decode or autoplay refusal
    // rejects play()'s promise instead of throwing, so it gets the built-in cue
    // handed to it as a fallback rather than falling through.
    function playCustomSound(kind, fallback) {
      var rec = readSound(kind);
      if (!rec) return false;
      try {
        var el = new Audio(rec.data);
        el.volume = Math.max(0, Math.min(1, config.volume));
        var started = el.play();
        if (started && typeof started.catch === "function") started.catch(fallback);
        return true;
      } catch (e) { return false; }
    }
    // 'system' returns silently on purpose: showToast raises the toast
    // un-silenced for exactly this mode, so the OS plays its own notification
    // sound and the plugin must not stack a second cue on top of it.
    function playCue(kind, build) {
      if (!config.sound) return;
      var mode = soundMode(kind);
      if (mode === "system") return;
      function synth() {
        // An async rejection can land after the user muted everything.
        if (!config.sound) return;
        unlockAudio();
        build();
      }
      if (mode === "custom" && playCustomSound(kind, synth)) return;
      synth();
    }
    function playAttentionSound() {
      playCue("attention", function () {
        tone(880, 0.0, 140, config.volume);
        tone(1174, 0.16, 140, config.volume);
        tone(1568, 0.32, 200, config.volume);
      });
    }
    function playDoneSound() {
      playCue("done", function () {
        tone(659, 0.0, 150, config.volume);
        tone(988, 0.18, 260, config.volume);
      });
    }
    function unlockOnce() {
      unlockAudio();
      requestPermission();
    }
    function onFirstGesture() {
      unlockOnce();
      window.removeEventListener("pointerdown", onFirstGesture, true);
      window.removeEventListener("keydown", onFirstGesture, true);
    }
    window.addEventListener("pointerdown", onFirstGesture, true);
    window.addEventListener("keydown", onFirstGesture, true);

    // ───────────────────── external webhook forwarding ─────────────────────
    // Every alert fire() actually delivers is mirrored to the user's webhook
    // targets (Discord / Bark / Gotify / custom), so being away from the
    // machine does not mean missing the "come back" cue. Off by default:
    // nothing leaves the browser until the user fills in an endpoint.
    //
    // CORS reality: a page can only read a response the endpoint allows it to
    // read. Discord webhooks answer with Access-Control-Allow-Origin: * and
    // work directly; a self-hosted endpoint may not. So each send tries a
    // plain CORS POST first and, only when the browser itself refuses the
    // exchange (a rejection from fetch — not an HTTP error status, which means
    // the server did see the request), retries as a no-cors POST with a
    // text/plain content type: the request is still delivered, only the reply
    // is unreadable ("unverified"). Bark gets a third chance in the classic
    // GET shape `url/<title>/<body>`, which needs no CORS at all. Real HTTP
    // errors are reported as failures and never retried blindly.
    var externalStat = { sent: 0, unverified: 0, failed: 0, lastAt: null, lastStatus: null };
    // Valid, enabled targets only. A stale entry (bad URL, unknown type) is
    // skipped rather than breaking the others; the settings page only ever
    // writes well-formed entries.
    function externalTargets() {
      var out = [];
      var list = config.externalTargets;
      if (!Array.isArray(list)) return out;
      for (var i = 0; i < list.length; i++) {
        var t = list[i];
        if (!t || typeof t !== "object" || t.enabled === false) continue;
        var url = typeof t.url === "string" ? t.url.trim() : "";
        if (!/^https?:\/\//i.test(url)) continue;
        var type = t.type;
        if (type !== "discord" && type !== "bark" && type !== "gotify") type = "custom";
        out.push({ id: typeof t.id === "string" ? t.id : "", type: type, url: url });
      }
      return out;
    }
    // Per-endpoint JSON body, each shaped by that service's own convention;
    // the custom type gets the full generic event so any JSON endpoint works.
    function externalBody(type, ev) {
      if (type === "discord") {
        var content = ev.title + "\n" + ev.body;
        if (content.length > 1900) content = content.slice(0, 1900) + "…";
        return JSON.stringify({ username: "DSH", content: content });
      }
      if (type === "bark") {
        return JSON.stringify({ title: ev.title, body: ev.body, group: "dsh-notify-me" });
      }
      if (type === "gotify") {
        return JSON.stringify({ title: ev.title, message: ev.body, priority: ev.kind === "attention" ? 8 : 5 });
      }
      return JSON.stringify({
        source: "dsh-notify-me",
        version: api.version,
        event: ev.kind,
        title: ev.title,
        body: ev.body,
        sessionId: ev.sessionId || null,
        time: ev.time
      });
    }
    // Resolves to 'sent' | 'unverified' | 'failed (…)'; never rejects.
    function postOnce(url, bodyStr, plain) {
      return fetch(url, {
        method: "POST",
        mode: plain ? "no-cors" : "cors",
        cache: "no-store",
        headers: { "Content-Type": plain ? "text/plain;charset=UTF-8" : "application/json" },
        body: bodyStr
      }).then(function (res) {
        if (plain) return "unverified"; // opaque: delivered, reply unreadable
        if (res && res.ok) return "sent";
        return "failed (HTTP " + (res ? res.status : "?") + ")";
      });
    }
    // Bark's path form: url/<title>/<body>. A plain GET first (readable), then
    // a no-cors GET — which the browser always hands back, so treat it as
    // unverified rather than guaranteed.
    function barkGet(url, ev) {
      var u = url.replace(/\/+$/, "") + "/" + encodeURIComponent(ev.title || "DSH") + "/" + encodeURIComponent(ev.body || "");
      return fetch(u, { method: "GET", cache: "no-store" }).then(function (res) {
        return res && res.ok ? "sent" : Promise.reject(new Error("HTTP " + (res ? res.status : "?")));
      }).catch(function () {
        return fetch(u, { method: "GET", mode: "no-cors", cache: "no-store" }).then(function () { return "unverified"; });
      });
    }
    function postExternal(target, ev) {
      if (typeof fetch !== "function") return Promise.resolve("failed (no fetch)");
      var bodyStr = externalBody(target.type, ev);
      return postOnce(target.url, bodyStr, false).catch(function (err) {
        var msg = "failed (" + (err && err.message ? err.message : String(err)) + ")";
        return postOnce(target.url, bodyStr, true).then(null, function () {
          if (target.type !== "bark") return msg;
          return barkGet(target.url, ev).then(null, function () { return msg; });
        });
      }).then(function (status) {
        if (status === "sent") externalStat.sent++;
        else if (status === "unverified") externalStat.unverified++;
        else externalStat.failed++;
        externalStat.lastAt = new Date().toISOString();
        externalStat.lastStatus = status;
        return status;
      });
    }
    // Mirror one delivered alert to every enabled target. The alert path is
    // fire-and-forget — the toast must never wait on the network; `onDone`
    // exists for the settings test button, which wants the verdict.
    // The per-kind toggles gate real alerts only; the test button posts
    // regardless (that is the point of a channel test).
    function dispatchExternal(kind, title, body, sessionId, onDone) {
      if (!config.externalEnabled) return;
      if (kind === "attention" && !config.externalAttention) return;
      if (kind === "done" && !config.externalDone) return;
      sendExternalToAll(kind, title, body, sessionId, onDone);
    }
    function sendExternalToAll(kind, title, body, sessionId, onDone) {
      var targets = externalTargets();
      if (!targets.length) { if (typeof onDone === "function") onDone([]); return; }
      var ev = {
        kind: kind,
        title: title,
        body: body || "",
        sessionId: sessionId || null,
        time: new Date().toISOString()
      };
      var ps = [];
      for (var i = 0; i < targets.length; i++) {
        try { ps.push(postExternal(targets[i], ev)); } catch (e) { ps.push(Promise.resolve("failed (dispatch)")); }
      }
      if (typeof onDone === "function") Promise.all(ps).then(onDone, function () {});
    }

    // ────────────────────────── title marker ─────────────────────────
    // The host owns document.title (it tracks the session/workspace name), so
    // the base title is re-read on every apply instead of being frozen once —
    // and the exact string we last wrote is remembered, so the host taking the
    // title over (or an earlier load leaving a marker behind) can never make us
    // mistake our own marker for the base title.
    var attentionActive = 0;
    var doneActive = 0; // "完成未读" marks, one per finished-but-unread session
    var hostBase = null; // document.title as the host last left it
    var writtenTitle = null; // exact string this plugin last put into document.title
    // Our own marker prefixes never belong to the base title — strip leftovers
    // (an earlier load that was closed while a mark was up, or a title the host
    // tracked while a marker was up) before storing the base. Both marker kinds
    // can be up at once and either may lead, so strip repeatedly.
    function cleanBase(t) {
      var d = texts();
      var prefixes = [d.marker, TXT.zh.marker, TXT.en.marker, d.doneMarker, TXT.zh.doneMarker, TXT.en.doneMarker];
      var stripped = true;
      while (stripped) {
        stripped = false;
        for (var i = 0; i < prefixes.length; i++) {
          if (prefixes[i] && t.indexOf(prefixes[i]) === 0) {
            t = t.slice(prefixes[i].length);
            stripped = true;
          }
        }
      }
      return t;
    }
    function applyTitle() {
      try {
        var current = String(document.title || "");
        if (current !== writtenTitle) hostBase = cleanBase(current);
        var d = texts();
        var prefix = "";
        if (config.enabled) {
          // "needs you" leads when both kinds are up: it is the one that wants
          // action, the unread mark only says something finished.
          if (attentionActive > 0) prefix += d.marker;
          if (doneActive > 0) prefix += d.doneMarker;
        }
        var next = prefix + hostBase;
        writtenTitle = next;
        if (current !== next) document.title = next;
      } catch (e) {}
    }
    function acquireTitleMark() {
      attentionActive += 1;
      applyTitle();
    }
    function releaseTitleMark() {
      if (attentionActive > 0) attentionActive -= 1;
      applyTitle();
    }
    // Unread-reply marker: one per session id, held exactly while the host
    // still calls the completion unread (sessionStatus.completionUnread on
    // 0.1.6+, the list row's `completed` reminder bit on older hosts) and
    // dropped the moment the session is opened — the tab then reads "something
    // finished, waiting for you" until it is read.
    var doneUnreadMarks = Object.create(null); // sid -> true
    function markDoneUnread(sid) {
      if (!sid || doneUnreadMarks[sid]) return;
      doneUnreadMarks[sid] = true;
      doneActive += 1;
      applyTitle();
    }
    function unmarkDoneUnread(sid) {
      if (!sid || !doneUnreadMarks[sid]) return;
      delete doneUnreadMarks[sid];
      if (doneActive > 0) doneActive -= 1;
      applyTitle();
    }
    // Title marker ownership: on hosts that publish pending interactions
    // (uiSession) that source owns the marker, but whichever source saw the wait
    // first must still mark it (the other one may never report that key at all),
    // so the mark is acquired by the first reporter and released only by its
    // owner. Without this, the two sources would either double-mark or never
    // clear the mark.
    function markAttention(key) {
      if (attentionKeysMarked[key]) return;
      attentionKeysMarked[key] = true;
      acquireTitleMark();
    }
    function unmarkAttention(key) {
      delete quietedAttention[key]; // the wait is over; a queued alert dies with it
      // A toast that still carries buttons for this wait dies with it too —
      // otherwise a settled request would leave a clickable (but stale)
      // approval toast behind. Test toasts are exempt: their click is the
      // proof, so they outlive the short title mark on purpose.
      var rec = pendingActions[key];
      if (rec) {
        delete pendingActions[key];
        if (!rec.test) {
          closeNotificationTag(rec.tag);
          closeOverlayForKey(key);
        }
      }
      if (!attentionKeysMarked[key]) return;
      delete attentionKeysMarked[key];
      releaseTitleMark();
    }

    // ─────────────────────── shared alert core ───────────────────────
    var attentionKeysFired = Object.create(null); // dedupe per pending key
    var attentionKeysMarked = Object.create(null); // keys currently holding a title mark
    // Waits silenced because their session is the one on screen, keyed by
    // interaction key so an entry dies with the wait it belongs to (the mark
    // release path deletes it) and is re-delivered once the page is backgrounded.
    var quietedAttention = Object.create(null);
    var lastAttentionAt = 0;
    // One completion can reach this plugin twice: the running edge from the
    // controller snapshots and the completionUnread level flag from
    // sessionStatus are two views of the same host event and land in the same
    // tick (the host publishes both stores from one manager update). A short
    // per-session window collapses them; two genuine completions of one session
    // are never that close — each needs a whole turn in between.
    var doneFiredAt = Object.create(null); // sid -> last done report timestamp
    var DONE_DEDUPE_MS = 250;

    function hidden() { return document.hidden || document.visibilityState === "hidden"; }

    // Deliver one alert regardless of visibility rules (used by the test
    // buttons); respects the master switch and permission state. The title
    // marker is NOT touched here — its ownership belongs to the watchers
    // (markAttention / unmarkAttention), which keeps the counter balanced.
    function notifyEvent(kind, payload) {
      try {
        if (window.__dshNotifyMe && window.__dshNotifyMe.onEvent) {
          window.__dshNotifyMe.onEvent(kind, payload);
        }
      } catch (e) {}
    }
    function deliver(kind, title, body, sessionId, quick) {
      if (!config.enabled) return;
      showToast(kind, title, body, sessionId, quick);
      showOverlay(kind, title, body, sessionId, quick);
      if (kind === "attention") {
        playAttentionSound();
      } else {
        playDoneSound();
      }
      notifyEvent(kind, { title: title, body: body, sessionId: sessionId || null });
    }
    function fire(kind, title, body, isCurrent, sessionId, quick) {
      if (!config.enabled) return false;
      if (kind === "attention" && config.attentionHiddenOnly && !hidden()) return false;
      // The wait belongs to the conversation the user is looking at right now:
      // the approval card is already on screen, so a toast would only cover the
      // thing it is asking about. The caller keeps the tab marker, and
      // flushQuieted() re-delivers the alert the moment the page is backgrounded.
      if (kind === "attention" && quietedByVisibleSession(isCurrent)) return false;
      if (kind === "done" && config.doneHiddenOnly && !hidden()) return false;
      deliver(kind, title, body, sessionId, quick);
      // The alert reached the user locally (or would have, had the tab a
      // voice): mirror the same copy to the outside world. Fire-and-forget —
      // a slow endpoint must never delay or break the local alert.
      try { dispatchExternal(kind, title, body, sessionId); } catch (e) {}
      return true;
    }
    // True when this alert must stay silent purely because it is about the
    // session already on screen. Kept separate from fire() so the caller can
    // queue exactly this case and nothing else.
    function quietedByVisibleSession(isCurrent) {
      return !!(isCurrent && config.currentHiddenOnly && !hidden());
    }
    // Queued copies of the alerts that rule suppressed. Delivered by key so a
    // wait that got answered while the user was still on the page never fires.
    function queueQuieted(key, copy) {
      if (key && copy) quietedAttention[key] = copy;
    }
    function flushQuieted() {
      if (!config.enabled || !hidden()) return;
      var keys = Object.keys(quietedAttention);
      for (var i = 0; i < keys.length; i++) {
        var copy = quietedAttention[keys[i]];
        delete quietedAttention[keys[i]];
        fire("attention", copy.title, copy.body, false, copy.sessionId, copy.quick || null);
      }
    }
    // A display label for a session row ("current" maps to the localized
    // "当前对话 / Current conversation" placeholder).
    function sessionLabelText(row) {
      var raw = row && row.label;
      if (!raw || raw === "current") return texts().current;
      return raw;
    }
    // The session the user is looking at, or null while the list is not ready.
    // Two host generations own this fact differently:
    //   * <= 0.1.5-rc.3: the list snapshot carried `current`;
    //   * 0.1.6+ (incl. 0.2.0-rc.2): `current` is gone and the main view's
    //     retention count marks the on-screen session — the shipped
    //     DocumentTitle, ui-workspace browser and ui-session isMain() all
    //     derive it exactly this way.
    function currentSessionId() {
      try {
        var st = listStore && listStore.getSnapshot();
        if (!st) return null;
        if (typeof st.current === "string" && st.current) return st.current;
        var byId = st.byId || {};
        for (var id in byId) {
          var row = byId[id];
          if (row && row.retainedBy && (row.retainedBy.mainView || 0) > 0) return id;
        }
      } catch (e) {}
      return null;
    }
    // Display label for a session id we only know from the interaction map:
    // the list row's title, the localized "current" placeholder for the selected
    // session, the raw id as a last resort.
    function labelForSessionId(sid) {
      try {
        var st = listStore && listStore.getSnapshot();
        if (st) {
          var sum = st.byId && st.byId[sid];
          if (sum) return sessionLabelText({ label: sum.displayTitle || sum.title || "" });
          if (currentSessionId() === sid) return texts().current;
        }
      } catch (e) {}
      return sid;
    }
    // Should this session's alerts stay muted as a subagent? Every child session
    // a subagent run created is listed as a row carrying `origin: 'subagent'`
    // (plus a parentId), including the rows the host synthesizes from its
    // subagentCatalog. Those alerts describe a step of another conversation's
    // turn, so the ones running in the background are muted by default
    // (config.ignoreSubagent); a forked session has a parentId but no origin and
    // is the user's own conversation, so it keeps alerting. The subagent session
    // the user has open is not background at all: it is on screen like any other
    // conversation, so it alerts by the normal rules (including the
    // current-conversation quiet rule) and is never a mute candidate. Read live
    // rather than cached, so the settings switch and session switches both take
    // effect on the next event without rebinding anything.
    function isSubagentSession(sid, currentId) {
      if (!config.ignoreSubagent || !sid) return false;
      // Reuse the caller's derivation when it has one. Every row walk already
      // knows the on-screen session (onListChanged derives it once and then
      // calls this per row), and deriving it again inside the row rescans the
      // whole list: O(rows x sessions) on 0.1.6+ hosts, where the list snapshot
      // has no `current` and the on-screen row has to be found by walking byId.
      if ((currentId === undefined ? currentSessionId() : currentId) === sid) return false;
      try {
        var st = listStore && listStore.getSnapshot();
        var sum = st && st.byId && st.byId[sid];
        if (sum && sum.origin === "subagent") return true;
      } catch (e) {}
      return false;
    }
    // Returns null once the alert went out, or the copy it would have shown
    // when only the visible-session rule held it back — the caller queues that
    // copy by interaction key so it can still fire from the background (the
    // quick-decision payload rides along with the copy).
    function fireAttention(kind, sessionLabel, detail, isCurrent, sessionId, quick) {
      var d = texts();
      var label = d.kind[kind] || d.kindDefault;
      var content = detail || d.bodyKind[kind] || d.bodyDefault;
      var who = sessionLabel || "";
      var title = "DSH · " + label;
      var body = (who ? who + d.sep : "") + content;
      if (quietedByVisibleSession(isCurrent)) return { title: title, body: body, sessionId: sessionId || null, quick: quick || null };
      fire("attention", title, body, isCurrent, sessionId, quick);
      return null;
    }
    function fireDone(sessionLabel, snippet, sessionId) {
      var d = texts();
      var body = sessionLabel || d.doneBody;
      if (snippet) body = body + "\n" + snippet;
      fire("done", d.doneTitle, body, false, sessionId);
    }
    // Every "reply finished" report funnels through here, so the edge path and
    // the completionUnread level flag cannot double-alert one completion. The
    // timestamp is recorded even when the visibility rules suppress the toast:
    // the report was handled (the unread marker is what persists), not queued.
    function reportDone(sessionLabel, snippet, sessionId) {
      if (sessionId) {
        var now = Date.now();
        if (doneFiredAt[sessionId] && now - doneFiredAt[sessionId] < DONE_DEDUPE_MS) return;
        doneFiredAt[sessionId] = now;
      }
      fireDone(sessionLabel, snippet, sessionId);
    }
    // Test alerts deliberately ignore the visibility rules (attentionHiddenOnly
    // / doneHiddenOnly): the whole point of a test button is to prove the
    // channel works while you are looking at the page. Only the master switch
    // (and browser notification permission) can stop them. The attention test
    // also drops its title marker again shortly after, so a test never leaves a
    // standing "waiting on you" mark in the tab.
    var TEST_MARK_RELEASE_MS = 6000;
    var TEST_MARK_KEY = "test:attention";
    function testAlert(kind) {
      var d = texts();
      if (kind === "approval") {
        // End-to-end proof of the quick-decision path: this toast carries the
        // same 同意/拒绝 buttons as a real approval one, and clicking them runs
        // the whole worker-bridge -> decidePending() chain (settling nothing
        // real — the feedback toast says so).
        var key = "test:approval:" + String(Date.now());
        var quick = quickForTest(key);
        deliver("attention", "DSH · " + d.kind.approval, d.testApproval, null, quick);
        markAttention(key);
        // The title mark drops like every other test's, but the toast is NOT
        // closed with it — its buttons are the very thing being tested.
        setTimeout(function () { unmarkAttention(key); }, TEST_MARK_RELEASE_MS);
        return;
      }
      if (kind === "attention") {
        deliver("attention", "DSH · " + d.kind.question, d.testAttention);
        markAttention(TEST_MARK_KEY);
        setTimeout(function () { unmarkAttention(TEST_MARK_KEY); }, TEST_MARK_RELEASE_MS);
      } else {
        deliver("done", d.doneTitle, d.testDone);
      }
    }

    // ───────────────────────── state machine ─────────────────────────
    // prevById: per-session-id baseline of what we have already reported.
    //   { running: bool, pendingKeys: string[] , doneArmed: bool, seeded: bool }
    var prevById = Object.create(null);
    var faceSub = null; // current session face unsubscribe
    var currentFaceId = null;
    var listStore = null;
    var rootCtx = null; // client cordis context, captured at apply()
    // uiSession pending-interaction watcher (DSH >= 0.1.2-alpha.2)
    var uiPending = false; // true once the interaction snapshot is readable
    var uiSub = null;
    var uiStore = null; // the interaction store we hold a subscription on
    var uiSource = null; // 'sessionStatus' (0.1.6+) | 'pendingInteractions' (0.1.2-0.1.5)
    var uiBindNote = "not attempted"; // last lookup outcome, read by __dshNotifyMe.debug()
    var uiWarned = false; // one unreachable-service warning per page load
    var uiBaseline = Object.create(null); // sessionId -> { key: string }

    // One-line detail for a pending interaction. Two shapes reach this:
    //   * the pre-0.1.2 controller payload (approval/question requested frames)
    //     — flat, its text under `text`/`question`/…;
    //   * the 0.1.2+ uiSession interaction objects — class instances whose own
    //     fields are the detail (PendingApproval: toolName/reason/callId,
    //     PendingQuestion: questions[]).
    function textFromPayload(payload) {
      if (!payload || typeof payload !== "object") return "";
      function clip(s) {
        s = String(s).replace(/\s+/g, " ").trim();
        if (!s) return "";
        return s.length > 160 ? s.slice(0, 160) + "…" : s;
      }
      // scalar fields (covers the flat pre-0.1.2 payloads and PendingApproval)
      var keys = ["text", "question", "prompt", "title", "summary", "description", "message", "operation", "toolName", "reason", "name", "tool"];
      for (var i = 0; i < keys.length; i++) {
        var v = payload[keys[i]];
        if (typeof v === "string") {
          var s = clip(v);
          if (s) {
            // PendingApproval carries both the tool and the human-readable
            // reason — "pwsh" alone says nothing useful in a toast.
            if (keys[i] === "toolName" && typeof payload.reason === "string" && clip(payload.reason)) {
              return s + " · " + clip(payload.reason);
            }
            return s;
          }
        } else if (v && typeof v === "object" && typeof v.text === "string" && clip(v.text)) {
          return clip(v.text);
        }
      }
      // nested batches (PendingQuestion.questions -> { question, detail, options })
      var qs = payload.questions;
      if (Array.isArray(qs) && qs.length > 0) {
        var q = qs[0];
        if (typeof q === "string") return clip(q);
        if (q && typeof q === "object") {
          var qk = ["question", "title", "text", "detail"];
          for (var j = 0; j < qk.length; j++) {
            if (typeof q[qk[j]] === "string" && clip(q[qk[j]])) return clip(q[qk[j]]);
          }
        }
      }
      return "";
    }
    function snippetOfLastAssistant(snap) {
      try {
        var nodes = snap.nodes || [];
        for (var i = nodes.length - 1; i >= 0; i--) {
          var nd = nodes[i];
          if (nd && nd.kind === "assistant" && nd.blocks) {
            for (var b = nd.blocks.length - 1; b >= 0; b--) {
              if (nd.blocks[b] && nd.blocks[b].kind === "text" && nd.blocks[b].text) {
                var t = nd.blocks[b].text.replace(/\s+/g, " ").trim();
                if (t) return t.length > 80 ? t.slice(0, 80) + "…" : t;
              }
            }
          }
        }
      } catch (e) {}
      return "";
    }
    // Evaluate one row/face observation. row: {id, running, pending:[{key,kind,payload}], completed, label, face:bool, currentId?}
    function evaluateRow(row) {
      var prev = prevById[row.id];
      var runningNow = !!row.running;
      var pendingNow = row.pending || [];
      var prevPendingKeys = prev ? prev.pendingKeys : [];
      var wasRunning = prev ? prev.running : false;
      var muted = isSubagentSession(row.id, row.currentId);
      var newKeys = [];
      // A muted row still feeds the baseline below, so lifting the mute
      // (turning the switch off, or opening that subagent session) resumes
      // alerting from the next edge on instead of replaying old ones.
      // Its keys are left out of attentionKeysFired on purpose: a wait that was
      // never announced must stay announceable once the mute is lifted.
      if (!muted) {
        for (var i = 0; i < pendingNow.length; i++) {
          var pk = pendingNow[i].key;
          if (prevPendingKeys.indexOf(pk) === -1 && !attentionKeysFired[pk]) {
            newKeys.push(pendingNow[i]);
            attentionKeysFired[pk] = true;
          }
        }
      }
      var hasPendingNow = pendingNow.length > 0;

      // 1) a pending interaction just appeared -> the agent is waiting on the user.
      //    First evaluation of a session also lands here (prevPendingKeys empty),
      //    so a wait that already existed when the plugin (or page) mounted still
      //    alerts once.
      //    On hosts that expose uiSession this is the fallback path only: the
      //    interaction snapshot there is the authoritative source, and it drives
      //    the title marker itself (see the uiSession watcher below).
      if (!muted && newKeys.length > 0) {
        var it = newKeys[0];
        var quick = quickFor(it.key, it, row.id);
        var copy = fireAttention(it.kind, sessionLabelText(row), textFromPayload(it.payload), !!row.face, row.id, quick);
        if (copy) queueQuieted(it.key, copy);
        lastAttentionAt = Date.now();
        markAttention(it.key);
      }

      // 2) a non-selected session finished while we were away (sidebar "done")
      var notified = false;
      if (!muted && !row.face && row.completed && prev && !prev.completed && prev.seeded) {
        reportDone(sessionLabelText(row), "", row.id);
        notified = true;
      }

      // 3) running true -> false on a session we were watching: a reply finished
      if (!muted && !notified && prev && prev.seeded && wasRunning && !runningNow && !hasPendingNow) {
        // ignore the edge if it happened in the same tick as an attention alert
        if (Date.now() - lastAttentionAt < 300) {
          /* answered by an attention alert above */
        } else {
          reportDone(sessionLabelText(row), row.face ? snippetOfLastAssistant(row.faceSnap) : "", row.id);
        }
      }

      // store the next baseline
      prevById[row.id] = {
        running: runningNow,
        pendingKeys: pendingNow.map(function (p) { return p.key; }),
        completed: !!row.completed,
        seeded: true
      };

      // a wait we alerted about has been resolved -> drop the title marker
      if (!uiPending && prev && prevPendingKeys.length > 0 && pendingNow.length === 0) {
        for (var r = 0; r < prevPendingKeys.length; r++) unmarkAttention(prevPendingKeys[r]);
      }

      // Unread-reply marker on hosts whose reminder bit lives in the list row
      // (`completed`: armed when a non-selected session finishes, cleared on
      // select — the manager's completedNotifications). Hosts exposing
      // sessionStatus get their marker from syncDoneFromStatus instead; the
      // two never share a row, so the mark counter stays balanced.
      if (!statusDoneSource()) {
        if (row.completed && !muted) markDoneUnread(row.id);
        else unmarkDoneUnread(row.id);
      }
    }

    // face -> row adapter (selected session, rich data)
    function evalSessionFace(sessionId, snap) {
      if (sessionId !== currentFaceId) return;
      var pend = (snap.pending || []).map(function (p) {
        return { key: p.key || (p.kind + ":" + sessionId), kind: p.kind, payload: p.payload || null };
      });
      evaluateRow({
        id: sessionId,
        running: !!snap.running,
        pending: pend,
        completed: false,
        face: true,
        faceSnap: snap,
        currentId: sessionId,
        label: "current"
      });
    }
    // list row -> adapter (every other listed session)
    function evalListRow(sid, sum, currentId) {
      evaluateRow({
        id: sid,
        running: !!sum.running,
        pending: sum.pendingInteraction ? [{ key: "list:" + sid + ":" + sum.pendingInteraction, kind: sum.pendingInteraction, payload: null }] : [],
        completed: !!sum.completed,
        face: false,
        currentId: currentId,
        label: sum.displayTitle || sum.title || sid
      });
    }

    // ─────────────────────── subscription wiring ─────────────────────
    function bindCurrentFace() {
      if (!listStore) return;
      try {
        var cur = currentSessionId();
        if (!cur) { detachFace(); return; }
        if (cur === currentFaceId && faceSub) return;
        detachFace();
        currentFaceId = cur;
        var b = rootCtx.sessions.binding(cur);
        if (!b || !b.session || typeof b.session.subscribe !== "function") {
          // binding not minted yet — the retry timer will re-check
          return;
        }
        faceSub = b.session.subscribe(function () {
          try {
            evalSessionFace(cur, b.session.getSnapshot());
          } catch (e) {}
        });
        // First evaluation seeds the baseline (no false completion edges) while
        // still alerting for interactions that were already pending on bind.
        try {
          evalSessionFace(cur, b.session.getSnapshot());
        } catch (e) {}
      } catch (e) {}
    }
    function detachFace() {
      if (faceSub) { try { faceSub(); } catch (e) {} faceSub = null; }
      currentFaceId = null;
    }
    function onListChanged() {
      if (!listStore) return;
      try {
        var st = listStore.getSnapshot();
        var cur = currentSessionId();
        bindCurrentFace();
        bindUiSession();
        // The subagent mute keys on "not the session on screen", and switching
        // sessions only emits on the list store — re-run the status pass so
        // the decision tracks the switch: opening a muted subagent session
        // announces its outstanding wait (under the current-conversation rules),
        // leaving it puts the next edge back in the muted bucket.
        evalUiStatus();
        var byId = (st && st.byId) || {};
        // A vanished row drops its unread-reply mark with it: the host forgets
        // the reminder bit together with the row, and a gone row reports
        // nothing. (Hosts with sessionStatus sweep this in syncDoneFromStatus.)
        if (!statusDoneSource()) {
          for (var mk in doneUnreadMarks) if (!byId[mk]) unmarkDoneUnread(mk);
        }
        for (var sid in byId) {
          if (sid === cur) continue; // current handled by the face watcher
          var sum = byId[sid];
          if (!sum) continue;
          evalListRow(sid, sum, cur);
        }
        // sessions that vanished: keep baseline (they may reappear) - no action.
      } catch (e) {}
    }

    // ─────────────── uiSession pending-interaction watcher ───────────
    // DSH >= 0.1.2-alpha.2 moved pending interactions out of the Controller
    // snapshots into their own uiSession store, and that store changed shape
    // once, so both readings share one adapter:
    //   * 0.1.2-alpha.2 .. 0.1.5-rc.3: `pendingInteractions`, a
    //     Map<sessionId, interaction> whose values carry kind + key + sessionId
    //     and the domain's own detail fields;
    //   * 0.1.6-alpha.2 and later (incl. 0.2.0-rc.2): `sessionStatus`, a
    //     Map<sessionId, {running, pendingInteraction, completionUnread}>; the
    //     old store no longer exists, so reading it is what made this channel
    //     dead on every 0.1.6+/0.2 host.
    // Either store is the only live "the agent is waiting on you" source on its
    // host generation.
    //
    // The service is looked up lazily rather than declared in `inject`:
    // a cordis `inject` entry is a hard gate (the entry never activates while
    // the service is missing, and a never-activated entry makes the whole web
    // boot audit fail), while hosts older than 0.1.2-alpha.2 have no uiSession
    // at all and must keep working through the controller path above.
    //
    // ⚠️ Reading `ctx.uiSession` directly does NOT work here, and failing to
    // notice that is exactly how this watcher stayed dead on every 0.1.2+ host:
    // cordis resolves a service property only for names declared in the plugin's
    // `inject` map and throws `cannot get property "uiSession" without inject`
    // for every other name — sibling loader entries never leak their service
    // into an ancestor store, so the old try/catch around that read silently
    // produced `null` forever. ctx.get() reads the reflector store with no
    // inject requirement, which is the only lazy lookup that actually resolves
    // the service; ctx.reflect.get() and a plain property read stay as
    // fallbacks for contexts that predate that API.
    function lookupService(name) {
      var svc = null;
      try {
        if (rootCtx && typeof rootCtx.get === "function") svc = rootCtx.get(name) || null;
      } catch (e) { svc = null; }
      if (svc) return svc;
      try {
        if (rootCtx && rootCtx.reflect && typeof rootCtx.reflect.get === "function") svc = rootCtx.reflect.get(name) || null;
      } catch (e) { svc = null; }
      if (svc) return svc;
      try { if (rootCtx && name in rootCtx) svc = rootCtx[name] || null; } catch (e) { svc = null; }
      return svc;
    }
    // Is this an observable snapshot store (getSnapshot + subscribe)?
    function isStore(s) {
      return !!s && typeof s.getSnapshot === "function" && typeof s.subscribe === "function";
    }
    // Pick the host's pending-interaction store: sessionStatus wherever it
    // exists (0.1.6+), else the legacy pendingInteractions map (0.1.2-0.1.5).
    function interactionStore(svc) {
      if (svc && isStore(svc.sessionStatus)) return { store: svc.sessionStatus, source: "sessionStatus" };
      if (svc && isStore(svc.pendingInteractions)) return { store: svc.pendingInteractions, source: "pendingInteractions" };
      return null;
    }
    // One pending interaction out of one store value; null when this session
    // currently has none.
    function pendingOf(value, source) {
      if (!value) return null;
      if (source === "sessionStatus") return value.pendingInteraction || null;
      return value;
    }
    // Record the last lookup outcome for debug() and warn once on the only
    // outcome that is a defect rather than a host generation.
    function noteUiBind(note) {
      if (uiBindNote === note) return;
      uiBindNote = note;
      // Two notes are normal and stay silent: "not visible" is either a
      // pre-0.1.2 host or the ordinary boot race (this entry may apply before
      // the uiSession entry activates; the 1.5s retry timer binds it a moment
      // later), and "bound" is success. A service instance we can hold but
      // whose shape we do not recognize is the case worth one warning.
      if (note === "bound" || uiWarned || note === "uiSession not visible") return;
      uiWarned = true;
      try {
        console.warn("[dsh-notify-me] uiSession is reachable but exposes no pending-interaction source (" + note + ") — approval alerts are silent; please report this against DSH with window.__dshNotifyMe.debug()");
      } catch (e) {}
    }
    function bindUiSession() {
      var svc = lookupService("uiSession");
      var found = interactionStore(svc);
      if (!found) {
        noteUiBind(svc ? "uiSession has neither sessionStatus nor pendingInteractions" : "uiSession not visible");
        return;
      }
      var store = found.store;
      if (uiSub && uiStore === store) { noteUiBind("bound"); return; }
      // the service instance (or its store) was swapped (plugin HMR): drop the
      // stale subscription and its marks, then bind the live store
      if (uiSub) detachUiSession();
      uiStore = store;
      uiSource = found.source;
      uiPending = true; // this watcher now owns the title marker
      uiSub = store.subscribe(function () { try { evalUiStatus(); } catch (e) {} });
      noteUiBind("bound");
      evalUiStatus(); // seed: a wait that predates this plugin still alerts once
    }
    // True once the sessionStatus store is the live uiSession source (0.1.6+):
    // its rows then also own the completion-unread level flag and its marker.
    function statusDoneSource() {
      return !!(uiPending && uiSource === "sessionStatus");
    }
    function evalUiStatus() {
      var svc = lookupService("uiSession");
      var found = interactionStore(svc);
      if (!found || typeof found.store.getSnapshot !== "function") return;
      var snap = found.store.getSnapshot(); // Map<sessionId, interaction|status>
      if (!snap || typeof snap.forEach !== "function") return;
      if (found.source === "sessionStatus") syncDoneFromStatus(snap);
      var seen = Object.create(null);
      var cur = currentSessionId();
      snap.forEach(function (value, sid) {
        var it = pendingOf(value, found.source);
        // A session with no pending interaction is not "seen": leaving it out
        // lets the teardown pass below release any mark its answer replaced.
        if (!it) return;
        // A background subagent wait is muted and deliberately leaves no
        // baseline: the row is what isSubagentSession reads, and skipping the
        // record here also lets the teardown pass drop a mark whose wait was
        // announced before the mute was switched on (or before the user
        // switched away from that subagent session). Opening the session later
        // announces the outstanding wait then, like any first sighting.
        if (isSubagentSession(sid, cur)) return;
        seen[sid] = true;
        var key = it.key || (it.kind + ":" + sid);
        var prev = uiBaseline[sid];
        // new interactions alert once; a wait that already existed on bind
        // (no baseline yet for that session) alerts here too.
        if (prev && prev.key === key) return;
        uiBaseline[sid] = { key: key };
        // a wait replaced by a newer one in the same session: the old mark goes
        // with it, otherwise the tab would keep one stale marker per replacement
        if (prev) unmarkAttention(prev.key);
        if (attentionKeysFired[key]) { markAttention(key); return; } // already alerted, still needs its mark
        attentionKeysFired[key] = true;
        var quick = quickFor(key, it, sid);
        var copy = fireAttention(it.kind, labelForSessionId(sid), textFromPayload(it), currentSessionId() === sid, sid, quick);
        if (copy) queueQuieted(key, copy);
        lastAttentionAt = Date.now();
        markAttention(key);
      });
      for (var sid2 in uiBaseline) {
        if (seen[sid2]) continue;
        // interaction answered, cancelled, or its session went away
        unmarkAttention(uiBaseline[sid2].key);
        delete uiBaseline[sid2];
      }
    }
    // The sessionStatus rows also carry the reply-finished channel's level
    // flag (0.1.6-alpha.2+): `completionUnread` lights when a session that is
    // not on screen finishes and clears when the session is opened, starts
    // running again, or disappears. Two jobs live here:
    //   * the "完成未读" title marker, held exactly while a background session
    //     is finished-but-unread — open the session and the tab goes quiet;
    //   * one done alert for completions whose running edge this page never saw
    //     (coalesced list snapshots, a plugin remount mid-turn, a completion
    //     that predates this bind). The latch reports each unread instance once;
    //     reportDone's window collapses the double view when the edge did fire.
    // The edge path stays the reporter for the on-screen session (its snippet
    // comes from the face snapshot) and for hosts without this store.
    var uiDoneBaseline = Object.create(null); // sid -> true once this unread reported
    function syncDoneFromStatus(snap) {
      var want = Object.create(null);
      try {
        var cur = currentSessionId();
        snap.forEach(function (value, sid) {
          if (!value) return;
          // A stop that awaits input (plan-review / question end the turn with
          // a pending interaction) is a wait, not a completion — the same rule
          // as the edge path's !hasPendingNow guard. The on-screen session is
          // never "unread" (the host clears the flag for it; its completion is
          // the face edge's job), and a background subagent step is muted.
          if (!value.completionUnread || value.pendingInteraction || isSubagentSession(sid, cur) || cur === sid) return;
          want[sid] = true;
          markDoneUnread(sid);
          if (uiDoneBaseline[sid]) return; // this unread instance already reported
          uiDoneBaseline[sid] = true;
          if (Date.now() - lastAttentionAt < 300) return; // same-tick attention owns the moment
          reportDone(labelForSessionId(sid), "", sid);
        });
      } catch (e) {}
      // answered / re-run / gone / muted: latch and mark go with the flag
      for (var s in uiDoneBaseline) if (!want[s]) delete uiDoneBaseline[s];
      for (var m in doneUnreadMarks) if (!want[m]) unmarkDoneUnread(m);
    }
    function detachUiSession() {
      if (uiSub) { try { uiSub(); } catch (e) {} uiSub = null; }
      uiStore = null;
      uiSource = null;
      // drop every mark this watcher holds; hosts without the interaction store
      // go back to the controller marker path
      for (var s in uiBaseline) unmarkAttention(uiBaseline[s].key);
      uiBaseline = Object.create(null);
      for (var dm in doneUnreadMarks) unmarkDoneUnread(dm);
      uiDoneBaseline = Object.create(null);
      uiPending = false;
    }

    // ──────────────────────── global control API ─────────────────────
    // Expose the control API. Merge instead of replace: a consumer (or a test
    // harness) may have registered onEvent before the plugin applied, and that
    // hook must survive — binding the interaction store can deliver an alert
    // synchronously, in the middle of apply().
    var api = window.__dshNotifyMe;
    if (!api || typeof api !== "object") api = {};
    try {
      Object.defineProperty(api, "config", {
        get: function () { return readConfig(); },
        configurable: true
      });
    } catch (e) {}
    // keep in sync with package.json "version" on every release
    api.version = "1.8.0";
    api.setConfig = function (patch) { return setConfigLocal(patch); };
    api.resetConfig = function () {
      try {
        localStorage.removeItem(LS_CONFIG);
        // The picked cue files are per-kind keys of their own; dropping the
        // config alone would leave them orphaned, still eating the origin's
        // quota with no UI left to remove them from.
        localStorage.removeItem(LS_SOUND.done);
        localStorage.removeItem(LS_SOUND.attention);
      } catch (e) {}
      config = readConfig();
      return config;
    };
    // manual test; run it after clicking anywhere so permission can be granted.
    // Test alerts fire regardless of the page-open visibility rules.
    api.test = function (kind) {
      kind = (kind === "attention" || kind === "approval") ? kind : "done";
      unlockOnce();
      testAlert(kind);
      return "sent " + kind + " (lang=" + effectiveLang() + ", permission=" + ("Notification" in window ? Notification.permission : "n/a") + ", bridge=" + swState + ")";
    };
    // Programmatic twin of a toast button press: settles the pending approval
    // behind `key` the same way the 同意/拒绝 buttons do.
    api.decide = function (key, outcome) {
      return decidePending(key, outcome === "rejected" ? "rejected" : "allowed-once");
    };
    // Channel test for the external webhooks: posts a synthetic event to every
    // configured target. An explicit console call counts as consent, so it runs
    // regardless of the master / per-kind toggles (those gate real alerts);
    // it still only ever talks to endpoints the user filled in themselves.
    api.testExternal = function () {
      return new Promise(function (resolve) {
        var targets = externalTargets();
        if (!targets.length) { resolve({ sent: 0, unverified: 0, failed: 0, statuses: [] }); return; }
        var d = texts();
        sendExternalToAll("attention", d.testExternalTitle, d.testExternalBody, currentSessionId(), function (statuses) {
          var out = { sent: 0, unverified: 0, failed: 0, statuses: statuses };
          for (var i = 0; i < statuses.length; i++) {
            if (statuses[i] === "sent") out.sent++;
            else if (statuses[i] === "unverified") out.unverified++;
            else out.failed++;
          }
          resolve(out);
        });
      });
    };
    // Live diagnostics for the "why did nothing pop" case. The needs-input
    // channel has three possible owners on current hosts (uiSession.sessionStatus
    // on 0.1.6+, uiSession.pendingInteractions on 0.1.2-0.1.5, the controller
    // snapshots before that) and each one failed silently in turn, so both the
    // binding state and which store answered have to be readable from the page.
    api.debug = function () {
      return {
        version: api.version,
        enabled: config.enabled,
        language: effectiveLang(),
        attentionHiddenOnly: config.attentionHiddenOnly,
        currentHiddenOnly: config.currentHiddenOnly,
        doneHiddenOnly: config.doneHiddenOnly,
        ignoreSubagent: config.ignoreSubagent,
        toast: config.toast,
        sound: config.sound,
        soundDone: soundMode("done"),
        soundAttention: soundMode("attention"),
        customSoundDone: !!readSound("done"),
        customSoundAttention: !!readSound("attention"),
        quickActions: config.quickActions,
        // in-page overlay: the alert channel that follows the DSH window to
        // whatever display it sits on, instead of the OS toast's fixed primary
        // display. cards is the live stack, corner the configured anchor.
        overlay: {
          enabled: !!config.overlay,
          corner: overlayCorner(),
          cards: overlayCount()
        },
        // external webhook forwarding: counts come from externalStat (tallied
        // on every send), targets is the raw vs validated count.
        external: {
          enabled: config.externalEnabled,
          forwardAttention: config.externalAttention,
          forwardDone: config.externalDone,
          targets: Array.isArray(config.externalTargets) ? config.externalTargets.length : 0,
          activeTargets: externalTargets().length,
          sent: externalStat.sent,
          unverified: externalStat.unverified,
          failed: externalStat.failed,
          lastAt: externalStat.lastAt,
          lastStatus: externalStat.lastStatus
        },
        // quick-decision bridge: 'active' is the only state in which approval
        // toasts carry working 同意/拒绝 buttons.
        bridge: swState,
        // how a toast click gets the OS window forward on this host
        hostEnv: config.hostEnv,
        hostEnvDetected: detectedDesktop() ? "desktop" : "web",
        desktop: isDesktopShell(),
        raiseChannel: isDesktopShell() ? "dsh-deeplink" : "window-focus",
        actionKeys: Object.keys(pendingActions),
        permission: ("Notification" in window) ? Notification.permission : "n/a",
        visibility: hidden() ? "hidden" : "visible",
        uiSession: uiPending ? "bound" : "unbound",
        uiSessionNote: uiBindNote,
        uiSessionSource: uiSource,
        currentSession: currentSessionId(),
        sessionBaselines: Object.keys(prevById).length,
        pendingBaselines: Object.keys(uiBaseline).length,
        firedKeys: Object.keys(attentionKeysFired),
        markedKeys: Object.keys(attentionKeysMarked),
        doneUnreadMarked: Object.keys(doneUnreadMarks),
        quietedKeys: Object.keys(quietedAttention),
        lastAttentionAt: lastAttentionAt ? new Date(lastAttentionAt).toISOString() : null
      };
    };
    window.__dshNotifyMe = api;

    // ────────────────── Settings page (react only, optional) ─────────
    // Registered when the web profile provides react + slots + locale; the
    // reminder core above never depends on any of it.
    var NS = "dsh-notify-me";
    var UI_zh = {
      nav: "通知提醒",
      blurb: "当模型停下来需要你操作（审批 / 方案待确认 / 提问），或回复在后台完成时，用系统通知、提示音和标签页标题提醒你。",
      enable: "启用提醒",
      enableHint: "总开关：关闭后不再弹系统通知、不播放提示音，也不再改动标签页标题。",
      hostEnv: "运行环境",
      hostEnvHint: "默认自动识别：页面协议是 dsh-app:// 即桌面端（DSH Desktop），其余为 Web 端。识别不准时手动指定：桌面端点通知借 dsh:// 深链把窗口带到前台、快捷裁决按钮不可用；Web 端走 window.focus() 与 Service Worker 桥。",
      hostEnvAuto: "自动识别（推荐）",
      hostEnvDesktop: "桌面端（DSH Desktop）",
      hostEnvWeb: "Web 端（浏览器）",
      hostEnvMismatch: "（自动识别结果是「",
      hostEnvMismatchTail: "」，手动选择会覆盖它）",
      hostEnvDesktopForcedNote: "（当前页面不是 dsh-app://：点通知会尝试唤起 dsh:// 协议，浏览器可能弹「打开应用」确认框）",
      toast: "系统通知",
      toastHint: "经浏览器弹出系统 Toast（Windows 通知中心）；需要已授予通知权限。",
      sound: "提示音",
      soundHint: "提示音总开关；具体播什么由下面的「音效来源」决定。",
      soundSource: "音效来源",
      soundSourceHint: "两类提醒各自选择声音来源，互不影响。默认是插件自带的内置合成音。",
      soundDoneLabel: "「回复完成」的声音",
      soundAttentionLabel: "「需要你」的声音",
      soundSynth: "内置合成音（默认）",
      soundCustom: "自定义音频文件",
      soundSystem: "系统通知音（系统播放）",
      soundSynthNote: "插件合成音，「需要你」与「回复完成」音型不同。",
      soundSystemNote: "不播插件音效：通知照发，声音交给操作系统——音色跟着系统通知设置走，开关仍听这里的「提示音」。",
      soundNone: "尚未选择文件",
      soundPick: "选择音频文件",
      soundPreview: "试听",
      soundClear: "移除",
      soundTooBig: "文件太大，上限 ",
      soundNotAudio: "这不是浏览器能播放的音频文件。",
      soundSaved: "已保存自定义音效：",
      soundCleared: "已移除自定义音效，该提醒回落到内置合成音。",
      soundReadFail: "读取文件失败。",
      soundQuota: "浏览器存储空间不足，存不下这个文件——先移除另一类提醒的自定义音效，或换一个更小的文件。",
      soundPreviewDone: "试听「回复完成」音效",
      soundPreviewAttention: "试听「需要你」音效",
      soundOffHint: "「提示音」开关是关的：先打开它才能试听（关掉时提醒本身也确实不出声）。",
      soundPreviewSystem: "「系统通知音」是随通知由系统播放的，插件这边没有可播的音；已发一条测试提醒，声音就是它。",
      external: "外部通知",
      externalHint: "把提醒同时推送到 Discord Webhook / Bark / Gotify / 自定义 Webhook，人不在电脑前也能收到「回来一下」。与本地提醒同一套触发规则（上面的可见性开关一并生效）。",
      externalEnable: "转发外部通知",
      externalEnableHint: "总开关：关闭后不向任何外部端点发送。",
      externalAttentionLabel: "转发「需要你」",
      externalAttentionHint: "审批 / 方案待确认 / 提问时一并推送到外部端点。",
      externalDoneLabel: "转发「回复完成」",
      externalDoneHint: "回复跑完时一并推送到外部端点。",
      externalTargetsLabel: "推送目标",
      externalTargetsHint: "可加多个。Discord 填 Webhook URL；Bark 填 https://api.day.app/<设备密钥>（自建填 http://<服务器>/<密钥>）；Gotify 填 https://<服务器>/message?token=<应用令牌>；自定义填任意收 JSON 的地址（POST：source / event / title / body / sessionId / time）。",
      externalPrivacy: "提醒标题与正文（含会话名与摘要）会原样发到你填写的地址——只填你自己信任的端点。",
      externalTypeDiscord: "Discord Webhook",
      externalTypeBark: "Bark",
      externalTypeGotify: "Gotify",
      externalTypeCustom: "自定义 Webhook",
      externalUrlPlaceholder: "https://…",
      externalAdd: "添加目标",
      externalRemove: "删除这个目标",
      externalTypeField: "推送类型",
      externalUrlField: "推送地址",
      externalEmpty: "还没有推送目标，点「添加目标」加一个。",
      externalTestLabel: "测一测外部通知",
      externalTestHint: "向上面所有推送目标各发一条测试消息（不受「转发」分类开关限制）。",
      externalTestBtn: "发送测试通知",
      externalSending: "发送中…",
      externalTestDone: "测试通知：",
      externalCountSent: "成功 ",
      externalCountUnverified: "已送出不可确认 ",
      externalCountFailed: "失败 ",
      externalNoTargets: "先添加至少一个推送目标。",
      externalOffHint: "先打开「转发外部通知」。",
      attentionVisible: "页面打开时也提醒「需要你」",
      attentionVisibleHint: "默认开启：模型在等你审批 / 确认方案 / 回答问题（含提问弹窗）时，即使页面在最前也会提醒。",
      currentQuiet: "当前对话不弹通知",
      currentQuietHint: "默认开启：等待就发生在你正看着的这个对话里时，只留标签页标记，不弹系统通知、不响提示音，免得挡住审批卡片；页面切到后台后照常提醒。",
      doneVisible: "页面打开时也提醒「回复完成」",
      doneVisibleHint: "默认关闭：「完成」只在页面隐藏或切到后台时才提醒，避免打扰。",
      subagentQuiet: "子代理会话不提醒",
      subagentQuietHint: "默认开启：后台子代理（subagent）会话的「需要你」与「回复完成」都不提醒——它们是另一个对话的步骤，完成由所属主对话自己的提醒覆盖；你当前打开的那个子代理会话照常提醒。关掉后恢复逐会话提醒。",
      autoFocus: "点击通知回到对应对话",
      autoFocusHint: "默认开启：点系统通知会把 DSH 带到前台，并直接切到这条提醒所属的对话；关掉后点击通知不做任何事。",
      quickActions: "审批通知上直接裁决",
      quickActionsHint: "默认开启：权限审批的通知上带「同意 / 拒绝」按钮，点一下即按审批卡片的「允许一次 / 拒绝」直接完成裁决，不用切回页面。需要支持 Service Worker 的浏览器（http://127.0.0.1 或 https）；用不了时自动退回普通通知。",
      quickApprovalNote: "「同意」等价于审批卡片上的「允许一次」，只放行这一次。",
      bridgeOff: "快捷裁决按钮暂不可用（",
      bridgeOffTail: "）：审批通知会退回不带按钮的普通样式。",
      bridgeOffDesktop: "桌面端暂不支持快捷裁决按钮：dsh-app:// 页面无法注册 Service Worker，审批通知只能是不带按钮的普通样式，测试按钮同样只发普通通知。这是宿主限制，不是设置坏了。",
      overlay: "页面浮层提醒",
      overlayHint: "在 DSH 页面里直接画一条提醒卡片，出现在窗口所在的那块屏幕上——系统通知只会出现在主屏，主屏不看时用它。浮层不要通知权限，桌面端也能在浮层上直接「同意 / 拒绝」。可与上面的「系统通知」同时开启。",
      overlayCorner: "浮层位置",
      overlayCornerHint: "贴在 DSH 窗口的哪个角；窗口在哪块屏，浮层就出现在哪块屏。",
      overlayPosTR: "右上",
      overlayPosBR: "右下",
      overlayPosTL: "左上",
      overlayPosBL: "左下",
      overlayQuickNote: "浮层上的「同意」同样等价于审批卡片上的「允许一次」，与通知按钮一致。",
      testApprovalNoBridge: "已发普通测试通知（快捷裁决按钮需要 Service Worker，当前环境没有，按钮渲染不了）。",
      testNeedsQuick: "先打开上面的「审批通知上直接裁决」才能测按钮。",
      volume: "音量",
      language: "通知语言",
      langAuto: "跟随界面",
      langZh: "简体中文",
      langEn: "English",
      langAutoNote: "（跟随界面）",
      current: "界面当前语言",
      testTitle: "快速测试",
      testHint: "用当前设置各发一条测试提醒（不受上面「页面打开时也提醒」开关限制）。",
      testAttention: "测试「需要你」",
      testDone: "测试「回复完成」",
      testApprovalBtn: "测试「审批按钮」",
      reset: "恢复默认设置",
      resetDone: "已恢复默认设置。",
      sent: "已发送测试提醒 · 通知语言：",
      permHint: "通知权限尚未授予：先在页面上点击一次并允许通知，系统通知才能弹出（提示音不受影响）。",
      offHint: "已关闭提醒：先打开「启用提醒」再测试。",
      versionLine: "插件版本：dsh-notify-me v"
    };
    var UI_en = {
      nav: "Notify me",
      blurb: "When the agent stops and needs your input (approval / plan review / question) or a reply finishes in the background, get a system notification, a sound, and a tab-title marker.",
      enable: "Enable reminders",
      enableHint: "Master switch: when off, no toasts, no sounds, and the tab title is never modified.",
      hostEnv: "Environment",
      hostEnvHint: "Auto-detect by default: a dsh-app:// page is the Desktop (DSH Desktop) shell, anything else is the Web. Override it if detection comes out wrong: on the Desktop a toast click raises the window through the dsh:// deep link and quick-decision buttons are unavailable; on the Web it is window.focus() plus the Service Worker bridge.",
      hostEnvAuto: "Auto-detect (recommended)",
      hostEnvDesktop: "Desktop (DSH Desktop)",
      hostEnvWeb: "Web (browser)",
      hostEnvMismatch: " (auto-detection sees \"",
      hostEnvMismatchTail: "\"; the manual choice overrides it)",
      hostEnvDesktopForcedNote: " (this page is not dsh-app://: a toast click will try to launch the dsh:// protocol and the browser may show an \"open app?\" prompt)",
      toast: "System notifications",
      toastHint: "Native toasts via the browser (Windows notification center); requires notification permission.",
      sound: "Sound",
      soundHint: "Master cue switch; what it actually plays comes from \"Alert sound\" below.",
      soundSource: "Alert sound",
      soundSourceHint: "Each alert kind picks its own sound source; the two never affect each other. The default is the plugin's built-in cue.",
      soundDoneLabel: "\"Reply finished\" sound",
      soundAttentionLabel: "\"Needs you\" sound",
      soundSynth: "Built-in cue (default)",
      soundCustom: "Custom audio file",
      soundSystem: "System notification sound (OS plays it)",
      soundSynthNote: "The plugin's synthesized cue — \"needs you\" and \"reply finished\" use different patterns.",
      soundSystemNote: "No plugin cue: the toast still appears, but the sound is left to the operating system, so its timbre follows your system notification settings. The Sound switch above still mutes it.",
      soundNone: "No file chosen yet",
      soundPick: "Choose an audio file",
      soundPreview: "Preview",
      soundClear: "Remove",
      soundTooBig: "File is too large; the limit is ",
      soundNotAudio: "That is not an audio file this browser can play.",
      soundSaved: "Custom sound saved: ",
      soundCleared: "Custom sound removed; this alert falls back to the built-in cue.",
      soundReadFail: "Could not read the file.",
      soundQuota: "Not enough browser storage for this file — remove the other kind's custom sound first, or pick a smaller file.",
      soundPreviewDone: "Preview the \"reply finished\" sound",
      soundPreviewAttention: "Preview the \"needs you\" sound",
      soundOffHint: "The Sound switch is off: turn it on to preview (with it off the alerts themselves stay silent too).",
      soundPreviewSystem: "The system sound plays with a toast, not from the plugin — a test alert was sent instead; that sound is it.",
      external: "External notifications",
      externalHint: "Mirror alerts to a Discord webhook / Bark / Gotify / custom webhook so \"come back\" reaches you away from the machine. Same trigger rules as the local alerts (the visibility toggles above apply too).",
      externalEnable: "Forward to external targets",
      externalEnableHint: "Master switch: when off, nothing is sent to any external endpoint.",
      externalAttentionLabel: "Forward \"needs you\"",
      externalAttentionHint: "Push approval / plan review / question alerts to the external endpoints too.",
      externalDoneLabel: "Forward \"reply finished\"",
      externalDoneHint: "Push reply-finished alerts to the external endpoints too.",
      externalTargetsLabel: "Push targets",
      externalTargetsHint: "Add as many as you like. Discord: the webhook URL; Bark: https://api.day.app/<device key> (self-hosted: http://<server>/<key>); Gotify: https://<server>/message?token=<app token>; custom: any endpoint accepting JSON (POST: source / event / title / body / sessionId / time).",
      externalPrivacy: "The alert title and body (including the session name and snippet) are sent as-is to the address you enter — only use endpoints you trust.",
      externalTypeDiscord: "Discord webhook",
      externalTypeBark: "Bark",
      externalTypeGotify: "Gotify",
      externalTypeCustom: "Custom webhook",
      externalUrlPlaceholder: "https://…",
      externalAdd: "Add target",
      externalRemove: "Remove this target",
      externalTypeField: "Target type",
      externalUrlField: "Endpoint URL",
      externalEmpty: "No push targets yet — press \"Add target\" to create one.",
      externalTestLabel: "Test the external channel",
      externalTestHint: "Send one test message to every push target above (the per-kind forward toggles do not apply to this button).",
      externalTestBtn: "Send test notification",
      externalSending: "Sending…",
      externalTestDone: "Test notification: ",
      externalCountSent: "ok ",
      externalCountUnverified: "sent-unverified ",
      externalCountFailed: "failed ",
      externalNoTargets: "Add at least one push target first.",
      externalOffHint: "Turn on \"Forward to external targets\" first.",
      attentionVisible: "Also alert \"needs you\" while the page is open",
      attentionVisibleHint: "On by default: alert even in the foreground when the model waits for approval / plan review / a question.",
      currentQuiet: "Stay quiet for the conversation on screen",
      currentQuietHint: "On by default: a wait inside the conversation you are looking at keeps only the tab marker — no toast or sound landing on the approval card. Backgrounding the page puts the alert back.",
      doneVisible: "Also alert \"reply finished\" while the page is open",
      doneVisibleHint: "Off by default: \"done\" only alerts while the page is hidden or backgrounded, to avoid noise.",
      subagentQuiet: "Ignore subagent sessions",
      subagentQuietHint: "On by default: background sessions spawned by a subagent raise neither \"needs you\" nor \"reply finished\" alerts — they are steps of another conversation, already covered by that conversation's own alert. The subagent session you have open alerts as usual. Turn off to alert for every session.",
      autoFocus: "Click a toast to open that conversation",
      autoFocusHint: "On by default: clicking a toast brings DSH forward and switches to the conversation the alert came from. When off, clicking a toast does nothing.",
      quickActions: "Decide approvals from the toast",
      quickActionsHint: "On by default: approval notifications carry Approve / Reject buttons, and one click settles the request exactly like the Allow once / Reject buttons on the approval card. Needs a Service Worker capable browser (http://127.0.0.1 or https); falls back to plain toasts where unavailable.",
      quickApprovalNote: "\"Approve\" equals \"Allow once\" on the approval card — it allows that one call only.",
      bridgeOff: "Quick-decision buttons are unavailable right now (",
      bridgeOffTail: "); approval toasts fall back to their plain form.",
      bridgeOffDesktop: "Quick-decision buttons are unavailable on Desktop: dsh-app:// pages cannot register a Service Worker, so approval toasts fall back to their plain, button-less form and the test button only sends a plain notification. This is a host limitation, not a broken setting.",
      overlay: "In-page overlay",
      overlayHint: "Draw the alert inside the DSH page instead of an OS toast, so it appears on the screen the window is on. System notifications are always drawn on the primary display, which is the one you may not be watching. The overlay needs no notification permission, and on the Desktop shell its Approve / Reject buttons work too. Can be enabled together with \"System notifications\" above.",
      overlayCorner: "Overlay position",
      overlayCornerHint: "Which corner of the DSH window the cards stack in; they follow the window to whatever display it is on.",
      overlayPosTR: "Top right",
      overlayPosBR: "Bottom right",
      overlayPosTL: "Top left",
      overlayPosBL: "Bottom left",
      overlayQuickNote: "\"Approve\" here equals \"Allow once\" on the approval card — the same decision the toast buttons send.",
      testApprovalNoBridge: "Plain test notification sent (quick-decision buttons need a Service Worker, which this environment lacks, so they cannot render).",
      testNeedsQuick: "Turn on \"Decide approvals from the toast\" above to test the buttons.",
      volume: "Volume",
      language: "Notification language",
      langAuto: "Follow the interface",
      langZh: "简体中文",
      langEn: "English",
      langAutoNote: " (follows the interface)",
      current: "Current interface language",
      testTitle: "Quick test",
      testHint: "Send one test alert with the current settings (not limited by the \"while the page is open\" toggles above).",
      testAttention: "Test \"needs you\"",
      testDone: "Test \"reply finished\"",
      testApprovalBtn: "Test approval buttons",
      reset: "Restore defaults",
      resetDone: "Defaults restored.",
      sent: "Test alert sent · notification language: ",
      permHint: "Notification permission is not granted yet — click once on the page and allow notifications so toasts can appear (sound is unaffected).",
      offHint: "Reminders are off: enable them first, then test.",
      versionLine: "Plugin version: dsh-notify-me v"
    };
    // Small element helper to keep the hand-written page readable.
    function h(tag, props) {
      var args = [tag, props || null];
      for (var i = 2; i < arguments.length; i++) args.push(arguments[i]);
      return React.createElement.apply(React, args);
    }
    // css classes (namespaced to avoid collisions)
    var UI_CSS = "" +
      ".dnm-wrap{width:100%;max-width:720px;display:flex;flex-direction:column;gap:14px;color:var(--dsw-alias-label-primary,rgba(20,20,20,.9))}" +
      ".dnm-blurb{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary,rgba(120,120,120,.9))}" +
      ".dnm-card{border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));background:var(--dsw-alias-bg-layer-3,rgba(128,128,128,.05));border-radius:10px;overflow:hidden}" +
      ".dnm-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 14px;min-height:46px;box-sizing:border-box}" +
      ".dnm-row+.dnm-row{border-top:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35))}" +
      ".dnm-rowText{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}" +
      ".dnm-rowLabel{font-size:13px;font-weight:600;line-height:20px;color:var(--dsw-alias-label-primary,rgba(20,20,20,.9))}" +
      ".dnm-rowHint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,rgba(120,120,120,.9))}" +
      ".dnm-switch{flex:none;position:relative;width:34px;height:20px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.45));background:var(--dsw-alias-bg-layer-1,rgba(128,128,128,.2));cursor:pointer;padding:0;transition:background .15s ease}" +
      ".dnm-switch.on{background:var(--dsw-alias-state-business-primary,#3b82f6);border-color:transparent}" +
      ".dnm-knob{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:left .15s ease}" +
      ".dnm-switch.on .dnm-knob{left:16px}" +
      ".dnm-range{width:150px;accent-color:var(--dsw-alias-state-business-primary,#3b82f6)}" +
      ".dnm-select{border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.4));background:var(--dsw-alias-bg-layer-1,rgba(255,255,255,.03));color:var(--dsw-alias-label-primary,rgba(20,20,20,.9));border-radius:8px;padding:5px 8px;font-size:13px;font-family:inherit}" +
      ".dnm-btn{border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.4));background:transparent;color:var(--dsw-alias-label-primary,rgba(20,20,20,.9));border-radius:8px;padding:5px 12px;font-size:13px;cursor:pointer;font-family:inherit}" +
      ".dnm-btn:hover{background:var(--dsw-alias-bg-layer-1,rgba(128,128,128,.1))}" +
      ".dnm-btn[disabled]{opacity:.45;cursor:default}" +
      ".dnm-btnRow{display:flex;align-items:center;gap:10px;flex-wrap:wrap}" +
      ".dnm-file{font-size:12px;font-family:inherit;color:var(--dsw-alias-label-primary,rgba(20,20,20,.9));max-width:200px}" +
      ".dnm-targetRow{display:flex;align-items:center;gap:8px;padding:10px 14px;min-height:46px;box-sizing:border-box;flex-wrap:wrap}" +
      ".dnm-targetRow+.dnm-targetRow{border-top:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35))}" +
      ".dnm-input{flex:1;min-width:180px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.4));background:var(--dsw-alias-bg-layer-1,rgba(255,255,255,.03));color:var(--dsw-alias-label-primary,rgba(20,20,20,.9));border-radius:8px;padding:5px 8px;font-size:12px;font-family:inherit}" +
      ".dnm-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,rgba(120,120,120,.9))}" +
      ".dnm-feedback{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,rgba(120,120,120,.9));min-height:18px}";
    (function injectStyle() {
      try {
        if (typeof document === "undefined" || typeof document.createElement !== "function") return;
        var tagId = "dsh-notify-me/settings";
        if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]")) return;
        var s = document.createElement("style");
        s.dataset.plugin = "dsh-notify-me";
        s.dataset.pluginCss = tagId;
        s.textContent = UI_CSS;
        (document.head || document.documentElement).appendChild(s);
      } catch (e) {}
    })();

    function rowSwitch(key, labelText, hintText, checked, onChange) {
      return h("div", { className: "dnm-row" }, [
        h("div", { className: "dnm-rowText" }, [
          h("div", { className: "dnm-rowLabel" }, labelText),
          hintText ? h("div", { className: "dnm-rowHint" }, hintText) : null
        ]),
        h("button", {
          type: "button",
          role: "switch",
          "aria-checked": checked ? "true" : "false",
          // the knob span carries no text of its own, so the row label has to
          // name the button (and the test presser can find it)
          "aria-label": labelText,
          className: "dnm-switch" + (checked ? " on" : ""),
          onClick: function () { onChange(!checked); }
        }, h("span", { className: "dnm-knob" }))
      ]);
    }
    function card(children) {
      return h("div", { className: "dnm-card" }, children);
    }

    function NotifySettingsView(props) {
      var ctx = props.ctx;
      var t = props.t;
      // Keep the page copy in sync with the active DSH UI language.
      React.useSyncExternalStore(function (cb) { return ctx.locale.subscribe(cb); }, function () { return ctx.locale.getSnapshot(); });
      var cfgState = React.useState(function () { return readConfig(); });
      var cfg = cfgState[0];
      var setCfg = cfgState[1];
      var feedbackState = React.useState("");
      var feedback = feedbackState[0];
      var setFeedback = feedbackState[1];
      // Picked cue files bypass the config object (own localStorage keys), so
      // the page needs its own nudge to re-read them after a change.
      var soundBumpState = React.useState(0);
      var soundBump = soundBumpState[0];
      var setSoundBump = soundBumpState[1];
      function patch(p) {
        setCfg(setConfigLocal(p));
      }
      function previewSound(kind) {
        // The master switch is authoritative here too, so a preview with sound
        // off has to say why it stayed quiet instead of looking broken.
        if (!config.sound) { setFeedback(t("soundOffHint")); return; }
        // 'system' has no cue to play from here: the sound only exists as part
        // of a toast, which the OS then chimes for. The honest preview is
        // therefore a real test alert — otherwise the button is silent and
        // reads as broken.
        if (soundMode(kind) === "system") {
          unlockOnce();
          testAlert(kind);
          setFeedback(t("soundPreviewSystem"));
          return;
        }
        // Otherwise: the same cue the alert itself will play, volume included.
        unlockOnce();
        if (kind === "attention") playAttentionSound();
        else playDoneSound();
      }
      // One row per alert kind. The source select is always there; the file
      // picker only appears for 'custom', so the page stays short for anyone
      // who never touches it.
      function soundRows(kind, labelText) {
        var modeKey = kind === "attention" ? "soundAttention" : "soundDone";
        var previewLabel = t(kind === "attention" ? "soundPreviewAttention" : "soundPreviewDone");
        var mode = soundMode(kind);
        var rec = readSound(kind);
        // The hint states what will actually be heard, so a stored file is
        // named right where the choice is made.
        var note = mode === "system" ? t("soundSystemNote")
          : mode === "custom" ? (rec ? rec.name : t("soundNone"))
            : t("soundSynthNote");
        var rows = [
          h("div", { className: "dnm-row" }, [
            h("div", { className: "dnm-rowText" }, [
              h("div", { className: "dnm-rowLabel" }, labelText),
              h("div", { className: "dnm-rowHint" }, note)
            ]),
            h("div", { className: "dnm-btnRow" }, [
              h("select", {
                className: "dnm-select",
                value: mode,
                "aria-label": labelText,
                onChange: function (e) {
                  var p = {};
                  p[modeKey] = e.currentTarget.value;
                  patch(p);
                }
              }, [
                h("option", { value: "synth" }, t("soundSynth")),
                h("option", { value: "custom" }, t("soundCustom")),
                h("option", { value: "system" }, t("soundSystem"))
              ]),
              h("button", {
                type: "button",
                className: "dnm-btn",
                disabled: !cfg.enabled,
                "aria-label": previewLabel,
                onClick: function () { previewSound(kind); }
              }, t("soundPreview"))
            ])
          ])
        ];
        if (mode !== "custom") return rows;
        rows.push(h("div", { className: "dnm-row" }, [
          h("div", { className: "dnm-rowText" }, [
            h("div", { className: "dnm-rowLabel" }, t("soundPick")),
            h("div", { className: "dnm-rowHint" }, (rec ? Math.round((rec.size || 0) / 1024) + " KB · " : t("soundNone") + " · ")
              + "≤" + Math.round(SOUND_MAX_BYTES / 1024) + " KB")
          ]),
          h("div", { className: "dnm-btnRow" }, [
            h("input", {
              type: "file",
              accept: "audio/*",
              className: "dnm-file",
              "aria-label": t("soundPick"),
              onChange: function (e) {
                var input = e.currentTarget;
                var f = input.files && input.files[0];
                if (!f) return;
                if (f.size > SOUND_MAX_BYTES) {
                  // Clear on every exit so re-picking the same file still fires.
                  input.value = "";
                  setFeedback(t("soundTooBig") + Math.round(SOUND_MAX_BYTES / 1024) + " KB");
                  return;
                }
                var fr = new FileReader();
                fr.onload = function () {
                  input.value = "";
                  var data = String(fr.result || "");
                  if (data.indexOf("data:audio/") !== 0) { setFeedback(t("soundNotAudio")); return; }
                  if (!writeSound(kind, { name: f.name, size: f.size, data: data })) {
                    setFeedback(t("soundQuota"));
                    return;
                  }
                  setSoundBump(soundBump + 1);
                  setFeedback(t("soundSaved") + f.name);
                };
                fr.onerror = function () { input.value = ""; setFeedback(t("soundReadFail")); };
                fr.readAsDataURL(f);
              }
            }),
            h("button", {
              type: "button",
              className: "dnm-btn",
              disabled: !rec,
              "aria-label": previewLabel,
              onClick: function () { previewSound(kind); }
            }, t("soundPreview")),
            h("button", {
              type: "button",
              className: "dnm-btn",
              disabled: !rec,
              onClick: function () {
                writeSound(kind, null);
                setSoundBump(soundBump + 1);
                setFeedback(t("soundCleared"));
              }
            }, t("soundClear"))
          ])
        ]));
        return rows;
      }
      function runTest(kind) {
        if (!config.enabled) { setFeedback(t("offHint")); return; }
        unlockOnce();
        // Bypasses the visibility rules on purpose: a test must fire while the
        // page is open, otherwise the button proves nothing.
        testAlert(kind);
        var langName = effectiveLang() === "en" ? t("langEn") : t("langZh");
        var msg = t("sent") + langName;
        if (kind === "approval" && !bridgeActive()) {
          msg += " · " + (isDesktopShell() ? t("testApprovalNoBridge") : t("bridgeOff") + swState + t("bridgeOffTail"));
        }
        setFeedback(msg);
      }
      // External forwarding rows. Target edits always patch with a fresh array
      // (readConfig may hand out the DEFAULTS entry itself; in-place mutation
      // would silently corrupt the defaults for the next reset).
      function externalRows() {
        var rows = [];
        var targets = Array.isArray(cfg.externalTargets) ? cfg.externalTargets : [];
        for (var i = 0; i < targets.length; i++) {
          (function (i) {
            var target = targets[i] || {};
            rows.push(h("div", { className: "dnm-targetRow" }, [
              h("select", {
                className: "dnm-select",
                value: target.type || "custom",
                "aria-label": t("externalTypeField"),
                onChange: function (e) { updateTarget(i, { type: e.currentTarget.value }); }
              }, [
                h("option", { value: "discord" }, t("externalTypeDiscord")),
                h("option", { value: "bark" }, t("externalTypeBark")),
                h("option", { value: "gotify" }, t("externalTypeGotify")),
                h("option", { value: "custom" }, t("externalTypeCustom"))
              ]),
              h("input", {
                className: "dnm-input",
                value: target.url || "",
                placeholder: t("externalUrlPlaceholder"),
                "aria-label": t("externalUrlField"),
                onChange: function (e) { updateTarget(i, { url: e.currentTarget.value }); }
              }),
              h("button", {
                type: "button",
                className: "dnm-btn",
                "aria-label": t("externalRemove"),
                onClick: function () { removeTarget(i); }
              }, t("externalRemove"))
            ]));
          })(i);
        }
        return rows;
      }
      function updateTarget(i, patchFields) {
        var list = (Array.isArray(cfg.externalTargets) ? cfg.externalTargets : []).slice();
        var cur = list[i] || {};
        var next = {};
        for (var k in cur) if (Object.prototype.hasOwnProperty.call(cur, k)) next[k] = cur[k];
        for (var p in patchFields) if (Object.prototype.hasOwnProperty.call(patchFields, p)) next[p] = patchFields[p];
        list[i] = next;
        patch({ externalTargets: list });
      }
      function removeTarget(i) {
        var list = (Array.isArray(cfg.externalTargets) ? cfg.externalTargets : []).slice();
        list.splice(i, 1);
        patch({ externalTargets: list });
      }
      function addTarget() {
        var list = (Array.isArray(cfg.externalTargets) ? cfg.externalTargets : []).slice();
        list.push({
          id: "ext" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          type: "discord",
          url: ""
        });
        patch({ externalTargets: list });
      }
      // Explicit channel test: posts a synthetic event to every target even
      // when the per-kind forward toggles are off (they gate real alerts, not
      // this button). The button stays pressable whenever the plugin is on, so
      // the "why did nothing arrive" cases get a hint instead of a dead control.
      function runExternalTest() {
        if (!cfg.enabled) { setFeedback(t("offHint")); return; }
        if (!cfg.externalEnabled) { setFeedback(t("externalOffHint")); return; }
        if (!externalTargets().length) { setFeedback(t("externalNoTargets")); return; }
        setFeedback(t("externalSending"));
        var d = texts();
        sendExternalToAll("attention", d.testExternalTitle, d.testExternalBody, currentSessionId(), function (statuses) {
          var s = 0, u = 0, f = 0;
          for (var i = 0; i < statuses.length; i++) {
            if (statuses[i] === "sent") s++;
            else if (statuses[i] === "unverified") u++;
            else f++;
          }
          setFeedback(t("externalTestDone") + t("externalCountSent") + s + " · " + t("externalCountUnverified") + u + " · " + t("externalCountFailed") + f);
        });
      }
      var permOK = ("Notification" in window) ? Notification.permission === "granted" : false;
      var resolvedLang = effectiveLang();
      var resolvedLangName = resolvedLang === "en" ? t("langEn") : t("langZh");
      // The environment row states what detection saw whenever the manual
      // choice disagrees with it — the override exists for hosts where the
      // protocol read comes out wrong, so the divergence must be visible.
      var envHint = t("hostEnvHint");
      if (cfg.hostEnv === "desktop" && !detectedDesktop()) envHint += t("hostEnvDesktopForcedNote");
      else if (cfg.hostEnv !== "auto" && isDesktopShell() !== detectedDesktop()) {
        envHint += t("hostEnvMismatch") + (detectedDesktop() ? t("hostEnvDesktop") : t("hostEnvWeb")) + t("hostEnvMismatchTail");
      }
      return h("div", { className: "dnm-wrap" }, [
        h("p", { className: "dnm-blurb" }, t("blurb")),
        card([
          rowSwitch("enabled", t("enable"), t("enableHint"), cfg.enabled, function (v) {
            patch({ enabled: v });
            if (!v && attentionActive > 0) { attentionActive = 0; applyTitle(); }
          }),
          h("div", { className: "dnm-row" }, [
            h("div", { className: "dnm-rowText" }, [
              h("div", { className: "dnm-rowLabel" }, t("hostEnv")),
              h("div", { className: "dnm-rowHint" }, envHint)
            ]),
            h("select", {
              className: "dnm-select",
              value: cfg.hostEnv,
              "aria-label": t("hostEnv"),
              onChange: function (e) { patch({ hostEnv: e.currentTarget.value }); }
            }, [
              h("option", { value: "auto" }, t("hostEnvAuto")),
              h("option", { value: "desktop" }, t("hostEnvDesktop")),
              h("option", { value: "web" }, t("hostEnvWeb"))
            ])
          ])
        ]),
        card([
          rowSwitch("toast", t("toast"), t("toastHint"), cfg.toast, function (v) { patch({ toast: v }); }),
          rowSwitch("overlay", t("overlay"), t("overlayHint"), cfg.overlay, function (v) { patch({ overlay: v }); }),
          cfg.overlay ? h("div", { className: "dnm-row" }, [
            h("div", { className: "dnm-rowText" }, [
              h("div", { className: "dnm-rowLabel" }, t("overlayCorner")),
              h("div", { className: "dnm-rowHint" }, t("overlayCornerHint"))
            ]),
            h("select", {
              className: "dnm-select",
              value: overlayCorner(),
              "aria-label": t("overlayCorner"),
              onChange: function (e) { patch({ overlayCorner: e.currentTarget.value }); }
            }, [
              h("option", { value: "top-right" }, t("overlayPosTR")),
              h("option", { value: "bottom-right" }, t("overlayPosBR")),
              h("option", { value: "top-left" }, t("overlayPosTL")),
              h("option", { value: "bottom-left" }, t("overlayPosBL"))
            ])
          ]) : null,
          rowSwitch("sound", t("sound"), t("soundHint"), cfg.sound, function (v) { patch({ sound: v }); }),
          rowSwitch("attentionVisible", t("attentionVisible"), t("attentionVisibleHint"), !cfg.attentionHiddenOnly, function (v) { patch({ attentionHiddenOnly: !v }); }),
          rowSwitch("currentQuiet", t("currentQuiet"), t("currentQuietHint"), cfg.currentHiddenOnly, function (v) { patch({ currentHiddenOnly: v }); }),
          rowSwitch("doneVisible", t("doneVisible"), t("doneVisibleHint"), !cfg.doneHiddenOnly, function (v) { patch({ doneHiddenOnly: !v }); }),
          rowSwitch("subagentQuiet", t("subagentQuiet"), t("subagentQuietHint"), cfg.ignoreSubagent, function (v) { patch({ ignoreSubagent: v }); }),
          rowSwitch("autoFocus", t("autoFocus"), t("autoFocusHint"), cfg.autoFocus, function (v) { patch({ autoFocus: v }); }),
          rowSwitch("quickActions", t("quickActions"), t("quickActionsHint"), cfg.quickActions, function (v) {
            patch({ quickActions: v });
            if (v) ensureActionBridge();
          }),
          h("div", { className: "dnm-row" }, [
            h("div", { className: "dnm-rowText" }, [
              h("div", { className: "dnm-rowLabel" }, t("volume")),
              h("div", { className: "dnm-rowHint" }, String(Math.round(cfg.volume * 100)) + "%")
            ]),
            h("input", {
              type: "range",
              className: "dnm-range",
              min: 0, max: 100, step: 5,
              value: Math.round(cfg.volume * 100),
              "aria-label": t("volume"),
              onChange: function (e) { patch({ volume: Number(e.currentTarget.value) / 100 }); }
            })
          ])
        ]),
        // Alert sound source: the built-in cue, a picked file, or the platform's
        // own notification sound. Kept next to the Sound/volume card so the
        // sound-related knobs read together, and re-read through soundBump
        // because picked files live outside the config object.
        card([].concat(
          [h("div", { className: "dnm-row" }, [
            h("div", { className: "dnm-rowText" }, [
              h("div", { className: "dnm-rowLabel" }, t("soundSource")),
              h("div", { className: "dnm-rowHint" }, t("soundSourceHint"))
            ])
          ])],
          soundRows("done", t("soundDoneLabel")),
          soundRows("attention", t("soundAttentionLabel"))
        )),
        // External forwarding: the same alerts, mirrored to the user's own
        // webhook endpoints so "come back" reaches them away from the machine.
        card([].concat(
          [h("div", { className: "dnm-row" }, [
            h("div", { className: "dnm-rowText" }, [
              h("div", { className: "dnm-rowLabel" }, t("external")),
              h("div", { className: "dnm-rowHint" }, t("externalHint"))
            ])
          ]),
          rowSwitch("externalEnabled", t("externalEnable"), t("externalEnableHint"), cfg.externalEnabled, function (v) { patch({ externalEnabled: v }); }),
          rowSwitch("externalAttention", t("externalAttentionLabel"), t("externalAttentionHint"), cfg.externalAttention, function (v) { patch({ externalAttention: v }); }),
          rowSwitch("externalDone", t("externalDoneLabel"), t("externalDoneHint"), cfg.externalDone, function (v) { patch({ externalDone: v }); }),
          h("div", { className: "dnm-row" }, [
            h("div", { className: "dnm-rowText" }, [
              h("div", { className: "dnm-rowLabel" }, t("externalTargetsLabel")),
              h("div", { className: "dnm-rowHint" }, t("externalTargetsHint"))
            ])
          ])],
          externalRows(),
          [(Array.isArray(cfg.externalTargets) && cfg.externalTargets.length) ? h("div", { className: "dnm-row" }, [
            h("div", { className: "dnm-rowText" }, [h("div", { className: "dnm-hint" }, t("externalPrivacy"))])
          ]) : h("div", { className: "dnm-row" }, [
            h("div", { className: "dnm-rowText" }, [h("div", { className: "dnm-hint" }, t("externalEmpty"))])
          ]),
          h("div", { className: "dnm-row" }, [
            h("div", { className: "dnm-btnRow" }, [
              h("button", {
                type: "button",
                className: "dnm-btn",
                "aria-label": t("externalAdd"),
                onClick: addTarget
              }, t("externalAdd"))
            ])
          ]),
          h("div", { className: "dnm-row" }, [
            h("div", { className: "dnm-rowText" }, [
              h("div", { className: "dnm-rowLabel" }, t("externalTestLabel")),
              h("div", { className: "dnm-rowHint" }, t("externalTestHint"))
            ]),
            h("div", { className: "dnm-btnRow" }, [
              h("button", {
                type: "button",
                className: "dnm-btn",
                "aria-label": t("externalTestLabel"),
                disabled: !cfg.enabled,
                onClick: runExternalTest
              }, t("externalTestBtn"))
            ])
          ])
        ])),
        card([
          h("div", { className: "dnm-row" }, [
            h("div", { className: "dnm-rowText" }, [
              h("div", { className: "dnm-rowLabel" }, t("language")),
              h("div", { className: "dnm-rowHint" }, resolvedLangName + (cfg.language === "auto" ? t("langAutoNote") : ""))
            ]),
            h("select", {
              className: "dnm-select",
              value: cfg.language,
              "aria-label": t("language"),
              onChange: function (e) { patch({ language: e.currentTarget.value }); }
            }, [
              h("option", { value: "auto" }, t("langAuto")),
              h("option", { value: "zh" }, t("langZh")),
              h("option", { value: "en" }, t("langEn"))
            ])
          ]),
          h("div", { className: "dnm-row" }, [
            h("div", { className: "dnm-rowText" }, [
              h("div", { className: "dnm-rowLabel" }, t("testTitle")),
              h("div", { className: "dnm-rowHint" }, t("testHint"))
            ]),
            h("div", { className: "dnm-btnRow" }, [
              h("button", { type: "button", className: "dnm-btn", disabled: !cfg.enabled, onClick: function () { runTest("attention"); } }, t("testAttention")),
              h("button", { type: "button", className: "dnm-btn", disabled: !cfg.enabled, onClick: function () { runTest("done"); } }, t("testDone")),
              h("button", { type: "button", className: "dnm-btn", disabled: !cfg.enabled || !cfg.quickActions, onClick: function () { runTest("approval"); } }, t("testApprovalBtn"))
            ])
          ]),
          cfg.quickActions && cfg.toast && !bridgeActive() && !cfg.overlay ? h("div", { className: "dnm-row" }, [
            h("div", { className: "dnm-rowText" }, [h("div", { className: "dnm-rowHint" }, isDesktopShell() ? t("bridgeOffDesktop") : t("bridgeOff") + swState + t("bridgeOffTail"))])
          ]) : h("div", { className: "dnm-row" }, [
            h("div", { className: "dnm-rowText" }, [h("div", { className: "dnm-rowHint" }, !cfg.quickActions ? t("testNeedsQuick") : (cfg.overlay ? t("overlayQuickNote") : t("quickApprovalNote")))])
          ]),
          h("div", { className: "dnm-row" }, [
            h("div", { className: "dnm-rowText" }, [h("div", { className: "dnm-feedback" }, feedback)])
          ]),
          h("div", { className: "dnm-row" }, [
            h("div", { className: "dnm-rowText" }, [
              h("div", { className: "dnm-rowLabel" }, t("reset")),
              h("div", { className: "dnm-rowHint" }, " ")
            ]),
            h("button", { type: "button", className: "dnm-btn", onClick: function () {
              // api.resetConfig() also drops the picked cue files, which are
              // stored outside the config.
              setCfg(api.resetConfig());
              applyTitle();
              setSoundBump(soundBump + 1);
              setFeedback(t("resetDone"));
            } }, t("reset"))
          ]),
          !permOK ? h("div", { className: "dnm-row" }, [
            h("div", { className: "dnm-rowText" }, [h("div", { className: "dnm-rowHint" }, t("permHint"))])
          ]) : null
        ]),
        // Always-visible version line at the page foot: bug reports need it,
        // and "which build am I on" should not require the console.
        h("p", { className: "dnm-hint" }, t("versionLine") + api.version)
      ]);
    }

    // ────────────────────────── plugin body ──────────────────────────
    // Hard service requirements only. `uiSession` is deliberately NOT listed:
    // a cordis inject entry is a hard gate (the entry stays pending while the
    // service is missing, and the web boot audit fails on entries that never
    // activate), while hosts older than 0.1.2-alpha.2 have no uiSession at all.
    // It is therefore looked up lazily in bindUiSession() — as are `uiWorkspace`
    // (toast-click navigation on 0.1.6+) and `sessions.open` (its pre-0.1.6
    // predecessor) — with the controller path above as the fallback. The bundle
    // entry "@deepseek-ai/dsh-client-ui-session" stays in package.json's
    // dsh.client.inject so the load order keeps the bundle in the graph.
    var inject = ["sessions", "locale", "slots"];

    /**
     * Client plugin body: watch the sessions service and raise desktop
     * notifications + sounds when the agent needs input or a reply finishes;
     * also contributes a Settings page (settings.section slot).
     * @param ctx - client root context.
     */
    function apply(ctx) {
      rootCtx = ctx;
      try {
        if (ctx.locale && typeof ctx.locale.getLocale === "function") localeSvc = ctx.locale;
      } catch (e) {}
      // Settings UI — only when the full web profile (react + slots + locale)
      // is present. The reminder core above never depends on this.
      try {
        if (React && React.createElement && ctx.slots && ctx.locale && typeof ctx.locale.register === "function" && typeof ctx.slots.inject === "function") {
          // The effect returns register()'s own disposer, so a client-plugin
          // reload (HMR) unregisters the dictionaries before re-registering
          // them; locale.register throws when a namespace already has a locale.
          ctx.effect(function () {
            return ctx.locale.register(NS, { zh: UI_zh, en: UI_en });
          }, "dsh-notify-me: settings dictionaries");
          var t = ctx.locale.bind(NS);
          ctx.slots.inject("settings.section", function () {
            return ctx.slots.register({
              name: "settings.section",
              id: "dsh-notify-me",
              order: 45,
              label: function () { return t("nav"); },
              locale: NS,
              inject: function () { return { t: t }; }
            }, function (ownerProps) {
              return React.createElement(NotifySettingsView, { ctx: ctx, t: t });
            });
          });
        }
      } catch (e) {
        try { console.error("[dsh-notify-me] settings page unavailable", e); } catch (e2) {}
      }
      ctx.effect(function () {
        var disposed = false;
        var unsubs = [];
        var retryTimer = null;
        try {
          var sessionsSvc = ctx.sessions;
          if (!sessionsSvc || !sessionsSvc.list || typeof sessionsSvc.list.subscribe !== "function") {
            try { console.log("[dsh-notify-me] sessions service unavailable — watchers idle"); } catch (e) {}
            return;
          }
          listStore = sessionsSvc.list;
          unsubs.push(sessionsSvc.list.subscribe(onListChanged));
          // A wait kept quiet because it was already on screen still has to
          // reach the user the moment they leave the page.
          var onVisibility = function () { try { flushQuieted(); } catch (e) {} };
          try { document.addEventListener("visibilitychange", onVisibility); } catch (e) {}
          unsubs.push(function () { try { document.removeEventListener("visibilitychange", onVisibility); } catch (e) {} });
          // Quick-decision bridge: register the worker half of this bundle (a
          // no-op where quickActions is off or a worker cannot run) and start
          // listening for toast-button relays.
          try { ensureActionBridge(); } catch (e) {}
          // Interaction source first: it owns the title marker once present, so
          // binding it before the controller scan keeps a single mark per wait.
          bindUiSession();
          // initial scan (baseline only; no alerts for pre-existing sessions)
          onListChanged();
          // binding may resolve a tick later; re-check periodically while idle
          retryTimer = setInterval(function () {
            if (disposed) return;
            try { bindCurrentFace(); } catch (e) {}
            try { bindUiSession(); } catch (e) {}
          }, 1500);
          try { console.log("[dsh-notify-me] active — window.__dshNotifyMe 可配置提醒 (enabled=" + config.enabled + ", lang=" + effectiveLang() + ", toast=" + config.toast + ", sound=" + config.sound + ")"); } catch (e) {}
        } catch (e) {
          try { console.error("[dsh-notify-me] init failed", e); } catch (e2) {}
        }
        return function () {
          disposed = true;
          if (retryTimer) clearInterval(retryTimer);
          for (var i = 0; i < unsubs.length; i++) { try { unsubs[i](); } catch (e) {} }
          detachFace();
          detachUiSession();
          clearOverlays();
        };
      }, "dsh-notify-me: watchers");
    }

    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
      }
    });
})(typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : null);
