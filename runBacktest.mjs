// runBacktest.mjs
// 回測 CLI Runner
// 用法：
//   node runBacktest.mjs --start 2025-01-01 --end 2025-12-31 [--config name=value...]

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { BacktestRunner } from "./src/modules/backtest/backtestRunner.mjs";
import { archiveManager } from "./src/modules/data/archiveManager.mjs";
import logger from "./src/utils/logger.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname);

// 解析 CLI 參數
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    start: null,
    end: null,
    name: "default",
    quiet: false,
    disableGuards: true,
    buyTactical: null,
    buyTacticalBullish: null,
    disableLoanGuard: false,
    initialCash: 0,
    monthlyDca: 30000,
    pledgeRatio: 0.6,
    interestRate: 0.022,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--start") config.start = args[++i];
    else if (arg === "--end") config.end = args[++i];
    else if (arg === "--name") config.name = args[++i];
    else if (arg === "--quiet") config.quiet = true;
    else if (arg === "--disable-guards") config.disableGuards = true;
    else if (arg === "--enable-guards") config.disableGuards = false;
    else if (arg === "--buy-tactical") config.buyTactical = Number(args[++i]);
    else if (arg === "--buy-tactical-bullish")
      config.buyTacticalBullish = Number(args[++i]);
    else if (arg === "--disable-loan-guard") config.disableLoanGuard = true;
    else if (arg === "--initial-cash") config.initialCash = Number(args[++i]);
    else if (arg === "--monthly-dca") config.monthlyDca = Number(args[++i]);
    else if (arg === "--pledge-ratio") config.pledgeRatio = Number(args[++i]);
    else if (arg === "--interest-rate") config.interestRate = Number(args[++i]);
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return config;
}

function printHelp() {
  console.log(`
runBacktest.mjs - 策略回測 CLI

用法:
  node runBacktest.mjs --start YYYY-MM-DD --end YYYY-MM-DD [options]

必要參數:
  --start YYYY-MM-DD     回測開始日期 (含)
  --end YYYY-MM-DD       回測結束日期 (含)

選項:
  --name STRING          回測名稱 (預設: "default")
  --quiet                靜默模式，減少日誌輸出
  --disable-guards       關閉估值守衛/進場門檻 (預設開啟，觀察純計分矩陣)
  --enable-guards        開啟所有守衛 (對齊實盤)
  --buy-tactical N       覆寫 tactical 買入門檻分數
  --buy-tactical-bullish N  覆寫牛市 tactical 買入門檻
  --disable-loan-guard   關閉動態去槓桿守衛
  --initial-cash N       起始現金 (預設 0)
  --monthly-dca N        每月 DCA 金額 (預設 30000)
  --pledge-ratio N       質押折數 (預設 0.6)
  --interest-rate N      年化利率 (預設 0.022)
  --help, -h             顯示此說明

範例:
  # 基本回測 (觀察純計分矩陣效果)
  node runBacktest.mjs --start 2024-01-01 --end 2024-12-31

  # 完整守衛模式 (對齊實盤)
  node runBacktest.mjs --start 2024-01-01 --end 2024-12-31 --enable-guards

  # 調整參數
  node runBacktest.mjs --start 2024-01-01 --end 2024-12-31 --buy-tactical 4 --monthly-dca 50000
`);
}

