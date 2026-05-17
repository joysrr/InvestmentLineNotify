import { BacktestRunner } from "../src/modules/backtest/backtestRunner.mjs";

const plans = [
  {
    name: "方案 0 (Baseline 原廠)",
    buyTactical: 4.0,
    buyTacticalBullish: 4.0,
    buyAmount: 100000,
    useScaling: false,
    quiet: true,
  },
  {
    name: "方案 1 (動能順勢 Trend-Rider)",
    buyTactical: 4.0,
    buyTacticalBullish: 1.5, // 牛市門檻極低
    buyAmount: 100000,
    useScaling: false,
    quiet: true,
  },
  {
    name: "方案 2 (積極穩健 Aggressive Steps)",
    buyTactical: 0.8, // 所有市況門檻極低
    buyTacticalBullish: 0.8,
    buyAmount: 50000, // 單筆減半
    useScaling: false,
    quiet: true,
  },
  {
    name: "方案 3 (動態縮放 Dynamic Scaling)",
    buyTactical: 1.2,
    buyTacticalBullish: 1.2,
    buyAmount: 80000, // 基準額
    useScaling: true, // 依據分數加權倍率
    quiet: true,
  },
];

async function runOptimization() {
  console.log("🚀 開始策略分組優化測試...");
  const results = [];

  for (const plan of plans) {
    console.log(`\n▶️ 正在評估: ${plan.name} ...`);
    const runner = new BacktestRunner(plan);
    const summary = await runner.run();
    results.push(summary);
  }

  console.log("\n============================================================");
  console.log("📊 策略優化測試報告 (2025-04 ~ 2026-04 牛市段)");
  console.log("============================================================");

  // 輸出表格
  console.table(
    results.map((r) => ({
      策略方案: r.name,
      "總報酬率 (%)": r.returnPct.toFixed(2) + "%",
      "最終淨值 (NT$)": Math.round(r.finalNetAsset).toLocaleString(),
      "00675L 持股": r.qtyZ2,
      最終槓桿倍數: r.finalLeverage.toFixed(2) + "x",
    })),
  );

  console.log("\n💡 分析建議：");
  console.log("這段時間是「高估值 + 牛市緩漲」行情。");
}

runOptimization().catch(console.error);
