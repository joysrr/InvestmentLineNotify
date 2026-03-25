/**
 * 等待執行時間
 * @param {number} ms - 等待時間(毫秒)
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
 * ISO 日期轉 ROC： "2017-08-01" -> "106/08/01"
 * 或支援轉換成無斜線格式： "2026-03" -> "11503"
 */
export function isoDateToROC(isoText, withSlash = true) {
  if (!isoText) return null;

  const d = new Date(isoText);
  if (isNaN(d.getTime())) return null;

  const adY = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  const rocY = String(adY - 1911);
  const isMonthOnly = isoText.trim().length === 7;

  if (withSlash) {
    return isMonthOnly ? `${rocY}/${m}` : `${rocY}/${m}/${day}`;
  } else {
    return isMonthOnly ? `${rocY}${m}` : `${rocY}${m}${day}`;
  }
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

export function toExCh(symbol) {
  const stockNo = toTwseStockNo(symbol);
  return `tse_${stockNo}.tw`;
}

export function toArray(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

/**
 * 將可能含逗號、空字串、"-"/"--" 的數字字串轉成 number。
 */
export function parseNumberOrNull(v) {
  if (v == null) return null;
  const s = String(v).replace(/,/g, "").trim();
  if (s === "" || s === "--" || s === "-") return null;

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * HTML 跳脫函式
 */
export function escapeHTML(text) {
  if (text == null) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function parseMisTimeToDate(dStr, tStr) {
  if (!dStr || !tStr) return null;
  const d = String(dStr).trim();
  const t = String(tStr).trim();
  if (!/^\d{8}$/.test(d)) return null;
  if (!/^\d{2}:\d{2}:\d{2}$/.test(t)) return null;

  const iso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t}+08:00`;
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? null : dt;
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

// ============================================================================
// 🕰️ 台北時間核心處理模組
// ============================================================================

/**
 * 迷你台北時間處理模組 (Factory Function)
 * @param {Date|string|number} input - 可選，傳入要轉換的時間，預設為當下
 * @returns 包含各項屬性與格式化方法的物件
 */
export function TwDate(input = new Date()) {
  const sourceDate = new Date(input);

  // 若傳入無效日期，回傳防呆空物件避免整個系統崩潰
  if (isNaN(sourceDate.getTime())) {
    console.warn("⚠️ TwDate 收到無效的日期格式:", input);
    return {
      isValid: false,
      formatDateKey: () => "",
      formatDateTime: () => "",
      formatMonthKey: () => "",
    };
  }

  // 1. 統一產生台北時間的 Date 物件 (徹底消滅 +8 小時的暴力解法)
  const tw = new Date(
    sourceDate.toLocaleString("en-US", { timeZone: "Asia/Taipei" }),
  );

  // 2. 預先解析常用屬性
  const y = tw.getFullYear();
  const m = tw.getMonth() + 1;
  const d = tw.getDate();
  const H = tw.getHours();
  const M = tw.getMinutes();
  const S = tw.getSeconds();
  const dayOfWeek = tw.getDay(); // 0=週日 ... 6=週六

  // 輔助補零函數
  const pad = (num) => String(num).padStart(2, "0");

  return {
    isValid: true,

    // === 屬性 ===
    dateObj: tw,
    year: y,
    month: m,
    date: d,
    dayOfWeek,
    hour: H,
    minute: M,
    second: S,

    // === 格式化方法 ===
    /** 回傳 YYYY-MM-DD */
    formatDateKey: () => `${y}-${pad(m)}-${pad(d)}`,

    /** 回傳 YYYYMM */
    formatMonthKey: () => `${y}${pad(m)}`,

    /** 回傳 YYYY/MM/DD HH:mm (專供新聞與排版使用) */
    formatDateTime: () => `${y}/${pad(m)}/${pad(d)} ${pad(H)}:${pad(M)}`,

    // === 判斷方法 ===
    /** 是否為季末最後一日 */
    isQuarterEnd: () => {
      if (![3, 6, 9, 12].includes(m)) return false;
      const lastDay = new Date(y, m, 0).getDate();
      return d === lastDay;
    },
  };
}

// ============================================================================
// 🌐 網路請求封裝
// ============================================================================

/**
 * 具備 Timeout 功能的 fetch 封裝
 */
export async function fetchWithTimeout(url, options = {}, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Request Timeout after ${timeout}ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}
