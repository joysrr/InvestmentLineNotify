/**
 * backtestResults.mjs
 * 回測結果查詢、圖表數據生成、CSV 匯出
 *
 * 功能：
 * 1. 查詢歷史回測任務結果
 * 2. 生成圖表數據 (權益曲線、回撤、SignalCategory 分布)
 * 3. CSV/JSON 匯出
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { getAllJobs, getJobStatus } from "./backtestQueue.mjs";
import { _calculateSignalCategoryStats } from "./backtestSignalCategoryStats.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const BACKTEST_DIR = path.join(PROJECT_ROOT, "data/backtest");

/**
 * 查詢回測結果列表
 *
 * @param {Object} filters - 過濾條件
 * @param {string} [filters.status] - 狀態過濾 (completed/failed/running)
 * @param {number} [filters.start] - 開始時間戳
 * @param {number} [filters.end] - 結束時間戳
 * @param {string} [filters.name] - 名稱關鍵字
 * @returns {Promise<Array>} 回測任務列表
 */
export async function queryBacktestResults(filters = {}) {
  const jobs = await getAllJobs();

  let filtered = jobs.filter((job) => {
    if (filters.status && job.status !== filters.status) return false;
    if (filters.start && job.createdAt < filters.start) return false;
    if (filters.end && job.createdAt > filters.end) return false;
    if (filters.name && !job.name.includes(filters.name)) return false;
    return true;
  });

  // 按建立時間倒序
  filtered.sort((a, b) => b.createdAt - a.createdAt);

  return filtered;
}

/**
 * 取得單一回測任務完整結果
 *
 * @param {string} jobId - 任務 ID
 * @returns {Promise<Object|null>} 任務完整資料
 */
export async function getBacktestResult(jobId) {
  const job = await getJobStatus(jobId);
  if (!job) return null;

  // 如果有 runner 實例，計算 signalCategory 統計
  if (job.runner && !job.summary?.signalCategoryStats) {
    job.summary.signalCategoryStats = job.runner.calculateSignalCategoryStats();
  }

  return job;
}

/**
 * 生成圖表數據
 *
 * @param {Object} data - 輸入資料 (results 陣列或 summary 物件)
 * @param {string} type - 圖表類型: "equity" | "drawdown" | "signalCategory" | "comparison"
 * @param {Object} [options] - 選項
 * @returns {Object} ECharts 相容的圖表配置
 */
export function generateChartData(data, type, _options = {}) {
  // 權益曲線
  if (type === "equity") {
    const results = Array.isArray(data) ? data : data?.results || [];
    if (results.length === 0) {
      return {
        labels: [],
        datasets: [{ label: "淨資產", data: [], borderColor: "#26a17b" }],
      };
    }

    const labels = results.map((r) => r.date);
    const equityData = results.map((r) => r.netAsset);

    // 計算基準 (Buy & Hold 0050)
    let benchmarkData = [];
    if (results.length > 0 && results[0].price0050) {
      const initialPrice = results[0].price0050;
      const initialQty = results[0].qty0050 || 0;
      if (initialQty > 0) {
        benchmarkData = results.map(
          (r) => (r.price0050 || initialPrice) * initialQty,
        );
      }
    }

    const datasets = [
      {
        label: "策略淨值",
        data: equityData,
        borderColor: "#26a17b",
        backgroundColor: "rgba(38, 161, 123, 0.1)",
        fill: true,
        tension: 0.2,
      },
    ];

    if (benchmarkData.length > 0) {
      datasets.push({
        label: "基準 (0050 Buy & Hold)",
        data: benchmarkData,
        borderColor: "#3498db",
        borderDash: [5, 5],
        fill: false,
        tension: 0.2,
      });
    }

    return { labels, datasets };
  }

  // 回撤圖
  if (type === "drawdown") {
    const results = Array.isArray(data) ? data : data?.results || [];
    if (results.length === 0) {
      return {
        labels: [],
        datasets: [{ label: "回撤 %", data: [], borderColor: "#e84855" }],
      };
    }

    const labels = results.map((r) => r.date);
    let peak = -Infinity;
    const drawdownData = results.map((r) => {
      if (r.netAsset > peak) peak = r.netAsset;
      const dd = peak > 0 ? ((r.netAsset - peak) / peak) * 100 : 0;
      return Math.min(0, dd); // 回撤為負值或 0
    });

    return {
      labels,
      datasets: [
        {
          label: "回撤 %",
          data: drawdownData,
          borderColor: "#e84855",
          backgroundColor: "rgba(232, 72, 85, 0.1)",
          fill: true,
          tension: 0.2,
        },
      ],
    };
  }

  // SignalCategory 分布
  if (type === "signalCategory") {
    const stats = data?.signalCategoryStats || data;
    const categories = stats?.categories || stats;

    const CAT_ORDER = [
      "baseline",
      "deep_drop",
      "panic",
      "take_profit",
      "rebalance",
    ];
    const validCats = CAT_ORDER.filter((c) => categories[c]?.count > 0);

    const labels = validCats;
    const countData = validCats.map((c) => categories[c].count);
    const winRateData = validCats.map((c) => categories[c].winRate || 0);
    const avgScoreData = validCats.map((c) => categories[c].avgScore || 0);
    const _buyData = validCats.map((c) => categories[c].buyCount || 0);
    const _sellData = validCats.map((c) => categories[c].sellCount || 0);
    const _holdData = validCats.map((c) => categories[c].holdCount || 0);

    return {
      labels,
      datasets: [
        {
          label: "天數",
          data: countData,
          backgroundColor: [
            "#3498db",
            "#e74c3c",
            "#f39c12",
            "#26a17b",
            "#9b59b6",
          ],
          borderRadius: 6,
        },
        {
          label: "勝率 %",
          data: winRateData,
          type: "line",
          yAxisID: "y1",
          borderColor: "#e84855",
          tension: 0.2,
        },
        {
          label: "平均分數",
          data: avgScoreData,
          type: "line",
          yAxisID: "y1",
          borderColor: "#9b59b6",
          borderDash: [5, 5],
          tension: 0.2,
        },
      ],
    };
  }

  // 多任務比較
  if (type === "comparison") {
    const jobs = Array.isArray(data) ? data : [data];
    const labels = jobs.map((j) => j.name || j.jobId);

    return {
      labels,
      datasets: [
        {
          label: "總報酬率 %",
          data: jobs.map((j) => j.summary?.returnPct || 0),
          backgroundColor: "#26a17b",
        },
        {
          label: "最大回撤 %",
          data: jobs.map((j) => {
            // 從結果計算最大回撤
            const results = j.results || [];
            let peak = -Infinity;
            let maxDD = 0;
            for (const r of results) {
              if (r.netAsset > peak) peak = r.netAsset;
              if (peak > 0) {
                const dd = ((r.netAsset - peak) / peak) * 100;
                if (dd < maxDD) maxDD = dd;
              }
            }
            return maxDD;
          }),
          backgroundColor: "#e84855",
        },
        {
          label: "最終槓桿",
          data: jobs.map((j) => j.summary?.finalLeverage || 0),
          type: "line",
          yAxisID: "y1",
          borderColor: "#3498db",
        },
      ],
    };
  }

  return { labels: [], datasets: [] };
}

