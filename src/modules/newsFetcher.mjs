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

const twExcludeKeywords = [
  { keyword: "排行", searchType: "intitle" },  // 排除各類排行文
  { keyword: "日法人", searchType: "intitle" }, // 排除每日法人買賣超
  { keyword: "即時新聞", searchType: "intitle" }, // 排除即時新聞整理
  { keyword: "買超個股", searchType: "intitle" },  // 排除個股買超整理
  { keyword: "賣超個股", searchType: "intitle" },  // 排除個股賣超整理
  { keyword: "前十大", searchType: "intitle" },
];

const usExcludeKeywords = [
  { keyword: "Q1 Earnings", searchType: "intitle" }, // 排除個股財報
  { keyword: "Q2 Earnings", searchType: "intitle" },
  { keyword: "Q3 Earnings", searchType: "intitle" },
  { keyword: "Q4 Earnings", searchType: "intitle" },
  { keyword: "price target", searchType: "broad" },   // 排除個股目標價調整
  { keyword: "stock forecast", searchType: "broad" },   // 排除個股預測文
  { keyword: "Liquidity Pulse", searchType: "broad" },  // 消滅 Stock Traders Daily 垃圾文
  { keyword: "Liquidity Mapping", searchType: "broad" },  // 同上
  { keyword: "Powell Industries", searchType: "intitle" }, // 排除個股誤抓 Fed Powell
];

const twExcludedSources = [
  "富聯網",
  "Bella.tw儂儂",
  "信報網站",
  "Sin Chew Daily",
  "AASTOCKS.com",
  "FXStreet",
  "Exmoo",
  "facebook.com",
];

const usExcludedSources = [
  // 垃圾站（改到 source 名稱比對，domain 解析對 Google News 無效）
  "Stock Traders Daily",
  "baoquankhu1.vn",            // ✅ 從 domainBlackList 移來，[76][77][80][86][93][103]
  "International Supermarket News",
  "AASTOCKS.com",              // [81] US Treasury 新聞誤觸發
  // 印度媒體
  "The Economic Times",
  "Devdiscourse",
  "Tribune India",
  "ANI News",
  "India TV News",
  "The Financial Express",
  "Moneycontrol.com",
  "The Hans India",
  "Mint",
  // 澳洲/紐西蘭媒體
  "NZ Herald",
  "Otago Daily Times",
  "Finimize",
  "investordaily.com.au",
  "The Australian",
  // 非相關國/地區媒體
  "Economy Middle East",
  "LEADERSHIP Newspapers",
  "Punch Newspapers",
  "Joburg ETC",
  "Eunews",
  "European Commission",
  "BusinessToday Malaysia",
  "Human Resources Online",
  "Tornos News",
  "Royal Gazette | Bermuda",
  "AD HOC NEWS",
  "simplywall.st",
  "MarketBeat",
  "parameter.io",
  "Stock Titan",
  "Truthout",
  "inkorr.com",
  "ANSA",
  "Yahoo! Finance Canada",
  "صحيفة مال",
  "Arab News PK",              // [97] 埃及/巴基斯坦 GDP
  "Investing.com UK",          // [100] 英國 FTSE 100
  "Yahoo Finance UK",          // [102] 英國 FTSE 100
  "markets.businessinsider.com",
  "ruhrkanal.news",
  "agoranotizia.it",
  "facebook.com",
];

