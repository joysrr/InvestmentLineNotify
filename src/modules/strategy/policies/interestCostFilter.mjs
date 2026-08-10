/**
 * interestCostFilter.mjs
 * 利息成本濾網 - 考慮質押借款利息成本的決策過濾器
 *
 * 功能：
 * 1. 計算當前借款的每日/每月利息成本
 * 2. 評估利息成本對淨報酬率的影響
 * 3. 當利息成本過高時，建議降低槓桿或暫停加碼
 * 4. 提供利息成本占淨值比例、年化成本率等指標
 */

import { DEFAULT_BUDGET_CONFIG } from "../strategyDefaults.mjs";

/**
 * 利息成本濾網結果
 * @typedef {Object} InterestCostFilterResult
 * @property {boolean} shouldFilter - 是否建議過濾/降低操作
 * @property {string} filterReason - 過濾原因說明
 * @property {number} dailyInterestCost - 每日利息成本
 * @property {number} monthlyInterestCost - 每月利息成本
 * @property {number} annualInterestCost - 年化利息成本
 * @property {number} interestCostRatio - 利息成本佔淨值比例 (%)
 * @property {number} interestCostToReturnRatio - 利息成本對預期報酬比率
 * @property {number} netReturnAfterInterest - 扣除利息後的淨預期報酬
 * @property {Object} breakdown - 詳細拆解
 */

/**
 * 計算利息成本濾網
 *
 * @param {Object} ctx - 執行上下文
 * @param {number} ctx.netAsset - 淨值
 * @param {number} ctx.totalLoan - 當前總借款
 * @param {number} ctx.interestRate - 年化利率 (預設 2.2%)
 * @param {Object} strategy - 策略設定
 * @param {Object} [decision] - 決策結果 (可選，用於評估決策後的利息影響)
 * @returns {InterestCostFilterResult}
 */
export function applyInterestCostFilter(ctx, strategy, decision = null) {
  // 1. 取得參數
  const budget = strategy?.trading?.budget || {};
  const loanInterestRate = strategy?.trading?.loanInterestRate ?? 0.022;

  const netAsset = ctx?.netAsset ?? 0;
  const totalLoan = ctx?.totalLoan ?? 0;

  // 2. 基礎檢查
  if (netAsset <= 0 || totalLoan <= 0) {
    return {
      shouldFilter: false,
      filterReason: "無借款或淨值異常，無需利息濾網",
      dailyInterestCost: 0,
      monthlyInterestCost: 0,
      annualInterestCost: 0,
      interestCostRatio: 0,
      interestCostToReturnRatio: 0,
      netReturnAfterInterest: 0,
      breakdown: { netAsset, totalLoan, loanInterestRate },
    };
  }

  // 3. 計算利息成本
  const dailyInterestCost = (totalLoan * loanInterestRate) / 365;
  const monthlyInterestCost = dailyInterestCost * 30;
  const annualInterestCost = totalLoan * loanInterestRate;

  // 4. 利息成本佔淨值比例 (%)
  const interestCostRatio = (annualInterestCost / netAsset) * 100;

  // 5. 取得策略預期報酬率 (從策略配置或預期報酬假設)
  // 這裡使用一個保守的預期年化報酬率假設 (可從策略配置取得)
  const expectedAnnualReturn = strategy?.expectedAnnualReturn ?? 0.08; // 8% 預期報酬
  const expectedReturnAmount = netAsset * expectedAnnualReturn;

  // 6. 利息成本對預期報酬比率
  const interestCostToReturnRatio =
    expectedReturnAmount > 0 ? annualInterestCost / expectedReturnAmount : 999;

  // 7. 扣除利息後的淨預期報酬
  const netReturnAfterInterest =
    expectedAnnualReturn - annualInterestCost / netAsset;

  // 7. 判斷是否需要過濾/降低操作
  const FILTER_THRESHOLDS = {
    // 利息成本佔淨值超過 3% → 建議降低槓桿
    interestCostRatioThreshold:
      strategy?.interestCostFilter?.interestCostRatioThreshold ?? 3.0,
    // 利息成本超過預期報酬 50% → 強烈建議降低槓桿
    interestCostToReturnRatioThreshold:
      strategy?.interestCostFilter?.interestCostToReturnRatioThreshold ?? 0.5,
    // 淨報酬扣除利息後為負 → 禁止加碼
    netReturnNegativeThreshold:
      strategy?.interestCostFilter?.netReturnNegativeThreshold ?? 0,
  };

  let shouldFilter = false;
  let filterReason = "";

  if (netReturnAfterInterest <= FILTER_THRESHOLDS.netReturnNegativeThreshold) {
    shouldFilter = true;
    filterReason = `扣除利息後淨報酬為負 (${netReturnAfterInterest.toFixed(2)}%)，建議禁止加碼並考慮降槓桿`;
  } else if (
    interestCostToReturnRatio >=
    FILTER_THRESHOLDS.interestCostToReturnRatioThreshold
  ) {
    shouldFilter = true;
    filterReason = `利息成本佔預期報酬 ${(interestCostToReturnRatio * 100).toFixed(1)}% 過高，建議降低槓桿`;
  } else if (
    interestCostRatio >= FILTER_THRESHOLDS.interestCostRatioThreshold
  ) {
    shouldFilter = true;
    filterReason = `年化利息成本佔淨值 ${interestCostRatio.toFixed(2)}% 過高，建議審慎加碼`;
  }

  // 8. 若有決策輸入，評估決策後的利息影響
  let decisionImpact = null;
  if (decision && decision.budgetAllowedAmount > 0) {
    const newTotalLoan = totalLoan + decision.budgetAllowedAmount;
    const newAnnualInterest = newTotalLoan * loanInterestRate;
    const newInterestCostRatio = (newAnnualInterest / netAsset) * 100;
    const newNetReturn = expectedAnnualReturn - newAnnualInterest / netAsset;

    decisionImpact = {
      newTotalLoan,
      newAnnualInterestCost: newAnnualInterest,
      newInterestCostRatio,
      newNetReturnAfterInterest: newNetReturn,
      additionalDailyCost:
        (decision.budgetAllowedAmount * loanInterestRate) / 365,
    };
  }

  return {
    shouldFilter,
    filterReason,
    dailyInterestCost,
    monthlyInterestCost,
    annualInterestCost,
    interestCostRatio,
    interestCostToReturnRatio,
    netReturnAfterInterest,
    breakdown: {
      netAsset,
      totalLoan,
      loanInterestRate,
      expectedAnnualReturn,
      expectedReturnAmount,
      ...FILTER_THRESHOLDS,
      decisionImpact,
    },
  };
}

