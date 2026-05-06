import { getReserveStatus } from "./riskManagement.mjs";
import {
  validateStrategyConfig,
  fetchStrategyConfig,
  computeEntryScore,
  computeReversalTriggers,
  computeOverheatState,
  computeSellSignals,
} from "./signalRules.mjs";
import { calcHHV, getMACDSignal } from "./indicators.mjs";
import { computeGrossLeverage } from "./leverageMonitor.mjs";
import { generateScoringMatrix } from "./signalGenerator.mjs";
import { archiveManager } from "../data/archiveManager.mjs";
import {
  PANIC_BYPASS_DROP_PCT,
  PANIC_BYPASS_VIX_THRESHOLD,
  MAX_DAILY_LOAN_INCREASE_PCT,
  MAX_ROLLING_LOAN_INCREASE_PCT,
  BUDGET_ROLLING_DAYS,
} from "./strategyDefaults.mjs";
import {
  computeLifecycleContext,
  determineLifecycleStage,
  LIFECYCLE_STAGE,
} from "./lifecycleEngine.mjs";

import {
  getMarginLayer,
  evaluateMarginLayer,
  evaluateGrossLeverage,
  resolveValuationGuard,
  resolveTrendConfirmation,
  evaluateValuationGuard,
  resolveValuationMomentum,
  checkCooldown,
} from "./core/index.mjs";

import {
  resolveEntryGate,
  resolveVixOverride,
  resolveMacroSentiment,
  analyzeMarginRisk,
  analyzeCapitalDecoupling,
  analyzeSurvival,
  resolveBudgetSynergy,
  resolveConversionGuard,
} from "./policies/index.mjs";

// ─────────────────────────────────────────────────────────────
// Regime-aware Policy Module（新增）
// ─────────────────────────────────────────────────────────────
import {
  determineRegime,
  applyRegimeLeverage,
  allowsTacticalEntry,
  requiresForcedReduction,
  formatRegimeStatus,
} from "./regimePolicy.mjs";

import { parseNumber } from "../../utils/coreUtils.mjs";
import { normalizeMarketData } from "../../utils/normalizer.mjs";

/**
 * Trailing Stop Stub（Phase 2.4 Backtest 框架實現）
 * TODO: 實現動態移動停利邏輯
 */
async function computeTrailingStop(ctx, strategy) {
  return {
    trailingActive: false,
    dynamicAnchor: null,
  };
}

/**
 * 決策優先鏈（Priority 由高到低，越高越優先 early return）：
 *  P0 - Regime 硬條件檢查    → determineRegime（新增）
 *  P1 - 維持率 4 層狀態機     → evaluateMarginLayer
 *  P2 - Gross Leverage 警戒  → evaluateGrossLeverage
 *       ↑ P3 isPanicBypass 旗標在 P2 之前預算，作為參數注入 P2
 *  P4 - 估值守衛              → resolveValuationGuard / evaluateValuationGuard
 *  P5 - EntryGate 前置過濾   → resolveEntryGate
 *  P6 - 停損/移動停利       → stopLossTriggered / trailingTriggered
 *  P7 - 估值泡沫 (PB ≥ 2.2)  → 直接 return
 *  P8 - 再平衡 (z2RatioHigh) → 直接 return
 *  P9 - 評分驅動決策          → buy_tactical / sell_tactical / neutral
 */
