// 根據權重分數決定槓桿與現金配置比例
function getLeverageAllocation(weightScore) {
  if (weightScore >= 10) return { leverage: 0.95, cash: 0.05 };
  if (weightScore >= 9) return { leverage: 0.9, cash: 0.1 };
  if (weightScore >= 7) return { leverage: 0.8, cash: 0.2 };
  return { leverage: 0, cash: 1 };
}

// 投資信號判斷函式，加入詳細說明用於除錯與顯示
function checkInvestmentSignalVerbose(data, rsiArr, macdArr) {
  let weightScore = 0; // 權重分數初始值
  const buyDetails = []; // 買入條件詳情
  const sellDetails = []; // 賣出條件詳情

  // 判斷跌幅給分（買入條件）
  if (data.priceDropPercent >= 50) {
    weightScore += 5;
    buyDetails.push("跌幅>=50%：+5分");
  } else if (data.priceDropPercent >= 40) {
    weightScore += 4;
    buyDetails.push("跌幅>=40%：+4分");
  } else if (data.priceDropPercent >= 30) {
    weightScore += 3;
    buyDetails.push("跌幅>=30%：+3分");
  } else if (data.priceDropPercent >= 20) {
    weightScore += 1;
    buyDetails.push("跌幅>=20%：+1分");
  } else {
    buyDetails.push(`跌幅${data.priceDropPercent.toFixed(2)}%：無加分`);
  }

  // RSI 動態判斷：由低於30回升突破30，為買入加分條件
  const rsiIdx = rsiArr.length - 1;
  if (rsiIdx >= 1) {
    const prevRSI = rsiArr[rsiIdx - 1];
    const currRSI = rsiArr[rsiIdx];
    if (prevRSI < 30 && currRSI >= 30) {
      weightScore += 2;
      buyDetails.push(
        `RSI 從 ${prevRSI.toFixed(2)} 低於30回升突破30 (${currRSI.toFixed(2)})：+2分`,
      );
    } else {
      buyDetails.push(`RSI (${currRSI.toFixed(2)}) <= 30：無加分`);
    }
  } else {
    buyDetails.push(`RSI 資料不足，無法動態判斷`);
  }

  // MACD 動態判斷：判斷黃金交叉 (MACD線上穿訊號線且柱狀圖由負轉正)
  const macdIdx = macdArr.length - 1;
  if (macdIdx >= 1) {
    const prevMACD = macdArr[macdIdx - 1].MACD;
    const prevSignal = macdArr[macdIdx - 1].signal;
    const prevHist = macdArr[macdIdx - 1].histogram;
    const currMACD = macdArr[macdIdx].MACD;
    const currSignal = macdArr[macdIdx].signal;
    const currHist = macdArr[macdIdx].histogram;
    if (
      prevMACD <= prevSignal &&
      currMACD > currSignal &&
      prevHist <= 0 &&
      currHist > 0
    ) {
      weightScore += 2;
      buyDetails.push("MACD 快線上穿慢線且柱狀圖轉正（黃金交叉）：+2分");
    } else {
      buyDetails.push("MACD 非多頭訊號：無加分");
    }
  } else {
    buyDetails.push("MACD 資料不足，無法動態判斷");
  }

  // KD 買入判斷：K線大於D線且K線低於20視為買入訊號
  if (data.KD_K > data.KD_D && data.KD_K < 20) {
    weightScore += 2;
    buyDetails.push(
      `KD K=${data.KD_K.toFixed(2)} > D=${data.KD_D.toFixed(2)} 且 <20：+2分`,
    );
  } else {
    buyDetails.push(
      `KD 狀況：K=${data.KD_K.toFixed(2)}, D=${data.KD_D.toFixed(2)}，無加分`,
    );
  }

  // 判斷是否符合買入條件：權重 >= 7 且跌幅至少20%
  const canBuy = weightScore >= 7 && data.priceDropPercent >= 20;

  // 賣出條件判斷
  const priceUpPercent =
    ((data.currentPrice - data.basePrice) / data.basePrice) * 100; // 漲幅百分比
  sellDetails.push(`目前漲幅: ${priceUpPercent.toFixed(2)}%`);

  // RSI 賣出訊號：由高於70回落低於70視為賣出訊號
  let rsiSellSignal = false;
  if (rsiIdx >= 1) {
    const prevRSI = rsiArr[rsiIdx - 1];
    const currRSI = rsiArr[rsiIdx];
    rsiSellSignal = prevRSI >= 70 && currRSI < 70;
    if (rsiSellSignal) sellDetails.push("RSI 高於70後回落：賣出訊號");
    else sellDetails.push("RSI 無賣出訊號");
  } else {
    sellDetails.push("RSI 資料不足，無法判斷賣出訊號");
  }

  // MACD 賣出訊號：死叉 (MACD線下穿訊號線且柱狀圖由正轉負)
  let macdSellSignal = false;
  if (macdIdx >= 1) {
    const prevMACD = macdArr[macdIdx - 1].MACD;
    const prevSignal = macdArr[macdIdx - 1].signal;
    const prevHist = macdArr[macdIdx - 1].histogram;
    const currMACD = macdArr[macdIdx].MACD;
    const currSignal = macdArr[macdIdx].signal;
    const currHist = macdArr[macdIdx].histogram;
    macdSellSignal =
      prevMACD >= prevSignal &&
      currMACD < currSignal &&
      prevHist >= 0 &&
      currHist < 0;
    if (macdSellSignal)
      sellDetails.push("MACD 快線下穿慢線且柱狀圖轉負：賣出訊號");
    else sellDetails.push("MACD 無賣出訊號");
  } else {
    sellDetails.push("MACD 資料不足，無法判斷賣出訊號");
  }

  // KD 賣出訊號：K線小於D線且K線大於80視為賣出訊號
  const kdSell = data.KD_K < data.KD_D && data.KD_K > 80;
  if (kdSell)
    sellDetails.push(
      `KD K=${data.KD_K.toFixed(2)} < D=${data.KD_D.toFixed(2)} 且 >80：賣出訊號`,
    );
  else sellDetails.push("KD 無賣出訊號");

  // 計算形成賣出訊號的指標數量
  const sellSignalCount = [rsiSellSignal, macdSellSignal, kdSell].filter(
    Boolean,
  ).length;

  // 判斷是否符合賣出條件：漲幅至少50%，且賣出信號指標數 >= 2
  const canSell = priceUpPercent >= 50 && sellSignalCount >= 2;

  // 根據權重取得配置建議
  const allocation = getLeverageAllocation(weightScore);

  // 預設建議為觀察中
  let suggestion = "目前無明確買賣訊號，建議持續觀察";

  // 買入或賣出建議
  if (canBuy)
    suggestion = `建議買入（權重 ${weightScore}），槓桿比例 ${allocation.leverage * 100}%，現金比例 ${allocation.cash * 100}%`;
  else if (canSell)
    suggestion = `建議賣出（漲幅 ${priceUpPercent.toFixed(2)}%，多數技術指標賣出訊號成立）`;

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

// 根據 MACD 計算結果判斷大致訊號類型（多頭、空頭、中立）
function getMACDSignal(macdResult) {
  if (!macdResult.length) return "neutral";
  const last = macdResult[macdResult.length - 1];
  if (last.MACD > last.signal) return "bull";
  if (last.MACD < last.signal) return "bear";
  return "neutral";
}

module.exports = {
  checkInvestmentSignalVerbose,
  getLeverageAllocation,
  getMACDSignal,
};
