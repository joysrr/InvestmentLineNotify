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
    kdHigh: Number.isFinite(kdD) && kdD > th.dOverheatLevel, // 用%D較穩
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
  const overbought = sell.rsi.overbought; // 70
  const overboughtK = sell.kd.overboughtK; // 80

  const last = lastKD(data.kdArr);
  const lastK = last?.k ?? null;
  const lastD = last?.d ?? null;

  // ✅ 狀態（state）：是否處於超買區
  const rsiStateOverbought =
    Number.isFinite(data.RSI) && data.RSI >= overbought;
  const kdStateOverbought = Number.isFinite(lastD) && lastD >= overboughtK;

  // 1) RSI：高於 70 並回落（prev>=70, curr<70）
  const rsiSell = fellBelowAfterAbove(data.rsiArr, overbought, 10, {
    requireCrossToday: false,
  });

  // 2) MACD：快線下穿慢線 + 柱狀圖轉負
  const macdSell = (() => {
    const macdMinusSignal = data.macdArr.map((x) => x.MACD - x.signal);

    const crossDown = fellBelowAfterAbove(macdMinusSignal, 0, 10, {
      requireCrossToday: false,
    });
    // 0 是門檻：histogram 轉負的那條線 [web:237][web:243]
    return crossDown;
  })();

  // 3) KD：高檔死叉（當下在高檔）, %D 跌回80下
  const kdSell = (() => {
    const crossDownKD = kdCrossDown(data.kdArr); // K 下穿 D
    const inOverboughtNow =
      Number.isFinite(lastK) &&
      Number.isFinite(lastD) &&
      Math.min(lastK, lastD) >= overboughtK;

    const dArr = kdSeries(data.kdArr, (x) => x.d);
    const dropBelow80 = fellBelowAfterAbove(dArr, overboughtK, 10, {
      requireCrossToday: false,
    }); // 用%D跌回80下方（更穩）[web:45]

    // 高檔死叉（當下在高檔） OR B) %D 跌回80下方
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

// 評估狀況並取得建議操作
// 追繳/佔比/禁撥 > 轉弱 > 轉多
function buildDecision(ctx, strategy) {
  const th = strategy.threshold;

  const {
    // 風控/資產
    maintenanceMargin, // %
    z2Ratio, // %
    netAsset,
    currentZ2Value,

    // 計算結果
    entry, // { weightScore, weightDetails }
    overheat, // { isOverheat, factorCount, highCount, coolCount, factors, bias240? }
    reversal, // { totalFactor, triggeredCount, rsiDrop, kdDrop, kdBearCross, macdBearCross }
    sellSignals, // { flags, signalCount, total }
  } = ctx;

  // 1) 追繳風險：一票否決（風控優先）[web:896]
  if (maintenanceMargin < th.mmDanger) {
    return {
      marketStatus: "⚠️【追繳風險】",
      target: "🧯 風控優先",
      targetSuggestionShort: "停止撥款；優先補保證金/降槓桿",
      targetSuggestion: "停止撥款與加碼；準備補錢或降低槓桿",
      suggestion: `⚠️ 維持率 ${maintenanceMargin.toFixed(0)}% 過低：停止加碼，優先補保證金/降槓桿`,
    };
  }

  // 2) 再平衡：00675L 佔比過高
  if (z2Ratio > th.z2RatioHigh) {
    const targetZ2Value = netAsset * th.z2TargetRatio;
    const sellAmount = Math.max(0, currentZ2Value - targetZ2Value);

    // 需滿足最小操作金額
    if (sellAmount > th.minActionableAmount) {
      return {
        marketStatus: "⚖️【再平衡】",
        target: "🔻 降槓桿",
        targetSuggestionShort: "賣00675L還款；回到目標佔比",
        targetSuggestion: "賣出部分00675L並還款，恢復到目標佔比",
        suggestion: `⚖️ 00675L佔比 ${z2Ratio.toFixed(1)}% 過高：建議賣出約 ${sellAmount.toLocaleString("zh-TW", { maximumFractionDigits: 0 })} 元並還款`,
      };
    }
  }

  if (
    ctx.priceUpPercent >= strategy.sell.minUpPercentToSell &&
    sellSignals.signalCount >= strategy.sell.minSignalCountToSell
  ) {
    return buildSellBackToAllocation(ctx, strategy);
  }

  // 🔥 3) 極端恐慌買入：史詩級機會（優先於轉弱/過熱）
  if (Number.isFinite(ctx.vix) && Number(ctx.vix) > 0) {
    // 🔥 3) 極端恐慌買入（配置驅動版本）
    const panicCfg = strategy.buy.panic ?? {};

    // 從配置中計算門檻
    const extremeDropThreshold = getExtremeDropThreshold(strategy);
    const rsiOversold = strategy.buy.rsi.oversold ?? 40;
    const rsiDivider = panicCfg.rsiDivider ?? 1.6;
    const extremeRsiThreshold = rsiOversold / rsiDivider; // 40 / 1.6 = 25

    const extremeDrop = ctx.priceDropPercent >= extremeDropThreshold;
    const rsiCrash = ctx.rsi < extremeRsiThreshold;
    const vixPanic = ctx.vix >= th.vixPanic;
    const vixExtreme = ctx.vix >= th.vixExtreme;

    // 條件：跌幅達標 AND RSI 極度超賣 AND VIX 恐慌
    if (extremeDrop && rsiCrash && vixPanic) {
      // 根據 VIX 級別決定建議槓桿
      let suggestedLeverage = panicCfg.suggestedLeverage ?? 0.3; // 預設 30%
      let intensityLevel = "🩸 恐慌";

      if (vixExtreme) {
        // VIX 極端：建議更高槓桿
        suggestedLeverage = Math.min(0.5, suggestedLeverage * 1.67); // 最高 50%
        intensityLevel = "🩸🩸 極端恐慌";
      }

      const panicDetails = [
        `跌幅 ${ctx.priceDropPercent.toFixed(1)}% (>= ${extremeDropThreshold.toFixed(0)}%)`,
        `RSI ${ctx.rsi.toFixed(0)} (< ${extremeRsiThreshold.toFixed(0)})`,
        `VIX ${ctx.vix.toFixed(1) ?? "N/A"} (>= ${th.vixPanic})`,
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
          `⚠️ 風險提示：僅在維持率充足時執行，分批買入`,
        panicDetails,
        suggestedLeverage,
        thresholds: {
          // 🔥 Debug 用：顯示實際使用的門檻
          extremeDropThreshold,
          extremeRsiThreshold,
          vixPanicThreshold: th.vixPanic,
        },
      };
    }
  }

  // 4) 過熱：狀態（不等於反轉，但你的策略是禁撥款）
  if (overheat.isOverheat) {
    const f = overheat.factors; // { rsiHigh, kdHigh, biasHigh }

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

  // 5) 轉弱：事件（不過熱但出現轉弱訊號 → 降速/停止加碼）
  // 你可自行定義「轉弱要幾個觸發才算明顯」
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

  // 偏熱但尚未過熱（例如只命中 bias240）
  if (!overheat.isOverheat && overheat.highCount > 0 && (!dropOk || !scoreOk)) {
    return {
      marketStatus: "🌡️ 【偏熱/觀察】",
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

  // 5.5) 未達進場：中性觀察
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

  // 6) 正常情境：用轉多分數決定加碼級別（你原本的分段）
  const w = entry.weightScore;

  if (w >= th.wAggressive) {
    return {
      marketStatus: "🚀【轉多/可進攻】",
      target: "🔥 最積極型",
      targetSuggestionShort: "00675L 大額加碼（60%）",
      targetSuggestion: "建議增貸至 60% 加碼",
      suggestion: `🔥 最積極型（${w}分）：建議增貸至 60% 加碼`,
    };
  }

  if (w >= th.wActive) {
    return {
      marketStatus: "📈【轉多/可加碼】",
      target: "📈 積極型",
      targetSuggestionShort: "00675L 加碼（50%）",
      targetSuggestion: "建議增貸至 50% 加碼",
      suggestion: `📈 積極型（${w}分）：建議增貸至 50% 加碼`,
    };
  }

  return {
    marketStatus: "🐢【常態布局】",
    target: "🛡️ 定期定額",
    targetSuggestionShort: "執行標準DCA（40%）",
    targetSuggestion: "無特殊訊號，執行標準配置：買入 0050 後質押買入 00675L",
    suggestion: `🛡️ 常態布局（${w}分）：當前無過熱或風控風險，請執行標準資金注入`,
  };
}

// 取得極端恐慌買入條件
function getExtremeDropThreshold(strategy) {
  const rules = Array.isArray(strategy?.buy?.dropScoreRules)
    ? strategy.buy.dropScoreRules.toSorted((a, b) => b.minDrop - a.minDrop)
    : [];

  const rank = strategy?.buy?.panic?.minDropRank ?? 2;

  // 取倒數第 N 高級別（例如 rank=2 → 取「恐慌 30%」而非「毀滅 40%」）
  if (rules.length < rank) {
    return rules[0]?.minDrop ?? 30; // fallback
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

  const rule = rules.at(-n); // -2 = 倒數第二條 [web:902]
  if (!rule) throw new Error("取得 post allocation 失敗");
  return rule; // { minScore, leverage, cash }
}

function buildSellBackToAllocation(ctx, strategy) {
  const post = getPostSellAllocation(strategy);
  const targetLeverage = post.leverage; // 0.8
  const targetZ2Value = ctx.netAsset * targetLeverage;

  const sellAmount = Math.max(0, ctx.currentZ2Value - targetZ2Value);

  return {
    marketStatus: "🎯【停利/降槓桿】",
    target: "💸 賣出/還款",
    targetSuggestionShort: `停利賣00675L；降到 ${(post.leverage * 100).toFixed(0)}%`,
    targetSuggestion: `賣出部分00675L並還款，恢復槓桿 ${(targetLeverage * 100).toFixed(0)}% / 現金 ${(post.cash * 100).toFixed(0)}%`,
    suggestion:
      `🎯 觸發賣出條件：建議賣出約 ${sellAmount.toLocaleString("zh-TW", { maximumFractionDigits: 0 })} 元並還款，` +
      `回到 ${(targetLeverage * 100).toFixed(0)} / ${(post.cash * 100).toFixed(0)}`,
    postAllocation: post,
    sellAmount,
  };
}

function evaluateInvestmentSignal(data, strategy) {
  // 基於基準價現價上漲幅度
  const priceChangePercent =
    ((data.currentPrice - data.basePrice) / data.basePrice) * 100;
  const priceUpPercent = Math.max(0, priceChangePercent);
  const priceDropPercent = Math.max(0, -priceChangePercent); // 永遠 >= 0

  // 維持率與資產佔比
  const current0050Value = data.portfolio.qty0050 * data.price0050; // 0050 市值
  const currentZ2Value = data.portfolio.qtyZ2 * data.currentPrice; // 00675L 市值

  // 維持率 = 擔保品市值 / 總借款
  // 注意：若無借款 (totalLoan=0)，維持率設為無限大
  // 維持率計算 (確保使用正確的 totalLoan)
  const maintenanceMargin =
    data.portfolio.totalLoan > 0
      ? (current0050Value / data.portfolio.totalLoan) * 100
      : 999;

  // 00675L 佔比 = 00675L市值 / (0050市值 + 00675L市值 + 現金 - 總借款)
  const netAsset =
    current0050Value +
    currentZ2Value +
    data.portfolio.cash -
    data.portfolio.totalLoan;
  const z2Ratio = netAsset > 0 ? (currentZ2Value / netAsset) * 100 : 0;

  // 計算年線乖離率
  const ma240 =
    Number.isFinite(data.ma240) && data.ma240 > 0 ? data.ma240 : null;
  const bias240 = ma240 ? ((data.currentPrice - ma240) / ma240) * 100 : null;

  // 實際槓桿計算 (總資產 / 淨資產)
  const grossAsset = current0050Value + currentZ2Value + data.portfolio.cash;
  const actualLeverage = netAsset > 0 ? grossAsset / netAsset : 0;

  // 歷史位階分析 (基於年線乖離率)
  let historicalLevel = "⛅【中位階】";
  if (bias240 > 25) historicalLevel = "【極高位階/過熱】🥵";
  else if (bias240 > 15) historicalLevel = "【高位階/偏貴】🌡️";
  else if (bias240 < 0) historicalLevel = "【低位階/便宜】❄️";

  const ctx = {
    priceChangePercent,
    priceUpPercent,
    priceDropPercent,

    // 風控/資產
    maintenanceMargin, // %
    z2Ratio, // %
    netAsset,
    currentZ2Value,
    vix: data.VIX,
    rsi: data.RSI,

    // 計算結果
    entry: computeEntryScore(data, priceDropPercent, strategy), // { weightScore, weightDetails }
    overheat: computeOverheatState(data, bias240, strategy), // { isOverheat, factorCount, highCount, coolCount, factors, bias240? }
    reversal: computeReversalTriggers(data, strategy), // { totalFactor, triggeredCount, rsiDrop, kdDrop, kdBearCross, macdBearCross }
    sellSignals: computeSellSignals(data, strategy),
  };

  // 取得決策結果
  const decision = buildDecision(ctx, strategy);

  // 取得 MACD 訊號
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
  };
}

export async function getInvestmentSignalAsync(data) {
  const strategy = await fetchStrategyConfig();
  validateStrategyConfig(strategy);
  return evaluateInvestmentSignal(data, strategy);
}
