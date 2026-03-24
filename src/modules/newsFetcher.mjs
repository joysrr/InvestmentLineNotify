import Parser from "rss-parser";
import { escapeHTML, TwDate } from "../utils/coreUtils.mjs"; // 👈 引入全新的 TwDate
import {
  filterAndCategorizeAllNewsWithAI,
  generateDailySearchQueries,
} from "./ai/aiCoach.mjs";

const parser = new Parser();

/**
 * 抓取單一 RSS 連結的輔助函式
 */
async function fetchRssFeed(url, maxItems = 10, sourceTag = "") {
  try {
    const feed = await parser.parseURL(url);
    // 我們在抓取時，偷偷在每則新聞的物件上加上我們自己定義的標籤
    return feed.items.slice(0, maxItems).map((item) => ({
      ...item,
      _region: sourceTag, // 用來標記這是從台灣還是國際的 RSS 抓來的
    }));
  } catch (error) {
    console.error(`抓取 RSS 失敗 (${url}):`, error.message);
    return [];
  }
}

export async function getNewsTelegramMessages(marketData) {
  console.log("開始抓取並透過 AI 一次性過濾所有財經新聞...");

  // 1. 取得 AI 生成的動態擴充關鍵字
  const aiQueries = await generateDailySearchQueries(marketData);

  // 2. 定義你的「基礎必搜清單」(絕對不能漏掉的)
  const baseTwQueries = [
    // 核心標的 (強制出現在標題，確保新聞主角是它們)
    { keyword: "台股", searchType: "intitle" },
    { keyword: "大盤", searchType: "intitle" },
    { keyword: "0050", searchType: "intitle" },
    { keyword: "台積電", searchType: "intitle" },

    // 資金與籌碼面 (廣泛搜尋，內文提到即可)
    { keyword: "外資", searchType: "broad" },
    { keyword: "央行", searchType: "broad" },

    // 基本面與經濟環境 (廣泛搜尋)
    { keyword: "通膨", searchType: "broad" },
    { keyword: "出口", searchType: "broad" },
  ];

  const baseUsQueries = [
    // 核心指數與指標 (強制出現在標題)
    { keyword: "S&P 500", searchType: "intitle" },
    { keyword: "Nasdaq", searchType: "intitle" },
    { keyword: "CPI", searchType: "intitle" },

    // 貨幣政策與重要人物 (廣泛搜尋)
    { keyword: "Federal Reserve", searchType: "broad" },
    { keyword: "Fed", searchType: "broad" },
    { keyword: "Powell", searchType: "broad" },

    // 總經指標與風險 (廣泛搜尋)
    { keyword: "inflation", searchType: "broad" },
    { keyword: "payrolls", searchType: "broad" },
    { keyword: "recession", searchType: "broad" },
  ];

  // 3. 輔助函數：合併基礎清單與 AI 清單，並去重
  const mergeAndFormatQueries = (baseList, aiList) => {
    const mergedMap = new Map();

    baseList.forEach((item) => mergedMap.set(item.keyword.toLowerCase(), item));

    (aiList || []).forEach((item) => {
      const k = item.keyword.toLowerCase();
      if (!mergedMap.has(k)) {
        mergedMap.set(k, item);
      }
    });

    const formattedStrings = Array.from(mergedMap.values()).map((obj) => {
      if (obj.searchType === "intitle") {
        return `intitle:"${obj.keyword}"`;
      }
      return `"${obj.keyword}"`;
    });

    return `(${formattedStrings.join(" OR ")})+when:1d`;
  };

  // 4. 產出最終的查詢字串
  const finalTwQuery = mergeAndFormatQueries(
    baseTwQueries,
    aiQueries.twQueries,
  );
  const finalUsQuery = mergeAndFormatQueries(
    baseUsQueries,
    aiQueries.usQueries,
  );

  // 5. 組合 URL 並發出請求
  const buildUrl = (queryStr, gl, hl, ceid) => {
    return `https://news.google.com/rss/search?${new URLSearchParams({
      q: queryStr,
      hl,
      gl,
      ceid,
      scoring: "n",
    }).toString()}`;
  };

  const twUrl = buildUrl(finalTwQuery, "TW", "zh-TW", "TW:zh-Hant");
  const usUrl = buildUrl(finalUsQuery, "US", "en-US", "US:en");

  // 2. 並發抓取，但在抓取時打上 Tag (TW / US)
  const [rawTwNews, rawUsNews] = await Promise.all([
    fetchRssFeed(twUrl, 40, "TW"),
    fetchRssFeed(usUrl, 40, "US"),
  ]);

  // 3. 將兩邊新聞合併成一個大陣列
  const allRawNews = [...rawTwNews, ...rawUsNews];

  // 4. 一次性交給 AI 處理
  const processedNews = await filterAndCategorizeAllNewsWithAI(allRawNews);

  if (processedNews.length === 0) {
    return [{ text: "<i>過去 24 小時內無符合策略之重大市場動態。</i>" }];
  }

  // 5. 分組 (GroupBy Region)
  const groupedNews = processedNews.reduce(
    (acc, current) => {
      const region = current._region;
      if (!acc[region]) acc[region] = [];
      acc[region].push(current);
      return acc;
    },
    { TW: [], US: [] },
  );

  // 6. 排版 Telegram 訊息
  // 💡 優化 1: 取得當天日期的乾淨寫法
  const todayStr = TwDate().formatDateKey(); // 例如 "2026-03-24" (可依照您想要的標題格式替換)

  const buildSection = (newsList, sectionTitle) => {
    if (!newsList || newsList.length === 0) return "";

    let sectionText = `<b>${sectionTitle}</b> ｜ <code>${todayStr}</code>\n\n`;

    newsList.forEach((item, index) => {
      const titleParts = item.title.split(/ - | \| /);
      const cleanTitle = titleParts[0];
      const mediaName =
        titleParts.length > 1 ? titleParts[titleParts.length - 1] : "News";

      // 💡 優化 2: 處理時間格式，用一行取代原本的 15 行
      const timeObj = TwDate(item.pubDate);
      const timeString = timeObj.isValid
        ? timeObj.formatDateTime()
        : "時間未知";

      sectionText += `${index + 1}. <a href="${item.link}">${escapeHTML(cleanTitle)}</a>\n`;
      sectionText += `   <i>↳ ${escapeHTML(item.summary)}</i>\n`;
      sectionText += `   <i>${timeString} ｜ ${escapeHTML(mediaName)}</i>\n\n`;
    });

    return sectionText.trim();
  };

  const msgTextTW = buildSection(groupedNews["TW"], "🇹🇼 台灣市場動態");
  const msgTextGLOBAL = buildSection(groupedNews["US"], "🌎 國際總經與趨勢");

  const messagesToSend = [];

  if (msgTextTW) {
    messagesToSend.push({ text: msgTextTW, disable_notification: true });
  }

  if (msgTextGLOBAL) {
    messagesToSend.push({ text: msgTextGLOBAL, disable_notification: true });
  }

  if (messagesToSend.length === 0) {
    return {
      messages: [
        {
          text: `<b>🗞️ 重大市場情報</b> ｜ <code>${todayStr}</code>\n<i>今日無符合策略之重大市場動態。</i>`,
        },
      ],
      summaryText: "今日無重大市場新聞。",
    };
  }

  const newsSummaryText = processedNews
    .map((item, index) => {
      const cleanTitle = item.title.split(/ - | \| /)[0];
      return `${index + 1}. [${item._region}] ${cleanTitle}\n   ↳ 摘要：${item.summary}`;
    })
    .join("\n\n");

  return {
    messages: messagesToSend,
    summaryText: newsSummaryText,
  };
}
