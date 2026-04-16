import {
  getTargetLeverageByScore,
  getReserveStatus,
  getExtremeDropThreshold,
  getPostSellAllocation,
} from "./riskManagement.mjs";
import {
  validateStrategyConfig,
  computeEntryScore,
  computeReversalTriggers,
  computeOverheatState,
  computeSellSignals,
} from "./signalRules.mjs";
import { fetchStrategyConfig } from "./signalRules.mjs";
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

/**
 * 維持率 4 層狀態機判斷
 * @param {number} mm - 當前維持率(%)
 * @param {Object} maint - strategy.maintenance
 * @param {Object} th - strategy.threshold
 * @returns {'critical'|'frozen'|'protect'|'normal'}
 */
function getMarginLayer(mm, maint, th) {
  const marginCallThreshold = maint.marginCallThreshold ?? 135;
  const frozenZone = maint.frozenZone ?? 145;
  const protectTrigger = maint.protectTrigger ?? 160;

  if (mm < marginCallThreshold) return 'critical';   // 🔴 斷頭危機
  if (mm < frozenZone)         return 'frozen';     // 🟠 高危凍結
  if (mm < protectTrigger)     return 'protect';    // 🟡 預備金防禦
  return 'normal';                                   // 🟢 常態運行
}

/**
 * Pre-Entry Gate：解析當前跌幅/RSI 所在的 entryGate 層級
 * @param {number} dropPercent - 當前跌幅(%)
 * @param {number} rsi - 當前 RSI
 * @param {Object} entryGateCfg - strategy.buy.entryGate
 * @returns {{ tierIndex: number, tier: Object|null, blocked: boolean, blockReason: string|null }}
 */
function resolveEntryGate(dropPercent, rsi, entryGateCfg) {
  if (!entryGateCfg?.enabled || !Array.isArray(entryGateCfg.tiers)) {
    return { tierIndex: -1, tier: null, blocked: false, blockReason: null };
  }

  const tiers = entryGateCfg.tiers;

  // 從高跌幅往低找，取第一個 minDrop <= dropPercent 的 tier
  let matchedIndex = 0;
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (dropPercent >= tiers[i].minDrop) {
      matchedIndex = i;
      break;
    }
  }

  const tier = tiers[matchedIndex];

  // allowLeverage: false → 直接封鎖加碼
  if (!tier.allowLeverage) {
    return {
      tierIndex: matchedIndex,
      tier,
      blocked: true,
      blockReason: `entryGate Tier ${matchedIndex}：${tier.note}`,
    };
  }

  // allowLeverage: true → 需確認 RSI 是否達標（低於門檻才可進場）
  if (tier.rsiThreshold != null && rsi >= tier.rsiThreshold) {
    return {
      tierIndex: matchedIndex,
      tier,
      blocked: true,
      blockReason: `entryGate Tier ${matchedIndex}：跌幅達標，但 RSI ${rsi.toFixed(0)} ≥ 門檻 ${tier.rsiThreshold}，尚未超賣`,
    };
  }

  return { tierIndex: matchedIndex, tier, blocked: false, blockReason: null };
}

/**
 * VIX 情緒短路機制：判斷是否應覆蓋 AI BEARISH 的懲罰效果
 *
 * 短路條件（二選一，滿足其一即觸發）：
 *   1. 絕對短路：vixValue >= vixAbsoluteOverride（預設 35）— 無論趨勢強制觸發
 *   2. 趨勢短路：vixValue >= vixOverrideTrigger（預設 28）且 vixTrend === 'falling'
 *
 * vixTrend 由 vixArr 末兩筆自動推算：
 *   - vixArr 最後一筆 < 倒數第二筆 → 'falling'
 *   - vixArr 最後一筆 > 倒數第二筆 → 'rising'
 *   - 相等或資料不足 → 'flat'
 *
 * 若 config 欄位 vixOverrideTrigger / vixAbsoluteOverride 不存在，
 * 視為功能停用，直接回傳 overrideActive: false。
 *
 * @param {number} vixValue - 當前 VIX 數值
 * @param {number[]} vixArr - VIX 歷史序列（至少需 2 筆才能判斷趨勢）
 * @param {Object} config - 完整 strategy config
 * @returns {{ overrideActive: boolean, overrideReason: string, vixTrend: string }}
 */
