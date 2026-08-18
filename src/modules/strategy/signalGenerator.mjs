import logger from "../../utils/logger.mjs";

function mean(arr) {
  const valid = arr.filter(Number.isFinite);
  if (!valid.length) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function stdDev(arr, avg) {
  const valid = arr.filter(Number.isFinite);
  if (valid.length < 2) return 0;
  const squareDiffs = valid.map((v) => Math.pow(v - avg, 2));
  return Math.sqrt(mean(squareDiffs));
}

export function normalizeBounded(val, mid = 50, range = 50) {
  if (!Number.isFinite(val)) return 0;
  return (val - mid) / range;
}

export function normalizeUnbounded(val, history) {
  if (!Number.isFinite(val)) return 0;
  const validHistory = (history || []).filter(Number.isFinite);
  if (validHistory.length < 5) return 0;
  const avg = mean(validHistory);
  const sd = stdDev(validHistory, avg);
  if (sd === 0) return 0;
  const zScore = (val - avg) / sd;
  return Math.tanh(zScore);
}

// 動態計算最近 5 日的趨勢強度 (0~1)
function computeShortTermMomentum(closeArr) {
  if (!closeArr || closeArr.length < 6) return 0;
  const current = closeArr[closeArr.length - 1];
  const past = closeArr[closeArr.length - 6]; // 5天前
  if (current > past) {
    // 如果 5 天漲幅超過 2%，給予滿分動能 1.0
    return Math.min(1.0, (current - past) / past / 0.02);
  }
  return 0; // 沒漲或是跌，就是 0
}

export function generateScoringMatrix(
  indicators,
  priceDropPercent,
  strategy,
  extraData = {},
  _macroSentiment = null,
) {
  const config = strategy.scoringMatrix;

  if (!config?.enabled) {
    return {
      finalScore: 0,
      signal: "neutral",
      scalingRatio: 0,
      signalDirection: "hold",
      categoryResults: {},
      factorPool: {},
      config: config?.thresholds ?? {},
      disabled: true,
    };
  }

  const categories = config.categories;
  const thresholds = config.thresholds;
  const lookback = config.normalization.lookbackDays || 20;

  const categoryResults = {};
  let finalScore = 0;

  const processCategory = (catKey, factors) => {
    const catCfg = categories[catKey];
    let groupRawScore = 0;
    const catDetails = [];

    for (const [fKey, weight] of Object.entries(catCfg.weights)) {
      const normVal = factors[fKey] || 0;
      const contrib = normVal * weight;
      groupRawScore += contrib;
      catDetails.push({
        factor: fKey,
        norm: +normVal.toFixed(4),
        weight,
        score: +contrib.toFixed(4),
      });
    }

    const cap = catCfg.cap;
    const finalGroupScore = Math.max(-cap, Math.min(cap, groupRawScore));
    categoryResults[catKey] = {
      label: catCfg.label,
      rawScore: groupRawScore,
      finalScore: finalGroupScore,
      details: catDetails,
      isCapped: Math.abs(groupRawScore) > cap,
    };

    return finalGroupScore;
  };

  const macdHistArr = (indicators.macdArr || [])
    .map((m) => m.histogram)
    .filter(Number.isFinite);

  // 取得外部注入（或我們自己算）的斜率
  const ma60SlopeArr =
    extraData.ma60SlopeHistory || extraData.ma60SlopeArr || [];

  const factorPool = {
    priceDrop: Math.min(1.0, Math.sqrt((priceDropPercent || 0) / 40)),
    // 【P1】牛市動能補分：近 20 日漲幅正規化（0~1），漲 10% 得滿分
    // 讓 valuationValue 組在無跌幅的牛市中仍能獲得最多 2 分（而非恆為 0）
    bullMomentum: (() => {
      const arr = extraData.closeArr || [];
      if (arr.length < 21) return 0;
      const ret = (arr.at(-1) - arr.at(-21)) / arr.at(-21);
      return Math.max(0, Math.min(1, ret / 0.1)); // 漲 10% 得 1.0，跌則為 0
    })(),
    macd: normalizeUnbounded(
      macdHistArr.at(-1),
      macdHistArr.slice(-lookback - 1, -1),
    ),
    ma60Slope: normalizeUnbounded(
      ma60SlopeArr.at(-1),
      ma60SlopeArr.slice(-lookback - 1, -1),
    ),
    institutional: normalizeUnbounded(
      extraData.institutionalNet,
      (extraData.institutionalHistory || []).slice(-lookback - 1, -1),
    ),
    sentiment: Math.max(-1, Math.min(1, extraData.sentimentScore || 0)),
    rsi: normalizeBounded(50 - (indicators.rsiArr?.at(-1) ?? 50), 0, 50),
    kd: normalizeBounded(50 - (indicators.kdArr?.at(-1)?.k ?? 50), 0, 50),
  };

  // 【核心重構：雙軌動能補償機制】
  // 當長期處於牛市且無深跌時，priceDrop 會是 0。這時我們必須引入動能分數。
  // 我們利用傳入的 raw 收盤價來自己計算短線動能。
  if (
    factorPool.ma60Slope === 0 &&
    Array.isArray(ma60SlopeArr) &&
    ma60SlopeArr.length > 0
  ) {
    const lastVal = ma60SlopeArr.at(-1);
    if (lastVal > 0) factorPool.ma60Slope = Math.min(1.0, lastVal / 0.1);
    else if (lastVal < 0) factorPool.ma60Slope = Math.max(-1.0, lastVal / 0.1);
  }

  // 若還是 0（可能沒傳ma60Slope），我們自食其力算短期動能來代替 ma60Slope
  if (factorPool.ma60Slope === 0 && extraData.closeArr) {
    factorPool.ma60Slope = computeShortTermMomentum(extraData.closeArr);
  }

  // 若法人資料缺失（回測常見），我們將法人權重轉移到技術面，避免總分無故少掉 8 分
  const isInstitutionalMissing =
    factorPool.institutional === 0 &&
    (!extraData.institutionalHistory ||
      extraData.institutionalHistory.length < 5);

  for (const catKey of Object.keys(categories)) {
    // 轉移權重邏輯
    if (isInstitutionalMissing && catKey === "technicalTrend") {
      // 把流失的 5 分借兵給趨勢組（動態調高 cap 並將分數墊高）
      const origScore = processCategory(catKey, factorPool);
      // 動態補貼：看動能表現給予 0~2 分不等的補貼
      categoryResults[catKey].finalScore = Math.min(
        categories[catKey].cap + 2,
        origScore + factorPool.ma60Slope * 2,
      );
      finalScore += categoryResults[catKey].finalScore;
    } else {
      finalScore += processCategory(catKey, factorPool);
    }
  }

  let signal = "neutral";
  let scalingRatio = 0.0;
  let synergyBoostApplied = false;

  const isBullishTrend = factorPool.ma60Slope > 0;
  const OVERHEAT_PR_THRESHOLD = thresholds.overheatPR ?? 90;
  const isOverheat = (extraData.currentPR ?? 0) >= OVERHEAT_PR_THRESHOLD;
  const buyThreshold =
    isBullishTrend && !isOverheat && thresholds.buyTacticalBullish
      ? thresholds.buyTacticalBullish
      : thresholds.buyTactical;

  if (finalScore >= buyThreshold) {
    signal = "buy_tactical";
    const sc = thresholds.scaling;

    let currentTier = 1;
    if (finalScore >= sc.tier3.score) currentTier = 3;
    else if (finalScore >= sc.tier2.score) currentTier = 2;
    else currentTier = 1;

    const synCfg = strategy.valuationMomentum?.synergy;
    if (synCfg) {
      const currentPR = extraData.currentPR ?? 100;
      const currentMacd = macdHistArr.at(-1) ?? 0;
      const prevMacd = macdHistArr.at(-2) ?? 0;

      const isValuationSafe = currentPR < synCfg.safePRThreshold;
      const isMacdRising = currentMacd > prevMacd;
      const isMacdPositive = synCfg.macdPositiveRequired
        ? currentMacd > 0
        : true;

      if (isValuationSafe && isMacdRising && isMacdPositive) {
        currentTier = Math.min(3, currentTier + synCfg.scalingTierBoost);
        synergyBoostApplied = true;

        categoryResults["synergyBoost"] = {
          label: "🚀 動能共振：配置升級",
          rawScore: 0,
          finalScore: 0,
          details: [],
          isCapped: false,
        };
      }
    }

    if (currentTier === 3) scalingRatio = sc.tier3.ratio;
    else if (currentTier === 2) scalingRatio = sc.tier2.ratio;
    else scalingRatio = sc.tier1.ratio;
  } else if (finalScore <= thresholds.sellTactical) {
    signal = "sell_tactical";
    scalingRatio = 1.0;
  } else if (
    extraData.hasTacticalPosition &&
    finalScore < thresholds.hysteresisExit
  ) {
    signal = "exit_buffer";
    scalingRatio = 0.0;
  }

  const signalDirection =
    signal === "buy_tactical"
      ? "long"
      : signal === "sell_tactical"
        ? "short"
        : signal === "exit_buffer"
          ? "short"
          : "hold";

  return {
    finalScore,
    signal,
    scalingRatio,
    signalDirection,
    categoryResults,
    factorPool,
    config: thresholds,
    synergyBoostApplied,
  };
}
