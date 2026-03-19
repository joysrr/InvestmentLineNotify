import fs from "fs/promises";
import path from "path";
import axios from "axios";
import fetch from "node-fetch";
import https from "https";
import {
  parseEnglishDateToISO,
  toTWDateKey,
  toTwseStockNo,
  parseNumberOrNull,
  enumerateMonths,
  rocDateToIso,
  sleep,
} from "../../utils/coreUtils.mjs";
import { fetchStrategyConfig } from "../strategy/signalRules.mjs";

// 建立一個快取資料夾存放歷史股價
const CACHE_DIR = path.join(process.cwd(), "cache", "stock_history");

// 確保快取目錄存在
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (err) {}
}

/**
 * 具有快取功能的單月資料抓取
 */
async function fetchStockDayMonthWithCache(stockNo, yyyymm01) {
  await ensureCacheDir();

  // yyyymm01 格式是 20260301，我們取前 6 碼當作檔名 (202603)
  const monthKey = yyyymm01.substring(0, 6);
  const cachePath = path.join(CACHE_DIR, `${stockNo}_${monthKey}.json`);

  // 取得現在的年月 (例如 202603)
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;

  // 1. 檢查快取
  // 如果檔案存在，且 "不是當月" (因為當月資料還會變動，不能死存)，就直接讀快取
  if (monthKey !== currentMonthKey) {
    try {
      const cachedData = await fs.readFile(cachePath, "utf-8");
      return JSON.parse(cachedData);
    } catch (err) {
      // 讀取失敗或檔案不存在，繼續往下走去抓網路
    }
  }

  // 2. 真的去打 TWSE API (呼叫你原本寫好的 fetchStockDayMonth)
  const rows = await fetchStockDayMonth(stockNo, yyyymm01);

  // 3. 寫入快取
  // 如果抓回來的資料有內容，且 "不是當月" (或是你確定這月已經結束)，就存起來
  if (rows && rows.length > 0 && monthKey !== currentMonthKey) {
    try {
      await fs.writeFile(cachePath, JSON.stringify(rows));
    } catch (err) {
      console.warn("寫入快取失敗:", err.message);
    }
  }

  return rows;
}

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
 * 00675L 是上市 ETF：用 tse_
 * 若未來要支援上櫃，需擴充 otc_ 判斷。
 */
function toExCh(symbol) {
  const stockNo = toTwseStockNo(symbol);
  return `tse_${stockNo}.tw`;
}

/**
 * MIS 回傳的日期/時間（d=YYYYMMDD, t=HH:MM:SS）轉 Date (+08:00)
 */
