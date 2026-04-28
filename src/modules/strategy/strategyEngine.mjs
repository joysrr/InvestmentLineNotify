import {
  getTargetLeverageByScore,
  getReserveStatus,
  getExtremeDropThreshold,
  getPostSellAllocation,
} from "./riskManagement.mjs";
import {
  validateStrategyConfig,
  fetchStrategyConfig,
  computeEntryScore,
  computeReversalTriggers,
  computeOverheatState,
  computeSellSignals,
} from "./signalRules.mjs";
import {
  calculateIndicators,
  last2,
  crossUpLevel,
  crossDownLevel,
  roseAboveAfterBelow,
  fellBelowAfterAbove,
  wasAboveLevel,
  wasBelowLevel,
  macdCrossUp,
  macdCrossDown,
  kdCrossDown,
  kdCrossUp,
  lastKD,
  kdSeries,
  getMACDSignal,
} from "./indicators.mjs";
import { loadHolidaySet } from "../providers/twseProvider.mjs";
import { computeGrossLeverage } from "./leverageMonitor.mjs";
import {
  analyzeMarginRisk,
  analyzeCapitalDecoupling,
} from "./marginManager.mjs";
import { generateScoringMatrix } from "./signalGenerator.mjs";
import { archiveManager } from "../data/archiveManager.mjs";

import {
  getMarginLayer,
  evaluateMarginLayer,
  evaluateGrossLeverage,
  resolveValuationGuard,
  resolveTrendConfirmation,
  resolveValuationMomentum,
  evaluateValuationGuard,
  checkCooldown,
} from "./core/index.mjs";

import {
  resolveEntryGate,
  resolveVixOverride,
  buildMacroSentiment,
  buildSellBackToAllocation,
  analyzeSurvival,
  resolveBudgetSynergy,
} from "./policies/index.mjs";

import { parseNumber } from "../../utils/coreUtils.mjs";
import { normalizeMarketData } from "../../utils/normalizer.mjs";

