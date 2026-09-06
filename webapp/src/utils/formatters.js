/**
 * 格式化通用公用函式庫 (Global Formatters)
 * 預設將數字四捨五入至小數點後兩位，僅影響 UI 渲染層，保留原生狀態精度。
 */

/**
 * 格式化數值為指定位數之小數（預設 2 位）
 * @param {number|string|null|undefined} val - 輸入數值
 * @param {number} [digits=2] - 小數位數
 * @param {string} [fallback="—"] - 無效時回傳字串
 * @returns {string} 格式化後字串
 */
export function fmtDecimal(val, digits = 2, fallback = "—") {
  if (val === null || val === undefined || val === "") return fallback;
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return num.toFixed(digits);
}

/**
 * 格式化數值為倍數 (例如 0.94x)
 * @param {number|string|null|undefined} val
 * @param {number} [digits=2]
 * @param {string} [fallback="—"]
 * @returns {string}
 */
export function fmtRatio(val, digits = 2, fallback = "—") {
  const formatted = fmtDecimal(val, digits, null);
  if (formatted === null) return fallback;
  return `${formatted}x`;
}

/**
 * 格式化數值為百分比 (例如 40.12%)
 * @param {number|string|null|undefined} val
 * @param {number} [digits=2]
 * @param {string} [fallback="—"]
 * @returns {string}
 */
export function fmtPercent(val, digits = 2, fallback = "—") {
  const formatted = fmtDecimal(val, digits, null);
  if (formatted === null) return fallback;
  return `${formatted}%`;
}
