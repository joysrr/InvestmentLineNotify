/**
 * 由後端實際回傳的 status / reports / socialSentiment 建構輕量 Insights ViewModel。
 * 保留所有既有雷達指標、融資明細、多空積分、事件與社群情緒欄位，
 * 並針對社群情緒的實際欄位（score, scoreLabel, trend, ma3, ma7, delta,
 * sampleCount, pttItems, bskyItems, divergenceStatus, divergenceDetail, signals, targets, date, updatedAt）
 * 建構清晰的指標卡片、均線／背離狀態與來源明細。
 */

function toFiniteNumber(val) {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export function extractLatestReport(reportsPayload) {
  if (!reportsPayload) return null;
  const list = Array.isArray(reportsPayload)
    ? reportsPayload
    : Array.isArray(reportsPayload?.data)
      ? reportsPayload.data
      : reportsPayload?.report && typeof reportsPayload.report === "object"
        ? [reportsPayload.report]
        : [];
  if (!list.length) return null;
  return [...list].sort((a, b) =>
    String(b?.date || "").localeCompare(String(a?.date || "")),
  )[0];
}

function classifyVix(vix, market = "us") {
  const n = toFiniteNumber(vix);
  if (n === null) return { status: "neutral", label: "—" };
  if (market === "tw") {
    if (n >= 30) return { status: "danger", label: "極度恐慌" };
    if (n >= 22) return { status: "warn", label: "警戒偏高" };
    if (n <= 14) return { status: "ok", label: "低波動" };
    return { status: "neutral", label: "常態" };
  }
  if (n >= 30) return { status: "danger", label: "恐慌飆升" };
  if (n >= 20) return { status: "warn", label: "波動升溫" };
  if (n <= 13) return { status: "ok", label: "平穩偏多" };
  return { status: "neutral", label: "中性" };
}

function classifySpx(spxRaw) {
  if (spxRaw === null || spxRaw === undefined || spxRaw === "") {
    return { text: "—", status: "neutral", label: "無數據" };
  }
  const str = String(spxRaw);
  const n = parseFloat(str);
  if (!Number.isFinite(n)) {
    return { text: str, status: "neutral", label: "無數據" };
  }
  const text = n > 0 && !str.startsWith("+") ? `+${str}` : str;
  if (n > 0) return { text, status: "ok", label: "上漲" };
  if (n < 0) return { text, status: "warn", label: "下跌" };
  return { text, status: "neutral", label: "持平" };
}

function classifyCnn(score, rating) {
  const n = toFiniteNumber(score);
  const label = rating || "—";
  if (n === null) return { status: "neutral", label };
  if (n <= 25) return { status: "ok", label: rating || "極度恐懼" };
  if (n <= 45) return { status: "ok", label: rating || "恐懼" };
  if (n >= 75) return { status: "danger", label: rating || "極度貪婪" };
  if (n >= 55) return { status: "warn", label: rating || "貪婪" };
  return { status: "neutral", label: rating || "中性" };
}

function classifyMarginRatio(ratio) {
  const n = toFiniteNumber(ratio);
  if (n === null) return { status: "neutral", label: "—" };
  if (n < 130) return { status: "danger", label: "追繳警戒" };
  if (n < 145) return { status: "warn", label: "偏低留意" };
  if (n > 170) return { status: "warn", label: "過熱偏高" };
  return { status: "ok", label: "健康區間" };
}

function classifyPe(pe) {
  const n = toFiniteNumber(pe);
  if (n === null) return { status: "neutral", label: "—" };
  if (n < 12) return { status: "ok", label: "極度低估" };
  if (n < 15) return { status: "ok", label: "低估" };
  if (n < 20) return { status: "neutral", label: "合理" };
  if (n < 25) return { status: "warn", label: "偏高" };
  return { status: "danger", label: "高估" };
}

function classifyPb(pb) {
  const n = toFiniteNumber(pb);
  if (n === null) return { status: "neutral", label: "—" };
  if (n < 1.5) return { status: "ok", label: "極度低估" };
  if (n < 2.0) return { status: "ok", label: "低估" };
  if (n < 3.0) return { status: "neutral", label: "合理" };
  if (n < 4.0) return { status: "warn", label: "偏高" };
  return { status: "danger", label: "高估" };
}

function classifyFx(changePercent) {
  const c = toFiniteNumber(changePercent);
  if (c === null) return { status: "neutral", label: "—" };
  if (c > 0.1) return { status: "warn", label: "台幣貶值" };
  if (c < -0.1) return { status: "ok", label: "台幣升值" };
  return { status: "neutral", label: "持平" };
}

function normalizeNdcLight(raw) {
  const sig = String(raw || "");
  if (!sig) return { emoji: "⚪", label: "—", status: "neutral" };
  if (sig.includes("黃紅") || sig.includes("活絡") || sig.includes("yellow-red")) {
    return { emoji: "🟡🔴", label: "黃紅燈", status: "warn" };
  }
  if (sig.includes("黃藍") || sig.includes("趨緩") || sig.includes("yellow-blue")) {
    return { emoji: "🟡🔵", label: "黃藍燈", status: "neutral" };
  }
  if (sig.includes("紅") || sig.includes("熱絡") || sig === "red") {
    return { emoji: "🔴", label: "紅燈", status: "danger" };
  }
  if (sig.includes("綠") || sig.includes("穩定") || sig === "green") {
    return { emoji: "🟢", label: "綠燈", status: "ok" };
  }
  if (sig.includes("藍") || sig.includes("低迷") || sig === "blue") {
    return { emoji: "🔵", label: "藍燈", status: "neutral" };
  }
  return { emoji: "⚪", label: sig, status: "neutral" };
}

function normalizeEvents(list) {
  if (!Array.isArray(list)) return [];
  return list.map((e, i) => ({
    id: i,
    score: toFiniteNumber(e?.score) ?? 0,
    title: e?.title ?? e?.event ?? "(未命名)",
    analysis: e?.analysis || "",
  }));
}

function mapSentimentTone(rawText) {
  const s = String(rawText || "").toLowerCase();
  if (
    s.includes("恐慌") ||
    s.includes("fear") ||
    s.includes("bear") ||
    s.includes("空") ||
    s.includes("降溫") ||
    s.includes("悲觀") ||
    s.includes("negative")
  ) {
    return "bear";
  }
  if (
    s.includes("貪婪") ||
    s.includes("greed") ||
    s.includes("bull") ||
    s.includes("多") ||
    s.includes("升溫") ||
    s.includes("樂觀") ||
    s.includes("positive")
  ) {
    return "bull";
  }
  return "neutral";
}

function formatNum(val, decimals = 1) {
  const n = toFiniteNumber(val);
  if (n === null) return "—";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(decimals);
}

function formatSignedNum(val, decimals = 1) {
  const n = toFiniteNumber(val);
  if (n === null) return "—";
  const formatted = Number.isInteger(n) ? String(n) : n.toFixed(decimals);
  return n > 0 ? `+${formatted}` : formatted;
}

function normalizeSignalsList(signals) {
  if (!Array.isArray(signals) || !signals.length) return [];
  return signals
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        return item.label || item.title || item.message || item.name || "";
      }
      return "";
    })
    .filter(Boolean);
}

