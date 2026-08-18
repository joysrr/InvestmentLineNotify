import { getReserveStatus } from "./riskManagement.mjs";
import {
  validateStrategyConfig,
  fetchStrategyConfig,
  computeEntryScore,
  computeReversalTriggers,
  computeOverheatState,
  computeSellSignals,
} from "./signalRules.mjs";
import { getMACDSignal } from "./indicators.mjs";
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
import { computeLifecycleContext } from "./lifecycleEngine.mjs";

import { checkCooldown } from "./core/index.mjs";

import {
  resolveEntryGate,
  resolveVixOverride,
  resolveMacroSentiment,
  analyzeMarginRisk,
  analyzeCapitalDecoupling,
  analyzeSurvival,
  resolveBudgetSynergy,
  resolveConversionGuard,
  resolveBudgetLimit,
  applyRiskOverride,
  calculateRequestedLoanAmount,
  applyInterestCostFilter,
  applyInterestCostFilterToDecision,
  getMarginFinancingData,
} from "./policies/index.mjs";

import { parseNumber } from "../../utils/coreUtils.mjs";
import { normalizeMarketData } from "../../utils/normalizer.mjs";
import { buildReplaySignalData } from "../../domain/replaySnapshot.mjs";
import {
  runDecisionChain,
  createDefaultDecisionChain,
} from "./decision/chain.mjs";

/**
 * 決策鏈委派器 - 將決策邏輯委派給 Chain of Responsibility
 * 具體規則見 src/modules/strategy/decision/rules/
 */

export async function buildDecision(
  ctx,
  strategy,
  grossLeverageResult,
  ma60Slope = null,
) {
  const chain = await createDefaultDecisionChain();
  return await runDecisionChain(
    ctx,
    strategy,
    grossLeverageResult,
    ma60Slope,
    chain,
  );
}

