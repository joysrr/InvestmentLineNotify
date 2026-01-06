const fetch = require("node-fetch");

/**
 * 建議放到 .env：
 * BASE_PRICE_URL=https://raw.githubusercontent.com/joysrr/joysrr.github.io/master/Stock/BasePrice.txt
 */
const BASE_PRICE_URL = process.env.BASE_PRICE_URL;

let _cache = {
  url: null,
  base: null,     // { baseDate, basePrice }
  loadedAt: null,
};

/**
 * 解析 BasePrice.txt（取最後一行）
 * 格式：YYYY-MM-DD, 123.45
 */
function parseBasePriceText(text) {
  const lines = String(text).trim().split("\n");
  const lastLine = lines[lines.length - 1];
  const [baseDate, basePriceStr] = lastLine.split(",").map((s) => s.trim());
  const basePrice = parseFloat(basePriceStr);

  if (!baseDate || Number.isNaN(basePrice)) {
    throw new Error("基準格式錯誤，無法解析最後一行");
  }

  return { baseDate, basePrice };
}

/**
 * 對外：取得最新基準價（含 in-memory cache）
 * - 同一個 node process 內只抓一次
 * - 若抓取失敗但 cache 有舊值：回傳舊值，讓流程不中斷
 */
async function fetchLatestBasePrice(url = BASE_PRICE_URL) {
  if (!url) {
    throw new Error("缺少 BASE_PRICE_URL（或呼叫時未傳入 url）");
  }

  if (_cache.url === url && _cache.base) {
    return _cache.base;
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 base-price-client",
        Accept: "text/plain",
      },
    });

    const text = await response.text();
    if (!response.ok) throw new Error(`BasePrice.txt HTTP ${response.status}: ${text.slice(0, 200)}`);

    const base = parseBasePriceText(text);

    _cache = {
      url,
      base,
      loadedAt: new Date(),
    };

    return base;
  } catch (err) {
    if (_cache.base) return _cache.base; // fallback
    throw err;
  }
}

module.exports = { fetchLatestBasePrice };
