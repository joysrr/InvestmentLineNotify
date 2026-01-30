/**
 * AI 數據預處理工具
 */

const n2 = (v) => {
  const x = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(x) ? Math.round(x * 100) / 100 : null;
};

const cleanUndef = (obj) => {
  if (obj == null) return obj;
  if (Array.isArray(obj))
    return obj.map(cleanUndef).filter((v) => v !== undefined);
  if (typeof obj !== "object") return obj;

  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const vv = cleanUndef(v);
    if (vv !== undefined) out[k] = vv;
  }
  return out;
};

function minifyStrategyForExplain(strategy) {
  if (!strategy) return null;

  const buy = strategy.buy || {};
  const sell = strategy.sell || {};
  const th = strategy.threshold || {};
  const lev = strategy.leverage || {};

  return cleanUndef({
    // entryCheck 還需要
    buy: {
      minDrop: n2(buy.minDropPercentToConsider),
      minScore: n2(buy.minWeightScoreToBuy),
    },

    // riskWatch.sell 還需要
    sell: {
      minUp: n2(sell.minUpPercentToSell),
      minSignals: n2(sell.minSignalCountToSell),
    },

    // riskWatch.overheat/reversal/vix 還需要
    threshold: {
      overheatNeed: n2(th.overheatCount),
      reversalNeed: n2(th.reversalTriggerCount),
      vixLow: n2(th.vixLowComplacency),
      vixHigh: n2(th.vixHighFear),

      // account 區塊你仍在算 z2TargetPct/z2HighPct
      z2Target: n2(th.z2TargetRatio),
      z2High: n2(th.z2RatioHigh),

      // 目前雖然 prompt 沒直接用，但你說 guardrails 想保留就留
      mmDanger: n2(th.mmDanger),
    },

    // 讓你未來可以改成從 cleanData 讀目標槓桿（現在 prompt 還是用 strategy.leverage）
    leverage: {
      targetMultiplier: n2(lev.targetMultiplier),
    },
  });
}

