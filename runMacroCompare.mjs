// runMacroCompare.mjs
// MacroSentiment 三模式比較回測 CLI Runner
// 用法：
//   node runMacroCompare.mjs --start 2025-01-01 --end 2025-12-31 [--modes disabled,enabled,simulated_bull,simulated_bear,simulated_neutral]

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import {
  runMacroSentimentComparison,
  generateComparisonReport,
  generateComparisonCSV,
  MACRO_MODES,
} from "./src/modules/backtest/backtestMacroSentimentCompare.mjs";
import { archiveManager } from "./src/modules/data/archiveManager.mjs";
import logger from "./src/utils/logger.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname);
const BACKTEST_DIR = resolve(PROJECT_ROOT, "data/backtest");

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
  --disable-guards       關閉估值守衛/進場門檻 (預設開啟，觀察純計分矩陣)
  --enable-guards        開啟所有守衛 (對齊實盤)
  --initial-cash N       起始現金 (預設 0)
  --monthly-dca N        每月 DCA 金額 (預設 30000)
  --pledge-ratio N       質押折數 (預設 0.6)
  --interest-rate N      年化利率 (預設 0.022)
  --modes LIST           要比較的模式，逗號分隔 (預設: disabled,enabled,simulated_bull,simulated_bear,simulated_neutral)
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

async function main() {
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

  if (config.start > config.end) {
    console.error("❌ 開始日期不能晚於結束日期");
    process.exit(1);
  }

  // 驗證模式
  const validModes = Object.keys(MACRO_MODES);
  for (const mode of config.modes) {
    if (!validModes.includes(mode)) {
      console.error(`❌ 無效模式: ${mode}，有效模式: ${validModes.join(", ")}`);
      process.exit(1);
    }
  }

  console.log(
    `🚀 [MacroCompare] 開始 ${config.modes.length} 模式比較回測: ${config.name}`,
  );
  console.log(`   期間: ${config.start} ~ ${config.end}`);
  console.log(
    `   守衛模式: ${config.disableGuards ? "關閉 (觀察計分矩陣)" : "開啟 (對齊實盤)"}`,
  );
  console.log(
    `   參數: DCA=${config.monthlyDca}, pledgeRatio=${config.pledgeRatio}, rate=${config.interestRate}`,
  );
  console.log(`   模式: ${config.modes.join(", ")}`);

  try {
    // 1. 從 archiveManager 載入歷史報告
    console.log(
      `\n📂 [MacroCompare] 載入歷史報告 (${config.start} ~ ${config.end})...`,
    );
    const reports = await archiveManager.getArchiveRecords({
      start: config.start,
      end: config.end,
    });

    if (reports.length === 0) {
      console.error(
        `❌ 找不到指定日期範圍內的報告: ${config.start} ~ ${config.end}`,
      );
      process.exit(1);
    }

    console.log(`✅ [MacroCompare] 載入 ${reports.length} 份報告`);

    // 2. 建構 timeline
    const timeline = reports.map((r) => ({
      date: r.date,
      price0050: r.signals?.price0050 ?? r.price0050,
      price00675L: r.signals?.currentPrice ?? r.currentPrice,
      vix: r.marketState?.sentiment?.vix ?? r.VIX,
      pb: r.marketState?.valuation?.pb ?? r.rawValuation?.pb,
    }));

    // 確保 backtest 目錄存在
    const fs = await import("fs/promises");
    await fs.mkdir(BACKTEST_DIR, { recursive: true });

    // 寫入暫存 timeline 檔
    const timelinePath = resolve(BACKTEST_DIR, "timeline.json");
    await fs.writeFile(timelinePath, JSON.stringify(timeline, null, 2));
    console.log(
      `📝 [MacroCompare] Timeline 已寫入: ${timelinePath} (${timeline.length} 筆)`,
    );

    // 3. 執行三模式比較
    const comparisonResult = await runMacroSentimentComparison(
      config,
      config.modes,
    );

    // 4. 輸出控制台摘要
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

    // 5. 生成報表
    const timestamp = new Date().toISOString().split("T")[0];
    const mdPath = resolve(
      BACKTEST_DIR,
      `macro_compare_${config.name}_${config.start}_${config.end}_${timestamp}_report.md`,
    );
    const mdContent = generateComparisonReport(comparisonResult);
    await fs.writeFile(mdPath, mdContent);
    console.log(`\n📄 [MacroCompare] Markdown 報告: ${mdPath}`);

    const csvPath = await generateComparisonCSV(comparisonResult, BACKTEST_DIR);
    console.log(`📄 [MacroCompare] CSV 報告: ${csvPath}`);

    // 6. 生成各模式的詳細 SignalCategory 報表
    for (const r of comparisonResult.results) {
      if (!r.error && r.runner) {
        const stats = r.runner.calculateSignalCategoryStats();
        const { generateSignalCategoryReports } =
          await import("./src/modules/backtest/backtestSignalCategoryStats.mjs");
        await generateSignalCategoryReports(stats, BACKTEST_DIR);
      }
    }

    console.log("\n✅ [MacroCompare] 比較回測完成");
  } catch (err) {
    logger.error(err, "❌ [MacroCompare] 執行失敗");
    process.exit(1);
  }
}

main();
