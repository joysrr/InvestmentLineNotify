/**
 * ConversionGuardRule (P90: 優先級 90)
 * 階梯式獲利轉化
 */

import { DecisionRule, createDecisionResult } from "../DecisionRule.mjs";
import { resolveConversionGuard } from "../../policies/conversionPolicy.mjs";

export class ConversionGuardRule extends DecisionRule {
  constructor() {
    super({ priority: 90, name: "ConversionGuardRule" });
  }

  /**
   * 評估獲利轉化
   * @param {Object} ctx - 唯讀上下文
   * @param {Object} strategy - 唯讀策略設定
   * @param {Object} engineState - 可變共享狀態
   * @returns {Object|null} 決策結果或 null（繼續下一條）
   */
  evaluate(ctx, strategy, engineState) {
    const conversionResult = resolveConversionGuard(ctx, strategy);

    if (conversionResult) {
      return createDecisionResult({
        ...conversionResult,
        regimeState: engineState.regimeResult?.state ?? null,
        regimeResult: engineState.regimeResult,
        valuationGuardResult: engineState.valuationGuardResult ?? null,
      });
    }

    return null;
  }
}
