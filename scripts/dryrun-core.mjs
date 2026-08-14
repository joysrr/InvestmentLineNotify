// scripts/dryrun-core.mjs
// 上線前核心計算 Dry-run: 略過 Telegram 通知與 AI Judge
// 使用測試 fixture + mock 來跳過需要 13 個月歷史資料的檢查

import fs from "fs";
import { runForwardSimulation } from "../src/modules/simulator/forwardSimulator.mjs";
import { runReverseEngine } from "../src/modules/simulator/reverseEngine.mjs";

// ============================================================
// 載入今日市場快取
// ============================================================
let cachedMarket = { data: {} };
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
// 構建 SimulationInput (略過歷史驗證)
// ============================================================
console.log(`\n⏳ [Stage 1/3] 構建 SimulationInput (略過歷史驗證)...`);

// 構造一個有效的 SimulationInput (直接給 forwardSimulator 需要的格式)
const simulationInput = {
  date: today,
  price0050: PRICE_0050,
  currentPrice: PRICE_Z2,
  basePrice: PRICE_0050,
  basePriceZ2: PRICE_Z2,
  portfolio: PORTFOLIO,
  history0050: [],
  historyZ2: [],
  rawCnn: cnn,
  rawUsMarket: { vix: parseFloat(us.vix) || 14.5, ...us },
  rawValuation: valuation,
  rawFx: fx,
  rawMarketOverview: tw,
  VIX: parseFloat(us.vix) || 14.5,
  cnnScore: cnn.score || 66,
  currentRate: fx.currentRate || 31.95,
};
console.log(`✅ SimulationInput 構建完成`);

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
console.log(`   淨值: $${(forwardResult.netValue || 0).toLocaleString()}`);
console.log(
  `   總資產: $${(forwardResult.portfolioValue || 0).toLocaleString()}`,
);
console.log(`   維持率: ${forwardResult.maintenanceRatio?.toFixed(2)}%`);
console.log(`   槓桿倍數: ${forwardResult.leverageRatio?.toFixed(2)}x`);
if (forwardResult.annualizedReturn !== undefined) {
  console.log(`   年化報酬: ${forwardResult.annualizedReturn?.toFixed(2)}%`);
}

const signals = forwardResult.signals || [];
console.log(`\n   🚦 訊號數: ${signals.length}`);
const actionCounts = {};
for (const s of signals) {
  actionCounts[s.signalType] = (actionCounts[s.signalType] || 0) + 1;
}
for (const [type, count] of Object.entries(actionCounts)) {
  console.log(`      - ${type}: ${count}`);
}

if (forwardResult.action) {
  console.log(`\n   🎯 最終行動建議:`);
  console.log(`      動作: ${forwardResult.action.action || "hold"}`);
  if (forwardResult.action.reason) {
    console.log(`      原因: ${forwardResult.action.reason.substring(0, 120)}`);
  }
}

// ============================================================
// 階段 3: 反向模擬
// ============================================================
console.log(`\n⏳ [Stage 3/3] 執行反向模擬...`);
const reverseStart = Date.now();
const reverseResult = await runReverseEngine({
  date: today,
  price0050: PRICE_0050,
  currentPrice: PRICE_Z2,
  portfolio: PORTFOLIO,
  basePrice0050: 50.0,
  currentAge: 35,
  yearsToRetirement: 25,
  desiredMaintenanceRatio: 200,
});
const reverseDuration = Date.now() - reverseStart;

console.log(`✅ 反向模擬完成 (耗時 ${reverseDuration}ms)\n`);
console.log(`📤 反向模擬結果:`);
if (reverseResult) {
  console.log(JSON.stringify(reverseResult, null, 2).substring(0, 500));
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
console.log(`🚫 13 個月歷史驗證: 略過 (Dry-run)`);
console.log(`================================================\n`);