/**
 * 將後端 socialSentiment 轉換為具備核心指標卡片、均線/變化、樣本來源與背離狀態的 ViewModel。
 */
export function normalizeSocialSentiment(raw) {
  if (!raw) return null;
  const payload = raw?.data && typeof raw.data === "object" ? raw.data : raw;
  if (typeof payload !== "object" || Array.isArray(payload)) return null;

  const scoreVal = toFiniteNumber(payload.score ?? payload.sentimentScore ?? payload.index);
  const scoreLabel = payload.scoreLabel || payload.label || payload.sentiment || "";
  const trend = payload.trend || "";
  const ma3 = toFiniteNumber(payload.ma3);
  const ma7 = toFiniteNumber(payload.ma7);
  const delta = toFiniteNumber(payload.delta);
  const sampleCount = toFiniteNumber(payload.sampleCount);
  const pttItems = toFiniteNumber(payload.pttItems);
  const bskyItems = toFiniteNumber(payload.bskyItems);

  const divStatusRaw = String(payload.divergenceStatus || "").trim();
  const hasDivergence = Boolean(divStatusRaw && divStatusRaw.toUpperCase() !== "NONE");
  const divergenceBadge = hasDivergence ? divStatusRaw : "無背離";
  const divergenceDetail =
    payload.divergenceDetail || (hasDivergence ? divStatusRaw : "目前無多空背離現象");

  const targets = Array.isArray(payload.targets)
    ? payload.targets.map((t) => String(t)).filter(Boolean)
    : [];

  const signals = normalizeSignalsList(payload.signals);

  const tone = mapSentimentTone(`${scoreLabel} ${trend} ${divStatusRaw}`);

  const kpis = [
    {
      key: "score",
      label: "情緒指數",
      value: scoreVal !== null ? formatNum(scoreVal, 1) : "—",
      sub: scoreLabel || "—",
      tone,
    },
    {
      key: "ma3",
      label: "3 日均線 (MA3)",
      value: ma3 !== null ? formatNum(ma3, 1) : "—",
      sub: ma3 !== null && scoreVal !== null ? (scoreVal >= ma3 ? "高於均線" : "低於均線") : "短期均線",
      tone: "neutral",
    },
    {
      key: "ma7",
      label: "7 日均線 (MA7)",
      value: ma7 !== null ? formatNum(ma7, 1) : "—",
      sub: ma7 !== null && scoreVal !== null ? (scoreVal >= ma7 ? "高於週均" : "低於週均") : "週線參考",
      tone: "neutral",
    },
    {
      key: "delta",
      label: "較前日變化 (Δ)",
      value: delta !== null ? formatSignedNum(delta, 1) : "—",
      sub: delta !== null ? (delta > 0 ? "情緒回升" : delta < 0 ? "情緒轉弱" : "持平") : "日變化",
      tone: delta !== null ? (delta > 0 ? "bull" : delta < 0 ? "bear" : "neutral") : "neutral",
    },
    {
      key: "samples",
      label: "有效樣本數",
      value: sampleCount !== null ? formatNum(sampleCount, 0) : "—",
      sub:
        pttItems !== null || bskyItems !== null
          ? `PTT ${pttItems ?? 0} · Bsky ${bskyItems ?? 0}`
          : "社群貼文",
      tone: "neutral",
    },
    {
      key: "divergence",
      label: "背離狀態",
      value: divergenceBadge,
      sub: divergenceDetail,
      tone: hasDivergence ? "warn" : "neutral",
    },
  ];

  const hasSourceBreakdown = pttItems !== null || bskyItems !== null || sampleCount !== null;
  const totalSources = (pttItems ?? 0) + (bskyItems ?? 0);
  const pttRatio =
    totalSources > 0 && pttItems !== null ? Math.round((pttItems / totalSources) * 100) : 0;
  const bskyRatio =
    totalSources > 0 && bskyItems !== null ? Math.max(0, 100 - pttRatio) : 0;

  return {
    tone,
    badgeText: scoreLabel ? `${scoreLabel}${trend ? ` · ${trend}` : ""}` : "社群情緒",
    trendText: trend || "—",
    date: payload.date || "",
    updatedAt: payload.updatedAt || "",
    targets,
    kpis,
    hasSourceBreakdown,
    sampleCountText: sampleCount !== null ? `${formatNum(sampleCount, 0)} 則` : "—",
    pttText: pttItems !== null ? `${formatNum(pttItems, 0)} 則` : "—",
    bskyText: bskyItems !== null ? `${formatNum(bskyItems, 0)} 則` : "—",
    pttRatio,
    bskyRatio,
    hasDivergence,
    divergenceStatusText: divergenceBadge,
    divergenceDetailText: divergenceDetail,
    signals,
  };
}

