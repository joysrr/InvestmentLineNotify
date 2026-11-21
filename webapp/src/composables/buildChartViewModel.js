/**
 * 由後端實際回傳的 snapshots / status / reports 建構輕量 Chart & Technical ViewModel。
 * 不依賴後端未保證存在的欄位，所有數值皆有安全 fallback。
 */

export const TIME_RANGES = [
  { key: "1M", label: "1M", limit: 22 },
  { key: "3M", label: "3M", limit: 66 },
  { key: "6M", label: "6M", limit: 132 },
  { key: "1Y", label: "1Y", limit: 252 },
  { key: "ALL", label: "ALL", limit: null },
];

export const GRANULARITIES = [
  { key: "daily", label: "日線 (90)", limit: 90, maWindow: 10 },
  { key: "weekly", label: "週線 (52)", limit: 52, maWindow: 6 },
  { key: "monthly", label: "月線 (120)", limit: 120, maWindow: 6 },
];

export const TREND_METRICS = [
  { key: "netValueMarket", label: "市價淨值", unit: "ntd" },
  { key: "qty0050", label: "0050 股數", unit: "shares" },
  { key: "qtyZ2", label: "675L 股數", unit: "shares" },
  { key: "totalLoan", label: "融資餘額", unit: "ntd" },
];

