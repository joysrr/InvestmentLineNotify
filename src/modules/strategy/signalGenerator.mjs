import logger from "../../utils/logger.mjs";

/**
 * signalGenerator.mjs
 * 負責指標標準化 (Normalization)、群組權重聚合 (Category Weighting) 與部位縮放計算。
 * 實作使用者建議的 Best Practices：
 * 1. 有界與無界指標標準化
 * 2. 資料缺失 Fallback 為 0
 * 3. 群組上限 (Category Caps) 防範共線性
 * 4. 部位線性縮放 (Position Sizing Scaling)
 */

/**
 * 計算平均值 (含資料缺失處理)
 */
function mean(arr) {
  const valid = arr.filter(Number.isFinite);
  if (!valid.length) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/**
 * 計算標準差 (含資料缺失處理)
 */
function stdDev(arr, avg) {
  const valid = arr.filter(Number.isFinite);
  if (valid.length < 2) return 0;
  const squareDiffs = valid.map((v) => Math.pow(v - avg, 2));
  return Math.sqrt(mean(squareDiffs));
}

/**
 * 有界指標標準化 (線性映射)
 * 若 val 為 NaN，Fallback 為 0 (中性)
 */
export function normalizeBounded(val, mid = 50, range = 50) {
  if (!Number.isFinite(val)) return 0; // Fallback
  return (val - mid) / range;
}

/**
 * 無界指標標準化 (Z-Score + Tanh)
 * 若資料不足或 val 為 NaN，Fallback 為 0 (中性)
 */
export function normalizeUnbounded(val, history) {
  if (!Number.isFinite(val)) return 0; // Fallback

  const validHistory = (history || []).filter(Number.isFinite);
  if (validHistory.length < 5) return 0;

  const avg = mean(validHistory);
  const sd = stdDev(validHistory, avg);

  if (sd === 0) return 0;

  const zScore = (val - avg) / sd;
  return Math.tanh(zScore);
}

/**
 * 核心計分矩陣計算
 * @param {Object} indicators - 由 indicators.mjs 計算出的各類序列
 * @param {number} priceDropPercent - 當前跌幅百分比
 * @param {Object} strategy - 策略配置
 * @param {Object} extraData - 包含法人、情緒、斜率等資料
 * @param {Object} macroSentiment - 宏觀情緒數據（新增）
 */
export function generateScoringMatrix(
  indicators,
  priceDropPercent,
  strategy,
  extraData = {},
  macroSentiment = null,
) {
  const config = strategy.scoringMatrix;

  // 檢查 enabled flag
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

  const scoreDetails = [];
  const categoryResults = {};
  let finalScore = 0;

  /**
   * 輔助函式：計算單一群組的加權分並套用 Cap
   */
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

    // 套用群組上限 (Category Cap)
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

  // --- 1. 定義各因子標準化數值 ---
  const macdHistArr = (indicators.macdArr || [])
    .map((m) => m.histogram)
    .filter(Number.isFinite);

  const ma60SlopeArr = extraData.ma60SlopeHistory || [];

  // 計算宏觀情緒加成（新增）
  let macroSentimentBonus = 0;
  let macroSentimentLabel = "";

  if (macroSentiment && strategy.macroSentiment?.enabled) {
    const ms = strategy.macroSentiment;
    if (macroSentiment.direction === "BULLISH") {
      macroSentimentBonus = ms.bonus ?? 0;
      macroSentimentLabel = `📈 多頭情緒 +${macroSentimentBonus}`;
    } else if (macroSentiment.direction === "BEARISH") {
      macroSentimentBonus = -(ms.penalty ?? 0);
      macroSentimentLabel = `📉 空頭情緒 ${macroSentimentBonus}`;
    }

    // VIX 短路覆蓋
    const vixPanicThreshold = ms.vixOverrideTrigger ?? 28;
    const vixAbsoluteOverride = ms.vixAbsoluteOverride ?? 35;

    if (macroSentiment.vix != null) {
      if (macroSentiment.vix >= vixAbsoluteOverride) {
        // 極端恐慌：強制多頭加成
        macroSentimentBonus = 5;
        macroSentimentLabel = `🚨 VIX 恐慌 ${macroSentiment.vix} -> 強制 +5`;
      } else if (macroSentiment.vix >= vixPanicThreshold && macroSentiment.direction !== "BULLISH") {
        // VIX 恐慌區：額外加成
        macroSentimentBonus += 3;
        macroSentimentLabel += ` | VIX 恐慌 +3`;
      }
    }
  }

  const factorPool = {
    priceDrop: Math.min(1.0, Math.sqrt((priceDropPercent || 0) / 40)),
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
      extraData.institutionalHistory,
    ),
    sentiment: Math.max(-1, Math.min(1, extraData.sentimentScore || 0)),
    rsi: normalizeBounded(50 - (indicators.rsiArr?.at(-1) ?? 50), 0, 50),
    kd: normalizeBounded(50 - (indicators.kdArr?.at(-1)?.k ?? 50), 0, 50),
  };

  const allExpectedKeys = Object.values(categories).flatMap((cat) =>
    Object.keys(cat.weights),
  );
  const missingKeys = [...new Set(allExpectedKeys)].filter(
    (k) => !(k in factorPool),
  );
  if (missingKeys.length > 0) {
    logger.warn({ missingKeys }, `[signalGenerator] factorPool 缺少以下 key: ${missingKeys.join(", ")}，分數將以 0 計算`);
  }

  // --- 2. 依分類聚合分數 ---
  for (const catKey of Object.keys(categories)) {
    finalScore += processCategory(catKey, factorPool);
  }

  // --- 3. 決策與部位縮放 (Position Scaling) ---
  let signal = "neutral";
  let scalingRatio = 0.0;

  // 判斷是否啟動「多頭增益」門檻 (MA60 斜率 > 0 且 估值未過熱)
  const isBullishTrend = (extraData.ma60SlopeHistory?.at(-1) || 0) > 0;
  const OVERHEAT_PR_THRESHOLD = thresholds.overheatPR ?? 90;
  const isOverheat = (extraData.currentPR ?? 0) >= OVERHEAT_PR_THRESHOLD;
  const buyThreshold =
    isBullishTrend && !isOverheat && thresholds.buyTacticalBullish
      ? thresholds.buyTacticalBullish
      : thresholds.buyTactical;

  if (finalScore >= buyThreshold) {
    signal = "buy_tactical";
    // 判斷 Scaling Tier
    const sc = thresholds.scaling;
    if (finalScore >= sc.tier3.score) scalingRatio = sc.tier3.ratio;
    else if (finalScore >= sc.tier2.score) scalingRatio = sc.tier2.ratio;
    else scalingRatio = sc.tier1.ratio;
  } else if (finalScore <= thresholds.sellTactical) {
    signal = "sell_tactical";
    scalingRatio = 1.0; // 賣出目前通常是全數或依據歷史配置，此處標註為強力信號
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
    scalingRatio, // 回傳給引擎決定撥款比例
    signalDirection,
    categoryResults,
    factorPool,
    config: thresholds,
    macroSentimentBonus,
    macroSentimentLabel,
  };
}
