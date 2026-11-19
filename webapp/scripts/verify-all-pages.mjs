// scripts/verify-all-pages.mjs
import { chromium } from "playwright";
import { spawn } from "child_process";
import { join } from "path";
import http from "http";

const MOCK_SCENARIO = process.env.MOCK_SCENARIO || "rich";

function checkUrl(url) {
  return new Promise((resolve) => {
    http
      .get(url, (res) => resolve(res.statusCode === 200))
      .on("error", () => resolve(false));
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

// 1. 解析目前工作區；頁面驗證使用前端 dev-bypass，不依賴外部 API secrets。
const WEBAPP_DIR = process.cwd();
const ROOT_DIR = join(WEBAPP_DIR, "..");

// 2. 啟動 WebApp Dev Server (固定 port 5173)
console.log("💻 啟動 WebApp Dev Server...");
const webServer = spawn(
  join(WEBAPP_DIR, "node_modules", ".bin", "vite"),
  ["--host", "127.0.0.1", "--port", "5173", "--strictPort"],
  {
    cwd: WEBAPP_DIR,
    env: { ...process.env, VITE_USE_MOCK_API: "true" },
    stdio: "ignore",
  },
);

const cleanup = () => {
  console.log("\n🧹 清理背景服務程序...");
  // Cleanup is best effort; the process may already have exited.
  try {
    webServer.kill();
  } catch (e) {
    /* intentionally ignored */
  }
};

process.on("exit", () => cleanup());
process.on("SIGINT", () => cleanup());

const webReady = await waitForServer("http://localhost:5173");

if (!webReady) {
  console.error("❌ WebApp 伺服器啟動超時！Web:", webReady);
  cleanup();
  process.exit(1);
}

console.log("✅ WebApp 就緒！開始 Playwright 掃描...\n");

const pages = [
  { path: "/#/dashboard", name: "DashboardView" },
  { path: "/#/account", name: "AccountView" },
  { path: "/#/technical", name: "TechnicalView" },
  { path: "/#/radar", name: "MarketRadarView" },
  { path: "/#/macro", name: "MacroBattleView" },
  { path: "/#/chart", name: "ChartView" },
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
        BackButton: {
          show: () => {},
          hide: () => {},
          onClick: () => {},
          offClick: () => {},
        },
      },
    };
  });

  // 使用應用內集中式 fetch mock；Playwright 僅提供 Telegram 環境，不攔截非 API 資源。
  await tab.addInitScript((scenario) => {
    window.__ILN_MOCK_SCENARIO_OVERRIDE__ = scenario;
  }, MOCK_SCENARIO);

  const consoleErrors = [];
  tab.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (!text.includes("favicon") && !text.includes("langfuse")) {
      consoleErrors.push(text.substring(0, 150));
    }
  });

  try {
    await tab.goto(
      "http://localhost:5173" +
        p.path +
        `?mock=${encodeURIComponent(MOCK_SCENARIO)}`,
      {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      },
    );
    await tab.waitForTimeout(3000);

    const metrics = await tab.evaluate(() => {
      return {
        bodyLength: document.body.innerText.length,
        hasGlobalBoundary: document.querySelector(".error-boundary") !== null,
        hasBoundaryFallback: document.querySelector(".error-fallback") !== null,
        vueMounted: document.querySelector("#app")?.children?.length > 0,
      };
    });

    const isPass =
      metrics.vueMounted &&
      !metrics.hasBoundaryFallback &&
      consoleErrors.length === 0;

    console.log(
      `${isPass ? "✅" : "❌"} ${p.name.padEnd(25)} | 內容長度: ${String(metrics.bodyLength).padStart(5)} 字 | Errors: ${consoleErrors.length}`,
    );

    if (consoleErrors.length > 0) {
      console.log(`   ❌ Console Errors (${consoleErrors.length}):`);
      for (const err of consoleErrors.slice(0, 3)) {
        console.log(`      - ${err}`);
      }
    }

    results.push({
      name: p.name,
      pass: isPass,
      errors: consoleErrors.length,
      bodyLength: metrics.bodyLength,
    });
  } catch (e) {
    console.log(
      `❌ ${p.name.padEnd(25)} | Error: ${e.message.substring(0, 80)}`,
    );
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
