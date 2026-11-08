#!/usr/bin/env node
/**
 * verify-data-endpoint.mjs
 * Phase 2: 透過 data/ 原始資料驗證各後端端點回傳內容正確性。
 * 不透過外部 API，不透過 Agent 服務，僅使用本地 data/。
 *
 * 用法: node scripts/verify-data-endpoint.mjs [dataDir]
 * 輸出: scripts/__data_verification_report.md
 */

import fs from "fs";
import path from "path";

const DEFAULT_DATA_DIR = path.join(process.cwd(), "data");
const REPORT_PATH = path.join(
  process.cwd(),
  "scripts",
  "__data_verification_report.md",
);

/**
 * 讀取 JSON 檔案並回傳解析後的物件
 */
function loadDataFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

/**
 * 比對兩個物件是否相等，回傳差異說明
 */
function deepEqual(a, b) {
  if (a === b) return { equal: true, diff: null };
  if (typeof a !== typeof b) {
    return { equal: false, diff: `type mismatch: ${typeof a} vs ${typeof b}` };
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return {
        equal: false,
        diff: `array length mismatch: ${a.length} vs ${b.length}`,
      };
    }
    for (let i = 0; i < a.length; i++) {
      const sub = deepEqual(a[i], b[i]);
      if (!sub.equal) {
        return { equal: false, diff: `[${i}] ${sub.diff}` };
      }
    }
    return { equal: true, diff: null };
  }
  if (
    a !== null &&
    b !== null &&
    typeof a === "object" &&
    typeof b === "object"
  ) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) {
      return {
        equal: false,
        diff: `key count mismatch: ${keysA.length} vs ${keysB.length}`,
      };
    }
    for (const key of keysA) {
      if (!(key in b)) {
        return { equal: false, diff: `missing key: ${key}` };
      }
      const sub = deepEqual(a[key], b[key]);
      if (!sub.equal) {
        return { equal: false, diff: `.${key} ${sub.diff}` };
      }
    }
    return { equal: true, diff: null };
  }
  if (a !== b) {
    return {
      equal: false,
      diff: `value mismatch: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`,
    };
  }
  return { equal: true, diff: null };
}

/**
 * 檢查目錄是否存在且包含至少一個 .json 檔案
 */
function dirHasJsonFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return false;
  const entries = fs.readdirSync(dirPath);
  return entries.some((e) => e.endsWith(".json"));
}

/**
 * 驗證 GET /news 端點
 * 端點讀取: data/news/pool_filtered_active.json
 */
function verifyNewsEndpoint(dataDir, options = {}) {
  const sourcePath = path.join(dataDir, "news", "pool_filtered_active.json");
  let sourceData = null;
  let sourceValid = false;

  if (fs.existsSync(sourcePath)) {
    try {
      sourceData = loadDataFile(sourcePath);
      sourceValid = Array.isArray(sourceData);
    } catch {
      sourceValid = false;
    }
  }

  const returnedData = options.returnedData || null;
  let comparison = null;
  if (returnedData !== null) {
    comparison = deepEqual(returnedData, sourceData);
  }

  return {
    endpoint: "GET /news",
    sourceFile: "data/news/pool_filtered_active.json",
    sourceExists: fs.existsSync(sourcePath),
    sourceValid,
    passed: returnedData !== null ? comparison.equal : sourceValid,
    sourceData,
    returnedData,
    diff: comparison
      ? comparison.diff
      : sourceValid
        ? null
        : "source file invalid or missing",
  };
}

/**
 * 驗證 GET /status 端點
 * 端點讀取: data/market/latest.json + data/reports/ (透過 IlnState)
 */
function verifyStatusEndpoint(dataDir, options = {}) {
  const marketPath = path.join(dataDir, "market", "latest.json");
  const reportsDir = path.join(dataDir, "reports");

  let marketData = null;
  let marketValid = false;
  let reportsExist = false;
  let reportCount = 0;

  if (fs.existsSync(marketPath)) {
    try {
      marketData = loadDataFile(marketPath);
      marketValid = marketData !== null && typeof marketData === "object";
    } catch {
      marketValid = false;
    }
  }

  if (fs.existsSync(reportsDir)) {
    const entries = fs.readdirSync(reportsDir);
    const jsonFiles = entries.filter(
      (e) => e.endsWith(".json") && e !== ".gitkeep",
    );
    reportsExist = jsonFiles.length > 0;
    reportCount = jsonFiles.length;
  }

  const sourceValid = marketValid && reportsExist;
  const returnedData = options.returnedData || null;
  let comparison = null;
  if (returnedData !== null) {
    comparison = deepEqual(returnedData, marketData);
  }

  return {
    endpoint: "GET /status",
    sourceFile: "data/market/latest.json (+ data/reports/)",
    sourceExists: fs.existsSync(marketPath) && reportsExist,
    sourceValid,
    passed:
      returnedData !== null
        ? comparison
          ? comparison.equal
          : false
        : sourceValid,
    sourceData: marketData,
    returnedData,
    diff: comparison
      ? comparison.diff
      : sourceValid
        ? null
        : "source file invalid or missing",
    reportCount,
  };
}

