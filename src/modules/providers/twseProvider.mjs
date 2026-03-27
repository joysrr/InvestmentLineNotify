import https from "https";
import {
  TwDate,
  parseEnglishDateToISO,
  toTwseStockNo,
  parseNumberOrNull,
  enumerateMonths,
  rocDateToIso,
  sleep,
  toExCh,
  parseMisTimeToDate,
  fetchWithTimeout,
} from "../../utils/coreUtils.mjs";
import { fetchStrategyConfig } from "../strategy/signalRules.mjs";
import { archiveManager } from "../data/archiveManager.mjs";

const twseAgent = new https.Agent({
  keepAlive: true, // 啟用長連線，重複呼叫時省去 TLS 握手時間
  keepAliveMsecs: 10000,
  family: 4, // 關鍵：強制 IPv4 解析，避開 TWSE 爛掉的 IPv6 路由
  timeout: 5000,
});

// 通用的 fetch options，帶上 agent
const baseFetchOptions = {
  agent: twseAgent,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0",
    "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
  },
};

/**
 * 具有快取功能的單月資料抓取 (依賴 archiveManager)
 */
async function fetchStockDayMonthWithCache(stockNo, yyyymm01) {
  const monthKey = yyyymm01.substring(0, 6);
  const currentMonthKey = TwDate().formatMonthKey();

  // 1. 檢查快取：只有「非當月」才允許去讀取死存的檔案
  if (monthKey !== currentMonthKey) {
    const cachedData = await archiveManager.getStockHistory(stockNo, monthKey);
    if (cachedData) return cachedData; // 讀到就直接回傳，不再打 API
  }

  // 2. 打 TWSE API 獲取資料
  const rows = await fetchStockDayMonth(stockNo, yyyymm01);

  // 3. 寫入快取：資料不為空且「不是當月」，才永久存入 data 資料庫
  if (rows && rows.length > 0 && monthKey !== currentMonthKey) {
    try {
      await archiveManager.saveStockHistory(stockNo, monthKey, rows);
    } catch (err) {
      console.warn("寫入快取失敗:", err.message);
    }
  }

  return rows;
}

/**
 * 解析五檔字串的第一個價格（例如 "160.3000_160.2500_..." 取 160.3000）
 */
function firstPriceFromLevels(levelStr) {
  if (!levelStr) return null;
  const first = String(levelStr).split("_")[0];
  return parseNumberOrNull(first);
}

/**
 * 選擇「可用的即時參考價」
 */
function pickRealtimePrice(msg) {
  const last = parseNumberOrNull(msg?.z);
  const bid1 = firstPriceFromLevels(msg?.b);
  const ask1 = firstPriceFromLevels(msg?.a);

  const price = last ?? bid1 ?? ask1;
  const priceSource =
    last != null
      ? "last(z)"
      : bid1 != null
        ? "bid1(b)"
        : ask1 != null
          ? "ask1(a)"
          : "none";

  return { price, priceSource, last, bid1, ask1 };
}

// ============================================================================
// ⚡ 優化版 Cookie 快取系統 (加入 Promise Lock 防併發)
// ============================================================================
let _cookieCache = { cookie: null, loadedAt: 0 };
let _cookiePromise = null; // Promise 鎖
const COOKIE_TTL_MS = 10 * 60 * 1000;

async function getMisCookie() {
  const now = Date.now();
  if (_cookieCache.cookie && now - _cookieCache.loadedAt < COOKIE_TTL_MS) {
    return _cookieCache.cookie;
  }

  if (_cookiePromise) return _cookiePromise;

  _cookiePromise = (async () => {
    try {
      const res = await fetchWithTimeout(
        "https://mis.twse.com.tw/stock/fibest.jsp?lang=zh_tw",
        {
          ...baseFetchOptions,
          headers: {
            ...baseFetchOptions.headers,
            Accept: "text/html,application/xhtml+xml",
          },
        },
        8000,
      );

      const setCookie = res.headers.raw?.()["set-cookie"] || [];
      const cookie = setCookie.map((c) => c.split(";")[0]).join("; ") || null;

      _cookieCache = { cookie, loadedAt: Date.now() };
      return cookie;
    } catch (err) {
      console.warn(
        "⚠️ 獲取 TWSE Cookie 失敗 (將以無 Cookie 重試):",
        err.message,
      );
      return null;
    } finally {
      _cookiePromise = null;
    }
  })();

  return _cookiePromise;
}

