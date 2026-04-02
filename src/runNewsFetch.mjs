import "dotenv/config";
import { langfuse } from "./modules/ai/aiClient.mjs";
import { getRawNews } from "./modules/newsFetcher.mjs";
import { generateDailySearchQueries } from "./modules/ai/aiCoach.mjs";
import { updatePool } from "./modules/data/newsPoolManager.mjs";

async function main() {
  console.log("📰 [NewsFetch] 開始執行新聞抓取管線...");

  try {
    // 1. 產生 AI 動態關鍵字（傳入空的 marketData，關鍵字由 AI 自行推演）
    console.log("🧠 [NewsFetch] 產生 AI 動態搜尋關鍵字...");
    const aiQueries = await generateDailySearchQueries({
      marketStatus: "暫無即時市況",
      vix: "N/A",
    });

    // 2. 抓取 RSS 原始新聞（含品質篩選、歷存、Fallback）
    console.log("📰 [NewsFetch] 開始抓取 RSS 新聞...");
    const articles = await getRawNews({
      twQueries: aiQueries.twQueries,
      usQueries: aiQueries.usQueries,
    });

    console.log(`📰 [NewsFetch] 抓取完成，共 ${articles.length} 篇有效文章`);

    if (articles.length === 0) {
      console.warn("⚠️ [NewsFetch] 無有效文章，跳過寫入 pool");
      return;
    }

    // 3. 更新 pool（自動去重、過期归檔、更新 age_band）
    const { appended, expired, total } = await updatePool(articles);
    console.log(`✅ [NewsFetch] pool 更新完成 — 新增: ${appended}，過期归檔: ${expired}，目前 pool 總量: ${total}`);

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