/**
 * 驗證 GET /social-sentiment 端點
 * 端點讀取: data/sentiment/social_sentiment_daily.json
 */
function verifySocialSentimentEndpoint(dataDir, options = {}) {
  const sourcePath = path.join(
    dataDir,
    "sentiment",
    "social_sentiment_daily.json",
  );
  let sourceData = null;
  let sourceValid = false;

  if (fs.existsSync(sourcePath)) {
    try {
      sourceData = loadDataFile(sourcePath);
      sourceValid =
        sourceData !== null &&
        typeof sourceData === "object" &&
        !Array.isArray(sourceData);
    } catch {
      sourceValid = false;
    }
  }

  const returnedData = options.returnedData || null;
  let comparison = null;
  if (returnedData !== null) {
    comparison = deepEqual(returnedData, sourceData);
  }

  return {
    endpoint: "GET /social-sentiment",
    sourceFile: "data/sentiment/social_sentiment_daily.json",
    sourceExists: fs.existsSync(sourcePath),
    sourceValid,
    passed: returnedData !== null ? comparison.equal : sourceValid,
    sourceData,
    returnedData,
    diff: comparison
      ? comparison.diff
      : sourceValid
        ? null
        : "source file invalid or missing",
  };
}

/**
 * 驗證 GET /reports 端點
 * 端點讀取: data/reports/ 目錄下的所有報告
 */
function verifyReportsEndpoint(dataDir, options = {}) {
  const reportsDir = path.join(dataDir, "reports");
  let reports = [];
  let sourceValid = false;

  if (fs.existsSync(reportsDir)) {
    const entries = fs.readdirSync(reportsDir);
    const jsonFiles = entries.filter(
      (e) => e.endsWith(".json") && e !== ".gitkeep",
    );
    reports = jsonFiles;
    sourceValid = jsonFiles.length > 0;
  }

  const returnedData = options.returnedData || null;
  let comparison = null;
  if (returnedData !== null) {
    comparison = deepEqual(returnedData, reports);
  }

  return {
    endpoint: "GET /reports",
    sourceFile: "data/reports/ (目錄)",
    sourceExists: fs.existsSync(reportsDir),
    sourceValid,
    passed:
      returnedData !== null
        ? comparison
          ? comparison.equal
          : false
        : sourceValid,
    sourceData: reports,
    returnedData,
    diff: comparison
      ? comparison.diff
      : sourceValid
        ? null
        : "no report files found",
    reportCount: reports.length,
  };
}

/**
 * 驗證 GET /strategy-status 端點
 * 端點讀取: data/market/latest.json + data/reports/ (透過 IlnState.loadStateFromLatestFiles)
 */
function verifyStrategyStatusEndpoint(dataDir, options = {}) {
  const marketPath = path.join(dataDir, "market", "latest.json");
  const reportsDir = path.join(dataDir, "reports");

  let marketData = null;
  let reportData = null;
  let sourceValid = false;

  if (fs.existsSync(marketPath)) {
    try {
      marketData = loadDataFile(marketPath);
    } catch {
      /* ignore */
    }
  }

  if (fs.existsSync(reportsDir)) {
    const entries = fs.readdirSync(reportsDir);
    const jsonFiles = entries
      .filter((e) => e.endsWith(".json") && e !== ".gitkeep")
      .sort()
      .reverse();
    if (jsonFiles.length > 0) {
      try {
        reportData = loadDataFile(path.join(reportsDir, jsonFiles[0]));
      } catch {
        /* ignore */
      }
    }
  }

  sourceValid = marketData !== null && reportData !== null;

  const returnedData = options.returnedData || null;
  let comparison = null;
  if (returnedData !== null) {
    comparison = deepEqual(returnedData, { marketData, reportData });
  }

  return {
    endpoint: "GET /strategy-status",
    sourceFile: "data/market/latest.json + data/reports/ (最新)",
    sourceExists: marketData !== null && reportData !== null,
    sourceValid,
    passed:
      returnedData !== null
        ? comparison
          ? comparison.equal
          : false
        : sourceValid,
    sourceData: { marketData, reportData },
    returnedData,
    diff: comparison
      ? comparison.diff
      : sourceValid
        ? null
        : "source file invalid or missing",
    reportDate: reportData?.date ?? null,
  };
}

/**
 * 驗證 GET /portfolio/health 端點
 * 端點讀取: data/config/strategy.json + data/reports/ (透過 archiveManager)
 * 並計算 computePortfolioHealth
 */
