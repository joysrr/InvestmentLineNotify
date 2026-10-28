/**
 * @file marginSettlingRadar.mjs
 * @description 雷達 2：籌碼沉澱偵測器 (Margin Settling Radar)
 * 監控大盤融資維持率水位與融資單日出清速度，於散戶斷頭殺出時提示 0050 價值底佈局。
 */

import { RADAR_IDS, createRadarResult } from "./types.mjs";

/**
 * 計算分位數 (Nearest Rank)
 * @param {number[]} arr
 * @param {number} p - 0 ~ 100
 * @returns {number}
 */
function calcPercentile(arr, p) {
  if (!arr || arr.length === 0) return 140.0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

/**
 * 評估雷達 2：籌碼沉澱偵測器
 * @param {Object} input
 * @param {number} input.maintenanceRatio - 當前大盤融資維持率 (如 136.5 代表 136.5%)
 * @param {number} input.marginBalanceChangePct - 融資單日增減率 (如 -0.018 代表 -1.8%)
 * @param {number[]} [input.marginHistory] - 過去歷史大盤融資維持率序列
 * @returns {Object} 雷達標準輸出合約
 */
export function evaluateMarginSettlingRadar({
  maintenanceRatio = 160.0,
  marginBalanceChangePct = 0,
  marginHistory = [],
}) {
  const hasHistory = Array.isArray(marginHistory) && marginHistory.length >= 30;
  const p10Margin = hasHistory ? calcPercentile(marginHistory, 10) : 140.0;

  // 1. 水位閘門 (低於絕對 140% 或 跌破歷史 P10)
  const isWaterLevelOk =
    maintenanceRatio < 140.0 || (hasHistory && maintenanceRatio < p10Margin);

  // 2. 出清速度 (單日融資減少 >= 1.5%)
  const isSpeedOk = marginBalanceChangePct <= -0.015;

  // 雙條件嚴格過濾
  const isTriggered = Boolean(isWaterLevelOk && isSpeedOk);

  if (!isTriggered) {
    return createRadarResult({
      radarId: RADAR_IDS.MARGIN_SETTLING,
      triggered: false,
      metrics: {
        maintenanceRatio,
        marginBalanceChangePct,
        p10Margin,
        isWaterLevelOk,
        isSpeedOk,
      },
      constraints: {
        freeze00675L: false,
        allowLeft0050: false,
      },
      cardSummary: null,
    });
  }

  const mrPct = Number(maintenanceRatio).toFixed(1);
  const changePct = (marginBalanceChangePct * 100).toFixed(1);

  const summaryText = `🚨【籌碼沉澱偵測器：觸發】大盤維持率降至 ${mrPct}%，融資單日急減 ${changePct}%。浮額加速沉澱，紀律：0050 啟動分批低接，00675L 凍結等待右側，P0 正常執行。`;

  return createRadarResult({
    radarId: RADAR_IDS.MARGIN_SETTLING,
    triggered: true,
    metrics: {
      maintenanceRatio,
      marginBalanceChangePct,
      p10Margin,
      isWaterLevelOk,
      isSpeedOk,
    },
    constraints: {
      freeze00675L: true, // 00675L 凍結
      allowLeft0050: true, // 允許 0050 左側定錨加碼
    },
    cardSummary: summaryText,
  });
}
