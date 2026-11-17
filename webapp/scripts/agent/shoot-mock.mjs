#!/usr/bin/env node
/**
 * Mock 資料截圖：fixture server + chromium CDP 逐頁截圖
 * 為何不用 playwright：node+driver+browser 疊加記憶體爆掉（本機 available ~3GB）
 * 為何不用 chromium --screenshot：SPA 的 fetch 在 load 之後，CLI 截不到有資料的畫面
 *
 * 流程（單一 node 進程生命週期內完成）：
 *   spawn serve-fixtures.mjs → spawn chromium --remote-debugging-port → CDP 連上
 *   → 每頁 Page.navigate + 等 4s → Page.captureScreenshot(fullPage) → 寫 PNG
 *   → 殺 chromium、殺 server → 寫 manifest.json
 */
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEBAPP = path.resolve(__dirname, "../..");
const OUT = path.join(WEBAPP, ".agent-report", "latest", "mock-screenshots");
const PORT = 5175;
const CDP_PORT = 9222;
const VIEWPORT_W = 390;
const VIEWPORT_H = 844;
const SETTLE_MS = 4500;

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

async function waitHttp(url, timeoutMs = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const r = await fetch(url); if (r.ok) return true; } catch {}
    await sleep(300);
  }
  return false;
}

function makeCdp(ws) {
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(JSON.stringify(msg.error).slice(0, 300))) : res(msg.result);
    } else if (msg.method) {
      const fns = listeners.get(msg.method);
      if (fns) fns.forEach((fn) => { try { fn(msg.params); } catch {} });
    }
  });
  return {
    send: (method, params = {}) =>
      new Promise((res, rej) => {
        const i = ++id;
        pending.set(i, { res, rej });
        ws.send(JSON.stringify({ id: i, method, params }));
      }),
    on: (method, fn) => {
      if (!listeners.has(method)) listeners.set(method, []);
      listeners.get(method).push(fn);
    },
  };
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });

  // ── 1. fixture server ──
  const server = spawn(process.execPath, ["--max-old-space-size=64", "scripts/agent/serve-fixtures.mjs"], {
    cwd: WEBAPP, stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (d) => process.stdout.write("[srv] " + d.toString()));
  server.stderr.on("data", (d) => process.stderr.write("[srv!] " + d.toString()));
  if (!(await waitHttp(`http://127.0.0.1:${PORT}/api/status`))) {
    server.kill("SIGKILL");
    throw new Error("fixture server 未就緒");
  }
  console.log("[shoot] fixture server ready");

  // ── 2. chromium (CDP) ──
  const chrome = spawn("/usr/bin/chromium", [
    "--headless=new",
    "--single-process",
    "--no-zygote",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--disable-plugins",
    "--hide-scrollbars",
    "--use-gl=angle",
    "--use-angle=gl-egl",
    "--js-flags=--max-old-space-size=192",
    `--window-size=${VIEWPORT_W},${VIEWPORT_H}`,
    `--remote-debugging-port=${CDP_PORT}`,
    "--user-data-dir=/tmp/shoot-profile",
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  chrome.stderr.on("data", (d) => {
    const s = d.toString();
    if (/DevTools listening|ERROR:.*(crash|FATAL)/i.test(s)) {
      console.log("[chrome]", s.trim().split("\n")[0].slice(0, 160));
    }
  });
  if (!(await waitHttp(`http://127.0.0.1:${CDP_PORT}/json/version`))) {
    chrome.kill("SIGKILL"); server.kill("SIGKILL");
    throw new Error("CDP 未就緒");
  }
  console.log("[shoot] CDP ready");

  // ── 3. page target ──
  const newTarget = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(newTarget.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.once("open", res); ws.once("error", rej); });
  const c = makeCdp(ws);
  await c.send("Page.enable");
  await c.send("Runtime.enable");

  // ── 4. 逐頁截圖 ──
  const results = [];
  for (const r of ROUTES) {
    const url = `http://127.0.0.1:${PORT}/#${r.path}`;
    process.stdout.write(`[shoot] ${r.slug.padEnd(16)} … `);
    const t0 = Date.now();
    try {
      await c.send("Page.navigate", { url });
      await sleep(SETTLE_MS);
      const lm = await c.send("Page.getLayoutMetrics");
      const cs = lm.cssContentSize || lm.contentSize || {};
      const h = Math.max(VIEWPORT_H, Math.ceil(cs.height || VIEWPORT_H));
      // DOM 探針：確認資料真的渲染了
      let domInfo = null;
      try {
        const r = await c.send("Runtime.evaluate", { returnByValue: true, expression: `(() => {
          const txt = (document.body?.innerText || "").replace(/\\s+/g, " ").trim();
          const q = (sel) => document.querySelectorAll(sel).length;
          return {
            textLen: txt.length,
            textHead: txt.slice(0, 100),
            cards: q(".iln-card, .dashboard-card, .radar-card, .content-card, .card"),
            canvases: q("canvas"),
            empty: txt.includes("暫無") || txt.includes("尚無"),
          };
        })()` });
        domInfo = r.result?.value || null;
      } catch {}
      if (domInfo) {
        console.log(`  DOM text=${domInfo.textLen} cards=${domInfo.cards} canvas=${domInfo.canvases} empty=${domInfo.empty}`);
        console.log(`  預覽: ${JSON.stringify((domInfo.textHead||"").slice(0,90))}`);
      }
      const shot = await c.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: VIEWPORT_W, height: h, scale: 1 },
      });
      const buf = Buffer.from(shot.data, "base64");
      const file = path.join(OUT, `${r.slug}.png`);
      await fs.writeFile(file, buf);
      console.log(`✓ ${buf.length}B ${h}px ${Date.now() - t0}ms`);
      results.push({ slug: r.slug, ok: true, bytes: buf.length, height: h, file });
    } catch (e) {
      console.log(`✗ ${String(e.message).slice(0, 160)}`);
      results.push({ slug: r.slug, ok: false, error: String(e.message).slice(0, 300) });
    }
  }

  // ── 5. 收尾 ──
  try { ws.close(); } catch {}
  chrome.kill("SIGKILL");
  server.kill("SIGKILL");
  await fs.writeFile(
    path.join(OUT, "manifest.json"),
    JSON.stringify({ createdAt: new Date().toISOString(), port: PORT, viewport: { w: VIEWPORT_W, h: VIEWPORT_H }, routes: results }, null, 2),
  );
  const okN = results.filter((r) => r.ok).length;
  console.log(`\n[shoot] ${okN}/${results.length} 成功 → ${OUT}`);
  process.exit(okN === 0 ? 1 : 0);
}

main().catch((e) => { console.error("[shoot] FAIL:", e); process.exit(1); });
