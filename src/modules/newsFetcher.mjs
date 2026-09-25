import Parser from "rss-parser";
import { escapeHTML, TwDate, sleep } from "../utils/coreUtils.mjs";
import { filterAndCategorizeAllNewsWithAI } from "./ai/aiCoach.mjs";
import {
  baseTwQueries,
  baseUsQueries,
  twExcludeKeywords,
  usExcludeKeywords,
  loadBlacklist,
} from "./keywordConfig.mjs";
import { archiveManager } from "./data/archiveManager.mjs";
import {
  loadPoolWithFallback,
  buildFingerprint,
} from "./data/newsPoolManager.mjs";
import logger from "../utils/logger.mjs";

// ── 工具函式 ────────────────────────────────────────────────────────────────────────────────

const FALLBACK_THRESHOLD = 5;

export function buildSingleKeywordQueryStr(item, excludeList = []) {
  const include =
    item.searchType === "intitle"
      ? `intitle:"${item.keyword}"`
      : `"${item.keyword}"`;

  const excludeParts = excludeList.map((ex) =>
    ex.searchType === "intitle"
      ? `-intitle:"${ex.keyword}"`
      : `-"${ex.keyword}"`,
  );

  return [include, "+when:6h", ...excludeParts].join(" ");
}

export function validateDynamicKeyword(item, staticPool) {
  if (!item?.keyword || typeof item.keyword !== "string") return false;
  const kw = item.keyword.trim();
  if (kw.length < 2) return false;
  if (/^[A-Z]{2,5}$/.test(kw)) return false;
  const words = kw.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  if (staticPool.some((s) => s.keyword.toLowerCase() === kw.toLowerCase()))
    return false;
  return true;
}

export function mergeKeywords(baseList, dynamicList) {
  const validated = dynamicList.filter((item) =>
    validateDynamicKeyword(item, baseList),
  );
  const invalidCount = dynamicList.length - validated.length;
  if (invalidCount > 0) {
    logger.warn(
      { invalidCount },
      `⚠️ [Keywords] 已過濾 ${invalidCount} 個不合規動態關鍵字`,
    );
  }
  const mergedMap = new Map();
  [...baseList, ...validated].forEach((item) =>
    mergedMap.set(item.keyword.toLowerCase(), item),
  );
  return Array.from(mergedMap.values());
}

/**
 * 批次抓取 RSS，同時統計每個 keyword 是否至少命中 1 篇
 * @returns {{ articles: object[], queryHits: Array<{keyword:string, isDynamic:boolean, hit:boolean}> }}
 */
async function fetchBatchedByKeywords(
  keywords,
  region,
  excludeList,
  baseList,
  concurrency = 5,
  delayMs = 300,
) {
  const [gl, hl, ceid] =
    region === "TW" ? ["TW", "zh-TW", "TW:zh-Hant"] : ["US", "en-US", "US:en"];

  const articles = [];
  const queryHits = [];

  for (let i = 0; i < keywords.length; i += concurrency) {
    const chunk = keywords.slice(i, i + concurrency);
    const chunkResults = await Promise.allSettled(
      chunk.map((item) => {
        const queryStr = buildSingleKeywordQueryStr(item, excludeList);
        const url = buildUrl(queryStr, gl, hl, ceid);
        return fetchRssFeed(url, 30, region);
      }),
    );

    chunk.forEach((item, idx) => {
      const result = chunkResults[idx];
      const items = result.status === "fulfilled" ? result.value : [];
      if (result.status === "rejected") {
        logger.warn(
          { keyword: item.keyword, error: result.reason?.message },
          `⚠️ [RSS] 關鍵字「${item.keyword}」抓取失敗`,
        );
      }
      const hit = items.length > 0;
      const isDynamic = !baseList.some(
        (b) => b.keyword.toLowerCase() === item.keyword.toLowerCase(),
      );
      queryHits.push({ keyword: item.keyword, isDynamic, hit });
      articles.push(...items);
    });
    const isLast = i + concurrency >= keywords.length;
    if (!isLast) await sleep(delayMs);
  }

  return { articles, queryHits };
}

const parser = new Parser({
  customFields: {
    item: [
      ["source", "source"],
      ["source", "sourceUrl", { keepArray: false, attr: "url" }],
    ],
  },
});

