/**
 * 由後端實際回傳的 status / reports / socialSentiment 建構輕量 Insights ViewModel。
 * 保留所有既有雷達指標、融資明細、多空積分、事件與社群情緒欄位，並提供安全 fallback。
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
    "neutral", // 景氣燈號固定 neutral
    marginInfo.status,
    peInfo.status,
    pbInfo.status,
    fxInfo.status,
  ];
  const bullishCount = indicatorStatuses.filter((s) => s === "ok").length;
  const bearishCount = indicatorStatuses.filter((s) => s === "danger").length;
  const neutralCount = indicatorStatuses.length - bullishCount - bearishCount;
  const scanConclusion = `${bullishCount} 項偏多、${bearishCount} 項偏空、${neutralCount} 項中性`;

  // 先行指標 / 極端雷達 / 現金曝險摘要（不遺失既有子元件資訊）
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
      socialSentiment: socialSentiment ?? null,
    },
  };
}
