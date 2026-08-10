/**
 * backtestMacroSentimentCompare.mjs
 * 回測 MacroSentiment 三模式比較
 *
 * 功能：
 * 1. 支援三種 MacroSentiment 模式：disabled / enabled / simulated
 * 2. 批次執行三組回測並產出比較報表
 * 3. 生成 Markdown/CSV 比較報告
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { BacktestRunner } from "./backtestRunner.mjs";
import { archiveManager } from "../../data/archiveManager.mjs";
import { generateSignalCategoryReports } from "./backtestSignalCategoryStats.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const BACKTEST_DIR = path.join(PROJECT_ROOT, "data/backtest");

/**
 * MacroSentiment 三種比較模式
 * - "disabled": 關閉 MacroSentiment (baseline)
 * - "enabled": 使用策略配置中的 macroSentiment 設定
 * - "simulated": 模擬不同市場環境 (BULL/BEAR/NEUTRAL 強制指定)
 */
const MACRO_MODES = {
  disabled: { name: "MacroSentiment 關閉", macroSentiment: { enabled: false } },
  enabled: { name: "策略配置啟用", macroSentiment: null }, // 使用原配置
  simulated_bull: {
    name: "模擬多頭市場",
    macroSentiment: {
      enabled: true,
      bullishBonus: 15,
      bearishPenalty: 0,
      marketDirection: "BULL",
    },
  },
  simulated_bear: {
    name: "模擬空頭市場",
    macroSentiment: {
      enabled: true,
      bullishBonus: 0,
      bearishPenalty: -15,
      marketDirection: "BEAR",
    },
  },
  simulated_neutral: {
    name: "模擬中性市場",
    macroSentiment: {
      enabled: true,
      bullishBonus: 0,
      bearishPenalty: 0,
      marketDirection: "NEUTRAL",
    },
  },
};

/**
 * 執行單一模式回測
 *
 * @param {Object} baseConfig - 基礎回測配置
 * @param {string} mode - 模式鍵值
 * @returns {Promise<Object>} 回測結果摘要
 */
export async function runSingleModeBacktest(baseConfig, mode) {
  const modeConfig = MACRO_MODES[mode];
  if (!modeConfig) {
    throw new Error(`未知模式: ${mode}`);
  }

  // 建構 timeline
  const reports = await archiveManager.getArchiveRecords({
    start: baseConfig.start,
    end: baseConfig.end,
  });

  if (reports.length === 0) {
    throw new Error(
      `找不到指定日期範圍內的報告: ${baseConfig.start} ~ ${baseConfig.end}`,
    );
  }

  const timeline = reports.map((r) => ({
    date: r.date,
    price0050: r.signals?.price0050 ?? r.price0050,
    price00675L: r.signals?.currentPrice ?? r.currentPrice,
    vix: r.marketState?.sentiment?.vix ?? r.VIX,
    pb: r.marketState?.valuation?.pb ?? r.rawValuation?.pb,
  }));

  // 寫入暫存 timeline
  const timelinePath = path.join(BACKTEST_DIR, "timeline.json");
  await fs.writeFile(timelinePath, JSON.stringify(timeline, null, 2));

  // 準備 runner 配置
  const runnerConfig = {
    ...baseConfig,
    name: `${baseConfig.name}_${mode}`,
    disableGuards: baseConfig.disableGuards !== false,
  };

  // 如果是 simulated 模式，需要修改策略配置
  if (mode.startsWith("simulated_")) {
    const { fetchStrategyConfigUnified } =
      await import("../strategy/strategyLoader.mjs");
    const strategy = await fetchStrategyConfigUnified();
    strategy.macroSentiment = {
      enabled: true,
      bullishBonus: modeConfig.macroSentiment.bullishBonus,
      bearishPenalty: modeConfig.macroSentiment.bearishPenalty,
    };
    // 暫存修改後的策略配置
    const strategyPath = path.join(
      PROJECT_ROOT,
      "data/config/strategyConfig.json",
    );
    const originalStrategy = JSON.parse(
      await fs.readFile(strategyPath, "utf-8"),
    );
    await fs.writeFile(strategyPath, JSON.stringify(strategy, null, 2));

    try {
      const runner = new BacktestRunner(runnerConfig);
      const summary = await runner.run();
      return { mode, modeName: modeConfig.name, summary, runner };
    } finally {
      // 還原原始策略配置
      await fs.writeFile(
        strategyPath,
        JSON.stringify(originalStrategy, null, 2),
      );
    }
  } else if (mode === "disabled") {
    const { fetchStrategyConfigUnified } =
      await import("../strategy/strategyLoader.mjs");
    const strategy = await fetchStrategyConfigUnified();
    const originalStrategy = JSON.parse(
      await fs.readFile(
        path.join(PROJECT_ROOT, "data/config/strategyConfig.json"),
        "utf-8",
      ),
    );
    strategy.macroSentiment = { enabled: false };
    await fs.writeFile(
      path.join(PROJECT_ROOT, "data/config/strategyConfig.json"),
      JSON.stringify(strategy, null, 2),
    );

    try {
      const runner = new BacktestRunner(runnerConfig);
      const summary = await runner.run();
      return { mode, modeName: modeConfig.name, summary, runner };
    } finally {
      await fs.writeFile(
        path.join(PROJECT_ROOT, "data/config/strategyConfig.json"),
        JSON.stringify(originalStrategy, null, 2),
      );
    }
  } else {
    // enabled 模式：使用原配置
    const runner = new BacktestRunner(runnerConfig);
    const summary = await runner.run();
    return { mode, modeName: modeConfig.name, summary, runner };
  }
}

