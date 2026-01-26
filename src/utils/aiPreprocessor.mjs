/**
 * AI 數據預處理工具
 */

const n2 = (v) => {
  const x = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(x) ? Math.round(x * 100) / 100 : null;
};

const bool = (v) => (v === true ? true : v === false ? false : null);

const cleanUndef = (obj) => {
  if (obj == null) return obj;
  if (Array.isArray(obj)) return obj.map(cleanUndef).filter(v => v !== undefined);
  if (typeof obj !== "object") return obj;

  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const vv = cleanUndef(v);
    if (vv !== undefined) out[k] = vv;
  }
  return out;
};

const pct = (v) => (Number.isFinite(Number(v)) ? `${n2(v)}%` : "N/A");
const num = (v) => (Number.isFinite(Number(v)) ? String(n2(v)) : "N/A");

function minifyStrategyForExplain(strategy) {
  if (!strategy) return null;

  const buy = strategy.buy || {};
  const sell = strategy.sell || {};
  const th = strategy.threshold || {};

  return cleanUndef({
    buy: {
      minDrop: n2(buy.minDropPercentToConsider),
      minScore: n2(buy.minWeightScoreToBuy),
    },
    sell: {
      minUp: n2(sell.minUpPercentToSell),
      minSignals: n2(sell.minSignalCountToSell),
    },
    threshold: {
      reversalNeed: n2(th.reversalTriggerCount),
      overheatNeed: n2(th.overheatCount),
      mmDanger: n2(th.mmDanger),
      z2Target: n2(th.z2TargetRatio),     // 0.4
      z2High: n2(th.z2RatioHigh),         // 42（你目前是 percent）
      vixLow: n2(th.vixLowComplacency),
      vixHigh: n2(th.vixHighFear),
      rsiOverheat: n2(th.rsiOverheatLevel),
      kOverheat: n2(th.kOverheatLevel),
      biasOverheat: n2(th.bias240OverheatLevel),
      rsiReversal: n2(th.rsiReversalLevel),
      kReversal: n2(th.kReversalLevel),
    },
  });
}

