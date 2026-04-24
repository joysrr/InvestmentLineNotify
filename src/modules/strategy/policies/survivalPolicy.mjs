import { parseNumberOrNull } from "../../../utils/coreUtils.mjs";

/**
 * 生命週期投資法 - 存活分析模組
 * 計算維持率的生存邊際與回補需求
 */
export function analyzeSurvival(portfolio, currentPrice0050, strategy) {
  const qty0050 = parseNumberOrNull(portfolio?.qty0050) || 0;
  const totalLoan = parseNumberOrNull(portfolio?.totalLoan) || 0;
  const currentPrice = parseNumberOrNull(currentPrice0050) || 0;

  if (currentPrice <= 0) return null;

  const maintConfig = strategy?.maintenance || {};
  const dangerThreshold = maintConfig.marginCallThreshold || 135;
  const safetyTarget = maintConfig.protectTarget || 160;

  // 當前維持率
  let currentMargin = 999;
  if (totalLoan > 0) {
    currentMargin = ((qty0050 * currentPrice) / totalLoan) * 100;
  }

  // 1. 生存邊際 (Survival Buffer %)
  // 還能跌幾 % 觸及斷頭線
  let survivalDropLimit = null;
  if (totalLoan > 0 && currentMargin > dangerThreshold) {
    const targetPrice = ((dangerThreshold / 100) * totalLoan) / qty0050;
    survivalDropLimit = ((currentPrice - targetPrice) / currentPrice) * 100;
  }

  // 2. 補足線需求 (Refill Requirement)
  // 若要補回安全水位 (160%)，需要多少現金
  let refillRequirement = 0;
  if (totalLoan > 0 && currentMargin < safetyTarget) {
    const targetCollateral = (safetyTarget / 100) * totalLoan;
    const currentCollateral = qty0050 * currentPrice;
    refillRequirement = Math.max(0, targetCollateral - currentCollateral);
  }

  // 3. 隔日跌停壓力測試 (-10%)
  const nextDayLimitDownPrice = currentPrice * 0.9;
  const nextDayLimitDownMargin =
    totalLoan > 0 ? ((qty0050 * nextDayLimitDownPrice) / totalLoan) * 100 : 999;

  return {
    currentMargin: Number(currentMargin.toFixed(1)),
    survivalDropLimit:
      survivalDropLimit !== null ? Number(survivalDropLimit.toFixed(2)) : null,
    refillRequirement: Math.round(refillRequirement),
    nextDayLimitDownMargin: Number(nextDayLimitDownMargin.toFixed(1)),
    isVulnerable: currentMargin < safetyTarget,
  };
}