/**
 * 嘗試抓 MIS 即時價（不含 retry）
 */
export async function fetchRealtimeFromMis(symbol) {
  const ex_ch = toExCh(symbol);
  const cookie = await getMisCookie();
  const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${encodeURIComponent(ex_ch)}&json=1&delay=0&_=${Date.now()}`;

  const res = await fetchWithTimeout(
    url,
    {
      ...baseFetchOptions,
      headers: {
        ...baseFetchOptions.headers,
        Accept: "application/json",
        Referer: "https://mis.twse.com.tw/stock/fibest.jsp",
        ...(cookie ? { Cookie: cookie } : {}),
      },
    },
    8000,
  );

  const text = await res.text();
  if (!res.ok)
    throw new Error(`TWSE MIS HTTP ${res.status}: ${text.slice(0, 200)}`);

  const json = JSON.parse(text);
  const msg = Array.isArray(json.msgArray) ? json.msgArray[0] : null;
  if (!msg) {
    return { price: null, time: null, priceSource: "none", rawTime: {} };
  }

  const tlong = parseNumberOrNull(msg.tlong);
  const time =
    tlong != null ? new Date(tlong) : parseMisTimeToDate(msg.d, msg.t);
  const { price, priceSource } = pickRealtimePrice(msg);

  return {
    price,
    time,
    priceSource,
    rawTime: { tlong: msg.tlong, d: msg.d, t: msg.t },
  };
}

function extractCookie(setCookieHeader) {
  if (!setCookieHeader) return "";
  const arr = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader];
  return arr.map((x) => x.split(";")[0]).join("; ");
}

function formatTaifexDateTime(CDate, CTime) {
  if (!CDate || !CTime || CDate.length !== 8) return null;
  const t = CTime.padStart(6, "0");
  const hh = t.slice(0, 2);
  const mm = t.slice(2, 4);
  const ss = t.slice(4, 6);
  return `${CDate.slice(0, 4)}/${CDate.slice(4, 6)}/${CDate.slice(6, 8)} ${hh}:${mm}:${ss}`;
}

// ============================================================================
// 📊 期交所 VIX 獲取
// ============================================================================
export async function getTwVix() {
  const TAIFEX_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

  try {
    const preRes = await fetchWithTimeout(
      "https://mis.taifex.com.tw/futures/VolatilityQuotes/",
      { headers: { "User-Agent": TAIFEX_UA } },
      8000,
    );
    const cookie = extractCookie(
      preRes.headers.raw?.()["set-cookie"] || preRes.headers.get("set-cookie"),
    );

    const url = "https://mis.taifex.com.tw/futures/api/getQuoteDetail";
    const candidates = ["TAIWANVIX", "RTD:1:TAIWANVIX", "RTD:1:VIX"];
    const strategy = await fetchStrategyConfig();

    for (const symbol of candidates) {
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": TAIFEX_UA,
            Referer: "https://mis.taifex.com.tw/futures/VolatilityQuotes/",
            Origin: "https://mis.taifex.com.tw",
            ...(cookie ? { Cookie: cookie } : {}),
          },
          body: JSON.stringify({ SymbolID: [symbol] }),
        },
        8000,
      );

      const data = await res.json();
      const quote = data?.RtData?.QuoteList?.[0] ?? data?.QuoteDetail?.[0];
      if (!quote) continue;

      let value =
        parseNumberOrNull(quote.CLastPrice) ||
        parseNumberOrNull(quote.CRefPrice);
      if (value == null || value <= 0) continue;

      const prev = parseNumberOrNull(quote.CRefPrice);
      const change = value != null && prev != null ? value - prev : 0;

      let status = "中性";
      if (value < strategy.threshold.vixLowComplacency) status = "安逸";
      else if (value > strategy.threshold.vixHighFear) status = "緊張";

      return {
        symbolUsed: symbol,
        value,
        change,
        status,
        date: quote.CDate ?? null,
        time: quote.CTime ?? null,
        dateTimeText: formatTaifexDateTime(quote.CDate, quote.CTime),
      };
    }
    return null;
  } catch (e) {
    console.error("VIX 抓取失敗:", e.message);
    return null;
  }
}

let holidayCache = { year: null, dates: null };

export async function loadHolidaySet(year) {
  if (holidayCache.year === year && holidayCache.dates)
    return holidayCache.dates;

  const res = await fetchWithTimeout(
    "https://www.twse.com.tw/en/trading/holiday.html",
    {
      ...baseFetchOptions,
      headers: { ...baseFetchOptions.headers, Accept: "text/html" },
    },
    8000,
  );

  const html = await res.text();
  if (!res.ok)
    throw new Error(
      `TWSE holiday page HTTP ${res.status}: ${html.slice(0, 200)}`,
    );

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

  holidayCache = { year, dates: set };
  return set;
}

export async function isMarketOpenTodayTWSE() {
  // 1. 取得當下的台北時間整合物件
  const now = TwDate();

  // 2. 判斷是否為週末 (0=週日, 6=週六)
  if (now.dayOfWeek === 0 || now.dayOfWeek === 6) return false;

  // 3. 取得 YYYY-MM-DD 字串與當前年份
  const todayKey = now.formatDateKey();
  const year = now.year;

  // 4. 檢查是否為國定假日
  const holidaySet = await loadHolidaySet(year);
  return !holidaySet.has(todayKey);
}

function buildUrls(stockNo, yyyymm01) {
  const qs = `response=json&date=${yyyymm01}&stockNo=${encodeURIComponent(stockNo)}&_=${Date.now()}`;
  return [
    `https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY?${qs}`,
    `https://www.twse.com.tw/exchangeReport/STOCK_DAY?${qs}`,
  ];
}