async function main() {
  const config = parseArgs();

  if (!config.start || !config.end) {
    console.error("❌ 必須指定 --start 和 --end 日期");
    printHelp();
    process.exit(1);
  }

  // 驗證日期格式
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(config.start) || !dateRegex.test(config.end)) {
    console.error("❌ 日期格式必須為 YYYY-MM-DD");
    process.exit(1);
  }

  if (config.start > config.end) {
    console.error("❌ 開始日期不能晚於結束日期");
    process.exit(1);
  }

  console.log(`🚀 [Backtest] 開始回測: ${config.name}`);
  console.log(`   期間: ${config.start} ~ ${config.end}`);
  console.log(
    `   守衛模式: ${config.disableGuards ? "關閉 (觀察計分矩陣)" : "開啟 (對齊實盤)"}`,
  );
  console.log(
    `   參數: DCA=${config.monthlyDca}, pledgeRatio=${config.pledgeRatio}, rate=${config.interestRate}`,
  );

  try {
    // 1. 從 archiveManager 載入歷史報告
    console.log(
      `📂 [Backtest] 載入歷史報告 (${config.start} ~ ${config.end})...`,
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

    console.log(`✅ [Backtest] 載入 ${reports.length} 份報告`);

    // 2. 建構 timeline (BacktestRunner 所需格式)
    // reports 已由舊到新排序
    const timeline = reports.map((r) => ({
      date: r.date,
      price0050: r.signals?.price0050 ?? r.price0050,
      price00675L: r.signals?.currentPrice ?? r.currentPrice,
      vix: r.marketState?.sentiment?.vix ?? r.VIX,
      pb: r.marketState?.valuation?.pb ?? r.rawValuation?.pb,
    }));

    // 確保 backtest 目錄存在
    const fs = await import("fs/promises");
    const backtestDir = resolve(PROJECT_ROOT, "data/backtest");
    await fs.mkdir(backtestDir, { recursive: true });

    // 寫入暫存 timeline 檔供 BacktestRunner 讀取
    const timelinePath = resolve(backtestDir, "timeline.json");
    await fs.writeFile(timelinePath, JSON.stringify(timeline, null, 2));
    console.log(
      `📝 [Backtest] Timeline 已寫入: ${timelinePath} (${timeline.length} 筆)`,
    );

    // 3. 執行回測
    const runner = new BacktestRunner({
      name: config.name,
      quiet: config.quiet,
      disableGuards: config.disableGuards,
      buyTactical: config.buyTactical,
      buyTacticalBullish: config.buyTacticalBullish,
      disableLoanGuard: config.disableLoanGuard,
      initialCash: config.initialCash,
      monthlyDca: config.monthlyDca,
      pledgeRatio: config.pledgeRatio,
      interestRate: config.interestRate,
    });

    const summary = await runner.run();

    // 4. 輸出結果
    console.log("\n📊 [Backtest] ===== 回測摘要 =====");
    console.log(`   名稱: ${summary.name}`);
    console.log(`   總報酬率: ${summary.returnPct.toFixed(2)}%`);
    console.log(`   最終淨資產: ${summary.finalNetAsset.toFixed(0)}`);
    console.log(`   0050 持股: ${summary.qty0050} 股`);
    console.log(`   00675L 持股: ${summary.qtyZ2} 股`);
    console.log(`   總借款: ${summary.totalLoan.toFixed(0)}`);
    console.log(`   最終槓桿: ${summary.finalLeverage.toFixed(2)}x`);
    console.log(
      `   最低維持率: ${summary.minMm === 999 ? "N/A (無借款)" : summary.minMm.toFixed(1) + "%"}`,
    );

    // 5. 輸出詳細結果 CSV
    const csvPath = resolve(
      PROJECT_ROOT,
      `data/backtest/results_${config.name}_${config.start}_${config.end}.csv`,
    );
    const { results } = runner;
    const csvHeader =
      "date,netAsset,qty0050,qtyZ2,totalLoan,actualLeverage,maintenanceMargin,advice,score,signal,price0050,priceZ2";
    const csvRows = results.map((r) =>
      [
        r.date,
        r.netAsset.toFixed(0),
        r.qty0050,
        r.qtyZ2,
        r.totalLoan.toFixed(0),
        r.actualLeverage.toFixed(4),
        r.maintenanceMargin === 999 ? "" : r.maintenanceMargin.toFixed(1),
        r.advice ?? "",
        r.score ?? "",
        r.signal ?? "",
        r.price0050.toFixed(2),
        r.priceZ2.toFixed(2),
      ].join(","),
    );
    await fs.writeFile(csvPath, [csvHeader, ...csvRows].join("\n"));
    console.log(`\n📄 [Backtest] 詳細結果已輸出 CSV: ${csvPath}`);

    console.log("\n✅ [Backtest] 回測完成");
  } catch (err) {
    logger.error(err, "❌ [Backtest] 執行失敗");
    process.exit(1);
  }
}

main();
