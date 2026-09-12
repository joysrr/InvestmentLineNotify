// src/modules/sentiment/sentimentEngine.mjs
//
// 職責：純 JS 社群情緒指標與散戶頂底背離計算引擎。
// 完全原生實作，100% 脫離 Python 依賴，計算 3D/7D MA、波動率跳動、頂底背離並產出定格快照。

import fs from "fs";
import path from "path";

export const PRIORITY_MAP = {
  VOLATILITY_SPIKE: 1,
  HIGH_TO_COLD: 2,
  DEATH_CROSS: 3,
  GOLDEN_CROSS: 4,
};

function safeNumber(val, fallback = 50.0) {
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * 計算社群情緒趨勢指標 (MA3, MA7, 交叉信號與跳動)
 * @param {Array<Object>} history 每日情緒記錄清單
 * @returns {Object} 指標計算結果
 */
export function calculateSentimentIndicators(history = []) {
  if (!history || history.length === 0) {
    return {
      date: "資料累積中",
      score: 0.0,
      "3d_ma": "資料累積中",
      "7d_ma": "資料累積中",
      signals: [],
      primary_signal: null,
    };
  }

  // 依日期去重（最新記錄覆蓋）
  const byDate = new Map();
  for (const h of history) {
    const d = h.date || (h.timestamp ? String(h.timestamp).slice(0, 10) : "");
    if (d) {
      byDate.set(d, h);
    }
  }

  const sortedDates = Array.from(byDate.keys()).sort();
  if (sortedDates.length === 0) {
    return {
      date: "資料累積中",
      score: 0.0,
      "3d_ma": "資料累積中",
      "7d_ma": "資料累積中",
      signals: [],
      primary_signal: null,
    };
  }

  const dailyRecords = sortedDates.map((d) => byDate.get(d));
  const scores = dailyRecords.map((r) =>
    safeNumber(r.score ?? r.sentiment_score ?? 50),
  );
  const n = scores.length;

  const lastDate = sortedDates[sortedDates.length - 1];
  const todayScore = scores[scores.length - 1];

  // 計算 MA 數列
  const ma3Series = [];
  const ma7Series = [];

  for (let i = 0; i < n; i++) {
    if (i >= 2) {
      const sum3 = scores[i - 2] + scores[i - 1] + scores[i];
      ma3Series.push(sum3 / 3.0);
    } else {
      ma3Series.push(null);
    }

    if (i >= 6) {
      let sum7 = 0;
      for (let k = i - 6; k <= i; k++) {
        sum7 += scores[k];
      }
      ma7Series.push(sum7 / 7.0);
    } else {
      ma7Series.push(null);
    }
  }

  const today3dMa = ma3Series[n - 1];
  const today7dMa = ma7Series[n - 1];
  const prev3dMa = n >= 2 ? ma3Series[n - 2] : null;
  const prev7dMa = n >= 2 ? ma7Series[n - 2] : null;

  const signals = [];

  // 規則 1: 波動跳動 (|今日 - 昨日| > 10)
  if (n >= 2) {
    const yesterdayScore = scores[n - 2];
    const diff = todayScore - yesterdayScore;
    if (Math.abs(diff) > 10) {
      signals.push({
        type: "VOLATILITY_SPIKE",
        detail: `昨日=${yesterdayScore.toFixed(1)} → 今日=${todayScore.toFixed(1)} (跳動${diff >= 0 ? "+" : ""}${diff.toFixed(1)})`,
      });
    }
  }

  // 規則 2: 高檔轉冷 (前日 7D >= 65 且 今日 7D < 60)
  if (
    prev7dMa !== null &&
    today7dMa !== null &&
    prev7dMa >= 65.0 &&
    today7dMa < 60.0
  ) {
    signals.push({
      type: "HIGH_TO_COLD",
      detail: `前日7D_MA=${prev7dMa.toFixed(1)} → 今日7D_MA=${today7dMa.toFixed(1)}`,
    });
  }

  // 規則 3: 黃金交叉 / 死亡交叉
  if (
    prev3dMa !== null &&
    prev7dMa !== null &&
    today3dMa !== null &&
    today7dMa !== null
  ) {
    if (prev3dMa <= prev7dMa && today3dMa > today7dMa) {
      const gap = today3dMa - today7dMa;
      if (gap >= 2.0) {
        signals.push({
          type: "GOLDEN_CROSS",
          detail: `3D_MA=${today3dMa.toFixed(1)} > 7D_MA=${today7dMa.toFixed(1)} (差距${gap.toFixed(1)})`,
        });
      }
    } else if (prev3dMa >= prev7dMa && today3dMa < today7dMa) {
      const gap = today7dMa - today3dMa;
      if (gap >= 2.0) {
        signals.push({
          type: "DEATH_CROSS",
          detail: `3D_MA=${today3dMa.toFixed(1)} < 7D_MA=${today7dMa.toFixed(1)} (差距${gap.toFixed(1)})`,
        });
      }
    }
  }

  signals.sort(
    (a, b) => (PRIORITY_MAP[a.type] || 99) - (PRIORITY_MAP[b.type] || 99),
  );

  return {
    date: lastDate,
    score: todayScore,
    "3d_ma": today3dMa !== null ? today3dMa : "資料累積中",
    "7d_ma": today7dMa !== null ? today7dMa : "資料累積中",
    signals,
    primary_signal: signals.length > 0 ? signals[0] : null,
  };
}

/**
 * 計算散戶情緒與資產價格之背離狀態
 * @param {Array<Object>} sentimentHistory
 * @param {Array<Object>} priceHistory
 * @param {number} windowDays
 * @returns {Object} 背離判定狀態
 */
export function calculateDivergence(
  sentimentHistory = [],
  priceHistory = [],
  windowDays = 10,
) {
  if (!priceHistory || priceHistory.length < windowDays) {
    return {
      status: "資料不足",
      type: "無",
      detail: `價格資料未接入或不足${windowDays}日`,
    };
  }

  const indicators = calculateSentimentIndicators(sentimentHistory);
  const ma7 = indicators["7d_ma"];

  if (typeof ma7 !== "number") {
    return {
      status: "資料不足",
      type: "無",
      detail: `情緒資料不足${windowDays}日，無法計算7D MA`,
    };
  }

  const byDate = new Map();
  for (const p of priceHistory) {
    if (p.date && p.close !== undefined) {
      byDate.set(p.date, Number(p.close));
    }
  }

  const sortedDates = Array.from(byDate.keys()).sort();
  if (sortedDates.length < windowDays) {
    return {
      status: "資料不足",
      type: "無",
      detail: `價格資料不足${windowDays}日`,
    };
  }

  const recentDates = sortedDates.slice(-windowDays);
  const recentPrices = recentDates.map((d) => byDate.get(d));
  const todayPrice = recentPrices[recentPrices.length - 1];
  const maxPrice = Math.max(...recentPrices);
  const minPrice = Math.min(...recentPrices);

  const isTodayHigh = todayPrice >= maxPrice;
  const isTodayLow = todayPrice <= minPrice;

  const priorPrices = recentPrices.slice(0, -1);
  const priorMax =
    priorPrices.length > 0 ? Math.max(...priorPrices) : todayPrice;
  const priorMin =
    priorPrices.length > 0 ? Math.min(...priorPrices) : todayPrice;

  const hadRecentHigh = priorMax > todayPrice || priorMax === maxPrice;
  const hadRecentLow = priorMin < todayPrice || priorMin === minPrice;

  // 頂背離：7D MA > 80，但價格未創 N 日新高
  if (ma7 > 80.0 && !isTodayHigh && hadRecentHigh) {
    return {
      status: "觸發",
      type: "BEARISH_DIVERGENCE",
      detail: `7D_MA=${ma7.toFixed(1)} > 80, 價格未創${windowDays}日新高 (今日=${todayPrice.toFixed(2)}, ${windowDays}日高=${maxPrice.toFixed(2)})`,
    };
  }

  // 底背離：7D MA < 30，但價格未破 N 日新低
  if (ma7 < 30.0 && !isTodayLow && hadRecentLow) {
    return {
      status: "觸發",
      type: "BULLISH_DIVERGENCE",
      detail: `7D_MA=${ma7.toFixed(1)} < 30, 價格未破${windowDays}日新低 (今日=${todayPrice.toFixed(2)}, ${windowDays}日低=${minPrice.toFixed(2)})`,
    };
  }

  return {
    status: "無",
    type: "無",
    detail: "無背離現象",
  };
}

/**
 * 抽取焦點熱門話題
 */
function extractHotTopics(history = [], maxTopics = 3) {
  const counter = new Map();
  const recent = history.slice(-3);
  for (const record of recent) {
    const topics = record.topic_names || [];
    for (const t of topics) {
      counter.set(t, (counter.get(t) || 0) + 1);
    }
  }

  const sortedTopics = Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTopics);

  return sortedTopics.map(([topic]) => ({
    title: topic,
    source: "PTT",
    sentiment: "NEUTRAL",
    url: "",
  }));
}