export function toFiniteNumber(val) {
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

export function normalizeSnapshotList(rawResponse, granularity = "daily") {
  const sortKey = (item) =>
    granularity === "daily"
      ? String(item?.date || "")
      : String(item?.endDate ?? item?.date ?? "");

  if (Array.isArray(rawResponse)) {
    return {
      hasEncryption: true,
      snapshots: [...rawResponse].sort((a, b) => sortKey(a).localeCompare(sortKey(b))),
    };
  }

  return {
    hasEncryption: rawResponse?.hasEncryption ?? true,
    snapshots: [...(rawResponse?.snapshots ?? [])].sort((a, b) =>
      sortKey(a).localeCompare(sortKey(b)),
    ),
  };
}

export function computeMovingAverage(values, win) {
  return values.map((_, idx) => {
    if (idx + 1 < win) return null;
    const slice = values.slice(idx + 1 - win, idx + 1).filter((v) => v !== null);
    if (slice.length < win) return null;
    return slice.reduce((acc, cur) => acc + cur, 0) / win;
  });
}

function computeStreakText(vals) {
  if (vals.length < 2) return "—";
  let run = 0;
  let dir = 0; // 1 = up, -1 = down
  for (let i = vals.length - 1; i > 0; i--) {
    const diff = vals[i] - vals[i - 1];
    if (diff === 0) break;
    const d = diff > 0 ? 1 : -1;
    if (dir === 0) dir = d;
    if (d === dir) run += 1;
    else break;
  }
  if (!run || dir === 0) return "持平";
  return dir > 0 ? `連漲 ${run} 期` : `連跌 ${run} 期`;
}

export function buildTrendViewModel({
  dataPoints = [],
  granularity = "daily",
  metric = "netValueMarket",
  showMa = true,
  overlayTarget = "none",
}) {
  const granDef = GRANULARITIES.find((g) => g.key === granularity) ?? GRANULARITIES[0];
  const metricDef = TREND_METRICS.find((m) => m.key === metric) ?? TREND_METRICS[0];
  const maWindow = granDef.maWindow;
  const maLabel = `MA${maWindow}`;

  const latest = dataPoints.length ? dataPoints[dataPoints.length - 1] : null;
  const latestDateText = !latest
    ? ""
    : granularity === "daily"
      ? latest.date || ""
      : latest.endDate || latest.period || latest.date || "";

  const has50 = dataPoints.some((p) => toFiniteNumber(p?.price0050) !== null);
  const hasZ2 = dataPoints.some((p) => toFiniteNumber(p?.priceZ2) !== null);
  const hasPriceOverlay = has50 || hasZ2;

  const primarySeries = dataPoints.map((pt) => toFiniteNumber(pt?.[metric]));
  const maSeries = showMa ? computeMovingAverage(primarySeries, maWindow) : null;
  const overlaySeries =
    overlayTarget !== "none"
      ? dataPoints.map((pt) => toFiniteNumber(pt?.[overlayTarget]))
      : null;

  const validVals = primarySeries.filter((v) => v !== null);
  let stats = null;

  if (validVals.length) {
    const first = validVals[0];
    const lastVal = validVals[validVals.length - 1];
    const max = Math.max(...validVals);
    const min = Math.min(...validVals);
    const avg = validVals.reduce((s, v) => s + v, 0) / validVals.length;
    const delta = lastVal - first;
    const deltaPct = first !== 0 ? (delta / Math.abs(first)) * 100 : null;

    let peak = validVals[0];
    let mddAbs = 0;
    let mddPct = null;
    for (const v of validVals) {
      if (v > peak) peak = v;
      const dd = peak - v;
      if (dd > mddAbs) {
        mddAbs = dd;
        if (peak > 0) {
          mddPct = (dd / peak) * 100;
        }
      }
    }

    stats = {
      first,
      latest: lastVal,
      max,
      min,
      avg,
      delta,
      deltaPct,
      mddAbs,
      mddPct,
      streakText: computeStreakText(validVals),
    };
  }

  return {
    granularityLabel: granDef.label,
    activeMetric: metricDef,
    maWindow,
    maLabel,
    latest,
    latestDateText,
    has50,
    hasZ2,
    hasPriceOverlay,
    primarySeries,
    maSeries,
    overlaySeries,
    stats,
  };
}

export function buildTechnicalViewModel({ status, report }) {
  const sData = status?.data ?? status ?? {};
  const rep = report ?? {};

  const updatedAt =
    status?._meta?.cachedAt ||
    status?._meta?.updatedAt ||
    status?.updatedAt ||
    rep?.date ||
    null;

  const items = [];

  const usVix = toFiniteNumber(rep?.usRisk?.vix ?? sData?.rawUsMarket?.vix);
  if (usVix !== null) {
    const statusTone =
      usVix >= 30 ? "danger" : usVix >= 20 ? "warn" : usVix <= 13 ? "ok" : "neutral";
    const badge =
      usVix >= 30 ? "恐慌飆升" : usVix >= 20 ? "波動升溫" : usVix <= 13 ? "平穩偏多" : "中性";
    items.push({
      key: "us-vix",
      label: "美股 VIX 波動率",
      badge,
      valueText: usVix.toFixed(1),
      subText: usVix >= 20 ? "留意股市震盪風險" : "波動度可控",
      status: statusTone,
    });
  }

  const twVix = toFiniteNumber(rep?.vixData?.value);
  if (twVix !== null) {
    const statusTone =
      twVix >= 30 ? "danger" : twVix >= 22 ? "warn" : twVix <= 14 ? "ok" : "neutral";
    const badge =
      twVix >= 30 ? "極度恐慌" : twVix >= 22 ? "警戒偏高" : twVix <= 14 ? "低波動" : "常態";
    items.push({
      key: "tw-vix",
      label: "台股 VIX 波動率",
      badge,
      valueText: twVix.toFixed(1),
      subText: "台指隱含波動參考",
      status: statusTone,
    });
  }

  const cnnScore = toFiniteNumber(sData?.rawCnn?.score);
  if (cnnScore !== null) {
    const rating =
      sData?.rawCnn?.rating ||
      (cnnScore <= 25
        ? "極度恐懼"
        : cnnScore <= 45
          ? "恐懼"
          : cnnScore >= 75
            ? "極度貪婪"
            : cnnScore >= 55
              ? "貪婪"
              : "中性");
    const statusTone =
      cnnScore <= 45 ? "ok" : cnnScore >= 75 ? "danger" : cnnScore >= 55 ? "warn" : "neutral";
    items.push({
      key: "cnn-fg",
      label: "CNN 恐懼貪婪指數",
      badge: rating,
      valueText: `${Math.round(cnnScore)}`,
      subText: "市場情緒動能指標",
      status: statusTone,
    });
  }

  const pe = toFiniteNumber(rep?.macroData?.rawValuation?.pe ?? sData?.rawValuation?.pe);
  if (pe !== null) {
    const statusTone = pe < 15 ? "ok" : pe >= 25 ? "danger" : pe >= 20 ? "warn" : "neutral";
    const badge =
      pe < 12 ? "極度低估" : pe < 15 ? "低估" : pe < 20 ? "合理" : pe < 25 ? "偏高" : "高估";
    items.push({
      key: "pe",
      label: "大盤本益比 (PE)",
      badge,
      valueText: `${pe.toFixed(1)}x`,
      subText: "獲利估值水位",
      status: statusTone,
    });
  }

  const pb = toFiniteNumber(rep?.macroData?.rawValuation?.pb ?? sData?.rawValuation?.pb);
  const pr = toFiniteNumber(rep?.valuationGuardResult?.currentPR);
  if (pb !== null) {
    const statusTone =
      pb < 2.0 ? "ok" : pb >= 4.0 ? "danger" : pb >= 3.0 ? "warn" : "neutral";
    const badge =
      pb < 1.5 ? "極度低估" : pb < 2.0 ? "低估" : pb < 3.0 ? "合理" : pb < 4.0 ? "偏高" : "高估";
    items.push({
      key: "pb",
      label: "大盤股價淨值比 (PB)",
      badge,
      valueText: `${pb.toFixed(2)}x`,
      subText: pr !== null ? `估值分位 PR ${pr.toFixed(1)}` : "淨值估值水位",
      status: statusTone,
    });
  }

  const marginRatio = toFiniteNumber(
    rep?.macroData?.rawMargin?.maintenanceRatio ?? sData?.rawMargin?.maintenanceRatio,
  );
  if (marginRatio !== null) {
    const statusTone =
      marginRatio < 130 ? "danger" : marginRatio < 145 || marginRatio > 170 ? "warn" : "ok";
    const badge =
      marginRatio < 130
        ? "追繳警戒"
        : marginRatio < 145
          ? "偏低留意"
          : marginRatio > 170
            ? "過熱偏高"
            : "健康區間";
    items.push({
      key: "margin-ratio",
      label: "大盤融資維持率",
      badge,
      valueText: `${marginRatio.toFixed(1)}%`,
      subText: "籌碼槓桿健康度",
      status: statusTone,
    });
  }

  const bullCount = items.filter((i) => i.status === "ok").length;
  const bearCount = items.filter((i) => i.status === "danger" || i.status === "warn").length;
  const neutralCount = items.length - bullCount - bearCount;

  const summary =
    bearCount > bullCount
      ? {
          headline: "警戒與波動訊號較多，建議留意部位節奏",
          badge: "偏謹慎",
          tone: "bear",
          bullCount,
          bearCount,
          neutralCount,
        }
      : bullCount > bearCount
        ? {
            headline: "多數指標處於偏多或合理區間",
            badge: "偏正向",
            tone: "bull",
            bullCount,
            bearCount,
            neutralCount,
          }
        : {
            headline: "多空與估值訊號交錯，維持紀律觀察",
            badge: "中性震盪",
            tone: "neutral",
            bullCount,
            bearCount,
            neutralCount,
          };

  const extraRows = [];

  const grossLev = toFiniteNumber(rep?.signals?.grossLeverage ?? rep?.portfolio?.grossLeverage);
  if (grossLev !== null) {
    extraRows.push({
      key: "gross-lev",
      label: "整體槓桿倍數",
      value: `${grossLev.toFixed(2)}x`,
      tone: grossLev >= 2.2 ? "warn" : "ok",
    });
  }

  const marginBal = toFiniteNumber(
    rep?.macroData?.rawMargin?.marginBalance100M ?? sData?.rawMargin?.marginBalance100M,
  );
  const marginChg = toFiniteNumber(
    rep?.macroData?.rawMargin?.marginBalanceChange100M ??
      sData?.rawMargin?.marginBalanceChange100M,
  );
  if (marginBal !== null) {
    extraRows.push({
      key: "margin-bal",
      label: "融資餘額",
      value: `${marginBal.toFixed(1)} 億`,
      tone: "",
    });
  }
  if (marginChg !== null) {
    extraRows.push({
      key: "margin-chg",
      label: "融資單日增減",
      value: `${marginChg >= 0 ? "+" : ""}${marginChg.toFixed(1)} 億`,
      tone: marginChg >= 0 ? "warn" : "ok",
    });
  }

  const fxRate = toFiniteNumber(
    rep?.macroData?.rawFx?.currentRate ??
      rep?.macroData?.rawFx?.exchangeRate ??
      sData?.rawFx?.currentRate ??
      sData?.rawFx?.exchangeRate,
  );
  if (fxRate !== null) {
    extraRows.push({
      key: "fx-rate",
      label: "美元 / 台幣",
      value: fxRate.toFixed(2),
      tone: "",
    });
  }

  return {
    updatedAt,
    items,
    summary,
    extraRows,
  };
}
