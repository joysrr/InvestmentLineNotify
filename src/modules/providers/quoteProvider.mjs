import axios from "axios";

async function fetchFromQuotable() {
  const url = "https://api.quotable.io/quotes/random";
  const res = await axios.get(url, { timeout: 8000 });
  const item = Array.isArray(res.data) ? res.data[0] : null;
  if (!item?.content) throw new Error("Quotable empty response");

  return {
    text: item.content,
    author: item.author || "Unknown",
    source: "quotable",
  };
}

async function fetchFromZenQuotes() {
  const url = "https://zenquotes.io/api/random";
  const res = await axios.get(url, { timeout: 8000 });
  const item = Array.isArray(res.data) ? res.data[0] : null;
  if (!item?.q) throw new Error("ZenQuotes empty response");

  return { text: item.q, author: item.a || "Unknown", source: "zenquotes" };
}

/**
 * 取得今日一句（會用檔案快取）
 * cache 結構：
 * {
 *   date: "YYYY-MM-DD",
 *   quote: { quote, author, source }
 * }
 */
export async function getDailyQuote() {
  let quote;
  try {
    quote = await fetchFromQuotable();
  } catch {
    try {
      quote = await fetchFromZenQuotes();
    } catch {
      const fallback = {
        quote: "下跌是加碼的禮物，上漲是資產的果實。",
        author: "—",
        source: "fallback",
      };

      return fallback;
    }
  }

  const finalQuote = {
    quote: quote.text,
    author: quote.author,
    source: quote.source,
  };

  console.log("📝 取得今日一句：", finalQuote);

  return finalQuote;
}
