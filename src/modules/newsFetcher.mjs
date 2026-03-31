import Parser from "rss-parser";
import { escapeHTML, TwDate, sleep } from "../utils/coreUtils.mjs";
import {
  filterAndCategorizeAllNewsWithAI,
  generateDailySearchQueries,
} from "./ai/aiCoach.mjs";
import {
  baseTwQueries,
  baseUsQueries,
  twExcludeKeywords,
  usExcludeKeywords,
  loadBlacklist,
} from "./keywordConfig.mjs";               // ← 路徑請自行確認
import { archiveManager } from "./data/archiveManager.mjs"; // ← 路徑請自行確認

// ── 工具函式 ──────────────────────────────────────────────────────────────

const FALLBACK_THRESHOLD = 5;

/**
 * 將單一查詢條件物件轉為 Google News RSS query 字串
 * @param {{ keyword: string, searchType: "intitle"|"broad" }} item
 * @param {{ keyword: string, searchType: "intitle"|"broad" }[]} excludeList
 */
function buildSingleKeywordQueryStr(item, excludeList = []) {
  const include =
    item.searchType === "intitle"
      ? `intitle:"${item.keyword}"`
      : `"${item.keyword}"`;

  const excludeParts = excludeList.map((ex) =>
    ex.searchType === "intitle"
      ? `-intitle:"${ex.keyword}"`
      : `-"${ex.keyword}"`
  );

  return [include, "+when:1d", ...excludeParts].join(" ");
}

/**
 * 驗證 AI 回傳的動態關鍵字是否合規
 * @param {{ keyword: string, searchType: string }} item
 * @param {{ keyword: string }[]} staticPool
 */
function validateDynamicKeyword(item, staticPool) {
  if (!item?.keyword || typeof item.keyword !== "string") return false;
  const kw = item.keyword.trim();
  if (kw.length < 2) return false;

  // 禁止單一全大寫英文縮寫
  if (/^[A-Z]{2,5}$/.test(kw)) return false;

  // 語意單元數量：1~4 個
  const tokens = kw.match(/[\u4e00-\u9fff\u3400-\u4dbf]+|[a-zA-Z0-9]+/g) ?? [];
  if (tokens.length < 1 || tokens.length > 4) return false;

  // 禁止重複靜態池
  if (staticPool.some((s) => s.keyword.toLowerCase() === kw.toLowerCase()))
    return false;

  return true;
}

/**
 * 合併靜態池 + AI 動態關鍵字，去重驗證
 */
function mergeKeywords(baseList, dynamicList) {
  const validated = dynamicList.filter((item) =>
    validateDynamicKeyword(item, baseList)
  );
  const invalidCount = dynamicList.length - validated.length;
  if (invalidCount > 0) {
    console.warn(`⚠️ [Keywords] 已過濾 ${invalidCount} 個不合規動態關鍵字`);
  }
  const mergedMap = new Map();
  [...baseList, ...validated].forEach((item) =>
    mergedMap.set(item.keyword.toLowerCase(), item)
  );
  return Array.from(mergedMap.values());
}

/**
 * 以分批並行方式抓取所有關鍵字的 RSS（5個一批，批次間 300ms）
 * @param {{ keyword: string, searchType: string }[]} keywords
 * @param {"TW"|"US"} region
 * @param {{ keyword: string, searchType: string }[]} excludeList
 * @param {number} concurrency
 * @param {number} delayMs
 */