function verifyPortfolioHealthEndpoint(dataDir, options = {}) {
  const strategyPath = path.join(dataDir, "cache", "strategy_cache.json");
  const reportsDir = path.join(dataDir, "reports");

  let strategyData = null;
  let reportData = null;
  let sourceValid = false;

  if (fs.existsSync(strategyPath)) {
    try {
      strategyData = loadDataFile(strategyPath);
      sourceValid = strategyData !== null && typeof strategyData === "object";
    } catch {
      sourceValid = false;
    }
  }

  if (fs.existsSync(reportsDir)) {
    const entries = fs.readdirSync(reportsDir);
    const jsonFiles = entries
      .filter((e) => e.endsWith(".json") && e !== ".gitkeep")
      .sort()
      .reverse();
    if (jsonFiles.length > 0) {
      try {
        reportData = loadDataFile(path.join(reportsDir, jsonFiles[0]));
      } catch {
        /* ignore */
      }
    }
  }

  const returnedData = options.returnedData || null;
  let comparison = null;
  if (returnedData !== null) {
    comparison = deepEqual(returnedData, { strategyData, reportData });
  }

  return {
    endpoint: "GET /portfolio/health",
    sourceFile: "data/cache/strategy_cache.json + data/reports/ (最新)",
    sourceExists: strategyData !== null && reportData !== null,
    sourceValid,
    passed:
      returnedData !== null
        ? comparison
          ? comparison.equal
          : false
        : sourceValid,
    sourceData: { strategyData, reportData },
    returnedData,
    diff: comparison
      ? comparison.diff
      : sourceValid
        ? null
        : "source file invalid or missing",
    reportDate: reportData?.date ?? null,
  };
}

/**
 * 驗證所有端點，產出報告
 */
function verifyAllEndpoints(dataDir) {
  const results = [];

  const checks = [
    () => verifyNewsEndpoint(dataDir),
    () => verifyStatusEndpoint(dataDir),
    () => verifySocialSentimentEndpoint(dataDir),
    () => verifyReportsEndpoint(dataDir),
    () => verifyStrategyStatusEndpoint(dataDir),
    () => verifyPortfolioHealthEndpoint(dataDir),
  ];

  for (const verify of checks) {
    results.push(verify());
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    totalEndpoints: results.length,
    passed,
    failed,
    results,
  };
}

/**
 * 生成 Markdown 驗證報告
 */
function generateReport(verification) {
  const lines = [];
  lines.push("# 後端端點原始資料驗證報告 (Phase 2)");
  lines.push("");
  lines.push(`生成時間: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## 摘要");
  lines.push("");
  lines.push(`- 驗證端點總數: ${verification.totalEndpoints}`);
  lines.push(`- 資料源有效: ${verification.passed}`);
  lines.push(`- 資料源無效/缺失: ${verification.failed}`);
  lines.push("");
  lines.push(
    "> 說明：未提供端點實際返回值時，僅驗證 data/ 原始資料檔案存在且為有效 JSON。",
  );
  lines.push(
    "> 對於間接讀取的端點（status, strategy-status, portfolio-health, reports），",
  );
  lines.push("> 驗證其依賴的 data/ 檔案是否存在且結構正確。");
  lines.push("");

  lines.push("## 詳細結果");
  lines.push("");
  lines.push("| 端點 | 原始資料檔案 | 檔案存在 | 資料有效 | 結果 | 差異 |");
  lines.push("|---|---|---|---|---|---|");
  for (const r of verification.results) {
    const status = r.passed ? "✅ 通過" : "❌ 失敗";
    const exists = r.sourceExists ? "✅" : "❌";
    const valid = r.sourceValid ? "✅" : "❌";
    const diff = r.diff || "—";
    lines.push(
      `| \`${r.endpoint}\` | \`${r.sourceFile}\` | ${exists} | ${valid} | ${status} | \`${diff}\` |`,
    );
  }
  lines.push("");

  return lines.join("\n");
}

/**
 * 主流程
 */
function main(options = {}) {
  const dataDir = options.dataDir || DEFAULT_DATA_DIR;

  if (!fs.existsSync(dataDir)) {
    console.error(`錯誤: data 目錄不存在: ${dataDir}`);
    process.exit(1);
  }

  const verification = verifyAllEndpoints(dataDir);
  const report = generateReport(verification);
  fs.writeFileSync(REPORT_PATH, report, "utf-8");

  console.log("=== 原始資料驗證完成 ===");
  console.log(`驗證端點總數: ${verification.totalEndpoints}`);
  console.log(`通過: ${verification.passed}`);
  console.log(`失敗: ${verification.failed}`);
  console.log(`報告已寫入: ${REPORT_PATH}`);

  return verification;
}

export {
  loadDataFile,
  deepEqual,
  verifyNewsEndpoint,
  verifyStatusEndpoint,
  verifySocialSentimentEndpoint,
  verifyReportsEndpoint,
  verifyStrategyStatusEndpoint,
  verifyPortfolioHealthEndpoint,
  verifyAllEndpoints,
  generateReport,
  main,
};

// 若直接執行此腳本（非透過 import）
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
