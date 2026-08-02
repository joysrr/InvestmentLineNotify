// src/modules/simulator/rsiSolver.mjs
// RSI 反推：二分搜尋 (D5, DEC-11)

import { RSI_SOLVER_CONFIG } from "./constants.mjs";

/**
 * RSI 反推 - 二分搜尋
 * RSI 對收盤價單調遞增 (價格↑ → RSI↑)，適合二分搜尋
 *
 * @param {number} targetRSI - 目標 RSI (1-99)
 * @param {Object} simulationInput - 完整模擬輸入
 * @param {Function} forwardSimulator - 正向模擬函式
 * @param {number} currentPrice0050 - 當前 0050 價格
 * @param {number} currentPriceZ2 - 當前 00675L 價格
 * @returns {Promise<Object>} { price0050, priceZ2, achievedRSI, method }
 */
export async function solvePriceForRSI(
  targetRSI,
  simulationInput,
  forwardSimulator,
  currentPrice0050,
  currentPriceZ2,
) {
  // 驗證目標範圍
  if (targetRSI < 1 || targetRSI > 99) {
    return {
      achievable: false,
      reason: `RSI 目標必須在 1-99 之間，收到 ${targetRSI}`,
      method: "analytical_failed",
    };
  }

  const { INITIAL_RANGE_PCT, TOLERANCE, MAX_ITERATIONS } = RSI_SOLVER_CONFIG;

  // 搜尋範圍：當前價格 ±30%
  let low = currentPrice0050 * (1 - INITIAL_RANGE_PCT);
  let high = currentPrice0050 * (1 + INITIAL_RANGE_PCT);
  const priceRatio = currentPriceZ2 / currentPrice0050;

  // 確保邊界合理
  low = Math.max(low, 0.01);
  high = Math.max(high, low + 0.01);

  let bestResult = null;
  let bestError = Infinity;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const mid = (low + high) / 2;
    const midZ2 = mid * priceRatio;

    try {
      // 執行正向模擬
      const result = await forwardSimulator(
        { ...simulationInput, price0050: mid, currentPrice: midZ2 },
        currentPrice0050,
        currentPriceZ2,
      );

      const achievedRSI = result.indicators.rsi;
      const error = Math.abs(achievedRSI - targetRSI);

      // 記錄最佳結果
      if (error < bestError) {
        bestError = error;
        bestResult = {
          price0050: mid,
          priceZ2: midZ2,
          achievedValue: achievedRSI,
        };
      }

      // 檢查收斂
      if (error <= TOLERANCE) {
        return {
          achievable: true,
          price0050: mid,
          priceZ2: midZ2,
          achievedValue: achievedRSI,
          method: "binary_search_converged",
          iterations: i + 1,
          error: error,
        };
      }

      // 調整搜尋範圍
      if (achievedRSI < targetRSI) {
        low = mid; // RSI 太低，需要更高價格
      } else {
        high = mid; // RSI 太高，需要更低價格
      }
    } catch (err) {
      // 模擬失敗，調整邊界繼續
      console.warn(`RSI binary search iteration ${i} failed:`, err.message);
      break;
    }
  }

  // 未在容忍度內收斂
  if (bestResult) {
    return {
      achievable: true,
      ...bestResult,
      method: "binary_search_approx",
      note: `未在 ${MAX_ITERATIONS} 次內收斂至 ${TOLERANCE} 容忍度，最佳誤差 ${bestError.toFixed(2)} RSI 點`,
    };
  }

  return {
    achievable: false,
    reason: "二分搜尋無法找到有效解",
    method: "binary_search_failed",
  };
}

/**
 * 動態邊界擴展版本 (備選方案)
 * 若固定 ±30% 找不到，依序擴大至 ±60%, ±120%
 */
export async function solvePriceForRSIWithExpandingBounds(
  targetRSI,
  simulationInput,
  forwardSimulator,
  currentPrice0050,
  currentPriceZ2,
) {
  const ranges = [0.3, 0.6, 1.2]; // ±30%, ±60%, ±120%

  for (const rangePct of ranges) {
    const result = await solvePriceForRSIWithRange(
      targetRSI,
      simulationInput,
      forwardSimulator,
      currentPrice0050,
      currentPriceZ2,
      rangePct,
    );

    if (result.achievable && result.method === "binary_search_converged") {
      return result;
    }
  }

  // 所有範圍都試過，回傳最佳近似
  return {
    achievable: false,
    reason: `在 ±120% 範圍內仍無法達成 RSI ${targetRSI}`,
    method: "binary_search_exhausted",
  };
}

async function solvePriceForRSIWithRange(
  targetRSI,
  simulationInput,
  forwardSimulator,
  currentPrice0050,
  currentPriceZ2,
  rangePct,
) {
  const { TOLERANCE, MAX_ITERATIONS } = RSI_SOLVER_CONFIG;

  let low = currentPrice0050 * (1 - rangePct);
  let high = currentPrice0050 * (1 + rangePct);
  const priceRatio = currentPriceZ2 / currentPrice0050;
  low = Math.max(low, 0.01);
  high = Math.max(high, low + 0.01);

  let bestResult = null;
  let bestError = Infinity;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const mid = (low + high) / 2;
    const midZ2 = mid * priceRatio;

    try {
      const result = await forwardSimulator(
        { ...simulationInput, price0050: mid, currentPrice: midZ2 },
        currentPrice0050,
        currentPriceZ2,
      );

      const achievedRSI = result.indicators.rsi;
      const error = Math.abs(achievedRSI - targetRSI);

      if (error < bestError) {
        bestError = error;
        bestResult = { price0050: mid, priceZ2: midZ2, achievedRSI };
      }

      if (error <= TOLERANCE) {
        return {
          achievable: true,
          price0050: mid,
          priceZ2: midZ2,
          achievedValue: achievedRSI,
          method: "binary_search_converged",
          iterations: i + 1,
          searchRange: rangePct,
        };
      }

      if (achievedRSI < targetRSI) low = mid;
      else high = mid;
    } catch (err) {
      break;
    }
  }

  if (bestResult) {
    return {
      achievable: true,
      ...bestResult,
      method: "binary_search_approx",
      searchRange: rangePct,
      error: bestError,
    };
  }

  return { achievable: false };
}