/**
 * 獲取融資券餘額資料流
 * 整合現有的 rawMargin、rawUsMarket 等資料源
 *
 * @param {Object} marketData - 原始市場資料
 * @returns {Object} 融資券綜合資訊
 */
export function getMarginFinancingData(marketData) {
  const rawMargin = marketData?.rawMargin || {};
  const rawUsMarket = marketData?.rawUsMarket || {};

  return {
    // 台股大盤融資資料
    twMargin: {
      marginBalance100M: rawMargin.marginBalance100M || 0, // 融資餘額 (億元)
      marginBalanceChange100M: rawMargin.marginBalanceChange100M || 0, // 融資增減 (億元)
      maintenanceRatio: rawMargin.maintenanceRatio || 0, // 維持率 (%)
      shortBalance100M: rawMargin.shortBalance100M || 0, // 融券餘額 (億元)
      date: rawMargin.date || null,
    },
    // 個股融資融券 (若有)
    stockMargin: marketData.rawStockMargin || null,
    // 美股融資情緒參考
    usMarket: {
      vix: rawUsMarket?.vix || null,
      spxChg: rawUsMarket?.spxChg || null,
      riskLevel: rawUsMarket?.riskLevel || null,
    },
    // 時間戳
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * 利息成本濾網決策修飾器
 * 可用於策略引擎中修飾決策結果
 *
 * @param {Object} decision - 原始決策結果
 * @param {InterestCostFilterResult} filterResult - 利息成本濾網結果
 * @returns {Object} 修飾後的決策
 */
export function applyInterestCostFilterToDecision(decision, filterResult) {
  if (!filterResult.shouldFilter) {
    return decision;
  }

  const modified = { ...decision };

  // 根據嚴重程度修飾決策
  if (filterResult.netReturnAfterInterest <= 0) {
    // 淨報酬為負：強制 hold，禁止加碼
    modified.signalDirection = "hold";
    modified.target = "🛑 利息成本過高";
    modified.targetSuggestionShort = filterResult.filterReason;
    modified.targetSuggestion = filterResult.filterReason;
    modified.scalingRatio = 0;
    modified.interestCostFilterApplied = true;
  } else if (filterResult.interestCostToReturnRatio >= 0.5) {
    // 利息成本佔報酬 > 50%：大幅降低 scalingRatio
    modified.scalingRatio = (modified.scalingRatio ?? 1.0) * 0.3;
    modified.targetSuggestionShort = `${modified.targetSuggestionShort || ""} | ⚠️ 利息成本佔報酬 ${(filterResult.interestCostToReturnRatio * 100).toFixed(0)}%`;
    modified.targetSuggestion = `${modified.targetSuggestion || ""}\n\n⚠️ 利息成本濾網：${filterResult.filterReason}`;
    modified.interestCostFilterApplied = true;
  } else if (filterResult.interestCostRatio >= 3) {
    // 利息成本佔淨值 > 3%：適度降低 scalingRatio
    modified.scalingRatio = (modified.scalingRatio ?? 1.0) * 0.7;
    modified.targetSuggestionShort = `${modified.targetSuggestionShort || ""} | ⚠️ 利息成本 ${filterResult.interestCostRatio.toFixed(1)}%`;
    modified.targetSuggestion = `${modified.targetSuggestion || ""}\n\n⚠️ 利息成本濾網：${filterResult.filterReason}`;
    modified.interestCostFilterApplied = true;
  }

  // 附加利息成本資訊供前端顯示
  modified.interestCostInfo = {
    dailyCost: filterResult.dailyInterestCost,
    monthlyCost: filterResult.monthlyInterestCost,
    annualCost: filterResult.annualInterestCost,
    costRatio: filterResult.interestCostRatio,
    netReturnAfterInterest: filterResult.netReturnAfterInterest,
  };

  return modified;
}

export default {
  applyInterestCostFilter,
  getMarginFinancingData,
  applyInterestCostFilterToDecision,
};