/**
 * 執行三模式比較回測
 *
 * @param {Object} baseConfig - 基礎配置
 * @param {string[]} modes - 要比較的模式陣列
 * @returns {Promise<Object>} 比較結果
 */
export async function runMacroSentimentComparison(
  baseConfig,
  modes = [
    "disabled",
    "enabled",
    "simulated_bull",
    "simulated_bear",
    "simulated_neutral",
  ],
) {
  console.log(`🚀 [MacroCompare] 開始 ${modes.length} 模式比較回測`);
  console.log(`   期間: ${baseConfig.start} ~ ${baseConfig.end}`);
  console.log(`   模式: ${modes.join(", ")}`);

  const results = [];

  for (const mode of modes) {
    console.log(
      `\n📊 [MacroCompare] 執行模式: ${MACRO_MODES[mode].name} (${mode})`,
    );
    try {
      const result = await runSingleModeBacktest(baseConfig, mode);
      results.push(result);
      console.log(
        `   ✅ 完成 - 報酬率: ${result.summary?.returnPct?.toFixed(2) || "N/A"}%`,
      );
    } catch (err) {
      console.error(`   ❌ 失敗: ${err.message}`);
      results.push({
        mode,
        modeName: MACRO_MODES[mode].name,
        error: err.message,
      });
    }
  }

  return { baseConfig, results };
}

/**
 * 生成比較報表 (Markdown)
 *
 * @param {Object} comparisonResult - runMacroSentimentComparison 返回結果
 * @returns {string} Markdown 表格
 */
