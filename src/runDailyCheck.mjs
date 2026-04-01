import { dailyCheck } from "./dailyCheck.mjs";
import { langfuse } from "./modules/ai/aiClient.mjs";

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

  console.log(
    `執行參數: Telegram=${isTelegramEnabled}, AIAdvisor=${isAIAdvisor}`,
  );

  try {
    dailyCheck({
      isTelegramEnabled: isTelegramEnabled,
      isAIAdvisor: isAIAdvisor,
    });
  } catch (err) {
    console.error("❌ 系統發生嚴重錯誤:", err);
    process.exit(1);
  } finally {
    console.log("🚀 dailyCheck 執行結束");
    // 確保 Langfuse 正確關閉，避免資源洩漏
    console.log("🔒 正在關閉 Langfuse...");
    langfuse.shutdownAsync().catch((e) => {
      console.warn("⚠️ Langfuse 關閉失敗:", e.message);
    });
    console.log("✅ Langfuse 已關閉");
  }
}

main();