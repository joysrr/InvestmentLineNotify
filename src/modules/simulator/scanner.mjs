// src/modules/simulator/scanner.mjs
// 掃描器：適用於 KD 交叉、MACD 交叉、策略分數、複合條件

import { SCAN_CONFIG } from "./constants.mjs";

/**
 * 通用區間掃描器
 *
 * @param {Object} params
 * @param {Object} params.simulationInput - 基礎模擬輸入
 * @param {Function} params.forwardSimulator - 正向模擬函式
 * @param {number} params.currentPrice0050 - 當前 0050 價格
 * @param {number} params.currentPriceZ2 - 當前 00675L 價格
 * @param {Function} params.checkTarget - 目標檢查函式 (result) => { matched: boolean, value: any }
 * @param {Object} [params.options] - 掃描選項
 * @returns {Promise<Object>} 掃描結果
 */
export async function scanPriceRange({
  simulationInput,
  forwardSimulator,
  currentPrice0050,
  currentPriceZ2,
  checkTarget,
  options = {},
}) {
  const {
    rangePct = SCAN_CONFIG.RANGE_PCT,
    stepPct = SCAN_CONFIG.STEP_PCT,
    maxIterations = SCAN_CONFIG.MAX_ITERATIONS,
    tolerance = SCAN_CONFIG.TOLERANCE,
    earlyStop = SCAN_CONFIG.EARLY_STOP,
  } = options;

  const startTime = Date.now();
  const priceRatio = currentPriceZ2 / currentPrice0050;

  // 計算掃描範圍
  const minPrice = currentPrice0050 * (1 - rangePct);
  const maxPrice = currentPrice0050 * (1 + rangePct);
  const step = currentPrice0050 * stepPct;

  // 產生價格序列
  const prices = [];
  for (let p = minPrice; p <= maxPrice + step * 0.5; p += step) {
    prices.push(Math.round(p * 100) / 100); // 取到分位
  }

  // 限制迭代次數
  const scanPrices = prices.slice(0, maxIterations);

  let bestMatch = null;
  let bestError = Infinity;
  let matchedCount = 0;
  let firstMatchPrice = null;
  let lastMatchPrice = null;

  for (const price0050 of scanPrices) {
    const priceZ2 = price0050 * priceRatio;

    try {
      const result = await forwardSimulator(
        { ...simulationInput, price0050, currentPrice: priceZ2 },
        currentPrice0050,
        currentPriceZ2,
      );

      const checkResult = checkTarget(result);

      if (checkResult.matched) {
        matchedCount++;
        if (!firstMatchPrice) firstMatchPrice = price0050;
        lastMatchPrice = price0050;

        if (earlyStop && checkResult.exactMatch) {
          // 完全符合，提前結束
          return {
            reachable: true,
            method: "scan",
            results: {
              minPrice0050: price0050,
              maxPrice0050: price0050,
              closestPrice0050: price0050,
              achievedValue: checkResult.value,
            },
            scanDetails: {
              range: [minPrice, maxPrice],
              step,
              iterations: scanPrices.indexOf(price0050) + 1,
              durationMs: Date.now() - startTime,
              matchedCount: 1,
            },
            assumptions: [
              `價格區間 ±${(rangePct * 100).toFixed(0)}%`,
              `步距 ${(stepPct * 100).toFixed(1)}%`,
            ],
          };
        }

        // 記錄誤差最小者
        const error = checkResult.error ?? 0;
        if (error < bestError) {
          bestError = error;
          bestMatch = {
            price0050,
            priceZ2,
            achievedValue: checkResult.value,
          };
        }
      }
    } catch (err) {
      console.warn(`Scanner error at price ${price0050}:`, err.message);
    }
  }

  // 整理結果
  if (matchedCount > 0) {
    return {
      reachable: true,
      method: "scan",
      results: {
        minPrice0050: firstMatchPrice,
        maxPrice0050: lastMatchPrice,
        closestPrice0050: bestMatch?.price0050 ?? firstMatchPrice,
        achievedValue: bestMatch?.achievedValue,
      },
      scanDetails: {
        range: [minPrice, maxPrice],
        step,
        iterations: scanPrices.length,
        durationMs: Date.now() - startTime,
        matchedCount,
      },
      assumptions: [
        `價格區間 ±${(rangePct * 100).toFixed(0)}%`,
        `步距 ${(stepPct * 100).toFixed(1)}%`,
        `掃描點數 ${scanPrices.length}`,
      ],
    };
  }

  // 無匹配，回傳最接近者
  return {
    reachable: false,
    method: "scan",
    reason: `在 ±${(rangePct * 100).toFixed(0)}% 區間內 (${scanPrices.length} 點掃描) 無法達成目標`,
    closestResult: bestMatch
      ? {
          price0050: bestMatch.price0050,
          achievedValue: bestMatch.achievedValue,
          error: bestError,
        }
      : {
          price0050: currentPrice0050,
          achievedValue: null,
          error: bestError,
        },
    scanDetails: {
      range: [minPrice, maxPrice],
      step,
      iterations: scanPrices.length,
      durationMs: Date.now() - startTime,
      matchedCount: 0,
    },
    assumptions: [
      `價格區間 ±${(rangePct * 100).toFixed(0)}%`,
      `步距 ${(stepPct * 100).toFixed(1)}%`,
      `掃描點數 ${scanPrices.length}`,
    ],
  };
}