export async function buildDecision(
  ctx,
  strategy,
  grossLeverageResult,
  ma60Slope = null,
) {
  const th = strategy.threshold;
  const maint = strategy.maintenance;

  const {
    maintenanceMargin,
    z2Ratio,
    netAsset,
    currentZ2Value,
    entry,
    overheat,
    reversal,
    sellSignals,
    cooldownStatus,
    valuation,
  } = ctx;

  const engineState = {
    panicBypassActive: false,
    valuationGuardResult: null,
    regimeResult: null,           // ← 新增：Regime 判定結果
    adjustedMaxLeverage: null,    // ← 新增：Regime 調整後的槓桿上限
  };

  const reserveStatus = getReserveStatus(ctx, strategy);
  const marginLayer = getMarginLayer(maintenanceMargin, maint, th);

  // ─────────────────────────────────────────────────────────────
  // ★ Regime-aware Policy（P0：最高優先級，在 Lifecycle Engine 之前）
  // 根據 VIX 和 MacroSentiment 動態調整槓桿上限與交易模式
  // ─────────────────────────────────────────────────────────────
  const regimeCfg = strategy.regime || {}; // 向下相容：若無配置則使用預設值
  const vix = ctx.vix;
  const sentiment = ctx.macroSentiment?.direction || 'NEUTRAL';

  const regimeResult = determineRegime(vix, sentiment, regimeCfg);
  engineState.regimeResult = regimeResult;

  // CRISIS 模式：立即 return Sell-only 決策（禁止新增部位）
  if (regimeResult.state === 'CRISIS') {
    return {
      maintenanceLayer: "normal",
      marketStatus: "🚨【VIX 危機模式】",
      target: "🔴 強制賣出",
      targetSuggestionShort: "VIX 超過絕對門檻，禁止新增 00675L 部位",
      targetSuggestion: "VIX 危機模式啟動，僅允許減倉/還款/DCA 操作",
      suggestion:
        `• ${formatRegimeStatus(regimeResult)}\n` +
        `• ⚠️ 禁止新增戰術部位（00675L 加碼封鎖）\n` +
        `• 允許操作：0050 DCA 照常執行 + 主動減倉還款`,
      regimeState: 'CRISIS',
      regimeResult: regimeResult,
      valuationGuardResult: engineState.valuationGuardResult ?? null,
    };
  }

  // CAUTIOUS 模式：計算調整後的槓桿上限，注入 ctx 供 Lifecycle Engine 使用
  if (regimeResult.state === 'CAUTIOUS') {
    // 若 Lifecycle 已啟用，預先計算調整後的 maxLeverage
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
      const adjustedMaxLeverage = applyRegimeLeverage(baseMaxLeverage, regimeResult);

      engineState.adjustedMaxLeverage = adjustedMaxLeverage;
      // 注入 ctx 供後續 Lifecycle 檢查使用
      ctx.regimeAdjustedMaxLeverage = adjustedMaxLeverage;
      ctx.regimeState = 'CAUTIOUS';
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 維持率 4 層狀態機（越危險越優先，最先被檢出）
  // ─────────────────────────────────────────────────────────────

  const marginLayerObj = evaluateMarginLayer(
    marginLayer,
    ctx,
    strategy,
    reserveStatus,
  );
  if (marginLayerObj) return marginLayerObj;

  // 🟢 Layer 3：常態運行 >= protectTrigger(160)
  // 以下為原有策略邏輯完整執行

  // ── [P3 旗標預算] isPanicBypass：須在 P2 之前計算，以參數形式注入 evaluateGrossLeverage ──
  const ohCfg = strategy?.overrideHierarchy;
  const panicBypassEnabled = ohCfg?.panicBypassEnabled ?? false;
  const panicBypassDropPct = ohCfg?.panicBypassDropPct ?? PANIC_BYPASS_DROP_PCT;
  const panicVixThreshold = ohCfg?.panicVixThreshold ?? PANIC_BYPASS_VIX_THRESHOLD;

  const isPanicBypass =
    panicBypassEnabled &&
    ctx.priceDropPercent > panicBypassDropPct &&
    ctx.vix > panicVixThreshold;

  // 將狀態存入 ctx 供後續模組讀取
  engineState.panicBypassActive = isPanicBypass;

  // ─────────────────────────────────────────────────────────────
  // ★ 生命週期槓桿引擎（P2.5：在 Gross Leverage 之前檢查）
  // 根據年齡與退休目標，動態調整 maxLeverage 上限
  // ─────────────────────────────────────────────────────────────
  const lifecycleCfg = strategy.lifecycle;
  const lifecycleProfiles = lifecycleCfg?.profiles || null;
  const retirementAge = lifecycleCfg?.retirementAge ?? 65;

  // 從 ctx 注入 currentAge（需由 caller 或 dailyRunContext 提供）
  const currentAge = ctx.currentAge ?? null;
  let lifecycleContext = null;

  if (currentAge != null) {
    lifecycleContext = computeLifecycleContext(
      currentAge,
      retirementAge,
      lifecycleProfiles,
    );

    // 獲取當前 grossLeverage（已計算）
    const currentGrossLeverage = grossLeverageResult?.grossLeverage || 0;

    // 獲取該階段的 maxLeverage（若 Regime CAUTIOUS 則使用調整後的值）
    const baseStageMaxLeverage = lifecycleContext.profile.maxLeverage;
    const stageMaxLeverage = engineState.adjustedMaxLeverage ?? baseStageMaxLeverage;

    // 檢查是否超過生命週期槓桿上限（含 Regime 調整）
    if (currentGrossLeverage > stageMaxLeverage) {
      const regimeNote = engineState.regimeResult?.state === 'CAUTIOUS'
        ? `（含 Regime CAUTIOUS 調整：${baseStageMaxLeverage}x × ${engineState.regimeResult.leverageMultiplier} = ${stageMaxLeverage}x）`
        : '';

      return {
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
      };
    }
  }

  // ─────────────────────────────────────────────────────────────
  const leverageObj = evaluateGrossLeverage(
    grossLeverageResult,
    strategy,
    engineState.panicBypassActive,
  );
  if (leverageObj) return leverageObj;

  // ─────────────────────────────────────────────────────────────
  const vgCfg = strategy?.valuationGuard;
  const trendConfirmation = resolveTrendConfirmation(
    {
      closeArr: ctx.closeArr ?? [],
      ma20Arr: ctx.ma20Arr ?? [],
      atrArr: ctx.atrArr ?? [],
    },
    strategy,
  );
  if (
    vgCfg?.enabled &&
    ctx.pbRecords != null &&
    !engineState.panicBypassActive
  ) {
    const currentPB = ctx.valuation?.pb ?? null;
    const pbRecords = ctx.pbRecords ?? [];
    const vgResult = resolveValuationGuard(currentPB, pbRecords, strategy);

    // Explicitly compute latch state for frontend
    const latchState = ctx.valuationGuardState ?? { latchActive: false };
    const triggerPrThreshold = vgCfg?.latch?.triggerPrThreshold ?? 90;
    const prBelowThreshold = vgCfg?.latch?.unlockConditions?.condition1?.prBelowThreshold ?? 50;
    const shouldLatch =
      !latchState.latchActive && vgResult.currentPR >= triggerPrThreshold;
    const shouldUnlatch =
      latchState.latchActive && vgResult.currentPR < prBelowThreshold;
    vgResult.defenseLatchActive =
      shouldLatch || (latchState.latchActive && !shouldUnlatch);

    // Unconditionally compute momentum if enabled
    // vixData: 從 ctx.vixArr 取得 currentVix 和 previousVix
    const vixArr = ctx.vixArr || [];
    const currentVix = vixArr.length > 0 ? vixArr[vixArr.length - 1] : null;
    const previousVix = vixArr.length > 1 ? vixArr[vixArr.length - 2] : null;

    ctx.valuationMomentumResult = resolveValuationMomentum(
      vgResult.currentPR,
      ctx.pbRecordsObjects,
      strategy,
      { currentVix, previousVix },
    );

    engineState.valuationGuardResult = vgResult; // ← 由 Engine 層統一持有，供後續節點讀取
    const vgEval = evaluateValuationGuard(ctx, strategy, vgResult);
    if (vgEval) return vgEval;
  }

  // ─────────────────────────────────────────────────────────────
  // ★ Pre-Entry Gate：左側進擊矩陣前置過濾（依跌幅層級限制允許操作）
  // entryGate 在估值泡沫/再平衡/恐慌買入之前執行，確保所有買入路徑均受過濾
  // ─────────────────────────────────────────────────────────────
  const entryGateCfg = strategy.buy?.entryGate;
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

    return {
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
    };
  }

  // ─────────────────────────────────────────────────────────────
  // ★ 核心計分矩陣 (Scoring Matrix) 決策引擎注入
  // ─────────────────────────────────────────────────────────────

  // ── 宏觀情緒數據接入（使用現有 dailyRunContext 的多空分析）──────────
  // ctx.macroSentiment 已從 buildEngineContext 注入，包含：
  //   - direction: BULL/BEAR/NEUTRAL（從 AI Coach 分析新聞得出）
  //   - bonus: 多頭加分（從 strategy.macroSentiment.bullishBonus）
  //   - penalty: 空頭扣分（從 strategy.macroSentiment.bearishPenalty）
  //   - vix: 當前 VIX 值（供 VIX 短路機制使用）
  //   - vixOverrideActive: VIX 情緒短路標記
  // 若 macroSentiment 為 null，則不套用情緒加成
  // ─────────────────────────────────────────────────────────────────
  const scoringData = {
    institutionalNet: ctx.institutionalNet || 0,
    institutionalHistory: ctx.institutionalHistory || [],
    sentimentScore:
      ctx.macroSentiment?.direction === "BULL"
        ? ctx.macroSentiment.bonus || 0
        : ctx.macroSentiment?.direction === "BEAR"
          ? -(ctx.macroSentiment.penalty || 0)
          : 0,
    ma60SlopeHistory: ctx.ma60SlopeHistory || [],
    hasTacticalPosition: ctx.z2Ratio > 15,
    currentPR: engineState.valuationGuardResult?.currentPR || 0,
  };

  const scoreResult = generateScoringMatrix(
    ctx.indicators,
    ctx.priceDropPercent,
    strategy,
    scoringData,
    ctx.macroSentiment,  // ✅ 已從 dailyRunContext.macroMarketDirection 接入
  );
  const {
    finalScore,
    signal,
    signalDirection,
    scalingRatio,
    categoryResults,
    macroSentimentBonus,
    macroSentimentLabel,
  } = scoreResult;

  // --- 1.5.A) 預算管控 (Budget Control) ---
  const budgetCfg = strategy.trading?.budget;
  const rollingLoanDays = budgetCfg?.rollingDays || BUDGET_ROLLING_DAYS;
  const historyLoan10d =
    await archiveManager.getHistoricalLoan(rollingLoanDays);
  const currentLoan = ctx.portfolio?.totalLoan || 0;
  const effectiveNetAsset = netAsset || ctx.netAsset || 1;

  const rollingNetIncrease = Math.max(0, currentLoan - historyLoan10d);
  const dailyCap =
    effectiveNetAsset * (budgetCfg?.maxDailyLoanIncreasePct || MAX_DAILY_LOAN_INCREASE_PCT);
  const rollingCap =
    effectiveNetAsset * (budgetCfg?.maxRollingLoanIncreasePct || MAX_ROLLING_LOAN_INCREASE_PCT);

  const availableDaily = dailyCap; // 簡化：當日通常只執行一筆
  const availableRolling = Math.max(0, rollingCap - rollingNetIncrease);
  const finalAvailableBudget = Math.min(availableDaily, availableRolling);

  // --- 1.5.B) 動態移動停利 (Trailing Stop) 監控 ---
  const { trailingActive, dynamicAnchor } = await computeTrailingStop(
    ctx,
    strategy,
  );

  // 1.5.C) 停損與絕對優先權 Override (Priority High)
  const stopLossTriggered =
    trendConfirmation.ma20BreakDays >= (strategy.sell?.ma20StopDays ?? 3);
  const trailingTriggered =
    trailingActive && dynamicAnchor && ctx.currentPrice < dynamicAnchor;

  if ((stopLossTriggered || trailingTriggered) && ctx.z2Ratio > 0) {
    const reason = trailingTriggered
      ? `動態停引 (錨點：${dynamicAnchor.toFixed(1)})`
      : `MA20 跌破 ${trendConfirmation.ma20BreakDays} 日`;
    return {
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
      finalScore,
      categoryResults,
      trailingActive,
      dynamicAnchor,
      valuationGuardResult: engineState.valuationGuardResult ?? null,
    };
  }

  // 1.6) 估值極度昂貴：防泡沫機制 (PB > 2.2)
  const pbValue = valuation?.pb;
  if (pbValue != null && pbValue >= 2.2) {
    return {
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
    };
  }

  // 1.7) 階梯式獲利轉化 (Conversion Guard)
  const conversionResult = resolveConversionGuard(ctx, strategy);
  if (conversionResult) {
    return {
      ...conversionResult,
      regimeState: engineState.regimeResult?.state ?? null,
      regimeResult: engineState.regimeResult,
      valuationGuardResult: engineState.valuationGuardResult ?? null,
    };
  }

  // 2) 再平衡：00675L 佔比過高
  if (z2Ratio > th.z2RatioHigh) {
    const targetZ2Value = netAsset * th.z2TargetRatio;
    const sellAmount = Math.max(0, currentZ2Value - targetZ2Value);

    if (sellAmount > th.minActionableAmount) {
      return {
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
      };
    }
  }

  // 3) 評分驅動決策 (Scoring Driven)
  // --- 戰術加碼路徑 ---
  if (signal === "buy_tactical") {
    // 檢查冷卻期
    if (cooldownStatus.inCooldown) {
      return {
        regimeState: engineState.regimeResult?.state ?? null,
        regimeResult: engineState.regimeResult,
        marketStatus: "⏰【加碼冷卻中】",
        target: "⏸️ 等待冷卻",
        suggestion: `評分 ${finalScore.toFixed(1)} 分符合加碼，但處於冷卻期（剩餘 ${cooldownStatus.daysLeft} 天）`,
        finalScore,
        categoryResults,
      };
    }

    const scalingText =
      scalingRatio < 1.0 ? ` (縮放撥款 ${scalingRatio * 100}%)` : "";

    // 檢查預算上限
    const suggestedValue = dailyCap * scalingRatio; // 假設預算基礎為單日上限
    const budgetCapped = suggestedValue > finalAvailableBudget;
    const finalAllocRatio = budgetCapped
      ? finalAvailableBudget / dailyCap
      : scalingRatio;

    return {
      regimeState: engineState.regimeResult?.state ?? null,
      regimeResult: engineState.regimeResult,
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
      finalScore,
      categoryResults,
      signalDirection,
      scalingRatio: finalAllocRatio,
      valuationGuardResult: engineState.valuationGuardResult ?? null,
      budgetInfo: { availableRolling, finalAvailableBudget, budgetCapped },
    };
  }

  // --- 戰術減倉路徑 ---
  if (signal === "sell_tactical" || signal === "exit_buffer") {
    const reason = signal === "exit_buffer" ? "遲滯緩衝退場" : "評分轉空減倉";
    return {
      regimeState: engineState.regimeResult?.state ?? null,
      regimeResult: engineState.regimeResult,
      marketStatus: "🛡️【主動防禦】",
      target: "🔻 降槓桿",
      targetSuggestionShort: `${reason}（總分 ${finalScore.toFixed(1)}）`,
      targetSuggestion: `評分已跌破門檻，建議賣出 00675L 還款`,
      suggestion: `• 決策總分：${finalScore.toFixed(1)} 分\n• 訊號原因：${reason}\n• 行動：結清戰術加碼部位，降低利息支出並提高維持率`,
      finalScore,
      categoryResults,
      signalDirection,
      trailingActive,
      dynamicAnchor,
      valuationGuardResult: engineState.valuationGuardResult ?? null,
    };
  }

  // 4) 市場中性區 (Neutral Zone)：僅執行 0050 DCA
  return {
    regimeState: engineState.regimeResult?.state ?? null,
    regimeResult: engineState.regimeResult,
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
    finalScore,
    categoryResults,
    trailingActive,
    dynamicAnchor,
    valuationGuardResult: engineState.valuationGuardResult ?? null,
    valuationMomentumResult: ctx.valuationMomentumResult ?? null,
  };
}
