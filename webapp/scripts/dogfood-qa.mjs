#!/usr/bin/env node
/**
 * Dogfood 探索式 QA 掃描腳本
 * 掃描核心 API + 關鍵頁面 (Dashboard/Simulator/Account)
 * 檢測 Console 錯誤、JS 例外、網路失敗、視覺異常
 * 產出 dogfood-output/report.md
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, "..", "..");
const WEBAPP_DIR = path.join(ROOT_DIR, "webapp");
const OUTPUT_DIR = path.join(ROOT_DIR, "dogfood-output");

// 確保輸出目錄存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const BASE_URL = "http://localhost:5173";
const API_BASE_URL = "http://localhost:3001";

// 關鍵 API 端點
const API_ENDPOINTS = [
  { path: "/health", name: "Health Check", skipAuth: true },
  { path: "/healthz", name: "Health Check (alt)", skipAuth: true },
  { path: "/api/status", name: "System Status" },
  { path: "/api/reports/latest", name: "Latest Report" },
  { path: "/api/news/pool", name: "News Pool" },
  { path: "/api/config", name: "Config" },
  { path: "/api/portfolio-health", name: "Portfolio Health" },
  { path: "/api/strategy-status", name: "Strategy Status" },
  { path: "/api/v1/simulate", name: "Simulator", method: "POST", body: { symbol: "0050.TW", direction: "long", capital: 100000 } },
  { path: "/api/backtest/list", name: "Backtest List" },
  { path: "/api/monitoring/health", name: "Monitoring Health" },
];

// 關鍵頁面
const PAGES = [
  { path: "/", name: "Dashboard", waitFor: ".dash-title, .view-container" },
  { path: "/simulator", name: "Simulator", waitFor: ".simulator-container, .view-container" },
  { path: "/account", name: "Account", waitFor: ".account-container, .view-container" },
];

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function startServer(command, args, cwd, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });
    
    let output = "";
    child.stdout?.on("data", (data) => {
      output += data.toString();
    });
    child.stderr?.on("data", (data) => {
      output += data.toString();
    });
    
    child.on("error", (err) => {
      reject(err);
    });
    
    // Give it a moment to start
    setTimeout(() => {
      resolve({ child, pid: child.pid, getOutput: () => output });
    }, 1000);
  });
}

async function startServers() {
  console.log("🚀 啟動 API Server + Vite Dev Server...");
  
  // Start API server
  const apiServer = await startServer("node", ["src/api/server.mjs"], ROOT_DIR, { NODE_ENV: "development" });
  console.log(`API Server PID: ${apiServer.pid}`);
  
  // Wait for API server
  await delay(3000);
  
  // Start Vite dev server
  const viteServer = await startServer("npm", ["run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"], WEBAPP_DIR, { NODE_ENV: "development" });
  console.log(`Vite Server PID: ${viteServer.pid}`);
  
  // Wait for Vite server
  await delay(5000);
  
  return { apiServer, viteServer };
}

async function stopServers(apiServer, viteServer) {
  console.log("🛑 關閉伺服器...");
  apiServer.child.kill();
  viteServer.child.kill();
  await delay(1000);
}

async function scanAPIs(page) {
  console.log("\n📡 掃描核心 API 端點...");
  const results = [];
  
  for (const endpoint of API_ENDPOINTS) {
    const url = `${API_BASE_URL}${endpoint.path}`;
    try {
      const options = {
        method: endpoint.method || "GET",
        headers: {
          "Content-Type": "application/json",
          // Skip auth for health endpoints
          ...(endpoint.skipAuth ? {} : { "X-Telegram-Init-Data": "test" }),
        },
      };
      
      if (endpoint.body) {
        options.body = JSON.stringify(endpoint.body);
      }
      
      const response = await page.request.fetch(url, options);
      const status = response.status();
      const ok = response.ok();
      
      let responseData = null;
      try {
        responseData = await response.json();
      } catch {
        responseData = await response.text();
      }
      
      results.push({
        name: endpoint.name,
        path: endpoint.path,
        status,
        ok,
        responsePreview: typeof responseData === "object" 
          ? JSON.stringify(responseData).slice(0, 200) 
          : String(responseData).slice(0, 200),
      });
      
      console.log(`  ${ok ? "✅" : "❌"} ${endpoint.name} (${endpoint.path}) - ${status}`);
    } catch (error) {
      results.push({
        name: endpoint.name,
        path: endpoint.path,
        status: 0,
        ok: false,
        error: error.message,
      });
      console.log(`  ❌ ${endpoint.name} (${endpoint.path}) - ERROR: ${error.message}`);
    }
  }
  
  return results;
}

async function scanPages(page) {
  console.log("\n🌐 掃描關鍵頁面...");
  const results = [];
  
  for (const pageInfo of PAGES) {
    const url = `${BASE_URL}${pageInfo.path}`;
    const pageResult = {
      name: pageInfo.name,
      path: pageInfo.path,
      url,
      consoleErrors: [],
      jsExceptions: [],
      networkFailures: [],
      screenshots: [],
      loadTime: 0,
      success: false,
    };
    
    // 收集 Console 錯誤
    page.on("console", msg => {
      if (msg.type() === "error") {
        pageResult.consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
        });
      }
    });
    
    // 收集 JS 例外
    page.on("pageerror", error => {
      pageResult.jsExceptions.push({
        message: error.message,
        stack: error.stack,
      });
    });
    
    // 收集網路失敗
    page.on("response", response => {
      if (!response.ok() && response.status() >= 400) {
        pageResult.networkFailures.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
        });
      }
    });
    
    try {
      const startTime = Date.now();
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      pageResult.loadTime = Date.now() - startTime;
      
      // 等待 Vue 掛載並渲染
      if (pageInfo.waitFor) {
        await page.waitForSelector(pageInfo.waitFor, { timeout: 10000 });
      }
      
      // 截圖
      const screenshotPath = path.join(OUTPUT_DIR, `screenshot-${pageInfo.name.toLowerCase()}-${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      pageResult.screenshots.push(screenshotPath);
      
      // 檢查頁面是否有明顯錯誤訊息
      const errorElements = await page.locator(".error, .alert-error, [role='alert'], .toast-error").all();
      if (errorElements.length > 0) {
        for (const el of errorElements) {
          const text = await el.textContent();
          if (text?.trim()) {
            pageResult.consoleErrors.push({
              text: `UI Error Element: ${text.trim()}`,
              location: "DOM",
            });
          }
        }
      }
      
      pageResult.success = pageResult.consoleErrors.length === 0 && 
                          pageResult.jsExceptions.length === 0 && 
                          pageResult.networkFailures.length === 0;
      
      console.log(`  ${pageResult.success ? "✅" : "⚠️"} ${pageInfo.name} (${pageInfo.path}) - ${pageResult.loadTime}ms`);
      if (pageResult.consoleErrors.length > 0) {
        console.log(`    Console Errors: ${pageResult.consoleErrors.length}`);
      }
      if (pageResult.jsExceptions.length > 0) {
        console.log(`    JS Exceptions: ${pageResult.jsExceptions.length}`);
      }
      if (pageResult.networkFailures.length > 0) {
        console.log(`    Network Failures: ${pageResult.networkFailures.length}`);
      }
      
    } catch (error) {
      pageResult.success = false;
      pageResult.error = error.message;
      console.log(`  ❌ ${pageInfo.name} (${pageInfo.path}) - ERROR: ${error.message}`);
      
      // 截錯誤圖
      const screenshotPath = path.join(OUTPUT_DIR, `screenshot-${pageInfo.name.toLowerCase()}-error-${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      pageResult.screenshots.push(screenshotPath);
    }
    
    results.push(pageResult);
  }
  
  return results;
}

function classifyBug(apiResults, pageResults) {
  const bugs = [];
  
  // API 錯誤
  for (const api of apiResults) {
    if (!api.ok) {
      let severity = "High";
      if (api.path === "/health" || api.path === "/healthz") severity = "Critical";
      else if (api.status === 401) severity = "Medium"; // Auth issue
      else if (api.status === 404) severity = "Low";
      else if (api.status >= 500) severity = "Critical";
      
      bugs.push({
        title: `API 失敗: ${api.name} (${api.path})`,
        severity,
        category: "API",
        details: `Status: ${api.status}, Response: ${api.responsePreview || api.error}`,
        reproduction: `GET ${API_BASE_URL}${api.path}`,
      });
    }
  }
  
  // 頁面錯誤
  for (const page of pageResults) {
    if (!page.success) {
      let severity = "Medium";
      if (page.error) severity = "High";
      if (page.jsExceptions.length > 0) severity = "High";
      
      bugs.push({
        title: `頁面異常: ${page.name} (${page.path})`,
        severity,
        category: "Frontend",
        details: `Load time: ${page.loadTime}ms, Console errors: ${page.consoleErrors.length}, JS exceptions: ${page.jsExceptions.length}, Network failures: ${page.networkFailures.length}`,
        reproduction: `Visit ${BASE_URL}${page.path}`,
        screenshots: page.screenshots,
        consoleErrors: page.consoleErrors.slice(0, 5),
        jsExceptions: page.jsExceptions.slice(0, 3),
        networkFailures: page.networkFailures.slice(0, 5),
      });
    }
    
    // Console errors on page (even if "success")
    if (page.consoleErrors.length > 0) {
      bugs.push({
        title: `Console 錯誤: ${page.name} (${page.path})`,
        severity: page.jsExceptions.length > 0 ? "High" : "Medium",
        category: "Console",
        details: page.consoleErrors.slice(0, 5).map(e => e.text).join("; "),
        reproduction: `Visit ${BASE_URL}${page.path} and open DevTools Console`,
      });
    }
  }
  
  // 去重
  const seen = new Set();
  const uniqueBugs = [];
  for (const bug of bugs) {
    const key = `${bug.category}:${bug.title}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueBugs.push(bug);
    }
  }
  
  return uniqueBugs;
}

function generateReport(apiResults, pageResults, bugs) {
  const timestamp = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
  const criticalBugs = bugs.filter(b => b.severity === "Critical").length;
  const highBugs = bugs.filter(b => b.severity === "High").length;
  const mediumBugs = bugs.filter(b => b.severity === "Medium").length;
  const lowBugs = bugs.filter(b => b.severity === "Low").length;
  
  let md = `# Dogfood 探索式 QA 報告\n\n`;
  md += `**生成時間**: ${timestamp}\n\n`;
  md += `**測試環境**: Vite Dev Server (localhost:5173) + API Server (localhost:3001)\n\n`;
  
  md += `## 📊 摘要\n\n`;
  md += `| 指標 | 數值 |\n|------|------|\n`;
  md += `| API 端點測試 | ${apiResults.filter(r => r.ok).length}/${apiResults.length} 通過 |\n`;
  md += `| 頁面測試 | ${pageResults.filter(r => r.success).length}/${pageResults.length} 通過 |\n`;
  md += `| **Critical Bugs** | ${criticalBugs} |\n`;
  md += `| **High Bugs** | ${highBugs} |\n`;
  md += `| **Medium Bugs** | ${mediumBugs} |\n`;
  md += `| **Low Bugs** | ${lowBugs} |\n`;
  md += `| **總計** | ${bugs.length} |\n\n`;
  
  md += `## 📡 API 測試結果\n\n`;
  md += `| 端點 | 名稱 | 狀態 | 通過 |\n|------|------|------|------|\n`;
  for (const api of apiResults) {
    md += `| ${api.path} | ${api.name} | ${api.status} | ${api.ok ? "✅" : "❌"} |\n`;
  }
  md += `\n`;
  
  md += `## 🌐 頁面測試結果\n\n`;
  md += `| 頁面 | 路徑 | 載入時間 | 通過 | Console Errors | JS Exceptions | Network Failures |\n|------|------|----------|------|----------------|---------------|------------------|\n`;
  for (const page of pageResults) {
    md += `| ${page.name} | ${page.path} | ${page.loadTime}ms | ${page.success ? "✅" : "❌"} | ${page.consoleErrors.length} | ${page.jsExceptions.length} | ${page.networkFailures.length} |\n`;
  }
  md += `\n`;
  
  if (bugs.length > 0) {
    md += `## 🐛 Bug 分類報告\n\n`;
    
    for (const severity of ["Critical", "High", "Medium", "Low"]) {
      const severityBugs = bugs.filter(b => b.severity === severity);
      if (severityBugs.length === 0) continue;
      
      md += `### ${severity} (${severityBugs.length})\n\n`;
      
      for (const bug of severityBugs) {
        md += `#### ${bug.title}\n\n`;
        md += `- **分類**: ${bug.category}\n`;
        md += `- **嚴重度**: ${bug.severity}\n`;
        md += `- **詳情**: ${bug.details}\n`;
        md += `- **重現步驟**: ${bug.reproduction}\n`;
        
        if (bug.screenshots && bug.screenshots.length > 0) {
          md += `- **截圖**:\n`;
          for (const ss of bug.screenshots) {
            const relPath = path.relative(ROOT_DIR, ss);
            md += `  - ![${relPath}](${relPath})\n`;
          }
        }
        
        if (bug.consoleErrors && bug.consoleErrors.length > 0) {
          md += `- **Console 錯誤**:\n`;
          for (const err of bug.consoleErrors) {
            md += `  - \`${err.text}\`\n`;
          }
        }
        
        if (bug.jsExceptions && bug.jsExceptions.length > 0) {
          md += `- **JS 例外**:\n`;
          for (const err of bug.jsExceptions) {
            md += `  - \`${err.message}\`\n`;
            if (err.stack) {
              md += `    \`\`\`\n${err.stack.slice(0, 500)}\n    \`\`\`\n`;
            }
          }
        }
        
        if (bug.networkFailures && bug.networkFailures.length > 0) {
          md += `- **網路失敗**:\n`;
          for (const nf of bug.networkFailures) {
            md += `  - ${nf.url} (${nf.status} ${nf.statusText})\n`;
          }
        }
        
        md += `\n`;
      }
    }
  } else {
    md += `## 🐛 Bug 分類報告\n\n✅ 無發現 Bug\n\n`;
  }
  
  md += `## 📝 建議後續行動\n\n`;
  if (criticalBugs > 0) {
    md += `1. **立即修復 Critical Bugs** (${criticalBugs} 個) - 影響核心功能可用性\n`;
  }
  if (highBugs > 0) {
    md += `2. **優先修復 High Bugs** (${highBugs} 個) - 影響主要使用流程\n`;
  }
  if (mediumBugs > 0) {
    md += `3. **排程修復 Medium Bugs** (${mediumBugs} 個) - 影響使用者體驗\n`;
  }
  if (lowBugs > 0) {
    md += `4. **記錄 Low Bugs** (${lowBugs} 個) - 後續迭代處理\n`;
  }
  if (bugs.length === 0) {
    md += `✅ 所有檢查通過，建議定期執行 Dogfood QA 確保品質\n`;
  }
  
  return md;
}

async function main() {
  console.log("🔍 Dogfood 探索式 QA 開始...\n");
  
  let apiServer, viteServer;
  
  try {
    // 啟動伺服器
    ({ apiServer, viteServer } = await startServers());
    
    // 啟動 Playwright
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();
    
    // 掃描 API
    const apiResults = await scanAPIs(page);
    
    // 掃描頁面
    const pageResults = await scanPages(page);
    
    // 關閉瀏覽器
    await browser.close();
    
    // 分類 Bug
    const bugs = classifyBug(apiResults, pageResults);
    
    // 生成報告
    const report = generateReport(apiResults, pageResults, bugs);
    
    // 寫入報告
    const reportPath = path.join(OUTPUT_DIR, "report.md");
    fs.writeFileSync(reportPath, report);
    
    console.log(`\n📄 報告已生成: ${reportPath}`);
    console.log(`\n✅ Dogfood QA 完成!`);
    console.log(`   - API: ${apiResults.filter(r => r.ok).length}/${apiResults.length} 通過`);
    console.log(`   - 頁面: ${pageResults.filter(r => r.success).length}/${pageResults.length} 通過`);
    console.log(`   - Bugs: ${bugs.length} (Critical: ${bugs.filter(b => b.severity === "Critical").length}, High: ${bugs.filter(b => b.severity === "High").length}, Medium: ${bugs.filter(b => b.severity === "Medium").length}, Low: ${bugs.filter(b => b.severity === "Low").length})`);
    
  } catch (error) {
    console.error("❌ Dogfood QA 失敗:", error);
    process.exit(1);
  } finally {
    // 清理伺服器
    if (apiServer) apiServer.child.kill();
    if (viteServer) viteServer.child.kill();
  }
}

main();