function resolveVixOverride(vixValue, vixArr, config) {
  const cfg = config?.macroSentiment;

  // 功能未設定 → 停用
  if (
    cfg?.vixOverrideTrigger == null &&
    cfg?.vixAbsoluteOverride == null
  ) {
    return { overrideActive: false, overrideReason: '', vixTrend: 'unknown' };
  }

  const absoluteThreshold = cfg.vixAbsoluteOverride ?? 35;
  const trendThreshold    = cfg.vixOverrideTrigger  ?? 28;

  // 推算 vixTrend 從歷史序列末兩筆
  let vixTrend = 'flat';
  if (Array.isArray(vixArr) && vixArr.length >= 2) {
    const prev = vixArr[vixArr.length - 2];
    const curr = vixArr[vixArr.length - 1];
    if (Number.isFinite(prev) && Number.isFinite(curr)) {
      if (curr < prev) vixTrend = 'falling';
      else if (curr > prev) vixTrend = 'rising';
    }
  }

  // 絕對短路（無論趨勢）
  if (Number.isFinite(vixValue) && vixValue >= absoluteThreshold) {
    return {
      overrideActive: true,
      overrideReason: `VIX ${vixValue.toFixed(1)} ≥ 絕對門檻 ${absoluteThreshold}（強制短路）`,
      vixTrend,
    };
  }

  // 趨勢短路（需 falling）
  if (
    Number.isFinite(vixValue) &&
    vixValue >= trendThreshold &&
    vixTrend === 'falling'
  ) {
    return {
      overrideActive: true,
      overrideReason: `VIX ${vixValue.toFixed(1)} ≥ 趨勢門檻 ${trendThreshold} 且趨勢下行（趨勢短路）`,
      vixTrend,
    };
  }

  // 未觸發
  return { overrideActive: false, overrideReason: '', vixTrend };
}

