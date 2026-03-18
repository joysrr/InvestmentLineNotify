import Parser from "rss-parser";

const parser = new Parser();

function escapeHTML(text) {
  if (text == null) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getNewsEmoji(title) {
  const t = String(title).toLowerCase();
  // 中文關鍵字
  if (
    t.includes("大跌") ||
    t.includes("崩盤") ||
    t.includes("衰退") ||
    t.includes("警告") ||
    t.includes("跳水")
  )
    return "📉";
  if (
    t.includes("大漲") ||
    t.includes("創高") ||
    t.includes("狂飆") ||
    t.includes("利多")
  )
    return "📈";
  // 英文關鍵字
  if (
    t.includes("crash") ||
    t.includes("recession") ||
    t.includes("plunge") ||
    t.includes("drop")
  )
    return "📉";
  if (
    t.includes("surge") ||
    t.includes("record high") ||
    t.includes("rally") ||
    t.includes("soar")
  )
    return "📈";
  if (
    t.includes("rate cut") ||
    t.includes("fed") ||
    t.includes("cpi") ||
    t.includes("inflation")
  )
    return "🏦";
  if (
    t.includes("war") ||
    t.includes("strike") ||
    t.includes("tension") ||
    t.includes("geopolitics")
  )
    return "⚠️";

  return "📰";
}

/**
 * 抓取單一 RSS 連結的輔助函式
 */
async function fetchRssFeed(url, maxItems = 3) {
  try {
    const feed = await parser.parseURL(url);
    return feed.items.slice(0, maxItems);
  } catch (error) {
    console.error(`抓取 RSS 失敗 (${url}):`, error.message);
    return [];
  }
}

export async function getNewsTelegramMessages() {
  console.log("開始抓取台灣與國際財經新聞...");

  // 1. 【台灣市場專屬】(中文、台灣區)
  const twQuery =
    "(intitle:台股 OR intitle:大盤 OR intitle:台積電 OR intitle:0050) when:24h";
  const twParams = new URLSearchParams({
    q: twQuery,
    hl: "zh-TW",
    gl: "TW",
    ceid: "TW:zh-Hant",
    scoring: "n",
  });
  const twUrl = `https://news.google.com/rss/search?${twParams.toString()}`;

  // 2. 【國際總經與地緣政治】(英文、美國區)
  // 鎖定：美股大盤(S&P500/Nasdaq)、聯準會降息/通膨、重大地緣政治(Geopolitics/War)
  const usQuery =
    '("S&P 500" OR Nasdaq OR "Federal Reserve" OR inflation OR geopolitics) AND (market OR stocks) when:24h';
  const usParams = new URLSearchParams({
    q: usQuery,
    hl: "en-US",
    gl: "US",
    ceid: "US:en",
    scoring: "n",
  });
  const usUrl = `https://news.google.com/rss/search?${usParams.toString()}`;

  // 同時並發抓取兩邊的新聞 (各取前 5 則)
  const [twNews, usNews] = await Promise.all([
    fetchRssFeed(twUrl, 5),
    fetchRssFeed(usUrl, 5),
  ]);

  const allNews = [...twNews, ...usNews];

  if (allNews.length === 0) {
    return [{ text: "<i>過去 24 小時內無重大策略相關新聞。</i>" }];
  }

  const todayStr = new Date().toLocaleDateString("zh-TW", {
    timeZone: "Asia/Taipei",
  });
  let msgText = `<b>🗞️ 國際與台股新聞速報</b> ｜ <code>${todayStr}</code>\n\n`;

  // 排版輸出
  allNews.forEach((item, index) => {
    // 處理標題與媒體名稱 (處理中英文的連接符號 ' - ' 或 ' | ')
    const titleParts = item.title.split(/ - | \| /);
    const cleanTitle = titleParts[0];
    const mediaName =
      titleParts.length > 1 ? titleParts[titleParts.length - 1] : "新聞來源";
    const emoji = getNewsEmoji(cleanTitle);

    const pubDate = new Date(item.pubDate);
    const timeString = pubDate.toLocaleTimeString("zh-TW", {
      timeZone: "Asia/Taipei",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    msgText += `${index + 1}. ${emoji} <a href="${item.link}">${escapeHTML(cleanTitle)}</a>\n`;
    msgText += `   <i>${timeString} ｜ ${escapeHTML(mediaName)}</i>\n\n`;
  });

  return [{ text: msgText.trim() }];
}
