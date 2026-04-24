/**
 * mockFactory.mjs
 * 負責產生測試所需的標準化數據物件 (Strategy & Context)
 */

export const createMockStrategy = (overrides = {}) => {
  const base = {
    threshold: {
      z2RatioHigh: 30,
      z2TargetRatio: 0.2,
      minActionableAmount: 10000,
    },
    maintenance: {
      marginCallThreshold: 135,
      frozenZone: 145,
      protectTrigger: 160,
      protectTarget: 180,
    },
    buy: {
      entryGate: {
        enabled: true,
        tiers: [
          {
            minDrop: 0,
            maxDrop: 5,
            allowLeverage: true,
            rsiThreshold: 60,
            note: "Tier 0",
          },
          {
            minDrop: 5,
            maxDrop: 10,
            allowLeverage: true,
            rsiThreshold: 50,
            note: "Tier 1",
          },
        ],
      },
    },
    valuationGuard: {
      enabled: true,
      latch: { triggerPrThreshold: 90 },
      tiers: [
        { minPr: 80, multiplier: 0.5 },
        { minPr: 90, multiplier: 0.3 },
      ],
    },
    scoringMatrix: {
      normalization: { lookbackDays: 20 },
      categories: {
        valuation: { label: "估值價值", weights: { priceDrop: 10 }, cap: 5 },
        technical: { label: "技術趨勢", weights: { macd: 5 }, cap: 5 },
      },
      thresholds: {
        buyTactical: 4,
        sellTactical: -4,
        hysteresisExit: 0,
        scaling: {
          tier1: { score: 4, ratio: 0.3 },
          tier2: { score: 7, ratio: 0.6 },
          tier3: { score: 10, ratio: 1.0 },
        },
      },
    },
  };

  return mergeDeep(base, overrides);
};

export const createMockCtx = (overrides = {}) => {
  const base = {
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
      ma20Arr: Array(30).fill(100),
      closes: Array(30).fill(105),
      rsiArr: Array(30).fill(50),
      kdArr: Array(30).fill({ k: 50, d: 50 }),
      macdArr: Array(30).fill({ histogram: 1 }),
      atrArr: Array(30).fill(5),
    },
    valuation: { pb: 1.5 },
    pbRecords: [1.0, 1.2, 1.4, 1.6, 1.8],
    pbRecordsObjects: Array(30).fill({ pr: 50 }),
    macroSentiment: { direction: "NEUTRAL" },
    cooldownStatus: { inCooldown: false },
  };

  return mergeDeep(base, overrides);
};

/**
 * 簡易深度合併工具
 */
function mergeDeep(target, source) {
  const isObject = (item) =>
    item && typeof item === "object" && !Array.isArray(item);

  if (!isObject(target) || !isObject(source)) {
    return source;
  }

  const output = { ...target };
  Object.keys(source).forEach((key) => {
    if (isObject(target[key]) && isObject(source[key])) {
      output[key] = mergeDeep(target[key], source[key]);
    } else {
      output[key] = source[key];
    }
  });

  return output;
}
