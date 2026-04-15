import "dotenv/config";
import { fileURLToPath } from "url";
import { langfuse } from "./modules/ai/aiClient.mjs";
import { getRawNews } from "./modules/newsFetcher.mjs";
import { generateDailySearchQueries } from "./modules/ai/aiCoach.mjs";
import {
  updatePool,
  purgeExpiredFromPool,
} from "./modules/data/newsPoolManager.mjs";

/** Langfuse score 回寫，失敗不阻斷主流程 */
async function safeLangfuseScore(payload) {
  try {
    await langfuse.score(payload);
  } catch (err) {
    console.warn(
      `⚠️ [Langfuse] score 寫入失敗 (${payload.name}):`,
      err.message,
    );
  }
}

/**
 * 新聞抓取管線核心邏輯。
 * 提取為独立函數供 Bot 指令與 CLI 共用。
 */
export async function runNewsFetch() {
  console.log("📰 [NewsFetch] 開始執行新聞抓取管線...");

  const {
    twQueries,
    usQueries,
    traceId: searchTraceId,
  } = await generateDailySearchQueries({
    marketStatus: "暫無即時市況",
    vix: "N/A",
  });

  const { articles, metrics } = await getRawNews({ twQueries, usQueries });
  console.log(`📰 [NewsFetch] 抓取完成，共 ${articles.length} 篇有效文章`);

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
    console.warn(
      "⚠️ [NewsFetch] searchTraceId 為 null，跳過 Yield Rate score 寫入",
    );
  }

  if (articles.length === 0) {
    console.warn("⚠️ [NewsFetch] 無有效文章，跳過寫入 pool");
    return { appended: 0, total: 0 };
  }

  const { appended, expired, skipped_fuzzy, total, sourceCounts, sourceCount } =
    await updatePool(articles);
  console.log(
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

  await purgeExpiredFromPool();
  return { appended, total };
}

// ── CLI 入口（直接執行此檔案時）──
async function main() {
  try {
    await runNewsFetch();
  } catch (err) {
    console.error("❌ [NewsFetch] 管線發生錯誤:", err);
    process.exit(1);
  } finally {
    console.log("🔒 [NewsFetch] 正在關閉 Langfuse...");
    await langfuse.shutdownAsync().catch((e) => {
      console.warn("⚠️ Langfuse 關閉失敗:", e.message);
    });
    console.log("✅ [NewsFetch] 執行完成");
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
