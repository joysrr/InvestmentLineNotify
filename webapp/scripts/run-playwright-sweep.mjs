// scripts/run-playwright-sweep.mjs
import { chromium } from "playwright";

const pages = [
  { path: "/#/dashboard", name: "DashboardView" },
  { path: "/#/simulator", name: "SimulatorView" },
  { path: "/#/backtest-report", name: "BacktestReportView" },
  { path: "/#/account", name: "AccountView" },
  { path: "/#/technical", name: "TechnicalView" },
  { path: "/#/radar", name: "MarketRadarView" },
  { path: "/#/macro", name: "MacroBattleView" },
  { path: "/#/chart", name: "ChartView" },
  { path: "/#/reports", name: "ReportsView" },
  { path: "/#/news", name: "NewsView" },
  { path: "/#/strategy", name: "StrategyView" },
  { path: "/#/strategy-config", name: "StrategyConfigEditorView" },
];

console.log("================================================");
console.log("🧪 100% 全面繞過解鎖 Playwright 全頁面掃描");
console.log("================================================\n");

const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  headless: true,
});

const results = [];

for (const p of pages) {
  const tab = await browser.newPage();

  // 注入 initData "dev-bypass" & __PLAYWRIGHT__ 標記
  await tab.addInitScript(() => {
    window.__PLAYWRIGHT__ = true;
    window.Telegram = {
      WebApp: {
        initData: "dev-bypass",
        ready: () => {},
        expand: () => {},
        close: () => {},
        BackButton: { show: () => {}, hide: () => {}, onClick: () => {}, offClick: () => {} },
      },
    };
  });

  const consoleErrors = [];
  tab.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!text.includes("favicon") && !text.includes("langfuse")) {
        consoleErrors.push(text.substring(0, 150));
      }
    }
  });

  try {
    await tab.goto("http://localhost:5173" + p.path, { waitUntil: "domcontentloaded", timeout: 15000 });
    await tab.waitForTimeout(3000);

    const metrics = await tab.evaluate(() => {
      return {
        bodyLength: document.body.innerText.length,
        hasBoundaryFallback: document.querySelector(".error-fallback") !== null,
        vueMounted: document.querySelector("#app")?.children?.length > 0,
      };
    });

    const isPass = metrics.vueMounted && !metrics.hasBoundaryFallback && consoleErrors.length === 0;

    console.log(
      `${isPass ? "✅" : "❌"} ${p.name.padEnd(25)} | 內容長度: ${String(metrics.bodyLength).padStart(5)} 字 | Console Errors: ${consoleErrors.length}`
    );

    if (consoleErrors.length > 0) {
      for (const err of consoleErrors.slice(0, 3)) {
        console.log(`      - ${err}`);
      }
    }

    results.push({ name: p.name, pass: isPass, errors: consoleErrors.length, bodyLength: metrics.bodyLength });
  } catch (e) {
    console.log(`❌ ${p.name.padEnd(25)} | Error: ${e.message.substring(0, 80)}`);
    results.push({ name: p.name, pass: false, error: e.message });
  } finally {
    await tab.close();
  }
}

await browser.close();

console.log("\n================================================");
console.log("📊 全面驗證結果總結");
console.log("================================================");

const passedCount = results.filter((r) => r.pass).length;
console.log(`\n總頁面數: ${pages.length}`);
console.log(`✅ 完全通過 (0 Error + Vue 渲染完備): ${passedCount}`);
console.log(`❌ 未通過: ${pages.length - passedCount}\n`);

process.exit(passedCount === pages.length ? 0 : 1);