async function fetchRssFeed(url, maxItems = 10, sourceTag = "") {
  try {
    const feed = await parser.parseURL(url);
    return feed.items.slice(0, maxItems).map((item) => ({
      ...item,
      _region: sourceTag,
    }));
  } catch (error) {
    logger.error({ url, error: error.message }, `❌ 抓取 RSS 失敗 (${url})`);
    return [];
  }
}

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
 * 依日期過濾新聞。
 * 雖然 RSS 查詢已加上 `+when:6h`，但此處再次過濾可防禦
 * 搜尋引擎偶發回傳錯誤時間戳（如舊聞重上架）的情境。
 */
function filterNewsByDate(newsList, withinHours = 6) {
  const now = Date.now();
  const cutoff = now - withinHours * 60 * 60 * 1000;

  return newsList.filter((news) => {
    if (!news.pubDate) return false;
    const pubTime = new Date(news.pubDate).getTime();
    if (isNaN(pubTime)) {
      logger.warn(
        { title: news.title, pubDate: news.pubDate },
        `⚠️ 無法解析時間，略過`,
      );
      return false;
    }
    if (pubTime > now + 60 * 60 * 1000) {
      logger.warn(
        { title: news.title, pubDate: news.pubDate },
        `⚠️ 異常未來時間，略過`,
      );
      return false;
    }
    return pubTime >= cutoff;
  });
}

function isTitleTooShort(title) {
  if (!title) return true;
  const cleanTitle = title.replace(/\s/g, "");
  const chineseCount = (cleanTitle.match(/[\u4e00-\u9fff]/g) || []).length;
  const totalCount = cleanTitle.length;
  if (chineseCount / totalCount > 0.3) return totalCount < 15;
  return title.trim().length < 40;
}

function prepareNewsForAI(newsList, maxPerRegion = 20, blacklist = null) {
  logger.info({ count: newsList.length }, `📰 原始新聞：${newsList.length} 筆`);
  const recent = filterNewsByDate(newsList, 6);
  logger.info({ count: recent.length }, `📰 時間篩選後：${recent.length} 筆`);

  const filteredBySource = recent.filter((news) => {
    const source = news.source || "unknown";
    const excludedSources =
      news._region === "TW"
        ? (blacklist?.twExcludedSources ?? [])
        : (blacklist?.usExcludedSources ?? []);
    return !excludedSources.includes(source);
  });
  logger.info(
    { count: filteredBySource.length },
    `📰 排除來源後：${filteredBySource.length} 筆`,
  );

  const activePatterns = blacklist?.titleBlackListPatterns ?? [];
  const titleFiltered = filteredBySource.filter(
    (news) => !activePatterns.some((pattern) => pattern.test(news.title)),
  );
  logger.info(
    { count: titleFiltered.length },
    `📰 標題黑名單過濾後：${titleFiltered.length} 筆`,
  );

  const sourceCount = {};
  const MAX_PER_SOURCE = 5;
  const dedupedBySource = titleFiltered.filter((news) => {
    const source = news.source || "unknown";
    sourceCount[source] = (sourceCount[source] || 0) + 1;
    return sourceCount[source] <= MAX_PER_SOURCE;
  });
  logger.info(
    { count: dedupedBySource.length },
    `📰 來源去重後：${dedupedBySource.length} 筆`,
  );

  const filteredByTitleLength = dedupedBySource.filter(
    (news) => !isTitleTooShort(news.title),
  );
  logger.info(
    { count: filteredByTitleLength.length },
    `📰 標題長度篩選後：${filteredByTitleLength.length} 筆`,
  );

  const seenFingerprints = new Set();
  const dedupedByTitle = filteredByTitleLength.filter((news) => {
    const fp = buildFingerprint(news.title);
    if (seenFingerprints.has(fp)) return false;
    seenFingerprints.add(fp);
    return true;
  });
  logger.info(
    { count: dedupedByTitle.length },
    `📰 標題去重後：${dedupedByTitle.length} 筆`,
  );

  const sorted = dedupedByTitle.sort(
    (a, b) => new Date(b.pubDate) - new Date(a.pubDate),
  );

  const twNews = sorted
    .filter((n) => n._region === "TW")
    .slice(0, maxPerRegion);
  const usNews = sorted
    .filter((n) => n._region === "US")
    .slice(0, maxPerRegion);

  return [...twNews, ...usNews];
}

/**
 * 計算 queryHits 陣列的良率指標
 */
