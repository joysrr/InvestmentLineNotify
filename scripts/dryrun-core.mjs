// scripts/dryrun-core.mjs
// 上線前核心計算 Dry-run: 略過 Telegram 通知與 AI Judge
// 使用最新市場快取與歷史資料，重現真實 runForwardSimulation / runReverseEngine 流程

import fs from "fs";
import { buildSimulationInput } from "../src/modules/simulator/dataAdapter.mjs";
import { runForwardSimulation } from "../src/modules/simulator/forwardSimulator.mjs";
import { runReverseEngine } from "../src/modules/simulator/reverseEngine.mjs";

// ============================================================
// 載入今日市場快取 (data/market/latest.json)
// ============================================================
let cachedMarket = { data: {}, _meta: {} };
try {
  cachedMarket = JSON.parse(
    fs.readFileSync("data/market/latest.json", "utf-8"),
  );
} catch (e) {
  console.log("⚠️  無市場快取");
}

const today = cachedMarket._meta?.lastRun?.split("T")[0] || "2026-08-14";

// ============================================================
// 持倉 (範例)
// ============================================================
const PORTFOLIO = {
  qty0050: 1000,
  qtyZ2: 2000,
  cash: 50000,
  totalLoan: 200000,
  maintenanceRatio: 194.79,
  lastBuyDate: "2026-07-15",
};

const PRICE_0050 = 51.85;
const PRICE_Z2 = 32.15;

console.log("\n================================================");
console.log(`🧪 上線前 Dry-run 模擬 (略過 Telegram + AI)`);
console.log("================================================\n");
console.log(`📅 計算日期: ${today}`);
console.log(
  `📊 持倉: 0050=${PORTFOLIO.qty0050}張, 00675L=${PORTFOLIO.qtyZ2}張`,
);
console.log(
  `💰 現金: $${PORTFOLIO.cash.toLocaleString()}, 融資: $${PORTFOLIO.totalLoan.toLocaleString()}`,
);
console.log(`💰 價格: 0050=$${PRICE_0050}, 00675L=$${PRICE_Z2}`);

const cnn = cachedMarket.data?.rawCnn || {};
const us = cachedMarket.data?.rawUsMarket || {};
const valuation = cachedMarket.data?.rawValuation || {};
const tw = cachedMarket.data?.rawMarketOverview || {};
const fx = cachedMarket.data?.rawFx || {};

console.log(`\n📈 市場指標:`);
console.log(
  `   CNN Fear & Greed: ${cnn.score || "N/A"} (${cnn.rating || "N/A"})`,
);
console.log(`   VIX: ${us.vix || "N/A"} (${us.riskLevel || "N/A"})`);
console.log(`   台股 PB: ${valuation.pb || "N/A"}`);
console.log(`   台股 PE: ${valuation.pe || "N/A"}`);

// ============================================================
// 階段 1: 構建 SimulationInput (使用真實 stock_history)
// ============================================================
console.log(`\n⏳ [Stage 1/3] 構建 SimulationInput...`);
const simulationInput = await buildSimulationInput(
  {
    date: today,
    price0050: PRICE_0050,
    currentPrice: PRICE_Z2,
    portfolio: PORTFOLIO,
    rawCnn: cnn,
    rawUsMarket: us,
    rawValuation: valuation,
    rawFx: fx,
    rawMarketOverview: tw,
    rawCpi: cachedMarket.data?.rawCpi || {},
    rawMargin: cachedMarket.data?.rawMargin || {},
  },
  PRICE_0050,
  PRICE_Z2,
);
console.log(`✅ SimulationInput 構建完成`);
console.log(
  `   歷史筆數: 0050=${simulationInput.closeArr0050?.length || 0}, 00675L=${simulationInput.closeArr?.length || 0}`,
);
console.log(
  `   MA240: ${simulationInput.ma240?.toFixed(2)} (quality: ${simulationInput.ma240Quality})`,
);
console.log(`   鍵值: ${Object.keys(simulationInput).sort().join(", ")}`);