export function minifyExplainInput(marketData, portfolio = {}, vixData = null) {
  const st = minifyStrategyForExplain(marketData?.strategy);

  const hitToZh = (k) =>
    ({
      // --- Overheat factors（狀態）---
      rsiHigh: "RSI 高檔",
      kdHigh: "KD(D) 高檔",
      biasHigh: "年線乖離過高",

      // --- Sell state flags（狀態）---
      rsiStateOverbought: "RSI 偏熱",
      kdStateOverbought: "KD(D) 偏熱",

      // --- Sell flags（事件）---
      rsiSell: "RSI 回落（賣出訊號）",
      macdSell: "MACD 轉弱（賣出訊號）",
      kdSell: "KD 高檔轉弱觸發（K↘D / D↘）",

      // --- Reversal triggers（事件/門檻）---
      kdBearCross: "KD 死叉（K↘D）",
      macdBearCross: "MACD 死叉",
      rsiDrop: "RSI 轉弱",
      kdDrop: "KD(min) 轉弱",
    })[k] || k;

  const truthyKeys = (obj) =>
    obj && typeof obj === "object"
      ? Object.keys(obj).filter((k) => obj[k] === true)
      : [];

  // ===== 進場判定（直接給 LLM 用）=====
  const actualDrop = n2(marketData?.priceDropPercent);
  const needDrop = n2(st?.buy?.minDrop);

  const actualScore = n2(
    marketData?.weightScore ?? marketData?.entry?.weightScore,
  );
  const needScore = n2(st?.buy?.minScore);

  // ===== 過熱 / 轉弱 / 賣出 =====
  const overheat = marketData?.overheat || {};
  const reversal = marketData?.reversal || {};
  const sellSignals = marketData?.sellSignals || {};

  const overheatHits = truthyKeys(overheat.factors).map(hitToZh);
  const sellStateHits = truthyKeys(sellSignals.stateFlags).map(hitToZh);
  const sellFlagHits = truthyKeys(sellSignals.flags).map(hitToZh);

  // ===== 帳戶安全 / 部位 =====
  const z2Ratio = n2(marketData?.z2Ratio); // 你目前是 percent 數值（8.86）
  const z2TargetPct =
    st?.threshold?.z2Target != null ? n2(st.threshold.z2Target * 100) : null; // 0.4 => 40
  const z2HighPct = n2(st?.threshold?.z2High); // 42
  const z2GapToTarget =
    z2Ratio != null && z2TargetPct != null ? n2(z2TargetPct - z2Ratio) : null;

  // ===== VIX =====
  const vixVal = n2(vixData?.value);
  const vixLow = n2(st?.threshold?.vixLow);
  const vixHigh = n2(st?.threshold?.vixHigh);

  const gapLabel = (gap, unit = "") => {
    if (gap == null) return null;
    if (gap <= 0) return null;

    const u = String(unit).trim().toLowerCase();

    // 1) unit 分類：不同量綱講法不同
    const kind = u.includes("%")
      ? "pct"
      : u.includes("分") || u.includes("pt") || u.includes("點")
        ? "score"
        : u.includes("次") || u.includes("個") || u.includes("筆")
          ? "count"
          : u.includes("萬") || u.includes("元") || u.includes("$")
            ? "money"
            : "generic";

    // 2) 分級門檻（只用於判斷，不出現在文字裡）
    const levels = {
      pct: { near: 2, mid: 5 },
      score: { near: 1, mid: 3 },
      count: { near: 1, mid: 2 },
      money: { near: 0.5, mid: 2 },
      generic: { near: 2, mid: 5 },
    }[kind];

    // 3) 對應語氣模板（讓 AI 不會一直用「差距明顯」）
    const tone = {
      pct: {
        near: "接近門檻（幅度差一點）",
        mid: "仍需一段幅度",
        far: "離門檻還有距離",
      },
      score: {
        near: "接近門檻（分數差一點）",
        mid: "仍需累積條件",
        far: "分數門檻仍偏遠",
      },
      count: {
        near: "接近門檻（訊號差一點）",
        mid: "仍需訊號累積",
        far: "訊號累積仍不足",
      },
      money: {
        near: "接近目標（差一點）",
        mid: "仍需一段距離",
        far: "距離目標仍明顯",
      },
      generic: {
        near: "接近門檻（差一點）",
        mid: "仍需一段距離",
        far: "離門檻還有距離",
      },
    }[kind];

    if (gap <= levels.near) return tone.near;
    if (gap <= levels.mid) return tone.mid;
    return tone.far;
  };

  // 統一的門檻狀態：
  // - direction="up"   ：actual >= threshold 代表 breached
  // - direction="down" ：actual <= threshold 代表 breached
  const mkThresholdStatus = (actual, threshold, unit, direction, opt = {}) => {
    const a = actual == null ? null : actual;
    const t = threshold == null ? null : threshold;

    const {
      breachedTextUp = "已越過門檻（需留意）",
      breachedTextDown = "已跌破門檻（需留意）",
    } = opt;

    if (a == null || t == null) {
      return {
        actual: a,
        threshold: t,
        breached: null,
        distance: null,
        distanceLabel: null,
        direction,
      };
    }

    const rawNum = direction === "up" ? t - a : a - t;
    const raw = n2(rawNum);
    if (raw == null) {
      return {
        actual: a,
        threshold: t,
        breached: null,
        distance: null,
        distanceLabel: null,
        direction,
      };
    }

    const breached = raw <= 0;
    const distance = breached ? 0 : raw;
    const breachedText = direction === "up" ? breachedTextUp : breachedTextDown;

    return {
      actual: a,
      threshold: t,
      breached,
      distance,
      distanceLabel: breached ? breachedText : gapLabel(distance, unit),
      direction,
    };
  };

  // ===== riskWatch 用到的數值（先 n2 避免 NaN/字串干擾）=====
  const overheatNeed = n2(st?.threshold?.overheatNeed);
  const reversalNeed = n2(st?.threshold?.reversalNeed);
  const sellNeedSignals = n2(st?.sell?.minSignals);
  const sellUpNeed = n2(st?.sell?.minUp);

  const overheatHitCount = n2(overheat?.highCount);
  const reversalTriggered = n2(reversal?.triggeredCount);
  const sellSignalCount = n2(sellSignals?.signalCount);
  const sellUpActual = n2(marketData?.priceUpPercent);

  // VIX
  const vixValue = vixVal; // 你前面已 n2
  const vixLowTh = vixLow;
  const vixHighTh = vixHigh;

  // 各項門檻狀態（統一 schema）
  const overheatThreshold = mkThresholdStatus(
    overheatHitCount,
    overheatNeed,
    "個",
    "up",
  );
  const reversalThreshold = mkThresholdStatus(
    reversalTriggered,
    reversalNeed,
    "個",
    "up",
  );

  const sellSignalsThreshold = mkThresholdStatus(
    sellSignalCount,
    sellNeedSignals,
    "次",
    "up",
  );

  const sellUpThreshold = mkThresholdStatus(
    sellUpActual,
    sellUpNeed,
    "%",
    "up",
  );

  // VIX 有兩條線：低檔（跌破）與高檔（越過）
  const vixLowZone = mkThresholdStatus(vixValue, vixLowTh, "點", "down", {
    breachedTextDown: "已落入低波動區（偏安逸）",
  });
  const vixHighZone = mkThresholdStatus(vixValue, vixHighTh, "點", "up", {
    breachedTextUp: "已落入高波動區（偏恐慌）",
  });

  const dropStatus = mkThresholdStatus(actualDrop, needDrop, "%", "up", {
    breachedTextUp: "已達標",
  });
  const scoreStatus = mkThresholdStatus(actualScore, needScore, "分", "up", {
    breachedTextUp: "已達標",
  });

  // 可選：把 weightDetails 當 entryCheck 的 hits（你原本就是給 AI 用）
  const entryHits = [
    marketData?.weightDetails?.dropInfo,
    marketData?.weightDetails?.rsiInfo,
    marketData?.weightDetails?.macdInfo,
    marketData?.weightDetails?.kdInfo,
  ].filter(Boolean);

  const uniq = (arr) => [...new Set(arr)];
  const sellHits = uniq([...sellStateHits, ...sellFlagHits].filter(Boolean));

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
      hits: entryHits,

      drop: {
        thresholdStatus: dropStatus,
        // 可選：保留一個短字串讓 AI 更好引用，但不要放 text（避免它照抄）
        // summary: dropStatus?.breached === true ? "跌幅條件已滿足" : "跌幅條件未滿足",
      },

      score: {
        thresholdStatus: scoreStatus,
        // summary: scoreStatus?.breached === true ? "評分條件已滿足" : "評分條件未滿足",
      },
    },

    riskWatch: {
      historicalLevel: marketData?.historicalLevel ?? null,

      vix:
        vixValue != null
          ? {
              thresholdText: `低<${vixLowTh ?? "N/A"} / 高>${vixHighTh ?? "N/A"}`,
              lowZone: vixLowZone, // {actual, threshold, breached, distance, distanceLabel, direction:"down"}
              highZone: vixHighZone, // {actual, threshold, breached, distance, distanceLabel, direction:"up"}
            }
          : null,

      overheat: {
        hits: overheatHits,
        thresholdStatus: overheatThreshold, // {actual: hitCount, threshold: need, breached, distance, distanceLabel, direction:"up"}
      },

      reversal: {
        hits: [
          reversal?.rsiDrop ? hitToZh("rsiDrop") : null,
          reversal?.kdDrop ? hitToZh("kdDrop") : null,
          reversal?.kdBearCross ? hitToZh("kdBearCross") : null,
          reversal?.macdBearCross ? hitToZh("macdBearCross") : null,
        ].filter(Boolean),
        thresholdStatus: reversalThreshold, // {actual: triggered, threshold: need, breached, distance, distanceLabel, direction:"up"}
      },

      sell: {
        hits: sellHits,
        signals: sellSignalsThreshold,
        up: sellUpThreshold,
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
