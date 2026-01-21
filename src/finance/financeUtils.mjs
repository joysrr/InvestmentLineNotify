import fetch from "node-fetch";
import ti from "technicalindicators";
import { parseEnglishDateToISO, toTWDateKey } from "../utils/timeUtils.mjs";

const { RSI, MACD, Stochastic } = ti;

let _twseHolidayCache = {
  year: null,
  dates: null, // Set<string> of "YYYY-MM-DD"
};

/** -------------------------
 *  共用工具
 *  -------------------------
 */

function toTwseStockNo(symbol) {
  return symbol.replace(".TW", "").trim(); // 00675L.TW -> 00675L
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseNum(v) {
  if (v == null) return null;
  const s = String(v).replace(/,/g, "").trim();
  if (s === "" || s === "--" || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// "106/08/01" -> "2017-08-01"
function rocDateToIso(rocYMD) {
  const [rocY, m, d] = String(rocYMD).trim().split("/");
  const adY = Number(rocY) + 1911;
  return `${adY}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// 產生起訖間月份清單：["20250101","20250201",...]
function enumerateMonths(startISO, endISO) {
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
    months.push(`${yyyy}${mm}01`); // 該月任一天即可，慣例用 01 [web:129]
    d.setMonth(d.getMonth() + 1);
  }
  return months;
}

/** -------------------------
 *  技術指標（維持原 function）
 *  -------------------------
 */

function calculateIndicators(history) {
  const closes = history.map((item) => item.close).filter(Boolean);
  const highs = history.map((item) => item.high).filter(Boolean);
  const lows = history.map((item) => item.low).filter(Boolean);
  return {
    closes,
    highs,
    lows,
    rsiArr: RSI.calculate({ values: closes, period: 14 }),
    macdArr: MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    }),
    kdArr: Stochastic.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 9,
      signalPeriod: 3,
    }),
  };
}

/** -------------------------
 *  歷史日線：TWSE STOCK_DAY（月資料）
 *  -------------------------
 *  API: https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=YYYYMMDD&stockNo=XXXX
 *  data 欄位順序常見為：日期、成交股數、成交金額、開盤、最高、最低、收盤、漲跌價差、成交筆數 [web:129]
 */

async function fetchTwseStockDayMonth(stockNo, yyyymm01) {
  const url =
    `https://www.twse.com.tw/exchangeReport/STOCK_DAY` +
    `?response=json&date=${yyyymm01}&stockNo=${encodeURIComponent(stockNo)}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 twse-client",
      Accept: "application/json",
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `TWSE HTTP ${res.status} ${res.statusText}: ${text.slice(0, 200)}`,
    );
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`TWSE invalid JSON: ${text.slice(0, 200)}`);
  }

  if (json.stat !== "OK") return [];

  return (json.data || []).map((row) => {
    const [
      rocDate,
      volumeStr,
      _amount,
      openStr,
      highStr,
      lowStr,
      closeStr,
      _chg,
      _count,
    ] = row;

    return {
      date: rocDateToIso(rocDate),
      open: parseNum(openStr),
      high: parseNum(highStr),
      low: parseNum(lowStr),
      close: parseNum(closeStr),
      volume: parseNum(volumeStr),
    };
  });
}

// ✅ 對外：維持同名 function
async function fetchStockHistory(symbol, period1, period2) {
  const stockNo = toTwseStockNo(symbol);

  const months = enumerateMonths(period1, period2);
  const all = [];

  for (const yyyymm01 of months) {
    const rows = await fetchTwseStockDayMonth(stockNo, yyyymm01);
    all.push(...rows);
    await sleep(200); // 保守節流
  }

  const start = new Date(period1);
  const end = new Date(period2);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return all
    .filter((x) => {
      const d = new Date(x.date);
      d.setHours(0, 0, 0, 0);
      return d >= start && d <= end;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

/** -------------------------
 *  即時價：TWSE MIS getStockInfo.jsp
 *  -------------------------
 *  常見作法：先 GET fibest.jsp 拿 cookie，再 call getStockInfo.jsp，否則可能 msgArray 空 [web:156]
 *  常見欄位：msgArray[0].z(現價)、d(日期YYYYMMDD)、t(時間HH:MM:SS) [web:156]
 */

function toExCh(symbol) {
  const stockNo = toTwseStockNo(symbol);
  // 你固定抓 00675L（上市ETF），tse_ OK
  return `tse_${stockNo}.tw`;
}

function parseMisTimeToDate(dStr, tStr) {
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

async function getMisCookie() {
  const res = await fetch(
    "https://mis.twse.com.tw/stock/fibest.jsp?lang=zh_tw",
    {
      headers: {
        "User-Agent": "Mozilla/5.0 twse-client",
        Accept: "text/html,application/xhtml+xml",
      },
    },
  );

  const setCookie = res.headers.raw?.()["set-cookie"] || [];
  const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  return cookie || null;
}

async function fetchLatestCloseFromTwseStockDay(symbol) {
  const stockNo = toTwseStockNo(symbol);

  const todayTW = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }),
  );
  const yyyymm01 = `${todayTW.getFullYear()}${String(todayTW.getMonth() + 1).padStart(2, "0")}01`;

  const rows = await fetchTwseStockDayMonth(stockNo, yyyymm01);
  if (rows.length > 0) return rows[rows.length - 1]; // 當月最近交易日
  return null;
}

// ✅ 對外：維持同名 function（不重試；即時抓不到就回退收盤）
async function fetchRealTimePrice(symbol) {
  // 1) 試一次 MIS 即時
  try {
    const ex_ch = toExCh(symbol);
    const cookie = await getMisCookie();

    const url =
      `https://mis.twse.com.tw/stock/api/getStockInfo.jsp` +
      `?ex_ch=${encodeURIComponent(ex_ch)}&json=1&delay=0&_=${Date.now()}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 twse-client",
        Accept: "application/json",
        Referer: "https://mis.twse.com.tw/stock/fibest.jsp",
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });

    const text = await res.text();
    if (res.ok) {
      const json = JSON.parse(text);
      const msg = Array.isArray(json.msgArray) ? json.msgArray[0] : null;

      if (msg) {
        const price = parseNum(msg.z); // z 可能是 "-" / "--" [web:156]
        const time = parseMisTimeToDate(msg.d, msg.t);

        if (price != null && Number.isFinite(price)) {
          return { price, time };
        }
      }
    }
  } catch (_) {
    // 故意吞掉：改走收盤 fallback
  }

  // 2) fallback：最近收盤價（STOCK_DAY）
  const latest = await fetchLatestCloseFromTwseStockDay(symbol);
  if (latest?.close != null) {
    return {
      price: latest.close,
      time: new Date(`${latest.date}T13:30:00+08:00`), // 用收盤時間當代表
    };
  }

  return { price: null, time: null };
}

async function loadTwseHolidaySet(year) {
  if (_twseHolidayCache.year === year && _twseHolidayCache.dates) {
    return _twseHolidayCache.dates;
  }

  const url = "https://www.twse.com.tw/en/trading/holiday.html";
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 twse-client",
      Accept: "text/html",
    },
  });
  const html = await res.text();
  if (!res.ok)
    throw new Error(
      `TWSE holiday page HTTP ${res.status}: ${html.slice(0, 200)}`,
    );

  // 很多年份會直接出現在頁面表格中；這裡用簡單 regex 抓出 "..., 2026" 這種片段再轉 Date
  // 目標：抓出當年度所有 "Month dd, yyyy" 字串
  const re = new RegExp(
    `(January|February|March|April|May|June|July|August|September|October|November|December)\\s+\\d{1,2},\\s+${year}`,
    "g",
  );

  const set = new Set();
  const matches = html.match(re) || [];
  for (const t of matches) {
    const iso = parseEnglishDateToISO(t);
    if (iso) set.add(iso);
  }

  _twseHolidayCache = { year, dates: set };
  return set;
}

async function isMarketOpenTodayTWSE() {
  const now = new Date();
  const todayKey = toTWDateKey(now);

  // 週末一定休市（台股不會週末開市；若遇到補班補交易日是例外，但通常 TWSE 會在 holiday schedule 註記）
  const twNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }),
  );
  const dow = twNow.getDay(); // 0=Sun,6=Sat
  if (dow === 0 || dow === 6) return false;

  const year = Number(todayKey.slice(0, 4));
  const holidaySet = await loadTwseHolidaySet(year);

  // 只要今天不是 holiday schedule 列出的 “No Trading” 日期，就視為有開市
  return !holidaySet.has(todayKey);
}

export {
  fetchStockHistory,
  fetchRealTimePrice,
  calculateIndicators,
  isMarketOpenTodayTWSE,
};