/**
 * KD 交叉檢查器
 * @param {"golden"|"dead"} direction - 交叉方向
 * @param {Array} kdHistory - 可選，KD 歷史陣列 [{k, d}, ...]
 */
export function createKDCrossChecker(direction, kdHistory = null) {
  return (result) => {
    // 優先使用傳入的歷史陣列，其次使用 result.kdHistory
    const history = kdHistory || result.kdHistory || [];
    if (history.length < 2) {
      // 回退：僅檢查當前狀態
      const kd = result.indicators?.kd;
      if (!kd || typeof kd.k !== "number" || typeof kd.d !== "number") {
        return { matched: false, error: Infinity };
      }
      const k = kd.k;
      const d = kd.d;
      let matched = false;
      if (direction === "golden") matched = k > d;
      else if (direction === "dead") matched = k < d;
      return {
        matched,
        exactMatch: matched,
        value: `kd_${direction}`,
        error: matched ? 0 : Math.abs(k - d),
      };
    }

    // 真正的交叉檢測：前一根 vs 當前根
    const prev = history[history.length - 2];
    const curr = history[history.length - 1];
    if (!prev || !curr) {
      return { matched: false, error: Infinity };
    }

    let matched = false;
    if (direction === "golden") {
      matched = prev.k <= prev.d && curr.k > curr.d;
    } else if (direction === "dead") {
      matched = prev.k >= prev.d && curr.k < curr.d;
    }

    return {
      matched,
      exactMatch: matched,
      value: `kd_${direction}`,
      error: matched ? 0 : Math.abs(curr.k - curr.d),
    };
  };
}

/**
 * MACD 交叉檢查器
 * @param {"golden"|"dead"} direction - 交叉方向
 * @param {Array} macdHistory - 可選，MACD 歷史陣列 [{MACD, signal, histogram}, ...]
 */
export function createMACDCrossChecker(direction, macdHistory = null) {
  return (result) => {
    // 優先使用傳入的歷史陣列，其次使用 result.macdHistory
    const history = macdHistory || result.macdHistory || [];
    if (history.length < 2) {
      // 回退：僅檢查當前狀態
      const macd = result.indicators?.macd;
      if (
        !macd ||
        typeof macd.MACD !== "number" ||
        typeof macd.signal !== "number"
      ) {
        return { matched: false, error: Infinity };
      }

      let matched = false;
      if (direction === "golden") matched = macd.MACD > macd.signal;
      else if (direction === "dead") matched = macd.MACD < macd.signal;

      return {
        matched,
        exactMatch: matched,
        value: `macd_${direction}`,
        error: matched ? 0 : Math.abs(macd.MACD - macd.signal),
      };
    }

    // 真正的交叉檢測：前一根 vs 當前根
    const prev = history[history.length - 2];
    const curr = history[history.length - 1];
    if (!prev || !curr) {
      return { matched: false, error: Infinity };
    }

    let matched = false;
    if (direction === "golden") {
      matched = prev.MACD <= prev.signal && curr.MACD > curr.signal;
    } else if (direction === "dead") {
      matched = prev.MACD >= prev.signal && curr.MACD < curr.signal;
    }

    return {
      matched,
      exactMatch: matched,
      value: `macd_${direction}`,
      error: matched ? 0 : Math.abs(curr.MACD - curr.signal),
    };
  };
}

/**
 * 策略分數檢查器
 */
export function createStrategyScoreChecker(targetScore) {
  return (result) => {
    const score = result.strategyScore;
    if (typeof score !== "number") {
      return { matched: false, error: Infinity };
    }

    const error = Math.abs(score - targetScore);
    const matched = error <= 1; // 1 分容忍

    return {
      matched,
      exactMatch: error === 0,
      value: score,
      error,
    };
  };
}

/**
 * Portfolio Health 檢查器 (AND 邏輯，DEC-15)
 */
export function createPortfolioHealthChecker(targetStatus) {
  return (result) => {
    const health = result.portfolioHealth;
    if (!health) return { matched: false, error: Infinity };

    // 簡化：根據 maintenanceRisk.level 判斷
    const riskLevel = health.maintenanceRisk?.level || "Normal";
    let currentStatus;

    if (riskLevel === "Critical" || riskLevel === "Frozen") {
      currentStatus = "red";
    } else if (riskLevel === "Protect") {
      currentStatus = "yellow";
    } else {
      currentStatus = "green";
    }

    const matched = currentStatus === targetStatus;
    return {
      matched,
      exactMatch: matched,
      value: currentStatus,
      error: matched ? 0 : 1,
    };
  };
}
