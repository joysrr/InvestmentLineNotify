/**
 * MarginLayerRule (P10: 優先級 10)
 * 維持率 4 層狀態機 - 越危險越優先
 * critical → frozen → caution → normal
 */

import { DecisionRule, createDecisionResult } from "../DecisionRule.mjs";
import { getMarginLayer, evaluateMarginLayer } from "../../core/index.mjs";
import { getReserveStatus } from "../../riskManagement.mjs";

export class MarginLayerRule extends DecisionRule {
  constructor() {
    super({ priority: 10, name: "MarginLayerRule" });
  }

  /**
   * 評估維持率層級
   * @param {Object} ctx - 唯讀上下文
   * @param {Object} strategy - 唯讀策略設定
   * @param {Object} engineState - 可變共享狀態
   * @returns {Object|null} 決策結果或 null（繼續下一條）
   */
  evaluate(ctx, strategy, engineState) {
    const th = strategy.threshold;
    const maint = strategy.maintenance;

    const { maintenanceMargin } = ctx;

    const reserveStatus = getReserveStatus(ctx, strategy);
    const marginLayer = getMarginLayer(maintenanceMargin, maint, th);

    const marginLayerObj = evaluateMarginLayer(
      marginLayer,
      ctx,
      strategy,
      reserveStatus,
    );

    if (marginLayerObj) {
      // 統一補齊共享狀態
      return createDecisionResult({
        ...marginLayerObj,
        regimeState: engineState.regimeResult?.state ?? null,
        regimeResult: engineState.regimeResult,
        valuationGuardResult: engineState.valuationGuardResult ?? null,
      });
    }

    // 維持率正常：繼續下一條規則
    return null;
  }
}