async function fetchBatchedByKeywords(
  keywords,
  region,
  excludeList,
  concurrency = 5,
  delayMs = 300
) {
  const [gl, hl, ceid] =
    region === "TW"
      ? ["TW", "zh-TW", "TW:zh-Hant"]
      : ["US", "en-US", "US:en"];

  const results = [];
  for (let i = 0; i < keywords.length; i += concurrency) {
    const chunk = keywords.slice(i, i + concurrency);
    const chunkResults = await Promise.all(
      chunk.map((item) => {
        const queryStr = buildSingleKeywordQueryStr(item, excludeList);
        const url = buildUrl(queryStr, gl, hl, ceid);
        return fetchRssFeed(url, 30, region);
      })
    );
    results.push(...chunkResults.flat());

    const isLast = i + concurrency >= keywords.length;
    if (!isLast) await sleep(delayMs);
  }
  return results;
}


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
function prepareNewsForAI(newsList, maxPerRegion = 20, blacklist = null) {
  console.log(`📰 原始新聞: ${newsList.length} 筆`);
  // 時間篩選（你已有的 filterNewsByDate）
  const recent = filterNewsByDate(newsList, 24);
  console.log(`📰 時間篩選後: ${recent.length} 筆`);

  // 排除特定來源(農場文章或個股報導居多)
  const filteredBySource = recent.filter((news) => {
    const source = news.source || "unknown";
    const excludedSources =
      news._region === "TW"
        ? (blacklist?.twExcludedSources ?? [])
        : (blacklist?.usExcludedSources ?? []);
    return !excludedSources.includes(source);
  });
  console.log(`📰 排除來源後: ${filteredBySource.length} 筆`);

  // 標題模式黑名單過濾
  const activePatterns = blacklist?.titleBlackListPatterns ?? [];
  const titleFiltered = filteredBySource.filter((news) =>
    !activePatterns.some((pattern) => pattern.test(news.title))
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
  // 1. 載入 blacklist（單次 I/O，後續傳遞）
  const blacklist = await loadBlacklist();

  // 2. 合併 + 驗證關鍵字
  const mergedTW = mergeKeywords(baseTwQueries, twQueries);
  const mergedUS = mergeKeywords(baseUsQueries, usQueries);
  console.log(
    `🔍 [Keywords] TW: ${mergedTW.length} 組（靜態 ${baseTwQueries.length} + 動態 ${mergedTW.length - baseTwQueries.length}）`,
  );
  console.log(
    `🔍 [Keywords] US: ${mergedUS.length} 組（靜態 ${baseUsQueries.length} + 動態 ${mergedUS.length - baseUsQueries.length}）`,
  );

  // 3. TW / US 並行抓取（各自分批，5個一批，批次間 300ms）
  const [rawTwNews, rawUsNews] = await Promise.all([
    fetchBatchedByKeywords(mergedTW, "TW", twExcludeKeywords),
    fetchBatchedByKeywords(mergedUS, "US", usExcludeKeywords),
  ]);

  const allRawNews = [...rawTwNews, ...rawUsNews];
  console.log(`📰 總共抓取 ${allRawNews.length} 則新聞`);

  // 4. 篩選
  let filteredNews = prepareNewsForAI(allRawNews, 20, blacklist);
  console.log(
    `📰 篩選結果: ${allRawNews.length} 筆 → ${filteredNews.length} 筆` +
    `（排除 ${allRawNews.length - filteredNews.length} 筆）`,
  );

  // 5. Fallback：篩選後不足閾值，降級為純靜態池重試
  let fallbackTriggered = false;
  if (filteredNews.length < FALLBACK_THRESHOLD) {
    console.warn(
      `⚠️ [Fallback] 文章不足 (${filteredNews.length} < ${FALLBACK_THRESHOLD})，改用純靜態池重試...`,
    );
    fallbackTriggered = true;
    const [fbTw, fbUs] = await Promise.all([
      fetchBatchedByKeywords(baseTwQueries, "TW", twExcludeKeywords),
      fetchBatchedByKeywords(baseUsQueries, "US", usExcludeKeywords),
    ]);
    filteredNews = prepareNewsForAI([...fbTw, ...fbUs], 20, blacklist);
    console.log(`🔄 [Fallback] 靜態池結果: ${filteredNews.length} 筆`);
  }

  // 6. 寫入 passedArticlesLog
  const usedTwKeywords = mergedTW.map((k) => k.keyword);
  const usedUsKeywords = mergedUS.map((k) => k.keyword);
  await Promise.all([
    archiveManager.saveNewsLog(
      filteredNews.filter((n) => n._region === "TW"),
      "TW",
      { usedKeywords: usedTwKeywords, fallbackTriggered },
    ),
    archiveManager.saveNewsLog(
      filteredNews.filter((n) => n._region === "US"),
      "US",
      { usedKeywords: usedUsKeywords, fallbackTriggered },
    ),
  ]);

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
