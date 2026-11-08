#!/usr/bin/env node
/**
 * verify-endpoint-usage.mjs
 * Phase 1: 盤點後端端點與前端實際調用，產出端點使用對照表。
 *
 * 用法: node scripts/verify-endpoint-usage.mjs
 * 輸出: scripts/__endpoint_usage_report.md (Markdown 對照表)
 */

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const ROUTES_DIR = path.join(ROOT, "src", "api", "routes");
const WEBAPP_SRC = path.join(ROOT, "webapp", "src");
const REPORT_PATH = path.join(ROOT, "scripts", "__endpoint_usage_report.md");

// fetch* 函數名 → 後端路徑（不含 /api 前綴）
// 來源：webapp/src/api/config.js ENDPOINTS 定義 + 硬編碼 URL 調用
const FETCH_TO_PATH_MAP = {
  fetchReports: "/reports",
  fetchWeeklyReports: "/reports/weekly",
  fetchMonthlyReports: "/reports/monthly",
  fetchLatestTheoretical: "/report/latest-theoretical",
  fetchSnapshots: "/reports/snapshots",
  fetchSnapshotsWeekly: "/reports/snapshots/weekly",
  fetchSnapshotsMonthly: "/reports/snapshots/monthly",
  fetchReportSignals: "/report/:date/signals",
  fetchNews: "/news",
  fetchReportNews: "/report/news",
  fetchSocialSentiment: "/social-sentiment",
  fetchDataEvidenceReport: "/data-evidence-report",
  fetchDataEvidenceReportDownload: "/data-evidence-report/download",
  fetchReplayEvidence: "/replay-evidence",
  fetchStatus: "/status",
  fetchStrategyConfig: "/strategy-config",
  // 硬編碼 URL 調用（不在 ENDPOINTS 中）
  fetchPortfolioHealth: "/portfolio/health",
  fetchStrategyStatus: "/strategy-status",
};

/**
 * 從單個路由文件內容中提取 fastify.get/post/put/delete/patch 端點
 * 處理跨多行的參數（如 fastify.post(\n "/deploy",\n {...}）
 */
function extractRoutesFromFile(content, fileName) {
  const routes = [];
  // 匹配 fastify.方法("路徑", ...) 其中路徑可跨多行
  const regex =
    /fastify\.(get|post|put|delete|patch|options)[\s\S]*?\(\s*["']([^"']+)["']/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    routes.push({
      method: match[1].toUpperCase(),
      path: match[2],
      file: fileName,
    });
  }
  return routes;
}

/**
 * 從後端路由目錄提取所有 HTTP 端點
 * @param {string} [rootDir] 可選的根目錄，預設為 process.cwd()
 */
function extractBackendRoutes(rootDir) {
  const base = rootDir || process.cwd();
  const routesDir = path.join(base, "src", "api", "routes");
  if (!fs.existsSync(routesDir)) {
    return [];
  }
  const files = fs.readdirSync(routesDir).filter((f) => f.endsWith(".mjs"));

  const allRoutes = [];
  for (const file of files) {
    const filePath = path.join(routesDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const routes = extractRoutesFromFile(content, file);
    allRoutes.push(...routes);
  }
  return allRoutes;
}

/**
 * 從前端 .vue/.js 文件中提取 fetch* 函數調用
 * @param {string} [rootDir] 可選的根目錄，預設為 process.cwd()
 */
function extractFrontendFetchCalls(rootDir) {
  const base = rootDir || process.cwd();
  const webappSrc = path.join(base, "webapp", "src");
  if (!fs.existsSync(webappSrc)) {
    return [];
  }

  const calls = new Set();

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".vue") || entry.name.endsWith(".js"))
      ) {
        const content = fs.readFileSync(full, "utf-8");
        // 匹配 fetch*() 調用
        const fetchRegex = /(fetch[A-Za-z]+)\s*\(/g;
        let match;
        while ((match = fetchRegex.exec(content)) !== null) {
          calls.add(match[1]);
        }
      }
    }
  }

  walk(webappSrc);
  return Array.from(calls).sort();
}

/**
 * 比對後端端點與前端調用，產出對照表
 * @param {Object} [options]
 * @param {string} [options.rootDir] 根目錄，預設為 process.cwd()
 */
