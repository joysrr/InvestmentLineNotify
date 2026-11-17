#!/usr/bin/env node
/** 診斷：每頁印出最終 innerText 前 400 字 + 主內容可見性 + 子 tab 狀態 */
import { fork } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 5177;
process.env.FIXTURE_PORT = String(PORT);
const base = `http://127.0.0.1:${PORT}`;
const ROUTES = [
  ["chart", "/#/chart"],
  ["news", "/#/news"],
  ["account", "/#/account"],
  ["strategy-config", "/#/strategy-config"],
];

const server = fork(path.join(__dirname, "serve-fixtures.mjs"), [], { env: process.env, stdio: "ignore" });
const wait = async (t = 20000) => {
  const s = Date.now();
  while (Date.now() - s < t) { try { if ((await fetch(base + "/api/status")).ok) return true; } catch {} await new Promise((r) => setTimeout(r, 300)); }
  return false;
};

try {
  if (!(await wait())) throw new Error("server down");
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium", headless: true, timeout: 30000,
    args: ["--no-sandbox","--disable-dev-shm-usage","--disable-gpu","--js-flags=--max-old-space-size=128"],
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark", locale: "zh-TW" });

  for (const [name, route] of ROUTES) {
    const page = await ctx.newPage();
    const logs = [];
    page.on("console", (m) => logs.push(m.type() + ": " + m.text().slice(0, 200)));
    page.on("pageerror", (e) => logs.push("PAGEERR: " + String(e).slice(0, 200)));
    page.on("requestfailed", (r) => logs.push("REQFAIL: " + r.url() + " " + (r.failure()?.errorText || "")));
    const resp = [];
    page.on("response", (r) => { if (r.url().includes("/api/")) resp.push(r.status() + " " + r.url().replace(base, "")); });

    await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(4500);

    const diag = await page.evaluate(() => {
      const body = document.body.innerText || "";
      const subtabs = [...document.querySelectorAll(".sub-tab, .subtab, [class*='sub-tab'], [class*='tab-btn']")].slice(0, 12).map((e) => ({
        text: (e.textContent || "").trim().slice(0, 20),
        cls: String(e.className).slice(0, 60),
        active: /active|selected|current/.test(String(e.className)),
      }));
      const viewContainer = document.querySelector(".view-container, .iln-page, .account-view");
      const vcStyle = viewContainer ? getComputedStyle(viewContainer) : null;
      return {
        innerText: body.slice(0, 500),
        textLen: body.trim().length,
        subtabs,
        vc: vcStyle ? { display: vcStyle.display, visibility: vcStyle.visibility, opacity: vcStyle.opacity, h: viewContainer.getBoundingClientRect().height } : null,
        emptyStates: [...document.querySelectorAll(".empty-state, [class*='empty-state']")].map((e) => (e.textContent || "").trim().slice(0, 40)),
        errorEls: [...document.querySelectorAll(".error-alert, [class*='error'], [class*='Error']")].map((e) => (e.textContent || "").trim().slice(0, 80)).slice(0, 3),
      };
    });

    console.log("\n========== " + name + " ==========");
    console.log("textLen:", diag.textLen, "| vc:", JSON.stringify(diag.vc));
    console.log("subtabs:", JSON.stringify(diag.subtabs));
    console.log("empty:", JSON.stringify(diag.emptyStates), "| errors:", JSON.stringify(diag.errorEls));
    console.log("API:", JSON.stringify(resp));
    console.log("LOGS:", JSON.stringify(logs.slice(0, 8)));
    console.log("TEXT:", JSON.stringify(diag.innerText.slice(0, 300)));
    await page.close();
  }
  await browser.close();
} catch (e) { console.log("FAIL:", String(e).slice(0, 300)); }
finally { try { server.kill("SIGKILL"); } catch {} }
process.exit(0);
