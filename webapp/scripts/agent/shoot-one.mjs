#!/usr/bin/env node
// 極簡單頁截圖：http server + chromium 全在同一個 node 進程，只截 1 頁
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { fixtureFor } from "./lib/fixtures.mjs";
import WebSocket from "ws";

const PAGE = process.argv[2] || "dashboard";
const PATH_MAP = { dashboard: "/dashboard", chart: "/chart", news: "/news", account: "/account", radar: "/insights?tab=radar", macro: "/insights?tab=macro", config: "/strategy-config" };
const P = PATH_MAP[PAGE] || "/dashboard";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "../../dist");
const WEB = 5176, CDP = 9223;
const out = (s) => process.stdout.write(s + "\n");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 1. 內嵌 http server ──
const MOCK = '<script>window.__PLAYWRIGHT__=true;window.Telegram={WebApp:{initData:"x",initDataUnsafe:{user:{id:1}},ready:()=>{},expand:()=>{},close:()=>{},BackButton:{show:()=>{},hide:()=>{},onClick:()=>{},offClick:()=>{}},MainButton:{setParams:()=>{},show:()=>{},hide:()=>{},enable:()=>{},disable:()=>{}},HapticFeedback:{impactOccurred:()=>{},notificationOccurred:()=>{},selectionChanged:()=>{}},themeParams:{bg_color:"#FEF7FF",text_color:"#1D1B20",hint_color:"#79747E",link_color:"#6750A4",button_color:"#6750A4",button_text_color:"#FFFFFF",secondary_bg_color:"#F7F2FA"},viewportHeight:844,viewportStableHeight:844,headerColor:"#FEF7FF",backgroundColor:"#FEF7FF",isExpanded:true,colorScheme:"light",version:"7.0",platform:"ios",setHeaderColor:()=>{},setBackgroundColor:()=>{},isVersionAtLeast:()=>true}};</script>';
const MIME = { ".html":"text/html; charset=utf-8", ".js":"application/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml", ".woff2":"font/woff2", ".woff":"font/woff" };
function serveIndex(res) {
  let h = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
  h = h.replace(/<script\s+src="https:\/\/telegram\.org[^"]*"[^>]*><\/script>/g, MOCK);
  h = h.replace(/<script\s+src="https:\/\/cdn\.jsdelivr\.net[^"]*"[^>]*><\/script>\s*/g, "");
  h = h.replace(/<script>eruda\.init\(\);<\/script>\s*/g, "");
  if (!h.includes("window.Telegram")) h = h.replace("</head>", MOCK + "</head>");
  res.writeHead(200, { "Content-Type": MIME[".html"], "Cache-Control": "no-store" });
  res.end(h);
}
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api/")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(fixtureFor(u.pathname)));
    return;
  }
  if (u.pathname === "/" || u.pathname === "/index.html") return serveIndex(res);
  const fp = path.join(DIST, decodeURIComponent(u.pathname));
  if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) return serveIndex(res);
  res.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream" });
  fs.createReadStream(fp).pipe(res);
});

await new Promise((r) => srv.listen(WEB, "127.0.0.1", r));
out(`server on ${WEB}`);

// ── 2. chromium ──
const chrome = spawn("/usr/bin/chromium", [
  "--headless=new", "--single-process", "--no-zygote", "--no-sandbox",
  "--disable-dev-shm-usage", "--disable-gpu", "--disable-extensions", "--disable-plugins",
  "--hide-scrollbars", "--disable-background-networking",
  "--js-flags=--max-old-space-size=160", "--window-size=390,844",
  `--remote-debugging-port=${CDP}`, "--user-data-dir=/tmp/one-shot", "about:blank",
], { stdio: "ignore" });

for (let i = 0; i < 40; i++) {
  try { if ((await fetch(`http://127.0.0.1:${CDP}/json/version`)).ok) break; } catch {}
  await sleep(300);
}
const tgt = await (await fetch(`http://127.0.0.1:${CDP}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(tgt.webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r, j) => { ws.once("open", r); ws.once("error", j); });

let id = 0; const pend = new Map();
ws.on("message", (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id && pend.has(m.id)) { const { r, j } = pend.get(m.id); pend.delete(m.id); m.error ? j(new Error(JSON.stringify(m.error))) : r(m.result); }
});
const send = (method, params = {}) => new Promise((r, j) => { const i = ++id; pend.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params })); });

await send("Page.enable");
await send("Runtime.enable");
out(`navigate ${P}`);
await send("Page.navigate", { url: `http://127.0.0.1:${WEB}/#${P}` });
await sleep(5000);

// ── 3. DOM 探針 ──
const dom = (await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => { const t=(document.body?.innerText||"").replace(/\\s+/g," ").trim(); return {len:t.length,head:t.slice(0,150),cards:document.querySelectorAll(".iln-card,.dashboard-card,.radar-card,.content-card,[class*=card]").length,canvas:document.querySelectorAll("canvas").length,empty:t.includes("暫無")||t.includes("尚無"),loading:t.includes("載入中")}; })()`,
})).result.value;
out("DOM " + JSON.stringify(dom));

// ── 4. 截圖 ──
const lm = await send("Page.getLayoutMetrics");
const H = Math.max(844, Math.ceil(lm.cssContentSize?.height || 844));
const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: 390, height: H, scale: 1 } });
const buf = Buffer.from(shot.data, "base64");
const outDir = path.resolve(__dirname, "../../.agent-report/latest/mock-screenshots");
fs.mkdirSync(outDir, { recursive: true });
const f = path.join(outDir, `${PAGE}.png`);
fs.writeFileSync(f, buf);
out(`SHOT ${buf.length}B ${390}x${H} → ${f}`);

try { ws.close(); } catch {}
chrome.kill("SIGKILL");
srv.close();
process.exit(dom.len > 100 ? 0 : 2);