/**
 * 產生符合 SocialSentimentProvider 契約的每日情緒定格快照
 */
export function generateDailySnapshot(
  sentimentHistory = [],
  priceHistory = [],
  outputPath = null,
) {
  const indicators = calculateSentimentIndicators(sentimentHistory);
  const divergence = calculateDivergence(sentimentHistory, priceHistory, 10);

  const rawMa3 = indicators["3d_ma"];
  const rawMa7 = indicators["7d_ma"];
  const rawScore = indicators.score;

  const score = typeof rawScore === "number" ? rawScore : 50.0;
  const ma3 = typeof rawMa3 === "number" ? rawMa3 : score;
  const ma7 = typeof rawMa7 === "number" ? rawMa7 : score;

  let divergenceStatus = "NONE";
  if (divergence.status === "資料不足") {
    divergenceStatus = "資料不足";
  } else if (divergence.status === "觸發") {
    divergenceStatus = divergence.type;
  }

  const signals = indicators.signals.map((s) => s.type);
  const hotTopics = extractHotTopics(sentimentHistory, 3);

  const snapshot = {
    date:
      indicators.date !== "資料累積中"
        ? indicators.date
        : new Date().toISOString().slice(0, 10),
    score: Math.round(score * 10) / 10,
    ma3: Math.round(ma3 * 10) / 10,
    ma7: Math.round(ma7 * 10) / 10,
    divergenceStatus,
    signals,
    hotTopics,
  };

  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2), "utf-8");
  }

  return snapshot;
}
