/**
 * 將可能含逗號、空字串、"-"/"--" 的數字字串轉成 number。
 * TWSE/MIS 常會回 "-" 表示無資料，這裡統一轉成 null。
 */
function parseNumberOrNull(v) {
  if (v == null) return null;
  const s = String(v).replace(/,/g, "").trim();
  if (s === "" || s === "--" || s === "-") return null;

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export { parseNumberOrNull };