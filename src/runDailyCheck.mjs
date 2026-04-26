import "dotenv/config";
import { dailyCheck } from "./dailyCheck.mjs";
import { langfuse } from "./modules/ai/aiClient.mjs";
import logger from "./utils/logger.mjs";

async function main() {
  // 解析命令列參數
  const args = process.argv.slice(2);

  // 預設行為 (手動執行時的預設值)
  let isTelegramEnabled = true; // 預設發 Telegram
  let isAIAdvisor = true; // 預設產出AI建議

  if (args.includes("--telegram=false")) isTelegramEnabled = false;
  if (args.includes("--telegram=true")) isTelegramEnabled = true;

  if (args.includes("--aiAdvisor=false")) isAIAdvisor = false;
  if (args.includes("--aiAdvisor=true")) isAIAdvisor = true;

  logger.info({ isTelegramEnabled, isAIAdvisor }, "啟動 dailyCheck 排程任務");

  try {
    await dailyCheck({
      isTelegramEnabled: isTelegramEnabled,
      isAIAdvisor: isAIAdvisor,
    });
  } catch (err) {
    logger.error(err, "❌ 系統發生嚴重錯誤");
    process.exit(1);
  } finally {
    logger.info("🚀 dailyCheck 執行結束");
    // 確保 Langfuse 正確關閉，避免資源洩漏
    logger.info("🔒 正在關閉 Langfuse...");
    try {
      await langfuse.shutdownAsync();
      logger.info("✅ Langfuse 已關閉");
    } catch (e) {
      logger.warn(e, "⚠️ Langfuse 關閉失敗");
    }
  }
}

main();
