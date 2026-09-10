import "dotenv/config";
import { fileURLToPath } from "url";
import { runWeeklyReport as _runWeeklyReport } from "./scheduler/weeklyReport.mjs";
import { shutdownLangfuse } from "./modules/ai/langfuseClient.mjs";
import logger from "./utils/logger.mjs";

/**
 * Bot 指令呼叫入口 (不自動關閉 Langfuse，由 bot 生命週期管理)
 */
export async function runWeeklyReport() {
  return await _runWeeklyReport({});
}

// ── CLI 入口（直接執行此檔案時）──
async function main() {
  try {
    await _runWeeklyReport({});
  } catch (err) {
    logger.error(err, "❌ [WeeklyReport] 執行失敗");
    process.exit(1);
  } finally {
    logger.info("🔒 [WeeklyReport] 正在關閉 Langfuse...");
    try {
      await shutdownLangfuse();
      logger.info("✅ [WeeklyReport] Langfuse 已關閉");
    } catch (e) {
      logger.warn(e, "⚠️ Langfuse 關閉失敗");
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
