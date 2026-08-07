// src/scheduler/newsFetch.mjs
// 新聞抓取管線核心邏輯
// 提取為獨立函數供 Bot 指令與 CLI 共用

import { fileURLToPath } from "url";
import { archiveManager } from "../modules/data/archiveManager.mjs";
import { generateDailySearchQueries } from "../modules/ai/aiCoach.mjs";
import { getRawNews } from "../modules/newsFetcher.mjs";
import {
  updatePool,
  purgeExpiredFromPool,
} from "../modules/data/newsPoolManager.mjs";
import { langfuse } from "../modules/ai/aiClient.mjs";
import logger from "../utils/logger.mjs";

/** Langfuse score 回寫，失敗不阻斷主流程 */
async function safeLangfuseScore(payload) {
  try {
    await langfuse.score(payload);
  } catch (err) {
    logger.warn(err, `⚠️ [Langfuse] score 寫入失敗 (${payload.name})`);
  }
}

/**
 * 新聞抓取管線核心邏輯
 * @param {Object} deps - 依賴注入物件
 * @param {Object} deps.dataProvider - 符合 IDataProvider 介面
 * @param {Object} deps.aiProvider - 符合 IAIProvider 介面
 * @param {Object} deps.notifier - 符合 INotifier 介面 (可選)
 * @returns {Promise<Object>} { appended, total }
 */
export async function runNewsFetch(_deps = {}) {
  logger.info("📰 [NewsFetch] 開始執行新聞抓取管線...");

  let vix = "N/A";
  let marketStatus = "暫無即時市況";

  try {
    const cache = await archiveManager.getLatestMarketData();
    if (cache && cache.data) {
      if (cache.data.rawUsMarket?.vix)
        vix = cache.data.rawUsMarket.vix.toString();
      marketStatus = "已載入最新市況";
    }
  } catch (err) {
    logger.warn("⚠️ [NewsFetch] 無法讀取最新市況，將使用預設值");
  }

  const {
    twQueries,
    usQueries,
    traceId: searchTraceId,
  } = await generateDailySearchQueries({
    marketStatus,
    vix,
  });

  const { articles, metrics } = await getRawNews({ twQueries, usQueries });
  logger.info(`📰 [NewsFetch] 抓取完成，共 ${articles.length} 篇有效文章`);

  if (searchTraceId) {
    await safeLangfuseScore({
      traceId: searchTraceId,
      name: "Keyword_Yield_Rate",
      value: metrics.keywordYieldRate,
      comment: JSON.stringify({
        matched: metrics.matchedQueryCount,
        total: metrics.totalQueryCount,
        dynamicMatched: metrics.dynamicMatchedQueryCount,
        dynamicTotal: metrics.dynamicQueryCount,
      }),
    });
    await safeLangfuseScore({
      traceId: searchTraceId,
      name: "Dynamic_Keyword_Yield_Rate",
      value: metrics.dynamicKeywordYieldRate,
      comment: JSON.stringify({
        matched: metrics.dynamicMatchedQueryCount,
        total: metrics.dynamicQueryCount,
      }),
    });
  } else {
    logger.warn(
      "⚠️ [NewsFetch] searchTraceId 為 null，跳過 Yield Rate score 寫入",
    );
  }

  if (articles.length === 0) {
    logger.warn("⚠️ [NewsFetch] 無有效文章，跳過寫入 pool");
    return { appended: 0, total: 0 };
  }

  const { appended, expired, skipped_fuzzy, total, sourceCounts, sourceCount } =
    await updatePool(articles);
  logger.info(
    `✅ [NewsFetch] pool 更新完成 — 新增: ${appended}，fuzzy 跳過: ${skipped_fuzzy}，` +
      `過期歸檔: ${expired}，目前 pool 總量: ${total}，來源種類: ${sourceCount}`,
  );

  if (searchTraceId && appended > 0) {
    await safeLangfuseScore({
      traceId: searchTraceId,
      name: "Source_Diversity",
      value: parseFloat((sourceCount / appended).toFixed(4)),
      comment: JSON.stringify(sourceCounts),
    });
  }

  // updatePool 已包含 purgeExpiredFromPool 的邏輯，故移除重複呼叫
  return { appended, total };
}

// ── CLI 入口（直接執行此檔案時）──
async function main() {
  try {
    await runNewsFetch({});
  } catch (err) {
    logger.error(err, "❌ [NewsFetch] 管線發生錯誤");
    process.exit(1);
  } finally {
    logger.info("🔒 [NewsFetch] 正在關閉 Langfuse...");
    try {
      const { langfuse } = await import("../modules/ai/aiClient.mjs");
      await langfuse.shutdownAsync();
      logger.info("✅ [NewsFetch] Langfuse 已關閉");
    } catch (e) {
      logger.warn(e, "⚠️ Langfuse 關閉失敗");
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
