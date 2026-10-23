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
[![Package size](https://img.shields.io/npm/unpacked-size/dsh-notify-me?style=flat-square&label=package%20size)](https://www.npmjs.com/package/dsh-notify-me)
[![DSH Compatibility](https://img.shields.io/badge/DSH-tested%200.2.1--rc.2-6366f1.svg?style=flat-square)](#compatibility)
[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)

</div>

[Install](#installation) · [Preview](#ui-preview) · [Settings](#configure-it-from-dsh-settings) · [Compatibility](#compatibility) · [Changelog](CHANGELOG.md)

A notification plugin for DSH Web / Desktop, so you can keep full access off without watching the page all day.

- **When input is needed:** approval, plan review, and questions trigger notifications, sound, and a title marker.
- **When a background reply finishes:** return to the result; click the notification to open its conversation. Pick "background only", "quiet for the open one", or "always".
- **When you walk off but the window stays in front:** over 3 minutes without input counts as away, and the alert still fires; a toast you have not seen is not closed on a timer before you return.
- **When you leave your computer:** optionally forward alerts to Discord, Bark, Gotify, Feishu group bots, ServerChan, WxPusher, or your own webhook.

> Keep the page or desktop app running; backgrounding / minimizing is fine. System notifications require permission. Approval buttons need a Service Worker: Web (`http://127.0.0.1` or `https`) has one, the Desktop `dsh-app://` pages cannot register one, so their notifications carry no buttons — click the notification to decide in the conversation.

> 🔎 Looking for it? Search `dsh-notify-me`, **message alerts**, **notification**, **desktop notification**, **reminder**, **approval alert**, **external notifications**, **Android push**, **Discord / Bark / Gotify / Feishu / ServerChan / WxPusher push** or **可操作提醒 / 消息提醒 / 桌面通知 / 需要你操作** (npm keywords include both English and Chinese terms).

## UI Preview

![Plain DSH notification shown through Edge on Windows, without approval buttons](https://raw.githubusercontent.com/chromoany/dsh-notify-me/main/docs/screenshots/notify-toast.png)

*Plain notification example · Windows / Edge · no approval buttons.* [View full size](https://raw.githubusercontent.com/chromoany/dsh-notify-me/main/docs/screenshots/notify-toast.png)

<details>
<summary>See the settings interface</summary>

![The Notify me settings page: header, how you get told, when to alert, try it, and the collapsed Advanced block](https://raw.githubusercontent.com/chromoany/dsh-notify-me/main/docs/screenshots/settings-en.png)

Just the plugin panel (the real component, on the same dark theme as the host) without the DSH navigation sidebar. Row explanations live in a hover tooltip that appears when the pointer rests on a title, which is why only the titles show here.
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
2. Open **Settings → Notify me**. Confirm that the section and plugin version at its foot appear, and leave the master switch and sound enabled.
3. Click **Test "reply finished"** on the settings page. A test notification should appear and sound according to your cue settings. This local test does not forward to external endpoints and ignores the "while the window is in front" toggle.

Web users can also test approval buttons. On Desktop the shell cannot register a Service Worker, so this test sends a plain notification without buttons — click it to open the conversation.

**Optional console check** — in environments with DevTools, you can also run:

```js
window.__dshNotifyMe.test("done")        // "reply finished" sample
window.__dshNotifyMe.test("attention")   // "needs your input" sample
window.__dshNotifyMe.test("approval")    // Approve / Reject with an active Web bridge; a plain notification on Desktop
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
| ✅ Reply finished | Alerts while the page is hidden / backgrounded (or "quiet for the open one" / "always") |

**Input needed** covers approval requests, plan review, and questions (`ask_user_question`). The Approve / Reject buttons only exist on Web (they need a Service Worker); the Desktop cannot register one, so its notifications carry no buttons — click the notification to decide in the conversation.

**Reply finished** also covers background sessions. A finished but unread session keeps the `✅ Reply finished ·` title marker until opened. Title markers are independent of the alert policy.

> **Background** subagent child sessions are **not** alerted about by default: DSH lists each of them as its own session, but they are steps inside the parent conversation's turn, so an alert for them is only noise. The subagent session you have open is not part of this and alerts as usual. Settings → "Ignore subagent sessions" turns the mute off.

## Configure it from DSH Settings

Open **Settings → Notify me**. The page runs as how you get told, when to alert, and a try-it block; the knobs you rarely touch fold into **Advanced** at the bottom. Rows show titles only — the explanation pops up next to the pointer once it rests on the title text (hovering a switch does nothing), with a hidden copy kept for screen readers. Rows marked with ▸ open a sub-item when clicked.

### How you get told

- **Enable reminders**: master switch — off means no toasts, no sounds, and the tab title is left alone;
- **Sound / Volume**: the switch is direct; the slider folds into that row — click the title (▸ turns into ▾) to reveal it. What it plays comes from Advanced → Alert sound;
- **Decide approvals from the toast** (on by default): approvals carry Approve / Reject that settle the request in place. On Web that is a system notification with buttons; on Desktop `dsh-app://` cannot register a Service Worker, so the notification carries no buttons — click it to decide in the conversation. The line under the Try-it block states whether buttons are possible here.

### When to alert

- **Also alert "needs you" while the window is in front** (on): turn it off to hear only once the window goes to the background — another app focused, the window covered, or minimized all count. A window left in front while nobody touches it (3 minutes without input by default) also counts as background; `idleMinutes: 0` restores the window-only rule;
- **Stay quiet for the conversation on screen** (on): a wait belonging to the conversation you are looking at keeps only the tab marker, so it does not interrupt what you are doing; moving the window to the background or going idle restores alerts;
- **When "reply finished" alerts** (default "background only"): three choices. "Background only" is the old rule — alert when you are not watching the page; "quiet for the open one" stays silent only for the conversation on screen while any other conversation still alerts (useful with several open); "always" never suppresses. An old profile's "also alert reply finished while in front" switch migrates to this setting;
- **Dismiss the toast automatically** (default "keep while away"): three choices. "Keep while away" only closes a toast a few seconds later while you are at the page, so one that arrived while you were away is still in the notification centre when you come back; "always close" is the old tidy-up; "never close" leaves plain toasts up until you dismiss one. Approvals keep their 12 s rule and are likewise not withdrawn while you are away;
- **Ignore subagent sessions** (on): skip background sessions spawned by a subagent — the parent conversation covers them; the one you have open still alerts;
- **Click a toast to open that conversation** (on): the click switches to the conversation that raised it; in a browser it also brings the window forward, while on the Desktop shell the host route raises the native window (see [How the Desktop window gets raised](#how-the-desktop-window-gets-raised)) and a failure only leaves the conversation switch in place, with the reason in `debug().raiseLast`; with several tabs open only one is raised, and off means a click does nothing.

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

Off by default. Supports Discord Webhook / Bark / Gotify / Feishu group bots / ServerChan (Turbo and ServerChan³) / WxPusher / custom webhooks. Alert text is sent to the addresses you enter; use trusted endpoints.

<details>
<summary>Target URLs, forwarding switches, test messages, and the failure log</summary>

- **External notifications** (default off) — forward each alert to your own push endpoints as well, so it reaches you away from the machine: **Discord Webhook** / **Bark** / **Gotify** / **Feishu group bot** / **ServerChan** / **WxPusher** / **custom webhook**, any number of targets, each of which can be enabled or disabled on its own (Discord takes the webhook URL; Bark `https://api.day.app/<device key>`; Gotify `https://<server>/message?token=<app token>`; Feishu the group-bot webhook plus an optional verification secret; ServerChan the full `…/send/<SendKey>.send` URL; WxPusher the appToken and the receiver UID; a custom endpoint receives one POST of JSON: `{source, event, title, body, text, sessionId, time}`). "Forward 'needs you'" and "Forward 'reply finished'" switch independently; **Send test notification** sends one test message to every target (not limited by those two switches, and never pretending to be a real alert). Forwarding follows exactly the same trigger rules as local alerts ("stay quiet for the conversation on screen" and friends apply to it too); the alert text is sent as-is to the addresses you fill in, so **only use endpoints you trust**;
- **Reliable delivery** — failures that look transient (network error, 5xx, 429) are retried after 2 s and 6 s; anything else stops at once. A delivery that still fails is recorded in the failure log (10 entries at most — title and body snippet plus host only, never the full endpoint), which the settings page shows and can clear;
- **Per-target state** — the right end of each target row shows how its last delivery went (last delivery ok / sent-unverified / failed with the reason) next to a switch of its own, so an endpoint that is temporarily down can be turned off alone instead of muting a whole alert kind;
- **Signing** — a custom target with a secret sends `X-DSH-Notify-Signature` (HMAC-SHA256 over the body, `sha256=<hex>`); a Feishu target with a secret carries `timestamp` / `sign` in the body per Feishu's own algorithm;
- **Message template** (optional) — Feishu / ServerChan / WxPusher / custom targets accept a template with `{{title}}` `{{body}}` `{{event}}` `{{time}}` `{{session}}`; empty means "title, newline, body";
- **DingTalk is not supported** — its robot endpoint answers no CORS header at all and only accepts `application/json`, so a page can neither read the reply nor send a conforming request (under no-cors the content type is restricted to the safelisted ones). To reach DingTalk, relay it through a machine you control and point a custom webhook at that.

</details>

### Runtime & diagnostics

The last block inside Advanced. The page protocol is detected automatically to tell Web from Desktop (`dsh-app://`); override it by hand if detection is wrong — Desktop clicks go through the host route for native activation (see [How the Desktop window gets raised](#how-the-desktop-window-gets-raised)) and carry no quick-decision buttons, while Web uses `window.focus()` plus the Service Worker bridge. When the override disagrees with detection the page says so.

<details>
<summary>Alert language, Desktop window raising, reset</summary>

- **Alert language**: follow the UI / Simplified Chinese / English — governs alert copy and the `🔔 …` title marker;
- **How the Desktop window is raised**: `window.focus()` cannot lift a native Electron window, so since 1.14.0 the page POSTs to the host route `/__dsh-notify-me/focus-window` and the host runs one PowerShell pass to activate the window natively — measured raising it back from both minimized and covered (see the next section);
- **Reset settings**: restores every switch and cue setting to the factory defaults (webhook targets and chosen audio files are kept).

</details>

> The settings sidebar icon is rendered by the DSH settings shell: it hard-codes icons per section id (account / models / agent-presets / plugins / archived-sessions) and `settings.section` has no icon field. The plugin therefore patches that row after the panel renders: it finds its own entry by the localised label text, swaps the host `<svg>` for the brand bell (keeping the host icon class), and follows re-renders with a MutationObserver; if the host changes its markup the patch quietly gives up and the default gear stays.

> Notification permission is required: click once on the page → **Allow** (or address-bar lock → Site settings → Notifications → Allow → reload). On macOS, also allow the browser under System Settings → Notifications.

## How it alerts

- **System notification** — a toast through the browser into the Windows action center / macOS Notification Center (clicking it opens the conversation it came from; supported Web environments offer approval buttons, Desktop does not)
- **Sound** — WebAudio beeps by default (distinct patterns for "needs you" vs "done"); each kind can instead play a picked audio file, or hand the sound over to the operating system's own notification sound
- **Tab title marker** — while something is waiting on you, the tab title is prefixed with `🔔 Action needed · …` / `🔔 需要你 · …`; while a background session is **finished but unread**, with `✅ Reply finished · …` / `✅ 回复完成 · …`, gone once you open that session (or it starts running again). Both kinds can be up together, "needs you" first; a host title change is rebased under the markers
- **External notifications** (optional, default off) — the same alert is also forwarded to the push targets you configure: Discord Webhook / Bark / Gotify / Feishu group bot / ServerChan / WxPusher / custom webhook — so the push channel on your phone picks it up while you step away from the machine

This is a **browser-layer** plugin: the DSH page must stay open (minimized or backgrounded is fine — that's exactly the "away" state it watches for).

## Compatibility

Per-release adaptation records live in [package.json](package.json), under `dsh.compatibility.dshReleases`. The current host (`0.2.1-rc.2`) no longer reads that field — installation gates only on `peerDependencies` and `engines` — so it is a human-readable record, not a gate.

Verified to actually activate on `0.1.2-rc.1`, `0.1.5-rc.1`, `0.1.5-rc.2` and `0.2.0-rc.2` (each booted in its own profile: the plugin entry lands in the boot page's `__DSH_BOOT__` with its inject dependencies resolved, `/plugins/??dsh-notify-me/client.js&rev=…` serves a build containing the new code, and the Settings → Notifications section registers, i.e. the plugin's `apply` really runs), and previously on `0.1.1-rc.2`.

`0.2.1-rc.2` (current latest) got its own isolated run: an isolated `DSH_HOME` booting `dsh web` (70 boot entries) placed the plugin entry 59th, in the `application` batch, with all three inject targets present and ordered before it; `/plugins/??dsh-notify-me/client.js&rev=…` served the then-installed 1.7.0 source build (140,153 B); loaded in a headless Chromium page, `apply` ran — `window.__dshNotifyMe.debug()` reported `uiSession: bound`, `uiSessionSource: sessionStatus`, `bridge: active`. Host-side shapes match `0.2.0-rc.2`; no plugin code change was needed.

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

`1.9.0` neither widens nor narrows that range: the settings page is plain React rendering over the existing CSS variables (every colour carries a fallback) and adds no host API. The alerts, title markers and window raising still go through the 1.7 / 1.8 paths, so **plugin entries stay compatible from 0.1.1-rc.2 through 0.2.1-rc.2**, and stepping back to an older host needs no config change. The only new surface is visual: the bell in the page header is the plugin's own SVG (`docs/brand/`).

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
  currentHiddenOnly: true,    // true = waits in the conversation on screen keep only the tab marker (replayed once away)
  donePolicy: "background",   // "reply finished" policy: 'background' only when away | 'smart' quiet only for the open one | 'always' always alert
  idleMinutes: 3,             // minutes without pointer/keyboard input before a focused page counts as away (0 = off)
  autoDismiss: "present",     // toast self-dismiss: 'present' keep while away | 'always' always close | 'never' never close
  ignoreSubagent: true,       // true = never alert for background subagent sessions (the open one is exempt)
  quickActions: true,         // Approve / Reject buttons on approval toasts
  sound: true,                // cue toggle (also governs the "system notification sound" mode)
  soundDone: "synth",         // "reply finished" cue source: 'synth' built-in | 'custom' picked file | 'system' OS sound
  soundAttention: "synth",    // "needs you" cue source, same values
  volume: 0.5,                // 0..1
  autoFocus: true,            // clicking a toast opens the conversation it came from
  externalEnabled: false,     // external-notification forwarding master switch (default off: no endpoint, nothing is sent)
  externalAttention: true,    // forward "needs you" (exactly the same trigger rules as local alerts)
  externalDone: true,         // forward "reply finished"
  externalRetryDelays: [2000, 6000], // backoff for retryable failures (ms, with jitter; [] = send once)
  externalTargets: []         // push targets, see the shape below
})
// Target shape: {id, type, url, secret?, token?, uid?, template?, enabled?}
// type: 'discord' | 'bark' | 'gotify' | 'feishu' | 'serverchan' | 'wxpusher' | 'custom'
// token/uid only for wxpusher (its URL is fixed to the official endpoint); secret signs Feishu bodies
// and custom HMAC headers; template is optional ({{title}} {{body}} {{event}} {{time}} {{session}});
// enabled:false disables that one target
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

The reminder core watches session state and pending interactions. The page handles approval decisions; Desktop window activation uses a host route plus native Win32 calls.

<details>
<summary>Event sources and graceful degradation</summary>

The reminder core picks its interaction source per host generation (see the table above); the current session always comes from the client `sessions` service:

- the **selected session's** `SessionSnapshot`: a `running: true → false` edge means a reply finished;
- **pending interactions**: a new key in `uiSession.sessionStatus` (`>= 0.1.6`, per-session `pendingInteraction`) or in `pendingInteractions` (`0.1.2 .. 0.1.5`) means the agent is waiting on you — approval requests carry the tool name and reason, questions their text; older hosts fall back to the controller snapshot's `pending[]`;
- **every other listed session's** summary: a `running: true → false` edge (or the legacy `completed` flag) alerts you about background work. The host's completion-unread level flag backs that edge up and owns the title marker: `sessionStatus` rows' `completionUnread` on `>= 0.1.6` (lit when a background session finishes, cleared when it is opened / re-runs / disappears), the list row's `completed` reminder bit on older hosts (cleared on select). It re-reports a completion whose edge this page never saw (a plugin remount mid-turn, coalesced snapshots) exactly once, and when both views of one completion arrive together a short window collapses them into a single alert.
- **subagent sessions**: **background** rows carrying `origin: 'subagent'` (and a `parentId`) stay muted by default. The subagent session you have open is exempt — its alerts follow the normal current-conversation rules (tab marker only while the page is visible, delivered on background), its outstanding waits are picked up when you switch into it, and switching away mutes them again. A fork has a `parentId` but no `origin`, is your own conversation, and keeps alerting throughout.

The reminder core stays dependency-free and self-contained: notification copy resolves at alert time from the chosen language (follow-interface / Simplified Chinese / English). The Settings page is an **optional** React surface — it only registers into Settings when the web profile provides the `slots` / `locale` services and `react`; without them the plugin degrades gracefully to alerts-only (no Settings page).

</details>

### Quick decisions, and how they reach the agent

Action buttons (`actions`) belong to persistent notifications shown through `ServiceWorkerRegistration.showNotification()`; passing `actions` to the `new Notification()` constructor throws a `TypeError`. That is a browser rule no plugin can route around, so the bundle holds two jobs in the same bytes: the page half registers the reminder factory as it always did, and the very same file is registered as a Service Worker whose only task is relaying which button was clicked back to the page. The decision itself happens in the page, through the same `PendingApproval.answer('allowed-once' | 'rejected')` the conversation's approval prompt uses — which is why "Approve" is exactly "Allow once" and nothing broader. The "raise a window and switch its conversation" part of a body click is scheduled on the worker half too: `client.focus()` raises exactly one window (a visible one first) and routes the conversation switch to that window alone, so several open DSH tabs never fight over focus or all switch at once.

Every button toast is booked against its interaction key, so it can only decide the request it was raised for. Once the page answers that request or a newer one replaces it, clicking the leftover buttons decides nothing and just closes the notification. Button toasts stay 12s (plain ones 5s) and retire on their own, so an approval left undecided there still waits for you in the page.

### How the Desktop window gets raised

DSH Desktop is a thin Electron shell and its page lives under `dsh-app://app`: DOM `window.focus()` only touches the browsing-context window, never the native one, and the shell's `will-navigate` handler blocks the page from firing a `dsh:` URL. From 1.5.2 through 1.13.0 the plugin sidestepped that with a hidden iframe navigating to `dsh://open`, relying on the app's single-instance yield to focus the window second-hand. Isolated retests on 0.2.1-rc.2 failed 3/3, so 1.14.0 removes that path and goes through the plugin's own host route instead.

For every non-asset path under `dsh-app://app` the shell forwards the request to the host HTTP server (with an origin check and the host cookie injected), so a page POST to `/__dsh-notify-me/focus-window` is a same-origin request with no CORS involved. The host half (`lib/index.js`) already runs as a child of the Electron main process, and its `process.ppid` is that of the window's browser process. On a toast click the page POSTs, the host spawns one `powershell.exe` running `lib/focus-window.ps1 -ProcessId <ppid>`, the script enumerates the visible, owner-less, non-toolwindow top-level windows of that pid (preferring class `Chrome_WidgetWin_1`, then the largest area from `GetWindowRect`), raises it, compares `GetForegroundWindow()` and prints `FOCUSED=1|0`, and the host answers `200` / `202`.

The raise order is adaptive: already in front means do nothing (the common case, no flicker); minimized means `SW_RESTORE` first; then a synthetic Alt tap (`keybd_event` down/up) grants the calling thread foreground permission before `SetForegroundWindow`; only if all of that fails does it fall back to `SW_MINIMIZE` + `SW_RESTORE`. `SetForegroundWindow` on its own gets refused by the foreground lock — per call, unrelated to `ForegroundLockTimeout`. That also re-reads the old "sometimes it works" behaviour: the times the window did come forward were most likely the OS activating the app on the click itself.

Measured with `powershell.exe` 5.1 in one round: window in front ×3, minimized with Notepad in front ×3, visible but covered ×3 — all `FOCUSED=1` with the foreground comparison matching and every `IsIconic` flipped back to `false`; Notepad maximized, minimized plus maximized, and `-ProcessId 0` auto-detection all succeeded too. Script-internal time peaked at 434 ms, process wall time at 782 ms, well inside the 8 s cap; `pwsh` 7.6 behaved identically, only slower by ~100 ms compiling the `Add-Type` helpers (the script avoids PowerShell 7 syntax on purpose). A pid that does not exist and a pid with no visible window both settle on `FOCUSED=0` and `exit 0`.

The route is a single exact path and says no by default: anything other than `GET` / `HEAD` / `POST` answers `405` (including a preflight `OPTIONS`, and the route never returns a CORS header), a non-Desktop host (Web, macOS / Linux, plain Node) `501`, and a missing `x-dsh-notify-me-focus: focus` header `403`.

That header is a "this came from the page" marker, not the defence: a DNS-rebinding page is same-origin with the address it resolved, so it can send any custom header and no preflight fires. The gate is three checks — the peer address must be loopback; `Host` must be a loopback name (`127.0.0.1` / `localhost` / `[::1]`, port optional), because the shell deletes `host` when forwarding and the fetch refills it from the loopback URL while a rebound page keeps its own name; and an `Origin`, when present, must agree with that `Host`. A failure answers `403` with `reason` set to `bad-remote`, `bad-host` or `cross-origin`. A `GET` returns `{ok, route, enabled, desktop, platform}` so you can check the route from a browser after installing. Calls within 400 ms coalesce into one, and a script that has not answered after 8 s is killed and counted as a failure.

A few cases still will not raise, and they answer `202` with the conversation switch intact: a target window owned by a higher integrity level (elevated / UAC), a window on another virtual desktop, or a foreground that keeps getting stolen. A tray-hidden window (`SW_HIDE` rather than minimized) is filtered out as well; DSH does not do that today.

## Known limitations

- The page must be open for alerts to fire (background tab / minimized is fine; closing the tab stops it — that's inherent to a browser-layer plugin).
- Notifications appear through the browser, so the browser needs "show notifications" permission in the OS notification settings, and notification-center "Do Not Disturb" must not suppress them.
- The first sound/toast of each page load needs one user click on the page first (browser autoplay + permission policy).
- Toasts are only produced once the notification permission is granted; declining means sound + title marker only.
- On the Desktop shell (DSH Desktop, Windows) a toast click can still fail to raise the window: a target owned by a higher integrity level (elevated / UAC), a window on another virtual desktop, a foreground that keeps getting stolen, or a window hidden with `SW_HIDE` to the tray all end in `FOCUSED=0` and a `202` from the route, with the conversation switch intact (see [How the Desktop window gets raised](#how-the-desktop-window-gets-raised)).
- System notification banners are drawn on the primary display only: Windows has no setting and Chromium no API to aim one at another monitor, so on a multi-monitor setup the second screen never receives them. Forwarding to your phone with external notifications is the only route across screens (since 1.12.0 the page no longer draws an approval card).
- Quick-decision buttons need a Service Worker: they work on `http://127.0.0.1` and `https`, not on plain `http://192.168.x.x`-style LAN addresses, and some browsers or desktop hosts never render notification buttons. **The Desktop (`dsh-app://`) is tested and cannot register a Service Worker** (the shell does not grant the `allowServiceWorkers` privilege), so buttons never render there and approval toasts fall back to their buttonless form. The `bridge` field of `window.__dshNotifyMe.debug()` says why; everything else keeps working.
- macOS: in the browser, alerts, sounds, the title marker and toast-click navigation carry no OS assumptions and work as on Windows. Two caveats: DSH Desktop (Electron) notifications require the app to be code-signed — unsigned builds simply emit no notification — and whether the official macOS build satisfies that is untested; and notification buttons on the macOS desktop host are likewise untested (the Windows desktop host is tested and renders none, see the line above), falling back to the buttonless form above.
- Config lives in browser `localStorage`: switching browsers/devices or clearing site data returns to defaults (one-click restore in the Settings page).
- On `>= 0.1.6` (including `0.2.0-rc.2`, `0.2.1-rc.2`) the "reply finished" toast body carries only the session label, no assistant snippet: host snapshots no longer expose `nodes`. The alert itself still fires.
- The title marker is written into `document.title` alongside the host: when the host recomputes the title it can overwrite the marker until the next alert event rewrites it.
- "Stay quiet for the conversation on screen" is judged by whether the window has focus: a window covered by another app, a switched-away app, or a minimized one all count as background, so waits in the current conversation alert there too; once the window is back in front, or you touch the keyboard / mouse again (no longer idle), it goes quiet again.
- External notification forwarding is subject to browser CORS rules: an endpoint that does not allow cross-origin requests falls back to a "sent but unverifiable" delivery (no-cors) and is reported honestly as such; Discord, Feishu, ServerChan, and WxPusher all allow cross-origin, so delivery to them is confirmed. DingTalk allows no CORS header at all and only accepts `application/json`, so a page cannot post to it — hence no DingTalk target type (relay it through your own box and use a custom webhook). A failure that looks transient (network error, 5xx, 429) is retried on the backoff; a delivery that still fails lands in the failure log, and anything else stops at once. Forwarding runs only after the local alert has decided to fire, so anything the rules silence is never sent out.

- **The settings sidebar glyph relies on a DOM patch**: the shell hard-codes icons per section id and `settings.section` exposes no icon field, so the plugin can only swap the `<svg>` in its own row after the panel renders. It depends on the current panel structure (`data-shortcut-modal="settings"` plus a label `<span>` inside each nav button); if DSH changes that markup the patch silently stops working and the default gear shows instead — nothing else is affected.

## Development

```powershell
node --check lib\client.js
node --check lib\index.js
node smoke\smoke-test.cjs        # offline state-machine test: three host generations + master switch + zh/en cases + the quick-decision bridge (worker half included) + idle detection and toast self-dismiss
node smoke\cordis-host-test.mjs  # real-cordis end-to-end (skips when no local DSH installation is found)
powershell -NoProfile -File lib\focus-window.ps1 -ProcessId 0   # manual raise test, the last line should be FOCUSED=1
npm pack --dry-run               # preview the published tarball
```

`cordis-host-test.mjs` borrows `@deepseek-ai/cordis` from a local DSH installation (it probes the global npm directory, `~/.dsh/profiles/web/node_modules` and the flat fallback `~/.dsh/profiles/node_modules` in turn); in a source checkout with no profile dependencies, point it there with `DSH_CORDIS_PATH=<checkout>/vendor/cordis/lib/index.js`.

## Credits & how contributions land

- <a href="https://github.com/AgMahone"><img src="https://raw.githubusercontent.com/chromoany/dsh-notify-me/main/docs/contributors/AgMahone.png" width="24" height="24" alt="@AgMahone"></a> [#7](https://github.com/chromoany/dsh-notify-me/pull/7): the 0.1.6+ / 0.2.0 host-generation support, plus the double-chime and cordis-lookup reports and retesting;
- <a href="https://github.com/d0ublecl1ck"><img src="https://raw.githubusercontent.com/chromoany/dsh-notify-me/main/docs/contributors/d0ublecl1ck.png" width="24" height="24" alt="@d0ublecl1ck"></a> [#8](https://github.com/chromoany/dsh-notify-me/pull/8): muting subagent sessions (`ignoreSubagent`) with its tests and docs; the 1.4.0 refinement — mute only background subagents, alert as usual for the one you have open — is his suggestion from the #8 discussion, landed by the maintainer;
- <a href="https://github.com/EliteOtaku"><img src="https://raw.githubusercontent.com/chromoany/dsh-notify-me/main/docs/contributors/EliteOtaku.png" width="24" height="24" alt="@EliteOtaku"></a> [#9](https://github.com/chromoany/dsh-notify-me/issues/9): the layer-by-layer investigation and three rounds of real-shell retesting of the desktop raise path (1.5.2) — confirming that a toast click raises the window and switches conversations reliably, and pinning down the reproduction difference ("gesture-less scripted injection is silently dropped by Chromium"), which corrected the initial "the sandbox blocks it" reading;
- <a href="https://github.com/Wh1stle05"><img src="https://raw.githubusercontent.com/chromoany/dsh-notify-me/main/docs/contributors/Wh1stle05.png" width="24" height="24" alt="@Wh1stle05"></a> [#10](https://github.com/chromoany/dsh-notify-me/pull/10): the per-kind alert sound source (built-in synth / picked audio file / system notification sound, chosen independently for "needs you" and "reply done"), with its settings UI, fallback chain, tests and docs; the two refinements — a "system" preview sending a real test notification instead of doing nothing, and the fake React holding hook state by index across renders — come from the same PR.
- <a href="https://github.com/yanzhaohui1999"><img src="https://raw.githubusercontent.com/chromoany/dsh-notify-me/main/docs/contributors/yanzhaohui1999.png" width="24" height="24" alt="@yanzhaohui1999"></a> [#13](https://github.com/chromoany/dsh-notify-me/issues/13) / [#14](https://github.com/chromoany/dsh-notify-me/pull/14): the 482-session idle-page CPU report (pinning `currentSessionId()` rescanning the whole table per row, 5.9%~6.5% of CPU) and the fix (derive the on-screen session once per list change), with a red-then-green regression assertion — a 4-row and a 40-row list change must cost the same (upstream reported 7 vs 43, 5 vs 5 after).
- <a href="https://github.com/RiZhiZhaoYi"><img src="https://raw.githubusercontent.com/chromoany/dsh-notify-me/main/docs/contributors/RiZhiZhaoYi.png" width="24" height="24" alt="@RiZhiZhaoYi"></a> [#12](https://github.com/chromoany/dsh-notify-me/issues/12): the external-notification forwarding suggestion (Discord Webhook / Bark / Gotify / custom webhook) and its use case (1.7.0).
- <a href="https://github.com/yuexian7"><img src="https://raw.githubusercontent.com/chromoany/dsh-notify-me/main/docs/contributors/yuexian7.png" width="24" height="24" alt="@yuexian7"></a> [#17](https://github.com/chromoany/dsh-notify-me/issues/17): the ask for alerts on an Android phone — Discord is awkward in mainland China and Bark has no Android app, so a self-hosted relay was the only option; 1.13.0's Feishu / ServerChan / WxPusher targets, retries, and failure log came out of it.
- <a href="https://github.com/shrekcg"><img src="https://raw.githubusercontent.com/chromoany/dsh-notify-me/main/docs/contributors/shrekcg.png" width="24" height="24" alt="@shrekcg"></a> [#16](https://github.com/chromoany/dsh-notify-me/pull/16): counting "in front but walked away" as away (`idleMinutes`, 3 minutes by default), deciding "reply finished" alerts by which conversation finished (`donePolicy`, three choices), the three-way toast self-dismiss policy (`autoDismiss`), with matching smoke cases and old-config migration; when it landed in 1.12.0 the maintainer added the idle-expiry replay for suppressed approvals, removed the leftover in-page approval card, and brought docs and version up to date.

Attribution policy: external PRs are landed as maintainer commits — the original commit is not reused and no Co-authored-by trailer is added, so GitHub's contributors graph lists the maintainer only and contributors are credited above.

## License

MIT — see [LICENSE](LICENSE).