function calcYieldMetrics(queryHits) {
  const total = queryHits.length;
  const matched = queryHits.filter((q) => q.hit).length;

  const dynamicHits = queryHits.filter((q) => q.isDynamic);
  const dynamicTotal = dynamicHits.length;
  const dynamicMatched = dynamicHits.filter((q) => q.hit).length;

  return {
    keywordYieldRate: total > 0 ? matched / total : 0,
    dynamicKeywordYieldRate:
      dynamicTotal > 0 ? dynamicMatched / dynamicTotal : 0,
    totalQueryCount: total,
    dynamicQueryCount: dynamicTotal,
    matchedQueryCount: matched,
    dynamicMatchedQueryCount: dynamicMatched,
  };
}

/**
 * 新聞採集管線專用：抓取 RSS 原始新聞並完成品質篩選
 */
export async function getRawNews({ twQueries, usQueries }) {
  const blacklist = await loadBlacklist();

  const mergedTW = mergeKeywords(baseTwQueries, twQueries);
  const mergedUS = mergeKeywords(baseUsQueries, usQueries);
  logger.info(
    {
      twCount: mergedTW.length,
      twStatic: baseTwQueries.length,
      twDynamic: mergedTW.length - baseTwQueries.length,
    },
    `🔍 [Keywords] TW: ${mergedTW.length} 組（靜態 ${baseTwQueries.length} + 動態 ${mergedTW.length - baseTwQueries.length}）`,
  );
  logger.info(
    {
      usCount: mergedUS.length,
      usStatic: baseUsQueries.length,
      usDynamic: mergedUS.length - baseUsQueries.length,
    },
    `🔍 [Keywords] US: ${mergedUS.length} 組（靜態 ${baseUsQueries.length} + 動態 ${mergedUS.length - baseUsQueries.length}）`,
  );

  const [twResult, usResult] = await Promise.all([
    fetchBatchedByKeywords(mergedTW, "TW", twExcludeKeywords, baseTwQueries),
    fetchBatchedByKeywords(mergedUS, "US", usExcludeKeywords, baseUsQueries),
  ]);

  const allRawNews = [...twResult.articles, ...usResult.articles];
  const allQueryHits = [...twResult.queryHits, ...usResult.queryHits];
  logger.info(
    { count: allRawNews.length },
    `📰 總共抓取 ${allRawNews.length} 則新聞`,
  );

  let filteredNews = prepareNewsForAI(allRawNews, 20, blacklist);
  logger.info(
    {
      from: allRawNews.length,
      to: filteredNews.length,
      excluded: allRawNews.length - filteredNews.length,
    },
    `📰 篩選結果：${allRawNews.length} 筆 → ${filteredNews.length} 筆（排除 ${allRawNews.length - filteredNews.length} 筆）`,
  );

  let fallbackTriggered = false;
  if (filteredNews.length < FALLBACK_THRESHOLD) {
    logger.warn(
      { current: filteredNews.length, threshold: FALLBACK_THRESHOLD },
      `⚠️ [Fallback] 文章不足 (${filteredNews.length} < ${FALLBACK_THRESHOLD})，改用純靜態池重試...`,
    );
    fallbackTriggered = true;
    const [fbTw, fbUs] = await Promise.all([
      fetchBatchedByKeywords(
        baseTwQueries,
        "TW",
        twExcludeKeywords,
        baseTwQueries,
      ),
      fetchBatchedByKeywords(
        baseUsQueries,
        "US",
        usExcludeKeywords,
        baseUsQueries,
      ),
    ]);
    filteredNews = prepareNewsForAI(
      [...fbTw.articles, ...fbUs.articles],
      20,
      blacklist,
    );
    logger.info(
      { count: filteredNews.length },
      `🔄 [Fallback] 靜態池結果：${filteredNews.length} 筆`,
    );
  }

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

  const metrics = calcYieldMetrics(allQueryHits);
  logger.info(
    {
      keywordYieldRate: (metrics.keywordYieldRate * 100).toFixed(1),
      matched: metrics.matchedQueryCount,
      total: metrics.totalQueryCount,
      dynamicYieldRate: (metrics.dynamicKeywordYieldRate * 100).toFixed(1),
      dynamicMatched: metrics.dynamicMatchedQueryCount,
      dynamicTotal: metrics.dynamicQueryCount,
    },
    `📊 [YieldRate] 整體: ${(metrics.keywordYieldRate * 100).toFixed(1)}% (${metrics.matchedQueryCount}/${metrics.totalQueryCount}) | 動態: ${(metrics.dynamicKeywordYieldRate * 100).toFixed(1)}% (${metrics.dynamicMatchedQueryCount}/${metrics.dynamicQueryCount})`,
  );

  return { articles: filteredNews, metrics };
}