// ============================================================
// 階段 2: 正向模擬
// ============================================================
console.log(`\n⏳ [Stage 2/3] 執行正向模擬...`);
const forwardStart = Date.now();
const forwardResult = await runForwardSimulation(
  simulationInput,
  PRICE_0050,
  PRICE_Z2,
);
const forwardDuration = Date.now() - forwardStart;

console.log(`✅ 正向模擬完成 (耗時 ${forwardDuration}ms)\n`);
console.log(`📤 正向模擬結果:`);
console.log(`   計算模式: ${forwardResult.calculationMode || "N/A"}`);
console.log(`   維持率: ${forwardResult.maintenanceMargin?.toFixed(2)}%`);
console.log(
  `   策略評分: ${forwardResult.strategyScore?.toFixed(2) || "N/A"} (${forwardResult.strategyStatus || "N/A"})`,
);
console.log(`   策略建議: ${forwardResult.strategySuggestion || "N/A"}`);
console.log(`   目標價: ${forwardResult.strategyTarget || "N/A"}`);
console.log(`   生命週期: ${forwardResult.lifecycleStage || "N/A"}`);

const portfolioHealth = forwardResult.portfolioHealth || {};
if (portfolioHealth.netValue !== undefined) {
  console.log(`   淨值: $${portfolioHealth.netValue.toLocaleString()}`);
}
if (portfolioHealth.totalAssets !== undefined) {
  console.log(`   總資產: $${portfolioHealth.totalAssets.toLocaleString()}`);
}

const signals = forwardResult.indicators?.signals || [];
console.log(`\n   🚦 訊號數: ${signals.length}`);
const actionCounts = {};
for (const s of signals) {
  actionCounts[s.signalType] = (actionCounts[s.signalType] || 0) + 1;
}
for (const [type, count] of Object.entries(actionCounts)) {
  console.log(`      - ${type}: ${count}`);
}

console.log(`\n   🎯 模擬摘要:`);
console.log(`      假設 0050: $${forwardResult.simulatedPrice0050}`);
console.log(`      假設 00675L: $${forwardResult.simulatedPriceZ2}`);
console.log(`      0050 偏離: ${forwardResult.priceDiffPct0050?.toFixed(2)}%`);
console.log(`      00675L 偏離: ${forwardResult.priceDiffPctZ2?.toFixed(2)}%`);

if (forwardResult.warnings && forwardResult.warnings.length > 0) {
  console.log(`\n   ⚠️  警告:`);
  for (const w of forwardResult.warnings) {
    console.log(`      - ${w}`);
  }
}

// ============================================================
// 階段 3: 反向模擬
// ============================================================
console.log(`\n⏳ [Stage 3/3] 執行反向模擬...`);
const reverseStart = Date.now();
const reverseResult = await runReverseEngine({
  ...simulationInput,
  basePrice0050: PRICE_0050 * 0.95,
  currentAge: 35,
  yearsToRetirement: 25,
  desiredMaintenanceRatio: 200,
});
const reverseDuration = Date.now() - reverseStart;

console.log(`✅ 反向模擬完成 (耗時 ${reverseDuration}ms)\n`);
if (reverseResult) {
  console.log(`📤 反向模擬結果:`);
  const keys = Object.keys(reverseResult).slice(0, 5);
  for (const k of keys) {
    const v = reverseResult[k];
    if (typeof v === "object") {
      console.log(`   ${k}: ${JSON.stringify(v).substring(0, 150)}`);
    } else {
      console.log(`   ${k}: ${v}`);
    }
  }
}

// ============================================================
// 摘要
// ============================================================
console.log(`\n================================================`);
console.log(`📊 Dry-run 摘要`);
console.log(`================================================`);
console.log(`✅ 計算流程: 全部成功`);
console.log(`⏱️  正向模擬: ${forwardDuration}ms`);
console.log(`⏱️  反向模擬: ${reverseDuration}ms`);
console.log(`🚫 Telegram: 略過 (未送出通知)`);
console.log(`🚫 AI Judge: 略過 (未呼叫 LLM)`);
console.log(`================================================\n`);