function buildEndpointUsageMap(options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const backendRoutes = extractBackendRoutes(rootDir);
  const frontendCalls = extractFrontendFetchCalls(rootDir);

  const backendPaths = new Set(backendRoutes.map((r) => r.path));
  const usedBackendEndpoints = [];
  const unusedBackendEndpoints = [];
  const frontendCallsWithoutBackend = [];
  const frontendCallsWithBackend = [];

  for (const call of frontendCalls) {
    const backendPath = FETCH_TO_PATH_MAP[call];
    if (backendPath) {
      frontendCallsWithBackend.push({ call, backendPath });
      if (backendPaths.has(backendPath)) {
        const route = backendRoutes.find((r) => r.path === backendPath);
        usedBackendEndpoints.push({
          call,
          backendPath,
          method: route ? route.method : "UNKNOWN",
          file: route ? route.file : "UNKNOWN",
        });
      } else {
        // 後端沒有對應端點
        frontendCallsWithoutBackend.push(call);
      }
    } else {
      // 未定義映射的 fetch* 調用
      frontendCallsWithoutBackend.push(call);
    }
  }

  // 找出後端有但前端未調用的端點
  const usedPaths = new Set(usedBackendEndpoints.map((e) => e.backendPath));
  for (const route of backendRoutes) {
    if (!usedPaths.has(route.path)) {
      unusedBackendEndpoints.push(route);
    }
  }

  return {
    backendRoutes,
    frontendCalls,
    usedBackendEndpoints,
    unusedBackendEndpoints,
    frontendCallsWithoutBackend,
    frontendCallsWithBackend,
  };
}

/**
 * 生成 Markdown 報告
 */
function generateReport(result) {
  const lines = [];
  lines.push("# 後端端點與前端調用對照表");
  lines.push("");
  lines.push(`生成時間: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## 摘要");
  lines.push("");
  lines.push(`- 後端 HTTP 端點總數: ${result.backendRoutes.length}`);
  lines.push(`- 前端 fetch* 調用總數: ${result.frontendCalls.length}`);
  lines.push(`- 前端實際調用的後端端點: ${result.usedBackendEndpoints.length}`);
  lines.push(
    `- 後端未被前端調用的端點: ${result.unusedBackendEndpoints.length}`,
  );
  lines.push(
    `- 前端調用但後端無對應端點: ${result.frontendCallsWithoutBackend.length}`,
  );
  lines.push("");

  lines.push("## 1. 前端調用的後端端點（已使用）");
  lines.push("");
  lines.push("| 前端調用 | 後端路徑 | 方法 | 來源文件 |");
  lines.push("|---|---|---|---|");
  for (const item of result.usedBackendEndpoints) {
    lines.push(
      `| \`${item.call}\` | \`${item.backendPath}\` | ${item.method} | \`${item.file}\` |`,
    );
  }
  lines.push("");

  lines.push("## 2. 後端未被前端調用的端點（候選移除）");
  lines.push("");
  lines.push("| 路徑 | 方法 | 來源文件 |");
  lines.push("|---|---|---|");
  for (const route of result.unusedBackendEndpoints) {
    lines.push(`| \`${route.path}\` | ${route.method} | \`${route.file}\` |`);
  }
  lines.push("");

  lines.push("## 3. 前端調用但後端無對應端點");
  lines.push("");
  if (result.frontendCallsWithoutBackend.length === 0) {
    lines.push("(無)");
  } else {
    for (const call of result.frontendCallsWithoutBackend) {
      lines.push(`- \`${call}\``);
    }
  }
  lines.push("");

  lines.push("## 4. 後端端點完整列表（45 個 HTTP 端點）");
  lines.push("");
  lines.push("| 路徑 | 方法 | 來源文件 | 前端是否調用 |");
  lines.push("|---|---|---|---|");
  const usedPathSet = new Set(
    result.usedBackendEndpoints.map((e) => e.backendPath),
  );
  for (const route of result.backendRoutes) {
    const used = usedPathSet.has(route.path) ? "✅ 是" : "❌ 否";
    lines.push(
      `| \`${route.path}\` | ${route.method} | \`${route.file}\` | ${used} |`,
    );
  }
  lines.push("");

  return lines.join("\n");
}

/**
 * 主流程
 */
function main(options = {}) {
  const result = buildEndpointUsageMap(options);
  const report = generateReport(result);
  fs.writeFileSync(REPORT_PATH, report, "utf-8");

  console.log("=== 端點使用盤點完成 ===");
  console.log(`後端端點總數: ${result.backendRoutes.length}`);
  console.log(`前端 fetch* 調用: ${result.frontendCalls.length}`);
  console.log(`已使用端點: ${result.usedBackendEndpoints.length}`);
  console.log(`未使用端點: ${result.unusedBackendEndpoints.length}`);
  console.log(
    `前端調用但後端無對應: ${result.frontendCallsWithoutBackend.length}`,
  );
  console.log(`報告已寫入: ${REPORT_PATH}`);

  // 回傳結果供測試使用
  return result;
}

export {
  extractRoutesFromFile,
  extractBackendRoutes,
  extractFrontendFetchCalls,
  buildEndpointUsageMap,
  generateReport,
  FETCH_TO_PATH_MAP,
  main,
};

// 若直接執行此腳本（非透過 import）
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
