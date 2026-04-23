/**
 * marginManager.mjs
 *
 * 專門處理盤後保證金維持率與壓力測試的風險控管模組。
 * 核心公式：維持率 = (0050標的市值 / 借貸總額) * 100
 *
 * 注意：本計畫依據使用者需求，維持率計算僅包含 0050 質押部分（擔保品），不包含 00675L。
 */

import { parseNumberOrNull } from "../../utils/coreUtils.mjs";
import { analyzeMarginRisk as analyzeMarginRiskCore } from "./policies/marginPolicy.mjs";

/**
 * 計算維持率並產生壓力測試報告
 *
 * @param {Object} portfolio - 投資組合資料 { qty0050, totalLoan }
 * @param {number} currentPrice0050 - 當前 0050 市場價格
 * @param {Object} strategy - 策略設定 Strategy.json
 * @returns {Object} 包含壓力測試與風險評估的完整報告
 */
export function analyzeMarginRisk(portfolio, currentPrice0050, strategy) {
  return analyzeMarginRiskCore(portfolio, currentPrice0050, strategy);
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
    tacticalWealth: Math.round(valZ2),
  };
}
