/**
 * LifecycleLeverageRule (P20: 優先級 20)
 * 生命週期槓桿引擎 - 在 Gross Leverage 之前檢查
 * 檢查當前槓桿是否超過生命週期階段上限（含 Regime CAUTIOUS 調整）
 */

import { DecisionRule, createDecisionResult } from "../DecisionRule.mjs";
import { computeLifecycleContext } from "../../lifecycleEngine.mjs";

export class LifecycleLeverageRule extends DecisionRule {
  constructor() {
    super({ priority: 20, name: "LifecycleLeverageRule" });
  }

  /**
   * 評估生命週期槓桿上限
   * @param {Object} ctx - 唯讀上下文
   * @param {Object} strategy - 唯讀策略設定
   * @param {Object} engineState - 可變共享狀態（含 adjustedMaxLeverage）
   * @param {Object} grossLeverageResult - 槓桿計算結果
   * @returns {Object|null} 決策結果或 null（繼續下一條）
   */
  evaluate(ctx, strategy, engineState, grossLeverageResult) {
    const lifecycleCfg = strategy.lifecycle;
    const lifecycleProfiles = lifecycleCfg?.profiles || null;
    const retirementAge = lifecycleCfg?.retirementAge ?? 65;
    const currentAge = ctx.currentAge ?? null;

    if (currentAge == null || !lifecycleProfiles) {
      // 無年齡資料或無設定檔：略過此規則
      return null;
    }

    const lifecycleContext = computeLifecycleContext(
      currentAge,
      retirementAge,
      lifecycleProfiles,
    );

    const currentGrossLeverage = grossLeverageResult?.grossLeverage || 0;
    const baseStageMaxLeverage = lifecycleContext.profile.maxLeverage;
    // 使用 Regime CAUTIOUS 調整後的上限（若有），否則用基礎上限
    const stageMaxLeverage =
      engineState.adjustedMaxLeverage ?? baseStageMaxLeverage;

    if (currentGrossLeverage > stageMaxLeverage) {
      const regimeNote =
        engineState.regimeResult?.state === "CAUTIOUS"
          ? `（含 Regime CAUTIOUS 調整：${baseStageMaxLeverage}x × ${engineState.regimeResult.leverageMultiplier} = ${stageMaxLeverage}x）`
          : "";

      return createDecisionResult({
        maintenanceLayer: "normal",
        lifecycleStage: lifecycleContext.stage,
        lifecycleLabel: lifecycleContext.description,
        lifecycleBlocked: true,
        regimeState: engineState.regimeResult?.state ?? null,
        regimeResult: engineState.regimeResult,
        valuationGuardResult: engineState.valuationGuardResult ?? null,
        marketStatus: `📅【生命週期：${lifecycleContext.stage}】`,
        target: "🚧 生命週期槓桿封鎖",
        targetSuggestionShort: `超過 ${lifecycleContext.stage} 階段槓桿上限${regimeNote}`,
        targetSuggestion: `生命週期 ${lifecycleContext.stage}：maxLeverage = ${stageMaxLeverage}x${regimeNote}`,
        suggestion:
          `• 當前年齡：${currentAge}歲（距離退休 ${lifecycleContext.yearsToRetirement}年）\n` +
          `• 生命週期階段：${lifecycleContext.stage}（${lifecycleContext.profile.mode}）\n` +
          `• 當前槓桿：${currentGrossLeverage.toFixed(2)}x\n` +
          `• 階段上限：${stageMaxLeverage}x${regimeNote}\n` +
          `• ⚠️ 超過生命週期槓桿上限，需降低槓桿至 ${stageMaxLeverage}x 以下\n` +
          `• 允許操作：0050 DCA 照常執行，00675L 需減碼`,
      });
    }

    // 槓桿在允許範圍內：繼續下一條規則
    return null;
  }
}