/**
 * 決策大腦：綜合估值、維持率、槓桿、斜率與評分矩陣產出最終建議
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

  const reserveStatus = getReserveStatus(ctx, strategy);
  const marginLayer = getMarginLayer(maintenanceMargin, maint, th);

  // ─────────────────────────────────────────────────────────────
  // 維持率 4 層狀態機（越危險越優先，最先被檢出）
  // ─────────────────────────────────────────────────────────────

  const safeCtx = Object.freeze({ ...ctx });
  const marginLayerObj = evaluateMarginLayer(
    marginLayer,
    safeCtx,
    strategy,
    reserveStatus,
  );
  if (marginLayerObj) return marginLayerObj;

  // 🟢 Layer 3：常態運行 >= protectTrigger(160)
  // 以下為原有策略邏輯完整執行

  // ── 預先計算 Priority 3 極端恐慌破冰 (Extremely Panic Bypass) ──
  // 供 Priority 2 (Gross Leverage) 與 Priority 7 使用
  const ohCfg = strategy?.overrideHierarchy;
  const panicBypassEnabled = ohCfg?.panicBypassEnabled ?? false;
  const panicBypassDropPct = ohCfg?.panicBypassDropPct ?? 0.2;
  const panicVixThreshold = ohCfg?.panicVixThreshold ?? 35;

  const isPanicBypass =
    panicBypassEnabled &&
    ctx.priceDropPercent > panicBypassDropPct &&
    ctx.vix > panicVixThreshold;

  // 將狀態存入 ctx 供後續模組讀取
  ctx.panicBypassActive = isPanicBypass;

  // ─────────────────────────────────────────────────────────────
  const leverageObj = evaluateGrossLeverage(
    grossLeverageResult,
    strategy,
    ctx.panicBypassActive,
  );
  if (leverageObj) return leverageObj;

  // 移除之前重複添加的 Priority 3 代碼（因為已經移到上面了）

  // ─────────────────────────────────────────────────────────────
  // Priority 3：極端恐慌破冰 (已移至 Priority 2 之前計算)
  // ─────────────────────────────────────────────────────────────

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
  if (vgCfg?.enabled && ctx.pbRecords != null && !ctx.panicBypassActive) {
    const currentPB = ctx.valuation?.pb ?? null;
    const pbRecords = ctx.pbRecords ?? [];
    const vgResult = resolveValuationGuard(currentPB, pbRecords, strategy);
    ctx.valuationGuardResult = vgResult; // ← 由 Engine 層統一持有，供後續節點讀取
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
      valuationGuardResult: ctx.valuationGuardResult ?? null,
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
  const scoringData = {
    institutionalNet: ctx.institutionalNet || 0,
    institutionalHistory: ctx.institutionalHistory || [],
    sentimentScore:
      ctx.macroSentiment?.direction === "BULLISH"
        ? ctx.macroSentiment.bonus || 0
        : ctx.macroSentiment?.direction === "BEARISH"
          ? -(ctx.macroSentiment.penalty || 0)
          : 0,
    ma60SlopeHistory: ctx.ma60SlopeHistory || [],
    hasTacticalPosition: ctx.z2Ratio > 15,
    currentPR: ctx.valuationGuardResult?.currentPR || 0,
  };

  const scoreResult = generateScoringMatrix(
    ctx.indicators,
    ctx.priceDropPercent,
    strategy,
    scoringData,
  );
  const { finalScore, signal, signalDirection, scalingRatio, categoryResults } =
    scoreResult;

  // --- 1.5.A) 預算管控 (Budget Control) ---
  const budgetCfg = strategy.trading?.budget;
  const rollingLoanDays = budgetCfg?.rollingDays || 10;
  const historyLoan10d =
    await archiveManager.getHistoricalLoan(rollingLoanDays);
  const currentLoan = ctx.portfolio?.totalLoan || 0;
  const effectiveNetAsset = netAsset || ctx.netAsset || 1;

  const rollingNetIncrease = Math.max(0, currentLoan - historyLoan10d);
  const dailyCap =
    effectiveNetAsset * (budgetCfg?.maxDailyLoanIncreasePct || 0.05);
  const rollingCap =
    effectiveNetAsset * (budgetCfg?.maxRollingLoanIncreasePct || 0.15);

  const availableDaily = dailyCap; // 簡化：當日通常只執行一筆
  const availableRolling = Math.max(0, rollingCap - rollingNetIncrease);
  const finalAvailableBudget = Math.min(availableDaily, availableRolling);

  // --- 1.5.B) 動態移動停利 (Trailing Stop) 監控 ---
  const tsCfg = strategy.sell?.trailingStop;
  let trailingActive = false;
  let dynamicAnchor = null;

  if (tsCfg?.enabled && ctx.z2Ratio > 0 && ctx.portfolio?.lastBuyDate) {
    const buyDate = ctx.portfolio.lastBuyDate;
    const highsSince = await archiveManager.getHighsSince(buyDate);
    const currentPrice = ctx.currentPrice;

    // 啟動條件 1：獲利 > 10% (基於收盤價簡單推算，完美應記錄買入均價)
    const profitOk =
      currentPrice >
      (ctx.portfolio.avgCostZ2 || ctx.basePrice || 9999) *
        (1 + tsCfg.activationProfitPct);

    // 啟動條件 2：連續 2 日站穩 MA20
    const ma20Arr = ctx.indicators?.ma20Arr || [];
    const closeArr = ctx.indicators?.closes || [];
    let ma20Stable = false;
    if (closeArr.length >= 2 && ma20Arr.length >= 2) {
      const c1 = closeArr.at(-1),
        c2 = closeArr.at(-2);
      const m1 = ma20Arr.at(-1),
        m2 = ma20Arr.at(-2);
      if (c1 > m1 && c2 > m2) ma20Stable = true;
    }

    if (profitOk || ma20Stable) {
      trailingActive = true;
      if (tsCfg.anchorType === "ma20") {
        dynamicAnchor = ma20Arr.at(-1) * (1 - tsCfg.stopLossBuffer);
      } else if (tsCfg.anchorType === "atr") {
        const hhv = Math.max(...highsSince, currentPrice); // 含今日
        const atr = ctx.indicators?.atrArr?.at(-1) || 0;
        dynamicAnchor = hhv - atr * tsCfg.atrMultiplier;
      }
    }
  }

  // 1.5.C) 停損與絕對優先權 Override (Priority High)
  const stopLossTriggered =
    trendConfirmation.ma20BreakDays >= (strategy.sell?.ma20StopDays ?? 3);
  const trailingTriggered =
    trailingActive && dynamicAnchor && ctx.currentPrice < dynamicAnchor;

  if ((stopLossTriggered || trailingTriggered) && ctx.z2Ratio > 0) {
    const reason = trailingTriggered
      ? `動態停引 (錨點: ${dynamicAnchor.toFixed(1)})`
      : `MA20 跌破 ${trendConfirmation.ma20BreakDays} 日`;
    return {
      maintenanceLayer: "normal",
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
      valuationGuardResult: ctx.valuationGuardResult ?? null,
    };
  }

  // 1.6) 估值極度昂貴：防泡沫機制 (PB > 2.2)
  const pbValue = valuation?.pb;
  if (pbValue != null && pbValue >= 2.2) {
    return {
      marketStatus: "🫧【估值泡沫】",
      target: "🛑 鎖定風險",
      targetSuggestionShort: `大盤 PB 達 ${pbValue}，停止加碼 00675L 預防劇烈修正`,
      targetSuggestion: `大盤 PB 高達 ${pbValue} 進入泡沫警戒區，強制暫停撥款買入，建議視情況降槓桿`,
      suggestion:
        `• 大盤股價淨值比 (PB)：${pbValue} (極端門檻 2.2)\n` +
        `• 風控說明：歷史數據顯示大盤 PB 超過 2.2 常伴隨毀滅性回檔。即使技術面呈多頭，系統仍強制在此階段停止買進，保護資金安全。`,
      valuationGuardResult: ctx.valuationGuardResult ?? null,
    };
  }

  // 2) 再平衡：00675L 佔比過高
  if (z2Ratio > th.z2RatioHigh) {
    const targetZ2Value = netAsset * th.z2TargetRatio;
    const sellAmount = Math.max(0, currentZ2Value - targetZ2Value);

    if (sellAmount > th.minActionableAmount) {
      return {
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
      valuationGuardResult: ctx.valuationGuardResult ?? null,
      budgetInfo: { availableRolling, finalAvailableBudget, budgetCapped },
    };
  }

  // --- 戰術減倉路徑 ---
  if (signal === "sell_tactical" || signal === "exit_buffer") {
    const reason = signal === "exit_buffer" ? "遲滯緩衝退場" : "評分轉空減倉";
    return {
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
      valuationGuardResult: ctx.valuationGuardResult ?? null,
    };
  }

  // 4) 市場中性區 (Neutral Zone)：僅執行 0050 DCA
  return {
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
    valuationGuardResult: ctx.valuationGuardResult ?? null,
    valuationMomentumResult: ctx.valuationMomentumResult ?? null,
  };
}

export async function evaluateInvestmentSignal(data, strategy) {
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

  // ── 使用 marginManager 計算維持率與壓力測試 (排除 00675L) ───────
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

  let historicalLevel = "⚖️【中位階】";
  if (bias240 > 25) historicalLevel = "🔥【極高位階/過熱】";
  else if (bias240 > 15) historicalLevel = "🏜️【高位階/偏貴】";
  else if (bias240 < 0) historicalLevel = "🧊【低位階/便宜】";

  const baseCooldownDays = strategy.trading.cooldownDays || 20;
  const cfg = strategy?.macroSentiment;

  // ─── VIX 情緒短路：先解析短路狀態，再傳入 buildMacroSentiment ───
  // resolveVixOverride 使用 data.vixArr（歷史序列）判斷趨勢；
  // 若 data.vixArr 不存在，fallback 為 [data.VIX]，趨勢判斷降為 'flat'
  const vixArr =
    Array.isArray(data.vixArr) && data.vixArr.length > 0
      ? data.vixArr
      : Number.isFinite(data.VIX)
        ? [data.VIX]
        : [];
  const vixOverride = resolveVixOverride(data.VIX, vixArr, strategy);

  // macroSentiment：傳入 vixOverride，由 buildMacroSentiment 決定是否屏蔽 bearishPenalty
  const macroSentiment = buildMacroSentiment(
    data.macroMarketDirection ?? null,
    strategy,
    vixOverride,
  );

  // effectiveCooldownDays：短路啟動時跳過 bearishCooldownMultiplier 延長
  const isBearish = cfg?.enabled && data.macroMarketDirection === "BEARISH";
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

  const ctx = {
    priceChangePercent,
    priceUpPercent,
    priceDropPercent,

    maintenanceMargin,
    z2Ratio,
    netAsset,
    currentZ2Value,
    vix: data.VIX,
    rsi: data.RSI,
    indicators0050: data.indicators0050 || {}, // [NEW] 注入 0050 參考指標

    reserveCash: data.portfolio?.cash || 0,

    cooldownStatus,
    macroSentiment,

    entry: computeEntryScore(data, priceDropPercent, strategy, macroSentiment),
    overheat: computeOverheatState(data, bias240, strategy),
    reversal: computeReversalTriggers(data, strategy),
    sellSignals: computeSellSignals(data, strategy),
    valuation: data.rawValuation || null,
    // ── valuationGuard 所需欄位 ──────────────────────────────
    pbRecords: data.pbRecords ?? [],
    pbRecordsObjects: data.pbRecordsObjects ?? [],
    valuationGuardState: data.valuationGuardState ?? null,
    closeArr: data.closeArr ?? [],
    ma20Arr: data.ma20Arr ?? [],
    atrArr: data.atrArr ?? [],
    macdArr: data.macdArr ?? [],
    // ── valuationMomentum 所需欄位 ───────────────────────────
    vixArr: vixArr,
    ma60SlopeHistory: data.ma60SlopeArr || [],
    institutionalNet: data.institutionalNet || 0,
    institutionalHistory: data.institutionalHistory || [],
    // ── 壓力測試與解耦數據 ──────────────────────────────────
    marginAnalysis,
    survivalAnalysis: analyzeSurvival(data.portfolio, data.price0050, strategy), // [NEW]
    decouplingAnalysis,
    // ── 指標序列供計分矩陣使用 ───────────────────────────────
    indicators: {
      rsiArr: data.rsiArr || [],
      kdArr: data.kdArr || [],
      macdArr: data.macdArr || [],
    },
  };

  // ── Gross Leverage 計算 ──────────────────────────────────────
  const etf0050Value = data.portfolio.qty0050 * data.price0050;
  const etf675LValue = data.portfolio.qtyZ2 * data.currentPrice;
  const glConfig = strategy.grossLeverage;
  const grossLeverageResult = glConfig
    ? computeGrossLeverage(
        { etf0050Value, etf675LValue, netAssetValue: netAsset },
        glConfig,
      )
    : null;
  // ─────────────────────────────────────────────────────────────
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

  // [NEW] 預算協同分析 (DCA 攔截)
  const budgetSynergy = resolveBudgetSynergy(
    ctx,
    strategy,
    decision.weightScore || 0,
  );
  if (budgetSynergy) {
    decision.budgetSynergy = budgetSynergy;
    // 如果觸發預算攔截，且當前是中性或觀望，提升其行動建議
    if (decision.target === "觀望" || decision.target === "Neutral") {
      decision.target = budgetSynergy.label;
      decision.targetSuggestionShort = budgetSynergy.suggestedAmount
        ? `提前動用 $${budgetSynergy.suggestedAmount.toLocaleString()} 攔截`
        : "提前撥款攔截";
      decision.suggestion =
        (decision.suggestion || "") + "\n\n" + budgetSynergy.suggestion;
    }
  }

  const macdSignal = getMACDSignal(data.macdArr);

  return {
    id: data.date || new Date().toISOString().split("T")[0],
    date: data.date || new Date().toISOString(),
    marketState, // 2.0 標準化分類數據
    strategySnapshot: strategy, // 完整拷貝策略，供未來回溯
    signals: {
      RSI: parseNumber(data.RSI), // 技術指標 RSI 數值
      // KD 最後值（從 kdArr 最後一筆拆出）
      KD_K: parseNumber(
        Array.isArray(data.kdArr) && data.kdArr.length
          ? data.kdArr[data.kdArr.length - 1]?.k
          : null,
      ),
      KD_D: parseNumber(
        Array.isArray(data.kdArr) && data.kdArr.length
          ? data.kdArr[data.kdArr.length - 1]?.d
          : null,
      ),
      bias240: parseNumber(bias240), // 乖離率 MA240
      reversal: ctx.reversal ?? null, // 轉弱訊號（reversalTriggers 結果）
      sellSignals: ctx.sellSignals ?? null, // 賣出訊號（sellSignals 結果）
      priceChangePercentText: Number.isFinite(priceChangePercent)
        ? Math.abs(priceChangePercent).toFixed(2)
        : "0.00", // 漲跌幅文字（前端用來顯示 badge）
      valuationGuardResult:
        decision.valuationGuardResult ?? ctx.valuationGuardResult ?? null, // 估值守衛結果（從 decision 轉接）
      valuationMomentumResult:
        decision.valuationMomentumResult ?? ctx.valuationMomentumResult ?? null, // 動量補正結果（從 decision 轉接）
      panicBypassActive: ctx.panicBypassActive ?? false, // 恐慌破冰狀態
      maintenanceRisk: marginAnalysis?.riskLevel
        ? { level: marginAnalysis.riskLevel }
        : { level: "Normal" }, // 維持率風險等級（包成前端期待的 { level } 結構）
      status: decision.marketStatus || "🌱",
      score: parseNumber(ctx.entry.weightScore),
      target: decision.target || "🔹 0050 DCA",
      signalDirection: decision.signalDirection ?? "hold",
      suggestion: decision.targetSuggestion || "維持觀望",
      weightDetails: ctx.entry.weightDetails,
      priceChangePercent: parseNumber(priceChangePercent),
      actualLeverage: parseNumber(actualLeverage),
      maintenanceMargin: parseNumber(maintenanceMargin),
      z2Ratio: parseNumber(z2Ratio),
      grossLeverage: parseNumber(grossLeverageResult?.grossLeverage),
      grossLeverageStatus: grossLeverageResult?.status || "normal",
      entryGateLevel: decision.entryGateLevel ?? null,
      cooldownStatus,
      marginAnalysis,
      decouplingAnalysis,
      macdSignal,
    },
  };
}

export async function getInvestmentSignalAsync(data) {
  const strategy = await fetchStrategyConfig();
  validateStrategyConfig(strategy);
  return await evaluateInvestmentSignal(data, strategy);
}
