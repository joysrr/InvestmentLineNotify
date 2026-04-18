// scratch/testBatch5.mjs
import { buildDecision } from "../src/modules/strategy/strategyEngine.mjs";
import { archiveManager } from "../src/modules/data/archiveManager.mjs";

// Mock archiveManager
archiveManager.getHistoricalLoan = async () => 240000; // 10天前借貸 24萬
archiveManager.getHighsSince = async () => [210, 215]; // 買入後最高來到 215

async function runTest() {
  console.log("🧪 開始驗證第五批計畫：動態停利與預算管控...");

  const mockStrategy = {
    version: "5.0.0",
    sell: {
      ma20StopDays: 2,
      trailingStop: {
        enabled: true,
        anchorType: "ma20",
        activationProfitPct: 0.1,
        stopLossBuffer: 0.02
      }
    },
    trading: {
      budget: {
        maxDailyLoanIncreasePct: 0.05,
        maxRollingLoanIncreasePct: 0.15,
        rollingDays: 10
      }
    },
    maintenance: {
      marginCallThreshold: 135,
      marginHighRiskThreshold: 150,
      marginSafeThreshold: 166
    },
    threshold: {
      rsiLow: 30,
      vixPanic: 35
    },
    scoringMatrix: {
      enabled: true,
      categories: {
        technicalTrend: { label: "技術趨勢組", cap: 4, weights: { macd: 2, ma60Slope: 1.5 } },
        valuationValue: { label: "估值價值組", cap: 8, weights: { priceDrop: 8 } },
        flowOfFunds: { label: "籌碼動能組", cap: 4, weights: { institutional: 5, sentiment: 3 } },
        extremeOscillation: { label: "極值震盪組", cap: 2, weights: { rsi: 2, kd: 2 } }
      },
      thresholds: {
        buyTactical: 4, sellTactical: -4, hysteresisExit: 2,
        scaling: {
          tier1: { score: 4, ratio: 0.5 },
          tier2: { score: 6, ratio: 0.75 },
          tier3: { score: 8, ratio: 1.0 }
        }
      },
      normalization: { lookbackDays: 20 }
    }
  };

  const mockCtx = {
    currentPrice: 200,
    priceDropPercent: 0,
    netAsset: 1000000, // 100萬淨值
    portfolio: {
      qty0050: 1000,
      qtyZ2: 500,
      totalLoan: 250000, // 當前借貸 25萬 (25%)
      lastBuyDate: "2026-04-05",
      avgCostZ2: 170 // 成本 170，現在 200，獲利 > 10%
    },
    z2Ratio: 25, // 持倉佔比 25%，足以啟動監控
    currentZ2Value: 250000,
    indicators: {
      closes: [180, 185, 190, 200],
      ma20Arr: [175, 178, 180, 182],
      rsiArr: [60, 65],
      macdArr: [{ histogram: 1, MACD: 1, signal: 0 }],
      atrArr: [5, 5, 5, 5]
    },
    macroSentiment: { direction: 'BULLISH', bonus: 10 }, // 大幅加分
    institutionalNet: 100000000, 
    priceDropPercent: 8.0 // 大幅跌幅加分
  };

  // 1. 測試預算上限攔截
  // 模擬 10 天前借貸為 24 萬，則滾動增額 = 1萬。
  // 滾動上限 = 100萬 * 15% = 15萬。剩餘額度 = 14萬。
  // 單日上限 = 100萬 * 5% = 5萬。
  // 預期可用 = 5萬。
  
  // 模擬 archiveManager 的回傳 (需要 Mock 或直接測試 buildDecision 中間邏輯)
  // 這裡直接呼叫看輸出結果
  
  console.log("\n--- 場景 1：高分觸發加碼，檢查預算顯示 ---");
  const res1 = await buildDecision(mockCtx, mockStrategy);
  console.log("決策總分:", res1.finalScore.toFixed(1));
  console.log("結果狀態:", res1.marketStatus);
  console.log("建議:", res1.targetSuggestionShort);
  console.log("預算資訊:", JSON.stringify(res1.budgetInfo));

  // 2. 測試動態停利啟動
  console.log("\n--- 場景 2：檢查停利監控狀態 ---");
  console.log("啟動狀態:", res1.trailingActive ? "✅ 已啟動" : "❌ 未啟動");
  console.log("停利錨點:", res1.dynamicAnchor);

  // 3. 測試跌破停利錨點
  console.log("\n--- 場景 3：價格跌破錨點，觸發減碼 ---");
  const mockCtxCrashing = { 
    ...mockCtx, 
    currentPrice: 170, // 跌破 MA20 * 0.98 (約 178)
    portfolio: {
      ...mockCtx.portfolio,
      avgCostZ2: 100 // 獲利已遠超 10%，啟動移動停利
    },
    indicators: {
      ...mockCtx.indicators,
      closes: [180, 182, 175, 170],
      ma20Arr: [180, 180, 180, 180]
    }
  };
  const res2 = await buildDecision(mockCtxCrashing, mockStrategy);
  console.log("結果狀態:", res2.marketStatus);
  console.log("目標:", res2.targetSuggestionShort);
  console.log("理由:", res2.targetSuggestion);

  console.log("\n✅ 驗證完成");
}

runTest().catch(console.error);
