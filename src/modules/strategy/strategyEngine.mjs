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

  // 0) 維持率防禦提醒（整合預備金）
  if (
    Number.isFinite(maint.protectTrigger) &&
    maintenanceMargin < maint.protectTrigger
  ) {
    const protectTarget = maint.protectTarget || 180;

    // 計算需要補充的金額
    const totalLoan = ctx.totalLoan || 0;
    const currentCollateral = (maintenanceMargin / 100) * totalLoan;
    const targetCollateral = (protectTarget / 100) * totalLoan;
    const needAmount = Math.max(0, targetCollateral - currentCollateral);

    // 預備金是否足夠
    const reserveSufficient = reserveStatus.currentReserve >= needAmount;

    return {
      marketStatus: "🛡️【維持率低於安全線】",
      target: "🧯 預備金防禦",
      targetSuggestionShort: "動用預備金或補充抵押品",
      targetSuggestion: `維持率低於 ${maint.protectTrigger}%，建議動用預備金買入 0050 或補充現金，目標維持率 ${protectTarget}%`,
      suggestion:
        `• 當前維持率：${maintenanceMargin.toFixed(0)}% (低於安全線 ${maint.protectTrigger}%)\n` +
        `• 補足目標：${protectTarget}%\n` +
        `• 資金缺口：約 ${needAmount.toLocaleString("zh-TW", { maximumFractionDigits: 0 })} 元\n` +
        `• 當前預備金：${reserveStatus.currentReserve.toLocaleString("zh-TW", { maximumFractionDigits: 0 })} 元\n` +
        `• 預備金狀態：${reserveSufficient ? "✅ 充足，可立即動用" : "⚠️ 不足，需補充額外現金"}\n\n` +
        `【執行步驟】\n` +
        `1. ${reserveSufficient ? "動用預備金買入 0050 (提升抵押品價值)" : "優先補充現金還款"}\n` +
        `2. ${reserveSufficient ? "或補充現金還款 (降低借款)" : "或動用部分預備金買入 0050"}`,
      maintenanceMargin,
      protectTrigger: maint.protectTrigger,
      protectTarget,
      reserveStatus,
      needAmount,
      reserveSufficient,
    };
  }

  // 1) 追繳風險：一票否決
  if (maintenanceMargin < th.mmDanger) {
    return {
      marketStatus: "🚨【追繳風險】",
      target: "🛑 風控優先",
      targetSuggestionShort: "停止撥款；優先補保證金或降槓桿",
      targetSuggestion: "停止撥款與加碼；準備補錢或降低槓桿",
      suggestion:
        `• 當前維持率：${maintenanceMargin.toFixed(0)}%\n` +
        `• 危險門檻：${th.mmDanger}%\n` +
        `• 說明：請立即停止任何加碼行為，優先處理保證金問題以防斷頭。`,
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

  // 5.5) 偏熱但未過熱
  if (!overheat.isOverheat && overheat.highCount > 0 && (!dropOk || !scoreOk)) {
    return {
      marketStatus: "🌡️【偏熱/觀察】",
      target: "👀 觀察等待",
      targetSuggestionShort: "市場偏熱，避免追高",
      targetSuggestion: "0050照常；00675L 先不撥款，避免追高（等回檔或轉多）",
      suggestion:
        `• 跌幅條件：${ctx.priceDropPercent.toFixed(1)}% / 門檻 ${strategy.buy.minDropPercentToConsider}% (${dropOk ? "✔️達標" : "❌未達"})\n` +
        `• 評分條件：${entry.weightScore}分 / 門檻 ${strategy.buy.minWeightScoreToBuy}分 (${scoreOk ? "✔️達標" : "❌未達"})\n` +
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
        `• 跌幅條件：${ctx.priceDropPercent.toFixed(1)}% / 門檻 ${strategy.buy.minDropPercentToConsider}% (${dropOk ? "✔️達標" : "❌未達"})\n` +
        `• 評分條件：${entry.weightScore}分 / 門檻 ${strategy.buy.minWeightScoreToBuy}分 (${scoreOk ? "✔️達標" : "❌未達"})\n` +
        `• 行動建議：0050維持定期定額，00675L不動作`,
      entry: ctx.entry,
    };
  }

  // 6.5) Cooldown 檢查（新增）
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

  // 將時間清零，確保只比較日期
  today.setHours(0, 0, 0, 0);
  lastBuy.setHours(0, 0, 0, 0);

  // 1. 為了跨年，我們需要取得 [去年, 今年] 的假日集合 (確保涵蓋買入日到今天的區間)
  const startYear = lastBuy.getFullYear();
  const endYear = today.getFullYear();

  const holidays = new Set();

  try {
    for (let y = startYear; y <= endYear; y++) {
      const yearHolidays = await loadHolidaySet(y);
      // 將該年的假日加入合併的 Set 中
      yearHolidays.forEach((dateStr) => holidays.add(dateStr));
    }
  } catch (e) {
    console.warn("⚠️ 無法取得 TWSE 假日，將退回使用六日計算交易日:", e.message);
  }

  // 2. 計算從 lastBuyDate 到 today 經過了幾個「交易日」
  let tradingDaysPassed = 0;

  // 建立一個游標指標，從最後買入日的「隔天」開始算起
  let currentDate = new Date(lastBuy);
  currentDate.setDate(currentDate.getDate() + 1);

  while (currentDate <= today) {
    const dayOfWeek = currentDate.getDay(); // 0=Sun, 6=Sat
    const isoDate = currentDate.toISOString().split("T")[0]; // YYYY-MM-DD

    // 判斷是否為週末 (0, 6) 或 國定假日
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidays.has(isoDate);

    // 如果既不是週末，也不是國定假日，則算一個有效交易日
    if (!isWeekend && !isHoliday) {
      tradingDaysPassed++;
    }

    // 推進一天
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // 3. 計算剩餘冷卻天數
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

  // 檢查 Cooldown
  const cooldownDays = strategy.trading.cooldownDays || 20;
  const lastBuyDate = data.portfolio?.lastBuyDate || null; // 從 portfolio 讀取
  const cooldownStatus = await checkCooldown(lastBuyDate, cooldownDays);

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

    // 預備金
    reserveCash: data.portfolio?.cash || 0,

    cooldownStatus,

    entry: computeEntryScore(data, priceDropPercent, strategy),
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
    ...decision,
    cooldownStatus,
  };
}

export async function getInvestmentSignalAsync(data) {
  const strategy = await fetchStrategyConfig();
  validateStrategyConfig(strategy);
  return await evaluateInvestmentSignal(data, strategy);
}
