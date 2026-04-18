/**
 * testScoringMatrix.mjs
 * 驗證第四批計畫：評分矩陣與策略引擎整合邏輯
 */

import { generateScoringMatrix } from "../src/modules/strategy/signalGenerator.mjs";

const mockStrategy = {
  scoringMatrix: {
    enabled: true,
    categories: {
      technicalTrend: { label: "技術趨勢組", cap: 4.0, weights: { macd: 2.0, ma60Slope: 1.5 } },
      valuationValue: { label: "估值價值組", cap: 8.0, weights: { priceDrop: 8.0 } },
      flowOfFunds: { label: "籌碼動能組", cap: 4.0, weights: { institutional: 5.0, sentiment: 3.0 } },
      extremeOscillation: { label: "極值震盪組", cap: 2.0, weights: { rsi: 2.0, kd: 2.0 } }
    },
    thresholds: {
      buyTactical: 4.0,
      sellTactical: -4.0,
      hysteresisExit: 2.0,
      scaling: {
        tier1: { score: 4.0, ratio: 0.50 },
        tier2: { score: 6.0, ratio: 0.75 },
        tier3: { score: 8.0, ratio: 1.00 }
      }
    },
    normalization: { lookbackDays: 20 }
  }
};

const mockIndicators = {
  rsiArr: [70, 75, 80, 78, 30], // 最後一筆 30 (超賣，正分)
  kdArr: [{ k: 25, d: 30 }],   // 最後一筆 K=25 (超賣，正分)
  macdArr: Array(30).fill({ histogram: 0.1 }) // MACD 橫盤偏多
};

const mockExtraData = {
  ma60SlopeHistory: Array(30).fill(0.002),
  institutionalNet: 1000000000, // 買超 10E
  institutionalHistory: Array(30).fill(100000000), // 歷史平均 1E，今日爆發
  sentimentScore: 0.5,
  hasTacticalPosition: false
};

function runTest() {
  console.log("=== 測試情境 1: 多頭共振 (Strong Bullish) ===");
  const res1 = generateScoringMatrix(mockIndicators, 15, mockStrategy, mockExtraData);
  console.log(`總分: ${res1.finalScore.toFixed(2)} | 信號: ${res1.signal} | 縮放比: ${res1.scalingRatio}`);
  console.log("群組詳情:", JSON.stringify(res1.categoryResults, null, 2));

  console.log("\n=== 測試情境 2: 資料缺失 (Missing Data Fallback) ===");
  const corruptExtra = { ...mockExtraData, institutionalNet: NaN, sentimentScore: null };
  const res2 = generateScoringMatrix(mockIndicators, 15, mockStrategy, corruptExtra);
  console.log(`總分: ${res2.finalScore.toFixed(2)} | 備註: 籌碼面應回歸中性 (0)`);
  
  console.log("\n=== 測試情境 3: 指標衝突 (Price Drop vs Sentiment) ===");
  const conflictExtra = { ...mockExtraData, sentimentScore: -1.0, institutionalNet: -2000000000 };
  const res3 = generateScoringMatrix(mockIndicators, 5, mockStrategy, conflictExtra);
  console.log(`總分: ${res3.finalScore.toFixed(2)} | 信號: ${res3.signal} (預期應為 neutral)`);

  console.log("\n=== 測試情境 4: 階梯撥款 (Scaling Tiers) ===");
  const topScoreExtra = { ...mockExtraData, institutionalNet: 5000000000 };
  const res4 = generateScoringMatrix(mockIndicators, 30, mockStrategy, topScoreExtra);
  console.log(`總分: ${res4.finalScore.toFixed(2)} | 縮放比: ${res4.scalingRatio} (預期應為 1.0)`);
}

runTest();
