/**
 * 等待執行時間
 * @param {等待時間(毫秒)} ms
 * @returns
 */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * ROC 日期轉 ISO： "106/08/01" -> "2017-08-01"
 * TWSE STOCK_DAY 會回民國日期。
 */
export function rocDateToIso(rocYMD) {
  const [rocY, m, d] = String(rocYMD).trim().split("/");
  const adY = Number(rocY) + 1911;
  return `${adY}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * 產生起訖日期之間「月份」清單（用於 TWSE STOCK_DAY 月查詢）
 * 回傳 ["YYYYMM01", ...]
 */
export function enumerateMonths(startISO, endISO) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const months = [];
  const d = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (d <= endMonth) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${yyyy}${mm}01`);
    d.setMonth(d.getMonth() + 1);
  }

  return months;
}

/**
 * symbol 轉 TWSE stockNo： "00675L.TW" -> "00675L"
 */
export function toTwseStockNo(symbol) {
  return String(symbol).replace(".TW", "").trim();
}

export function toArray(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

/**
 * 將 Markdown 轉為 LINE Flex spans
 * 支援：
 * - **粗體**
 * - 同一行多段粗體
 * - 自動合併相鄰普通文字 span
 */
export function parseMarkdownToSpans(
  text,
  { normalColor = "#333333", boldColor = "#111111" } = {},
) {
  if (!text) return [];

  const s = String(text);

  // match **...** (non-greedy)
  const boldRegex = /\*\*(.+?)\*\*/g;

  const spans = [];
  let lastIndex = 0;
  let match;

  const pushSpan = (span) => {
    if (!span?.text) return;

    // 合併相鄰的「普通 span」（避免 spans 太碎）
    const prev = spans[spans.length - 1];
    const isPrevNormal =
      prev && !prev.weight && !prev.decoration && prev.color === normalColor;
    const isThisNormal =
      !span.weight && !span.decoration && span.color === normalColor;

    if (isPrevNormal && isThisNormal) {
      prev.text += span.text;
      return;
    }

    spans.push(span);
  };

  while ((match = boldRegex.exec(s)) !== null) {
    // 普通文字
    if (match.index > lastIndex) {
      pushSpan({
        type: "span",
        text: s.substring(lastIndex, match.index),
        color: normalColor,
      });
    }

    // 粗體文字（match[1]）
    pushSpan({
      type: "span",
      text: match[1],
      weight: "bold",
      color: boldColor,
    });

    lastIndex = boldRegex.lastIndex;
  }

  // 剩餘普通文字
  if (lastIndex < s.length) {
    pushSpan({
      type: "span",
      text: s.substring(lastIndex),
      color: normalColor,
    });
  }

  // 最後防呆：把單顆 * 之類的符號移除（避免 LLM 亂出星號）
  for (const sp of spans) {
    sp.text = sp.text.replace(/\*/g, "");
  }

  return spans;
}

/**
 * 把整段文字拆成多個 Flex text 元件（每行一個）
 * - 支援 "- " 清單轉換成 "◦ "
 * - 忽略空行
 * - 可選：第一行（📌）視覺強化
 */
export function buildFlexTextBlocks(rawText, opt = {}) {
  const {
    textSize = "xs",
    margin = "sm",
    normalColor = "#333333",
    boldColor = "#111111",
    bullet = "◦",
    highlightFirstLine = true,
  } = opt;

  if (!rawText) return [];

  const lines = String(rawText)
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return lines.map((line, idx) => {
    // 清單美化：只處理 "- " 或 "• "
    const cleanLine = line.replace(/^(?:•|-)\s+/, `${bullet} `);

    const contents = parseMarkdownToSpans(cleanLine, {
      normalColor,
      boldColor,
    });

    // LINE Flex Text：使用 spans 時用 contents，不要同時塞 text
    const base = {
      type: "text",
      contents,
      wrap: true,
      size: textSize,
      margin,
    };

    // 可選：第一行（通常是 📌）突出一點
    if (highlightFirstLine && idx === 0) {
      return {
        ...base,
        size: "sm",
        weight: "bold",
        color: "#111111",
      };
    }

    return base;
  });
}

/**
 * 將可能含逗號、空字串、"-"/"--" 的數字字串轉成 number。
 * TWSE/MIS 常會回 "-" 表示無資料，這裡統一轉成 null。
 */
export function parseNumberOrNull(v) {
  if (v == null) return null;
  const s = String(v).replace(/,/g, "").trim();
  if (s === "" || s === "--" || s === "-") return null;

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * 取得台北星期幾：0=週日 ... 6=週六
 */
export function getTaiwanDayOfWeek() {
  const now = new Date();
  const taiwanTime = new Date(now.getTime() + 8 * 3600 * 1000);
  return taiwanTime.getUTCDay();
}

/**
 * 取得台北日期（1~31）
 */
export function getTaiwanDate() {
  const now = new Date();
  const taiwanTime = new Date(now.getTime() + 8 * 3600 * 1000);
  return taiwanTime.getUTCDate();
}

/**
 * 是否季末最後一日（以台北日期判斷）
 */
export function isQuarterEnd() {
  const now = new Date();
  const taiwanTime = new Date(now.getTime() + 8 * 3600 * 1000);
  const month = taiwanTime.getUTCMonth() + 1;
  const date = taiwanTime.getUTCDate();

  if ([3, 6, 9, 12].includes(month)) {
    const lastDay = new Date(
      taiwanTime.getUTCFullYear(),
      month,
      0,
    ).getUTCDate();
    return date === lastDay;
  }
  return false;
}

/**
 * 將任意 Date 轉成「台北日期 key」：YYYY-MM-DD
 * 用於避免 toLocaleDateString() 因不同環境輸出格式不一致造成比較失敗。
 */
export function toTWDateKey(d) {
  const tw = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const y = tw.getFullYear();
  const m = String(tw.getMonth() + 1).padStart(2, "0");
  const day = String(tw.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 解析英文字日期（Holiday schedule 可能出現 "January 1, 2026" 這類）
 */
export function parseEnglishDateToISO(dateText) {
  const d = new Date(dateText);
  if (Number.isNaN(d.getTime())) return null;

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * HTML 跳脫函式
 * @param {需要轉換的文字} text
 * @returns
 */
export function escapeHTML(text) {
  if (text == null) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function toExCh(symbol) {
  const stockNo = toTwseStockNo(symbol);
  // 你固定抓 00675L（上市ETF），tse_ OK
  return `tse_${stockNo}.tw`;
}

export function parseMisTimeToDate(dStr, tStr) {
  if (!dStr || !tStr) return null;
  const d = String(dStr).trim(); // YYYYMMDD
  const t = String(tStr).trim(); // HH:MM:SS
  if (!/^\d{8}$/.test(d)) return null;
  if (!/^\d{2}:\d{2}:\d{2}$/.test(t)) return null;

  // 用 +08:00 組，避免系統時區影響
  const iso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t}+08:00`;
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function parseNum(v) {
  if (v == null) return null;
  const s = String(v).replace(/,/g, "").trim();
  if (s === "" || s === "--" || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}