const fetch = require("node-fetch");
const { parseEnglishDateToISO, toTWDateKey } = require("../../utils/timeUtils");

/**
 * 以 TWSE Holiday Schedule（官網）判斷「今天是否開市」。
 * 做 in-memory cache：同一個 node process 內只抓一次。
 */
let holidayCache = { year: null, dates: null }; // dates: Set<YYYY-MM-DD>

async function loadHolidaySet(year) {
  if (holidayCache.year === year && holidayCache.dates) return holidayCache.dates;

  const url = "https://www.twse.com.tw/en/trading/holiday.html";
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 twse-client", Accept: "text/html" },
  });

  const html = await res.text();
  if (!res.ok) throw new Error(`TWSE holiday page HTTP ${res.status}: ${html.slice(0, 200)}`);

  // 用 regex 抓 "Month dd, YYYY"（只抓當年度）
  const re = new RegExp(
    `(January|February|March|April|May|June|July|August|September|October|November|December)\\s+\\d{1,2},\\s+${year}`,
    "g"
  );

  const set = new Set();
  const matches = html.match(re) || [];
  for (const t of matches) {
    const iso = parseEnglishDateToISO(t);
    if (iso) set.add(iso);
  }

  holidayCache = { year, dates: set };
  return set;
}

/**
 * 精準判斷：只要今天不是週末，且不在 TWSE holiday schedule 休市日期內，就視為有開市。
 * （不管現在是不是交易時間）
 */
async function isMarketOpenTodayTWSE() {
  const now = new Date();
  const todayKey = toTWDateKey(now);

  const twNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const dow = twNow.getDay(); // 0 Sun / 6 Sat
  if (dow === 0 || dow === 6) return false;

  const year = Number(todayKey.slice(0, 4));
  const holidaySet = await loadHolidaySet(year);

  return !holidaySet.has(todayKey);
}

module.exports = { isMarketOpenTodayTWSE };
