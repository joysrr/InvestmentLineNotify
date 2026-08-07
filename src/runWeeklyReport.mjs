import "dotenv/config";
import { fileURLToPath } from "url";
import { runWeeklyReport } from "./scheduler/weeklyReport.mjs";
import { langfuse } from "./modules/ai/aiClient.mjs";
import logger from "./utils/logger.mjs";

// ── CLI 入口（直接執行此檔案時）──
async function main() {
  try {
    await runWeeklyReport({});
  } catch (err) {
    logger.error(err, "❌ [WeeklyReport] 執行失敗");
    process.exit(1);
  } finally {
    logger.info("🔒 [WeeklyReport] 正在關閉 Langfuse...");
    try {
      await langfuse.shutdownAsync();
      logger.info("✅ [WeeklyReport] Langfuse 已關閉");
    } catch (e) {
      logger.warn(e, "⚠️ Langfuse 關閉失敗");
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
