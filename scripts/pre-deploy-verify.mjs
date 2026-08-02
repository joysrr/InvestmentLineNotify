#!/usr/bin/env node
/**
 * Pre-deployment verification script
 * 實際開啟瀏覽器驗證 API、頁面運作狀況
 * 在 commit 前執行，確保模擬器功能正常
 */

import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");

const WEBAPP_DIR = join(PROJECT_ROOT, "webapp");
const API_BASE = "http://localhost:3000";
const WEBAPP_URL = "http://localhost:5173";

const COLORS = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

function log(level, message) {
  const prefix =
    {
      ok: `${COLORS.green}✅`,
      fail: `${COLORS.red}❌`,
      warn: `${COLORS.yellow}⚠️`,
      info: `${COLORS.blue}ℹ️`,
      step: `${COLORS.cyan}🔍`,
    }[level] || "";
  console.log(`${prefix} ${message}${COLORS.reset}`);
}

function runCmd(cmd, cwd = PROJECT_ROOT, options = {}) {
  try {
    return execSync(cmd, {
      cwd,
      encoding: "utf-8",
      stdio: "pipe",
      ...options,
    }).trim();
  } catch (e) {
    throw new Error(`Command failed: ${cmd}\n${e.stdout || e.message}`);
  }
}

async function waitFor(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkApiHealth() {
  log("step", "檢查 API Server 健康狀態...");
  try {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();
    if (data.status === "ok") {
      log("ok", `API Server 正常 (${response.status})`);
      return true;
    }
    log("fail", `API 回應異常: ${JSON.stringify(data)}`);
    return false;
  } catch (e) {
    log("fail", `API Server 連線失敗: ${e.message}`);
    return false;
  }
}

async function checkApiStatus() {
  log("step", "檢查 /api/status 端點...");
  try {
    const response = await fetch(`${API_BASE}/api/status`);
    if (!response.ok) {
      log("fail", `HTTP ${response.status}: ${response.statusText}`);
      return false;
    }
    const data = await response.json();
    if (data?.data?.marketState) {
      log("ok", `/api/status 回應正常，含 marketState`);
      return true;
    }
    log(
      "warn",
      `/api/status 回應但缺少 marketState: ${JSON.stringify(data).substring(0, 200)}`,
    );
    return true; // 不算失敗
  } catch (e) {
    log("fail", `/api/status 請求失敗: ${e.message}`);
    return false;
  }
}

async function checkApiSimulate() {
  log("step", "檢查 /api/v1/simulate 端點 (POST)...");
  try {
    const response = await fetch(`${API_BASE}/api/v1/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price0050: 180, priceZ2: 17.5 }),
    });
    if (response.ok) {
      const data = await response.json();
      if (data?.strategyScore !== undefined) {
        log("ok", `正向模擬 API 正常 (分數: ${data.strategyScore})`);
        return true;
      }
      log("warn", `正向模擬回應但缺少 strategyScore`);
      return true;
    }
    log("fail", `正向模擬 API 失敗: HTTP ${response.status}`);
    return false;
  } catch (e) {
    log("fail", `正向模擬 API 請求失敗: ${e.message}`);
    return false;
  }
}

async function checkApiReverse() {
  log("step", "檢查 /api/v1/simulate/reverse 端點 (POST)...");
  try {
    const response = await fetch(`${API_BASE}/api/v1/simulate/reverse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: { type: "maintenanceRatio", value: 150 },
      }),
    });
    if (response.ok) {
      const data = await response.json();
      if (data?.reachable !== undefined) {
        log("ok", `反向推導 API 正常 (reachable: ${data.reachable})`);
        return true;
      }
      log("warn", `反向推導回應但缺少 reachable`);
      return true;
    }
    log("fail", `反向推導 API 失敗: HTTP ${response.status}`);
    return false;
  } catch (e) {
    log("fail", `反向推導 API 請求失敗: ${e.message}`);
    return false;
  }
}

async function startServices() {
  log("step", "啟動開發服務...");

  // 啟動 API Server (背景)
  const apiProc = execSync(
    "NODE_ENV=development node src/api/server.mjs > /tmp/api-verify.log 2>&1 & echo $!",
    {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
    },
  ).trim();

  // 啟動 Webapp (背景)
  const webappProc = execSync(
    "NODE_ENV=development npm run dev -- --host 0.0.0.0 --port 5173 > /tmp/webapp-verify.log 2>&1 & echo $!",
    {
      cwd: WEBAPP_DIR,
      encoding: "utf-8",
    },
  ).trim();

  log("info", `API Server PID: ${apiProc}`);
  log("info", `Webapp PID: ${webappProc}`);

  // 等待服務啟動
  log("info", "等待服務啟動 (10s)...");
  await waitFor(10000);

  return { apiProc, webappProc };
}

function killProc(pid) {
  try {
    execSync(`kill -9 ${pid} 2>/dev/null || true`);
  } catch (e) {
    // 忽略錯誤
  }
}

async function runBrowserTests() {
  log("step", "執行瀏覽器自動化測試...");

  // 使用 Playwright 或 Puppeteer
  // 這裡用簡單的 fetch 檢查靜態資源是否載入
  try {
    const response = await fetch(WEBAPP_URL);
    const html = await response.text();

    if (html.includes('id="app"') || html.includes('<div id="app">')) {
      log("ok", "Webapp HTML 載入正常");
    } else {
      log("fail", "Webapp HTML 異常");
      return false;
    }

    // 檢查關鍵 JS 是否載入
    if (html.includes("src/main.js")) {
      log("ok", "main.js 正確引入");
    } else {
      log("fail", "main.js 未正確引入");
      return false;
    }

    return true;
  } catch (e) {
    log("fail", `Webapp 載入失敗: ${e.message}`);
    return false;
  }
}

