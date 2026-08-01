/**
 * GrossLeverageRule (P30: 優先級 30)
 * Gross Leverage 警戒 - 檢查總槓桿是否超過設定上限
 * 含 panicBypass 旗標判斷（由 runner 在規則執行前預計算）
 */

import { DecisionRule, createDecisionResult } from "../DecisionRule.mjs";
import { evaluateGrossLeverage } from "../../core/index.mjs";

export class GrossLeverageRule extends DecisionRule {
  constructor() {
    super({ priority: 30, name: "GrossLeverageRule" });
  }

  /**
   * 評估 Gross Leverage
   * @param {Object} ctx - 唯讀上下文
   * @param {Object} strategy - 唯讀策略設定
   * @param {Object} engineState - 可變共享狀態（含 panicBypassActive）
   * @param {Object} grossLeverageResult - 槓桿計算結果
   * @returns {Object|null} 決策結果或 null（繼續下一條）
   */
  evaluate(ctx, strategy, engineState, grossLeverageResult) {
    // panicBypass 旗標由 runner 預計算並存入 engineState
    const panicBypassActive = engineState.panicBypassActive;

    const leverageObj = evaluateGrossLeverage(
      grossLeverageResult,
      strategy,
      panicBypassActive,
    );

    if (leverageObj) {
      return createDecisionResult({
        ...leverageObj,
        regimeState: engineState.regimeResult?.state ?? null,
        regimeResult: engineState.regimeResult,
        valuationGuardResult: engineState.valuationGuardResult ?? null,
      });
    }

    return null;
  }
}
