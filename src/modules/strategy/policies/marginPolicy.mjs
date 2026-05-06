import { parseNumber } from "../../../utils/coreUtils.mjs";
import {
  MARGIN_CALL_THRESHOLD,
  FROZEN_ZONE,
  PROTECT_TRIGGER,
  PROTECT_TARGET,
} from "../strategyDefaults.mjs";

// ─────────────────────────────────────────────────────────
// 私有核心計算（不 export，僅供本模組內部複用）
// ─────────────────────────────────────────────────────────

/**
 * 維持率核心計算：所有維持率相關 policy 的共同計算基礎
 * @param {number} qty0050
 * @param {number} totalLoan
 * @param {number} currentPrice
 * @param {Object} maintConfig - strategy.maintenance
 * @returns {{ currentMargin, survivalDropLimit, refillRequirement, dangerThreshold, safetyTarget }}
 */
function _calcMarginCore(qty0050, totalLoan, currentPrice, maintConfig) {
  const dangerThreshold = maintConfig.marginCallThreshold ?? MARGIN_CALL_THRESHOLD;
  const safetyTarget = maintConfig.protectTarget ?? PROTECT_TARGET;

  const currentMargin =
    totalLoan > 0 ? ((qty0050 * currentPrice) / totalLoan) * 100 : 999;

  let survivalDropLimit = null;
  if (totalLoan > 0 && currentMargin > dangerThreshold) {
    const targetPrice = ((dangerThreshold / 100) * totalLoan) / qty0050;
    survivalDropLimit = ((currentPrice - targetPrice) / currentPrice) * 100;
  }

  let refillRequirement = 0;
  if (totalLoan > 0 && currentMargin < safetyTarget) {
    const targetCollateral = (safetyTarget / 100) * totalLoan;
    const currentCollateral = qty0050 * currentPrice;
    refillRequirement = Math.max(0, targetCollateral - currentCollateral);
  }

  return {
    currentMargin,
    survivalDropLimit,
    refillRequirement,
    dangerThreshold,
    safetyTarget,
  };
}

// ─────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────

/**
 * 計算維持率並產生壓力測試報告
 *
 * @param {Object} portfolio - 投資組合資料 { qty0050, totalLoan }
 * @param {number} currentPrice0050 - 當前 0050 市場價格
 * @param {Object} strategy - 策略設定 Strategy.json
 * @returns {Object|null} 包含壓力測試與風險評估的完整報告，輸入不合法時回傳 null
 */
export function analyzeMarginRisk(portfolio, currentPrice0050, strategy) {
  const qty0050 = parseNumber(portfolio?.qty0050) || 0;
  const totalLoan = parseNumber(portfolio?.totalLoan) || 0;
  const currentPrice = parseNumber(currentPrice0050) || 0;

  if (currentPrice <= 0) return null;

  const maintConfig = strategy?.maintenance ?? {};
  const frozenZone = maintConfig.frozenZone ?? FROZEN_ZONE;
  const protectTrigger = maintConfig.protectTrigger ?? PROTECT_TRIGGER;

  const core = _calcMarginCore(qty0050, totalLoan, currentPrice, maintConfig);

  // 壓力測試模擬 (-10%, -20%, -30%, -40%)
  const dropLevels = [10, 20, 30, 40];
  const stressTests = dropLevels.map((drop) => {
    const simulatedPrice = currentPrice * (1 - drop / 100);
    const simulatedMargin =
      totalLoan > 0 ? ((qty0050 * simulatedPrice) / totalLoan) * 100 : 999;

    let status = "🟢 安全";
    if (simulatedMargin < core.dangerThreshold) status = "🔴 斷頭";
    else if (simulatedMargin < frozenZone) status = "🟠 追繳";
    else if (simulatedMargin < protectTrigger) status = "🟡 預警";

    return {
      drop,
      price: simulatedPrice.toFixed(2),
      margin: simulatedMargin.toFixed(1),
      status,
    };
  });

  return {
    currentMargin: totalLoan > 0 ? Number(core.currentMargin.toFixed(2)) : 999,
    totalLoan,
    qty0050,
    currentPrice0050: currentPrice,
    stressTests,
    riskAssessment: {
      survivalDropLimit:
        core.survivalDropLimit !== null
          ? Number(core.survivalDropLimit.toFixed(2))
          : null,
      refillRequirement: Math.round(core.refillRequirement),
      dangerThreshold: core.dangerThreshold,
      safetyTarget: core.safetyTarget,
    },
  };
}

/**
 * 生命週期投資法 - 存活分析模組
 * 計算維持率的生存邊際與回補需求（原 survivalPolicy.mjs）
 *
 * @param {Object} portfolio - 投資組合資料 { qty0050, totalLoan }
 * @param {number} currentPrice0050 - 當前 0050 市場價格
 * @param {Object} strategy - 策略設定 Strategy.json
 * @returns {Object|null}
 */
export function analyzeSurvival(portfolio, currentPrice0050, strategy) {
  const qty0050 = parseNumber(portfolio?.qty0050) || 0;
  const totalLoan = parseNumber(portfolio?.totalLoan) || 0;
  const currentPrice = parseNumber(currentPrice0050) || 0;

  if (currentPrice <= 0) return null;

  const maintConfig = strategy?.maintenance ?? {};
  const core = _calcMarginCore(qty0050, totalLoan, currentPrice, maintConfig);

  // 隔日跌停壓力測試 (-10%)
  const nextDayLimitDownPrice = currentPrice * 0.9;
  const nextDayLimitDownMargin =
    totalLoan > 0 ? ((qty0050 * nextDayLimitDownPrice) / totalLoan) * 100 : 999;

  return {
    currentMargin: Number(core.currentMargin.toFixed(1)),
    survivalDropLimit:
      core.survivalDropLimit !== null
        ? Number(core.survivalDropLimit.toFixed(2))
        : null,
    refillRequirement: Math.round(core.refillRequirement),
    nextDayLimitDownMargin: Number(nextDayLimitDownMargin.toFixed(1)),
    isVulnerable: core.currentMargin < core.safetyTarget,
  };
}

/**
 * 資金解耦分析 (Decoupling Analysis)
 * 計算 00675L (槓桿部位) vs 帳戶淨值的比重，區分戰術資產與基礎資產。
 */
export function analyzeCapitalDecoupling(portfolio, prices) {
  const { qty0050, qtyZ2, totalLoan, cash } = portfolio;
  const { price0050, priceZ2 } = prices;

  const val0050 = (qty0050 || 0) * price0050;
  const valZ2 = (qtyZ2 || 0) * priceZ2;
  const netAsset = val0050 + valZ2 - (totalLoan || 0) + (cash || 0);

  // 戰術槓桿部位佔比 (00675L 市值 / 淨資產)
  const tacticRatio = netAsset > 0 ? (valZ2 / netAsset) * 100 : 0;

  // 基礎 DCA 部位佔比 (0050 市值 - 借貸 / 淨資產)
  // 這裡假設借貸主要用於 00675L 及其餘槓桿操作
  const baseWealth = val0050 - (totalLoan || 0);
  const baseRatio = netAsset > 0 ? (baseWealth / netAsset) * 100 : 0;

  return {
    netAsset: Math.round(netAsset),
    tacticRatio: Number(tacticRatio.toFixed(2)),
    baseRatio: Number(baseRatio.toFixed(2)),
    baseWealth: Math.round(baseWealth),
    tacticalWealth: Math.round(valZ2),
  };
}
