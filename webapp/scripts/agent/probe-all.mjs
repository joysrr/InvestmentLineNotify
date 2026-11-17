
import { chromium } from "playwright";
import fs from "node:fs";

const OUT = "/tmp/probe-result.jsonl";
const CHROME = "/usr/bin/chromium";
const PORT = Number(process.env.PROBE_PORT || 5175);
const PAGES = [
  ["dashboard", "dashboard"],
  ["insights-radar", "insights?tab=radar"],
  ["insights-macro", "insights?tab=macro"],
  ["chart", "chart"],
  ["news", "news"],
  ["account", "account"],
  ["strategy-config", "strategy-config"],
];

function log(o){ fs.appendFileSync(OUT, JSON.stringify(o)+"\n"); }

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox","--disable-dev-shm-usage","--disable-gpu","--single-process","--no-zygote","--js-flags=--max-old-space-size=128"],
});

for (const [name, path] of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + String(e.message).slice(0, 120)));
  page.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 120)); });
  const url = `http://127.0.0.1:${PORT}/#/${path}`;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2500);
    const data = await page.evaluate(() => {
      const q = s => Array.from(document.querySelectorAll(s));
      const txt = el => (el?.innerText || "").trim().replace(/\s+/g, " ").slice(0, 80);
      const cs = el => el ? getComputedStyle(el) : null;
      const app = document.querySelector("#app");
      const pageEl = document.querySelector(".iln-page") || app;
      const cards = q(".iln-card, .content-card, .card, [class*=\"-card\"]");
      const cardBg = cards[0] ? getComputedStyle(cards[0]).backgroundColor : null;
      const cardRadius = cards[0] ? getComputedStyle(cards[0]).borderRadius : null;
      const h1 = document.querySelector("h1, .page-title, .iln-page-title");
      const h1cs = h1 ? getComputedStyle(h1) : null;
      // 溢出检查
      const overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
      // 空态
      const empty = !!document.querySelector(".empty-state, .empty, [class*=\"empty\"]");
      // 图标
      const svgs = q("svg").length;
      const iconDefault = q(".icon-default").length;
      const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test((app?.innerText||"").slice(0,2000));
      return {
        title: document.title,
        dataTgScheme: document.documentElement.dataset.tgScheme || null,
        bodyBg: getComputedStyle(document.body).backgroundColor,
        appBg: app ? getComputedStyle(app).backgroundColor : null,
        pageBg: pageEl ? getComputedStyle(pageEl).backgroundColor : null,
        bodyLen: (app?.innerHTML || "").length,
        cards: cards.length,
        cardBg, cardRadius,
        h1: h1 ? { text: txt(h1), size: h1cs.fontSize, weight: h1cs.fontWeight, color: h1cs.color } : null,
        pageText: txt(pageEl),
        svgIcons: svgs,
        iconDefault,
        hasEmoji: emoji,
        isEmptyState: empty,
        horizOverflow: overflow,
        scrollW: document.documentElement.scrollWidth,
        winW: window.innerWidth,
      };
    });
    log({ name, path, url, ok: true, errs, ...data });
    console.log(`[${name}] ok cards=${data.cards} svg=${data.svgIcons} default=${data.iconDefault} bg=${data.bodyBg} scheme=${data.dataTgScheme} overflow=${data.horizOverflow} errs=${errs.length}`);
  } catch (e) {
    log({ name, path, url, ok: false, error: String(e.message).slice(0,200), errs });
    console.log(`[${name}] FAIL ${e.message}`);
  } finally {
    await ctx.close();
  }
}
await browser.close();
console.log("DONE");