const titleBlackListPatterns = [
  /Liquidity (Pulse|Mapping) .*(Institutional|Price Events)/i,
  /\bon Thin Liquidity,? Not News\b/i,
  /Powell Industries/i,
  /ISM.*(University|Saddle|Bike|Supermarket|Rankings|Dhanbad)/i,
  /India.*(GDP|growth forecast|economy)/i,
  /GDP.*(India|FY2[67]|FY'2[67])/i,
  /(Belize|Oman|Estonia|Bulgaria|Romania|Nigeria|Uzbekistan|Scotland|Portugal|UAE|Bahrain|Gisborne|Otago|Italy|Pakistan|Caricom|South Africa|SA's GDP).*(GDP|\beconomy\b)/i,
  /GDP.*(Belize|Oman|Estonia|Bulgaria|Romania|Nigeria|Uzbekistan|Scotland|Portugal|UAE|Bahrain|Gisborne|Otago|Italy|Pakistan)/i,
  /\b(RBA|Reserve Bank of Australia|ASX 200|Australian (stocks?|shares?|economy))\b/i,
  /\b(fiancé|engagement|wedding ring|jealous)\b/i,
  /recession-proof stock/i,
  /FTSE 100/i,                                    // [92][100][102]
  /\d+ inflation-resistant stock/i,               // [88] "1 inflation-resistant stock"
  /(Fed Watch|Fed Meeting|Fed Impact|Treasury Yields:|Volatility Watch|Aug Action|Aug Fed Impact):.*stock.*(–|-)/i,
  /\bBrexit\b/i,
  /小資.{0,10}入場.{0,15}(ETF|[A-Z0-9]{4,6}[AB]?)/,
  /統一推|推出.{0,5}(ETF|[A-Z0-9]{4,6}[AB]?).{0,10}(升級|布局|主動)/,
  /盤[前中後]分析/,
  /盤[前中後]》?[\s\S]{0,5}分析/,
  /處置股.{0,10}(誕生|關到|今日起)/,
  /(最高價|漲停板).{0,10}處置/,
];

const parser = new Parser({
  customFields: {
    item: [
      ["source", "source"],           // 抓標籤內容（媒體名稱）
      ["source", "sourceUrl", { keepArray: false, attr: "url" }], // 抓 url 屬性
    ],
  },
});

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
 * 查詢條件清單轉換成文字RSS查詢條件
 * @param {*} baseList 查詢條件清單
 * @param {*} excludeList 排除條件清單
 * @returns
 */
const formatQueries = (baseList, excludeList = []) => {
  // 正向條件去重
  const mergedMap = new Map();
  baseList.forEach((item) => mergedMap.set(item.keyword.toLowerCase(), item));

  const includeParts = Array.from(mergedMap.values()).map((obj) =>
    obj.searchType === "intitle"
      ? `intitle:"${obj.keyword}"`
      : `"${obj.keyword}"`
  );

  // 排除條件去重
  const excludeMap = new Map();
  excludeList.forEach((item) => excludeMap.set(item.keyword.toLowerCase(), item));

  const excludeParts = Array.from(excludeMap.values()).map((obj) =>
    obj.searchType === "intitle"
      ? `-intitle:"${obj.keyword}"`
      : `-"${obj.keyword}"`
  );

  // 組合：(正向條件) 排除條件1 排除條件2 +when:1d
  const excludeStr = excludeParts.length > 0 ? ` ${excludeParts.join(" ")}` : "";
  return `(${includeParts.join(" OR ")})+when:1d${excludeStr}`;
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
 * 檢查標題是否太短（中文標題至少 15 個字元，英文至少 40 個字元）
 * @param {string} title - 新聞標題
 * @returns {boolean} 是否太短
 */
function isTitleTooShort(title) {
  if (!title) return true;

  const cleanTitle = title.replace(/\s/g, "");
  const chineseCount = (cleanTitle.match(/[\u4e00-\u9fff]/g) || []).length;
  const totalCount = cleanTitle.length;

  // 中文為主（中文字佔 30% 以上）
  if (chineseCount / totalCount > 0.3) {
    return totalCount < 15;
  }

  // 英文為主
  return title.trim().length < 40;
}

/**
 * 新聞品質過濾：確保進入 AI 的新聞筆數與品質受控
 * @param {Array}  newsList   - 原始新聞陣列
 * @param {number} maxPerRegion   - 區域限制新聞筆數
 * @returns {Array}
 */
function prepareNewsForAI(newsList, maxPerRegion = 20) {
  console.log(`📰 原始新聞: ${newsList.length} 筆`);
  // 時間篩選（你已有的 filterNewsByDate）
  const recent = filterNewsByDate(newsList, 24);
  console.log(`📰 時間篩選後: ${recent.length} 筆`);

  // 排除特定來源(農場文章或個股報導居多)
  const filteredBySource = recent.filter((news) => {
    const source = news.source || "unknown";
    const excludedSources = news._region === "TW" ? twExcludedSources : usExcludedSources;
    return !excludedSources.includes(source);
  });
  console.log(`📰 排除來源後: ${filteredBySource.length} 筆`);

  // 標題模式黑名單過濾
  const titleFiltered = filteredBySource.filter((news) =>
    !titleBlackListPatterns.some((pattern) => pattern.test(news.title))
  );
  console.log(`📰 標題黑名單過濾後: ${titleFiltered.length} 筆`);

  // 來源去重（同一來源最多保留 2 篇，避免單一媒體主導）
  const sourceCount = {};
  const dedupedBySource = titleFiltered.filter((news) => {
    const source = news.source || "unknown";   // RSS <source> 標籤的媒體名稱
    sourceCount[source] = (sourceCount[source] || 0) + 1;
    return sourceCount[source] <= 100;           // 同一媒體最多 2 篇
  });
  console.log(`📰 來源去重後: ${dedupedBySource.length} 筆`);

  // 
  // 篩選標題太短的新聞（中文至少 15 個字元，英文至少 40 個字元）
  const filteredByTitleLength = dedupedBySource.filter(news => !isTitleTooShort(news.title));
  console.log(`📰 標題長度篩選後: ${filteredByTitleLength.length} 筆`);

  // 標題去重（cosine 太重，用簡易前 10 字判斷）
  const seen = new Set();
  const dedupedByTitle = filteredByTitleLength.filter((news) => {
    const key = news.title.slice(0, 10);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(`📰 標題去重後: ${dedupedByTitle.length} 筆`);

  // 時間排序（最新優先），依照區域各取N筆
  const sorted = dedupedByTitle
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  const twNews = sorted.filter((n) => n._region === "TW").slice(0, maxPerRegion);
  const usNews = sorted.filter((n) => n._region === "US").slice(0, maxPerRegion);

  return [...twNews, ...usNews];
}

/**
 * 根據提供的兩個面向關鍵字清單，結合基礎的查詢清單，至 Google News RSS 抓取原始新聞資料
 * @param {*} param0
 */
export async function getRawNews({ twQueries, usQueries }) {
  // 合併TW查詢條件並去重
  const mergedMapTW = new Map();
  baseTwQueries.forEach((item) => mergedMapTW.set(item.keyword.toLowerCase(), item));
  twQueries.forEach((item) => mergedMapTW.set(item.keyword.toLowerCase(), item));

  // 合併US查詢條件並去重
  const mergedMapUS = new Map();
  baseUsQueries.forEach((item) => mergedMapUS.set(item.keyword.toLowerCase(), item));
  usQueries.forEach((item) => mergedMapUS.set(item.keyword.toLowerCase(), item));

  // 將查詢條件變成每10個條件批次進行查詢
  const batchSize = 5;
  const twQueryBatches = [];
  for (let i = 0; i < mergedMapTW.size; i += batchSize) {
    const batch = Array.from(mergedMapTW.values()).slice(i, i + batchSize);
    twQueryBatches.push(batch);
  }
  const usQueryBatches = [];
  for (let i = 0; i < mergedMapUS.size; i += batchSize) {
    const batch = Array.from(mergedMapUS.values()).slice(i, i + batchSize)
    usQueryBatches.push(batch);
  }

  // 將每個批次的查詢條件轉換成文字RSS查詢條件，並建立查詢網址
  const baseTWUrls = twQueryBatches.map(batch => buildUrl(formatQueries(batch, twExcludeKeywords), "TW", "zh-TW", "TW:zh-Hant"));
  const baseUSUrls = usQueryBatches.map(batch => buildUrl(formatQueries(batch, usExcludeKeywords), "US", "en-US", "US:en"));

  // 併發抓取，並在抓取時註記Tag區分 TW 和 US
  const rawTwNewsPromises = baseTWUrls.map(url =>
    fetchRssFeed(url, 100, "TW")
  );
  const rawUsNewsPromises = baseUSUrls.map(url =>
    fetchRssFeed(url, 100, "US")
  );
  const rawTwNews = await Promise.all(rawTwNewsPromises);
  const rawUsNews = await Promise.all(rawUsNewsPromises);

  console.log(`📰 台灣新聞批次: ${rawTwNews.length} 批次，每批次 ${batchSize} 個查詢條件`);
  console.log(`📰 國際新聞批次: ${rawUsNews.length} 批次，每批次 ${batchSize} 個查詢條件`);

  // 將所有批次的結果合併成一個陣列
  const allRawNews = [...rawTwNews.flat(), ...rawUsNews.flat()];
  console.log(`📰 總共抓取 ${allRawNews.length} 則新聞`);

  const filteredNews = prepareNewsForAI(allRawNews, 20);

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
