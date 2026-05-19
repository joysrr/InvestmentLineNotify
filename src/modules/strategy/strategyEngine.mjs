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
// Regime-aware Policy Module
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
 * Trailing Stop（動態移動停利邏輯）
 */
function computeTrailingStop(ctx, strategy, highsSince) {
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
    const allHighs = [...highsSince, currentPrice];
    const hhv = calcHHV(allHighs, allHighs.length).at(-1) ?? currentPrice;
    const atr = ctx.atrArr?.at(-1) || 0;
    dynamicAnchor = hhv - atr * tsCfg.atrMultiplier;
  }

  return { trailingActive: true, dynamicAnchor };
}

/**
 * 決策優先鏈（Priority 由高到低，越高越優先 early return）：
 *  P0 - Regime 硬條件檢查    → determineRegime
 *  P1 - 維持率 4 層狀態機     → evaluateMarginLayer
 *  P2 - Gross Leverage 警戒  → evaluateGrossLeverage
 *       ↑ P3 isPanicBypass 旗標在 P2 之前預算，作為參數注入 P2
 *  P4 - 估值守衛              → resolveValuationGuard / evaluateValuationGuard
 *  P5 - EntryGate 前置過濾   → resolveEntryGate
 *  P6 - 停損/移動停利         → stopLossTriggered / trailingTriggered
 *  P7 - 估值泡沫 (PB ≥ 2.2)  → 直接 return
 *  P8 - 再平衡 (z2RatioHigh) → 直接 return
 *  P9 - 評分驅動決策          → buy_tactical / sell_tactical / neutral
 */
