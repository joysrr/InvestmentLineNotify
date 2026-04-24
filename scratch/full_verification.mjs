import { buildDecision } from '../src/modules/strategy/strategyEngine.mjs';

const mockStrategy = {
  threshold: {
    z2RatioHigh: 30,
    z2TargetRatio: 0.2,
    minActionableAmount: 10000
  },
  maintenance: {
    marginCallThreshold: 135,
    frozenZone: 145,
    protectTrigger: 160,
    protectTarget: 180
  },
  buy: {
    entryGate: {
      enabled: true,
      tiers: [
        { minDrop: 0, maxDrop: 5, allowLeverage: true, rsiThreshold: 60, note: "Tier 0" }
      ]
    }
  },
  valuationGuard: { 
    enabled: true,
    latch: { triggerPrThreshold: 90 }
  },
  scoringMatrix: {
    normalization: { lookbackDays: 20 },
    categories: {
      valuation: { label: "估值價值", weights: { priceDrop: 10 }, cap: 5 },
      technical: { label: "技術趨勢", weights: { macd: 5 }, cap: 5 }
    },
    thresholds: {
      buyTactical: 4,
      sellTactical: -4,
      hysteresisExit: 0,
      scaling: {
        tier1: { score: 4, ratio: 0.3 },
        tier2: { score: 7, ratio: 0.6 },
        tier3: { score: 10, ratio: 1.0 }
      }
    }
  }
};

const mockCtxBase = {
  maintenanceMargin: 200,
  z2Ratio: 20,
  netAsset: 1000000,
  currentZ2Value: 200000,
  priceDropPercent: 2,
  rsi: 50,
  vix: 20,
  totalLoan: 500000,
  portfolio: { totalLoan: 500000 },
  indicators: { 
    ma20Arr: [100, 100], 
    closes: [105, 105],
    rsiArr: [50, 50],
    kdArr: [{k: 50, d: 50}],
    macdArr: [{histogram: 1}]
  },
  valuation: { pb: 1.5 },
  pbRecords: [1.0, 1.2, 1.4, 1.6, 1.8],
  pbRecordsObjects: [],
  macroSentiment: { direction: 'NEUTRAL' },
  cooldownStatus: { inCooldown: false }
};

async function runTests() {
  console.log("--- 🧪 Starting Full Verification ---");

  // Case 1: Critical Margin
  console.log("\nCase 1: Critical Margin (< 135%)");
  const ctx1 = { ...mockCtxBase, maintenanceMargin: 130 };
  const res1 = await buildDecision(ctx1, mockStrategy, null);
  console.log("Result:", res1.marketStatus, res1.target);

  // Case 2: Normal Scoring (RSI 50 < 60)
  console.log("\nCase 2: Normal Market (Allowed)");
  const ctx2 = { ...mockCtxBase };
  const res2 = await buildDecision(ctx2, mockStrategy, null);
  console.log("Result:", res2.marketStatus, res2.target);

  // Case 3: Valuation Guard Latch
  console.log("\nCase 3: Valuation Guard Latch (PR 100)");
  const ctx3 = { ...mockCtxBase, valuation: { pb: 2.0 } };
  const res3 = await buildDecision(ctx3, mockStrategy, null);
  console.log("Result:", res3.marketStatus, res3.target);

  console.log("\n--- ✅ Verification Script Finished ---");
}

runTests().catch(console.error);
