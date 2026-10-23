/**
 * dsh-notify-me — host half.
 *
 * The browser half (lib/client.js) raises the window when a notification is
 * clicked. In a browser tab `window.focus()` is all that exists; inside the
 * desktop shell it is not enough, because the shell exposes no focus IPC and
 * Chromium only honours `window.focus()` for a window the OS already treats as
 * foreground. This module therefore owns one loopback route on the host web
 * server: the notification click posts to it, and the host activates the
 * Electron window through Win32 (lib/focus-window.ps1) from the process that is
 * allowed to do so.
 *
 * The route is reachable from the desktop page because the shell forwards every
 * non-static `dsh-app://app` path verbatim to the host web server, host cookie
 * attached — so a plain same-origin relative `fetch` behaves exactly as it does
 * in a browser tab.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Route that carries "bring the desktop window to the front". */
export const FOCUS_ROUTE = "/__dsh-notify-me/focus-window";

/**
 * Request header proving the caller is page code. A cross-origin page cannot
 * send a custom header without a CORS preflight, which this route never
 * answers, so the header doubles as the CSRF gate.
 */
const RAISE_HEADER = "x-dsh-notify-me-focus";

/** Marker value the page sends in {@link RAISE_HEADER}. */
const RAISE_HEADER_VALUE = "focus";

/** Activation script, resolved next to this module. */
const SCRIPT_URL = new URL("./focus-window.ps1", import.meta.url);

/** An activation that has not answered by then is abandoned; the user moved on. */
const RAISE_TIMEOUT_MS = 8000;

/** Two clicks inside this window share one activation instead of flashing twice. */
const RAISE_COALESCE_MS = 400;

/** Longest script output retained for the diagnostic line. */
const OUTPUT_LIMIT = 4096;

/** Plugin identity for cordis.yml rows. */
export const name = "dsh-notify-me";

/**
 * True when this host process runs on the Electron binary, i.e. inside the
 * desktop shell the window belongs to. `process.versions.electron` is the only
 * trustworthy signal: the shell also exports `ELECTRON_RUN_AS_NODE=1` into the
 * host's environment, and every child of the host inherits it, so keying on the
 * variable reports "desktop" from a plain Node test process.
 * @returns whether native window activation is worth attempting here.
 */
function isDesktopHost() {
  if (process.platform !== "win32") return false;
  return typeof process.versions.electron === "string";
}

/**
 * Stand-in script for the smoke tests; also the only way to force the desktop
 * path on from a plain Node process.
 * @returns the override path, or `undefined` when unset.
 */
function scriptOverride() {
  const override = process.env.DSH_NOTIFY_ME_FOCUS_SCRIPT;
  return typeof override === "string" && override.length > 0 ? override : undefined;
}

/**
 * @returns whether a POST to {@link FOCUS_ROUTE} can do anything.
 */
function focusAvailable() {
  return isDesktopHost() || scriptOverride() !== undefined;
}

/**
 * @returns the PowerShell script that performs the activation.
 */
function focusScriptPath() {
  return scriptOverride() ?? fileURLToPath(SCRIPT_URL);
}

/**
 * Where `powershell.exe` lives. The shell hands the host a PATH that appends its
 * own launcher directory in front of the inherited one, so a named lookup would
 * normally do; the absolute path just keeps a curated PATH from breaking raising.
 * @returns the interpreter to spawn.
 */
