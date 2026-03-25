import Parser from "rss-parser";
import { escapeHTML, TwDate } from "../utils/coreUtils.mjs";
import {
  filterAndCategorizeAllNewsWithAI,
  generateDailySearchQueries,
} from "./ai/aiCoach.mjs";

// 定義兩個基礎的查詢清單，分別針對台灣市場和國際市場
const baseTwQueries = [
  // ── 核心標的（標題，確保主角是它們）──────────────────
  { keyword: "台股", searchType: "intitle" },
  { keyword: "大盤", searchType: "intitle" },
  { keyword: "台積電 法說", searchType: "intitle" }, // 改：法說才有訊息量
  { keyword: "台積電 ADR", searchType: "intitle" }, // 新增：美股夜盤訊號
  { keyword: "台積電 外資", searchType: "intitle" }, // 新增：籌碼訊號

  // ── 資金與籌碼面（廣泛）────────────────────────────
  { keyword: "外資", searchType: "broad" }, // 保留
  { keyword: "三大法人", searchType: "broad" }, // 新增：投信+自營+外資綜合
  { keyword: "融資 融券", searchType: "broad" }, // 新增：散戶槓桿水位
  { keyword: "集中度 籌碼", searchType: "broad" }, // 新增：主力控盤觀察
  { keyword: "國安基金", searchType: "broad" }, // 新增：護盤訊號

  // ── 貨幣政策與流動性────────────────────────────────
  { keyword: "央行", searchType: "broad" }, // 保留
  { keyword: "升息 降息", searchType: "broad" }, // 新增：利率方向
  { keyword: "新台幣", searchType: "broad" }, // 新增：匯率=外資動向指標

  // ── 基本面與經濟環境────────────────────────────────
  { keyword: "通膨", searchType: "broad" }, // 保留
  { keyword: "出口", searchType: "broad" }, // 保留
  { keyword: "外銷訂單", searchType: "broad" }, // 新增：台灣領先指標
  { keyword: "景氣燈號", searchType: "broad" }, // 新增：官方景氣判斷
  { keyword: "PMI", searchType: "broad" }, // 新增：製造業景氣
];

const baseUsQueries = [
  // ── 核心指數（標題）────────────────────────────────
  { keyword: "S&P 500", searchType: "intitle" }, // 保留
  { keyword: "Nasdaq", searchType: "intitle" }, // 保留
  { keyword: "CPI", searchType: "intitle" }, // 保留
  { keyword: "Dow Jones", searchType: "intitle" }, // 新增：道瓊代表傳產

  // ── 貨幣政策與重要人物──────────────────────────────
  { keyword: "Federal Reserve", searchType: "broad" }, // 保留
  { keyword: "Fed", searchType: "broad" }, // 保留
  { keyword: "Powell", searchType: "broad" }, // 保留
  { keyword: "FOMC", searchType: "broad" }, // 新增：利率會議直接觸發

  // ── 資金流動性（新增整個區塊）──────────────────────
  { keyword: "Treasury yields", searchType: "broad" }, // 新增：殖利率是股市之錨
  { keyword: "dollar index", searchType: "broad" }, // 新增：美元強弱=新興市場資金
  { keyword: "credit spread", searchType: "broad" }, // 新增：信用風險溫度計
  { keyword: "liquidity", searchType: "broad" }, // 新增：流動性危機偵測

  // ── 總經指標────────────────────────────────────────
  { keyword: "inflation", searchType: "broad" }, // 保留
  { keyword: "payrolls", searchType: "broad" }, // 保留
  { keyword: "recession", searchType: "broad" }, // 保留
  { keyword: "GDP", searchType: "broad" }, // 新增：成長率直接指標
  { keyword: "jobless claims", searchType: "broad" }, // 新增：每週就業先行指標
  { keyword: "ISM", searchType: "broad" }, // 新增：製造業/服務業景氣
];

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

/**
 * 合併基礎清單與 AI 清單，並去重
 * @param {*} baseList 基礎清單
 * @param {*} aiList AI 生成的清單
 * @returns
 */
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

/**
 * 建立 Google News RSS 的 URL
 * @param {*} queryStr
 * @param {*} gl
 * @param {*} hl
 * @param {*} ceid
 * @returns
 */
const buildUrl = (queryStr, gl, hl, ceid) => {
  return `https://news.google.com/rss/search?${new URLSearchParams({
    q: queryStr,
    hl,
    gl,
    ceid,
    scoring: "n",
  }).toString()}`;
};

