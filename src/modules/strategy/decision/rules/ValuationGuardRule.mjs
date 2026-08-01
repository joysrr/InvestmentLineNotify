/**
 * ValuationGuardRule (P40: 優先級 40)
 * 估值守衛 - 含預計算與 Latch 機制
 * 需在 chain 執行前預計算（或在第一次 evaluate 時計算並快取）
 */

import { DecisionRule, createDecisionResult } from "../DecisionRule.mjs";
import {
  resolveValuationGuard,
  evaluateValuationGuard,
  resolveValuationMomentum,
} from "../../core/index.mjs";

export class ValuationGuardRule extends DecisionRule {
  constructor() {
    super({ priority: 40, name: "ValuationGuardRule" });
    this._precalculated = false;
  }

  /**
   * 評估估值守衛
   * @param {Object} ctx - 唯讀上下文
   * @param {Object} strategy - 唯讀策略設定
   * @param {Object} engineState - 可變共享狀態（含 valuationGuardResult, valuationMomentumResult）
   * @returns {Object|null} 決策結果或 null（繼續下一條）
   */
  evaluate(ctx, strategy, engineState) {
    const vgCfg = strategy?.valuationGuard;

    // 若未啟用或無 PB 資料：略過
    if (
      !vgCfg?.enabled ||
      ctx.pbRecords == null ||
      ctx.pbRecords.length === 0
    ) {
      return null;
    }

    // 預計算估值守衛指標（只做一次，快取在 engineState）
    if (!this._precalculated) {
      this._precalculateValuationGuard(ctx, strategy, engineState);
      this._precalculated = true;
    }

    // 評估估值守衛觸發條件
    if (engineState.valuationGuardResult) {
      const vgEval = evaluateValuationGuard(
        ctx,
        strategy,
        engineState.valuationGuardResult,
      );

      if (vgEval) {
        return createDecisionResult({
          ...vgEval,
          regimeState: engineState.regimeResult?.state ?? null,
          regimeResult: engineState.regimeResult,
          valuationGuardResult: engineState.valuationGuardResult,
          valuationMomentumResult: engineState.valuationMomentumResult,
        });
      }
    }

    return null;
  }

  /**
   * 預計算估值守衛相關指標
   * 邏輯移植自原 buildDecision 的 PRE-CALC 區塊
   */
  _precalculateValuationGuard(ctx, strategy, engineState) {
    const vgCfg = strategy?.valuationGuard;

    // 取得當前 PB（優先從 valuation 抓取，否則從歷史紀錄最新一筆）
    let currentPB = ctx.valuation?.pb ?? null;
    if (currentPB == null && ctx.pbRecords.length > 0) {
      currentPB = ctx.pbRecords[ctx.pbRecords.length - 1];
    }

    if (currentPB == null) return;

    // 解析估值守衛結果
    const vgResult = resolveValuationGuard(currentPB, ctx.pbRecords, strategy);

    // Latch 邏輯
    const latchState = ctx.valuationGuardState ?? { latchActive: false };
    const triggerPrThreshold = vgCfg?.latch?.triggerPrThreshold ?? 90;
    const prBelowThreshold =
      vgCfg?.latch?.unlockConditions?.condition1?.prBelowThreshold ?? 50;
    const shouldLatch =
      !latchState.latchActive && vgResult.currentPR >= triggerPrThreshold;
    const shouldUnlatch =
      latchState.latchActive && vgResult.currentPR < prBelowThreshold;
    vgResult.defenseLatchActive =
      shouldLatch || (latchState.latchActive && !shouldUnlatch);

    // Momentum 計算
    const vixArr = ctx.vixArr || [];
    const currentVix = vixArr.length > 0 ? vixArr[vixArr.length - 1] : null;
    const previousVix = vixArr.length > 1 ? vixArr[vixArr.length - 2] : null;

    engineState.valuationMomentumResult = resolveValuationMomentum(
      vgResult.currentPR,
      ctx.pbRecordsObjects,
      strategy,
      { currentVix, previousVix },
    );
    engineState.valuationGuardResult = vgResult;

    // 同步回 ctx（相容性）
    ctx.valuationMomentumResult = engineState.valuationMomentumResult;
  }
}
