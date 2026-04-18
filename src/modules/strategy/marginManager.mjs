/**
 * marginManager.mjs
 * 
 * 專門處理盤後保證金維持率與壓力測試的風險控管模組。
 * 核心公式：維持率 = (0050標的市值 / 借貸總額) * 100
 * 
 * 注意：本計畫依據使用者需求，維持率計算僅包含 0050 質押部分（擔保品），不包含 00675L。
 */

import { parseNumberOrNull } from "../../utils/coreUtils.mjs";

/**
 * 計算維持率並產生壓力測試報告
 * 
 * @param {Object} portfolio - 投資組合資料 { qty0050, totalLoan }
 * @param {number} currentPrice0050 - 當前 0050 市場價格
 * @param {Object} strategy - 策略設定 Strategy.json
 * @returns {Object} 包含壓力測試與風險評估的完整報告
 */
export function analyzeMarginRisk(portfolio, currentPrice0050, strategy) {
  const qty0050 = parseNumberOrNull(portfolio?.qty0050) || 0;
  const totalLoan = parseNumberOrNull(portfolio?.totalLoan) || 0;
  const currentPrice = parseNumberOrNull(currentPrice0050) || 0;

  const maintConfig = strategy?.maintenance || {};
  const dangerThreshold = maintConfig.marginCallThreshold || 135; // 斷頭警戒線
  const safetyTarget = maintConfig.protectTarget || 160;        // 安全目標線

  // 1. 基本維持率計算
  let currentMargin = 999;
  if (totalLoan > 0) {
    currentMargin = (qty0050 * currentPrice) / totalLoan * 100;
  }

  // 2. 壓力測試模擬 (-10%, -20%, -30%)
  const dropLevels = [10, 20, 30, 40];
  const stressTests = dropLevels.map(drop => {
    const simulatedPrice = currentPrice * (1 - drop / 100);
    const simulatedMargin = totalLoan > 0 ? (qty0050 * simulatedPrice) / totalLoan * 100 : 999;
    
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
      status
    };
  });

  // 3. 安全邊際計算 (還能跌幾 % 觸及 130%)
  let survivalDropLimit = null;
  if (totalLoan > 0 && currentMargin > dangerThreshold) {
    // 1.3 = (qty * targetPrice) / loan => targetPrice = 1.3 * loan / qty
    const targetPrice = (dangerThreshold / 100 * totalLoan) / qty0050;
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
      survivalDropLimit: survivalDropLimit !== null ? Number(survivalDropLimit.toFixed(2)) : null,
      refillRequirement: Math.round(refillRequirement),
      dangerThreshold,
      safetyTarget
    }
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
  
  // 基礎 D CA 部位佔比 (0050 市值 - 借貸 / 淨資產)
  // 這裡假設借貸主要用於 00675L 及其餘槓桿操作
  const baseWealth = val0050 - (totalLoan || 0);
  const baseRatio = netAsset > 0 ? (baseWealth / netAsset) * 100 : 0;

  return {
    netAsset: Math.round(netAsset),
    tacticRatio: Number(tacticRatio.toFixed(2)),
    baseRatio: Number(baseRatio.toFixed(2)),
    baseWealth: Math.round(baseWealth),
    tacticalWealth: Math.round(valZ2)
  };
}
