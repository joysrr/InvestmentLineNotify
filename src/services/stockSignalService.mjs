import { fetchStrategyConfig } from "./strategyConfigService.mjs";
import { validateStrategyConfig } from "./strategyConfigValidator.mjs";
import {
  roseAboveAfterBelow,
  fellBelowAfterAbove,
  wasBelowLevel,
  macdCrossUp,
  macdCrossDown,
  kdCrossDown,
  kdCrossUp,
  lastKD,
  kdSeries,
} from "../finance/indicators.mjs";

function getMACDSignal(macdResult) {
  if (!macdResult?.length) return "neutral";
  const last = macdResult[macdResult.length - 1];
  if (last.MACD > last.signal) return "bull";
  if (last.MACD < last.signal) return "bear";
  return "neutral";
}

// 轉多權重計算
function computeEntryScore(data, priceDropPercent, strategy) {
  // 找到符合的跌幅規則（從高到低排序）取得分數
  const dropRules = Array.isArray(strategy?.buy?.dropScoreRules)
    ? strategy.buy.dropScoreRules.toSorted((a, b) => b.minDrop - a.minDrop)
    : [];
  const dropRule = dropRules.find((r) => priceDropPercent >= r.minDrop);

  const oversold = strategy.buy.rsi.oversold;
  const oversoldK = strategy.buy.kd.oversoldK;

  const kdBullLow =
    kdCrossUp(data.kdArr) &&
    wasBelowLevel(data.kdArr, oversoldK, 10, (x) => x.k);

  const signals = {
    rsiRebound: roseAboveAfterBelow(data.rsiArr, oversold, 10, {
      requireCrossToday: false,
    }),
    macdBull: macdCrossUp(data.macdArr),
    kdBullLow,
  };

  const details = {
    dropInfo: dropRule
      ? dropRule.label
      : `跌幅 ${priceDropPercent.toFixed(2)}%`,
    dropScore: dropRule ? dropRule.score : 0,
    rsiInfo: signals.rsiRebound ? `RSI 反轉 (${oversold})` : `RSI 未反轉`,
    rsiScore: signals.rsiRebound ? strategy.buy.rsi.score : 0,
    macdInfo: signals.macdBull ? "MACD 黃金交叉" : "MACD 無交叉",
    macdScore: signals.macdBull ? strategy.buy.macd.score : 0,
    kdInfo: signals.kdBullLow ? `KD 低檔交叉 (<${oversoldK})` : "KD 無交叉",
    kdScore: signals.kdBullLow ? strategy.buy.kd.score : 0,
  };

  const score =
    details.dropScore + details.rsiScore + details.macdScore + details.kdScore;
  return { weightScore: score, weightDetails: details, entrySignals: signals };
}

// 轉弱指標計算
function computeReversalTriggers(data, strategy) {
  const th = strategy.threshold;
  const rsiDrop = fellBelowAfterAbove(data.rsiArr, th.rsiReversalLevel, 10, {
    requireCrossToday: false,
  });
  const minKDArr = kdSeries(data.kdArr, (x) => Math.min(x.k, x.d));
  const kdDrop = fellBelowAfterAbove(minKDArr, th.kReversalLevel, 10, {
    requireCrossToday: false,
  });

  const kdBearCross = kdCrossDown(data.kdArr);
  const macdBearCross = macdCrossDown(data.macdArr);

  const flags = { rsiDrop, kdDrop, kdBearCross, macdBearCross };
  const triggeredCount = Object.values(flags).filter(Boolean).length;

  return { totalFactor: Object.keys(flags).length, triggeredCount, ...flags };
}

// 過熱指標
function computeOverheatState(data, bias240, strategy) {
  const th = strategy.threshold;
  const b = Number.isFinite(bias240) ? bias240 : null;

  const last = lastKD(data.kdArr);
  const kdD = last?.d ?? null;

  const factors = {
    rsiHigh: Number.isFinite(data.RSI) && data.RSI > th.rsiOverheatLevel,
    kdHigh: Number.isFinite(kdD) && kdD > th.dOverheatLevel,
    biasHigh: Number.isFinite(b) && b > th.bias240OverheatLevel,
  };

  const factorCount = Object.keys(factors).length;
  const highCount = Object.values(factors).filter(Boolean).length;

  return {
    isOverheat: highCount >= th.overheatCount,
    factorCount,
    highCount,
    coolCount: factorCount - highCount,
    factors,
    bias240: b,
  };
}

