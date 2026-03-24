import { fetchWithTimeout, TwDate } from "../../utils/coreUtils.mjs";
import { archiveManager } from "../data/archiveManager.mjs";

async function fetchFromQuotable() {
  const url = "https://api.quotable.io/quotes/random";
  const res = await fetchWithTimeout(url, {}, 8000);

  if (!res.ok) throw new Error(`Quotable HTTP ${res.status}`);

  const data = await res.json();
  const item = Array.isArray(data) ? data[0] : null;
  if (!item?.content) throw new Error("Quotable empty response");

  return {
    text: item.content,
    author: item.author || "Unknown",
    source: "quotable",
  };
}

async function fetchFromZenQuotes() {
  const url = "https://zenquotes.io/api/random";
  const res = await fetchWithTimeout(url, {}, 8000);

  if (!res.ok) throw new Error(`ZenQuotes HTTP ${res.status}`);

  const data = await res.json();
  const item = Array.isArray(data) ? data[0] : null;
  if (!item?.q) throw new Error("ZenQuotes empty response");

  return {
    text: item.q,
    author: item.a || "Unknown",
    source: "zenquotes",
  };
}

/**
 * 取得今日一句 (具備快取讀取機制，避免 Rate Limit)
 * @returns {Promise<Object>} { date, quote, author, source }
 */
export async function getDailyQuote() {
  const todayStr = TwDate().formatDateKey();

  // 1. 檢查 archiveManager 裡的 latest.json 是否已經有今天的 Quote
  try {
    const latestData = await archiveManager.getLatestMarketData();
    if (
      latestData &&
      latestData?.data?.quote &&
      latestData.data.quote.date === todayStr
    ) {
      console.log("📖 [Quote] 讀取今日快取名言");
      return latestData.data.quote;
    }
  } catch (err) {
    console.warn("⚠️ 讀取 Quote 快取失敗，繼續執行 API 抓取:", err.message);
  }

  // 2. 若無快取或跨日，重新向 API 抓取
  let quote;
  try {
    quote = await fetchFromQuotable();
  } catch (err1) {
    console.warn("⚠️ Quotable 抓取失敗，改用 ZenQuotes:", err1.message);
    try {
      quote = await fetchFromZenQuotes();
    } catch (err2) {
      console.warn("⚠️ ZenQuotes 抓取失敗，使用 Fallback 名言:", err2.message);
      quote = {
        text: "下跌是加碼的禮物，上漲是資產的果實。",
        author: "—",
        source: "fallback",
      };
    }
  }

  const finalQuote = {
    date: todayStr, // 加入日期標記，供下次快取驗證使用
    quote: quote.text,
    author: quote.author,
    source: quote.source,
  };

  return finalQuote;
}