function buildDecision(ctx, strategy) {
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

  // 🔴 Layer 0：斷頭危機 < marginCallThreshold(135)
  // 強制市價降槓桿警示，一票否決所有加碼，優先指示補足保證金
  if (marginLayer === 'critical') {
    const marginCallThreshold = maint.marginCallThreshold ?? 135;
    return {
      maintenanceLayer: 'critical',
      marketStatus: "🔴【斷頭危機】",
      target: "🛑 強制降槓桿",
      targetSuggestionShort: "立即補保證金或市價降槓桿，禁止一切加碼",
      targetSuggestion: "維持率已低於斷頭警戒線，必須立即行動：補充保證金或市價賣出 00675L 降槓桿",
      suggestion:
        `• 當前維持率：${maintenanceMargin.toFixed(0)}% (斷頭門檻 ${marginCallThreshold}%)\n` +
        `• ⚠️ 警告：系統已進入強制降槓桿模式，所有加碼操作被一票否決\n` +
        `• 優先行動 1：立即補充保證金（現金或追加擔保品）\n` +
        `• 優先行動 2：若無現金，市價賣出部分 00675L 降低槓桿\n` +
        `• 目標：維持率回升至 ${maint.frozenZone ?? 145}% 以上後再評估後續操作`,
      maintenanceMargin,
      marginCallThreshold,
    };
  }

  // 🟠 Layer 1：高危凍結 135–145% (frozenZone)
  // 禁止所有新進場，強烈通知補足保證金
  if (marginLayer === 'frozen') {
    const frozenZone = maint.frozenZone ?? 145;
    const marginCallThreshold = maint.marginCallThreshold ?? 135;
    const totalLoan = ctx.totalLoan || 0;
    const currentCollateral = (maintenanceMargin / 100) * totalLoan;
    const targetCollateral = (frozenZone / 100) * totalLoan;
    const needAmount = Math.max(0, targetCollateral - currentCollateral);
    const reserveSufficient = reserveStatus.currentReserve >= needAmount;

    return {
      maintenanceLayer: 'frozen',
      marketStatus: "🟠【高危凍結】",
      target: "🚫 禁止進場",
      targetSuggestionShort: "禁止所有新進場；強烈建議立即補足保證金",
      targetSuggestion: `維持率 ${maintenanceMargin.toFixed(0)}% 進入高危走廊（${marginCallThreshold}–${frozenZone}%），禁止任何新開倉，請立即補足保證金`,
      suggestion:
        `• 當前維持率：${maintenanceMargin.toFixed(0)}% (高危區間 ${marginCallThreshold}–${frozenZone}%)\n` +
        `• 🚫 所有新進場操作已凍結（包含 0050 DCA 與 00675L 加碼）\n` +
        `• 資金缺口：約 ${needAmount.toLocaleString("zh-TW", { maximumFractionDigits: 0 })} 元（補至解凍線 ${frozenZone}%）\n` +
        `• 預備金狀態：${reserveSufficient ? "✅ 充足，可立即動用" : "⚠️ 不足，需補充額外現金"}\n\n` +
        `【執行步驟】\n` +
        `1. ${reserveSufficient ? "動用預備金補充保證金或買入 0050" : "優先補充現金至帳戶"}\n` +
        `2. 嚴禁在此區間追加 00675L 槓桿部位\n` +
        `3. 維持率回升至 ${frozenZone}% 以上後，自動解除凍結`,
      maintenanceMargin,
      frozenZone,
      needAmount,
      reserveSufficient,
    };
  }

  // 🟡 Layer 2：預備金防禦 145–160% (protectTrigger)
  // 暫停高槓桿加碼，優先充實擔保品，允許 baseline DCA
  if (marginLayer === 'protect') {
    const protectTarget = maint.protectTarget || 180;
    const totalLoan = ctx.totalLoan || 0;
    const currentCollateral = (maintenanceMargin / 100) * totalLoan;
    const targetCollateral = (protectTarget / 100) * totalLoan;
    const needAmount = Math.max(0, targetCollateral - currentCollateral);
    const reserveSufficient = reserveStatus.currentReserve >= needAmount;

    return {
      maintenanceLayer: 'protect',
      marketStatus: "🛡️【維持率低於安全線】",
      target: "🧯 預備金防禦",
      targetSuggestionShort: "動用預備金或補充抵押品；允許 0050 DCA",
      targetSuggestion: `維持率低於 ${maint.protectTrigger}%，建議動用預備金買入 0050 或補充現金，目標維持率 ${protectTarget}%`,
      suggestion:
        `• 當前維持率：${maintenanceMargin.toFixed(0)}% (低於安全線 ${maint.protectTrigger}%)\n` +
        `• 補足目標：${protectTarget}%\n` +
        `• 資金缺口：約 ${needAmount.toLocaleString("zh-TW", { maximumFractionDigits: 0 })} 元\n` +
        `• 當前預備金：${reserveStatus.currentReserve.toLocaleString("zh-TW", { maximumFractionDigits: 0 })} 元\n` +
        `• 預備金狀態：${reserveSufficient ? "✅ 充足，可立即動用" : "⚠️ 不足，需補充額外現金"}\n\n` +
        `【執行步驟】\n` +
        `1. ${reserveSufficient ? "動用預備金買入 0050 (提升抵押品價值)" : "優先補充現金還款"}\n` +
        `2. ${reserveSufficient ? "或補充現金還款 (降低借款)" : "或動用部分預備金買入 0050"}\n` +
        `3. 暫停 00675L 槓桿加碼，允許 0050 baseline DCA 維持`,
      maintenanceMargin,
      protectTrigger: maint.protectTrigger,
      protectTarget,
      reserveStatus,
      needAmount,
      reserveSufficient,
    };
  }

  // 🟢 Layer 3：常態運行 >= protectTrigger(160)
  // 以下為原有策略邏輯完整執行

  // ─────────────────────────────────────────────────────────────
  // ★ Pre-Entry Gate：左側進擊矩陣前置過濾（依跌幅層級限制允許操作）
  // entryGate 在估值泡沫/再平衡/恐慌買入之前執行，確保所有買入路徑均受過濾
  // ─────────────────────────────────────────────────────────────
  const entryGateCfg = strategy.buy?.entryGate;
  const gateResult = resolveEntryGate(ctx.priceDropPercent, ctx.rsi, entryGateCfg);

  if (gateResult.blocked) {
    const tierIndex = gateResult.tierIndex;
    const tier = gateResult.tier;
    const tierLabels = ['底倉通道', '淺層修正通道', '深度回撤通道', '極端恐慌通道'];
    const tierEmojis = ['🌱', '🟡', '🟠', '🔴'];
    const tierLabel = tierLabels[tierIndex] ?? `Tier ${tierIndex}`;
    const tierEmoji = tierEmojis[tierIndex] ?? '⚙️';

    const rsiInfo = tier.rsiThreshold != null
      ? `RSI 門檻：${tier.rsiThreshold}（當前 ${ctx.rsi.toFixed(0)}）`
      : 'RSI 門檻：不適用';

    return {
      maintenanceLayer: 'normal',
      entryGateLevel: tierIndex,
      entryGateLabel: tierLabel,
      entryGateBlocked: true,
      marketStatus: `${tierEmoji}【前置過濾：${tierLabel}】`,
      target: '🚧 槓桿封鎖',
      targetSuggestionShort: `${tier.note}（跌幅 ${ctx.priceDropPercent.toFixed(1)}%）`,
      targetSuggestion: `entryGate ${tierLabel}：${tier.note}`,
      suggestion:
        `• 當前跌幅：${ctx.priceDropPercent.toFixed(1)}%（區間 ${tier.minDrop}–${tier.maxDrop === 999 ? '∞' : tier.maxDrop}%）\n` +
        `• ${rsiInfo}\n` +
        `• 封鎖原因：${gateResult.blockReason}\n` +
        `• ⚠️ 本層通道不允許 00675L 加碼（entryGate 前置過濾）\n` +
        `• 允許操作：0050 DCA 照常執行`,
    };
  }

  // 1.5) 估值極度昂貴：防泡沫機制 (PB > 2.2)
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

  // 2.5) 停利條件
  if (
    ctx.priceUpPercent >= strategy.sell.minUpPercentToSell &&
    sellSignals.signalCount >= strategy.sell.minSignalCountToSell
  ) {
    return buildSellBackToAllocation(ctx, strategy);
  }

  // 3) 極端恐慌買入
  if (Number.isFinite(ctx.vix) && Number(ctx.vix) > 0) {
    const panicCfg = strategy.buy.panic ?? {};

    const extremeDropThreshold = getExtremeDropThreshold(strategy);
    const rsiOversold = strategy.buy.rsi.oversold ?? 50;
    const rsiDivider = panicCfg.rsiDivider ?? 1.6;
    const extremeRsiThreshold = rsiOversold / rsiDivider;

    const extremeDrop = ctx.priceDropPercent >= extremeDropThreshold;
    const rsiCrash = ctx.rsi < extremeRsiThreshold;
    const vixPanic = ctx.vix >= th.vixPanic;
    const vixExtreme = ctx.vix >= th.vixExtreme;

    if (extremeDrop && rsiCrash && vixPanic) {
      let suggestedLeverage = panicCfg.suggestedLeverage ?? 0.3;
      let intensityLevel = "❄️【恐慌逆向】";

      if (vixExtreme) {
        suggestedLeverage = Math.min(0.5, suggestedLeverage * 1.67);
        intensityLevel = "🧊【極端恐慌】";
      }

      return {
        marketStatus: intensityLevel,
        target: "⚡ 破冰加碼",
        targetSuggestionShort: `不計冷卻期加碼 00675L (槓桿 ${(suggestedLeverage * 100).toFixed(0)}%)`,
        targetSuggestion: `極端恐慌，建議質押買入 00675L（建議槓桿 ${(suggestedLeverage * 100).toFixed(0)}%）`,
        suggestion:
          `• 跌幅：${ctx.priceDropPercent.toFixed(1)}% (門檻 >= ${extremeDropThreshold.toFixed(0)}%)\n` +
          `• RSI：${ctx.rsi.toFixed(0)} (門檻 < ${extremeRsiThreshold.toFixed(0)})\n` +
          `• VIX：${ctx.vix.toFixed(1)} (門檻 >= ${th.vixPanic})\n` +
          `• 進場評分：${entry.weightScore} 分\n\n` +
          `【執行提示】\n` +
          `⚠️ 僅在維持率充足時執行，並建議分批買入\n` +
          `⏰ 恐慌加碼不受一般冷卻期限制，但執行後仍請記錄買入日期`,
        suggestedLeverage,
        entryGateLevel: gateResult.tierIndex,
        entryGateLabel: gateResult.tier?.note ?? '',
        entryGateBlocked: false,
        thresholds: {
          extremeDropThreshold,
          extremeRsiThreshold,
          vixPanicThreshold: th.vixPanic,
        },
      };
    }
  }

  // 4) 過熱：禁撥款
  if (overheat.isOverheat) {
    const f = overheat.factors;
    const factorText =
      `目前命中進度：${overheat.coolCount}/${overheat.factorCount}\n` +
      `  └ RSI > ${th.rsiOverheatLevel} (${f.rsiHigh ? "❌未冷卻" : "✔️已冷卻"})\n` +
      `  └ KD(D) > ${th.dOverheatLevel} (${f.kdHigh ? "❌未冷卻" : "✔️已冷卻"})\n` +
      `  └ 乖離率 > ${th.bias240OverheatLevel}% (${f.biasHigh ? "❌未冷卻" : "✔️已冷卻"})`;

    const reversalText =
      `反轉觸發：${reversal.triggeredCount}/${reversal.totalFactor}\n` +
      `  └ RSI跌破${th.rsiReversalLevel} (${reversal.rsiDrop ? "✔️觸發" : "─"})\n` +
      `  └ KD跌破${th.kReversalLevel} (${reversal.kdDrop ? "✔️觸發" : "─"})\n` +
      `  └ KD死叉 (${reversal.kdBearCross ? "✔️觸發" : "─"})\n` +
      `  └ MACD死叉 (${reversal.macdBearCross ? "✔️觸發" : "─"})`;

    return {
      marketStatus: "🔥【極度過熱】",
      target: "🚫 禁止撥款",
      targetSuggestionShort: "0050照常；暫停 00675L 新增撥款",
      targetSuggestion: "0050照常；暫停撥款買 00675L；允許質押但不動用額度",
      suggestion:
        `• 允許質押現有庫存，但絕對不動用額度\n` +
        `• 0050 可維持原定 DCA 計畫\n\n` +
        `【冷卻進度追蹤】\n${factorText}\n\n` +
        `【轉弱訊號追蹤】\n${reversalText}`,
      factorText,
      reversalText,
    };
  }

  // 5) 轉弱：停止加碼
  if (reversal.triggeredCount >= th.reversalTriggerCount) {
    return {
      marketStatus: "📡【轉弱監控】",
      target: "⏸️ 降速暫停",
      targetSuggestionShort: "等待轉弱解除，暫停買入",
      targetSuggestion: "0050照常；00675L 停止撥款，等待轉弱解除或轉多恢復",
      suggestion:
        `• 當前轉弱訊號：命中 ${reversal.triggeredCount} 項 (門檻為 ${th.reversalTriggerCount})\n` +
        `• 行動建議：暫停對 00675L 的加碼與撥款\n` +
        `• 後續觀察：等待轉多指標恢復，或觸發再平衡門檻`,
      reversal,
    };
  }

  const dropOk = ctx.priceDropPercent >= strategy.buy.minDropPercentToConsider;
  const scoreOk = entry.weightScore >= strategy.buy.minWeightScoreToBuy;
  const dropSuggestion = strategy.buy.minDropPercentToConsider > 0 ? `• 跌幅條件：${ctx.priceDropPercent.toFixed(1)}% / 門檻 ${strategy.buy.minDropPercentToConsider}% (${dropOk ? "✔️達標" : "❌未達"})\n` : '';
  const scoreSuggestion = strategy.buy.minWeightScoreToBuy > 0 ? `• 評分條件：${entry.weightScore}分 / 門檻 ${strategy.buy.minWeightScoreToBuy}分 (${scoreOk ? "✔️達標" : "❌未達"})\n` : '';

  // 5.5) 偏熱但未過熱
  if (!overheat.isOverheat && overheat.highCount > 0 && (!dropOk || !scoreOk)) {
    return {
      marketStatus: "🌡️【偏熱/觀察】",
      target: "👀 觀察等待",
      targetSuggestionShort: "市場偏熱，避免追高",
      targetSuggestion: "0050照常；00675L 先不撥款，避免追高（等回檔或轉多）",
      suggestion:
        dropSuggestion +
        scoreSuggestion +
        `• 狀態說明：目前過熱因子命中 ${overheat.highCount} 項 (未達絕對過熱的 ${overheat.factorCount} 項)，建議耐心等回檔。`,
      entry: ctx.entry,
    };
  }

  // 6) 未達進場
  if (!dropOk || !scoreOk) {
    return {
      marketStatus: "⏳【未達進場】",
      target: "👀 觀察等待",
      targetSuggestionShort: "未達撥款門檻，持續觀望",
      targetSuggestion:
        "0050照常；00675L 等待進場條件達成（跌幅/評分達標再撥款）",
      suggestion:
        dropSuggestion +
        scoreSuggestion +
        `• 行動建議：0050維持定期定額，00675L不動作`,
      entry: ctx.entry,
    };
  }

  // 6.5) Cooldown 檢查
  if (cooldownStatus.inCooldown) {
    const w = entry.weightScore;
    const targetAlloc = getTargetLeverageByScore(w, strategy);
    const targetLeveragePercent = (targetAlloc.leverage * 100).toFixed(0);

    return {
      marketStatus: "⏰【冷卻期中】",
      target: "⏸️ 等待冷卻",
      targetSuggestionShort: `策略達標但冷卻中 (剩餘 ${cooldownStatus.daysLeft} 天)`,
      targetSuggestion: `符合加碼條件（${w}分，目標槓桿 ${targetLeveragePercent}%），但處於冷卻期(剩餘 ${cooldownStatus.daysLeft} 天)，請勿重複加碼`,
      suggestion:
        `• 當前狀態：符合評分 ${w} 分，建議槓桿 ${targetLeveragePercent}%\n` +
        `• 阻擋原因：${cooldownStatus.message}\n` +
        `• 行動建議：避免頻繁交易耗損，請嚴守紀律，等待冷卻期結束後再執行加碼`,
      cooldownStatus,
      targetAllocation: targetAlloc,
    };
  }

  // 7) 正常轉多：動態讀取槓桿配置
  const w = entry.weightScore;
  const targetAlloc = getTargetLeverageByScore(w, strategy);
  const targetLeveragePercent = (targetAlloc.leverage * 100).toFixed(0);

  const cooldownReminder = `\n• ⏰ 提醒：買入後請確實記錄日期，系統將啟動 ${strategy.trading.cooldownDays} 個交易日的冷卻期`;

  // 根據分數檔位決定標題
  if (w >= th.wAggressive) {
    return {
      marketStatus: "🚀【強勢進攻】",
      target: "⭐ 最積極型",
      targetSuggestionShort: `大額加碼 00675L 至槓桿 ${targetLeveragePercent}%`,
      targetSuggestion: `建議增貸至 ${targetLeveragePercent}% 加碼（${targetAlloc.comment}）`,
      suggestion:
        `• 策略評分：高達 ${w} 分\n` +
        `• 資金配置：${targetAlloc.comment}\n` +
        `• 執行步驟：建議增貸並買入 00675L，使總槓桿達到 ${targetLeveragePercent}%` +
        cooldownReminder,
      entryGateLevel: gateResult.tierIndex,
      entryGateLabel: gateResult.tier?.note ?? '',
      entryGateBlocked: false,
      targetAllocation: targetAlloc,
    };
  }

  if (w >= th.wActive) {
    return {
      marketStatus: "📈【轉多加碼】",
      target: "🔸 積極型",
      targetSuggestionShort: `加碼 00675L 至槓桿 ${targetLeveragePercent}%`,
      targetSuggestion: `建議增貸至 ${targetLeveragePercent}% 加碼（${targetAlloc.comment}）`,
      suggestion:
        `• 策略評分：${w} 分\n` +
        `• 資金配置：${targetAlloc.comment}\n` +
        `• 執行步驟：建議增貸並買入 00675L，使總槓桿達到 ${targetLeveragePercent}%` +
        cooldownReminder,
      entryGateLevel: gateResult.tierIndex,
      entryGateLabel: gateResult.tier?.note ?? '',
      entryGateBlocked: false,
      targetAllocation: targetAlloc,
    };
  }

  // 底倉
  return {
    marketStatus: "🌱【常態布局】",
    target: "🔹 定期定額",
    targetSuggestionShort: `維持標準 DCA (槓桿 ${targetLeveragePercent}%)`,
    targetSuggestion: `無特殊訊號，執行標準配置：買入 0050 後質押買入 00675L（${targetLeveragePercent}%）`,
    suggestion:
      `• 策略評分：${w} 分\n` +
      `• 狀態說明：當前無過熱或風控風險\n` +
      `• 執行步驟：請執行標準資金注入，買入 0050 後質押買入 00675L，維持槓桿約 ${targetLeveragePercent}%`,
    entryGateLevel: gateResult.tierIndex,
    entryGateLabel: gateResult.tier?.note ?? '',
    entryGateBlocked: false,
    targetAllocation: targetAlloc,
  };
}

