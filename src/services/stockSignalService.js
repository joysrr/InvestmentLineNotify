const { fetchStrategyConfig } = require("./strategyConfigService");
const { validateStrategyConfig } = require("./strategyConfigValidator");

/**
 * stockSignalService.js
 *
 * 職責：
 * - 將「價格/指標資料」依照 Strategy.json 的規則，評估出投資訊號與可推播的細節文字。
 *
 * 設計重點：
 * - evaluateInvestmentSignal(...) 是純同步函式：方便單元測試（可直接注入 strategy）。
 * - getInvestmentSignalAsync(...) 會負責載入遠端 strategy，並回傳 evaluateInvestmentSignal 的結果（呼叫端必須 await）。
 */

/**
 * 根據策略設定的 allocation 規則回傳槓桿/現金配置。
 *
 * @param {number} weightScore
 * @param {object} strategy
 * @returns {{leverage:number, cash:number}}
 */
function getLeverageAllocation(weightScore, strategy) {
  const rules = strategy?.allocation || [];
  for (const rule of rules) {
    if (weightScore >= rule.minScore) {
      return { leverage: rule.leverage, cash: rule.cash };
    }
  }
  return { leverage: 0, cash: 1 };
}

/**
 * 將 MACD 計算結果濃縮成 bull/bear/neutral（方便顯示/記錄）
 *
 * @param {Array<{MACD:number, signal:number}>} macdResult
 * @returns {"bull"|"bear"|"neutral"}
 */
function getMACDSignal(macdResult) {
  if (!macdResult?.length) return "neutral";
  const last = macdResult[macdResult.length - 1];
  if (last.MACD > last.signal) return "bull";
  if (last.MACD < last.signal) return "bear";
  return "neutral";
}

/**
 * 依照策略規則評估投資訊號，並輸出「可用於推播」的詳細內容。
 *
 * 注意：這是純同步函式，strategy 必須是已驗證過的物件（建議搭配 validateStrategyConfig）。
 *
 * @param {object} data
 * @param {number} data.priceDropPercent
 * @param {number} data.RSI
 * @param {string} data.MACDSignal
 * @param {number|null} data.KD_K
 * @param {number|null} data.KD_D
 * @param {number} data.currentPrice
 * @param {number} data.basePrice
 * @param {number[]} rsiArr
 * @param {Array<{MACD:number, signal:number, histogram:number}>} macdArr
 * @param {object} strategy
 * @returns {{
 *   suggestion: string,
 *   weightScore: number,
 *   buyDetails: string[],
 *   sellDetails: string[],
 *   allocation: {leverage:number, cash:number},
 *   currentPrice: number,
 *   basePrice: number,
 *   priceDropPercent: number,
 *   RSI: number,
 *   MACDSignal: string,
 *   KD_K: (number|null),
 *   KD_D: (number|null),
 *   priceUpPercent: string,
 *   sellSignalCount: number
 * }}
 */
