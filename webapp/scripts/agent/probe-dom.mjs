#!/usr/bin/env node
// DOM 驗證：不截圖，只讀頁面真實內容。所有輸出寫文件（PRoot stdout 塊緩衝會丟資料）
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { fixtureFor } from "./lib/fixtures.mjs";
import WebSocket from "ws";

const LOG = "/tmp/probe-dom.log";
try { fs.unlinkSync(LOG); } catch {}
const log = (s) => { fs.appendFileSync(LOG, s + "\n"); };   // 同步寫，必落盤

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "../../dist");
const WEB = 5177, CDP = 9224;
const PAGES = [
  ["dashboard", "/dashboard"],
  ["insights-radar", "/insights?tab=radar"],
  ["insights-macro", "/insights?tab=macro"],
  ["chart", "/chart"],
  ["news", "/news"],
  ["account", "/account"],
  ["strategy-config", "/strategy-config"],
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

log(`[start] ${new Date().toISOString()}`);

// ── http server（內嵌，同進程）──
const MOCK = '<script>window.__PLAYWRIGHT__=true;window.Telegram={WebApp:{initData:"x",initDataUnsafe:{user:{id:1}},ready:()=>{},expand:()=>{},close:()=>{},BackButton:{show:()=>{},hide:()=>{},onClick:()=>{},offClick:()=>{}},MainButton:{setParams:()=>{},show:()=>{},hide:()=>{},enable:()=>{},disable:()=>{}},HapticFeedback:{impactOccurred:()=>{},notificationOccurred:()=>{},selectionChanged:()=>{}},themeParams:{bg_color:"#FEF7FF",text_color:"#1D1B20",hint_color:"#79747E",link_color:"#6750A4",button_color:"#6750A4",button_text_color:"#FFFFFF",secondary_bg_color:"#F7F2FA"},viewportHeight:844,viewportStableHeight:844,headerColor:"#FEF7FF",backgroundColor:"#FEF7FF",isExpanded:true,colorScheme:"light",version:"7.0",platform:"ios",setHeaderColor:()=>{},setBackgroundColor:()=>{},isVersionAtLeast:()=>true}};</script>';
const MIME = { ".html":"text/html; charset=utf-8", ".js":"application/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml" };
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
log(`[server] http://127.0.0.1:${WEB}`);

// ── chromium ──
const chrome = spawn("/usr/bin/chromium", [
  "--headless=new", "--single-process", "--no-zygote", "--no-sandbox",
  "--disable-dev-shm-usage", "--disable-gpu", "--disable-extensions", "--disable-plugins",
  "--hide-scrollbars", "--disable-background-networking",
  "--js-flags=--max-old-space-size=160", "--window-size=390,844",
  `--remote-debugging-port=${CDP}`, "--user-data-dir=/tmp/probe-dom-profile", "about:blank",
], { stdio: "ignore" });
log(`[chromium] pid=${chrome.pid}`);

let ready = false;
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`http://127.0.0.1:${CDP}/json/version`)).ok) { ready = true; break; } } catch {}
  await sleep(500);
}
if (!ready) { log("[FAIL] CDP 未就緒"); chrome.kill("SIGKILL"); srv.close(); process.exit(1); }
log("[cdp] ready");

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

const EXPR = `(() => {
  const t = (document.body?.innerText || "").replace(/\\s+/g," ").trim();
  return {
    len: t.length,
    head: t.slice(0, 160),
    cards: document.querySelectorAll("[class*=card],[class*=Card]").length,
    canvas: document.querySelectorAll("canvas").length,
    skel: document.querySelectorAll('[class*="skeleton"],[class*="sk-"]').length,
    empty: t.includes("暫無") || t.includes("尚無") || t.includes("沒有資料"),
    loading: t.includes("載入中"),
    err: t.includes("載入失敗"),
  };
})()`;

log("");
log("page".padEnd(18) + "textLen  cards  canvas  skel  flags");
log("-".repeat(75));
for (const [slug, p] of PAGES) {
  try {
    await send("Page.navigate", { url: `http://127.0.0.1:${WEB}/#${p}` });
    await sleep(5000);
    const r = await send("Runtime.evaluate", { expression: EXPR, returnByValue: true });
    const v = r.result.value || {};
    const flags = [v.empty ? "空狀態" : "", v.loading ? "載入中" : "", v.err ? "錯誤" : ""].filter(Boolean).join(",") || "—";
    log(slug.padEnd(18) + String(v.len ?? "?").padStart(7) + String(v.cards ?? "?").padStart(7) + String(v.canvas ?? "?").padStart(8) + String(v.skel ?? "?").padStart(6) + "  " + flags);
    log("   head: " + JSON.stringify((v.head || "").slice(0, 110)));
  } catch (e) {
    log(slug.padEnd(18) + "✗ " + String(e.message).slice(0, 100));
  }
}
log("");
log("[done] " + new Date().toISOString());

try { ws.close(); } catch {}
chrome.kill("SIGKILL");
srv.close();
process.exit(0);
