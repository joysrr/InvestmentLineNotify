import { dailyCheck } from "./dailyCheck.mjs";

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

dailyCheck({
  isTelegramEnabled: isTelegramEnabled,
  isAIAdvisor: isAIAdvisor,
});
