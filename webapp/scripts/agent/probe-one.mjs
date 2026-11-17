#!/usr/bin/env node
// 最小探针：只 1 页、不截图、立刻 flush
import { spawn } from "node:child_process";
import WebSocket from "ws";

const PAGE = process.argv[2] || "dashboard";
const PATH_MAP = {
  dashboard: "/dashboard", radar: "/insights?tab=radar", macro: "/insights?tab=macro",
  chart: "/chart", news: "/news", account: "/account", config: "/strategy-config",
};
const P = PATH_MAP[PAGE] || "/dashboard";
const out = (s) => process.stdout.write(s + "\n");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitHttp(url, t = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < t) { try { if ((await fetch(url)).ok) return true; } catch {} await sleep(300); }
  return false;
}

const server = spawn(process.execPath, ["--max-old-space-size=48", "scripts/agent/serve-fixtures.mjs"],
  { cwd: process.cwd(), stdio: "ignore" });
if (!(await waitHttp("http://127.0.0.1:5175/api/status"))) { out("FAIL server"); server.kill("SIGKILL"); process.exit(1); }
out("server ok");

const chrome = spawn("/usr/bin/chromium", [
  "--headless=new", "--single-process", "--no-zygote",
  "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
  "--disable-extensions", "--disable-plugins", "--hide-scrollbars",
  "--js-flags=--max-old-space-size=160",
  "--window-size=390,844", "--remote-debugging-port=9222",
  "--user-data-dir=/tmp/one-profile", "about:blank",
], { stdio: "ignore" });
if (!(await waitHttp("http://127.0.0.1:9222/json/version"))) { out("FAIL cdp"); chrome.kill("SIGKILL"); server.kill("SIGKILL"); process.exit(1); }
out("cdp ok");

const t = await (await fetch("http://127.0.0.1:9222/json/new?about:blank", { method: "PUT" })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((res, rej) => { ws.once("open", res); ws.once("error", rej); });

let id = 0; const pend = new Map();
ws.on("message", (raw) => {
  let m; try { m = JSON.parse(raw.toString()); } catch { return; }
  if (m.id && pend.has(m.id)) { const { res, rej } = pend.get(m.id); pend.delete(m.id); m.error ? rej(new Error("cdp")) : res(m.result); }
});
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });

await send("Page.enable");
await send("Runtime.enable");
out(`navigating ${P} …`);
await send("Page.navigate", { url: `http://127.0.0.1:5175/#${P}` });
await sleep(6000);

const expr = `(() => {
  const t = (document.body?.innerText || "").replace(/\\s+/g, " ").trim();
  return {
    len: t.length,
    head: t.slice(0, 200),
    tail: t.slice(-120),
    cards: document.querySelectorAll(".iln-card,.dashboard-card,.radar-card,.content-card,.card,[class*=card]").length,
    canvas: document.querySelectorAll("canvas").length,
    skel: document.querySelectorAll('[class*="skeleton"],[class*="sk-"]').length,
    empty: t.includes("暫無") || t.includes("尚無"),
    loading: t.includes("載入中"),
    err: t.includes("載入失敗") || t.includes("錯誤"),
  };
})()`;

try {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  const v = r.result.value || {};
  out("=== RESULT ===");
  out(JSON.stringify(v, null, 2));
} catch (e) {
  out("EVAL_FAIL " + e.message);
}

try { ws.close(); } catch {}
chrome.kill("SIGKILL");
server.kill("SIGKILL");
process.exit(0);
