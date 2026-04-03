import "dotenv/config";
import { langfuse } from "./modules/ai/aiClient.mjs";
import { getRawNews } from "./modules/newsFetcher.mjs";
import { generateDailySearchQueries } from "./modules/ai/aiCoach.mjs";
import { updatePool, purgeExpiredFromPool } from "./modules/data/newsPoolManager.mjs";

/** Langfuse score 回寫，失敗不阻斷主流程 */
async function safeLangfuseScore(payload) {
  try {
    await langfuse.score(payload);
  } catch (err) {
    console.warn(`⚠️ [Langfuse] score 寫入失敗 (${payload.name}):`, err.message);
  }
}

async function main() {
  console.log("📰 [NewsFetch] 開始執行新聞抓取管線...");

  try {
    // 1. 產生 AI 動態關鍵字（傳入空的 marketData，關鍵字由 AI 自行推演）
    console.log("🧠 [NewsFetch] 產生 AI 動態搜尋關鍵字...");
    const { twQueries, usQueries, traceId: searchTraceId } =
      await generateDailySearchQueries({
        marketStatus: "暫無即時市況",
        vix: "N/A",
      });

    // 2. 抓取 RSS 原始新聞（含品質篩選、歸存、Fallback）
    console.log("📰 [NewsFetch] 開始抓取 RSS 新聞...");
    const { articles, metrics } = await getRawNews({ twQueries, usQueries });

    console.log(`📰 [NewsFetch] 抓取完成，共 ${articles.length} 篇有效文章`);

    // 3. 回寫 Yield Rate scores 到 SearchQueries trace（方案 B）
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
      console.warn("⚠️ [NewsFetch] searchTraceId 為 null，跳過 Yield Rate score 寫入");
    }

    if (articles.length === 0) {
      console.warn("⚠️ [NewsFetch] 無有效文章，跳過寫入 pool");
      return;
    }

    // 4. 更新 pool（自動去重、過期歸檔、殭屍清理、上限截斷、更新 age_band）
    const { appended, expired, skipped_fuzzy, total } = await updatePool(articles);
    console.log(
      `✅ [NewsFetch] pool 更新完成 — 新增: ${appended}，fuzzy 跳過: ${skipped_fuzzy}，` +
      `過期歸檔: ${expired}，目前 pool 總量: ${total}`,
    );

    // 5. 額外執行一次 purge，清理本次 updatePool 未觸及的殘留問題
    await purgeExpiredFromPool();

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

main();
