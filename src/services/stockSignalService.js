const { fetchStrategyConfig } = require("./strategyConfigService");
const { validateStrategyConfig } = require("./strategyConfigValidator");

function getMACDSignal(macdResult) {
  if (!macdResult?.length) return "neutral";
  const last = macdResult[macdResult.length - 1];
  if (last.MACD > last.signal) return "bull";
  if (last.MACD < last.signal) return "bear";
  return "neutral";
}

function evaluateInvestmentSignal(data, rsiArr, macdArr, kdArr, strategy) {
  let weightScore = 0;
  const buyDetails = [];

  // 1. 讀取環境變數 (持股資料)
  const portfolio = data.portfolio || {};
  const qty0050 = portfolio.qty0050 ?? parseFloat(process.env.QTY_0050 || 0);
  const qtyZ2 = portfolio.qtyZ2 ?? parseFloat(process.env.QTY_00675L || 0);
  const totalLoan =
    portfolio.totalLoan ?? parseFloat(process.env.TOTAL_LOAN || 1);
  const cash = portfolio.cash || 0; // ★ 讀取現金

  // 2. 計算跌幅給分
  const dropRules = strategy.buy.dropScoreRules || [];
  // 修正：依照跌幅由大到小排序，找到符合的最大跌幅規則
  const dropRule = dropRules
    .sort((a, b) => b.minDrop - a.minDrop)
    .find((r) => data.priceDropPercent >= r.minDrop);

  if (dropRule) {
    weightScore += dropRule.score;
    buyDetails.push(`${dropRule.label}：+${dropRule.score}分`);
  } else {
    buyDetails.push(`跌幅 ${data.priceDropPercent.toFixed(2)}%：未達加分門檻`);
  }

  // 3. 技術指標給分 (RSI, MACD, KD)
  // ... (保留原本 RSI 邏輯) ...
  const rsiIdx = (rsiArr?.length ?? 0) - 1;
  if (rsiIdx >= 1) {
    const prevRSI = rsiArr[rsiIdx - 1];
    const currRSI = rsiArr[rsiIdx];
    const oversold = strategy.buy.rsi.oversold;
    if (prevRSI < oversold && currRSI >= oversold) {
      weightScore += strategy.buy.rsi.score;
      buyDetails.push(`RSI 反轉：+${strategy.buy.rsi.score}分`);
    } else {
      buyDetails.push(`RSI 未反轉 (現值${currRSI.toFixed(1)})`);
    }
  }

  // ... (保留原本 MACD 邏輯) ...
  const macdIdx = (macdArr?.length ?? 0) - 1;
  if (macdIdx >= 1) {
    const prev = macdArr[macdIdx - 1];
    const curr = macdArr[macdIdx];
    const goldenCross =
      prev.MACD <= prev.signal && curr.MACD > curr.signal && curr.histogram > 0;
    if (goldenCross) {
      weightScore += strategy.buy.macd.score;
      buyDetails.push(`MACD 交叉：+${strategy.buy.macd.score}分`);
    } else {
      buyDetails.push(`MACD 無交叉`);
    }
  }

  // ... (保留原本 KD 邏輯) ...
  if (data.KD_K != null && data.KD_D != null) {
    const oversoldK = strategy.buy.kd.oversoldK;
    if (data.KD_K > data.KD_D && data.KD_K < oversoldK) {
      weightScore += strategy.buy.kd.score;
      buyDetails.push(`KD 低檔交叉：+${strategy.buy.kd.score}分`);
    } else {
      buyDetails.push(`KD 無交叉 (K=${data.KD_K.toFixed(1)})`);
    }
  }

  // 4. 計算賣出訊號 (僅作參考，不用於核心建議)
  const priceUpPercent =
    ((data.currentPrice - data.basePrice) / data.basePrice) * 100;

  // 5. ★核心計算：維持率與資產佔比
  const current0050Value = qty0050 * data.price0050; // 0050 市值
  const currentZ2Value = qtyZ2 * data.currentPrice; // 正2 市值

  // 維持率 = 擔保品市值 / 總借款
  // 注意：若無借款 (totalLoan=0)，維持率設為無限大
  // 維持率計算 (確保使用正確的 totalLoan)
  const maintenanceMargin =
    totalLoan > 0 ? (current0050Value / totalLoan) * 100 : 999;

  // 正2 佔比 = 正2市值 / (0050市值 + 正2市值 + 現金 - 總借款)
  const netAsset = current0050Value + currentZ2Value + cash - totalLoan;
  const z2Ratio = netAsset > 0 ? (currentZ2Value / netAsset) * 100 : 0;

  // 計算年線乖離率
  const ma240 =
    Number.isFinite(data.ma240) && data.ma240 > 0 ? data.ma240 : null;
  const bias240 = ma240 ? ((data.currentPrice - ma240) / ma240) * 100 : null;

  // 判定過熱因子
  const factors = {
    rsiHigh: data.RSI > strategy.threshold.rsiCoolOff,
    kdHigh: data.KD_K > strategy.threshold.kdCoolOff,
    biasHigh: bias240 != null && bias240 > strategy.threshold.bias240CoolOff,
  };

  // 取得決策結果
  const decision = buildDecision(
    {
      maintenanceMargin,
      z2Ratio,
      netAsset,
      currentZ2Value,
      factors,
      data,
      bias240,
      weightScore,
      rsiArr,
      macdArr,
      kdArr,
    },
    strategy.threshold,
  );

  return {
    marketStatus: decision.marketStatus,
    suggestion: decision.suggestion,
    bias240,
    weightScore,
    buyDetails,
    currentPrice: data.currentPrice,
    basePrice: data.basePrice,
    priceDropPercent: data.priceDropPercent,
    priceUpPercent: priceUpPercent.toFixed(2),
    RSI: data.RSI,
    MACDSignal: data.MACDSignal,
    KD_K: data.KD_K || 0,
    KD_D: data.KD_D || 0,
    maintenanceMargin,
    z2Ratio,
    totalLoan,
    threshold: strategy.threshold,
  };
}

