import "dotenv/config";
import { fileURLToPath } from "url";
import { runDailyCheck } from "./scheduler/dailyCheck.mjs";
import { shutdownLangfuse } from "./modules/ai/langfuseClient.mjs";
import logger from "./utils/logger.mjs";

/** 解析命令列參數 */
function parseArgs() {
  const args = process.argv.slice(2);

  // 預設行為 (手動執行時的預設值)
  let isTelegramEnabled = true; // 預設發 Telegram
  let isAIAdvisor = true; // 預設產出AI建議
  let isCallAI = true; // 預設呼叫AI
  let isSheetEnabled = true; // 預設寫入試算表

  // 1. 檢測全域總體開關 (優先級最高)
  if (args.includes("--no-ai")) {
    isCallAI = false;
    isAIAdvisor = false;
  }

  if (args.includes("--no-telegram")) {
    isTelegramEnabled = false;
  }

  if (args.includes("--no-sheets")) {
    isSheetEnabled = false;
  }

  // 2. 個別局部參數檢測 (保持舊有相容性，但也支援 --xxx=false)
  if (args.includes("--telegram=false")) isTelegramEnabled = false;
  if (args.includes("--telegram=true")) isTelegramEnabled = true;

  if (args.includes("--aiAdvisor=false") || args.includes("--no-ai-advisor"))
    isAIAdvisor = false;
  if (args.includes("--aiAdvisor=true")) isAIAdvisor = true;

  if (args.includes("--isCallAI=false")) isCallAI = false;
  if (args.includes("--isCallAI=true")) isCallAI = true;

  // 3. 特別標註：若為 AI 節費測試模式，強化日誌顯示
  if (!isCallAI) {
    console.log(
      "\n💰 [Cost-Saving Mode] 檢測到 --no-ai 參數，已強行關閉所有 LLM 呼叫。\n",
    );
  }

  return { isTelegramEnabled, isAIAdvisor, isCallAI, isSheetEnabled };
}

// ── CLI 入口（直接執行此檔案時）──
async function main() {
  const options = parseArgs();

  logger.info({ ...options }, "啟動 dailyCheck 排程任務");

  let exitCode = 0;
  try {
    await runDailyCheck({}, options);
  } catch (err) {
    logger.error(err, "❌ 系統發生嚴重錯誤");
    exitCode = 1;
  } finally {
    logger.info("🚀 dailyCheck 執行結束");
    // 確保 Langfuse 正確關閉，避免資源洩漏
    logger.info("🔒 正在關閉 Langfuse...");
    try {
      await shutdownLangfuse();
      logger.info("✅ Langfuse 已關閉");
    } catch (e) {
      logger.warn(e, "⚠️ Langfuse 關閉失敗");
    }
  }

  // 給 logger 一點時間 flush（pino async transport 需要）
  await new Promise((resolve) => setTimeout(resolve, 200));

  // 強制退出，避免 HTTP keep-alive / Telegram polling / 其他套件殘留 handle
  process.exit(exitCode);
}

main();
