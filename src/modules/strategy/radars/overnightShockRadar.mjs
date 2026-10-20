/**
 * @file overnightShockRadar.mjs
 * @description 雷達 1：隔夜衝擊雷達 (Overnight Shock Radar)
 * 監控費城半導體 (SOX)、台積電 ADR (TSM) 與台指期夜盤表現，提早識別隔夜傳導衝擊。
 */

import {
  RADAR_IDS,
  NIGHT_SESSION_SEVERITY,
  createRadarResult,
} from "./types.mjs";

/**
 * 計算陣列平均值
 * @param {number[]} arr
 * @returns {number}
 */
function calcMean(arr) {
  if (!arr || arr.length === 0) return 0;
  const sum = arr.reduce((acc, v) => acc + v, 0);
  return sum / arr.length;
}

/**
 * 計算陣列樣本標準差
 * @param {number[]} arr
 * @param {number} mean
 * @returns {number}
 */
function calcStd(arr, mean) {
  if (!arr || arr.length < 2) return 0.018; // 預設先驗標準差 1.8%
  const variance =
    arr.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance) || 0.018;
}

/**
 * 計算分位數 (Nearest Rank)
 * @param {number[]} arr
 * @param {number} p - 0 ~ 100
 * @returns {number}
 */
function calcPercentile(arr, p) {
  if (!arr || arr.length === 0) return 0.035; // 預設兜底 P95 門檻 3.5%
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

/**
 * 評估雷達 1：隔夜衝擊雷達
 * @param {Object} input
 * @param {number} input.rSox - 費半單日報酬率 (如 -0.035 代表 -3.5%)
 * @param {number} input.rTsm - 台積電 ADR 單日報酬率
 * @param {number} [input.rNight] - 台指期夜盤報酬率
 * @param {number[]} [input.soxHistory] - SOX 過去歷史報酬率序列 (建議 250 天)
 * @param {number[]} [input.tsmHistory] - TSM 過去歷史報酬率序列
 * @returns {Object} 雷達標準輸出合約
 */
export function evaluateOvernightShockRadar({
  rSox = 0,
  rTsm = 0,
  rNight = 0,
  nightDataStatus = "VERIFIED",
  soxHistory = [],
  tsmHistory = [],
}) {
  // 1. 歷史統計或降級先驗計算
  const hasSoxHistory = Array.isArray(soxHistory) && soxHistory.length >= 30;
  const hasTsmHistory = Array.isArray(tsmHistory) && tsmHistory.length >= 30;

  const soxMean = hasSoxHistory ? calcMean(soxHistory) : 0;
  const soxStd = hasSoxHistory ? calcStd(soxHistory, soxMean) : 0.018;

  const tsmMean = hasTsmHistory ? calcMean(tsmHistory) : 0;
  const tsmStd = hasTsmHistory ? calcStd(tsmHistory, tsmMean) : 0.019;

  // 計算 z-score 與 ShockScore
  const zSox = (rSox - soxMean) / soxStd;
  const zTsm = (rTsm - tsmMean) / tsmStd;
  const shockScore = 0.5 * zSox + 0.5 * zTsm;

  // P95 絕對門檻計算 (對絕對值取 95th 分位數)
  const absSoxHistory = hasSoxHistory ? soxHistory.map((v) => Math.abs(v)) : [];
  const p95Sox = hasSoxHistory ? calcPercentile(absSoxHistory, 95) : 0.035;

  // 2. 觸發條件判定 (AND)
  const isTriggered = Math.abs(shockScore) >= 2.0 && Math.abs(rSox) >= p95Sox;

  if (!isTriggered) {
    return createRadarResult({
      radarId: RADAR_IDS.OVERNIGHT_SHOCK,
      triggered: false,
      severity: NIGHT_SESSION_SEVERITY.NONE,
      metrics: {
        rSox,
        rTsm,
        rNight,
        dataStatus: nightDataStatus,
        zSox,
        zTsm,
        shockScore,
        p95Sox,
      },
      constraints: {
        freeze00675L: false,
        pauseP1: false,
        allowLeft0050: false,
      },
      cardSummary: null,
    });
  }

  // 3. 觸發後夜盤強度分級器
  const absNight = Math.abs(rNight);
  const isSameDirection = (rNight < 0 && rSox < 0) || (rNight > 0 && rSox > 0);

  let severity = NIGHT_SESSION_SEVERITY.NONE;
  let freeze00675L = true;
  let pauseP1 = true;
  let summaryText = "";

  const rSoxPct = (rSox * 100).toFixed(1);
  const rNightPct = (rNight * 100).toFixed(1);

  if (absNight >= 0.01 && isSameDirection) {
    severity = NIGHT_SESSION_SEVERITY.STRONG_RESONANCE;
    freeze00675L = true;
    pauseP1 = true;
    summaryText = `🚨【隔夜衝擊：強共振】費半重挫 ${rSoxPct}%，台指夜盤共振重挫 ${rNightPct}%。紀律：00675L 禁止買入，P1 暫緩，P0 正常執行。`;
  } else if (absNight >= 0.005 && isSameDirection) {
    severity = NIGHT_SESSION_SEVERITY.NORMAL_CONFIRM;
    freeze00675L = true;
    pauseP1 = true;
    summaryText = `⚠️【隔夜衝擊：普通確認】費半重挫 ${rSoxPct}%，夜盤跌幅 ${rNightPct}%。紀律：00675L 禁止買入，P1 暫緩，P0 正常執行。`;
  } else {
    // 夜盤跌幅 < 0.5% 或逆向抗跌翻紅
    severity = NIGHT_SESSION_SEVERITY.DIVERGENCE_BLUNT;
    freeze00675L = true;
    pauseP1 = false; // P1 正常加碼！
    summaryText = `🛡【隔夜衝擊：夜盤抗跌背離】美股跌 ${rSoxPct}% 但夜盤抗跌 (${rNightPct}%)。紀律：00675L 禁止買入防震盪，P1 維持正常，P0 正常執行。`;
  }

  return {
    ...createRadarResult({
      radarId: RADAR_IDS.OVERNIGHT_SHOCK,
      triggered: true,
      severity,
      metrics: {
        rSox,
        rTsm,
        rNight,
        dataStatus: nightDataStatus,
        zSox,
        zTsm,
        shockScore,
        p95Sox,
      },
      constraints: {
        freeze00675L,
        pauseP1,
        allowLeft0050: false,
      },
      cardSummary: summaryText,
    }),
    subType: severity,
  };
}
