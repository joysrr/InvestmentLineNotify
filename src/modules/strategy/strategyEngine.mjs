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
  } = ctx;

  const reserveStatus = getReserveStatus(ctx, strategy);

  // ✅ 0) 維持率防禦提醒（整合預備金）
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
        `🛡️ 維持率 ${maintenanceMargin.toFixed(0)}%，低於安全線 ${maint.protectTrigger}%\n` +
        `\n` +
        `📊 需要補充：\n` +
        `   └ 目標維持率：${protectTarget}%\n` +
        `   └ 需補充金額：約 ${needAmount.toLocaleString("zh-TW", { maximumFractionDigits: 0 })} 元\n` +
        `\n` +
        `💰 預備金狀態：\n` +
        `   └ 當前預備金：${reserveStatus.currentReserve.toLocaleString("zh-TW", { maximumFractionDigits: 0 })} 元\n` +
        `   └ ${reserveSufficient ? "✅ 預備金充足，可立即動用" : "⚠️ 預備金不足，需補充現金"}\n` +
        `\n` +
        `建議行動：\n` +
        `1. ${reserveSufficient ? "動用預備金買入 0050（提升抵押品價值）" : "優先補充現金還款"}\n` +
        `2. ${reserveSufficient ? "或補充現金還款（降低借款）" : "或動用部分預備金買入 0050"}\n` +
        `3. 目標：提升至 ${protectTarget}% 以上`,
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
      marketStatus: "⚠️【追繳風險】",
      target: "🧯 風控優先",
      targetSuggestionShort: "停止撥款；優先補保證金/降槓桿",
      targetSuggestion: "停止撥款與加碼；準備補錢或降低槓桿",
      suggestion: `⚠️ 維持率 ${maintenanceMargin.toFixed(0)}% 過低（< ${th.mmDanger}%）：停止加碼，優先補保證金/降槓桿`,
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
        targetSuggestionShort: "賣00675L還款；回到目標佔比",
        targetSuggestion: "賣出部分00675L並還款，恢復到目標佔比",
        suggestion: `⚖️ 00675L佔比 ${z2Ratio.toFixed(1)}% 過高（> ${th.z2RatioHigh}%）：建議賣出約 ${sellAmount.toLocaleString("zh-TW", { maximumFractionDigits: 0 })} 元並還款`,
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

  // 🔥 3) 極端恐慌買入
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
      let intensityLevel = "🩸 恐慌";

      if (vixExtreme) {
        suggestedLeverage = Math.min(0.5, suggestedLeverage * 1.67);
        intensityLevel = "🩸🩸 極端恐慌";
      }

      const panicDetails = [
        `跌幅 ${ctx.priceDropPercent.toFixed(1)}% (>= ${extremeDropThreshold.toFixed(0)}%)`,
        `RSI ${ctx.rsi.toFixed(0)} (< ${extremeRsiThreshold.toFixed(0)})`,
        `VIX ${ctx.vix.toFixed(1)} (>= ${th.vixPanic})`,
        `評分 ${entry.weightScore}分`,
      ].join(" | ");

      return {
        marketStatus: `${intensityLevel}【逆向機會】`,
        target: "💰 恐慌加碼",
        targetSuggestionShort: `00675L 恐慌加碼（${(suggestedLeverage * 100).toFixed(0)}%）`,
        targetSuggestion: `極端恐慌，建議質押買入 00675L（建議槓桿 ${(suggestedLeverage * 100).toFixed(0)}%）`,
        suggestion:
          `${intensityLevel} 市場極端超賣，建議逆向加碼\n` +
          `${panicDetails}\n` +
          `⚠️ 風險提示：僅在維持率充足時執行，分批買入\n` +
          `⏰ 恐慌加碼不受冷卻期限制，但買入後請記錄日期`,
        panicDetails,
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
      `解除禁令進度：${overheat.coolCount}/${overheat.factorCount} ` +
      `｜RSI${th.rsiOverheatLevel}${f.rsiHigh ? "❌" : "✔️"}` +
      `｜KD${th.dOverheatLevel}${f.kdHigh ? "❌" : "✔️"}` +
      `｜BIAS${th.bias240OverheatLevel}${f.biasHigh ? "❌" : "✔️"}`;

    const reversalText =
      `反轉觸發：${reversal.triggeredCount}/${reversal.totalFactor}` +
      `｜RSI跌破${th.rsiReversalLevel}${reversal.rsiDrop ? "✔️" : "❌"}` +
      `｜KD跌破${th.kReversalLevel}${reversal.kdDrop ? "✔️" : "❌"}` +
      `｜KD死叉${reversal.kdBearCross ? "✔️" : "❌"}` +
      `｜MACD死叉${reversal.macdBearCross ? "✔️" : "❌"}`;

    return {
      marketStatus: "🔥【極度過熱】",
      target: "🚫 禁撥款",
      targetSuggestionShort: "0050照常；00675L 禁止撥款",
      targetSuggestion: "0050照常；暫停撥款買 00675L；允許質押但不動用額度",
      suggestion: `🚫 禁撥款；0050照常定投；允許質押但不動用額度\n${factorText}\n${reversalText}`,
      factorText,
      reversalText,
    };
  }

  // 5) 轉弱：停止加碼
  if (reversal.triggeredCount >= th.reversalTriggerCount) {
    return {
      marketStatus: "📉【轉弱監控】",
      target: "⏸️ 降速/停止買入",
      targetSuggestionShort: "0050照常；00675L 停止撥款",
      targetSuggestion: "0050照常；00675L 停止撥款，等待轉弱解除或轉多恢復",
      suggestion: `📉 轉弱訊號 ${reversal.triggeredCount}/${reversal.totalFactor}：暫停加碼，等待轉多恢復或觸發再平衡門檻`,
      reversal,
    };
  }

  const dropOk = ctx.priceDropPercent >= strategy.buy.minDropPercentToConsider;
  const scoreOk = entry.weightScore >= strategy.buy.minWeightScoreToBuy;

  // 5.5) 偏熱但未過熱
  if (!overheat.isOverheat && overheat.highCount > 0 && (!dropOk || !scoreOk)) {
    return {
      marketStatus: "🌡️【偏熱/觀察】",
      target: "👀 觀察/不撥款",
      targetSuggestionShort: "0050照常；00675L 先不撥款",
      targetSuggestion: "0050照常；00675L 先不撥款，避免追高（等回檔或轉多）",
      suggestion:
        `未達進場：跌幅 ${ctx.priceDropPercent.toFixed(1)}%/${strategy.buy.minDropPercentToConsider}% ${dropOk ? "✔️" : "❌"}，` +
        `分數 ${entry.weightScore}/${strategy.buy.minWeightScoreToBuy} ${scoreOk ? "✔️" : "❌"}；` +
        `過熱因子命中 ${overheat.highCount}/${overheat.factorCount}（未達過熱）`,
      entry: ctx.entry,
    };
  }

  // 6) 未達進場
  if (!dropOk || !scoreOk) {
    return {
      marketStatus: "👀【觀察/未達進場】",
      target: "👀 觀察/不撥款",
      targetSuggestionShort: "0050照常；00675L 等待進場",
      targetSuggestion:
        "0050照常；00675L 等待進場條件達成（跌幅/評分達標再撥款）",
      suggestion:
        `未達撥款門檻：` +
        `跌幅 ${ctx.priceDropPercent.toFixed(1)}%/${strategy.buy.minDropPercentToConsider}% ${dropOk ? "✔️" : "❌"}，` +
        `分數 ${entry.weightScore}/${strategy.buy.minWeightScoreToBuy} ${scoreOk ? "✔️" : "❌"}`,
      entry: ctx.entry,
    };
  }

  // ✅ 6.5) Cooldown 檢查（新增）
  if (cooldownStatus.inCooldown) {
    const w = entry.weightScore;
    const targetAlloc = getTargetLeverageByScore(w, strategy);
    const targetLeveragePercent = (targetAlloc.leverage * 100).toFixed(0);

    return {
      marketStatus: "⏰【冷卻期中】",
      target: "⏸️ 等待冷卻期結束",
      targetSuggestionShort: `冷卻期剩餘 ${cooldownStatus.daysLeft} 天`,
      targetSuggestion:
        `符合加碼條件（${w}分，目標槓桿 ${targetLeveragePercent}%），` +
        `但處於冷卻期(剩餘 ${cooldownStatus.daysLeft} 天)，請勿重複加碼`,
      suggestion:
        `⏰ 冷卻期中（剩餘 ${cooldownStatus.daysLeft} 天）\n` +
        `符合條件：評分 ${w} 分，建議槓桿 ${targetLeveragePercent}%\n` +
        `${cooldownStatus.message}\n` +
        `⚠️ 請等待冷卻期結束後再加碼，避免頻繁交易`,
      cooldownStatus,
      targetAllocation: targetAlloc,
    };
  }

  // ✅ 7) 正常轉多：動態讀取槓桿配置
  const w = entry.weightScore;
  const targetAlloc = getTargetLeverageByScore(w, strategy);
  const targetLeveragePercent = (targetAlloc.leverage * 100).toFixed(0);

  // ✅ Cooldown 提醒
  const cooldownReminder = `\n⏰ 買入後請記錄日期，啟動 ${strategy.trading.cooldownDays} 天冷卻期`;

  // 根據分數檔位決定標題
  if (w >= th.wAggressive) {
    return {
      marketStatus: "🚀【轉多/可進攻】",
      target: "🔥 最積極型",
      targetSuggestionShort: `00675L 大額加碼（${targetLeveragePercent}%）`,
      targetSuggestion: `建議增貸至 ${targetLeveragePercent}% 加碼（${targetAlloc.comment}）`,
      suggestion:
        `🔥 最積極型（${w}分）：建議增貸至 ${targetLeveragePercent}% 加碼` +
        cooldownReminder,
      targetAllocation: targetAlloc,
    };
  }

  if (w >= th.wActive) {
    return {
      marketStatus: "📈【轉多/可加碼】",
      target: "📈 積極型",
      targetSuggestionShort: `00675L 加碼（${targetLeveragePercent}%）`,
      targetSuggestion: `建議增貸至 ${targetLeveragePercent}% 加碼（${targetAlloc.comment}）`,
      suggestion:
        `📈 積極型（${w}分）：建議增貸至 ${targetLeveragePercent}% 加碼` +
        cooldownReminder,
      targetAllocation: targetAlloc,
    };
  }

  // 底倉
  return {
    marketStatus: "🐢【常態布局】",
    target: "🛡️ 定期定額",
    targetSuggestionShort: `執行標準DCA（${targetLeveragePercent}%）`,
    targetSuggestion: `無特殊訊號，執行標準配置：買入 0050 後質押買入 00675L（${targetLeveragePercent}%）`,
    suggestion: `🛡️ 常態布局（${w}分）：當前無過熱或風控風險，請執行標準資金注入`,
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
    target: "💸 賣出/還款",
    targetSuggestionShort: `停利賣00675L；降到 ${(post.leverage * 100).toFixed(0)}%`,
    targetSuggestion: `賣出部分00675L並還款，恢復槓桿 ${(targetLeverage * 100).toFixed(0)}% / 現金 ${(post.cash * 100).toFixed(0)}%`,
    suggestion:
      `🎯 觸發賣出條件：建議賣出約 ${sellAmount.toLocaleString("zh-TW", { maximumFractionDigits: 0 })} 元並還款，` +
      `回到 ${(targetLeverage * 100).toFixed(0)}% / ${(post.cash * 100).toFixed(0)}%`,
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
      message: "無歷史買入記錄，可以買入",
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
        ? `冷卻期剩餘 ${daysLeft} 個交易日（最後買入：${lastBuyStr}，已過 ${tradingDaysPassed} 個交易日）`
        : `冷卻期已過（最後買入：${lastBuyStr}，已過 ${tradingDaysPassed} 個交易日）`,
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

  let historicalLevel = "⛅【中位階】";
  if (bias240 > 25) historicalLevel = "【極高位階/過熱】🥵";
  else if (bias240 > 15) historicalLevel = "【高位階/偏貴】🌡️";
  else if (bias240 < 0) historicalLevel = "【低位階/便宜】❄️";

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
