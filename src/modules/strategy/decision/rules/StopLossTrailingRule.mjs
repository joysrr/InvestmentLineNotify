/**
 * StopLossTrailingRule (P60: 優先級 60)
 * 停損/移動停利 - 絕對優先權 Override
 * 包含 MA20 跌破停損與動態移動停利（Trailing Stop）
 */

import { DecisionRule, createDecisionResult } from "../DecisionRule.mjs";
import { resolveTrendConfirmation } from "../../core/index.mjs";
import { calcHHV } from "../../indicators.mjs";

export class StopLossTrailingRule extends DecisionRule {
  constructor() {
    super({ priority: 60, name: "StopLossTrailingRule" });
  }

  /**
   * 評估停損/移動停利
   * @param {Object} ctx - 唯讀上下文
   * @param {Object} strategy - 唯讀策略設定
   * @param {Object} engineState - 可變共享狀態
   * @returns {Object|null} 決策結果或 null（繼續下一條）
   */
  evaluate(ctx, strategy, engineState) {
    // 僅在有部位時檢查
    if (ctx.z2Ratio <= 0) {
      return null;
    }

    // ── [PRE-CALC] Trend Confirmation ──
    const trendConfirmation = resolveTrendConfirmation(
      {
        closeArr: ctx.closeArr ?? [],
        ma20Arr: ctx.ma20Arr ?? [],
        atrArr: ctx.atrArr ?? [],
      },
      strategy,
    );

    // ── 動態移動停利 監控 ──
    const { trailingActive, dynamicAnchor } = this._computeTrailingStop(
      ctx,
      strategy,
    );

    // ── 停損與移動停利 Override ──
    const stopLossTriggered =
      trendConfirmation.ma20BreakDays >= (strategy.sell?.ma20StopDays ?? 3);
    const trailingTriggered =
      trailingActive && dynamicAnchor && ctx.currentPrice < dynamicAnchor;

    if ((stopLossTriggered || trailingTriggered) && ctx.z2Ratio > 0) {
      const reason = trailingTriggered
        ? `動態停引 (錨點：${dynamicAnchor.toFixed(1)})`
        : `MA20 跌破 ${trendConfirmation.ma20BreakDays} 日`;

      return createDecisionResult({
        maintenanceLayer: "normal",
        regimeState: engineState.regimeResult?.state ?? null,
        regimeResult: engineState.regimeResult,
        marketStatus: "🚨【動態停損/停利：減碼保護】",
        target: "📉 減碼還款",
        targetSuggestionShort: `${reason}，降至 Baseline`,
        targetSuggestion: `觸發受控退場：${reason}，系統強制減持 00675L 至基礎水位`,
        suggestion:
          `• 觸發原因：${reason}\n` +
          `• 執行策略：減碼至 Baseline (單筆 DCA) 水位以保護利潤並降低風險\n` +
          `• 停利錨點：${dynamicAnchor ? dynamicAnchor.toFixed(1) : "N/A"}\n` +
          `• 啟動狀態：${trailingActive ? "已啟動 (Active)" : "建倉陣痛期 (Cushioning)"}`,
        finalScore: null,
        categoryResults: null,
        trailingActive,
        dynamicAnchor,
        valuationGuardResult: engineState.valuationGuardResult ?? null,
      });
    }

    // 將 trailing 狀態存入 engineState 供 ScoringDecisionRule 使用
    engineState.trailingActive = trailingActive;
    engineState.dynamicAnchor = dynamicAnchor;

    return null;
  }

  /**
   * 計算移動停利（移植自原 buildDecision.computeTrailingStop）
   */
  _computeTrailingStop(ctx, strategy) {
    const tsCfg = strategy.sell?.trailingStop;
    if (!tsCfg?.enabled || ctx.z2Ratio <= 0 || !ctx.portfolio?.lastBuyDate) {
      return { trailingActive: false, dynamicAnchor: null };
    }

    const currentPrice = ctx.currentPrice;

    const profitOk =
      currentPrice >
      (ctx.portfolio.avgCostZ2 || ctx.basePrice || 9999) *
        (1 + tsCfg.activationProfitPct);

    const ma20Arr = ctx.ma20Arr || [];
    const closeArr = ctx.closeArr || [];
    const c1 = closeArr.at(-1),
      c2 = closeArr.at(-2);
    const m1 = ma20Arr.at(-1),
      m2 = ma20Arr.at(-2);
    const ma20Stable =
      closeArr.length >= 2 && ma20Arr.length >= 2 && c1 > m1 && c2 > m2;

    if (!profitOk && !ma20Stable) {
      return { trailingActive: false, dynamicAnchor: null };
    }

    let dynamicAnchor = null;
    if (tsCfg.anchorType === "ma20") {
      dynamicAnchor = ma20Arr.at(-1) * (1 - tsCfg.stopLossBuffer);
    } else if (tsCfg.anchorType === "atr") {
      const allHighs = [...(ctx.highsSince ?? []), currentPrice];
      const hhv = calcHHV(allHighs, allHighs.length).at(-1) ?? currentPrice;
      const atr = ctx.atrArr?.at(-1) || 0;
      dynamicAnchor = hhv - atr * tsCfg.atrMultiplier;
    }

    return { trailingActive: true, dynamicAnchor };
  }
}
