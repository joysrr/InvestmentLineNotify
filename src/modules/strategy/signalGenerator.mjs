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
 */
export function generateScoringMatrix(indicators, priceDropPercent, strategy, extraData = {}) {
  const config = strategy.scoringMatrix;
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
      catDetails.push({ factor: fKey, norm: normVal.toFixed(2), weight, score: contrib.toFixed(2) });
    }

    // 套用群組上限 (Category Cap)
    const cap = catCfg.cap;
    const finalGroupScore = Math.max(-cap, Math.min(cap, groupRawScore));
    
    categoryResults[catKey] = {
      label: catCfg.label,
      rawScore: groupRawScore,
      finalScore: finalGroupScore,
      details: catDetails,
      isCapped: Math.abs(groupRawScore) > cap
    };
    
    return finalGroupScore;
  };

  // --- 1. 定義各因子標準化數值 ---
  const factorPool = {
    // 估值價值組
    priceDrop: Math.min(1.0, (priceDropPercent || 0) / 40),
    
    // 技術趨勢組
    macd: (() => {
      const histArr = (indicators.macdArr || []).map(m => m.histogram).filter(Number.isFinite);
      return normalizeUnbounded(histArr.at(-1), histArr.slice(-lookback - 1, -1));
    })(),
    ma60Slope: (() => {
      const slopeArr = extraData.ma60SlopeHistory || [];
      return normalizeUnbounded(slopeArr.at(-1), slopeArr.slice(-lookback - 1, -1));
    })(),

    // 籌碼動能組
    institutional: normalizeUnbounded(extraData.institutionalNet, extraData.institutionalHistory),
    sentiment: Math.max(-1, Math.min(1, extraData.sentimentScore || 0)),

    // 極值震盪組
    rsi: normalizeBounded(50 - (indicators.rsiArr?.at(-1) || 50), 0, 50),
    kd: normalizeBounded(50 - (indicators.kdArr?.at(-1)?.k || 50), 0, 50)
  };

  // --- 2. 依分類聚合分數 ---
  for (const catKey of Object.keys(categories)) {
    finalScore += processCategory(catKey, factorPool);
  }

  // --- 3. 決策與部位縮放 (Position Scaling) ---
  let signal = "neutral";
  let scalingRatio = 0.0;

  if (finalScore >= thresholds.buyTactical) {
    signal = "buy_tactical";
    // 判斷 Scaling Tier
    const sc = thresholds.scaling;
    if (finalScore >= sc.tier3.score) scalingRatio = sc.tier3.ratio;
    else if (finalScore >= sc.tier2.score) scalingRatio = sc.tier2.ratio;
    else scalingRatio = sc.tier1.ratio;
  } 
  else if (finalScore <= thresholds.sellTactical) {
    signal = "sell_tactical";
    scalingRatio = 1.0; // 賣出目前通常是全數或依據歷史配置，此處標註為強力信號
  } 
  else if (extraData.hasTacticalPosition && finalScore < thresholds.hysteresisExit) {
    signal = "exit_buffer";
    scalingRatio = 0.0;
  }

  return {
    finalScore,
    signal,
    scalingRatio, // 回傳給引擎決定撥款比例
    categoryResults,
    factorPool,
    config: thresholds
  };
}