export async function evaluateInvestmentSignal(data, arg2, arg3) {
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

  // Handle case where marginAnalysis returns null (e.g., invalid price)
  const maintenanceMargin =
    marginAnalysis?.currentMargin ??
    (data.portfolio?.totalLoan > 0 && data.price0050 > 0
      ? ((data.portfolio.qty0050 * data.price0050) / data.portfolio.totalLoan) *
        100
      : 999);

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
  const _baseCooldownDays = strategy.trading.cooldownDays || 20;
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

  const _isBearish = cfg?.enabled && data.macroMarketDirection === "BEAR";

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

  const decision = await buildDecision(
    ctx,
    strategy,
    grossLeverageResult,
    ma60Slope,
  );

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

  // Budget Priority: 計算請求借款金額並套用額度限制
  const requestedAmount = calculateRequestedLoanAmount(ctx, finalDecision);
  let budgetResult = resolveBudgetLimit(
    ctx,
    strategy,
    finalDecision.signals?.signalType ?? "baseline",
    requestedAmount,
  );
  budgetResult = applyRiskOverride(budgetResult, ctx, strategy);

  // 將 Budget 結果合併到 finalDecision
  finalDecision.budgetInfo = budgetResult.budgetInfo;
  finalDecision.budgetAllowedAmount = budgetResult.allowedAmount;
  finalDecision.budgetIsLimited = budgetResult.isLimited;
  finalDecision.budgetLimitedReason = budgetResult.limitedReason;

  // 如果 Budget 限制導致允許金額為 0，覆寫決策
  if (
    budgetResult.allowedAmount === 0 &&
    budgetResult.signalType !== "baseline"
  ) {
    finalDecision.signalDirection = "hold";
    finalDecision.target = "🛑 預度不足";
    finalDecision.targetSuggestionShort =
      budgetResult.limitedReason ?? "Budget exhausted";
    finalDecision.targetSuggestion =
      budgetResult.limitedReason ?? "Budget exhausted";
    finalDecision.scalingRatio = 0;
  } else if (budgetResult.allowedAmount < requestedAmount) {
    // 部分限制：調整 scalingRatio
    const ratio = budgetResult.allowedAmount / requestedAmount;
    finalDecision.scalingRatio = (finalDecision.scalingRatio ?? 1.0) * ratio;
  }

  const macdSignal = getMACDSignal(data.macdArr);

  const signals1 = formatSignalOutput(ctx, finalDecision, {
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

  // 新增 signalCategory / signalType (供回測與資金管控)
  const signalCategory = determineSignalCategory(ctx, finalDecision);
  const _signalType = determineSignalType(signalCategory);

  // 利息成本濾網 (Task #9)
  const interestCostFilterResult = applyInterestCostFilter(
    ctx,
    strategy,
    finalDecision,
  );
  const finalDecisionWithInterest = applyInterestCostFilterToDecision(
    { ...finalDecision, signals: signals1 },
    interestCostFilterResult,
  );

  const signals2 = formatSignalOutput(ctx, finalDecisionWithInterest, {
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

  // 新增 signalCategory / signalType (供回測與資金管控)
  const signalCategoryNew = determineSignalCategory(
    ctx,
    finalDecisionWithInterest,
  );
  const signalTypeNew = determineSignalType(signalCategoryNew);

  return {
    id: data.date || new Date().toISOString().split("T")[0],
    date: data.date || new Date().toISOString(),
    marketState,
    strategySnapshot: strategy,
    signals: {
      ...signals2,
      signalCategory: signalCategoryNew,
      signalType: signalTypeNew,
      // Budget 資訊
      budgetInfo: finalDecisionWithInterest.budgetInfo,
      budgetAllowedAmount: finalDecisionWithInterest.budgetAllowedAmount,
      budgetIsLimited: finalDecisionWithInterest.budgetIsLimited,
      budgetLimitedReason: finalDecisionWithInterest.budgetLimitedReason,
      // 利息成本資訊
      interestCostInfo: finalDecisionWithInterest.interestCostInfo,
    },
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
    basePrice: data.basePrice ?? data.price0050, // fallback to price0050 for backward compat
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
    institutionalNet:
      data.institutionalNet ??
      (Number.isFinite(data.rawInstitutional?.totalNetBuy)
        ? data.rawInstitutional.totalNetBuy / 1_000_000
        : 0),
    institutionalHistory: data.institutionalHistory || [],
    replaySignalData: buildReplaySignalData({
      currentPR: data.rawValuation?.currentPR,
      priceDropPercent,
      sentiment: macroSentiment,
      institutionalNet: data.institutionalNet,
      institutionalHistory: data.institutionalHistory || [],
      historyMetadata: data.historyMetadata,
    }),
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
 * 判斷 signalCategory (供回測 Phase 2 統計使用)
 * baseline | deep_drop | panic | take_profit | rebalance
 */
function determineSignalCategory(ctx, finalDecision) {
  // Panic bypass 有最高優先級
  if (finalDecision.panicBypassActive) return "panic";

  // Trailing stop 觸發
  if (finalDecision.trailingActive) return "take_profit";

  // Rebalance 觸發
  if (
    finalDecision.target?.includes?.("再平衡") ||
    finalDecision.target?.includes?.("Rebalance")
  )
    return "rebalance";

  // 依跌幅與目標判斷
  const drop = ctx.priceDropPercent ?? 0;
  const target = finalDecision.target ?? "";

  if (drop >= 30) return "panic";
  if (drop >= 15 && target !== "🔹 0050 DCA" && target !== "觀望")
    return "deep_drop";

  // 預設 baseline (DCA 或觀望)
  return "baseline";
}

/**
 * 判斷 signalType (供資金管控 Budget Priority 使用)
 * baseline | tactical_drop | tactical_panic
 */
function determineSignalType(category) {
  switch (category) {
    case "panic":
      return "tactical_panic";
    case "deep_drop":
      return "tactical_drop";
    default:
      return "baseline";
  }
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
    scoringMatrixExecuted: finalDecision.finalScore != null,
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
    // 新格式：portfolio.assets 包含完整資產資訊（向後相容同時保留舊欄位）
    portfolio: ctx.portfolio,
  };
}
export {
  buildEngineContext,
  formatSignalOutput,
  determineSignalCategory,
  determineSignalType,
  applyBudgetSynergy,
};
