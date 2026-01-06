const fetch = require("node-fetch");
const { RSI, MACD, Stochastic } = require("technicalindicators");

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
    months.push(`${yyyy}${mm}01`); // STOCK_DAY 用 date 指定該月即可，慣例用 01 [web:129]
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
 *  回傳 data 欄位順序常見為：日期、成交股數、成交金額、開盤、最高、最低、收盤、漲跌價差、成交筆數 [web:129]
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

// ✅ 對外維持同名 function：fetchStockHistory(symbol, period1, period2)
async function fetchStockHistory(symbol, period1, period2) {
  const stockNo = toTwseStockNo(symbol);
  console.log(`正在抓取 TWSE ${stockNo} 歷史資料...`);

  const months = enumerateMonths(period1, period2);
  const all = [];

  for (const yyyymm01 of months) {
    const rows = await fetchTwseStockDayMonth(stockNo, yyyymm01);
    all.push(...rows);

    // 保守節流
    await sleep(200);
  }

  // 篩回 period1~period2（含），並依日期排序
  const start = new Date(period1);
  const end = new Date(period2);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const filtered = all
    .filter((x) => {
      const d = new Date(x.date);
      d.setHours(0, 0, 0, 0);
      return d >= start && d <= end;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  console.log(`抓取 TWSE ${stockNo} 歷史資料完成，共 ${filtered.length} 筆`);
  return filtered;
}

/** -------------------------
 *  即時價：TWSE MIS getStockInfo.jsp
 *  -------------------------
 *  常見作法：先 GET fibest.jsp 拿 cookie，再 call getStockInfo.jsp，否則可能 msgArray 空 [web:167]
 *  常見欄位：msgArray[0].z(現價)、d(日期YYYYMMDD)、t(時間HH:MM:SS) [web:156]
 */

function toExCh(symbol) {
  const stockNo = toTwseStockNo(symbol);
  // 目前固定上市 tse_；00675L 是上市ETF，OK
  return `tse_${stockNo}.tw`;
}

function parseMisTimeToDate(dStr, tStr) {
  if (!dStr || !tStr) return null;
  const d = String(dStr).trim(); // YYYYMMDD
  const t = String(tStr).trim(); // HH:MM:SS
  if (!/^\d{8}$/.test(d)) return null;
  if (!/^\d{2}:\d{2}:\d{2}$/.test(t)) return null;

  // 明確指定台北時區
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

async function fetchRealTimePrice(symbol) {
  const stockNo = symbol.replace(".TW", "").trim(); // 00675L
  const cookie = await getMisCookie();

  // 用 MIS 回傳 queryTime.sysDate 當然最好，但第一次查不到時只能先用「今天(台北)」
  const todayTW = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }),
  );
  const yyyymmdd = `${todayTW.getFullYear()}${String(todayTW.getMonth() + 1).padStart(2, "0")}${String(todayTW.getDate()).padStart(2, "0")}`;

  // ✅ 關鍵：加上 _YYYYMMDD [web:184]
  const ex_ch = `tse_${stockNo}.tw_${yyyymmdd}`;

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
  if (!res.ok)
    throw new Error(
      `TWSE MIS HTTP ${res.status} ${res.statusText}: ${text.slice(0, 200)}`,
    );

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`TWSE MIS invalid JSON: ${text.slice(0, 200)}`);
  }

  const msg = Array.isArray(json.msgArray) ? json.msgArray[0] : null;
  if (!msg) return { price: null, time: null };
  console.log(
    "MIS rtcode:",
    json.rtcode,
    "rtmessage:",
    json.rtmessage,
    "msgArray length:",
    json.msgArray?.length,
  );

  return {
    price: parseNum(msg.z),
    time: parseMisTimeToDate(msg.d, msg.t),
  };
}

module.exports = {
  fetchStockHistory,
  fetchRealTimePrice,
  calculateIndicators,
};