function buildDecision(ctx, th) {
  const {
    maintenanceMargin,
    z2Ratio,
    netAsset,
    currentZ2Value,
    factors,
    data,
    bias240,
    weightScore,
    rsiArr,
    kdArr,
    macdArr,
  } = ctx;
  const highFactorCount = Object.values(factors).filter(Boolean).length;

  // 1) 風險：追繳
  if (maintenanceMargin < th.mmDanger) {
    return {
      marketStatus: "⚠️【追繳風險】",
      suggestion: `⚠️ 維持率 ${maintenanceMargin.toFixed(0)}% 過低！請準備補錢或停止加碼`,
    };
  }

  // 2) 再平衡：正2佔比
  if (z2Ratio > th.z2RatioHigh) {
    const targetZ2Value = netAsset * 0.4;
    const sellAmount = Math.max(0, currentZ2Value - targetZ2Value);
    return {
      marketStatus: "💰【再平衡】",
      suggestion: `💰 正2佔比 ${z2Ratio.toFixed(1)}% 過高！建議賣出約 ${sellAmount.toLocaleString("zh-TW", { maximumFractionDigits: 0 })} 元並還款`,
    };
  }

  // 3) 市場狀態：過熱/冷卻
  if (highFactorCount >= th.overheatCount) {
    const reversal = computeReversalTriggers({ rsiArr, macdArr, kdArr, th });

    return {
      marketStatus: "🔥【極度過熱】",
      suggestion:
        `🚫 禁撥款；0050照常定投；允許質押但不動用額度\n` +
        `🪓 解除禁令：${3 - highFactorCount}/3（需≥2）｜RSI<${th.rsiCoolOff}？${yn(!factors.rsiHigh)}｜KD<${th.kdCoolOff}？${yn(!factors.kdHigh)}｜乖離<${th.bias240CoolOff}？${yn(!factors.biasHigh)}\n` +
        `${reversal}`,
    };
  }

  if (data.RSI > th.coolRSI || bias240 > th.coolBias) {
    return {
      marketStatus: "⚠️【冷卻校準中】",
      suggestion: "💡 處於高檔冷卻區，建議分批少量或繼續等待",
    };
  }

  // 4) 才進入加碼分段
  let suggestion = "✔️ 市場冷靜，可執行1.8倍槓桿，撥款並購買00675L";
  if (weightScore >= th.wAggressive)
    suggestion += "\n🔥 最積極型：建議增貸至 60% 加碼";
  else if (weightScore >= th.wActive)
    suggestion += "\n🚨 積極型：建議增貸至 50% 加碼";
  else suggestion += `\n💡 保守型 (${weightScore}分)：建議維持 40% 加碼`;

  return { marketStatus: "🌱【安全/低溫】", suggestion };
}

function computeReversalTriggers({ rsiArr, macdArr, kdArr, th }) {
  const out = {
    rsiDrop: null,
    kdDrop: null,
    kdBearCross: null,
    macdBearCross: null,
  };

  // RSI 跌回 80（上一根 >=80，這一根 <80）
  if ((rsiArr?.length ?? 0) >= 2) {
    const prev = rsiArr.at(-2);
    const curr = rsiArr.at(-1);
    out.rsiDrop = prev >= th.rsiCoolOff && curr < th.rsiCoolOff;
  }

  // KD：需要前一根 K/D
  if ((kdArr?.length ?? 0) >= 2) {
    const prev = kdArr.at(-2);
    const curr = kdArr.at(-1);

    // KD 跌回 90（上一根K >=90，這一根K <90）
    out.kdDrop = prev.k >= th.kdCoolOff && curr.k < th.kdCoolOff;

    // KD K 下穿 D（上一根 K>=D，這一根 K<D）
    out.kdBearCross = prev.k >= prev.d && curr.k < curr.d; // 死叉 [web:174]
  }

  // MACD 下穿 Signal（上一根 MACD>=Signal，這一根 MACD<Signal）
  if ((macdArr?.length ?? 0) >= 2) {
    const prev = macdArr.at(-2);
    const curr = macdArr.at(-1);
    out.macdBearCross = prev.MACD >= prev.signal && curr.MACD < curr.signal; // bearish crossover [web:169]
  }

  const hit = Object.values(out).filter(Boolean).length;
  return `📉 反轉觸發：${hit}/4｜RSI<${th.rsiCoolOff}？${yn(out.rsiDrop)}｜KD<${th.kdCoolOff}？${yn(out.kdDrop)}｜KD死叉？${yn(out.kdBearCross)}｜MACD死叉？${yn(out.macdBearCross)}`;
}

async function getInvestmentSignalAsync(data, rsiArr, macdArr, kdArr) {
  const strategy = await fetchStrategyConfig();
  validateStrategyConfig(strategy);
  return evaluateInvestmentSignal(data, rsiArr, macdArr, kdArr, strategy);
}

const yn = (v) => (v ? "是" : "否");

module.exports = {
  getMACDSignal,
  evaluateInvestmentSignal,
  getInvestmentSignalAsync,
};
