/**
 * @file retailSentimentRadar.mjs
 * @description 雷達 4：散戶多空對決雷達 (Retail Sentiment Radar)
 * 監控小台指散戶多空比 (RSR)，於散戶極度死扛做多時警報多殺多，或極度放空時捕捉軋空強動能。
 */

import { RADAR_IDS, createRadarResult } from "./types.mjs";

/**
 * 計算分位數 (Nearest Rank)
 * @param {number[]} arr
 * @param {number} p - 0 ~ 100
 * @returns {number}
 */
function calcPercentile(arr, p) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

/**
 * 計算小台指散戶多空比 (RSR)
 * 散戶多空比 = (散戶未平倉淨部位 / 全市場未平倉總量) * 100%
 * 其中 散戶淨部位 = -(三大法人未平倉淨部位)
 * @param {Object} input
 * @param {number} input.totalOi - 小台全市場未平倉總口數
 * @param {number} input.institutionalNetOi - 三大法人小台淨多單留倉口數 (負數為淨空)
 * @returns {number} RSR 數值 (例如 +25.5 代表 +25.5%)
 */
export function calculateRsrFromTaifex({
  totalOi = 0,
  institutionalNetOi = 0,
}) {
  if (!totalOi || totalOi <= 0) return 0;
  const retailNetOi = -institutionalNetOi;
  const rsr = (retailNetOi / totalOi) * 100;
  return Number(rsr.toFixed(2));
}

/**
 * 評估雷達 4：散戶多空對決雷達
 * @param {Object} input
 * @param {number} input.rsr - 小台指散戶多空比 (如 +32.5 代表 +32.5%)
 * @param {number[]} [input.rsrHistory] - 過去歷史 RSR 數值序列 (建議 250 天)
 * @returns {Object} 雷達標準輸出合約
 */
export function evaluateRetailSentimentRadar({ rsr = 0, rsrHistory = [] }) {
  const hasHistory = Array.isArray(rsrHistory) && rsrHistory.length >= 30;
  const p90Rsr = hasHistory ? calcPercentile(rsrHistory, 90) : 30.0;
  const p10Rsr = hasHistory ? calcPercentile(rsrHistory, 10) : -30.0;

  // F-4: 引入防假陽性雙邊界
  // 多殺多崩跌警報：RSR >= +30% 或 (RSR >= P90 且 RSR >= +20%)
  const isLongLiquidation =
    rsr >= 30.0 || (hasHistory && rsr >= p90Rsr && rsr >= 20.0);

  // 軋空多頭強訊號：RSR <= -30% 或 (RSR <= P10 且 RSR <= -20%)
  const isShortSqueeze =
    rsr <= -30.0 || (hasHistory && rsr <= p10Rsr && rsr <= -20.0);

  if (!isLongLiquidation && !isShortSqueeze) {
    return {
      ...createRadarResult({
        radarId: RADAR_IDS.RETAIL_SENTIMENT,
        triggered: false,
        metrics: {
          rsr,
          p90Rsr,
          p10Rsr,
        },
        constraints: {
          freeze00675L: false,
          allowLeft0050: false,
          pauseP1: false,
        },
        cardSummary: null,
      }),
      subType: "NEUTRAL",
    };
  }

  const rsrStr = `${rsr >= 0 ? "+" : ""}${rsr.toFixed(1)}%`;

  if (isLongLiquidation) {
    const summaryText = `🚨【散戶多空對決：多殺多崩跌警報】小台散戶多空比衝高至 ${rsrStr}。散戶融資期貨逆勢死扛，多殺多風險極高，紀律：00675L 嚴格凍結防連環爆，P1 暫緩，P0 正常執行。`;
    return {
      ...createRadarResult({
        radarId: RADAR_IDS.RETAIL_SENTIMENT,
        triggered: true,
        metrics: {
          rsr,
          p90Rsr,
          p10Rsr,
          isLongLiquidation: true,
          isShortSqueeze: false,
        },
        constraints: {
          freeze00675L: true, // 嚴禁槓桿進場
          allowLeft0050: false, // 籌碼未沉澱，不急接 0050
          pauseP1: true, // 暫緩 P1
        },
        cardSummary: summaryText,
      }),
      subType: "LONG_LIQUIDATION",
    };
  }

  // isShortSqueeze
  const summaryText = `🔥【散戶多空對決：軋空強多訊號】小台散戶多空比降至 ${rsrStr}。散戶集體猜頭放空被軋，順勢動能強勁，紀律：允許 00675L 動能參與，P0/P1 正常執行。`;
  return {
    ...createRadarResult({
      radarId: RADAR_IDS.RETAIL_SENTIMENT,
      triggered: true,
      metrics: {
        rsr,
        p90Rsr,
        p10Rsr,
        isLongLiquidation: false,
        isShortSqueeze: true,
      },
      constraints: {
        freeze00675L: false, // 不凍結，具軋空順勢動能
        allowLeft0050: false,
        pauseP1: false,
      },
      cardSummary: summaryText,
    }),
    subType: "SHORT_SQUEEZE",
  };
}

evaluateRetailSentimentRadar.calculateRsrFromTaifex = calculateRsrFromTaifex;
