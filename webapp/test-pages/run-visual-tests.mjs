#!/usr/bin/env node
/**
 * Visual regression test runner
 * Usage: node webapp/test-pages/run-visual-tests.mjs
 *
 * Requirements:
 * - API server running on port 3000
 * - Static server running on port 4173 serving dist/
 * - npm install puppeteer (if not installed)
 */

import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

const BASE_URL = "http://localhost:4173/test-pages";
const API_URL = "http://localhost:3000";
const PAGES = [
  { file: "test-dashboard.html", route: "#/dashboard", name: "總覽" },
  { file: "test-radar.html", route: "#/radar", name: "市場雷達" },
  { file: "test-macro.html", route: "#/macro", name: "多空對決" },
  { file: "test-chart.html", route: "#/chart", name: "圖表" },
  { file: "test-reports.html", route: "#/reports", name: "報告" },
  { file: "test-news.html", route: "#/news", name: "新聞" },
  { file: "test-strategy.html", route: "#/strategy", name: "策略" },
  { file: "test-account.html", route: "#/account", name: "帳戶" },
  { file: "test-simulator.html", route: "#/simulator", name: "模擬器" },
];

const OUTPUT_DIR =
  "/Users/han/Project/InvestmentLineNotify/webapp/test-pages/screenshots";
const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 3 }; // iPhone 12/13/14 Pro

async function checkApiHealth() {
  try {
    const response = await fetch(`${API_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function checkStaticServer() {
  try {
    const response = await fetch(`${BASE_URL}/test-dashboard.html`);
    return response.ok;
  } catch {
    return false;
  }
}

async function runVisualTests() {
  console.log("🚀 啟動視覺回歸測試...\n");

  // Check prerequisites
  console.log("📋 檢查前置條件...");
  const apiHealthy = await checkApiHealth();
  const staticHealthy = await checkStaticServer();

  if (!apiHealthy) {
    console.error("❌ API 伺服器未運行 (port 3000)");
    console.log("   請執行: NODE_ENV=development node src/api/server.mjs");
    process.exit(1);
  }
  console.log("✅ API 伺服器正常");

  if (!staticHealthy) {
    console.error("❌ 靜態檔案伺服器未運行 (port 4173)");
    console.log("   請執行: cd webapp/dist && python3 -m http.server 4173");
    process.exit(1);
  }
  console.log("✅ 靜態檔案伺服器正常\n");

  // Ensure output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Launch browser
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: VIEWPORT,
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });

  const page = await browser.newPage();

  // Enable console logging
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`  ⚠️ Console Error: ${msg.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    console.log(`  ❌ Page Error: ${error.message}`);
  });

  const results = [];

  for (const p of PAGES) {
    const url = `${BASE_URL}/${p.file}`;
    console.log(`\n📸 測試: ${p.name} (${p.route})`);
    console.log(`   URL: ${url}`);

    try {
      // Navigate
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

      // Wait for Vue to mount and navigate
      await new Promise((r) => setTimeout(r, 2000));

      // Check for errors
      const errors = await page.evaluate(() => {
        return window.__testErrors || [];
      });

      // Take screenshot
      const screenshotPath = path.join(
        OUTPUT_DIR,
        `${p.file.replace(".html", "")}.png`,
      );
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Verify content rendered
      const hasContent = await page.evaluate(() => {
        const main = document.querySelector("main.app-main");
        return main && main.innerHTML.length > 100;
      });

      const hasRouterView = await page.evaluate(() => {
        return document.querySelector("router-view") !== null;
      });

      const currentHash = await page.evaluate(() => window.location.hash);

      results.push({
        name: p.name,
        route: p.route,
        url,
        success: hasContent,
        hasContent,
        hasRouterView,
        currentHash,
        screenshot: screenshotPath,
        errors: errors.length,
      });

      if (hasContent) {
        console.log(`   ✅ 頁面渲染正常 (${currentHash})`);
      } else {
        console.log(`   ❌ 頁面內容為空 (${currentHash})`);
      }
      console.log(`   📷 截圖: ${screenshotPath}`);
    } catch (error) {
      console.log(`   ❌ 錯誤: ${error.message}`);
      results.push({
        name: p.name,
        route: p.route,
        url,
        success: false,
        error: error.message,
      });
    }
  }

  await browser.close();

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 測試總結");
  console.log("=".repeat(60));

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  results.forEach((r) => {
    const status = r.success ? "✅" : "❌";
    console.log(
      `${status} ${r.name.padEnd(8)} ${r.route.padEnd(12)} ${r.currentHash || ""}`,
    );
  });

  console.log(`\n通過: ${passed}/${PAGES.length}`);
  console.log(`失敗: ${failed}/${PAGES.length}`);
  console.log(`\n📁 截圖目錄: ${OUTPUT_DIR}`);

  // Generate HTML report
  const reportHtml = generateReport(results);
  const reportPath = path.join(OUTPUT_DIR, "report.html");
  fs.writeFileSync(reportPath, reportHtml);
  console.log(`📄 HTML 報告: ${reportPath}`);

  process.exit(failed > 0 ? 1 : 0);
}

function generateReport(results) {
  const rows = results
    .map(
      (r) => `
    <tr class="${r.success ? "pass" : "fail"}">
      <td>${r.name}</td>
      <td>${r.route}</td>
      <td>${r.currentHash || "N/A"}</td>
      <td class="status">${r.success ? "✅ 通過" : "❌ 失敗"}</td>
      <td><img src="${path.basename(r.screenshot || "")}" alt="${r.name}" style="max-width: 200px;"></td>
    </tr>
  `,
    )
    .join("");

  return `
<!doctype html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <title>視覺回歸測試報告</title>
  <style>
    body { font-family: -apple-system, sans-serif; padding: 20px; max-width: 1200px; margin: 0 auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f5f5f5; }
    .pass { background: #f0fff0; }
    .fail { background: #fff0f0; }
    .status { font-weight: bold; }
    img { border: 1px solid #ddd; border-radius: 4px; cursor: pointer; }
    .summary { padding: 20px; background: #f5f5f5; border-radius: 8px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>📸 視覺回歸測試報告</h1>
  <div class="summary">
    <strong>生成時間:</strong> ${new Date().toLocaleString("zh-TW")}<br>
    <strong>總頁面:</strong> ${results.length}<br>
    <strong>通過:</strong> ${results.filter((r) => r.success).length}<br>
    <strong>失敗:</strong> ${results.filter((r) => !r.success).length}
  </div>
  <table>
    <thead>
      <tr><th>頁面</th><th>路由</th><th>實際 Hash</th><th>狀態</th><th>截圖</th></tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>
  `;
}

runVisualTests().catch(console.error);
