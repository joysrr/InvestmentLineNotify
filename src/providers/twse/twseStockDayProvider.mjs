import fetch from "node-fetch";
import { enumerateMonths, rocDateToIso, toTwseStockNo } from "../../utils/dateUtils.mjs";
import { parseNumberOrNull } from "../../utils/numberUtils.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildUrls(stockNo, yyyymm01) {
  const qs = `response=json&date=${yyyymm01}&stockNo=${encodeURIComponent(stockNo)}&_=${Date.now()}`;
  return [
    `https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY?${qs}`,
    `https://www.twse.com.tw/exchangeReport/STOCK_DAY?${qs}`,
  ];
}

/**
 * TWSE STOCK_DAY：查某股票「某月份」日成交資訊（JSON）
 * date 只要在該月即可（慣例用 YYYYMM01）
 * data 欄位順序常見為：日期、成交股數、成交金額、開盤、最高、最低、收盤、漲跌價差、成交筆數
 */
async function fetchStockDayMonth(stockNo, yyyymm01) {
  const urls = buildUrls(stockNo, yyyymm01);

  for (const url of urls) {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 twse-client",
        "Accept": "application/json",
        "Referer": "https://www.twse.com.tw/zh/trading/historical/stock-day.html", // 對應頁面 [web:724]
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
      },
    });

    const text = await res.text();

    const ct = res.headers.get("content-type") || "";
    const looksLikeJson = ct.includes("application/json") || text.trim().startsWith("{");

    // 成功才 parse
    if (res.ok && looksLikeJson) {
      let json;
      try { json = JSON.parse(text); }
      catch { continue; }
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
          open: parseNumberOrNull(openStr),
          high: parseNumberOrNull(highStr),
          low: parseNumberOrNull(lowStr),
          close: parseNumberOrNull(closeStr),
          volume: parseNumberOrNull(volumeStr),
        };
      });
    }

    // 不是 JSON 的錯誤頁就換下一條 URL
    if (!looksLikeJson || text.includes("<html") || text.includes("location.href")) continue;

    // 真的錯誤才丟出
    throw new Error(`TWSE STOCK_DAY HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  throw new Error("TWSE STOCK_DAY: all endpoints failed (non-JSON or blocked)");
}

/**
 * 對外：取得歷史區間日線（會逐月抓 STOCK_DAY 並合併）
 */
async function fetchStockHistory(symbol, period1, period2) {
  const stockNo = toTwseStockNo(symbol);
  const months = enumerateMonths(period1, period2);

  const all = [];
  for (const yyyymm01 of months) {
    const rows = await fetchStockDayMonth(stockNo, yyyymm01);
    all.push(...rows);

    // 保守：避免短時間大量打 TWSE
    await sleep(6000);
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

/**
 * 對外：取得「最近交易日」收盤價（用於即時價 fallback）
 * 策略：抓當月 STOCK_DAY，取最後一筆
 */
async function fetchLatestClose(symbol) {
  const stockNo = toTwseStockNo(symbol);
  const todayTW = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }),
  );
  const yyyymm01 = `${todayTW.getFullYear()}${String(todayTW.getMonth() + 1).padStart(2, "0")}01`;

  const rows = await fetchStockDayMonth(stockNo, yyyymm01);
  if (!rows.length) return null;

  return rows[rows.length - 1];
}

export {
  fetchStockHistory,
  fetchLatestClose,
};
