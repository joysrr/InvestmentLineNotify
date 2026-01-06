const fetch = require("node-fetch");
const { toTwseStockNo } = require("../../utils/dateUtils");
const { parseNumberOrNull } = require("../../utils/numberUtils");

/**
 * 00675L 是上市 ETF：用 tse_
 * 若你未來要支援上櫃，要再擴充 otc_ 判斷。
 */
function toExCh(symbol) {
  const stockNo = toTwseStockNo(symbol);
  return `tse_${stockNo}.tw`;
}

function parseMisTimeToDate(dStr, tStr) {
  if (!dStr || !tStr) return null;

  const d = String(dStr).trim(); // YYYYMMDD
  const t = String(tStr).trim(); // HH:MM:SS
  if (!/^\d{8}$/.test(d)) return null;
  if (!/^\d{2}:\d{2}:\d{2}$/.test(t)) return null;

  return new Date(
    `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t}+08:00`,
  );
}

/**
 * 先取 cookie，再查 MIS，即可降低 msgArray 空的機率。
 */
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

/**
 * 嘗試抓 MIS 即時價（不含 fallback，不含重試）
 * 回傳 { price, time }；若取不到，price 可能為 null。
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
  if (!msg) return { price: null, time: null };

  return {
    price: parseNumberOrNull(msg.z),
    time: parseMisTimeToDate(msg.d, msg.t),
  };
}

module.exports = { fetchRealtimeFromMis };