/**
 * 决策管線專用：從 news pool 讀取新聞 → AI 過濾 → 組裝 Telegram 訊息
 * 由 dailyCheck.mjs 呼叫，不再即時抓取 RSS
 *
 * @returns {{
 *   messages: Array,
 *   summaryText: string,
 *   conflictSummary: string,
 *   structured: { tw: Array, us: Array }
 * }}
 */
export async function getNewsTelegramMessages() {
  logger.info(`📰 [NewsTelegram] 從 news pool 讀取新聞並進行 AI 過濾...`);

  const { articles, meta, isFallback } = await loadPoolWithFallback();

  if (isFallback) {
    logger.warn(`⚠️ [NewsTelegram] 使用昨日 archive 降級資料`);
  }

  // 無新聞时的空結構
  const emptyStructured = { tw: [], us: [] };

  if (articles.length === 0) {
    logger.warn(`⚠️ [NewsTelegram] pool 與 archive 均為空，回傳無新聞結果`);
    return {
      messages: [{ text: "<i>過去 24 小時內無符合策略之重大市場動態。</i>" }],
      summaryText: "今日無重大市場新聞。",
      conflictSummary: "",
      structured: emptyStructured,
    };
  }

  logger.info(
    { count: articles.length },
    `📰 [NewsTelegram] pool 共 ${articles.length} 篇，送入 AI 過濾`,
  );

  const {
    news: processedNews,
    conflictSummary,
    analysisStatus,
  } = await filterAndCategorizeAllNewsWithAI(articles, meta?.last_updated);

  if (processedNews.length === 0) {
    return {
      messages: [{ text: "<i>過去 24 小時內無符合策略之重大市場動態。</i>" }],
      summaryText: "今日無重大市場新聞。",
      conflictSummary,
      structured: emptyStructured,
      ...(analysisStatus ? { analysisStatus } : {}),
    };
  }

  const groupedNews = processedNews.reduce(
    (acc, current) => {
      const region = current._region;
      if (!acc[region]) acc[region] = [];
      acc[region].push(current);
      return acc;
    },
    { TW: [], US: [] },
  );

  const todayStr = TwDate().formatDateKey();

  const buildSection = (newsList, sectionTitle) => {
    if (!newsList || newsList.length === 0) return "";

    let sectionText = `<b>${sectionTitle}</b> ｜ <code>${todayStr}</code>\n\n`;

    newsList.forEach((item, index) => {
      const titleParts = item.title.split(/ - | \| /);
      const cleanTitle = titleParts[0];
      const mediaName =
        titleParts.length > 1 ? titleParts[titleParts.length - 1] : "News";

      const timeObj = TwDate(item.pubDate);
      const timeString = timeObj.isValid
        ? timeObj.formatDateTime()
        : "時間未知";

      sectionText += `${index + 1}. <a href="${item.link}">${escapeHTML(cleanTitle)}</a>\n`;
      sectionText += `   <i>${timeString} ｜ ${escapeHTML(mediaName)}</i>\n`;
      sectionText += `   <blockquote expandable>${escapeHTML(item.summary)}</blockquote>\n\n`;
    });

    return sectionText.trim();
  };

  const msgTextTW = buildSection(groupedNews["TW"], "🇹🇼 台灣市場動態");
  const msgTextGLOBAL = buildSection(groupedNews["US"], "🌎 國際總經與趨勢");

  const messagesToSend = [];
  if (msgTextTW)
    messagesToSend.push({ text: msgTextTW, disable_notification: true });
  if (msgTextGLOBAL)
    messagesToSend.push({ text: msgTextGLOBAL, disable_notification: true });

  if (messagesToSend.length === 0) {
    return {
      messages: [
        {
          text: `<b>🗹️ 重大市場情報</b> ｜ <code>${todayStr}</code>\n<i>今日無符合策略之重大市場動態。</i>`,
        },
      ],
      summaryText: "今日無重大市場新聞。",
      conflictSummary,
      structured: emptyStructured,
    };
  }

  const newsSummaryText = processedNews
    .map((item, index) => {
      const cleanTitle = item.title.split(/ - | \| /)[0];
      return `${index + 1}. [${item._region}] ${cleanTitle}\n   → 摘要：${item.summary}`;
    })
    .join("\n\n");

  return {
    messages: messagesToSend,
    summaryText: newsSummaryText,
    conflictSummary,
    // ── Mini App 用：AI 精選新聞結構化資料 ──
    structured: {
      tw: groupedNews["TW"] ?? [],
      us: groupedNews["US"] ?? [],
    },
  };
}
