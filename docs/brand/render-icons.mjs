// docs/brand/render-icons.mjs — 把 docs/brand/*.svg 渲染成 PNG 与总览图。
// 需要先起一个 headless Edge（不要用自己的日常窗口）：
//   & "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --remote-debugging-port=9444
// 然后：node docs/brand/render-icons.mjs
// 产出：icon-app-512/256/128/64/32.png、favicon-32.png、preview.png（均在本目录，覆盖写）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.CDP_PORT || 9444);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = HERE;
const TMP = path.join(HERE, 'render-icons.html');

const json = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const page = json.find((t) => t.type === 'page');
if (!page) throw new Error('no debuggable page on port ' + PORT);
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
const send = (method, params) => new Promise((res) => { const myId = ++id; pending.set(myId, res); ws.send(JSON.stringify({ id: myId, method, params: params || {} })); });

await send('Page.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });

async function shoot(html, w, h, file, opts) {
  fs.writeFileSync(TMP, html);
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'file:///' + TMP.replace(/\\/g, '/') + '?t=' + Date.now() });
  await new Promise((r) => setTimeout(r, 400));
  const shot = await send('Page.captureScreenshot', Object.assign({ format: 'png', clip: { x: 0, y: 0, width: w, height: h, scale: 1 } }, opts || {}));
  fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
  console.log('wrote', path.basename(file), Buffer.from(shot.result.data, 'base64').length);
}

const svg = (name) => fs.readFileSync(path.join(HERE, name), 'utf8');
const app = svg('icon-app.svg');
const fav = svg('favicon.svg');
const outline = svg('icon-outline.svg');
const shell = (inner, bg) => `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:${bg || 'transparent'}}svg{display:block}</style>${inner}`;

for (const size of [512, 256, 128, 64, 32]) {
  await shoot(shell(app.replace(/width="512" height="512"/, `width="${size}" height="${size}"`)), size, size, path.join(OUT, `icon-app-${size}.png`), { omitBackground: true });
}
await shoot(shell(fav), 32, 32, path.join(OUT, 'favicon-32.png'), { omitBackground: true });

const sheet = `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;background:#0f1115;color:#e9eaec;font:13px/1.4 "Segoe UI",system-ui,sans-serif}
  .row{display:flex;align-items:center;gap:26px;padding:26px 34px}
  .light{background:#f5f6f8;color:#1b1e24}
  .cell{display:flex;flex-direction:column;align-items:center;gap:8px}
  .cap{font-size:11px;opacity:.62}
  .app{display:flex;gap:22px;align-items:flex-end}
  .divider{height:1px;background:rgba(255,255,255,.09)}
</style>
<div class="row light">${[16, 18, 24, 32, 48].map((s) => `<div class="cell"><div style="color:#1b1e24">${outline.replace(/width="24" height="24"/, `width="${s}" height="${s}"`)}</div><div class="cap">${s}px</div></div>`).join('')}</div>
<div class="divider"></div>
<div class="row">${[16, 18, 24, 32, 48].map((s) => `<div class="cell"><div style="color:#e9eaec">${outline.replace(/width="24" height="24"/, `width="${s}" height="${s}"`)}</div><div class="cap">${s}px</div></div>`).join('')}</div>
<div class="divider"></div>
<div class="row app">${[256, 128, 64, 32, 16].map((s) => `<div class="cell">${app.replace(/width="512" height="512"/, `width="${s}" height="${s}"`)}<div class="cap">${s}px</div></div>`).join('')}</div>`;
await shoot(sheet, 980, 620, path.join(OUT, 'preview.png'));

fs.unlinkSync(TMP);
ws.close();
process.exit(0);
