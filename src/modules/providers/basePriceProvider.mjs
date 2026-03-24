import { fetchWithTimeout, parseNumberOrNull } from "../../utils/coreUtils.mjs";

const BASE_PRICE_URL = process.env.BASE_PRICE_URL;

/* 記憶體暫存 */
let _cache = {
  url: null,
  base: null, // { baseDate, basePrice }
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

  // 使用共用工具進行安全的數字解析
  const basePrice = parseNumberOrNull(basePriceStr);

  if (!baseDate || basePrice === null) {
    throw new Error("基準格式錯誤，無法解析最後一行");
  }

  return { baseDate, basePrice };
}

/**
 * 對外：取得最新基準價（含 in-memory cache）
 * - 同一個 node process 內只抓一次
 * - 若抓取失敗但 cache 有舊值：回傳舊值，讓流程不中斷
 */
export async function fetchLatestBasePrice(url = BASE_PRICE_URL) {
  if (!url) {
    throw new Error("缺少 BASE_PRICE_URL（或呼叫時未傳入 url）");
  }

  if (_cache.url === url && _cache.base) {
    return _cache.base;
  }

  try {
    // 增加 5 秒 Timeout 保護，避免網路死鎖
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 base-price-client",
          Accept: "text/plain",
        },
      },
      5000,
    );

    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `BasePrice.txt HTTP ${response.status}: ${text.slice(0, 200)}`,
      );
    }

    const base = parseBasePriceText(text);

    _cache = {
      url,
      base,
      loadedAt: new Date(),
    };

    return base;
  } catch (err) {
    console.warn(`⚠️ 獲取 BasePrice 失敗 (${err.message})，嘗試使用快取...`);
    if (_cache.base) return _cache.base; // fallback
    throw err; // 若無快取可退，則將錯誤往上拋
  }
}
