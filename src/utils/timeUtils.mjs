/**
 * 取得台北星期幾：0=週日 ... 6=週六
 */
function getTaiwanDayOfWeek() {
  const now = new Date();
  const taiwanTime = new Date(now.getTime() + 8 * 3600 * 1000);
  return taiwanTime.getUTCDay();
}

/**
 * 取得台北日期（1~31）
 */
function getTaiwanDate() {
  const now = new Date();
  const taiwanTime = new Date(now.getTime() + 8 * 3600 * 1000);
  return taiwanTime.getUTCDate();
}

/**
 * 是否季末最後一日（以台北日期判斷）
 */
function isQuarterEnd() {
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
function toTWDateKey(d) {
  const tw = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const y = tw.getFullYear();
  const m = String(tw.getMonth() + 1).padStart(2, "0");
  const day = String(tw.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 解析英文字日期（Holiday schedule 可能出現 "January 1, 2026" 這類）
 */
function parseEnglishDateToISO(dateText) {
  const d = new Date(dateText);
  if (Number.isNaN(d.getTime())) return null;

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export {
  getTaiwanDayOfWeek,
  getTaiwanDate,
  isQuarterEnd,
  toTWDateKey,
  parseEnglishDateToISO,
};