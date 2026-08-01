/**
 * RebalanceRule (P80: 優先級 80)
 * 再平衡：00675L 佔比過高
 */

import { DecisionRule, createDecisionResult } from "../DecisionRule.mjs";

export class RebalanceRule extends DecisionRule {
  constructor() {
    super({ priority: 80, name: "RebalanceRule" });
  }

  /**
   * 評估再平衡
   * @param {Object} ctx - 唯讀上下文
   * @param {Object} strategy - 唯讀策略設定
   * @param {Object} engineState - 可變共享狀態
   * @returns {Object|null} 決策結果或 null（繼續下一條）
   */
  evaluate(ctx, strategy, engineState) {
    const th = strategy.threshold;
    const { z2Ratio, netAsset, currentZ2Value } = ctx;

    if (z2Ratio <= th.z2RatioHigh) {
      return null;
    }

    const targetZ2Value = netAsset * th.z2TargetRatio;
    const sellAmount = Math.max(0, currentZ2Value - targetZ2Value);

    if (sellAmount <= th.minActionableAmount) {
      return null;
    }

    return createDecisionResult({
      regimeState: engineState.regimeResult?.state ?? null,
      regimeResult: engineState.regimeResult,
      marketStatus: "⚖️【再平衡】",
      target: "🔻 降槓桿",
      targetSuggestionShort: "賣出 00675L 還款，恢復目標佔比",
      targetSuggestion: "賣出部分 00675L 並還款，恢復到目標佔比",
      suggestion:
        `• 00675L 當前佔比：${z2Ratio.toFixed(1)}%\n` +
        `• 警戒上限門檻：${th.z2RatioHigh}%\n` +
        `• 目標佔比設定：${(th.z2TargetRatio * 100).toFixed(0)}%\n` +
        `• 建議賣出金額：約 ${sellAmount.toLocaleString("zh-TW", { maximumFractionDigits: 0 })} 元並全數還款`,
    });
  }
}
