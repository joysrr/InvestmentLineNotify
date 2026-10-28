/**
 * @file types.mjs
 * @description 極端市場事件雷達核心常數與型別定義
 */

export const RADAR_IDS = Object.freeze({
  OVERNIGHT_SHOCK: "RADAR_OVERNIGHT_SHOCK",
  MARGIN_SETTLING: "RADAR_MARGIN_SETTLING",
  EXTREME_PANIC: "RADAR_EXTREME_PANIC",
  RETAIL_SENTIMENT: "RADAR_RETAIL_SENTIMENT",
});

export const NIGHT_SESSION_SEVERITY = Object.freeze({
  STRONG_RESONANCE: "STRONG_RESONANCE", // 強共振 (|r_night| >= 1.0% 同向)
  NORMAL_CONFIRM: "NORMAL_CONFIRM", // 普通確認 (0.5% <= |r_night| < 1.0% 同向)
  DIVERGENCE_BLUNT: "DIVERGENCE_BLUNT", // 背離鈍化 (|r_night| < 0.5% 或逆向)
  NONE: "NONE", // 未觸發或無夜盤
});

/**
 * 建立標準雷達輸出合約物件
 * @param {Object} params
 * @param {string} params.radarId
 * @param {boolean} params.triggered
 * @param {string} [params.severity]
 * @param {Object} [params.metrics]
 * @param {Object} [params.constraints]
 * @param {string|null} [params.cardSummary]
 * @returns {Object}
 */
export function createRadarResult({
  radarId,
  triggered = false,
  severity = NIGHT_SESSION_SEVERITY.NONE,
  metrics = {},
  constraints = {},
  cardSummary = null,
}) {
  return {
    radarId,
    triggered,
    severity,
    metrics,
    constraints: {
      freeze00675L: Boolean(constraints.freeze00675L),
      allowLeft0050: Boolean(constraints.allowLeft0050),
      p0Exempt: true, // P0 DCA 神聖不可侵犯，永遠為 true
      ...constraints,
    },
    cardSummary,
  };
}
