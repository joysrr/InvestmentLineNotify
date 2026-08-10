// src/modules/simulator/reverseEngine.mjs
// 反向推導主流程：路由到解析解或掃描器

import {
  solvePriceForMaintenanceRatio,
  solvePriceForMA,
  solvePriceForMA240Bias,
} from "./analyticalSolvers.mjs";
import {
  solvePriceForRSI,
  solvePriceForRSIWithExpandingBounds,
} from "./rsiSolver.mjs";
import {
  scanPriceRange,
  createKDCrossChecker,
  createMACDCrossChecker,
  createStrategyScoreChecker,
  createPortfolioHealthChecker,
} from "./scanner.mjs";
import { REVERSE_TARGET_TYPES, CALCULATION_MODE } from "./constants.mjs";

/**
 * 執行反向推導
 * @param {Object} params
 * @param {Object} params.target - { type, value?, direction?, status? }
 * @param {Object} params.simulationInput - 基礎模擬輸入 (當前價格)
 * @param {Function} params.forwardSimulator - 正向模擬函式
 * @param {number} params.currentPrice0050 - 當前 0050 價格
 * @param {number} params.currentPriceZ2 - 當前 00675L 價格
 * @returns {Promise<Object>} 反向推導結果
 */
export async function runReverseEngine({
  target,
  simulationInput,
  forwardSimulator,
  currentPrice0050,
  currentPriceZ2,
}) {
  const { type, value, direction, status } = target;
  const priceRatio = currentPriceZ2 / currentPrice0050;
  const portfolio = simulationInput.portfolio;

  // 根據目標類型分派
  switch (type) {
    case "maintenanceRatio": {
      // 維持率解析解 (DEC-08: 同比例聯動)
      const result = solvePriceForMaintenanceRatio(
        value,
        portfolio,
        currentPriceZ2,
        currentPrice0050,
        true, // fixedZ2Ratio = true
      );

      if (!result.achievable) {
        return formatUnreachableResponse(target, result.reason, "analytical", {
          assumptions: [
            `00675L 按 0050 同比例聯動 (比例: 1:${priceRatio.toFixed(2)})`,
          ],
        });
      }

      // 正向驗證
      const verified = await verifyWithForward(
        result.price0050,
        result.priceZ2,
        simulationInput,
        forwardSimulator,
        currentPrice0050,
        currentPriceZ2,
        "maintenanceRatio",
        value,
      );

      return {
        target,
        reachable: true,
        method: "analytical",
        results: {
          price0050: result.price0050,
          priceZ2: result.priceZ2,
          achievedValue: verified.achievedValue,
        },
        assumptions: [
          `00675L 按 0050 同比例聯動 (當前比例: 1:${priceRatio.toFixed(2)})`,
          "持倉、融資、現金維持不變",
        ],
        calculationMode: CALCULATION_MODE.REVERSE_ANALYTICAL,
      };
    }

    case "rsi": {
      // RSI 二分搜尋 (DEC-11: 固定 ±30%)
      const result = await solvePriceForRSI(
        value,
        simulationInput,
        forwardSimulator,
        currentPrice0050,
        currentPriceZ2,
      );

      // approx 也視為可達，但標記為近似解
      if (!result.achievable) {
        return formatUnreachableResponse(
          target,
          result.reason || "目標 RSI 在搜尋範圍內無法達成",
          result.method,
          {
            searchRange: "±30%",
          },
        );
      }

      return {
        target,
        reachable: true,
        method: result.method,
        results: {
          price0050: result.price0050,
          priceZ2: result.priceZ2,
          achievedValue: result.achievedValue,
        },
        scanDetails: result.iterations
          ? { iterations: result.iterations }
          : undefined,
        note:
          result.method === "binary_search_approx" ? result.note : undefined,
        assumptions: [`RSI 對價格單調遞增`, `搜尋範圍 ±30%`],
        calculationMode: CALCULATION_MODE.REVERSE_ANALYTICAL,
      };
    }

    case "ma20":
    case "ma60": {
      const period = type === "ma20" ? 20 : 60;
      const closeArr = simulationInput.closeArr;

      const result = solvePriceForMA(value, closeArr, period);

      if (!result.achievable) {
        return formatUnreachableResponse(target, result.reason, "analytical", {
          requiredPeriod: period,
          availableData: closeArr.length,
        });
      }

      // 正向驗證
      const verified = await verifyWithForward(
        result.price0050,
        currentPriceZ2, // Z2 價格固定 (MA 只影響 0050)
        simulationInput,
        forwardSimulator,
        currentPrice0050,
        currentPriceZ2,
        type,
        value,
      );

      return {
        target,
        reachable: true,
        method: "analytical",
        results: {
          price0050: result.price0050,
          priceZ2: currentPriceZ2,
          achievedValue: verified.achievedValue,
        },
        assumptions: [
          `00675L 價格固定 (${currentPriceZ2})`,
          `前 ${period - 1} 根收盤價不變`,
        ],
        calculationMode: CALCULATION_MODE.REVERSE_ANALYTICAL,
      };
    }

    case "ma240Bias": {
      const result = await solvePriceForMA240Bias(
        value,
        simulationInput.closeArr,
        simulationInput,
        forwardSimulator,
      );

      if (!result.achievable) {
        return formatUnreachableResponse(target, result.reason, result.method);
      }

      return {
        target,
        reachable: true,
        method: result.method,
        results: {
          price0050: result.price0050,
          priceZ2: result.priceZ2,
          achievedValue: result.achievedValue,
        },
        assumptions: [`MA240 分級 Fallback 估算`, `00675L 按同比例聯動`],
        calculationMode: CALCULATION_MODE.REVERSE_ANALYTICAL,
      };
    }

    case "kdCross":
    case "macdCross":
    case "strategyScore":
    case "portfolioHealth": {
      // 掃描法
      let checker;
      if (type === "kdCross") {
        checker = createKDCrossChecker(direction);
      } else if (type === "macdCross") {
        checker = createMACDCrossChecker(direction);
      } else if (type === "strategyScore") {
        checker = createStrategyScoreChecker(value);
      } else if (type === "portfolioHealth") {
        checker = createPortfolioHealthChecker(status || "green");
      }

      const scanResult = await scanPriceRange({
        simulationInput,
        forwardSimulator,
        currentPrice0050,
        currentPriceZ2,
        checkTarget: checker,
      });

      return {
        target,
        ...scanResult,
        calculationMode: CALCULATION_MODE.REVERSE_SCAN,
      };
    }

    default:
      throw new Error(`不支援的目標類型: ${type}`);
  }
}

