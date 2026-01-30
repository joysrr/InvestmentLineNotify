import path from "node:path";
import axios from "axios";
import { translateEnToZhTW } from "./geminiTranslate.mjs";

const CACHE_DIR = path.resolve(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "daily-quote.json");

// 用台北時區算「今天」字串
function todayKeyTZ8() {
  const dtf = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dtf.format(new Date()); // e.g. 2026-01-23
}

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
 *   quote: { textZh, textEn, author, source, translated }
 * }
 */
export async function getDailyQuote() {
  // 1) 先抓英文 quote
  let quote;
  try {
    quote = await fetchFromQuotable();
  } catch {
    try {
      quote = await fetchFromZenQuotes();
    } catch {
      // 兩個來源都掛了：直接回傳中文 fallback（不需要翻譯）
      const fallback = {
        textZh: "下跌是加碼的禮物，上漲是資產的果實。",
        textEn: "",
        author: "—",
        source: "fallback",
        translated: false,
      };

      return fallback;
    }
  }

  // 2) 用 Gemini 翻譯成繁中（翻譯失敗也不要讓整個流程掛）
  let textZh = "";
  try {
    textZh = await translateEnToZhTW(quote.text);
  } catch (e) {
    console.warn("⚠️ Gemini translate failed:", e?.message);
  }

  const finalQuote = {
    textZh: textZh || "", // 讓顯示端自行 fallback 到 textEn
    textEn: quote.text,
    author: quote.author,
    source: quote.source,
    translated: Boolean(textZh),
  };

  console.log("📝 取得今日一句：", finalQuote);

  return finalQuote;
}
