import { computeEntryScore } from "../src/modules/strategy/policies/entryScoringPolicy.mjs";

const mockStrategy = {
  buy: {
    kd: {
      oversoldK: 20,
      crossLevelThreshold: 50,
      lookbackDays: 10,
      score: 2,
    },
    rsi: { oversold: 30, score: 3 },
    macd: { score: 2 },
  },
};

const mockDataHigh = {
  kdArr: [
    { k: 91, d: 92 }, // yesterday
    { k: 93, d: 91.5 }, // today, cross up at high level
  ],
  rsiArr: [50, 50],
  macdArr: [
    { MACD: 0, signal: 1, histogram: -1 },
    { MACD: 1, signal: 0, histogram: 1 },
  ],
};

// Case 1: High level cross, should be 0 even if recent low existed
const res1 = computeEntryScore(mockDataHigh, 0, mockStrategy, {});
console.log(
  "Case 1 (K=93, High cross):",
  res1.weightDetails.kdScore === 0 ? "✅ Passed" : "❌ Failed",
  `(Score: ${res1.weightDetails.kdScore})`,
);

// Case 2: Low level cross (K=35) with recent low (K=15)
const mockDataLow = {
  kdArr: [
    { k: 15, d: 20 }, // 10 days ago (within lookback)
    { k: 25, d: 30 },
    { k: 30, d: 35 },
    { k: 35, d: 32 }, // today, cross up at K=35
  ],
  rsiArr: [50, 50],
  macdArr: [],
};
const res2 = computeEntryScore(mockDataLow, 0, mockStrategy, {});
console.log(
  "Case 2 (K=35, Recent low 15):",
  res2.weightDetails.kdScore === 2 ? "✅ Passed" : "❌ Failed",
  `(Score: ${res2.weightDetails.kdScore})`,
);

// Case 3: Low level cross (K=35) WITHOUT recent low
const mockDataNoLow = {
  kdArr: [
    { k: 30, d: 40 }, // no K <= 20
    { k: 35, d: 32 }, // today, cross up at K=35
  ],
  rsiArr: [50, 50],
  macdArr: [],
};
const res3 = computeEntryScore(mockDataNoLow, 0, mockStrategy, {});
console.log(
  "Case 3 (K=35, No recent low):",
  res3.weightDetails.kdScore === 0 ? "✅ Passed" : "❌ Failed",
  `(Score: ${res3.weightDetails.kdScore})`,
);