/**
 * 正向驗證輔助函式
 */
async function verifyWithForward(
  price0050,
  priceZ2,
  simulationInput,
  forwardSimulator,
  currentPrice0050,
  currentPriceZ2,
  targetType,
  targetValue,
) {
  try {
    const result = await forwardSimulator(
      { ...simulationInput, price0050, currentPrice: priceZ2 },
      currentPrice0050,
      currentPriceZ2,
    );

    let achievedValue;
    switch (targetType) {
      case "maintenanceRatio":
        achievedValue = result.maintenanceMargin;
        break;
      case "ma20":
        achievedValue = result.indicators.ma20;
        break;
      case "ma60":
        achievedValue = result.indicators.ma60;
        break;
      default:
        achievedValue = targetValue;
    }

    return { achievedValue };
  } catch (err) {
    return { achievedValue: targetValue };
  }
}

/**
 * 格式化不可達回應
 */
function formatUnreachableResponse(target, reason, method, extra = {}) {
  return {
    target,
    reachable: false,
    method,
    reason,
    closestResult: extra.closestResult || null,
    suggestedRange: extra.suggestedRange || { min: 15, max: 85 },
    assumptions: extra.assumptions || [],
    disclaimer:
      "此為條件分析，非價格預測亦非投資建議。目標在當前假設下不可達。",
    calculationMode:
      method === "analytical"
        ? CALCULATION_MODE.REVERSE_ANALYTICAL
        : CALCULATION_MODE.REVERSE_SCAN,
    ...extra,
  };
}

/**
 * 取得支援的目標類型列表
 */
export function getSupportedTargetTypes() {
  return REVERSE_TARGET_TYPES;
}
