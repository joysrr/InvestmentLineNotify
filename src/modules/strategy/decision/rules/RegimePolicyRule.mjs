/**
 * RegimePolicyRule (P0: 優先級 0)
 * Regime 硬條件檢查 - 最高優先級
 * CRISIS 模式：立即回傳 Sell-only 決策（禁止新增部位）
 * CAUTIOUS 模式：計算調整後槓桿上限，注入 engineState 供後續規則使用
 */

import { DecisionRule, createDecisionResult } from "../DecisionRule.mjs";
import {
  determineRegime,
  applyRegimeLeverage,
  formatRegimeStatus,
} from "../../regimePolicy.mjs";
import { computeLifecycleContext } from "../../lifecycleEngine.mjs";
import { classifyMacroRegime } from "../../macroRegimeClassifier.mjs";

export class RegimePolicyRule extends DecisionRule {
  constructor() {
    super({ priority: 0, name: "RegimePolicyRule" });
  }

  /**
   * 評估 Regime 政策
   * @param {Object} ctx - 唯讀上下文
   * @param {Object} strategy - 唯讀策略設定
   * @param {Object} engineState - 可變共享狀態
   * @returns {Object|null} 決策結果或 null（繼續下一條）
   */
  evaluate(ctx, strategy, engineState) {
    const regimeCfg = strategy.regime || {};
    const vix = ctx.vix;
    const sentiment = ctx.macroSentiment?.direction || "NEUTRAL";

    // 判定 Regime 狀態
    const regimeResult = determineRegime(vix, sentiment, regimeCfg);
    engineState.regimeResult = regimeResult;

    // Phase 4: 同步評估四象限 Macro Regime 2.0 分類
    if (ctx.indicators?.ma60 !== undefined || ctx.price0050 !== undefined) {
      try {
        const macroRegime = classifyMacroRegime(
          {
            price0050: ctx.price0050,
            ma60: ctx.indicators?.ma60,
            ma60Slope: ctx.indicators?.ma60Slope,
            vix: ctx.vix,
            marginChangePercent5d: ctx.marginChangePercent5d,
            indexChangePercent5d: ctx.indexChangePercent5d,
          },
          engineState.macroRegime || null,
        );
        engineState.macroRegime = macroRegime;
        ctx.macroRegime = macroRegime;
      } catch (err) {
        // Fallback: 若無法計算則靜默略過
      }
    }

    // CRISIS 模式：立即回傳 Sell-only 決策（禁止新增部位）
    if (regimeResult.state === "CRISIS") {
      const deleverageCfg = strategy.dynamicDeleverage || { sellRatio: 1.0 };
      const sellPercent = Math.round(deleverageCfg.sellRatio * 100);

      return createDecisionResult({
        maintenanceLayer: "normal",
        marketStatus: "🚨【VIX 危機模式】",
        target: "🔴 局部減碼 / 強制賣出",
        targetSuggestionShort: "VIX 超過絕對門檻，禁止新增 00675L 部位",
        targetSuggestion: `VIX 危機模式啟動，依生命週期投資法實行減碼，建議賣出 00675L 當前持股之 ${sellPercent}%`,
        suggestion:
          `• ${formatRegimeStatus(regimeResult)}\n` +
          `• ⚠️ 禁止新增戰術部位（00675L 加碼封鎖）\n` +
          `• 允許操作：0050 DCA 照常執行 + 依比例減倉 ${sellPercent}%`,
        regimeState: "CRISIS",
        regimeResult: regimeResult,
        valuationGuardResult: engineState.valuationGuardResult ?? null,
      });
    }

    // CAUTIOUS 模式：計算調整後的槓桿上限，存入 engineState 供後續規則使用
    if (regimeResult.state === "CAUTIOUS") {
      const lifecycleCfg = strategy.lifecycle;
      const lifecycleProfiles = lifecycleCfg?.profiles || null;
      const retirementAge = lifecycleCfg?.retirementAge ?? 65;
      const currentAge = ctx.currentAge ?? null;

      if (currentAge != null && lifecycleProfiles) {
        const lifecycleContext = computeLifecycleContext(
          currentAge,
          retirementAge,
          lifecycleProfiles,
        );
        const baseMaxLeverage = lifecycleContext.profile.maxLeverage;
        const adjustedMaxLeverage = applyRegimeLeverage(
          baseMaxLeverage,
          regimeResult,
        );

        engineState.adjustedMaxLeverage = adjustedMaxLeverage;
        // 注入 ctx 供相容性（runner 最後會同步）
        ctx.regimeAdjustedMaxLeverage = adjustedMaxLeverage;
        ctx.regimeState = "CAUTIOUS";
      }
    }

    // NORMAL 模式或無法計算調整槓桿：繼續下一條規則
    return null;
  }
}
