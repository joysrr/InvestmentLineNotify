// src/modules/simulator/analyticalSolvers.mjs
// 解析型反向推導：維持率、MA20、MA60、MA240偏離

import {
  MA240_FALLBACK_THRESHOLDS,
  DATA_QUALITY_LABELS,
} from "./constants.mjs";

/**
 * 維持率反推 (線性解析解)
 * maintenanceRatio = netAsset / totalLoan * 100
 * netAsset = qty0050 * price0050 + qtyZ2 * priceZ2 + cash - totalLoan
 *
 * @param {number} targetRatio - 目標維持率 (%)
 * @param {Object} portfolio - { qty0050, qtyZ2, cash, totalLoan }
 * @param {number} currentPriceZ2 - 當前 00675L 價格
 * @param {number} currentPrice0050 - 當前 0050 價格
 * @param {boolean} fixedZ2Ratio - true: Z2 按同比例聯動, false: Z2 價格固定
 * @returns {Object} { price0050, priceZ2, achievable: boolean }
 */
export function solvePriceForMaintenanceRatio(
  targetRatio,
  portfolio,
  currentPriceZ2,
  currentPrice0050,
  fixedZ2Ratio = true,
) {
  const { qty0050, qtyZ2, cash, totalLoan } = portfolio;

  if (totalLoan <= 0) {
    return { achievable: false, reason: "總融資為 0 或負數，無法計算維持率" };
  }
  if (qty0050 <= 0) {
    return {
      achievable: false,
      reason: "0050 持股數為 0 或負數，無法透過股價調整維持率",
    };
  }

  const targetNetAsset = (targetRatio / 100) * totalLoan;
  const priceRatio = currentPriceZ2 / currentPrice0050;

  let price0050;
  let priceZ2;

  if (fixedZ2Ratio) {
    // priceZ2 = price0050 * priceRatio
    // targetNetAsset = qty0050 * p + qtyZ2 * (p * ratio) + cash - totalLoan
    // p = (targetNetAsset - cash + totalLoan) / (qty0050 + qtyZ2 * ratio)
    const denominator = qty0050 + qtyZ2 * priceRatio;
    if (denominator <= 0) {
      return { achievable: false, reason: "分母異常，無法求解" };
    }
    price0050 = (targetNetAsset - cash + totalLoan) / denominator;
    priceZ2 = price0050 * priceRatio;
  } else {
    // priceZ2 固定
    // targetNetAsset = qty0050 * p + qtyZ2 * currentPriceZ2 + cash - totalLoan
    // p = (targetNetAsset - qtyZ2 * currentPriceZ2 - cash + totalLoan) / qty0050
    price0050 =
      (targetNetAsset - qtyZ2 * currentPriceZ2 - cash + totalLoan) / qty0050;
    priceZ2 = currentPriceZ2;
  }

  // 檢查解是否合理
  if (!Number.isFinite(price0050) || price0050 <= 0) {
    return { achievable: false, reason: "解得價格無效 (非有限或非正數)" };
  }

  return {
    achievable: true,
    price0050,
    priceZ2,
    achievedValue: targetRatio,
  };
}

/**
 * MA20/MA60 反推 (線性解析解)
 * MA(N) = sum(closeArr[-N:]) / N
 * targetMA = (sum(closeArr[-N:-1]) + newClose) / N
 * newClose = targetMA * N - sum(closeArr[-N:-1])
 *
 * @param {number} targetMA - 目標均線值
 * @param {number[]} closeArr - 收盤價陣列 (由舊到新)
 * @param {number} period - 週期 (20 或 60)
 * @returns {Object} { price0050, achievable: boolean }
 */
