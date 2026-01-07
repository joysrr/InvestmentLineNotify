const fetch = require("node-fetch");
const { toTwseStockNo } = require("../../utils/dateUtils");
const { parseNumberOrNull } = require("../../utils/numberUtils");

/**
 * TWSE MIS 即時資訊 API provider
 *
 * 來源：
 * - https://mis.twse.com.tw/stock/api/getStockInfo.jsp
 *
 * 注意：
 * - msgArray[0].z（最近成交價）可能會是 "-"（代表當下沒有成交價/暫無成交），這是正常現象。
 * - 可用五檔買賣價 a/b 的第一檔作為 fallback（a=賣價、b=買價，底線分隔）。[web:184]
 */

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
 * 優先順序：
 * 1) 最近成交價 z
 * 2) 最佳買價 b[0]（保守：用 bid）
 * 3) 最佳賣價 a[0]
 */
function pickRealtimePrice(msg) {
  const last = parseNumberOrNull(msg?.z);
  const bid1 = firstPriceFromLevels(msg?.b);
  const ask1 = firstPriceFromLevels(msg?.a);

  const price = last ?? bid1 ?? ask1; // 只在 null/undefined 才 fallback [web:557]
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

// 簡單的 in-memory cookie cache（同一個 node process 只取一次）
let _cookieCache = { cookie: null, loadedAt: 0 };
const COOKIE_TTL_MS = 10 * 60 * 1000; // 10 分鐘：保守值（避免 cookie 過期）

/**
 * 先取 cookie，再查 MIS，降低 msgArray 空的機率。
 * node-fetch 可以用 response.headers.raw()['set-cookie'] 取得多個 Set-Cookie。[web:552]
 */
async function getMisCookie() {
  const now = Date.now();
  if (_cookieCache.cookie && now - _cookieCache.loadedAt < COOKIE_TTL_MS) {
    return _cookieCache.cookie;
  }

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
  const cookie = setCookie.map((c) => c.split(";")[0]).join("; ") || null;

  _cookieCache = { cookie, loadedAt: now };
  return cookie;
}

/**
 * 嘗試抓 MIS 即時價（不含 retry）
 *
 * @returns {{
 *   price: number|null,
 *   time: Date|null,
 *   priceSource: "last(z)"|"bid1(b)"|"ask1(a)"|"none",
 *   rawTime: { tlong?: string, d?: string, t?: string }
 * }}
 */
async function fetchRealtimeFromMis(symbol) {
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
  if (!res.ok)
    throw new Error(`TWSE MIS HTTP ${res.status}: ${text.slice(0, 200)}`);

  const json = JSON.parse(text);
  const msg = Array.isArray(json.msgArray) ? json.msgArray[0] : null;
  if (!msg) {
    return { price: null, time: null, priceSource: "none", rawTime: {} };
  }

  // 優先用 tlong（毫秒 epoch），沒有再用 d+t
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

module.exports = { fetchRealtimeFromMis };
