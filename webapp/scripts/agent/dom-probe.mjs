#!/usr/bin/env node
/**
 * DOM 探針：不截圖，只 Runtime.evaluate 拿頁面真實內容
 * 判據：innerText 長度、卡片數、骨架屏數、canvas 數、空狀態關鍵詞
 * 記憶體極低（無截圖 buffer），比像素統計精確
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEBAPP = path.resolve(__dirname, "../..");
const PORT = 5175, CDP_PORT = 9222;
const ROUTES = [
  { slug: "dashboard",       path: "/dashboard" },
  { slug: "insights-radar",  path: "/insights?tab=radar" },
  { slug: "insights-macro",  path: "/insights?tab=macro" },
  { slug: "chart",           path: "/chart" },
  { slug: "news",            path: "/news" },
  { slug: "account",         path: "/account" },
  { slug: "strategy-config", path: "/strategy-config" },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitHttp(url, t = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < t) { try { const r = await fetch(url); if (r.ok) return true; } catch {} await sleep(300); }
  return false;
}
function makeCdp(ws) {
  let id = 0; const pending = new Map();
  ws.on("message", (raw) => {
    let m; try { m = JSON.parse(raw.toString()); } catch { return; }
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error).slice(0,200))) : res(m.result); }
  });
  return { send: (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); }) };
}

async function main() {
  const server = spawn(process.execPath, ["--max-old-space-size=64", "scripts/agent/serve-fixtures.mjs"], { cwd: WEBAPP, stdio: ["ignore", "ignore", "ignore"] });
  if (!(await waitHttp(`http://127.0.0.1:${PORT}/api/status`))) { server.kill("SIGKILL"); throw new Error("server 未就緒"); }
  const chrome = spawn("/usr/bin/chromium", [
    "--headless=new", "--single-process", "--no-zygote",
    "--no-sandbox", "--disable-dev-shm-usage", "--disable-extensions", "--disable-plugins",
    "--use-gl=angle", "--use-angle=gl-egl",
    "--js-flags=--max-old-space-size=192",
    `--window-size=390,844`, `--remote-debugging-port=${CDP_PORT}`,
    "--user-data-dir=/tmp/probe-profile", "about:blank",
  ], { stdio: ["ignore", "ignore", "ignore"] });
  if (!(await waitHttp(`http://127.0.0.1:${CDP_PORT}/json/version`))) { chrome.kill("SIGKILL"); server.kill("SIGKILL"); throw new Error("CDP 未就緒"); }
  const t = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.once("open", res); ws.once("error", rej); });
  const c = makeCdp(ws);
  await c.send("Page.enable"); await c.send("Runtime.enable");

  const EXPR = `(() => {
    const txt = (document.body?.innerText || "").replace(/\\s+/g," ").trim();
    const q = (s) => document.querySelectorAll(s).length;
    const has = (s) => txt.includes(s);
    return {
      textLen: txt.length,
      textHead: txt.slice(0, 120),
      cards: q(".iln-card, .dashboard-card, .radar-card, .content-card, .card"),
      skeletons: q('[class*="skeleton"], [class*="sk-"]'),
      canvases: q("canvas"),
      emptyState: has("暫無資料") || has("暫無") || has("尚無") || has("沒有資料"),
      loadingText: has("載入中") || has("loading") || has("Loading"),
      errorText: has("載入失敗") || has("錯誤") || has("Error"),
    };
  })()`;

  console.log("page".padEnd(18) + "textLen  cards  skel  canvas  旗標");
  console.log("-".repeat(78));
  for (const r of ROUTES) {
    await c.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/#${r.path}` });
    await sleep(4500);
    try {
      const { result } = await c.send("Runtime.evaluate", { expression: EXPR, returnByValue: true });
      const v = result.value || {};
      const flags = [
        v.emptyState ? "空狀態" : "",
        v.loadingText ? "載入中" : "",
        v.errorText ? "錯誤" : "",
      ].filter(Boolean).join(",") || "—";
      console.log(
        r.slug.padEnd(18) +
        String(v.textLen ?? "?").padStart(7) +
        String(v.cards ?? "?").padStart(7) +
        String(v.skeletons ?? "?").padStart(6) +
        String(v.canvases ?? "?").padStart(8) + "  " + flags
      );
      console.log("   預覽: " + JSON.stringify((v.textHead || "").slice(0, 100)));
    } catch (e) {
      console.log(r.slug.padEnd(18) + "  ✗ " + String(e.message).slice(0, 120));
    }
  }
  try { ws.close(); } catch {}
  chrome.kill("SIGKILL"); server.kill("SIGKILL");
  process.exit(0);
}
main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
