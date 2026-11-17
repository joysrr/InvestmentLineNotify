#!/usr/bin/env node
/**
 * Phase 3 實際畫面驗證（Playwright + 系統 chromium）
 * - fork serve-fixtures.mjs（自帶 /api fixtures + Telegram mock）
 * - 串行打開 7 頁，截圖 + DOM 檢查
 * - 產出 .agent-report/latest/visual/{name}.png + report.json
 * 用法：node --max-old-space-size=192 scripts/agent/verify-visual.mjs [--only=dashboard]
 */
import { fork } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, ".agent-report/latest/visual");
const PORT = Number(process.env.VISUAL_PORT || 5176);
process.env.FIXTURE_PORT = String(PORT);

const ROUTES = [
  ["dashboard", "/#/dashboard"],
  ["insights-radar", "/#/insights?tab=radar"],
  ["insights-macro", "/#/insights?tab=macro"],
  ["chart", "/#/chart"],
  ["news", "/#/news"],
  ["account", "/#/account"],
  ["strategy-config", "/#/strategy-config"],
];
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const only = onlyArg ? onlyArg.split("=")[1] : null;

fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => { const s = a.join(" "); fs.appendFileSync(path.join(OUT, "run.log"), s + "\n"); console.log(s); };
fs.writeFileSync(path.join(OUT, "run.log"), "");
const base = `http://127.0.0.1:${PORT}`;

async function waitServer(timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { const r = await fetch(base + "/api/status"); if (r.ok) return true; } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

function whiteRatio(buf) {
  const png = PNG.sync.read(buf);
  let w = 0, t = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    t++; if (r > 250 && g > 250 && b > 250) w++;
  }
  return +(w / t).toFixed(4);
}

const srvLog = [];
const server = fork(path.join(__dirname, "serve-fixtures.mjs"), [], {
  env: process.env, stdio: ["ignore", "pipe", "pipe", "ipc"],
});
server.stdout.on("data", (d) => srvLog.push(String(d)));
server.stderr.on("data", (d) => srvLog.push("ERR " + String(d)));

let ok = false;
try {
  if (!(await waitServer())) throw new Error("fixture server 未就緒");
  log("[server] up on", base);

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    timeout: 30000,
    args: [
      "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
      "--disable-extensions", "--disable-background-networking",
      "--hide-scrollbars", "--js-flags=--max-old-space-size=128",
    ],
  });
  log("[browser]", await browser.version());

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    reducedMotion: "no-preference",
    locale: "zh-TW",
  });

  const results = [];
  for (const [name, route] of ROUTES) {
    if (only && name !== only) continue;
    const page = await context.newPage();
    const errors = [];
    const onConsole = (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 180)); };
    const onErr = (e) => errors.push("PAGEERROR " + String(e).slice(0, 180));
    page.on("console", onConsole);
    page.on("pageerror", onErr);

    const t0 = Date.now();
    await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2600);
    const ms = Date.now() - t0;

    const buf = await page.screenshot({ path: path.join(OUT, name + ".png") });
    const dom = await page.evaluate(() => {
      const cs = getComputedStyle(document.body);
      const cards = [...document.querySelectorAll(".iln-card, .content-card, .card, .snapshot-card, .settings-group, .section")];
      const sample = cards.slice(0, 6).map((c) => {
        const s = getComputedStyle(c);
        return { cls: String(c.className).slice(0, 50), br: s.borderRadius, pad: s.padding, bg: s.backgroundColor };
      });
      const h = document.querySelector("h1, .iln-title, .page-title, .view-title, h2");
      const iconDefault = document.querySelectorAll(".icon-default").length;
      const iconSvg = document.querySelectorAll("svg.icon, .icon svg, svg").length;
      const errorBoundary = document.querySelectorAll("[class*=error-boundary], [class*=ErrorBoundary]").length;
      const errorText = (document.body.innerText || "").includes("頁面載入失敗");
      const emptyish = document.querySelectorAll('.empty-state, .iln-empty, [class*="empty-state"], [class*="emptyState"]').length;
      const buttons = [...document.querySelectorAll("button")].slice(0, 8).map((b) => {
        const s = getComputedStyle(b);
        return { br: s.borderRadius, h: Math.round(b.getBoundingClientRect().height) };
      });
      let hasRM = false, hasFV = false, tgUsers = 0, hexInInline = 0;
      for (const ss of document.styleSheets) {
        try {
          for (const r of ss.cssRules) {
            const t = r.cssText || "";
            if (t.includes("prefers-reduced-motion")) hasRM = true;
            if (t.includes(":focus-visible")) hasFV = true;
            if (t.includes("--tg-theme")) tgUsers++;
          }
        } catch { /* ignore */ }
      }
      // 行內 style 硬編碼 hex 粗檢
      for (const el of document.querySelectorAll("[style]")) {
        if (/#[0-9a-fA-F]{3,8}\b/.test(el.getAttribute("style") || "")) hexInInline++;
      }
      return {
        tgScheme: document.documentElement.dataset.tgScheme || null,
        bodyBg: cs.backgroundColor, bodyColor: cs.color,
        fontFamily: cs.fontFamily.slice(0, 50),
        title: h ? { text: (h.textContent || "").trim().slice(0, 30), size: getComputedStyle(h).fontSize, weight: getComputedStyle(h).fontWeight } : null,
        cardCount: cards.length, cardSample: sample,
        iconDefault, iconSvg, emptyish, errorBoundary, errorText, buttons,
        hasRM, hasFV, tgUsers, hexInInline,
        textLen: (document.body.innerText || "").trim().length,
        scrollH: document.documentElement.scrollHeight,
      };
    });
    page.off("console", onConsole);
    page.off("pageerror", onErr);
    await page.close();

    const r = { name, route, ms, white: whiteRatio(buf), errors, ...dom };
    results.push(r);
    log(`[${name}] ${ms}ms white=${r.white} tg=${r.tgScheme} bg=${r.bodyBg} cards=${r.cardCount} icons=${r.iconSvg} empty=${r.emptyish} text=${r.textLen} h=${r.scrollH} err=${r.errors.length}`);
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(results, null, 2));
  ok = true;
} catch (e) {
  log("FAIL:", String(e).slice(0, 400));
  fs.appendFileSync(path.join(OUT, "run.log"), "\nSERVER LOG:\n" + srvLog.join("").slice(-2000) + "\n");
} finally {
  try { server.kill("SIGKILL"); } catch { /* ignore */ }
}
process.exit(ok ? 0 : 1);