export function generateComparisonReport(comparisonResult) {
  const { baseConfig, results } = comparisonResult;

  let md = `# 回測 MacroSentiment 三模式比較報告\n\n`;
  md += `**回測期間**: ${baseConfig.start} ~ ${baseConfig.end}\n`;
  md += `**基礎配置**: ${baseConfig.name}\n`;
  md += `**生成時間**: ${new Date().toISOString()}\n\n`;

  // 總表
  md += `## 模式比較總表\n\n`;
  md += `| 模式 | 名稱 | 總報酬率 | 最終淨資產 | 0050持股 | 00675L持股 | 總借款 | 最終槓桿 | 最低維持率 |\n`;
  md += `|------|------|----------|------------|----------|------------|--------|----------|------------|\n`;

  results.forEach((r) => {
    if (r.error) {
      md += `| ${r.mode} | ${r.modeName} | ❌ ${r.error} | - | - | - | - | - | - |\n`;
      return;
    }
    const s = r.summary;
    md += `| ${r.mode} | ${r.modeName} | ${s.returnPct?.toFixed(2) || "N/A"}% | ${s.finalNetAsset?.toFixed(0) || "N/A"} | ${s.qty0050 || "N/A"} | ${s.qtyZ2 || "N/A"} | ${s.totalLoan?.toFixed(0) || "N/A"} | ${s.finalLeverage?.toFixed(2) || "N/A"}x | ${s.minMm === 999 ? "N/A" : s.minMm?.toFixed(1) + "%" || "N/A"} |\n`;
  });

  md += `\n`;

  // 關鍵指標比較
  md += `## 關鍵指標差異分析\n\n`;

  const validResults = results.filter((r) => !r.error && r.summary);
  if (validResults.length >= 2) {
    const baseline =
      validResults.find((r) => r.mode === "disabled") || validResults[0];

    md += `### 相對於 Baseline (${baseline.modeName}) 的差異\n\n`;
    md += `| 模式 | 報酬率差異 | 淨資產差異 | 槓桿差異 | 最低維持率差異 |\n`;
    md += `|------|------------|------------|----------|----------------|\n`;

    validResults.forEach((r) => {
      if (r === baseline) return;
      const diffReturn =
        (r.summary.returnPct || 0) - (baseline.summary.returnPct || 0);
      const diffAsset =
        (r.summary.finalNetAsset || 0) - (baseline.summary.finalNetAsset || 0);
      const diffLeverage =
        (r.summary.finalLeverage || 0) - (baseline.summary.finalLeverage || 0);
      const diffMm =
        baseline.summary.minMm === 999 || r.summary.minMm === 999
          ? "N/A"
          : ((r.summary.minMm || 0) - (baseline.summary.minMm || 0)).toFixed(1);

      md += `| ${r.modeName} | ${diffReturn >= 0 ? "+" : ""}${diffReturn.toFixed(2)}% | ${diffAsset >= 0 ? "+" : ""}${diffAsset.toFixed(0)} | ${diffLeverage >= 0 ? "+" : ""}${diffLeverage.toFixed(2)}x | ${diffMm}% |\n`;
    });

    md += `\n`;
  }

  // SignalCategory 比較
  md += `## SignalCategory 分布比較\n\n`;

  results.forEach((r) => {
    if (r.error || !r.summary?.signalCategoryStats) return;

    md += `### ${r.modeName} (${r.mode})\n\n`;
    const { categories, summary: _statsSummary } =
      r.summary.signalCategoryStats;

    md += `| 類別 | 天數 | 買入 | 賣出 | 持有 | 勝率 | 平均分數 |\n`;
    md += `|------|------|------|------|------|------|----------|\n`;

    const CATEGORY_ORDER = [
      "baseline",
      "deep_drop",
      "panic",
      "take_profit",
      "rebalance",
    ];
    CATEGORY_ORDER.forEach((cat) => {
      const stat = categories[cat];
      if (stat && stat.count > 0) {
        md += `| ${cat} | ${stat.count} | ${stat.buyCount} | ${stat.sellCount} | ${stat.holdCount} | ${stat.winRate?.toFixed(1) || 0}% | ${stat.avgScore?.toFixed(1) || 0} |\n`;
      }
    });
    md += `\n`;
  });

  return md;
}

/**
 * 生成比較 CSV
 *
 * @param {Object} comparisonResult - 比較結果
 * @param {string} outputDir - 輸出目錄
 * @returns {Promise<string>} CSV 檔案路徑
 */
export async function generateComparisonCSV(
  comparisonResult,
  outputDir = BACKTEST_DIR,
) {
  const { baseConfig, results } = comparisonResult;
  const timestamp = new Date().toISOString().split("T")[0];
  const prefix = `macro_compare_${baseConfig.start}_${baseConfig.end}_${timestamp}`;
  const csvPath = path.join(outputDir, `${prefix}.csv`);

  const header =
    "mode,modeName,returnPct,finalNetAsset,qty0050,qtyZ2,totalLoan,finalLeverage,minMm,error";
  const rows = results.map((r) => {
    if (r.error) {
      return `${r.mode},${r.modeName},,,,,,,,"${r.error}"`;
    }
    const s = r.summary;
    return `${r.mode},${r.modeName},${s.returnPct?.toFixed(2) || ""},${s.finalNetAsset?.toFixed(0) || ""},${s.qty0050 || ""},${s.qtyZ2 || ""},${s.totalLoan?.toFixed(0) || ""},${s.finalLeverage?.toFixed(2) || ""},${s.minMm === 999 ? "" : s.minMm?.toFixed(1) || ""},`;
  });

  await fs.writeFile(csvPath, [header, ...rows].join("\n"));
  return csvPath;
}

/**
 * CLI 入口點
 */