export function solvePriceForMA(targetMA, closeArr, period) {
  if (!Array.isArray(closeArr) || closeArr.length < period) {
    return {
      achievable: false,
      reason: `歷史資料不足 ${period} 筆 (現有 ${closeArr?.length || 0} 筆)`,
    };
  }

  // 取前 period-1 筆 (不含最新一筆)
  const prevCloses = closeArr.slice(-period, -1);
  if (prevCloses.length !== period - 1) {
    return { achievable: false, reason: "歷史資料長度異常" };
  }

  const sumPrev = prevCloses.reduce((a, b) => a + b, 0);
  const price0050 = targetMA * period - sumPrev;

  if (!Number.isFinite(price0050) || price0050 <= 0) {
    return { achievable: false, reason: "解得價格無效" };
  }

  return {
    achievable: true,
    price0050,
    achievedValue: targetMA,
  };
}

/**
 * MA240 偏離反推
 * bias240 = (price - ma240) / ma240 * 100
 * 先估算 ma240 (若資料不足用 fallback)，再解價格
 * price = ma240 * (1 + targetBias/100)
 * 需再正向模擬驗證，因 ma240 可能受新價格影響
 *
 * @param {number} targetBias - 目標偏離百分比 (如 10 代表 +10%)
 * @param {number[]} closeArr - 收盤價陣列
 * @param {Object} simulationInput - 完整模擬輸入 (用於驗證)
 * @param {Function} forwardSimulator - 正向模擬函式
 * @returns {Promise<Object>} { price0050, priceZ2, achievedBias, method }
 */
export async function solvePriceForMA240Bias(
  targetBias,
  closeArr,
  simulationInput,
  forwardSimulator,
) {
  // 1. 估算 MA240 (分級 fallback)
  let ma240;
  if (closeArr.length >= MA240_FALLBACK_THRESHOLDS.FULL) {
    ma240 = calcSMA(closeArr, 240).at(-1);
  } else if (closeArr.length >= MA240_FALLBACK_THRESHOLDS.MA60_PROXY) {
    ma240 = calcSMA(closeArr, 60).at(-1);
  } else if (closeArr.length >= MA240_FALLBACK_THRESHOLDS.MA20_PROXY) {
    ma240 = calcSMA(closeArr, 20).at(-1);
  } else {
    return {
      achievable: false,
      reason: "資料不足以估算 MA240 (需至少 20 筆)",
      method: "analytical_failed",
    };
  }

  if (!Number.isFinite(ma240) || ma240 <= 0) {
    return { achievable: false, reason: "MA240 估算失敗" };
  }

  // 2. 解析解
  const price0050 = ma240 * (1 + targetBias / 100);
  const currentPrice0050 = simulationInput.price0050;
  const currentPriceZ2 = simulationInput.currentPrice;
  const priceRatio = currentPriceZ2 / currentPrice0050;
  const priceZ2 = price0050 * priceRatio;

  // 3. 正向模擬驗證
  try {
    const result = await forwardSimulator(
      { ...simulationInput, price0050, currentPrice: priceZ2 },
      currentPrice0050,
      currentPriceZ2,
    );

    const achievedBias = result.indicators.bias240;
    const error = Math.abs(achievedBias - targetBias);

    // 允許 0.1% 誤差 (MA240 權重 1/240，影響極小)
    if (error <= 0.1) {
      return {
        achievable: true,
        price0050,
        priceZ2,
        achievedValue: achievedBias,
        method: "analytical_verified",
      };
    }

    return {
      achievable: true,
      price0050,
      priceZ2,
      achievedValue: achievedBias,
      method: "analytical_approx",
      note: `驗證誤差 ${error.toFixed(2)}% > 0.1%，標記為近似解`,
    };
  } catch (err) {
    return {
      achievable: false,
      reason: `驗證失敗: ${err.message}`,
      method: "analytical_failed",
    };
  }
}

/**
 * 通用 SMA 計算 (內部使用)
 */
function calcSMA(prices, period) {
  if (!Array.isArray(prices) || period < 1 || !Number.isInteger(period))
    return [];
  const result = new Array(prices.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < prices.length; i++) {
    sum += prices[i];
    if (i >= period) sum -= prices[i - period];
    if (i >= period - 1) result[i] = sum / period;
  }
  return result;
}