function computeSellSignals(data, strategy) {
  const sell = strategy.sell;
  const overbought = sell.rsi.overbought || 75;
  const overboughtK = sell.kd.overboughtK || 80;

  const last = lastKD(data.kdArr);
  const lastK = last?.k ?? null;
  const lastD = last?.d ?? null;

  // ✅ 狀態（state）：是否處於超買區
  const rsiStateOverbought =
    Number.isFinite(data.RSI) && data.RSI >= overbought;
  const kdStateOverbought = Number.isFinite(lastD) && lastD >= overboughtK;

  // 1) RSI：高於超買線並回落
  const rsiSell = fellBelowAfterAbove(data.rsiArr, overbought, 10, {
    requireCrossToday: true,
  });

  // 2) MACD：快線下穿慢線 + 柱狀圖轉負
  const macdSell = (() => {
    const macdMinusSignal = data.macdArr.map((x) => x.MACD - x.signal);
    const crossDown = fellBelowAfterAbove(macdMinusSignal, 0, 10, {
      requireCrossToday: true,
    });
    return crossDown;
  })();

  // 3) KD：高檔死叉 OR %D 跌回門檻下方
  const kdSell = (() => {
    const crossDownKD = kdCrossDown(data.kdArr);
    const inOverboughtNow =
      Number.isFinite(lastK) &&
      Number.isFinite(lastD) &&
      Math.min(lastK, lastD) >= overboughtK;

    const dArr = kdSeries(data.kdArr, (x) => x.d);
    const dropBelow80 = fellBelowAfterAbove(dArr, overboughtK, 10, {
      requireCrossToday: true,
    });

    return (crossDownKD && inOverboughtNow) || dropBelow80;
  })();

  const flags = { rsiSell, macdSell, kdSell };
  const signalCount = Object.values(flags).filter(Boolean).length;

  const stateFlags = { rsiStateOverbought, kdStateOverbought };
  const stateCount = Object.values(stateFlags).filter(Boolean).length;

  return {
    flags,
    signalCount,
    total: 3,
    stateFlags,
    stateCount,
  };
}

// 取得目標槓桿比例
function getTargetLeverageByScore(score, strategy) {
  const rules = Array.isArray(strategy?.allocation) ? strategy.allocation : [];

  // 從高分到低分找到第一個符合的規則
  const matchedRule = rules
    .filter((r) => r.minScore !== -99) // 排除底倉
    .sort((a, b) => b.minScore - a.minScore)
    .find((r) => score >= r.minScore);

  if (matchedRule) {
    return {
      leverage: matchedRule.leverage,
      cash: matchedRule.cash,
      comment: matchedRule.comment,
      minScore: matchedRule.minScore,
    };
  }

  // 找不到就回傳底倉
  const baseRule = rules.find((r) => r.minScore === -99);
  return {
    leverage: baseRule?.leverage || 0.15,
    cash: baseRule?.cash || 0.85,
    comment: baseRule?.comment || "底倉",
    minScore: -99,
  };
}

// 計算預備金狀態
function getReserveStatus(ctx, strategy) {
  const tiers = strategy?.reserve?.tiers || [];

  // 找到當前資產對應的預備金比例
  let targetRatio = 0.1; // 預設 10%
  for (const tier of tiers) {
    if (ctx.netAsset <= tier.maxAsset) {
      targetRatio = tier.ratio;
      break;
    }
  }

  const targetReserve = ctx.netAsset * targetRatio;
  const currentReserve = ctx.reserveCash || 0; // 假設 ctx 有提供
  const achievementRate =
    targetReserve > 0 ? (currentReserve / targetReserve) * 100 : 0;

  return {
    targetReserve,
    currentReserve,
    achievementRate,
    isInsufficient: achievementRate < 80, // 低於 80% 算不足
  };
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
        `但處於冷卻期，請勿重複加碼`,
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

// 取得極端恐慌買入條件
function getExtremeDropThreshold(strategy) {
  const rules = Array.isArray(strategy?.buy?.dropScoreRules)
    ? strategy.buy.dropScoreRules.toSorted((a, b) => b.minDrop - a.minDrop)
    : [];

  const rank = strategy?.buy?.panic?.minDropRank ?? 2;

  if (rules.length < rank) {
    return rules[0]?.minDrop ?? 30;
  }

  return rules[rank - 1]?.minDrop ?? 30;
}

function getPostSellAllocation(strategy) {
  const rules = Array.isArray(strategy?.allocation) ? strategy.allocation : [];
  const n = Number(strategy?.sell?.postAllocationIndexFromEnd ?? 2);

  if (rules.length < n) {
    throw new Error(
      `strategy.allocation 長度不足：len=${rules.length}, 但 postAllocationIndexFromEnd=${n}`,
    );
  }

  const rule = rules.at(-n);
  if (!rule) throw new Error("取得 post allocation 失敗");
  return rule;
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
 * 檢查是否在 Cooldown 期間
 * @param {Date} lastBuyDate - 最後買入日期
 * @param {number} cooldownDays - 冷卻天數
 * @returns {Object} { inCooldown, daysLeft, lastBuyDate }
 */
function checkCooldown(lastBuyDate, cooldownDays) {
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
  const daysSinceLastBuy = Math.floor(
    (today - lastBuy) / (1000 * 60 * 60 * 24),
  );
  const daysLeft = Math.max(0, cooldownDays - daysSinceLastBuy);

  return {
    inCooldown: daysLeft > 0,
    daysLeft,
    lastBuyDate: lastBuy.toISOString().split("T")[0],
    daysSinceLastBuy,
    message:
      daysLeft > 0
        ? `冷卻期剩餘 ${daysLeft} 天（最後買入：${lastBuy.toISOString().split("T")[0]}）`
        : `冷卻期已過（最後買入：${lastBuy.toISOString().split("T")[0]}）`,
  };
}

export function evaluateInvestmentSignal(data, strategy) {
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
  const lastBuyDate = data.portfolio?.date || null; // 從 portfolio 讀取
  const cooldownStatus = checkCooldown(lastBuyDate, cooldownDays);

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
  return evaluateInvestmentSignal(data, strategy);
}
