import "dotenv/config";
import { fileURLToPath } from "url";
import { runNewsFetch as fetchAndScoreNews } from "./scheduler/newsFetch.mjs";
import {
  shutdownLangfuse,
  createLangfuseScore,
} from "./modules/ai/langfuseClient.mjs";
import logger from "./utils/logger.mjs";

/** Langfuse score 回寫 */
async function _safeLangfuseScore(payload) {
  try {
    await createLangfuseScore(payload.traceId, payload.name, payload.value, {
      comment: payload.comment,
    });
  } catch (err) {
    logger.warn(err, `⚠️ [Langfuse] score 寫入失敗 (${payload.name})`);
  }
}

/**
 * Bot 指令呼叫入口 (不自動關閉 Langfuse，由 bot 生命週期管理)
 */
export async function runNewsFetch() {
  const res = await fetchAndScoreNews({});
  return res;
}

// ── CLI 入口（直接執行此檔案時）──
async function main() {
  try {
    await fetchAndScoreNews({});
  } catch (err) {
    logger.error(err, "❌ [NewsFetch] 管線發生錯誤");
    process.exit(1);
  } finally {
    logger.info("🔒 [NewsFetch] 正在關閉 Langfuse...");
    try {
      await shutdownLangfuse();
      logger.info("✅ [NewsFetch] Langfuse 已關閉");
    } catch (e) {
      logger.warn(e, "⚠️ Langfuse 關閉失敗");
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
