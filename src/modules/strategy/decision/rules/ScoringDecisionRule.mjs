/**
 * ScoringDecisionRule (P100: 優先級 100)
 * 評分驅動決策 - 鏈條最後的兜底規則
 * 包含：預算管控、評分矩陣、戰術加碼/減倉/中性區決策
 */

import { DecisionRule, createDecisionResult } from "../DecisionRule.mjs";
import { generateScoringMatrix } from "../../signalGenerator.mjs";
import {
  MAX_DAILY_LOAN_INCREASE_PCT,
  MAX_ROLLING_LOAN_INCREASE_PCT,
  BUDGET_ROLLING_DAYS,
} from "../../strategyDefaults.mjs";

export class ScoringDecisionRule extends DecisionRule {
  constructor() {
    super({ priority: 100, name: "ScoringDecisionRule" });
  }

  /**
   * 評分驅動決策
   * @param {Object} ctx - 唯讀上下文
   * @param {Object} strategy - 唯讀策略設定
   * @param {Object} engineState - 可變共享狀態（含 trailingActive, dynamicAnchor, valuationGuardResult 等）
   * @returns {Object|null} 決策結果（一定會回傳，作為鏈條終點）
   */
  evaluate(ctx, strategy, engineState) {
    // ── 核心計分矩陣 ──
    const scoringData = {
      institutionalNet: ctx.institutionalNet || 0,
      institutionalHistory: ctx.institutionalHistory || [],
      sentimentScore:
        ctx.macroSentiment?.direction === "BULL"
          ? ctx.macroSentiment.bonus || 0
          : ctx.macroSentiment?.direction === "BEAR"
            ? -(ctx.macroSentiment.penalty || 0)
            : 0,
      ma60SlopeHistory: ctx.ma60SlopeArr || ctx.ma60SlopeHistory || [],
      closeArr: ctx.closeArr || [], // 供 bullMomentum 計算近 20 日漲幅
      hasTacticalPosition: ctx.z2Ratio > 15,
      currentPR: engineState.valuationGuardResult?.currentPR || 0,
    };

    const scoreResult = generateScoringMatrix(
      ctx.indicators,
      ctx.priceDropPercent,
      strategy,
      scoringData,
      ctx.macroSentiment,
    );

    const {
      finalScore,
      signal,
      signalDirection,
      scalingRatio,
      categoryResults,
    } = scoreResult;

    // ── 1.5.A) 預算管控 ──
    const budgetCfg = strategy.trading?.budget;
    const historyLoan10d = ctx.historyLoan10d ?? 0;
    const currentLoan = ctx.portfolio?.totalLoan || 0;
    const effectiveNetAsset = ctx.netAsset || 1;

    const rollingNetIncrease = Math.max(0, currentLoan - historyLoan10d);
    const dailyCap =
      effectiveNetAsset *
      (budgetCfg?.maxDailyLoanIncreasePct || MAX_DAILY_LOAN_INCREASE_PCT);
    const rollingCap =
      effectiveNetAsset *
      (budgetCfg?.maxRollingLoanIncreasePct || MAX_ROLLING_LOAN_INCREASE_PCT);

    const availableDaily = dailyCap;
    const availableRolling = Math.max(0, rollingCap - rollingNetIncrease);
    const finalAvailableBudget = Math.min(availableDaily, availableRolling);

    const budgetInfo = {
      availableRolling,
      finalAvailableBudget,
      budgetCapped: false, // 將在各分支中更新
    };

    // 從 engineState 取得 trailing 狀態
    const trailingActive = engineState.trailingActive ?? false;
    const dynamicAnchor = engineState.dynamicAnchor ?? null;

    // ── 共同基底欄位 ──
    const baseResult = {
      regimeState: engineState.regimeResult?.state ?? null,
      regimeResult: engineState.regimeResult,
      finalScore,
      categoryResults,
      trailingActive,
      dynamicAnchor,
      valuationGuardResult: engineState.valuationGuardResult ?? null,
      valuationMomentumResult: engineState.valuationMomentumResult ?? null,
    };

    // ── 1.5.B) Cooldown 狀態檢查 ──
    const cooldownStatus = ctx.cooldownStatus ?? { inCooldown: false };

    // --- 戰術加碼路徑 ---
    if (signal === "buy_tactical") {
      if (cooldownStatus.inCooldown) {
        return createDecisionResult({
          ...baseResult,
          marketStatus: "⏰【加碼冷卻中】",
          target: "⏸️ 等待冷卻",
          suggestion: `評分 ${finalScore.toFixed(1)} 分符合加碼，但處於冷卻期（剩餘 ${cooldownStatus.daysLeft} 天）`,
          signalDirection: "hold",
          budgetInfo,
        });
      }

      const scalingText =
        scalingRatio < 1.0 ? ` (縮放撥款 ${scalingRatio * 100}%)` : "";

      const suggestedValue = dailyCap * scalingRatio;
      const budgetCapped = suggestedValue > finalAvailableBudget;
      const finalAllocRatio = budgetCapped
        ? finalAvailableBudget / dailyCap
        : scalingRatio;

      budgetInfo.budgetCapped = budgetCapped;

      return createDecisionResult({
        ...baseResult,
        marketStatus: budgetCapped ? "💰【預算受限加碼】" : "🚀【戰術進攻】",
        target: "⚡ 撥款加碼",
        targetSuggestionShort: `評分 ${finalScore.toFixed(1)} 達標，${budgetCapped ? "預算封頂撥款" : "建議撥款"}${scalingText}`,
        targetSuggestion: `分批買入 00675L，${budgetCapped ? "因 10 日滾動預算封頂，今日僅能動用：" + (finalAllocRatio * 100).toFixed(1) + "%" : "今日預算動用率：" + (scalingRatio * 100).toFixed(0) + "%"}`,
        suggestion:
          `• 決策總分：${finalScore.toFixed(1)} 分\n` +
          `• 撥款比例：${(finalAllocRatio * 100).toFixed(1)}% ${budgetCapped ? "(⚠️ 預算上限攔截)" : ""}\n` +
          `• 餘額狀態：可用預算 $${finalAvailableBudget.toLocaleString("zh-TW")} / 滾動上限剩餘 $${availableRolling.toLocaleString("zh-TW")}\n` +
          Object.values(categoryResults)
            .map(
              (c) =>
                `  └ ${c.label}：${c.finalScore.toFixed(1)} ${c.isCapped ? "(已封頂)" : ""}`,
            )
            .join("\n"),
        signalDirection,
        scalingRatio: finalAllocRatio,
        budgetInfo,
      });
    }

    // --- 戰術減倉路徑 ---
    if (signal === "sell_tactical" || signal === "exit_buffer") {
      const reason = signal === "exit_buffer" ? "遲滯緩衝退場" : "評分轉空減倉";
      const sellRatio = strategy.sell?.sellRatioLimit ?? 1.0;
      const isPartial = sellRatio < 1.0;
      const partialText = isPartial
        ? `依生命週期投資法實行減碼，建議賣出 00675L 當前持股之 ${(sellRatio * 100).toFixed(0)}%`
        : "建議賣出 00675L 全數部位（100%）";

      return createDecisionResult({
        ...baseResult,
        marketStatus: "🛡️【主動防禦】",
        target: "🔻 降槓桿",
        targetSuggestionShort: `${reason}（${(sellRatio * 100).toFixed(0)}% 減碼，分 ${finalScore.toFixed(1)}）`,
        targetSuggestion: `評分已跌破門檻，${partialText}還款`,
        suggestion:
          `• 決策總分：${finalScore.toFixed(1)} 分\n` +
          `• 訊號原因：${reason}\n` +
          `• 行動：${partialText}。藉此降低利息支出並提高維持率，同時保留剩餘部分的爆發性複利，維持車上基本曝險。`,
        signalDirection,
        budgetInfo,
      });
    }

    // --- 4) 市場中性區：僅執行 0050 DCA ---
    return createDecisionResult({
      ...baseResult,
      marketStatus: "🌱【中性/常態佈局】",
      target: "🔹 0050 DCA",
      targetSuggestionShort: "僅執行 0050 定時定額，暫停 00675L 活動",
      targetSuggestion:
        "市場處於中性區間（總分 " +
        finalScore.toFixed(1) +
        "），僅執行 0050 基礎保底投入",
      suggestion:
        `• 決策總分：${finalScore.toFixed(1)} 分 (中性區 -4 ~ +4)\n` +
        `• 行動建議：維持 0050 基礎加碼，不觸發 00675L 戰術槓桿，節省利息並靜待訊號共振`,
      signalDirection: "hold",
      budgetInfo,
    });
  }
}