export function buildInsightsViewModel({ statusResponse, report, socialSentiment }) {
  const statusData = statusResponse?.data ?? statusResponse ?? {};
  const leadingIndicators =
    report?.leadingIndicators ?? statusData?.leadingIndicators ?? null;

  const isLongTermDefense = Boolean(
    leadingIndicators?.isLongTermDefense ?? false,
  );

  // 美股
  const usVixVal = toFiniteNumber(
    report?.usRisk?.vix ?? statusData?.rawUsMarket?.vix,
  );
  const usVixInfo = classifyVix(usVixVal, "us");

  const spxRaw =
    report?.usRisk?.spxChg ?? statusData?.rawUsMarket?.spxChg ?? null;
  const spxInfo = classifySpx(spxRaw);

  const cnnScoreVal = toFiniteNumber(statusData?.rawCnn?.score);
  const cnnInfo = classifyCnn(cnnScoreVal, statusData?.rawCnn?.rating);

  // 台股
  const twVixVal = toFiniteNumber(report?.vixData?.value);
  const twVixInfo = classifyVix(twVixVal, "tw");

  const ndcLightInfo = normalizeNdcLight(statusData?.rawNdc?.light);

  const marginValue = toFiniteNumber(
    report?.macroData?.rawMargin?.marginBalance100M ??
      statusData?.rawMargin?.marginBalance100M,
  );
  const marginRatio = toFiniteNumber(
    report?.macroData?.rawMargin?.maintenanceRatio ??
      statusData?.rawMargin?.maintenanceRatio,
  );
  const marginChange = toFiniteNumber(
    report?.macroData?.rawMargin?.marginBalanceChange100M ??
      statusData?.rawMargin?.marginBalanceChange100M,
  );
  const marginDate =
    report?.macroData?.rawMargin?.date ?? statusData?.rawMargin?.date ?? null;
  const marginInfo = classifyMarginRatio(marginRatio);

  const peVal = toFiniteNumber(
    report?.macroData?.rawValuation?.pe ?? statusData?.rawValuation?.pe,
  );
  const peInfo = classifyPe(peVal);

  const pbVal = toFiniteNumber(
    report?.macroData?.rawValuation?.pb ?? statusData?.rawValuation?.pb,
  );
  const pbInfo = classifyPb(pbVal);
  const pbPR = toFiniteNumber(report?.valuationGuardResult?.currentPR);

  const fxRate = toFiniteNumber(
    report?.macroData?.rawFx?.currentRate ??
      report?.macroData?.rawFx?.exchangeRate ??
      statusData?.rawFx?.currentRate ??
      statusData?.rawFx?.exchangeRate,
  );
  const fxChange = toFiniteNumber(
    report?.macroData?.rawFx?.changePercent ?? statusData?.rawFx?.changePercent,
  );
  const fxInfo = classifyFx(fxChange);

  // 掃描結論（對齊原有 9 項指標統計邏輯）
  const indicatorStatuses = [
    usVixInfo.status,
    spxInfo.status,
    cnnInfo.status,
    twVixInfo.status,
    "neutral",
    marginInfo.status,
    peInfo.status,
    pbInfo.status,
    fxInfo.status,
  ];
  const bullishCount = indicatorStatuses.filter((s) => s === "ok").length;
  const bearishCount = indicatorStatuses.filter((s) => s === "danger").length;
  const neutralCount = indicatorStatuses.length - bullishCount - bearishCount;
  const scanConclusion = `${bullishCount} 項偏多、${bearishCount} 項偏空、${neutralCount} 項中性`;

  const extremeAlerts = Array.isArray(leadingIndicators?.alerts)
    ? leadingIndicators.alerts
    : Array.isArray(leadingIndicators?.extremeSignals)
      ? leadingIndicators.extremeSignals
      : [];
  const cashExposure = leadingIndicators?.cashExposureAnalysis ?? null;

  // 多空對決
  const macro = report?.macroAnalysis ?? null;
  const bullScore = (() => {
    if (!macro) return 0;
    if (Number.isFinite(Number(macro.total_bull_score))) {
      return Number(macro.total_bull_score);
    }
    if (Number.isFinite(Number(macro.bullish))) return Number(macro.bullish);
    return (macro.bull_events ?? []).reduce(
      (sum, e) => sum + (Number(e?.score) || 0),
      0,
    );
  })();

  const bearScore = (() => {
    if (!macro) return 0;
    if (Number.isFinite(Number(macro.total_bear_score))) {
      return Number(macro.total_bear_score);
    }
    if (Number.isFinite(Number(macro.bearish))) return Number(macro.bearish);
    return (macro.bear_events ?? []).reduce(
      (sum, e) => sum + (Number(e?.score) || 0),
      0,
    );
  })();

  const totalScore = bullScore + bearScore || 1;
  const bullWidth = Math.round((bullScore / totalScore) * 100);
  const bearWidth = Math.round((bearScore / totalScore) * 100);

  const rawDir = String(macro?.conclusion?.market_direction || "").toUpperCase();
  let directionTone = "neutral";
  let directionLabel = macro?.conclusion?.market_direction || "待分析";
  if (rawDir === "BULLISH") {
    directionTone = "bull";
    directionLabel = "多頭偏強";
  } else if (rawDir === "BEARISH") {
    directionTone = "bear";
    directionLabel = "空頭偏弱";
  } else if (rawDir === "NEUTRAL") {
    directionTone = "neutral";
    directionLabel = "中性觀望";
  }

  return {
    reportDate: report?.date || "",
    updatedAt:
      statusResponse?._meta?.cachedAt ||
      statusResponse?._meta?.updatedAt ||
      statusResponse?.updatedAt ||
      statusResponse?.lastRun ||
      null,
    radar: {
      isLongTermDefense,
      scanConclusion,
      leadingIndicators,
      extremeAlerts,
      cashExposure,
      us: [
        {
          key: "us-vix",
          label: "美股 VIX",
          valueText: usVixVal !== null ? usVixVal.toFixed(1) : "—",
          subText: usVixInfo.label,
          status: usVixInfo.status,
        },
        {
          key: "spx",
          label: "S&P 500",
          valueText: spxInfo.text,
          subText: spxInfo.label,
          status: spxInfo.status,
        },
        {
          key: "cnn",
          label: "CNN 情緒",
          valueText: cnnScoreVal !== null ? String(cnnScoreVal) : "—",
          subText: cnnInfo.label,
          status: cnnInfo.status,
        },
      ],
      tw: [
        {
          key: "tw-vix",
          label: "台股 VIX",
          valueText: twVixVal !== null ? twVixVal.toFixed(1) : "—",
          subText: twVixInfo.label,
          status: twVixInfo.status,
        },
        {
          key: "ndc-light",
          label: "景氣燈號",
          valueText: ndcLightInfo.emoji,
          subText: ndcLightInfo.label,
          status: ndcLightInfo.status,
        },
        {
          key: "margin-ratio",
          label: "融資維持率",
          valueText: marginRatio !== null ? `${marginRatio.toFixed(1)}%` : "—",
          subText: marginInfo.label,
          status: marginInfo.status,
        },
        {
          key: "pe",
          label: "大盤 PE",
          valueText: peVal !== null ? peVal.toFixed(1) : "—",
          subText: peInfo.label,
          status: peInfo.status,
        },
        {
          key: "pb",
          label: "大盤 PB",
          valueText: pbVal !== null ? pbVal.toFixed(2) : "—",
          subText:
            pbPR !== null ? `${pbInfo.label} · PR${pbPR.toFixed(1)}` : pbInfo.label,
          status: pbInfo.status,
        },
        {
          key: "fx",
          label: "美元/台幣",
          valueText: fxRate !== null ? fxRate.toFixed(2) : "—",
          subText: fxInfo.label,
          status: fxInfo.status,
        },
      ],
      marginDetail: {
        hasData: marginChange !== null || marginValue !== null,
        marginValue,
        marginChange,
        marginDate,
      },
    },
    macro: {
      hasData: Boolean(macro),
      directionTone,
      directionLabel,
      shortSummary: macro?.conclusion?.short_summary || "",
      bullScore,
      bearScore,
      bullWidth,
      bearWidth,
      takeaways: Array.isArray(macro?.conclusion?.key_takeaways)
        ? macro.conclusion.key_takeaways
        : [],
      bullEvents: normalizeEvents(macro?.bull_events),
      bearEvents: normalizeEvents(macro?.bear_events),
      neutralEvents: normalizeEvents(macro?.neutral_events),
      socialSentimentModel: normalizeSocialSentiment(socialSentiment),
    },
  };
}