function powershellPath() {
  const root = process.env.SystemRoot;
  const candidate = `${typeof root === "string" && root.length > 0 ? root : "C:\\Windows"}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
  return existsSync(candidate) ? candidate : "powershell.exe";
}

/**
 * @returns the process whose window is activated: the Electron shell by
 *   default (the host is its direct child), or an explicit test stand-in.
 */
function focusTargetPid() {
  const override = Number.parseInt(process.env.DSH_NOTIFY_ME_FOCUS_PID ?? "", 10);
  return Number.isInteger(override) && override >= 0 ? override : process.ppid;
}

/**
 * Last `FOCUSED=<0|1>` line the script printed.
 * @param output - captured stdout.
 * @returns 1, 0, or `undefined` when the script printed no verdict.
 */
function lastVerdict(output) {
  const matches = output.match(/^FOCUSED=([01])$/gm);
  if (matches === null || matches.length === 0) return undefined;
  return Number.parseInt(matches[matches.length - 1].slice("FOCUSED=".length), 10);
}

/**
 * Most informative `DETAIL:` / `DETAIL=` line the script printed. The last one
 * is the elapsed-time line, which says nothing a caller cares about, so it is
 * skipped: what remains is either where activation succeeded or why it did not.
 * @param output - captured stdout.
 * @returns the diagnostic text (bounded), or `null`.
 */
function detailLine(output) {
  const matches = output.match(/^DETAIL[:=][ \t]*(.+)$/gm);
  if (matches === null) return null;
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const text = matches[index].replace(/^DETAIL[:=][ \t]*/, "").trim();
    if (text.length > 0 && !text.startsWith("elapsed_ms=")) return text.slice(0, 200);
  }
  return null;
}

/**
 * Run the activation script once.
 * @returns a result carrying `focused` and a short `detail` tag.
 */
function runFocusScript() {
  return new Promise((resolve) => {
    let output = "";
    let timer;
    let settled = false;
    /** Resolve exactly once and drop the watchdog. */
    const settle = (result) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      resolve(result);
    };

    const args = [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      focusScriptPath(),
      "-ProcessId",
      String(focusTargetPid()),
    ];

    let child;
    try {
      child = spawn(powershellPath(), args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      settle({ focused: false, detail: "spawn-failed: " + String(error?.message ?? error) });
      return;
    }

    timer = setTimeout(() => {
      try {
        child.kill();
      } catch {}
      settle({ focused: false, detail: "timeout" });
    }, RAISE_TIMEOUT_MS);

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      if (output.length < OUTPUT_LIMIT) output += chunk;
    });
    child.stderr.on("data", () => {});
    child.on("error", (error) => {
      settle({ focused: false, detail: "spawn-error: " + String(error?.message ?? error) });
    });
    child.on("close", (code) => {
      const verdict = lastVerdict(output);
      settle({
        focused: verdict === 1,
        detail: detailLine(output) ?? (verdict === undefined ? "no-verdict" : null),
        exitCode: code ?? null,
      });
    });
  });
}

let pendingRaise = null;
let lastRaiseAt = 0;

/**
 * Bring the desktop window to the front, coalescing rapid clicks.
 * @returns a result carrying `focused` and a short `detail` tag.
 */
function raiseWindow() {
  if (pendingRaise !== null) return pendingRaise;
  const now = Date.now();
  if (now - lastRaiseAt < RAISE_COALESCE_MS) return Promise.resolve({ focused: false, detail: "coalesced" });
  lastRaiseAt = now;
  pendingRaise = runFocusScript().finally(() => {
    pendingRaise = null;
  });
  return pendingRaise;
}

/**
 * Write a JSON response. Route handlers own the whole response lifecycle.
 * @param res - the server response.
 * @param status - HTTP status to send.
 * @param body - JSON-serialisable payload.
 */
function respond(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

/**
 * Build the route handler. The GET form is a probe the page may use to find out
 * whether activation is available at all; only the POST form touches the OS.
 * @returns the web-server route handler.
 */
function createHandler() {
  return function handleFocus(req, res) {
    const method = req.method ?? "GET";
    if (method === "GET" || method === "HEAD") {
      respond(res, 200, {
        ok: true,
        route: FOCUS_ROUTE,
        enabled: focusAvailable(),
        desktop: isDesktopHost(),
        platform: process.platform,
      });
      return;
    }
    if (method !== "POST") {
      respond(res, 405, { ok: false, reason: "method-not-allowed" });
      return;
    }
    if (!focusAvailable()) {
      respond(res, 501, { ok: false, reason: "unsupported-host", platform: process.platform });
      return;
    }
    if (req.headers[RAISE_HEADER] !== RAISE_HEADER_VALUE) {
      respond(res, 403, { ok: false, reason: "forbidden" });
      return;
    }
    req.resume();
    raiseWindow().then(
      (result) => {
        respond(res, result.focused ? 200 : 202, {
          ok: true,
          focused: result.focused === true,
          platform: process.platform,
          detail: result.detail ?? null,
        });
      },
      () => {
        respond(res, 202, { ok: true, focused: false, platform: process.platform, detail: "error" });
      },
    );
  };
}

/**
 * Host loader entry: mount the window-activation route when this composition has
 * a web server, and do nothing at all when it does not.
 * @param ctx - host cordis context.
 */
export function apply(ctx) {
  ctx.inject(["webServer"], (webCtx) => {
    webCtx.effect(
      () => webCtx.webServer.register({ kind: "exact", path: FOCUS_ROUTE, handler: createHandler() }),
      "dsh-notify-me: window focus route",
    );
  });
}