function buildSellBackToAllocation(ctx, strategy) {
  const post = getPostSellAllocation(strategy);
  const targetLeverage = post.leverage;
  const targetZ2Value = ctx.netAsset * targetLeverage;

  const sellAmount = Math.max(0, ctx.currentZ2Value - targetZ2Value);

  return {
    marketStatus: "🎯【停利/降槓桿】",
    target: "🛎️ 結帳還款",
    targetSuggestionShort: `賣出 00675L 降槓桿至 ${(post.leverage * 100).toFixed(0)}%`,
    targetSuggestion: `賣出部分00675L並還款，恢復槓桿 ${(targetLeverage * 100).toFixed(0)}% / 現金 ${(post.cash * 100).toFixed(0)}%`,
    suggestion:
      `• 觸發條件：已滿足策略設定之停利與訊號數量門檻\n` +
      `• 目標配置：槓桿降至 ${(targetLeverage * 100).toFixed(0)}%，現金儲備提升至 ${(post.cash * 100).toFixed(0)}%\n` +
      `• 執行步驟：建議賣出約 ${sellAmount.toLocaleString("zh-TW", { maximumFractionDigits: 0 })} 元的 00675L 並進行還款`,
    postAllocation: post,
    sellAmount,
  };
}

/**
 * 檢查是否在 Cooldown 期間 (以「交易日」計算)
 * @param {Date|string} lastBuyDate - 最後買入日期
 * @param {number} cooldownTradingDays - 冷卻「交易日」天數
 * @returns {Promise<Object>} { inCooldown, daysLeft, lastBuyDate, message }
 */
