/**
 * CSS 變數 → canvas/echarts 可解析顏色
 * 背景：ECharts 的 color / colorStops 會直接丟給 CanvasGradient.addColorStop，
 *      canvas 不認識 `var(--iln-*)`，會拋 SyntaxError 導致整張圖初始化失敗。
 * 解法：用離屏探針 span 讀 getComputedStyle 的實際色值字串。
 *
 * - 支援直接色值字串（原樣回傳）
 * - 支援 "var(--iln-x)" 或 "--iln-x"
 * - alpha 可選（0-1），給值則輸出帶透明度的色值
 * - 結果快取；主題為固定深色，快取安全
 */
const CACHE = new Map();

// --iln-brand 的深色 M3 primary 值，解析失敗時保底
const FALLBACK = { r: 208, g: 188, b: 255 };

function parseRgb(computed) {
  const m = String(computed).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3] };
}

export function resolveCssColor(input, alpha = null) {
  if (typeof input !== "string") return input;
  const raw = input.trim();
  if (!raw) return raw;

  // 已經是具體色值字串（非變數）—— 原樣回傳
  if (!raw.startsWith("--") && !raw.startsWith("var(")) {
    return raw;
  }

  let varName = raw;
  if (raw.startsWith("var(")) {
    const m = raw.match(/^var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)$/);
    if (!m) return raw;
    varName = m[1];
  }

  const key = varName + (alpha != null ? `|${alpha}` : "");
  if (CACHE.has(key)) return CACHE.get(key);

  let rgb = null;
  try {
    const probe = document.createElement("span");
    probe.style.cssText = `position:fixed;left:-9999px;top:-9999px;color:var(${varName})`;
    document.body.appendChild(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove();
    rgb = parseRgb(computed);
  } catch {
    rgb = null;
  }
  if (!rgb) rgb = FALLBACK;

  let out;
  if (alpha == null) out = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`; // iln-color-allow: canvas 需要具體色值字串，無法用 CSS 變數
  else out = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`; // iln-color-allow: canvas 需要帶透明度色值字串

  CACHE.set(key, out);
  return out;
}

/** 清空快取（主題切換時呼叫） */
export function clearCssColorCache() {
  CACHE.clear();
}
