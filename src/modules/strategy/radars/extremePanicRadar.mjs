/**
 * @file extremePanicRadar.mjs
 * @description 雷達 3：歷史級極度恐慌雷達 (Extreme Panic Radar)
 * 監控 VIX 恐慌指數、加權指數單日暴跌與季線極端負乖離率。
 * 觸發時嚴格凍結 00675L，啟動 0050 左側定錨佈局；並提供右側 Triple-Gate 三綠燈評估工具。
 */

import { RADAR_IDS, createRadarResult } from "./types.mjs";

/**
 * 計算分位數 (Nearest Rank)
 * @param {number[]} arr
 * @param {number} p - 0 ~ 100
 * @returns {number}
 */
function calcPercentile(arr, p) {
  if (!arr || arr.length === 0) return 35.0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

/**
 * 評估雷達 3：歷史級極度恐慌雷達
 * @param {Object} input
 * @param {number} input.vix - 當前 VIX 數值 (如 38.0)
 * @param {number} input.taiexReturn - 大盤單日報酬率 (如 -0.045 代表 -4.5%)
 * @param {number} input.bias60 - 季線乖離率 (如 -0.12 代表 -12%)
 * @param {number[]} [input.vixHistory] - 過去歷史 VIX 數值序列 (建議 250 天)
 * @returns {Object} 雷達標準輸出合約
 */
export function evaluateExtremePanicRadar({
  vix = 18.0,
  taiexReturn = 0,
  bias60 = 0,
  vixHistory = [],
}) {
  const hasHistory = Array.isArray(vixHistory) && vixHistory.length >= 30;
  const p98Vix = hasHistory ? calcPercentile(vixHistory, 98) : 35.0;

  // 1. 觸發條件檢驗 (任一滿足即為歷史級恐慌)
  const isVixExtreme = vix >= 35.0 || (hasHistory && vix >= p98Vix);
  const isTaiexCrash = taiexReturn <= -0.045; // 單日崩跌 >= 4.5%
  const isBiasOversold = bias60 <= -0.12; // 季線負乖離 >= 12%

  const isTriggered = isVixExtreme || isTaiexCrash || isBiasOversold;

  if (!isTriggered) {
    return createRadarResult({
      radarId: RADAR_IDS.EXTREME_PANIC,
      triggered: false,
      metrics: {
        vix,
        p98Vix,
        taiexReturn,
        bias60,
        isVixExtreme,
        isTaiexCrash,
        isBiasOversold,
      },
      constraints: {
        freeze00675L: false,
        allowLeft0050: false,
        pauseP1: false,
      },
      cardSummary: null,
    });
  }

  // 整理觸發細項文字
  const triggerReasons = [];
  if (isVixExtreme) triggerReasons.push(`VIX 飆升至 ${vix.toFixed(1)}`);
  if (isTaiexCrash)
    triggerReasons.push(`大盤單日重挫 ${(taiexReturn * 100).toFixed(1)}%`);
  if (isBiasOversold)
    triggerReasons.push(`季線負乖離 ${(bias60 * 100).toFixed(1)}%`);

  const summaryText = `🚨【歷史級極度恐慌雷達：觸發】(${triggerReasons.join(" | ")})。市場陷入極度恐慌，紀律：0050 左側分批布局啟動，00675L 嚴格凍結等待右側回落，P0 正常執行。`;

  return createRadarResult({
    radarId: RADAR_IDS.EXTREME_PANIC,
    triggered: true,
    metrics: {
      vix,
      p98Vix,
      taiexReturn,
      bias60,
      isVixExtreme,
      isTaiexCrash,
      isBiasOversold,
    },
    constraints: {
      freeze00675L: true, // 00675L 嚴格凍結
      allowLeft0050: true, // 啟動 0050 左側定錨加碼
      pauseP1: false, // P1 預備金允許打入 0050
    },
    cardSummary: summaryText,
  });
}

/**
 * 評估 Triple-Gate 三道綠燈 (00675L 右側動態解鎖檢驗器)
 * @param {Object} input
 * @param {number} input.currentVix - 當前 VIX 數值
 * @param {number} input.peakVix - 本波恐慌 VIX 最高點
 * @param {number} input.taiexClose - 大盤當前收盤價
 * @param {number} input.taiexSma5 - 大盤 5 日均線數值
 * @returns {Object} 解鎖檢驗結果
 */
export function evaluateTripleGate({
  currentVix = 20,
  peakVix = 35,
  taiexClose = 0,
  taiexSma5 = 0,
}) {
  // 綠燈 1：VIX 回落至常態上限以下 (<= 28)
  const gate1_vixBelow28 = currentVix <= 28.0;

  // 綠燈 2：VIX 自本波峰值回落 >= 20%
  const gate2_vixDrop20Pct =
    peakVix > 0 ? currentVix <= peakVix * 0.8 : currentVix <= 25.0;

  // 綠燈 3：大盤收盤價站上 5 日均線 (動能回升)
  const gate3_closeAboveSma5 = taiexClose >= taiexSma5;

  const unlocked = Boolean(
    gate1_vixBelow28 && gate2_vixDrop20Pct && gate3_closeAboveSma5,
  );

  const summary = unlocked
    ? `🟢【00675L 右側解鎖：三綠燈全亮】VIX ${currentVix.toFixed(1)} (<=28 且回落20%)，指數站上 5MA (${taiexClose} >= ${taiexSma5})。允許右側進場。`
    : `🔴【00675L 右側解鎖：條件未齊備】門檻檢驗：VIX<=28 (${gate1_vixBelow28 ? "✓" : "✗"}) | 峰值回落20% (${gate2_vixDrop20Pct ? "✓" : "✗"}) | 站上5MA (${gate3_closeAboveSma5 ? "✓" : "✗"})。`;

  return {
    unlocked,
    gate1_vixBelow28,
    gate2_vixDrop20Pct,
    gate3_closeAboveSma5,
    summary,
  };
}