export function minifyExplainInput(marketData, portfolio = {}, vixData = null) {
  const st = minifyStrategyForExplain(marketData?.strategy);

  const hitToZh = (k) => ({
    rsiHigh: "RSI 高檔",
    kdHigh: "KD 高檔",
    biasHigh: "年線乖離過高",
    rsiStateOverbought: "RSI 偏熱",
    kdStateOverbought: "KD 偏熱",
    rsiSell: "RSI 賣出",
    macdSell: "MACD 賣出",
    kdSell: "KD 賣出",
    kdBearCross: "KD 死叉",
    macdBearCross: "MACD 死叉",
    rsiDrop: "RSI 轉弱",
    kdDrop: "KD 轉弱",
  }[k] || k);

  const truthyKeys = (obj) =>
    obj && typeof obj === "object"
      ? Object.keys(obj).filter(k => obj[k] === true)
      : [];

  // ===== 進場判定（直接給 LLM 用）=====
  const actualDrop = n2(marketData?.priceDropPercent);
  const needDrop = n2(st?.buy?.minDrop);
  const dropOk =
    actualDrop != null && needDrop != null ? actualDrop >= needDrop : null;

  const actualScore = n2(marketData?.weightScore ?? marketData?.entry?.weightScore);
  const needScore = n2(st?.buy?.minScore);
  const scoreOk =
    actualScore != null && needScore != null ? actualScore >= needScore : null;

  const dropGap =
    actualDrop != null && needDrop != null ? n2(needDrop - actualDrop) : null;
  const scoreGap =
    actualScore != null && needScore != null ? n2(needScore - actualScore) : null;

  // ===== 過熱 / 轉弱 / 賣出 =====
  const overheat = marketData?.overheat || {};
  const reversal = marketData?.reversal || {};
  const sellSignals = marketData?.sellSignals || {};

  const overheatHits = truthyKeys(overheat.factors).map(hitToZh);
  const sellStateHits = truthyKeys(sellSignals.stateFlags).map(hitToZh);
  const sellFlagHits = truthyKeys(sellSignals.flags).map(hitToZh);

  // ===== 帳戶安全 / 部位 =====
  const z2Ratio = n2(marketData?.z2Ratio); // 你目前是 percent 數值（8.86）
  const z2TargetPct = st?.threshold?.z2Target != null ? n2(st.threshold.z2Target * 100) : null; // 0.4 => 40
  const z2HighPct = n2(st?.threshold?.z2High); // 42
  const z2GapToTarget = (z2Ratio != null && z2TargetPct != null) ? n2(z2TargetPct - z2Ratio) : null;

  // ===== VIX =====
  const vixVal = n2(vixData?.value);
  const vixLow = n2(st?.threshold?.vixLow);
  const vixHigh = n2(st?.threshold?.vixHigh);

  return cleanUndef({
    meta: {
      dateText: marketData?.dateText ?? null, // 你若有就塞，沒有也行
      symbol: marketData?.symbol ?? "00675L",
    },

    conclusion: {
      marketStatus: marketData?.marketStatus ?? null,
      target: marketData?.target ?? null,
      suggestionShort: marketData?.targetSuggestionShort ?? null,
      suggestion: marketData?.targetSuggestion ?? null,
      reasonOneLine: marketData?.suggestion ?? null,
    },

    entryCheck: {
      drop: {
        actual: actualDrop,
        need: needDrop,
        ok: dropOk,
        gap: dropGap, // 還差多少才達標（<=0 表示已達）
        text: `${pct(actualDrop)} / ${pct(needDrop)} ${dropOk ? "✅" : "❌"}`,
      },
      score: {
        actual: actualScore,
        need: needScore,
        ok: scoreOk,
        gap: scoreGap,
        text: `${num(actualScore)} / ${num(needScore)} ${scoreOk ? "✅" : "❌"}`,
      },
      weightDetails: [
        marketData?.weightDetails?.dropInfo,
        marketData?.weightDetails?.rsiInfo,
        marketData?.weightDetails?.macdInfo,
        marketData?.weightDetails?.kdInfo,
      ].filter(Boolean),
    },

    riskWatch: {
      historicalLevel: marketData?.historicalLevel ?? null,
      vix: vixVal != null ? {
        value: vixVal,
        thresholdText: `低<${vixLow ?? "N/A"} / 高>${vixHigh ?? "N/A"}`,
      } : null,

      overheat: {
        isOverheat: bool(overheat?.isOverheat),
        hitCount: n2(overheat?.highCount),
        factorCount: n2(overheat?.factorCount),
        hits: overheatHits,
      },

      reversal: {
        triggered: n2(reversal?.triggeredCount),
        total: n2(reversal?.totalFactor),
        need: n2(st?.threshold?.reversalNeed),
        hits: [
          reversal?.rsiDrop ? "RSI 轉弱" : null,
          reversal?.kdDrop ? "KD 轉弱" : null,
          reversal?.kdBearCross ? "KD 死叉" : null,
          reversal?.macdBearCross ? "MACD 死叉" : null,
        ].filter(Boolean),
      },

      sell: {
        signalCount: n2(sellSignals?.signalCount),
        needSignals: n2(st?.sell?.minSignals),
        upActual: n2(marketData?.priceUpPercent),
        upNeed: n2(st?.sell?.minUp),
        stateHits: sellStateHits,
        flagHits: sellFlagHits,
      },
    },

    account: {
      netAsset: n2(marketData?.netAsset),
      totalLoan: n2(marketData?.totalLoan),
      actualLeverage: n2(marketData?.actualLeverage),
      maintenanceMargin: n2(marketData?.maintenanceMargin),
      z2RatioPct: z2Ratio,
      z2TargetPct,
      z2HighPct,
      z2GapToTarget,
      cash: n2(portfolio?.cash),
      holdings: {
        qty0050: portfolio?.qty0050 ?? null,
        qtyZ2: portfolio?.qtyZ2 ?? null,
      },
    },

    // 讓 LLM 不用再去猜門檻
    thresholds: st,

    // 你最後那句紀律提醒直接塞這裡
    disciplineReminder: marketData?.disciplineReminder ?? null,
  });
}