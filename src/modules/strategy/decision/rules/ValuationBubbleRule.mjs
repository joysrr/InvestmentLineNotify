/**
 * ValuationBubbleRule (P70: 優先級 70)
 * 估值極度昂貴：防泡沫機制 (PB > 2.2)
 * 直接回傳決策，停止加碼
 */

import { DecisionRule, createDecisionResult } from "../DecisionRule.mjs";

export class ValuationBubbleRule extends DecisionRule {
  constructor() {
    super({ priority: 70, name: "ValuationBubbleRule" });
  }

  /**
   * 評估估值泡沫
   * @param {Object} ctx - 唯讀上下文
   * @param {Object} strategy - 唯讀策略設定
   * @param {Object} engineState - 可變共享狀態
   * @returns {Object|null} 決策結果或 null（繼續下一條）
   */
  evaluate(ctx, strategy, engineState) {
    const vgCfg = strategy?.valuationGuard;
    const pbValue = ctx.valuation?.pb;

    if (!vgCfg?.enabled || pbValue == null || pbValue < 2.2) {
      return null;
    }

    return createDecisionResult({
      regimeState: engineState.regimeResult?.state ?? null,
      regimeResult: engineState.regimeResult,
      marketStatus: "🫧【估值泡沫】",
      target: "🛑 鎖定風險",
      targetSuggestionShort: `大盤 PB 達 ${pbValue}，停止加碼 00675L 預防劇烈修正`,
      targetSuggestion: `大盤 PB 高達 ${pbValue} 進入泡沫警戒區，強制暫停撥款買入，建議視情況降槓桿`,
      suggestion:
        `• 大盤股價淨值比 (PB)：${pbValue} (極端門檻 2.2)\n` +
        `• 風控說明：歷史數據顯示大盤 PB 超過 2.2 常伴隨毀滅性回檔。即使技術面呈多頭，系統仍強制在此階段停止買進，保護資金安全。`,
      valuationGuardResult: engineState.valuationGuardResult ?? null,
    });
  }
}