/**
 * 過濾新聞，只保留指定時間範圍內的資料
 * 使用 TwDate 確保台北時區正確比對
 * @param {Array}  newsList    - 原始新聞陣列
 * @param {number} withinHours - 保留幾小時內的新聞（預設 24 小時）
 * @returns {Array} 過濾後的新聞陣列
 */
export function filterNewsByDate(newsList, withinHours = 24) {
  const now = Date.now();
  const cutoff = now - withinHours * 60 * 60 * 1000;

  return newsList.filter((news) => {
    if (!news.pubDate) return false;

    const pubTime = new Date(news.pubDate).getTime();

    if (isNaN(pubTime)) {
      console.warn(
        `⚠️ 無法解析時間，略過: ${news.title} | pubDate: ${news.pubDate}`,
      );
      return false;
    }

    if (pubTime > now + 60 * 60 * 1000) {
      console.warn(
        `⚠️ 異常未來時間，略過: ${news.title} | pubDate: ${news.pubDate}`,
      );
      return false;
    }

    return pubTime >= cutoff;
  });
}

/**
 * 根據提供的兩個面向關鍵字清單，結合基礎的查詢清單，至 Google News RSS 抓取原始新聞資料
 * @param {*} param0
 */
export async function getRawNews({ twQueries, usQueries }) {
  // 最終的查詢字串
  const baseTWQueries = mergeAndFormatQueries(baseTwQueries);
  const baseUSQueries = mergeAndFormatQueries(baseUsQueries);
  const aiTWQueries = mergeAndFormatQueries(twQueries);
  const aiUSQueries = mergeAndFormatQueries(usQueries);

  const baseTWUrl = buildUrl(baseTWQueries, "TW", "zh-TW", "TW:zh-Hant");
  const aiTWUrl = buildUrl(aiTWQueries, "TW", "zh-TW", "TW:zh-Hant");
  const baseUSUrl = buildUrl(baseUSQueries, "US", "en-US", "US:en");
  const aiUSUrl = buildUrl(aiUSQueries, "US", "en-US", "US:en");

  console.log("🔍 Google News RSS URL:");
  console.log(baseTWUrl);
  console.log(aiTWUrl);
  console.log(baseUSUrl);
  console.log(aiUSUrl);

  // 2. 並發抓取，但在抓取時打上 Tag (TW / US)
  const [rawTwNews, rawAiTwNews, rawUsNews, rawAiUsNews] = await Promise.all([
    fetchRssFeed(baseTWUrl, 20, "TW"),
    fetchRssFeed(aiTWUrl, 20, "TW"),
    fetchRssFeed(baseUSUrl, 20, "US"),
    fetchRssFeed(aiUSUrl, 20, "US"),
  ]);

  // 3. 將兩邊新聞合併成一個大陣列
  const allRawNews = [
    ...rawTwNews,
    ...rawAiTwNews,
    ...rawUsNews,
    ...rawAiUsNews,
  ];

  console.log(
    `抓取完成：台灣新聞 ${rawTwNews.length} 筆，AI 台灣新聞 ${rawAiTwNews.length} 筆，國際新聞 ${rawUsNews.length} 筆，AI 國際新聞 ${rawAiUsNews.length} 筆，共 ${allRawNews.length} 筆。`,
  );

  const filteredNews = filterNewsByDate(allRawNews, 24);

  console.log(
    `📰 篩選結果: ${allRawNews.length} 筆 → ${filteredNews.length} 筆` +
      `（排除 ${allRawNews.length - filteredNews.length} 筆舊資料）`,
  );

  return filteredNews;
}

export async function getNewsTelegramMessages(marketData) {
  console.log("開始抓取並透過 AI 一次性過濾所有財經新聞...");

  // 取得 AI 生成的動態擴充關鍵字
  const aiQueries = await generateDailySearchQueries(marketData);

  const allRawNews = await getRawNews({
    twQueries: aiQueries.twQueries,
    usQueries: aiQueries.usQueries,
  });

  // 一次性交給 AI 處理
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

  // 排版 Telegram 訊息
  const todayStr = TwDate().formatDateKey(); // 例如 "2026-03-24" (可依照您想要的標題格式替換)

  const buildSection = (newsList, sectionTitle) => {
    if (!newsList || newsList.length === 0) return "";

    let sectionText = `<b>${sectionTitle}</b> ｜ <code>${todayStr}</code>\n\n`;

    newsList.forEach((item, index) => {
      const titleParts = item.title.split(/ - | \| /);
      const cleanTitle = titleParts[0];
      const mediaName =
        titleParts.length > 1 ? titleParts[titleParts.length - 1] : "News";

      // 處理時間格式，用一行取代原本的 15 行
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