async function checkCooldown(lastBuyDate, cooldownTradingDays) {
  if (!lastBuyDate) {
    return {
      inCooldown: false,
      daysLeft: 0,
      lastBuyDate: null,
      message: "無歷史買入記錄",
    };
  }

  const today = new Date();
  const lastBuy = new Date(lastBuyDate);

  today.setHours(0, 0, 0, 0);
  lastBuy.setHours(0, 0, 0, 0);

  const startYear = lastBuy.getFullYear();
  const endYear = today.getFullYear();

  const holidays = new Set();

  try {
    for (let y = startYear; y <= endYear; y++) {
      const yearHolidays = await loadHolidaySet(y);
      yearHolidays.forEach((dateStr) => holidays.add(dateStr));
    }
  } catch (e) {
    console.warn("⚠️ 無法取得 TWSE 假日，將退回使用六日計算交易日:", e.message);
  }

  let tradingDaysPassed = 0;
  let currentDate = new Date(lastBuy);
  currentDate.setDate(currentDate.getDate() + 1);

  while (currentDate <= today) {
    const dayOfWeek = currentDate.getDay();
    const isoDate = currentDate.toISOString().split("T")[0];
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidays.has(isoDate);

    if (!isWeekend && !isHoliday) {
      tradingDaysPassed++;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  const daysLeft = Math.max(0, cooldownTradingDays - tradingDaysPassed);
  const lastBuyStr = lastBuy.toISOString().split("T")[0];

  return {
    inCooldown: daysLeft > 0,
    daysLeft,
    lastBuyDate: lastBuyStr,
    tradingDaysPassed,
    message:
      daysLeft > 0
        ? `最後買入：${lastBuyStr}，經過 ${tradingDaysPassed} 交易日`
        : `已過 ${tradingDaysPassed} 個交易日`,
  };
}

/**
 * 從 strategy.macroSentiment config 與外部傳入的 market_direction
 * 組裝成 computeEntryScore 所需的 macroSentiment 物件。
 * 若功能未啟用或無方向資料，回傳 null。
 *
 * 節四整合：若 vixOverride.overrideActive === true，
 * bearishPenalty 強制設為 0（短路屏蔽），並在回傳物件中標記短路狀態。
 *
 * @param {string|null} marketDirection - 'BULLISH' | 'BEARISH' | 'NEUTRAL' | null
 * @param {Object} strategy - 完整策略設定
 * @param {{ overrideActive: boolean, overrideReason: string }} vixOverride - VIX 短路狀態
 * @returns {Object|null}
 */
function buildMacroSentiment(marketDirection, strategy, vixOverride) {
  const cfg = strategy?.macroSentiment;
  if (!cfg?.enabled || !marketDirection) return null;

  const isOverrideActive = vixOverride?.overrideActive === true;

  // bearishPenalty：短路啟動時強制為 0，正常時從 config 讀取
  const effectivePenalty = isOverrideActive ? 0 : (cfg.bearishPenalty ?? 0);

  return {
    direction: marketDirection,
    bonus: cfg.bullishBonus ?? 0,
    penalty: effectivePenalty,
    // 短路標記：供 Telegram 模板（節五）識別並顯示 ⚡ VIX 情緒短路 提示
    vixOverrideActive: isOverrideActive,
    vixOverrideReason: isOverrideActive ? (vixOverride.overrideReason ?? '') : '',
  };
}

export async function evaluateInvestmentSignal(data, strategy) {
  const priceChangePercent =
    ((data.currentPrice - data.basePrice) / data.basePrice) * 100;
  const priceUpPercent = Math.max(0, priceChangePercent);
  const priceDropPercent = Math.max(0, -priceChangePercent);

  const current0050Value = data.portfolio.qty0050 * data.price0050;
  const currentZ2Value = data.portfolio.qtyZ2 * data.currentPrice;

  const maintenanceMargin =
    data.portfolio.totalLoan > 0
      ? (current0050Value / data.portfolio.totalLoan) * 100
      : 999;

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
  const vixArr = Array.isArray(data.vixArr) && data.vixArr.length > 0
    ? data.vixArr
    : (Number.isFinite(data.VIX) ? [data.VIX] : []);
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
    isBearish && !vixOverride.overrideActive && Number.isFinite(cfg.bearishCooldownMultiplier)
      ? Math.round(baseCooldownDays * cfg.bearishCooldownMultiplier)
      : baseCooldownDays;

  const lastBuyDate = data.portfolio?.lastBuyDate ?? null;
  const cooldownStatus = await checkCooldown(lastBuyDate, effectiveCooldownDays);

  if (effectiveCooldownDays !== baseCooldownDays) {
    cooldownStatus.message +=
      ` (⚠️ 空頭情緒延長冷卻至 ${effectiveCooldownDays} 交易日)`;
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

    reserveCash: data.portfolio?.cash || 0,

    cooldownStatus,

    entry: computeEntryScore(data, priceDropPercent, strategy, macroSentiment),
    overheat: computeOverheatState(data, bias240, strategy),
    reversal: computeReversalTriggers(data, strategy),
    sellSignals: computeSellSignals(data, strategy),
    valuation: data.rawValuation || null,
  };

  const decision = buildDecision(ctx, strategy);
  const macdSignal = getMACDSignal(data.macdArr);

  return {
    currentPrice: data.currentPrice,
    basePrice: data.basePrice,
    totalLoan: data.portfolio.totalLoan,
    actualLeverage,
    historicalLevel,
    netAsset: ctx.netAsset,
    bias240: bias240,
    priceChangePercent,
    priceChangePercentText: priceChangePercent.toFixed(2),
    priceUpPercent: priceUpPercent,
    priceUpPercentText: priceUpPercent.toFixed(2),
    priceDropPercent: priceDropPercent,
    priceDropPercentText: priceDropPercent.toFixed(2),
    RSI: data.RSI,
    KD_K: Number.isFinite(data.KD_K) ? data.KD_K : null,
    KD_D: Number.isFinite(data.KD_D) ? data.KD_D : null,
    overheat: ctx.overheat,
    reversal: ctx.reversal,
    weightScore: ctx.entry.weightScore,
    weightDetails: ctx.entry.weightDetails,
    sellSignals: ctx.sellSignals,
    macdSignal,
    maintenanceMargin,
    z2Ratio,
    strategy,
    macroSentiment,
    effectiveCooldownDays,
    vixOverride,
    ...decision,
    entryGateLevel: decision.entryGateLevel ?? null,
    entryGateLabel: decision.entryGateLabel ?? null,
    entryGateBlocked: decision.entryGateBlocked ?? false,
    cooldownStatus,
  };
}

export async function getInvestmentSignalAsync(data) {
  const strategy = await fetchStrategyConfig();
  validateStrategyConfig(strategy);
  return await evaluateInvestmentSignal(data, strategy);
}
