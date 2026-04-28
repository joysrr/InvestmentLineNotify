import { parseNumber } from "../../../utils/coreUtils.mjs";

/**
 * 計算維持率並產生壓力測試報告
 *
 * @param {Object} portfolio - 投資組合資料 { qty0050, totalLoan }
 * @param {number} currentPrice0050 - 當前 0050 市場價格
 * @param {Object} strategy - 策略設定 Strategy.json
 * @returns {Object} 包含壓力測試與風險評估的完整報告
 */
export function analyzeMarginRisk(portfolio, currentPrice0050, strategy) {
  const qty0050 = parseNumber(portfolio?.qty0050) || 0;
  const totalLoan = parseNumber(portfolio?.totalLoan) || 0;
  const currentPrice = parseNumber(currentPrice0050) || 0;

  if (currentPrice === null || currentPrice <= 0) {
    throw new Error(
      "[MarginRisk] Invalid currentPrice. Evaluation aborted to prevent false liquidation.",
    );
  }

  const maintConfig = strategy?.maintenance || {};
  const dangerThreshold = maintConfig.marginCallThreshold || 135; // 斷頭警戒線
  const safetyTarget = maintConfig.protectTarget || 160; // 安全目標線

  // 1. 基本維持率計算
  let currentMargin = 999;
  if (totalLoan > 0) {
    currentMargin = ((qty0050 * currentPrice) / totalLoan) * 100;
  }

  // 2. 壓力測試模擬 (-10%, -20%, -30%)
  const dropLevels = [10, 20, 30, 40];
  const stressTests = dropLevels.map((drop) => {
    const simulatedPrice = currentPrice * (1 - drop / 100);
    const simulatedMargin =
      totalLoan > 0 ? ((qty0050 * simulatedPrice) / totalLoan) * 100 : 999;

    const frozenZone = maintConfig.frozenZone || 145;
    const protectTrigger = maintConfig.protectTrigger || 160;

    let status = "🟢 安全";
    if (simulatedMargin < dangerThreshold) status = "🔴 斷頭";
    else if (simulatedMargin < frozenZone) status = "🟠 追繳";
    else if (simulatedMargin < protectTrigger) status = "🟡 預警";

    return {
      drop,
      price: simulatedPrice.toFixed(2),
      margin: simulatedMargin.toFixed(1),
      status,
    };
  });

  // 3. 安全邊際計算 (還能跌幾 % 觸及 130%)
  let survivalDropLimit = null;
  if (totalLoan > 0 && currentMargin > dangerThreshold) {
    // 1.3 = (qty * targetPrice) / loan => targetPrice = 1.3 * loan / qty
    const targetPrice = ((dangerThreshold / 100) * totalLoan) / qty0050;
    survivalDropLimit = ((currentPrice - targetPrice) / currentPrice) * 100;
  }

  // 4. 補款建議 (若要補到 160%，需注入多少現金)
  let refillRequirement = 0;
  if (totalLoan > 0 && currentMargin < safetyTarget) {
    const targetCollateral = (safetyTarget / 100) * totalLoan;
    const currentCollateral = qty0050 * currentPrice;
    refillRequirement = Math.max(0, targetCollateral - currentCollateral);
  }

  return {
    currentMargin: totalLoan > 0 ? Number(currentMargin.toFixed(2)) : 999,
    totalLoan,
    qty0050,
    currentPrice0050: currentPrice,
    stressTests,
    riskAssessment: {
      survivalDropLimit:
        survivalDropLimit !== null
          ? Number(survivalDropLimit.toFixed(2))
          : null,
      refillRequirement: Math.round(refillRequirement),
      dangerThreshold,
      safetyTarget,
    },
  };
}
