import "dotenv/config";
import { fileURLToPath } from "url";
import { runNewsFetch } from "./scheduler/newsFetch.mjs";
import { langfuse } from "./modules/ai/aiClient.mjs";
import logger from "./utils/logger.mjs";

/** Langfuse score 回寫，失敗不阻斷主流程 */
async function _safeLangfuseScore(payload) {
  try {
    await langfuse.score(payload);
  } catch (err) {
    logger.warn(err, `⚠️ [Langfuse] score 寫入失敗 (${payload.name})`);
  }
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
