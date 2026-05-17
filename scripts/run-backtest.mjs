// scripts/run-backtest.mjs
import { BacktestRunner } from "../src/modules/backtest/backtestRunner.mjs";

async function main() {
  console.log("--- \u{1F3C1} 啟動 InvestmentLineNotify 回測系統 ---");

  // 初始化回測：初始資金 100 萬，質押利率 2.2%
  const runner = new BacktestRunner({
    initialCash: 1000000,
    interestRate: 0.022,
  });

  try {
    await runner.run();
    console.log("\u2705 回測作業完成.");
  } catch (error) {
    console.error("\u274C 回測執行失敗:", error);
  }
}

main();
