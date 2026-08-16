// scripts/verify-all-pages.mjs
import { chromium } from "playwright";
import { spawn } from "child_process";
import http from "http";

function checkUrl(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => resolve(res.statusCode === 200)).on("error", () => resolve(false));
  });
}

async function waitForServer(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkUrl(url)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

console.log("================================================");
console.log("🧪 Playwright 全頁面 100% 完整功能驗證");
console.log("================================================\n");

// 1. 啟動 API Server (注入 BYPASS_INIT_DATA=true)
console.log("📡 啟動 API Server (BYPASS_INIT_DATA=true)...");
const apiServer = spawn("node", ["src/api/server.mjs"], {
  cwd: "/workspace/projects/InvestmentLineNotify",
  env: { ...process.env, NODE_ENV: "development", BYPASS_INIT_DATA: "true" },
  stdio: "ignore",
});

// 2. 啟動 WebApp Dev Server (固定 port 5173)
console.log("💻 啟動 WebApp Dev Server...");
const webServer = spawn("npx", ["vite", "--port", "5173", "--strictPort"], {
  cwd: "/workspace/projects/InvestmentLineNotify/webapp",
  env: { ...process.env },
  stdio: "ignore",
});

const cleanup = () => {
  console.log("\n🧹 清理背景服務程序...");
  try { apiServer.kill(); } catch (e) {}
  try { webServer.kill(); } catch (e) {}
};

process.on("exit", () => cleanup());
process.on("SIGINT", () => cleanup());

const apiReady = await waitForServer("http://localhost:3000/health");
const webReady = await waitForServer("http://localhost:5173");

if (!apiReady || !webReady) {
  console.error("❌ 伺服器啟動超時！API:", apiReady, "Web:", webReady);
  cleanup();
  process.exit(1);
}

console.log("✅ 伺服器就緒！開始 Playwright 掃描...\n");

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

const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  headless: true,
});

const results = [];

for (const p of pages) {
  const tab = await browser.newPage();

  // 核心：全面繞過 & Mock Telegram 環境 + 全域 Header
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
        hasGlobalBoundary: document.querySelector(".error-boundary") !== null,
        hasBoundaryFallback: document.querySelector(".error-fallback") !== null,
        vueMounted: document.querySelector("#app")?.children?.length > 0,
      };
    });

    const isPass = metrics.vueMounted && !metrics.hasBoundaryFallback && consoleErrors.length === 0;

    console.log(
      `${isPass ? "✅" : "❌"} ${p.name.padEnd(25)} | 內容長度: ${String(metrics.bodyLength).padStart(5)} 字 | Errors: ${consoleErrors.length}`
    );

    if (consoleErrors.length > 0) {
      console.log(`   ❌ Console Errors (${consoleErrors.length}):`);
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
cleanup();

console.log("\n================================================");
console.log("📊 全面驗證結果總結");
console.log("================================================");

const passedCount = results.filter((r) => r.pass).length;
console.log(`\n總頁面數: ${pages.length}`);
console.log(`✅ 完全通過 (0 Error + Vue 渲染完備): ${passedCount}`);
console.log(`❌ 未通過: ${pages.length - passedCount}\n`);

process.exit(passedCount === pages.length ? 0 : 1);