function parseMisTimeToDate(dStr, tStr) {
  if (!dStr || !tStr) return null;

  const d = String(dStr).trim();
  const t = String(tStr).trim();
  if (!/^\d{8}$/.test(d)) return null;
  if (!/^\d{2}:\d{2}:\d{2}$/.test(t)) return null;

  return new Date(
    `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t}+08:00`,
  );
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

  // 若已有其他請求正在獲取 Cookie，直接等待該 Promise，避免瞬間擊穿 TWSE
  if (_cookiePromise) return _cookiePromise;

  _cookiePromise = (async () => {
    try {
      const res = await fetch(
        "https://mis.twse.com.tw/stock/fibest.jsp?lang=zh_tw",
        {
          ...baseFetchOptions,
          headers: {
            ...baseFetchOptions.headers,
            Accept: "text/html,application/xhtml+xml",
          },
        },
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
      _cookiePromise = null; // 解開鎖定
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

  // ⚡ 加入 AbortController 防止伺服器無回應卡死
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒強制中斷

  try {
    const res = await fetch(url, {
      ...baseFetchOptions,
      signal: controller.signal,
      headers: {
        ...baseFetchOptions.headers,
        Accept: "application/json",
        Referer: "https://mis.twse.com.tw/stock/fibest.jsp",
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });

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
  } finally {
    clearTimeout(timeoutId); // 避免 Memory Leak
  }
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function extractCookie(setCookieHeader) {
  if (!setCookieHeader) return "";
  const arr = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader];
  return arr.map((x) => x.split(";")[0]).join("; ");
}

const toNum = (s) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

function formatTaifexDateTime(CDate, CTime) {
  if (!CDate || !CTime || CDate.length !== 8) return null;
  const t = CTime.padStart(6, "0");
  const hh = t.slice(0, 2);
  const mm = t.slice(2, 4);
  const ss = t.slice(4, 6);
  return `${CDate.slice(0, 4)}/${CDate.slice(4, 6)}/${CDate.slice(6, 8)} ${hh}:${mm}:${ss}`;
}

// 期交所的連線可以使用 Axios 自帶的設定（但一樣建議設定 Timeout）
export async function getTwVix() {
  try {
    const pre = await axios.get(
      "https://mis.taifex.com.tw/futures/VolatilityQuotes/",
      {
        // 這裡也可以套用 httpsAgent，但考慮期交所不同網域，先維持原樣即可
        headers: { "User-Agent": UA },
        timeout: 8000,
      },
    );
    const cookie = extractCookie(pre.headers["set-cookie"]);

    const url = "https://mis.taifex.com.tw/futures/api/getQuoteDetail";
    const candidates = ["TAIWANVIX", "RTD:1:TAIWANVIX", "RTD:1:VIX"];
    const strategy = await fetchStrategyConfig();

    for (const symbol of candidates) {
      const { data } = await axios.post(
        url,
        { SymbolID: [symbol] },
        {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": UA,
            Referer: "https://mis.taifex.com.tw/futures/VolatilityQuotes/",
            Origin: "https://mis.taifex.com.tw",
            ...(cookie ? { Cookie: cookie } : {}),
          },
          timeout: 8000,
        },
      );

      const quote = data?.RtData?.QuoteList?.[0] ?? data?.QuoteDetail?.[0];
      if (!quote) continue;

      let value = toNum(quote.CLastPrice);
      if (value == null || value <= 0) {
        value = toNum(quote.CRefPrice);
      }
      if (value == null || value <= 0) continue;

      const prev = toNum(quote.CRefPrice);
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

async function loadHolidaySet(year) {
  if (holidayCache.year === year && holidayCache.dates)
    return holidayCache.dates;

  // ⚡ 這裡也套用優化 Agent
  const res = await fetch("https://www.twse.com.tw/en/trading/holiday.html", {
    ...baseFetchOptions,
    headers: { ...baseFetchOptions.headers, Accept: "text/html" },
  });

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
  const now = new Date();
  const todayKey = toTWDateKey(now);

  const twNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }),
  );
  const dow = twNow.getDay();
  if (dow === 0 || dow === 6) return false;

  const year = Number(todayKey.slice(0, 4));
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
    // ⚡ 這裡也套用優化 Agent
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(url, {
        ...baseFetchOptions,
        signal: controller.signal,
        headers: {
          ...baseFetchOptions.headers,
          Accept: "application/json",
          Referer:
            "https://www.twse.com.tw/zh/trading/historical/stock-day.html",
        },
      });

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
      if (e.name === "AbortError")
        console.warn(`TWSE STOCK_DAY Timeout for ${url}`);
      // 繼續嘗試下一個 URL
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error("TWSE STOCK_DAY: all endpoints failed (non-JSON or blocked)");
}

export async function fetchStockHistory(symbol, period1, period2) {
  const stockNo = toTwseStockNo(symbol);
  const months = enumerateMonths(period1, period2);

  const all = [];
  for (const yyyymm01 of months) {
    const rows = await fetchStockDayMonthWithCache(stockNo, yyyymm01);
    all.push(...rows);

    // 判斷是否需要 sleep：只有當月(需要打API)才需要 sleep
    const monthKey = yyyymm01.substring(0, 6);
    const currentMonthKey = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}`;

    // 如果是歷史月份且已經從快取讀了，就不需要 sleep 浪費時間
    if (monthKey === currentMonthKey || !rows.length) {
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
  const todayTW = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }),
  );
  const yyyymm01 = `${todayTW.getFullYear()}${String(todayTW.getMonth() + 1).padStart(2, "0")}01`;

  const rows = await fetchStockDayMonth(stockNo, yyyymm01);
  if (!rows.length) return null;
  return rows[rows.length - 1];
}

export async function fetchRealTimePrice(symbol) {
  // 1) 試一次 MIS 即時
  try {
    const realtime = await fetchRealtimeFromMis(symbol);
    if (realtime && realtime.price != null) {
      return { price: realtime.price, time: realtime.time };
    }
  } catch (err) {
    console.warn("MIS 即時價獲取失敗，改走收盤 fallback:", err.message);
  }

  // 2) fallback：最近收盤價（STOCK_DAY）
  const latest = await fetchLatestClose(symbol);
  if (latest?.close != null) {
    return {
      price: latest.close,
      time: new Date(`${latest.date}T13:30:00+08:00`),
    };
  }

  return { price: null, time: null };
}