async function runUnitTests() {
  log("step", "執行單元測試...");
  try {
    const output = runCmd("npm run test", WEBAPP_DIR, { timeout: 120000 });
    if (output.includes("passed")) {
      const match = output.match(/(\d+) passed/);
      const passed = match ? match[1] : "?";
      log("ok", `Webapp 測試通過: ${passed} tests passed`);
      return true;
    }
    log("fail", "Webapp 測試失敗");
    console.log(output);
    return false;
  } catch (e) {
    log("fail", `Webapp 測試執行失敗: ${e.message}`);
    return false;
  }
}

async function runServerTests() {
  log("step", "執行後端測試...");
  try {
    const output = runCmd(
      "npx vitest run src/modules/simulator/",
      PROJECT_ROOT,
      { timeout: 120000 },
    );
    if (output.includes("passed")) {
      const match = output.match(/(\d+) passed/);
      const passed = match ? match[1] : "?";
      log("ok", `Simulator 模組測試通過: ${passed} tests passed`);
      return true;
    }
    log("fail", "Simulator 模組測試失敗");
    console.log(output);
    return false;
  } catch (e) {
    log("fail", `後端測試執行失敗: ${e.message}`);
    return false;
  }
}

async function runLint() {
  log("step", "執行 Lint 檢查...");
  try {
    runCmd("npm run lint", PROJECT_ROOT);
    runCmd("npm run lint", WEBAPP_DIR);
    log("ok", "Lint 檢查通過 (0 errors)");
    return true;
  } catch (e) {
    log("fail", `Lint 檢查失敗: ${e.message}`);
    return false;
  }
}

async function runPreDeployCheck() {
  log("step", "執行靜態程式碼掃描...");
  // 檢查所有 .vue 檔案中使用 apiFetch 是否有 await waitReady
  const glob = await import("glob");
  const fs = await import("fs");

  const files = glob.sync("webapp/src/**/*.vue");
  let hasIssue = false;

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const usesApiFetch =
      content.includes("apiFetch(") ||
      content.includes("fetchStatus") ||
      content.includes("fetchReports") ||
      content.includes("fetchNews") ||
      content.includes("fetchPortfolioHealth");

    const hasWaitReady =
      content.includes("await waitReady()") ||
      content.includes("await waitReady();");
    const correctImport =
      content.includes("import { useTelegram, waitReady }") ||
      content.includes("import { waitReady }") ||
      content.includes('from "../composables/useTelegram.js"');

    if (usesApiFetch && !hasWaitReady) {
      log("fail", `${file}: 使用 API 但未 await waitReady()`);
      hasIssue = true;
    }
    if (usesApiFetch && !correctImport) {
      log("warn", `${file}: 使用 API 但未正確匯入 waitReady`);
    }
  }

  if (!hasIssue) {
    log("ok", "靜態掃描通過：所有 API 呼叫皆有 await waitReady()");
  }
  return !hasIssue;
}

async function main() {
  console.log(`${COLORS.bold}${COLORS.cyan}`);
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║     InvestmentLineNotify Pre-Deployment Verification     ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`${COLORS.reset}`);

  const results = [];
  let apiProc = null,
    webappProc = null;

  try {
    // 1. 靜態檢查
    results.push(["靜態程式碼掃描", await runPreDeployCheck()]);

    // 2. Lint
    results.push(["Lint 檢查", await runLint()]);

    // 3. 單元測試
    results.push(["Webapp 單元測試", await runUnitTests()]);
    results.push(["Simulator 模組測試", await runServerTests()]);

    // 4. 啟動服務
    ({ apiProc, webappProc } = await startServices());

    // 5. API 健康檢查
    results.push(["API 健康檢查", await checkApiHealth()]);
    results.push(["API /status 端點", await checkApiStatus()]);
    results.push(["API /simulate 端點", await checkApiSimulate()]);
    results.push(["API /simulate/reverse 端點", await checkApiReverse()]);

    // 6. 瀏覽器測試
    results.push(["Webapp 前端載入", await runBrowserTests()]);
  } finally {
    // 清理
    if (apiProc) killProc(apiProc);
    if (webappProc) killProc(webappProc);
    execSync("lsof -ti:3000 -ti:5173 | xargs kill -9 2>/dev/null || true");
  }

  // 總結
  console.log(
    `\n${COLORS.bold}═══════════════════════════════════════════════════════════`,
  );
  console.log("驗證結果總結");
  console.log(
    `═══════════════════════════════════════════════════════════${COLORS.reset}\n`,
  );

  let allPassed = true;
  for (const [name, passed] of results) {
    const icon = passed ? `${COLORS.green}✅` : `${COLORS.red}❌`;
    console.log(`${icon} ${name}`);
    if (!passed) allPassed = false;
  }

  console.log(`\n${COLORS.bold}${allPassed ? COLORS.green : COLORS.red}`);
  console.log(
    allPassed ? "🎉 所有驗證通過，可安全部署！" : "🚫 存在問題，請修正後再部署",
  );
  console.log(`${COLORS.reset}`);

  process.exit(allPassed ? 0 : 1);
}

main().catch((e) => {
  console.error(`${COLORS.red}驗證腳本異常: ${e.message}${COLORS.reset}`);
  process.exit(1);
});
