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

async function runBrowserTests() {
  log("step", "執行 Playwright E2E 測試...");

  try {
    // 在 webapp 目錄下執行 playwright test
    const output = runCmd("npm run test:e2e", WEBAPP_DIR, { timeout: 180000 });
    if (output.includes("passed")) {
      const match = output.match(/(\d+) passed/);
      const passed = match ? match[1] : "?";
      log("ok", `E2E 測試通過: ${passed} tests passed`);
      return true;
    }
    log("fail", "E2E 測試失敗");
    console.log(output);
    return false;
  } catch (e) {
    log("fail", `E2E 測試執行失敗: ${e.message}`);
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

  try {
    // 1. 靜態檢查
    results.push(["靜態程式碼掃描", await runPreDeployCheck()]);

    // 2. Lint
    results.push(["Lint 檢查", await runLint()]);

    // 3. 單元測試
    results.push(["Webapp 單元測試", await runUnitTests()]);
    results.push(["Simulator 模組測試", await runServerTests()]);

    // 4. Playwright E2E 測試 (會自動啟動開發服務)
    results.push(["Playwright E2E 測試", await runBrowserTests()]);
  } finally {
    // 清理任何殘留進程
    execSync("lsof -ti:3000 -ti:5173 | xargs kill -9 2>/dev/null || true");
  }

  // 總結
  console.log(
    `\n${COLORS.bold}═══════════════════════════════════════════════════════════`,
  );
  console.log("驗證結果總結");
  console.log(
    `════════════════════════════════════════════════════════════${COLORS.reset}\n`,
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