export function buildDecision(
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
    valuationMomentumResult: null, // Ensure this is initialized
    regimeResult: null,
    adjustedMaxLeverage: null,
  };

  // ── [PRE-CALC] Valuation Indicators (Always calc this for UI/Reporting) ──
  const vgCfg = strategy?.valuationGuard;
  if (vgCfg?.enabled && ctx.pbRecords != null) {
    // 優先從 valuation 抓取，若無則從歷史紀錄最新一筆抓取 (即時性 Fallback)
    let currentPB = ctx.valuation?.pb ?? null;
    if (currentPB == null && ctx.pbRecords.length > 0) {
      currentPB = ctx.pbRecords[ctx.pbRecords.length - 1];
    }

    const vgResult = resolveValuationGuard(currentPB, ctx.pbRecords, strategy);

    // Latch logic
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

    // Momentum
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
    ctx.valuationMomentumResult = engineState.valuationMomentumResult;
  }

  const reserveStatus = getReserveStatus(ctx, strategy);
  const marginLayer = getMarginLayer(maintenanceMargin, maint, th);

  // ── [PRE-CALC] Trend Confirmation ──
  const trendConfirmation = resolveTrendConfirmation(
    {
      closeArr: ctx.closeArr ?? [],
      ma20Arr: ctx.ma20Arr ?? [],
      atrArr: ctx.atrArr ?? [],
    },
    strategy,
  );

  // ─────────────────────────────────────────────────────────────
  // ★ Regime-aware Policy（P0：最高優先級，在 Lifecycle Engine 之前）
  // ─────────────────────────────────────────────────────────────
  const regimeCfg = strategy.regime || {};
  const vix = ctx.vix;
  const sentiment = ctx.macroSentiment?.direction || "NEUTRAL";

  const regimeResult = determineRegime(vix, sentiment, regimeCfg);
  engineState.regimeResult = regimeResult;

  // CRISIS 模式：立即 return Sell-only 決策（禁止新增部位）
  if (regimeResult.state === "CRISIS") {
    const deleverageCfg = strategy.dynamicDeleverage || { sellRatio: 1.0 };
    const sellPercent = Math.round(deleverageCfg.sellRatio * 100);

    return {
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
    };
  }

  // CAUTIOUS 模式：計算調整後的槓桿上限，注入 ctx 供 Lifecycle Engine 使用
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
      ctx.regimeAdjustedMaxLeverage = adjustedMaxLeverage;
      ctx.regimeState = "CAUTIOUS";
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

  // ── [P3 旗標預算] isPanicBypass：須在 P2 之前計算 ──
  const ohCfg = strategy?.overrideHierarchy;
  const panicBypassEnabled = ohCfg?.panicBypassEnabled ?? false;
  const panicBypassDropPct = ohCfg?.panicBypassDropPct ?? PANIC_BYPASS_DROP_PCT;
  const panicVixThreshold =
    ohCfg?.panicVixThreshold ?? PANIC_BYPASS_VIX_THRESHOLD;

  const isPanicBypass =
    panicBypassEnabled &&
    ctx.priceDropPercent > panicBypassDropPct &&
    ctx.vix > panicVixThreshold;

  engineState.panicBypassActive = isPanicBypass;

  // ─────────────────────────────────────────────────────────────
  // ★ 生命週期槓桿引擎（P2.5：在 Gross Leverage 之前檢查）
  // ─────────────────────────────────────────────────────────────
  const lifecycleCfg = strategy.lifecycle;
  const lifecycleProfiles = lifecycleCfg?.profiles || null;
  const retirementAge = lifecycleCfg?.retirementAge ?? 65;

  const currentAge = ctx.currentAge ?? null;
  let lifecycleContext = null;

  if (currentAge != null) {
    lifecycleContext = computeLifecycleContext(
      currentAge,
      retirementAge,
      lifecycleProfiles,
    );

    const currentGrossLeverage = grossLeverageResult?.grossLeverage || 0;
    const baseStageMaxLeverage = lifecycleContext.profile.maxLeverage;
    const stageMaxLeverage =
      engineState.adjustedMaxLeverage ?? baseStageMaxLeverage;

    if (currentGrossLeverage > stageMaxLeverage) {
      const regimeNote =
        engineState.regimeResult?.state === "CAUTIOUS"
          ? `（含 Regime CAUTIOUS 調整：${baseStageMaxLeverage}x × ${engineState.regimeResult.leverageMultiplier} = ${stageMaxLeverage}x）`
          : "";

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

  // ── [POST-CALC] Evaluate Valuation Guard ──
  if (engineState.valuationGuardResult) {
    const vgEval = evaluateValuationGuard(
      ctx,
      strategy,
      engineState.valuationGuardResult,
    );
    if (vgEval) return vgEval;
  }

  // ─────────────────────────────────────────────────────────────
  // ★ Pre-Entry Gate
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
  // ★ 核心計分矩陣 (Scoring Matrix)
  // ─────────────────────────────────────────────────────────────
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
    closeArr: ctx.closeArr || [], // 【P1】供 bullMomentum 計算近 20 日漲幅
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
  const { finalScore, signal, signalDirection, scalingRatio, categoryResults } =
    scoreResult;

  // --- 1.5.A) 預算管控 (Budget Control) ---
  const budgetCfg = strategy.trading?.budget;
  const historyLoan10d = ctx.historyLoan10d ?? 0;
  const currentLoan = ctx.portfolio?.totalLoan || 0;
  const effectiveNetAsset = netAsset || ctx.netAsset || 1;

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

  // --- 1.5.B) 動態移動停利 (Trailing Stop) 監控 ---
  const { trailingActive, dynamicAnchor } = computeTrailingStop(
    ctx,
    strategy,
    ctx.highsSince ?? [],
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
  if (vgCfg?.enabled && pbValue != null && pbValue >= 2.2) {
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

    const suggestedValue = dailyCap * scalingRatio;
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
    const sellRatio = strategy.sell?.sellRatioLimit ?? 1.0;
    const isPartial = sellRatio < 1.0;
    const partialText = isPartial
      ? `依生命週期投資法實行減碼，建議賣出 00675L 當前持股之 ${(sellRatio * 100).toFixed(0)}%`
      : "建議賣出 00675L 全數部位（100%）";

    return {
      regimeState: engineState.regimeResult?.state ?? null,
      regimeResult: engineState.regimeResult,
      marketStatus: "🛡️【主動防禦】",
      target: "🔻 降槓桿",
      targetSuggestionShort: `${reason}（${(sellRatio * 100).toFixed(0)}% 減碼，分 ${finalScore.toFixed(1)}）`,
      targetSuggestion: `評分已跌破門檻，${partialText}還款`,
      suggestion: `• 決策總分：${finalScore.toFixed(1)} 分\n• 訊號原因：${reason}\n• 行動：${partialText}。藉此降低利息支出並提高維持率，同時保留剩餘部分的爆發性複利，維持車上基本曝險。`,
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

export function evaluateInvestmentSignal(data, arg2, arg3) {
  let ctxPayload;
  let strategy;

  if (arg3 !== undefined) {
    ctxPayload = arg2;
    strategy = arg3;
  } else {
    strategy = arg2;
    ctxPayload = {
      highsSince: data.highsSince ?? [],
      historyLoan10d: data.historyLoan10d ?? 0,
      cooldownStatus: data.cooldownStatus ?? {
        inCooldown: false,
        daysLeft: 0,
        lastBuyDate: data.portfolio?.lastBuyDate ?? null,
        message: "無歷史買入記錄",
      },
    };
  }

  const highsSince = ctxPayload.highsSince ?? [];
  const historyLoan10d = ctxPayload.historyLoan10d ?? 0;
  const cooldownStatus = ctxPayload.cooldownStatus ?? {
    inCooldown: false,
    daysLeft: 0,
    lastBuyDate: data.portfolio?.lastBuyDate ?? null,
    message: "無歷史買入記錄",
  };

  // ── 2.0 標準化數據清洗 ────────────────────────────────────────
  const marketState = normalizeMarketData({
    ...data,
    rawValuation: data.rawValuation || {},
    rawUsMarket: { vix: data.VIX, ...data.rawUsMarket },
    rawCnn: data.rawCnn || { score: data.cnnScore },
    rawMargin: data.rawMargin || { maintenanceRatio: data.maintenanceRatio },
    rawFx: data.rawFx || { currentRate: data.currentRate },
  });

  const currentPrice = parseNumber(data.currentPrice);
  const basePrice = parseNumber(data.basePrice);
  const priceChangePercent = ((currentPrice - basePrice) / basePrice) * 100;
  const priceUpPercent = Math.max(0, priceChangePercent);
  const priceDropPercent = Math.max(0, -priceChangePercent);

  const current0050Value = data.portfolio.qty0050 * data.price0050;
  const currentZ2Value = data.portfolio.qtyZ2 * currentPrice;

  // ── 使用 marginPolicy 計算維持率與壓力測試 ───────
  const marginAnalysis = analyzeMarginRisk(
    data.portfolio,
    data.price0050,
    strategy,
  );
  const maintenanceMargin = marginAnalysis.currentMargin;

  // ── 資金解耦分析 ──────────────────────────────────────────────
  const decouplingAnalysis = analyzeCapitalDecoupling(data.portfolio, {
    price0050: data.price0050,
    priceZ2: data.currentPrice,
  });

  const netAsset =
    current0050Value +
    currentZ2Value +
    data.portfolio.cash -
    data.portfolio.totalLoan;
  const z2Ratio = netAsset > 0 ? (currentZ2Value / netAsset) * 100 : 0;

  const ma240 =
    Number.isFinite(data.ma240) && data.ma240 > 0 ? data.ma240 : null;
  const bias240 = ma240 ? ((data.currentPrice - ma240) / ma240) * 100 : null;

  const grossAsset = current0050Value + currentZ2Value + data.portfolio.cash;
  const actualLeverage = netAsset > 0 ? grossAsset / netAsset : 0;
  const baseCooldownDays = strategy.trading.cooldownDays || 20;
  const cfg = strategy?.macroSentiment;

  // ─── VIX 情緒短路 ───
  const vixArr =
    Array.isArray(data.vixArr) && data.vixArr.length > 0
      ? data.vixArr
      : Number.isFinite(data.VIX)
        ? [data.VIX]
        : [];
  const vixOverride = resolveVixOverride(data.VIX, vixArr, strategy);

  const macroSentiment = resolveMacroSentiment(
    data.macroMarketDirection ?? null,
    strategy,
    vixOverride,
  );

  const isBearish = cfg?.enabled && data.macroMarketDirection === "BEAR";

  // cooldownStatus already computed and passed in ctxPayload.

  // ── 衍生值計算 ────────────────────────────────────────────
  const entry = computeEntryScore(
    data,
    priceDropPercent,
    strategy,
    macroSentiment,
  );
  const overheat = computeOverheatState(data, bias240, strategy);
  const reversal = computeReversalTriggers(data, strategy);
  const sellSignals = computeSellSignals(data, strategy);
  const survivalAnalysis = analyzeSurvival(
    data.portfolio,
    data.price0050,
    strategy,
  );

  // ── 組裝 ctx ──────────────────────────────────────────────
  const ctx = buildEngineContext(data, {
    priceChangePercent,
    priceUpPercent,
    priceDropPercent,
    maintenanceMargin,
    z2Ratio,
    netAsset,
    currentZ2Value,
    vixArr,
    cooldownStatus,
    macroSentiment,
    marginAnalysis,
    decouplingAnalysis,
    survivalAnalysis,
    entry,
    overheat,
    reversal,
    sellSignals,
    highsSince,
    historyLoan10d,
  });

  // ── Gross Leverage 計算 ──────────────────────────────────
  const etf0050Value = data.portfolio.qty0050 * data.price0050;
  const etf675LValue = data.portfolio.qtyZ2 * data.currentPrice;
  const glConfig = strategy.grossLeverage;
  const grossLeverageResult = glConfig
    ? computeGrossLeverage(
        { etf0050Value, etf675LValue, netAssetValue: netAsset },
        glConfig,
      )
    : null;

  const ma60Slope =
    Array.isArray(data.ma60SlopeArr) && data.ma60SlopeArr.length > 0
      ? data.ma60SlopeArr[data.ma60SlopeArr.length - 1]
      : null;

  const decision = buildDecision(ctx, strategy, grossLeverageResult, ma60Slope);

  const ohCfg = strategy?.overrideHierarchy;
  const isPanicBypass =
    (ohCfg?.panicBypassEnabled ?? false) &&
    ctx.priceDropPercent >
      (ohCfg?.panicBypassDropPct ?? PANIC_BYPASS_DROP_PCT) &&
    ctx.vix > (ohCfg?.panicVixThreshold ?? PANIC_BYPASS_VIX_THRESHOLD);

  decision.panicBypassActive = isPanicBypass;

  // 預算協同分析 (DCA 攔截)
  const budgetSynergy = resolveBudgetSynergy(
    ctx,
    strategy,
    decision.weightScore || 0,
  );
  const finalDecision = applyBudgetSynergy(decision, budgetSynergy);

  const macdSignal = getMACDSignal(data.macdArr);

  const signals = formatSignalOutput(ctx, finalDecision, {
    priceChangePercent,
    bias240,
    actualLeverage,
    maintenanceMargin,
    z2Ratio,
    grossLeverageResult,
    marginAnalysis,
    decouplingAnalysis,
    macdSignal,
  });

  return {
    id: data.date || new Date().toISOString().split("T")[0],
    date: data.date || new Date().toISOString(),
    marketState,
    strategySnapshot: strategy,
    signals,
  };
}

export async function getInvestmentSignalAsync(data) {
  const strategy = await fetchStrategyConfig();
  validateStrategyConfig(strategy);

  // 1. Fetch highsSince for Trailing Stop
  let highsSince = [];
  const buyDate = data.portfolio?.lastBuyDate ?? null;
  const tsEnabled = strategy.sell?.trailingStop?.enabled;
  if (tsEnabled && buyDate) {
    highsSince = await archiveManager.getHighsSince(buyDate);
  }

  // 2. Fetch historyLoan10d for Budget Control
  const budgetCfg = strategy.trading?.budget;
  const rollingLoanDays = budgetCfg?.rollingDays || BUDGET_ROLLING_DAYS;
  const historyLoan10d =
    await archiveManager.getHistoricalLoan(rollingLoanDays);

  // 3. Fetch cooldownStatus
  const baseCooldownDays = strategy.trading.cooldownDays || 20;
  const cfg = strategy?.macroSentiment;

  const isBearish = cfg?.enabled && data.macroMarketDirection === "BEAR";

  const vixArr =
    Array.isArray(data.vixArr) && data.vixArr.length > 0
      ? data.vixArr
      : Number.isFinite(data.VIX)
        ? [data.VIX]
        : [];
  const vixOverride = resolveVixOverride(data.VIX, vixArr, strategy);

  const effectiveCooldownDays =
    isBearish &&
    !vixOverride.overrideActive &&
    Number.isFinite(cfg.bearishCooldownMultiplier)
      ? Math.round(baseCooldownDays * cfg.bearishCooldownMultiplier)
      : baseCooldownDays;

  const lastBuyDate = data.portfolio?.lastBuyDate ?? null;
  const cooldownStatus = await checkCooldown(
    lastBuyDate,
    effectiveCooldownDays,
  );

  if (effectiveCooldownDays !== baseCooldownDays) {
    cooldownStatus.message += ` (⚠️ 空頭情緒延長冷卻至 ${effectiveCooldownDays} 交易日)`;
  }

  // 4. Assemble the ctxPayload
  const ctxPayload = {
    highsSince,
    historyLoan10d,
    cooldownStatus,
  };

  return evaluateInvestmentSignal(data, ctxPayload, strategy);
}

/**
 * 將預算協同分析結果合併進 decision（不可變，回傳新物件）
 */
function applyBudgetSynergy(decision, synergy) {
  if (!synergy) return decision;

  const base = { ...decision, budgetSynergy: synergy };

  if (decision.target !== "觀望" && decision.target !== "Neutral") {
    return base;
  }

  return {
    ...base,
    target: synergy.label,
    targetSuggestionShort: synergy.suggestedAmount
      ? `提前動用 $${synergy.suggestedAmount.toLocaleString()} 攔截`
      : "提前撥款攔截",
    suggestion: (decision.suggestion || "") + "\n\n" + synergy.suggestion,
  };
}

/**
 * 組裝決策引擎所需的 ctx 輸入物件（純組裝，不含計算邏輯）
 */
function buildEngineContext(data, derived) {
  const {
    priceChangePercent,
    priceUpPercent,
    priceDropPercent,
    maintenanceMargin,
    z2Ratio,
    netAsset,
    currentZ2Value,
    vixArr,
    cooldownStatus,
    macroSentiment,
    marginAnalysis,
    decouplingAnalysis,
    highsSince,
    historyLoan10d,
  } = derived;

  return {
    priceChangePercent,
    priceUpPercent,
    priceDropPercent,
    currentPrice: data.currentPrice,
    basePrice: data.basePrice,
    maintenanceMargin,
    z2Ratio,
    netAsset,
    currentZ2Value,
    vix: data.VIX,
    rsi: data.RSI,
    vixArr,
    portfolio: data.portfolio,
    reserveCash: data.portfolio?.cash || 0,
    indicators0050: data.indicators0050 || {},
    cooldownStatus,
    macroSentiment,
    entry: derived.entry,
    overheat: derived.overheat,
    reversal: derived.reversal,
    sellSignals: derived.sellSignals,
    valuation: data.rawValuation || null,
    pbRecords: data.pbRecords ?? [],
    pbRecordsObjects: data.pbRecordsObjects ?? [],
    valuationGuardState: data.valuationGuardState ?? null,
    closeArr: data.closeArr ?? [],
    ma20Arr: data.ma20Arr ?? [],
    atrArr: data.atrArr ?? [],
    macdArr: data.macdArr ?? [],
    ma60SlopeHistory: data.ma60SlopeArr || [],
    institutionalNet: data.institutionalNet || 0,
    institutionalHistory: data.institutionalHistory || [],
    marginAnalysis,
    decouplingAnalysis,
    survivalAnalysis: derived.survivalAnalysis,
    indicators: {
      rsiArr: data.rsiArr || [],
      kdArr: data.kdArr || [],
      macdArr: data.macdArr || [],
    },
    highsSince: highsSince ?? [],
    historyLoan10d: historyLoan10d ?? 0,
  };
}

/**
 * 將內部決策結果格式化為對外輸出的 signals 結構
 */
function formatSignalOutput(ctx, finalDecision, derived) {
  const {
    priceChangePercent,
    bias240,
    actualLeverage,
    maintenanceMargin,
    z2Ratio,
    grossLeverageResult,
    marginAnalysis,
    decouplingAnalysis,
    macdSignal,
  } = derived;

  return {
    RSI: parseNumber(ctx.rsi),
    KD_K: parseNumber(
      Array.isArray(ctx.indicators?.kdArr) && ctx.indicators.kdArr.length
        ? ctx.indicators.kdArr.at(-1)?.k
        : null,
    ),
    KD_D: parseNumber(
      Array.isArray(ctx.indicators?.kdArr) && ctx.indicators.kdArr.length
        ? ctx.indicators.kdArr.at(-1)?.d
        : null,
    ),
    bias240: parseNumber(bias240),
    reversal: ctx.reversal ?? null,
    sellSignals: ctx.sellSignals ?? null,
    priceChangePercentText: Number.isFinite(priceChangePercent)
      ? Math.abs(priceChangePercent).toFixed(2)
      : "0.00",
    status: finalDecision.marketStatus || "🌱",
    target: finalDecision.target || "🔹 0050 DCA",
    suggestion: finalDecision.targetSuggestion || "維持觀望",
    signalDirection: finalDecision.signalDirection ?? "hold",
    score: parseNumber(ctx.entry.weightScore),
    weightDetails: ctx.entry.weightDetails,
    finalScore: finalDecision.finalScore ?? null,
    categoryResults: finalDecision.categoryResults ?? null,
    scalingRatio: finalDecision.scalingRatio ?? null,
    priceChangePercent: parseNumber(priceChangePercent),
    actualLeverage: parseNumber(actualLeverage),
    maintenanceMargin: parseNumber(maintenanceMargin),
    z2Ratio: parseNumber(z2Ratio),
    grossLeverage: parseNumber(grossLeverageResult?.grossLeverage),
    grossLeverageStatus: grossLeverageResult?.status || "normal",
    maintenanceRisk: marginAnalysis?.riskLevel
      ? { level: marginAnalysis.riskLevel }
      : { level: "Normal" },
    marginAnalysis,
    decouplingAnalysis,
    valuationGuardResult: finalDecision.valuationGuardResult ?? null,
    valuationMomentumResult:
      ctx.valuationMomentumResult ??
      finalDecision.valuationMomentumResult ??
      null,
    panicBypassActive: finalDecision.panicBypassActive ?? false,
    regimeState: finalDecision.regimeState ?? null,
    regimeResult: finalDecision.regimeResult ?? null,
    entryGateLevel: finalDecision.entryGateLevel ?? null,
    cooldownStatus: ctx.cooldownStatus,
    budgetInfo: finalDecision.budgetInfo ?? null,
    trailingActive: finalDecision.trailingActive ?? false,
    dynamicAnchor: finalDecision.dynamicAnchor ?? null,
    macdSignal,
  };
}