function evaluateInvestmentSignal(data, rsiArr, macdArr, strategy) {
  let weightScore = 0;
  const buyDetails = [];
  const sellDetails = [];

  // ------- Buy: 跌幅給分 -------
  const dropRules = strategy.buy.dropScoreRules || [];
  const dropRule =
    dropRules.find((r) => data.priceDropPercent >= r.minDrop) || null;

  if (dropRule) {
    weightScore += dropRule.score;
    buyDetails.push(`${dropRule.label}：+${dropRule.score}分`);
  } else {
    buyDetails.push(`跌幅 ${data.priceDropPercent.toFixed(2)}%：無加分`);
  }

  // ------- Buy: RSI 反轉 (<30 → >=30) -------
  const rsiIdx = (rsiArr?.length ?? 0) - 1;
  if (rsiIdx >= 1) {
    const prevRSI = rsiArr[rsiIdx - 1];
    const currRSI = rsiArr[rsiIdx];
    const oversold = strategy.buy.rsi.oversold;

    if (prevRSI < oversold && currRSI >= oversold) {
      weightScore += strategy.buy.rsi.score;
      buyDetails.push(
        `RSI 反轉：${prevRSI.toFixed(2)}(<${oversold}) → ${currRSI.toFixed(2)}(>=${oversold})：+${strategy.buy.rsi.score}分`,
      );
    } else {
      buyDetails.push(
        `RSI 未出現反轉（需 <${oversold} → >=${oversold}；目前 RSI=${currRSI.toFixed(2)}）：無加分`,
      );
    }
  } else {
    buyDetails.push("RSI 資料不足：無法判斷反轉");
  }

  // ------- Buy: MACD 黃金交叉 -------
  const macdIdx = (macdArr?.length ?? 0) - 1;
  if (macdIdx >= 1) {
    const prev = macdArr[macdIdx - 1];
    const curr = macdArr[macdIdx];

    const goldenCross =
      prev.MACD <= prev.signal &&
      curr.MACD > curr.signal &&
      prev.histogram <= 0 &&
      curr.histogram > 0;

    if (goldenCross) {
      weightScore += strategy.buy.macd.score;
      buyDetails.push(`MACD 黃金交叉：+${strategy.buy.macd.score}分`);
    } else {
      buyDetails.push("MACD 未出現黃金交叉：無加分");
    }
  } else {
    buyDetails.push("MACD 資料不足：無法判斷黃金交叉");
  }

  // ------- Buy: KD 低檔轉強 -------
  if (data.KD_K != null && data.KD_D != null) {
    const oversoldK = strategy.buy.kd.oversoldK;

    if (data.KD_K > data.KD_D && data.KD_K < oversoldK) {
      weightScore += strategy.buy.kd.score;
      buyDetails.push(
        `KD 低檔轉強：K=${data.KD_K.toFixed(2)} > D=${data.KD_D.toFixed(2)} 且 K<${oversoldK}：+${strategy.buy.kd.score}分`,
      );
    } else {
      buyDetails.push(
        `KD 未符合低檔轉強：K=${data.KD_K.toFixed(2)}, D=${data.KD_D.toFixed(2)}：無加分`,
      );
    }
  } else {
    buyDetails.push("KD 資料不足：無法判斷低檔轉強");
  }

  const canBuy =
    weightScore >= strategy.buy.minWeightScoreToBuy &&
    data.priceDropPercent >= strategy.buy.minDropPercentToConsider;

  // ------- Sell: 漲幅 + 多訊號 -------
  const priceUpPercent =
    ((data.currentPrice - data.basePrice) / data.basePrice) * 100;
  sellDetails.push(`目前漲幅: ${priceUpPercent.toFixed(2)}%`);

  // RSI 賣出：>=70 → <70
  let rsiSellSignal = false;
  if (rsiIdx >= 1) {
    const prevRSI = rsiArr[rsiIdx - 1];
    const currRSI = rsiArr[rsiIdx];
    const overbought = strategy.sell.rsi.overbought;

    rsiSellSignal = prevRSI >= overbought && currRSI < overbought;
    sellDetails.push(
      rsiSellSignal
        ? `RSI 超買回落（>=${overbought} → <${overbought}）：賣出訊號`
        : "RSI 無賣出訊號",
    );
  } else {
    sellDetails.push("RSI 資料不足：無法判斷賣出訊號");
  }

  // MACD 死叉
  let macdSellSignal = false;
  if (macdIdx >= 1) {
    const prev = macdArr[macdIdx - 1];
    const curr = macdArr[macdIdx];

    macdSellSignal =
      prev.MACD >= prev.signal &&
      curr.MACD < curr.signal &&
      prev.histogram >= 0 &&
      curr.histogram < 0;

    sellDetails.push(
      macdSellSignal ? "MACD 死叉且柱狀圖轉負：賣出訊號" : "MACD 無賣出訊號",
    );
  } else {
    sellDetails.push("MACD 資料不足：無法判斷賣出訊號");
  }

  // KD 高檔轉弱：K < D 且 K > 80
  let kdSellSignal = false;
  if (data.KD_K != null && data.KD_D != null) {
    const overboughtK = strategy.sell.kd.overboughtK;
    kdSellSignal = data.KD_K < data.KD_D && data.KD_K > overboughtK;

    sellDetails.push(
      kdSellSignal
        ? `KD 高檔轉弱：K=${data.KD_K.toFixed(2)} < D=${data.KD_D.toFixed(2)} 且 K>${overboughtK}：賣出訊號`
        : "KD 無賣出訊號",
    );
  } else {
    sellDetails.push("KD 資料不足：無法判斷賣出訊號");
  }

  const sellSignalCount = [rsiSellSignal, macdSellSignal, kdSellSignal].filter(
    Boolean,
  ).length;

  const canSell =
    priceUpPercent >= strategy.sell.minUpPercentToSell &&
    sellSignalCount >= strategy.sell.minSignalCountToSell;

  const allocation = getLeverageAllocation(weightScore, strategy);

  let suggestion = "目前無明確買賣訊號，建議持續觀察";
  if (canBuy) {
    suggestion = `建議買入（權重 ${weightScore}），槓桿比例 ${allocation.leverage * 100}%，現金比例 ${allocation.cash * 100}%`;
  } else if (canSell) {
    suggestion = `建議賣出（漲幅 ${priceUpPercent.toFixed(2)}%，多數技術指標賣出訊號成立）`;
  }

  return {
    suggestion,
    weightScore,
    buyDetails,
    sellDetails,
    allocation,
    currentPrice: data.currentPrice,
    basePrice: data.basePrice,
    priceDropPercent: data.priceDropPercent,
    RSI: data.RSI,
    MACDSignal: data.MACDSignal,
    KD_K: data.KD_K,
    KD_D: data.KD_D,
    priceUpPercent: priceUpPercent.toFixed(2),
    sellSignalCount,
  };
}

/**
 * 對外主入口（async）：
 * - 載入遠端 Strategy.json
 * - 驗證策略結構（保險：避免 cache/遠端內容被改壞）
 * - 回傳 evaluateInvestmentSignal 的結果
 *
 * 呼叫端：const result = await getInvestmentSignalAsync(...)
 */
async function getInvestmentSignalAsync(data, rsiArr, macdArr) {
  const strategy = await fetchStrategyConfig();
  validateStrategyConfig(strategy);
  return evaluateInvestmentSignal(data, rsiArr, macdArr, strategy);
}

module.exports = {
  getMACDSignal,
  getLeverageAllocation,
  evaluateInvestmentSignal, // 同步純函式：方便測試/手動注入 strategy
  getInvestmentSignalAsync, // 非同步：會抓遠端策略（要 await）
};
