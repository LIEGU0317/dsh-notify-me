<div align="center">

<img src="https://raw.githubusercontent.com/chromoany/dsh-notify-me/main/docs/brand/icon-app-128.png" width="76" height="76" alt="dsh-notify-me">

# dsh-notify-me

**Step away from DSH and know when to come back.**

[简体中文](README.md) | English

[![npm version](https://img.shields.io/npm/v/dsh-notify-me?style=flat-square&label=npm&color=cb3837)](https://www.npmjs.com/package/dsh-notify-me)
[![npm downloads](https://img.shields.io/npm/dm/dsh-notify-me?style=flat-square&label=downloads%2Fmonth&color=1F883D)](https://www.npmjs.com/package/dsh-notify-me)
[![npm total downloads](https://img.shields.io/npm/dt/dsh-notify-me?style=flat-square&label=total%20downloads&color=1F883D)](https://www.npmjs.com/package/dsh-notify-me)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![DSH Web and Desktop](https://img.shields.io/badge/DSH-Web%20%7C%20Desktop-blue?style=flat-square)](#installation)
[![Client bundle size](https://img.shields.io/badge/client-%7E161%20KiB-green?style=flat-square)](lib/client.js)
[![DSH Compatibility](https://img.shields.io/badge/DSH-tested%200.2.1--rc.2-6366f1.svg?style=flat-square)](#compatibility)
[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)

</div>

[Install](#installation) · [Preview](#ui-preview) · [Settings](#configure-it-from-dsh-settings) · [Compatibility](#compatibility) · [Changelog](CHANGELOG.md)

A notification plugin for DSH Web / Desktop, so you can keep full access off without watching the page all day.

- **When input is needed:** approval, plan review, and questions trigger notifications, sound, and a title marker.
- **When a background reply finishes:** return to the result; click the notification to open its conversation.
- **When you leave your computer:** optionally forward alerts to Discord, Bark, Gotify, or your own webhook.
- **When you do not watch the primary display:** an optional in-page overlay follows the DSH window onto whichever screen you are looking at (system notifications only ever appear on the primary display).

> Keep the page or desktop app running; backgrounding / minimizing is fine. System notifications require permission. Approval buttons need a Service Worker capable Web environment (such as `http://127.0.0.1` or `https`); Desktop notifications have no buttons — turn on the in-page overlay to decide from there instead (see [Secondary displays and the overlay](#secondary-displays-and-the-overlay)).

> 🔎 Looking for it? Search `dsh-notify-me`, **message alerts**, **notification**, **desktop notification**, **reminder**, **approval alert**, **external notifications**, **Discord / Bark / Gotify push** or **可操作提醒 / 消息提醒 / 桌面通知 / 需要你操作** (npm keywords include both English and Chinese terms).

## UI Preview

![Plain DSH notification shown through Edge on Windows, without approval buttons](https://raw.githubusercontent.com/chromoany/dsh-notify-me/main/docs/screenshots/notify-toast.png)

*Plain notification example · Windows / Edge · no approval buttons.* [View full size](https://raw.githubusercontent.com/chromoany/dsh-notify-me/main/docs/screenshots/notify-toast.png)

![Three overlay cards in the bottom-right corner of the DSH page: question, approval request with Approve / Reject, and reply finished](https://raw.githubusercontent.com/chromoany/dsh-notify-me/main/docs/screenshots/overlay-en.png)

*In-page overlay (1.8.0) · the real plugin rendered on a demo page · for when system notifications cannot reach the secondary display; cards appear on whichever display the DSH window is on.* [View full size](https://raw.githubusercontent.com/chromoany/dsh-notify-me/main/docs/screenshots/overlay-en.png)

<details>
<summary>See the settings interface</summary>

![The Notify me settings page: header, how you get told, when to alert, try it, and the collapsed Advanced block](https://raw.githubusercontent.com/chromoany/dsh-notify-me/main/docs/screenshots/settings-en.png)

The real settings component (v1.9.0 defaults) rendered full-page in a standalone demo shell; the sidebar is kept for context, it is not the DSH shell.
</details>

## Installation

### DSH Web

With the DSH CLI already installed, run in a terminal:

```powershell
# Install and auto-mount into the web profile
dsh plugin --profile web add dsh-notify-me
```

Restart `dsh web`, then hard-refresh the page (Ctrl+Shift+R). If you use another Web profile, replace `web` with its actual name.

### DSH Desktop

1. Open **Plugins → Add plugin** in the desktop application.
2. Enter the npm package name `dsh-notify-me`, follow the installation prompts, and confirm that the plugin is enabled.
3. Quit DSH Desktop completely and relaunch it so the plugin loads.

The Electron application manages the `desktop` profile. Do not change the Web command above to `--profile desktop`: the CLI rejects that operation. Installing into the Web profile does not automatically install the plugin into Desktop.

## First-use check

1. Click once in the DSH page and allow notifications when prompted. If you previously declined, allow them in the browser's site settings. The operating system must also allow notifications from the browser / DSH Desktop.
2. Open **Settings → Notify me**. Confirm that the section and plugin version at its foot appear, and leave the master switch, system notifications, and sound enabled.
3. Click **Test "reply finished"** on the settings page. A test notification should appear and sound according to your cue settings. This local test does not forward to external endpoints and ignores the "while the page is open" toggle.

Web users can also test approval buttons. On Desktop that test sends a plain notification: **no Approve / Reject buttons is the expected result**.

**Optional console check** — in environments with DevTools, you can also run:

```js
window.__dshNotifyMe.test("done")        // "reply finished" sample
window.__dshNotifyMe.test("attention")   // "needs your input" sample
window.__dshNotifyMe.test("approval")    // Approve / Reject with an active Web bridge; buttonless on Desktop
window.__dshNotifyMe.debug()             // the bridge field reports the button channel: "active" = buttons work
```

If no test notification appears, first check:

- the notification permission was declined — click anywhere on the page and choose **Allow** (address-bar lock → Site settings → Notifications → Allow → reload);
- the DSH process wasn't restarted after install;
- your OS/browser notification settings block the browser's toasts.

## Why you need it

- **Without full access (`workspace-write` + ask):** keep approval before actions, but a missed request leaves the agent waiting.
- **With full access:** fewer approval interruptions, at the cost of interception before actions.

dsh-notify-me decouples **supervision** from **sitting in front of the screen**: it pulls you back with a system notification only when a decision is genuinely needed (approval / plan review / question) or a reply finishes — **so you can afford to keep full access off** instead of trading away interception for speed. It does not lower the risk of full access itself (it is not a sandbox); it reduces the time spent waiting on missed approvals in ask-mode.

## What it alerts about

| Event | Default behavior |
| --- | --- |
| 🔔 Input needed | Alerts even in the foreground; the conversation on screen keeps only a title marker |
| ✅ Reply finished | Alerts while the page is hidden / backgrounded |

**Input needed** covers approval requests, plan review, and questions (`ask_user_question`). Supported Web environments show Approve / Reject buttons; Desktop does not.

**Reply finished** also covers background sessions. A finished but unread session keeps the `✅ Reply finished ·` title marker until opened. Title markers are independent of the "while the page is open" toggles.

> **Background** subagent child sessions are **not** alerted about by default: DSH lists each of them as its own session, but they are steps inside the parent conversation's turn, so an alert for them is only noise. The subagent session you have open is not part of this and alerts as usual. Settings → "Ignore subagent sessions" turns the mute off.

## Configure it from DSH Settings

Open **Settings → Notify me**. The page runs as how you get told, when to alert, and a try-it block; the knobs you rarely touch fold into **Advanced** at the bottom.

### How you get told

- **Enable reminders**: master switch — off means no toasts, no sounds, and the tab title is left alone;
- **System notifications** (on by default): native toasts through the browser, landing in the Windows / macOS notification center;
- **In-page overlay** (off by default): cards drawn in the page corner, on whichever display the window sits on — system notifications only land on the primary display. No permission needed, and the Desktop shell can Approve / Reject right on the card. Runs alongside toasts; pick one of four corners when expanded. See [Secondary displays and the overlay](#secondary-displays-and-the-overlay);
- **Sound / Volume**: master cue switch and a volume slider; what it plays comes from Advanced → Alert sound;
- **Decide approvals from the toast** (on by default): approval toasts carry Approve / Reject that settle the request in place. **Desktop notifications have no buttons** (`dsh-app://` cannot register a Service Worker) — leave the overlay on instead; the page states plainly which channel can carry buttons right now.

### Secondary displays and the overlay

Windows draws system notification banners on the primary display only. There is no setting in Windows and no API in the browser to aim one at another monitor, so with DSH parked on a second screen and the primary display unwatched, a toast is as good as not sent.

The **in-page overlay** skips the notification center and draws the card inside the DSH page instead: wherever the window is, the card is there too.

- **Position** — top right / bottom right / top left / bottom left, default bottom right; changes apply immediately;
- **No notification permission needed** — it works when permission was never granted, and on the Desktop shell where buttonless toasts are all the OS channel can do;
- **Approval cards carry Approve / Reject** — the same decision as Allow once / Reject on the approval card, and they work on the Desktop too (no Service Worker involved). Clicking the card body opens its conversation;
- **Lifetime** — "needs you" cards retire after 20s, "reply finished" after 8s; an approval card with buttons stays until it is decided or closed. At most 4 cards stack at once;
- **Relation to system notifications** — the two switches are independent. With both on, the primary display gets toasts and the second screen gets the overlay; the overlay alone is also a valid setup.

The overlay only knows which screen the window is on, not which screen you are looking at. If the window stays on the primary display while you watch another one, it stays invisible — same as a toast.

### When to alert

- **Also alert "needs you" while the page is open** (on): turn it off to hear only from the background;
- **Stay quiet for the conversation on screen** (on): a wait belonging to the conversation you are looking at keeps only the tab marker so the approval card stays readable; backgrounding restores alerts;
- **Also alert "reply finished" while the page is open** (off): by default only background finishes alert;
- **Ignore subagent sessions** (on): skip background sessions spawned by a subagent — the parent conversation covers them; the one you have open still alerts;
- **Click a toast to open that conversation** (on): the click brings DSH forward and switches conversation; with several tabs open only one is raised, and off means a click does nothing. Desktop window-raising details live in [Runtime & diagnostics](#runtime--diagnostics).

### Try it

Three buttons send one "needs you", one "reply finished" and one "approval buttons" test alert with the current settings — deliberately not limited by the switches above. A line underneath states which channel can carry approval buttons right now.

The plugin version sits at the bottom of the page (`dsh-notify-me v…`) — copy that line when reporting a bug or checking whether an update landed.

### Advanced

Collapsed by default. It holds the three things you rarely touch: alert sounds, external forwarding, and runtime & diagnostics — each documented below.

### Sound

Choose a built-in cue, custom audio file, or system notification sound independently for each alert kind.

<details>
<summary>Custom audio, previews, and fallback behavior</summary>

- **Alert sound** (picked separately for "needs you" and "reply finished") — built-in cue (default) / custom audio file / system notification sound. "Custom audio file" takes one local audio file in the settings page (1 MiB limit, stored in the browser, with preview and remove); "system notification sound" plays no plugin cue at all — the toast still appears and the operating system supplies the sound, so its timbre follows your system notification settings; in that mode "Preview" sends a test alert instead, because the sound only exists as part of a toast and that is the sound you hear. Any source that has no file, cannot be read, or does not fit falls back to the built-in cue, so an alert never goes silent;

</details>

### External push

Off by default. Supports Discord Webhook / Bark / Gotify / custom webhooks. Alert text is sent to the addresses you enter; use trusted endpoints.

<details>
<summary>Target URLs, forwarding switches, and test messages</summary>

- **External notifications** (default off) — forward each alert to your own push endpoints as well, so it reaches you away from the machine: **Discord Webhook** / **Bark** / **Gotify** / **custom webhook**, any number of targets, each with a type and URL (Discord takes the webhook URL; Bark `https://api.day.app/<device key>`; Gotify `https://<server>/message?token=<app token>`; a custom endpoint receives one POST of JSON: `{source, event, title, body, sessionId, time}`). "Forward 'needs you'" and "Forward 'reply finished'" switch independently; **Send test notification** sends one test message to every target (not limited by those two switches, and never pretending to be a real alert). Forwarding follows exactly the same trigger rules as local alerts ("stay quiet for the conversation on screen" and friends apply to it too); the alert text is sent as-is to the addresses you fill in, so **only use endpoints you trust**;

</details>

### Runtime & diagnostics

The last block inside Advanced. The page protocol is detected automatically to tell Web from Desktop (`dsh-app://`); override it by hand if detection is wrong — Desktop clicks raise the window through the `dsh://` deep link and carry no quick-decision buttons, while Web uses `window.focus()` plus the Service Worker bridge. When the override disagrees with detection the page says so.

<details>
<summary>Alert language, Desktop window raising, reset</summary>

- **Alert language**: follow the UI / Simplified Chinese / English — governs alert copy and the `🔔 …` title marker;
- **How the Desktop window is raised**: `window.focus()` cannot lift a native Electron window, so since 1.5.2 the page drives the app's own `dsh://open` deep link — it works even when the window is parked in the tray;
- **Reset settings**: restores every switch and cue setting to the factory defaults (webhook targets and chosen audio files are kept).

</details>

> The settings sidebar icon is rendered by the DSH settings shell: it hard-codes icons per section id (account / models / agent-presets / plugins / archived-sessions) and `settings.section` has no icon field. The plugin therefore patches that row after the panel renders: it finds its own entry by the localised label text, swaps the host `<svg>` for the brand bell (keeping the host icon class), and follows re-renders with a MutationObserver; if the host changes its markup the patch quietly gives up and the default gear stays.

> Notification permission is required: click once on the page → **Allow** (or address-bar lock → Site settings → Notifications → Allow → reload). On macOS, also allow the browser under System Settings → Notifications.

## How it alerts

- **System notification** — a toast through the browser into the Windows action center / macOS Notification Center (clicking it opens the conversation it came from; supported Web environments offer approval buttons, Desktop does not)
- **In-page overlay** (optional, default off) — an alert card drawn in the corner of the DSH page, on whatever display the window is on, optionally with Approve / Reject buttons; see [Secondary displays and the overlay](#secondary-displays-and-the-overlay)
- **Sound** — WebAudio beeps by default (distinct patterns for "needs you" vs "done"); each kind can instead play a picked audio file, or hand the sound over to the operating system's own notification sound
- **Tab title marker** — while something is waiting on you, the tab title is prefixed with `🔔 Action needed · …` / `🔔 需要你 · …`; while a background session is **finished but unread**, with `✅ Reply finished · …` / `✅ 回复完成 · …`, gone once you open that session (or it starts running again). Both kinds can be up together, "needs you" first; a host title change is rebased under the markers
- **External notifications** (optional, default off) — the same alert is also forwarded to the push targets you configure: Discord Webhook / Bark / Gotify / custom webhook — so the push channel on your phone picks it up while you step away from the machine

This is a **browser-layer** plugin: the DSH page must stay open (minimized or backgrounded is fine — that's exactly the "away" state it watches for).

## Compatibility

Per-release adaptation records live in [package.json](package.json), under `dsh.compatibility.dshReleases`. The current host (`0.2.1-rc.2`) no longer reads that field — installation gates only on `peerDependencies` and `engines` — so it is a human-readable record, not a gate.

Verified to actually activate on `0.1.2-rc.1`, `0.1.5-rc.1`, `0.1.5-rc.2` and `0.2.0-rc.2` (each booted in its own profile: the plugin entry lands in the boot page's `__DSH_BOOT__` with its inject dependencies resolved, `/plugins/??dsh-notify-me/client.js&rev=…` serves a build containing the new code, and the Settings → Notifications section registers, i.e. the plugin's `apply` really runs), and previously on `0.1.1-rc.2`.

`0.2.1-rc.2` (current latest) got its own isolated run: an isolated `DSH_HOME` booting `dsh web` (70 boot entries) placed the plugin entry 59th, in the `application` batch, with all three inject targets present and ordered before it; `/plugins/??dsh-notify-me/client.js&rev=…` served the 1.7.0 source build (140,153 B); loaded in a headless Chromium page, `apply` ran — `window.__dshNotifyMe.debug()` reported `uiSession: bound`, `uiSessionSource: sessionStatus`, `bridge: active`. Host-side shapes match `0.2.0-rc.2`; no plugin code change was needed.

<details>
<summary>Host generations and adaptation diagnostics</summary>

The plugin picks its interaction source per host generation; the table below marks where each shape appeared — it is not a gate (the current host does not read `dshReleases`):

| Host generation | "Needs you" interaction source | Current session | Toast-click navigation |
| --- | --- | --- | --- |
| `<= 0.1.2-alpha.1` | controller snapshot `pending[]` | snapshot `current` | `sessions.open()` |
| `0.1.2-alpha.2 .. 0.1.6-alpha.1` | `uiSession.pendingInteractions` | snapshot `current` | `sessions.open()` |
| `>= 0.1.6-alpha.2` (incl. `0.2.0-rc.2`, `0.2.1-rc.2`) | `uiSession.sessionStatus` | `retainedBy.mainView` | `uiWorkspace.openSession()` |

The ranges are illustrative: the plugin picks its source by store shape (whenever `sessionStatus` exists it takes the new path); the version numbers only mark where each shape appeared. The `peerDependencies` range in `package.json` shapes npm's peer warning — `0.2.1-rc.2` already falls inside `>=0.2.0-rc.1 <0.3.0-0`, so no exemption is needed; `dshReleases` is just an archive, real compatibility is per-release testing, and untested new versions fall back to shape-driven behaviour.

Two traps are worth remembering: a package listed in `dsh.client.inject` that a newer runtime no longer ships parks the client entry at `pending (waiting for services: …)` forever — which is what broke 1.1.3 on `0.1.2-rc.1` and later; and when the host renames a store or a field nothing throws, alerts just go **silent** — `0.2.0-rc.2` moved `pendingInteractions`→`sessionStatus`, `list.current`→`retainedBy.mainView` and `sessions.open()`→`uiWorkspace.openSession()`. So every adaptation must confirm `window.__dshNotifyMe.debug()` reports `bound` and which source answered. `0.2.1-rc.2` changed neither: `sessionStatus` is still a Map of `{running, pendingInteraction, completionUnread}`, `uiWorkspace.openSession(id)` is unchanged, and the session list still has no `current`.

</details>

`1.9.0` neither widens nor narrows that range: the settings page is plain React rendering over the existing CSS variables (every colour carries a fallback) and adds no host API. The overlay, title markers and window raising still go through the 1.7 / 1.8 paths, so **plugin entries stay compatible from 0.1.1-rc.2 through 0.2.1-rc.2**, and stepping back to an older host needs no config change. The only new surface is visual: the bell in the page header is the plugin's own SVG (`docs/brand/`).

## Advanced: console configuration

The Settings page is the primary entry; preferences live in `localStorage` (key `dshNotifyMe.config`) and can be scripted from the console:

<details>
<summary>Console API and storage reference</summary>

```js
window.__dshNotifyMe.config                       // view current config
window.__dshNotifyMe.setConfig({
  enabled: true,           // false = disable all reminders (master switch)
  language: "auto",        // 'auto' follow the UI | 'zh' | 'en'
  attentionHiddenOnly: false, // true = don't alert "needs you" while the page is visible
  currentHiddenOnly: true,    // true = waits in the conversation on screen keep only the tab marker (replayed once backgrounded)
  doneHiddenOnly: true,       // false = also alert "reply finished" while visible
  ignoreSubagent: true,       // true = never alert for background subagent sessions (the open one is exempt)
  toast: true,                // system-notification toggle
  sound: true,                // cue toggle (also governs the "system notification sound" mode)
  soundDone: "synth",         // "reply finished" cue source: 'synth' built-in | 'custom' picked file | 'system' OS sound
  soundAttention: "synth",    // "needs you" cue source, same values
  volume: 0.5,                // 0..1
  autoFocus: true,            // clicking a toast opens the conversation it came from
  quickActions: true,         // Approve / Reject buttons on approval toasts
  overlay: false,             // in-page overlay alert (follows the DSH window to its display; no notification permission needed)
  overlayCorner: "bottom-right", // overlay anchor: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left'
  externalEnabled: false,     // external-notification forwarding master switch (default off: no endpoint, nothing is sent)
  externalAttention: true,    // forward "needs you" (exactly the same trigger rules as local alerts)
  externalDone: true,         // forward "reply finished"
  externalTargets: []         // push targets: [{id, type:'discord'|'bark'|'gotify'|'custom', url}]
})
window.__dshNotifyMe.resetConfig()                // restore defaults (also drops any picked audio files)
window.__dshNotifyMe.decide("approval:3", "allowed-once")  // programmatic decision: "allowed-once" | "rejected"
window.__dshNotifyMe.testExternal()               // explicit outbound test to valid targets; resolves {sent, unverified, failed, statuses}
```

> **External-test switch behavior:** the settings page's "Send test notification" button requires both the plugin and external-forwarding master switches to be on, but ignores the two per-kind forwarding switches. The console `testExternal()` call is an explicit test: with valid configured targets, it sends to them even when those master switches are off; with no valid targets it sends nothing. Ordinary `test("done")` / `test("attention")` / `test("approval")` calls only test local alerts and never forward externally.

> Picked audio files do not live in `dshNotifyMe.config`: each kind gets its own key (`dshNotifyMe.sound.done` / `dshNotifyMe.sound.attention`, holding `{name, size, data}` with a data URL), because a file inflates by ~1.37x once base64-encoded and would slow down every config read. `resetConfig()` clears both keys along with the config.
>
> To see which source is live, check `soundDone` / `soundAttention` and `customSoundDone` / `customSoundAttention` in `window.__dshNotifyMe.debug()`.

</details>

## How it works

The reminder core watches session state and pending interactions. The page handles approval decisions; Desktop window activation uses the app deep link.

<details>
<summary>Event sources, approval bridge, and Desktop window activation</summary>

The reminder core picks its interaction source per host generation (see the table above); the current session always comes from the client `sessions` service:

- the **selected session's** `SessionSnapshot`: a `running: true → false` edge means a reply finished;
- **pending interactions**: a new key in `uiSession.sessionStatus` (`>= 0.1.6`, per-session `pendingInteraction`) or in `pendingInteractions` (`0.1.2 .. 0.1.5`) means the agent is waiting on you — approval requests carry the tool name and reason, questions their text; older hosts fall back to the controller snapshot's `pending[]`;
- **every other listed session's** summary: a `running: true → false` edge (or the legacy `completed` flag) alerts you about background work. The host's completion-unread level flag backs that edge up and owns the title marker: `sessionStatus` rows' `completionUnread` on `>= 0.1.6` (lit when a background session finishes, cleared when it is opened / re-runs / disappears), the list row's `completed` reminder bit on older hosts (cleared on select). It re-reports a completion whose edge this page never saw (a plugin remount mid-turn, coalesced snapshots) exactly once, and when both views of one completion arrive together a short window collapses them into a single alert.
- **subagent sessions**: **background** rows carrying `origin: 'subagent'` (and a `parentId`) stay muted by default. The subagent session you have open is exempt — its alerts follow the normal current-conversation rules (tab marker only while the page is visible, delivered on background), its outstanding waits are picked up when you switch into it, and switching away mutes them again. A fork has a `parentId` but no `origin`, is your own conversation, and keeps alerting throughout.

The reminder core stays dependency-free and self-contained: notification copy resolves at alert time from the chosen language (follow-interface / Simplified Chinese / English). The Settings page is an **optional** React surface — it only registers into Settings when the web profile provides the `slots` / `locale` services and `react`; without them the plugin degrades gracefully to alerts-only (no Settings page).

### Quick decisions, and how they reach the agent

Action buttons (`actions`) belong to persistent notifications shown through `ServiceWorkerRegistration.showNotification()`; passing `actions` to the `new Notification()` constructor throws a `TypeError`. That is a browser rule no plugin can route around, so the bundle holds two jobs in the same bytes: the page half registers the reminder factory as it always did, and the very same file is registered as a Service Worker whose only task is relaying which button was clicked back to the page. The decision itself happens in the page, through the same `PendingApproval.answer('allowed-once' | 'rejected')` the approval card uses — which is why "Approve" is exactly "Allow once" and nothing broader. The "raise a window and switch its conversation" part of a body click is scheduled on the worker half too: `client.focus()` raises exactly one window (a visible one first) and routes the conversation switch to that window alone, so several open DSH tabs never fight over focus or all switch at once.

Every button toast is booked against its interaction key, so it can only decide the request it was raised for. Once the page answers that request or a newer one replaces it, clicking the leftover buttons decides nothing and just closes the notification. Button toasts also skip the auto-dismiss timer: an undecided approval stays in the notification center until you settle it.

### How the Desktop window gets raised

DSH Desktop is a thin Electron shell and its page lives under `dsh-app://app`: DOM `window.focus()` only touches the browsing-context window, never the native one, and the shell's `will-navigate` / window-open handlers block every ordinary way for the page to fire a `dsh://` URL — so through 1.5.1 a toast click switched the conversation in the background but never brought the window forward. Since 1.5.2 a body click navigates a hidden iframe to `dsh://open`: subframe navigations pass the shell's `will-navigate` interception, the URL reaches the OS protocol registration, and the app's single-instance owner runs its own `focusPrimaryWindow()` (restore + show + focus) — the same path the login completion page uses to bring the client forward. A window hidden to the tray, buried under others, or minimized all come back. Browsers are unaffected and still use `window.focus()` / the worker's `client.focus()`.

Verified on the real shell (DSH Desktop 0.2.0-rc.2, three rounds of retesting in issue #9): a toast click raises the window and switches the conversation in one step, stable across sessions and with the window in the background. Timing of the fire is what makes the chain work: the deep link must be launched from a **user-gesture handler** — the notification's `onclick` carries one, which is why the product path works — while gesture-less scripted injection (an iframe appended from a CDP evaluate, say) is silently dropped by Chromium and the external protocol never launches, which looks exactly like the channel being blocked.

</details>

## Known limitations

- The page must be open for alerts to fire (background tab / minimized is fine; closing the tab stops it — that's inherent to a browser-layer plugin).
- Notifications appear through the browser, so the browser needs "show notifications" permission in the OS notification settings, and notification-center "Do Not Disturb" must not suppress them.
- The first sound/toast of each page load needs one user click on the page first (browser autoplay + permission policy).
- Toasts are only produced once the notification permission is granted; declining means sound + title marker only.
- System notification banners are drawn on the primary display only: Windows has no setting and Chromium no API to aim one at another monitor, so on a multi-monitor setup the second screen never receives them. Use the in-page overlay for that — it follows the DSH window to its display.
- Quick-decision buttons need a Service Worker: they work on `http://127.0.0.1` and `https`, not on plain `http://192.168.x.x`-style LAN addresses, and some browsers or desktop hosts never render notification buttons. **The Desktop (`dsh-app://`) is tested and cannot register a Service Worker**, so buttons never render there and approval toasts fall back to their buttonless form. The `bridge` field of `window.__dshNotifyMe.debug()` says why; everything else keeps working.
- macOS: in the browser, alerts, sounds, the title marker and toast-click navigation carry no OS assumptions and work as on Windows. Two caveats: DSH Desktop (Electron) notifications require the app to be code-signed — unsigned builds simply emit no notification — and whether the official macOS build satisfies that is untested; and notification buttons on the macOS desktop host are likewise untested (the Windows desktop host is tested and renders none, see the line above), falling back to the buttonless form above.
- Config lives in browser `localStorage`: switching browsers/devices or clearing site data returns to defaults (one-click restore in the Settings page).
- On `>= 0.1.6` (including `0.2.0-rc.2`, `0.2.1-rc.2`) the "reply finished" toast body carries only the session label, no assistant snippet: host snapshots no longer expose `nodes`. The alert itself still fires.
- The title marker is written into `document.title` alongside the host: when the host recomputes the title it can overwrite the marker until the next alert event rewrites it.
- "Stay quiet for the conversation on screen" is judged by `document.hidden`: a window fully covered by other apps still counts as visible, so waits in the current conversation stay quiet there too.
- External notification forwarding is subject to browser CORS rules: an endpoint that does not allow cross-origin requests falls back to a "sent but unverifiable" delivery (no-cors) and is reported honestly as such; Discord webhooks do allow cross-origin, so delivery to them is confirmed. HTTP errors are recorded as failures and never blindly retried. Forwarding runs only after the local alert has decided to fire, so anything the rules silence is never sent out.

- **The settings sidebar glyph relies on a DOM patch**: the shell hard-codes icons per section id and `settings.section` exposes no icon field, so the plugin can only swap the `<svg>` in its own row after the panel renders. It depends on the current panel structure (`data-shortcut-modal="settings"` plus a label `<span>` inside each nav button); if DSH changes that markup the patch silently stops working and the default gear shows instead — nothing else is affected.

## Development

```powershell
node --check lib\client.js
node --check lib\index.js
node smoke\smoke-test.cjs        # offline state-machine test: three host generations + master switch + zh/en cases + the quick-decision bridge (worker half included)
node smoke\cordis-host-test.mjs  # real-cordis end-to-end (skips when no local DSH installation is found)
npm pack --dry-run               # preview the published tarball
```

`cordis-host-test.mjs` borrows `@deepseek-ai/cordis` from a local DSH installation (it probes the global npm directory, `~/.dsh/profiles/web/node_modules` and the flat fallback `~/.dsh/profiles/node_modules` in turn); in a source checkout with no profile dependencies, point it there with `DSH_CORDIS_PATH=<checkout>/vendor/cordis/lib/index.js`.

## Credits & how contributions land

Contributors (by handle; the link points at the PR / issue they worked on):

- [@AgMahone](https://github.com/AgMahone) — [#7](https://github.com/chromoany/dsh-notify-me/pull/7): the 0.1.6+ / 0.2.0 host-generation support, plus the double-chime and cordis-lookup reports and retesting;
- [@d0ublecl1ck](https://github.com/d0ublecl1ck) — [#8](https://github.com/chromoany/dsh-notify-me/pull/8): muting subagent sessions (`ignoreSubagent`) with its tests and docs; the 1.4.0 refinement — mute only background subagents, alert as usual for the one you have open — is his suggestion from the #8 discussion, landed by the maintainer;
- [@EliteOtaku](https://github.com/EliteOtaku) — [#9](https://github.com/chromoany/dsh-notify-me/issues/9): the layer-by-layer investigation and three rounds of real-shell retesting of the desktop raise path (1.5.2) — confirming that a toast click raises the window and switches conversations reliably, and pinning down the reproduction difference ("gesture-less scripted injection is silently dropped by Chromium"), which corrected the initial "the sandbox blocks it" reading;
- [@Wh1stle05](https://github.com/Wh1stle05) — [#10](https://github.com/chromoany/dsh-notify-me/pull/10): the per-kind alert sound source (built-in synth / picked audio file / system notification sound, chosen independently for "needs you" and "reply done"), with its settings UI, fallback chain, tests and docs; the two refinements — a "system" preview sending a real test notification instead of doing nothing, and the fake React holding hook state by index across renders — come from the same PR.
- [@yanzhaohui1999](https://github.com/yanzhaohui1999) — [#13](https://github.com/chromoany/dsh-notify-me/issues/13) / [#14](https://github.com/chromoany/dsh-notify-me/pull/14): the 482-session idle-page CPU report (pinning `currentSessionId()` rescanning the whole table per row, 5.9%~6.5% of CPU) and the fix (derive the on-screen session once per list change), with a red-then-green regression assertion — a 4-row and a 40-row list change must cost the same (upstream reported 7 vs 43, 5 vs 5 after).
- [@RiZhiZhaoYi](https://github.com/RiZhiZhaoYi) — [#12](https://github.com/chromoany/dsh-notify-me/issues/12): the external-notification forwarding suggestion (Discord Webhook / Bark / Gotify / custom webhook) and its use case (1.7.0).

Attribution policy: external PRs are landed as maintainer commits — the original commit is not reused and no Co-authored-by trailer is added, so GitHub's contributors graph lists the maintainer only and contributors are credited above.

## License

MIT — see [LICENSE](LICENSE).