export async function main() {
  const args = process.argv.slice(2);
  const config = {
    start: null,
    end: null,
    name: "macro_compare",
    quiet: false,
    disableGuards: true,
    initialCash: 0,
    monthlyDca: 30000,
    pledgeRatio: 0.6,
    interestRate: 0.022,
    modes: [
      "disabled",
      "enabled",
      "simulated_bull",
      "simulated_bear",
      "simulated_neutral",
    ],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--start") config.start = args[++i];
    else if (arg === "--end") config.end = args[++i];
    else if (arg === "--name") config.name = args[++i];
    else if (arg === "--quiet") config.quiet = true;
    else if (arg === "--disable-guards") config.disableGuards = true;
    else if (arg === "--enable-guards") config.disableGuards = false;
    else if (arg === "--initial-cash") config.initialCash = Number(args[++i]);
    else if (arg === "--monthly-dca") config.monthlyDca = Number(args[++i]);
    else if (arg === "--pledge-ratio") config.pledgeRatio = Number(args[++i]);
    else if (arg === "--interest-rate") config.interestRate = Number(args[++i]);
    else if (arg === "--modes") config.modes = args[++i].split(",");
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (!config.start || !config.end) {
    console.error("❌ 必須指定 --start 和 --end 日期");
    printHelp();
    process.exit(1);
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(config.start) || !dateRegex.test(config.end)) {
    console.error("❌ 日期格式必須為 YYYY-MM-DD");
    process.exit(1);
  }

  try {
    const comparisonResult = await runMacroSentimentComparison(
      config,
      config.modes,
    );

    // 輸出控制台摘要
    console.log("\n📊 [MacroCompare] ===== 比較結果摘要 =====");
    comparisonResult.results.forEach((r) => {
      if (r.error) {
        console.log(`   ${r.modeName} (${r.mode}): ❌ ${r.error}`);
      } else {
        const s = r.summary;
        console.log(
          `   ${r.modeName}: 報酬 ${s.returnPct?.toFixed(2) || "N/A"}% | 淨值 ${s.finalNetAsset?.toFixed(0) || "N/A"} | 槓桿 ${s.finalLeverage?.toFixed(2) || "N/A"}x`,
        );
      }
    });

    // 生成報表
    const timestamp = new Date().toISOString().split("T")[0];
    const mdPath = path.join(
      BACKTEST_DIR,
      `macro_compare_${config.start}_${config.end}_${timestamp}_report.md`,
    );
    const mdContent = generateComparisonReport(comparisonResult);
    await fs.writeFile(mdPath, mdContent);
    console.log(`\n📄 [MacroCompare] Markdown 報告: ${mdPath}`);

    const csvPath = await generateComparisonCSV(comparisonResult);
    console.log(`📄 [MacroCompare] CSV 報告: ${csvPath}`);

    // 生成各模式的詳細報表
    for (const r of comparisonResult.results) {
      if (!r.error && r.runner) {
        const stats = r.runner.calculateSignalCategoryStats();
        await generateSignalCategoryReports(stats, BACKTEST_DIR);
      }
    }

    console.log("\n✅ [MacroCompare] 比較回測完成");
  } catch (err) {
    console.error("❌ [MacroCompare] 執行失敗:", err);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
runMacroCompare.mjs - MacroSentiment 三模式比較回測 CLI

用法:
  node runMacroCompare.mjs --start YYYY-MM-DD --end YYYY-MM-DD [options]

必要參數:
  --start YYYY-MM-DD     回測開始日期 (含)
  --end YYYY-MM-DD       回測結束日期 (含)

選項:
  --name STRING          回測名稱 (預設: "macro_compare")
  --quiet                靜默模式
  --disable-guards       關閉估值守衛/進場門檻 (預設開啟)
  --enable-guards        開啟所有守衛
  --initial-cash N       起始現金 (預設 0)
  --monthly-dca N        每月 DCA 金額 (預設 30000)
  --pledge-ratio N       質押折數 (預設 0.6)
  --interest-rate N      年化利率 (預設 0.022)
  --modes LIST           要比較的模式，逗號分隔 (預設: disabled,enabled,simulated_bull,simulated_bear,simulated_neural)
  --help, -h             顯示此說明

模式說明:
  disabled          - 關閉 MacroSentiment (baseline)
  enabled           - 使用策略配置中的 macroSentiment 設定
  simulated_bull    - 強制模擬多頭市場 (bonus=15, penalty=0)
  simulated_bear    - 強制模擬空頭市場 (bonus=0, penalty=15)
  simulated_neutral - 強制模擬中性市場 (bonus=0, penalty=0)

範例:
  # 完整五模式比較
  node runMacroCompare.mjs --start 2024-01-01 --end 2024-12-31

  # 僅比較 disabled vs enabled
  node runMacroCompare.mjs --start 2024-01-01 --end 2024-12-31 --modes disabled,enabled

  # 比較三種模擬模式
  node runMacroCompare.mjs --start 2024-01-01 --end 2024-12-31 --modes simulated_bull,simulated_bear,simulated_neutral
`);
}

// 如果直接執行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { MACRO_MODES };
export default {
  runSingleModeBacktest,
  runMacroSentimentComparison,
  generateComparisonReport,
  generateComparisonCSV,
  MACRO_MODES,
};