/**
 * 匯出結果為 CSV
 *
 * @param {Array} results - 回測逐日結果
 * @param {Object} [summary] - 摘要資訊 (可選)
 * @returns {string} CSV 字串
 */
export function exportResultsCSV(results, summary = null) {
  if (!results || results.length === 0) {
    return "date,netAsset,qty0050,qtyZ2,totalLoan,actualLeverage,maintenanceMargin,signalCategory,signalType,price0050,priceZ2\n";
  }

  const header =
    "date,netAsset,qty0050,qtyZ2,totalLoan,actualLeverage,maintenanceMargin,signalCategory,signalType,price0050,priceZ2";

  const rows = results.map((r) =>
    [
      r.date,
      r.netAsset?.toFixed(0) ?? "",
      r.qty0050 ?? "",
      r.qtyZ2 ?? "",
      r.totalLoan?.toFixed(0) ?? "",
      r.actualLeverage?.toFixed(4) ?? "",
      r.maintenanceMargin === 999
        ? ""
        : (r.maintenanceMargin?.toFixed(1) ?? ""),
      r.signalCategory ?? "baseline",
      r.signalType ?? "baseline",
      r.price0050?.toFixed(2) ?? "",
      r.priceZ2?.toFixed(2) ?? "",
    ].join(","),
  );

  let csv = [header, ...rows].join("\n");

  // 附加摘要資訊
  if (summary) {
    csv += "\n\n# Summary\n";
    csv += `returnPct,${summary.returnPct?.toFixed(2)}\n`;
    csv += `finalNetAsset,${summary.finalNetAsset?.toFixed(0)}\n`;
    csv += `qty0050,${summary.qty0050}\n`;
    csv += `qtyZ2,${summary.qtyZ2}\n`;
    csv += `totalLoan,${summary.totalLoan?.toFixed(0)}\n`;
    csv += `finalLeverage,${summary.finalLeverage?.toFixed(2)}\n`;
    csv += `minMm,${summary.minMm === 999 ? "N/A" : summary.minMm?.toFixed(1)}\n`;
  }

  return csv;
}

/**
 * 匯出結果為 JSON
 *
 * @param {Object} job - 完整任務物件
 * @returns {string} JSON 字串
 */
export function exportResultsJSON(job) {
  return JSON.stringify(
    {
      jobId: job.jobId,
      name: job.name,
      config: job.config,
      createdAt: new Date(job.createdAt).toISOString(),
      finishedAt: job.finishedAt
        ? new Date(job.finishedAt).toISOString()
        : null,
      status: job.status,
      summary: job.summary,
      signalCategoryStats: job.summary?.signalCategoryStats,
      results: job.results,
    },
    null,
    2,
  );
}

/**
 * 取得可用的回測結果檔案列表 (CSV/JSON)
 *
 * @returns {Promise<Array>} 檔案列表
 */
export async function listResultFiles() {
  try {
    const files = await fs.readdir(BACKTEST_DIR);
    return files
      .filter(
        (f) =>
          f.startsWith("results_") &&
          (f.endsWith(".csv") || f.endsWith(".json")),
      )
      .map((f) => {
        const stats = fs.statSync(path.join(BACKTEST_DIR, f));
        return {
          name: f,
          path: path.join(BACKTEST_DIR, f),
          size: stats.size,
          createdAt: stats.birthtimeMs,
          modifiedAt: stats.mtimeMs,
        };
      })
      .sort((a, b) => b.modifiedAt - a.modifiedAt);
  } catch {
    return [];
  }
}

export default {
  queryBacktestResults,
  getBacktestResult,
  generateChartData,
  exportResultsCSV,
  exportResultsJSON,
  listResultFiles,
};
