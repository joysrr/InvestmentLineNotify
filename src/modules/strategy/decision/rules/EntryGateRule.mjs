/**
 * EntryGateRule (P50: 優先級 50)
 * 前置過濾器 - 檢查跌幅與 RSI 門檻決定是否允許加碼
 */

import { DecisionRule, createDecisionResult } from "../DecisionRule.mjs";
import { resolveEntryGate } from "../../policies/entryGatePolicy.mjs";

export class EntryGateRule extends DecisionRule {
  constructor() {
    super({ priority: 50, name: "EntryGateRule" });
  }

  /**
   * 評估 Entry Gate
   * @param {Object} ctx - 唯讀上下文
   * @param {Object} strategy - 唯讀策略設定
   * @param {Object} engineState - 可變共享狀態
   * @param {Object} grossLeverageResult - 槓桿計算結果
   * @param {number|null} ma60Slope - MA60 坡度
   * @returns {Object|null} 決策結果或 null（繼續下一條）
   */
  evaluate(ctx, strategy, engineState, grossLeverageResult, ma60Slope) {
    const entryGateCfg = strategy.buy?.entryGate;

    if (!entryGateCfg?.enabled) {
      return null;
    }

    const gateResult = resolveEntryGate(
      ctx.priceDropPercent,
      ctx.rsi,
      entryGateCfg,
      ma60Slope,
    );

    if (gateResult.blocked) {
      const tierIndex = gateResult.tierIndex;
      const tier = gateResult.tier;
      const tierLabels = [
        "底倉通道",
        "淺層修正通道",
        "深度回撤通道",
        "極端恐慌通道",
      ];
      const tierEmojis = ["🌱", "🟡", "🟠", "🔴"];
      const tierLabel = tierLabels[tierIndex] ?? `Tier ${tierIndex}`;
      const tierEmoji = tierEmojis[tierIndex] ?? "⚙️";

      const rsiInfo =
        tier.rsiThreshold != null
          ? `RSI 門檻：${tier.rsiThreshold}（當前 ${ctx.rsi.toFixed(0)}）`
          : "RSI 門檻：不適用";

      return createDecisionResult({
        maintenanceLayer: "normal",
        entryGateLevel: tierIndex,
        entryGateLabel: tierLabel,
        entryGateBlocked: true,
        regimeState: engineState.regimeResult?.state ?? null,
        regimeResult: engineState.regimeResult,
        valuationGuardResult: engineState.valuationGuardResult ?? null,
        marketStatus: `${tierEmoji}【前置過濾：${tierLabel}】`,
        target: "🚧 槓桿封鎖",
        targetSuggestionShort: `${tier.note}（跌幅 ${ctx.priceDropPercent.toFixed(1)}%）`,
        targetSuggestion: `entryGate ${tierLabel}：${tier.note}`,
        suggestion:
          `• 當前跌幅：${ctx.priceDropPercent.toFixed(1)}%（區間 ${tier.minDrop}–${tier.maxDrop === 999 ? "∞" : tier.maxDrop}%）\n` +
          `• ${rsiInfo}\n` +
          `• 封鎖原因：${gateResult.blockReason}\n` +
          `• ⚠️ 本層通道不允許 00675L 加碼（entryGate 前置過濾）\n` +
          `• 允許操作：0050 DCA 照常執行`,
      });
    }

    return null;
  }
}