async function fetchStockDayMonth(stockNo, yyyymm01) {
  const urls = buildUrls(stockNo, yyyymm01);

  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(
        url,
        {
          ...baseFetchOptions,
          headers: {
            ...baseFetchOptions.headers,
            Accept: "application/json",
            Referer:
              "https://www.twse.com.tw/zh/trading/historical/stock-day.html",
          },
        },
        10000,
      );

      const text = await res.text();
      const ct = res.headers.get("content-type") || "";
      const looksLikeJson =
        ct.includes("application/json") || text.trim().startsWith("{");

      if (res.ok && looksLikeJson) {
        let json;
        try {
          json = JSON.parse(text);
        } catch {
          continue;
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

      if (
        !looksLikeJson ||
        text.includes("<html") ||
        text.includes("location.href")
      )
        continue;
      throw new Error(
        `TWSE STOCK_DAY HTTP ${res.status}: ${text.slice(0, 200)}`,
      );
    } catch (e) {
      if (e.message.includes("Timeout"))
        console.warn(`TWSE STOCK_DAY ${e.message}`);
    }
  }

  throw new Error("TWSE STOCK_DAY: all endpoints failed (non-JSON or blocked)");
}

export async function fetchStockHistory(symbol, period1, period2) {
  const stockNo = toTwseStockNo(symbol);
  const months = enumerateMonths(period1, period2);
  const currentMonthKey = TwDate().formatMonthKey();

  const all = [];
  for (const yyyymm01 of months) {
    const rows = await fetchStockDayMonthWithCache(stockNo, yyyymm01);
    all.push(...rows);

    const monthKey = yyyymm01.substring(0, 6);
    // 只有在真的敲擊了 TWSE API (當月) 時，才需要禮貌性等待
    if (monthKey === currentMonthKey) {
      await sleep(1500);
    }
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

export async function fetchLatestClose(symbol) {
  const stockNo = toTwseStockNo(symbol);
  const currentMonthKey = TwDate().formatMonthKey();
  const yyyymm01 = `${currentMonthKey}01`;

  // 若同一次排程中其他地方已抓過歷史，有機會命中記憶體或避免重複計算
  const rows = await fetchStockDayMonthWithCache(stockNo, yyyymm01);
  if (!rows || !rows.length) return null;
  return rows[rows.length - 1];
}

export async function fetchRealTimePrice(symbol) {
  try {
    const realtime = await fetchRealtimeFromMis(symbol);
    if (realtime && realtime.price != null) {
      return { price: realtime.price, time: realtime.time };
    }
  } catch (err) {
    console.warn("MIS 即時價獲取失敗，改走收盤 fallback:", err.message);
  }

  const latest = await fetchLatestClose(symbol);
  if (latest?.close != null) {
    return {
      price: latest.close,
      time: new Date(`${latest.date}T13:30:00+08:00`),
    };
  }

  return { price: null, time: null };
}

// ============================================================================
// 📈 大盤估值與基本面獲取 (PB / PE)
// ============================================================================
export async function fetchMarketValuation() {
  // TWSE 官方 OpenAPI 端點 (大盤本益比、殖利率及股價淨值比)
  // 如果 OpenAPI 失敗也可換成 twse.com.tw 官網的 FMNPTK
  const openApiUrl = "https://openapi.twse.com.tw/v1/exchangeReport/FMNPTK";
  
  try {
    const res = await fetchWithTimeout(
      openApiUrl,
      {
        ...baseFetchOptions,
        headers: {
          ...baseFetchOptions.headers,
          Accept: "application/json",
        },
      },
      8000
    );

    const text = await res.text();
    // 檢查回傳是否為陣列形式的 JSON (OpenAPI 手冊格式)
    if (res.ok && text.trim().startsWith("[")) {
      const data = JSON.parse(text);
      if (data && data.length > 0) {
        // OpenAPI 陣列最後一筆通常是最新資料
        const latestInfo = data[data.length - 1];
        
        // 解析: "PEratio": "21.65", "Yield": "2.81", "PBratio": "2.15"
        return {
          pe: parseNumberOrNull(latestInfo.PEratio) || null,
          yield: parseNumberOrNull(latestInfo.Yield) || null,
          pb: parseNumberOrNull(latestInfo.PBratio) || null,
          date: latestInfo.Date || null,
        };
      }
    }
    
    // Fallback: 如果 openapi 未順利解析，嘗試走官網 rwd api
    const currentMonthKey = TwDate().formatMonthKey();
    const fallbackUrl = `https://www.twse.com.tw/rwd/zh/afterTrading/FMNPTK?date=${currentMonthKey}01&response=json&_=${Date.now()}`;
    const fbRes = await fetchWithTimeout(
      fallbackUrl,
      {
        ...baseFetchOptions,
        headers: {
          ...baseFetchOptions.headers,
          Accept: "application/json",
          Referer: "https://www.twse.com.tw/zh/trading/historical/fmnptk.html",
        },
      },
      8000
    );
    
    const fbText = await fbRes.text();
    if (fbRes.ok && (fbText.includes("\"stat\":\"OK\""))) {
      const json = JSON.parse(fbText);
      const rows = json.data || [];
      if (rows.length > 0) {
        const lastRow = rows[rows.length - 1];
        return {
          // [ 年月, 本益比, 殖利率, 股價淨值比 ]
          date: lastRow[0],
          pe: parseNumberOrNull(lastRow[1]),
          yield: parseNumberOrNull(lastRow[2]),
          pb: parseNumberOrNull(lastRow[3]),
        };
      }
    }

    throw new Error(`獲取大盤估值資料失敗，這可能代表證交所反爬蟲發生或當日資料未產出。`);
  } catch (err) {
    if (err.message.includes("Timeout")) {
      console.warn(`TWSE 估值 (FMNPTK) API Timeout.`);
    } else {
      console.warn(`TWSE 估值 (FMNPTK) API 異常: ${err.message}`);
    }
    throw err;
  }
}

