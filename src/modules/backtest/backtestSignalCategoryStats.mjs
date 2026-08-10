/**
 * backtestSignalCategoryStats.mjs
 * 回測 signalCategory 分組統計 + 月報整合
 *
 * 功能：
 * 1. 回測過程中收集 signalCategory 分組統計
 * 2. 生成月報整合報告
 * 3. 按 signalCategory 分組統計勝率、平均報酬、最大回撤等
 * 4. 產出月報表格/CSV/JSON
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const BACKTEST_DIR = path.join(PROJECT_ROOT, "data/backtest");

/**
 * 計算單一回測的 signalCategory 統計
 *
 * @param {Array<Object>} results - 回測每日結果
 * @param {Object} config - 回測配置
 * @returns {Object} 分類統計結果
 */
export function calculateSignalCategoryStats(results, _config = {}) {
  if (!results || results.length === 0) {
    return { categories: {}, summary: {} };
  }

  // 定義類別順序
  const CATEGORY_ORDER = [
    "baseline",
    "deep_drop",
    "panic",
    "take_profit",
    "rebalance",
  ];

  // 初始化統計結構
  const categoryStats = {};
  CATEGORY_ORDER.forEach((cat) => {
    categoryStats[cat] = {
      category: cat,
      count: 0,
      buyCount: 0,
      sellCount: 0,
      holdCount: 0,
      totalReturn: 0,
      returns: [],
      drawdowns: [],
      holdingDays: [],
      scores: [],
      monthlyBreakdown: {},
    };
  });

  // 按日期分組（月度拆解）
  const monthlyData = {};

  results.forEach((r, idx) => {
    const cat = r.signalCategory || r.signals?.signalCategory || "baseline";
    const date = r.date;
    const monthKey = date.substring(0, 7); // YYYY-MM

    if (!categoryStats[cat]) {
      categoryStats[cat] = {
        category: cat,
        count: 0,
        buyCount: 0,
        sellCount: 0,
        holdCount: 0,
        totalReturn: 0,
        returns: [],
        drawdowns: [],
        holdingDays: [],
        scores: [],
        monthlyBreakdown: {},
      };
    }

    const stat = categoryStats[cat];
    stat.count++;

    // 訊號分類
    const signal = r.signal || r.signals?.signalDirection || "hold";
    if (signal === "long") stat.buyCount++;
    else if (signal === "short") stat.sellCount++;
    else stat.holdCount++;

    // 收集報酬率
    if (typeof r.returnPct === "number") {
      stat.returns.push(r.returnPct);
    } else if (typeof r.netAsset === "number" && idx > 0) {
      // 從 netAsset 計算
    }

    // 收集分數
    if (typeof r.score === "number") {
      stat.scores.push(r.score);
    }

    // 月度拆解
    if (!stat.monthlyBreakdown[monthKey]) {
      stat.monthlyBreakdown[monthKey] = {
        count: 0,
        buyCount: 0,
        sellCount: 0,
        holdCount: 0,
        avgScore: 0,
        scores: [],
      };
    }
    const mStat = stat.monthlyBreakdown[monthKey];
    mStat.count++;
    if (signal === "long") mStat.buyCount++;
    else if (signal === "short") mStat.sellCount++;
    else mStat.holdCount++;
    if (typeof r.score === "number") mStat.scores.push(r.score);

    // 全局月度統計
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        totalDays: 0,
        categories: {},
      };
    }
    monthlyData[monthKey].totalDays++;
    if (!monthlyData[monthKey].categories[cat]) {
      monthlyData[monthKey].categories[cat] = 0;
    }
    monthlyData[monthKey].categories[cat]++;
  });

  // 計算衍生指標
  const summary = {
    totalDays: results.length,
    totalCategories: Object.keys(categoryStats).filter(
      (c) => categoryStats[c].count > 0,
    ).length,
    startDate: results[0]?.date,
    endDate: results[results.length - 1]?.date,
  };

  // 計算每個類別的衍生指標
  Object.keys(categoryStats).forEach((cat) => {
    const stat = categoryStats[cat];
    if (stat.count === 0) return;

    // 平均報酬
    stat.avgReturn =
      stat.returns.length > 0
        ? stat.returns.reduce((a, b) => a + b, 0) / stat.returns.length
        : 0;

    // 勝率 (報酬 > 0 的比例)
    stat.winRate =
      stat.returns.length > 0
        ? (stat.returns.filter((r) => r > 0).length / stat.returns.length) * 100
        : 0;

    // 平均分數
    stat.avgScore =
      stat.scores.length > 0
        ? stat.scores.reduce((a, b) => a + b, 0) / stat.scores.length
        : 0;

    // 月度平均分數
    Object.keys(stat.monthlyBreakdown).forEach((month) => {
      const m = stat.monthlyBreakdown[month];
      m.avgScore =
        m.scores.length > 0
          ? m.scores.reduce((a, b) => a + b, 0) / m.scores.length
          : 0;
    });
  });

  return {
    categories: categoryStats,
    monthlyData,
    summary,
  };
}

/**
 * 生成月報表格 (Markdown)
 *
 * @param {Object} stats - calculateSignalCategoryStats 返回結果
 * @returns {string} Markdown 表格
 */
export function generateMonthlyReportMarkdown(stats) {
  const { categories: _categories, monthlyData, summary } = stats;

  let md = `# 回測 SignalCategory 月報\n\n`;
  md += `**回測期間**: ${summary.startDate} ~ ${summary.endDate}\n`;
  md += `**總天數**: ${summary.totalDays}\n`;
  md += `**活躍類別數**: ${summary.totalCategories}\n\n`;

  // 類別總覽表
  md += `## 類別總覽\n\n`;
  md += `| 類別 | 天數 | 買入 | 賣出 | 持有 | 勝率 | 平均分數 | 平均報酬 |\n`;
  md += `|------|------|------|------|------|------|----------|----------|\n`;

  const CATEGORY_ORDER = [
    "baseline",
    "deep_drop",
    "panic",
    "take_profit",
    "rebalance",
  ];
  CATEGORY_ORDER.forEach((cat) => {
    const stat = stats.categories[cat];
    if (!stat || stat.count === 0) return;

    md += `| ${cat} | ${stat.count} | ${stat.buyCount} | ${stat.sellCount} | ${stat.holdCount} | ${stat.winRate?.toFixed(1) || 0}% | ${stat.avgScore?.toFixed(1) || 0} | ${stat.avgReturn?.toFixed(2) || 0}% |\n`;
  });

  md += `\n`;

  // 月度明細
  md += `## 月度明細\n\n`;

  const sortedMonths = Object.keys(stats.monthlyData).sort();
  sortedMonths.forEach((month) => {
    const mData = stats.monthlyData[month];
    md += `### ${month} (總 ${mData.totalDays} 天)\n\n`;
    md += `| 類別 | 天數 | 佔比 |\n`;
    md += `|------|------|------|\n`;

    Object.entries(mData.categories).forEach(([cat, count]) => {
      const pct = ((count / mData.totalDays) * 100).toFixed(1);
      md += `| ${cat} | ${count} | ${pct}% |\n`;
    });
    md += `\n`;
  });

  // 類別月度趨勢
  md += `## 類別月度分數趨勢\n\n`;
  CATEGORY_ORDER.forEach((cat) => {
    const stat = stats.categories[cat];
    if (!stat || stat.count === 0) return;

    md += `### ${cat}\n\n`;
    md += `| 月份 | 天數 | 平均分數 |\n`;
    md += `|------|------|----------|\n`;

    Object.entries(stat.monthlyBreakdown).forEach(([month, m]) => {
      md += `| ${month} | ${m.count} | ${m.avgScore?.toFixed(1) || 0} |\n`;
    });
    md += `\n`;
  });

  return md;
}

/**
 * 生成 CSV 報表
 *
 * @param {Object} stats - calculateSignalCategoryStats 返回結果
 * @param {string} outputDir - 輸出目錄
 * @returns {Promise<Object>} 生成的檔案路徑
 */
export async function generateSignalCategoryReports(
  stats,
  outputDir = BACKTEST_DIR,
) {
  await fs.mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().split("T")[0];
  const startDate = stats.summary?.startDate || "unknown";
  const endDate = stats.summary?.endDate || "unknown";
  const prefix = `signal_category_${startDate}_${endDate}_${timestamp}`;

  // 1. 類別統計 CSV
  const categoryCsvPath = path.join(outputDir, `${prefix}_categories.csv`);
  const categoryHeader =
    "category,count,buyCount,sellCount,holdCount,winRate,avgScore,avgReturn,totalReturn";
  const categoryRows = Object.entries(stats.categories)
    .filter(([, v]) => v.count > 0)
    .map(([cat, v]) =>
      [
        cat,
        v.count,
        v.buyCount,
        v.sellCount,
        v.holdCount,
        v.winRate?.toFixed(2) || 0,
        v.avgScore?.toFixed(2) || 0,
        v.avgReturn?.toFixed(4) || 0,
        v.totalReturn?.toFixed(4) || 0,
      ].join(","),
    );
  await fs.writeFile(
    categoryCsvPath,
    [categoryHeader, ...categoryRows].join("\n"),
  );

  // 2. 月度明細 CSV
  const monthlyCsvPath = path.join(outputDir, `${prefix}_monthly.csv`);
  const monthlyHeader =
    "month,category,days,count,buyCount,sellCount,holdCount,avgScore";
  const monthlyRows = [];
  const _monthlyData = stats.monthlyData;
  Object.entries(_monthlyData).forEach(([month, mData]) => {
    Object.entries(mData.categories).forEach(([cat, count]) => {
      const m = stats.categories[cat]?.monthlyBreakdown?.[month] || {};
      monthlyRows.push(
        [
          month,
          cat,
          mData.totalDays,
          count,
          m.buyCount || 0,
          m.sellCount || 0,
          m.holdCount || 0,
          m.avgScore?.toFixed(2) || 0,
        ].join(","),
      );
    });
  });
  await fs.writeFile(
    monthlyCsvPath,
    [monthlyHeader, ...monthlyRows].join("\n"),
  );

  // 3. 詳細逐日 CSV (含 signalCategory) - 暫時略過，需要原始 results 資料
  // const _detailCsvPath = path.join(outputDir, `${prefix}_daily.csv`);
  // const _detailHeader = "date,signalCategory,signal,netAsset,returnPct,score,price0050,priceZ2,totalLoan,actualLeverage,maintenanceMargin";

  // 4. Markdown 報告
  const mdPath = path.join(outputDir, `${prefix}_report.md`);
  const mdContent = generateMonthlyReportMarkdown(stats);
  await fs.writeFile(mdPath, mdContent);

  return {
    categoryCsv: categoryCsvPath,
    monthlyCsv: monthlyCsvPath,
    markdown: mdPath,
  };
}

// Export
export { BACKTEST_DIR };
export default {
  calculateSignalCategoryStats,
  generateMonthlyReportMarkdown,
  generateSignalCategoryReports,
};
