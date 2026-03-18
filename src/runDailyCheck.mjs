import { dailyCheck } from "./dailyCheck.mjs";
import fs from "fs";
import path from "path";
import { SaveTmpFile } from "./utils/debugUtils.mjs";

// 解析命令列參數
const args = process.argv.slice(2);

// 預設行為 (手動執行時的預設值)
let isLineEnabled = true; // 預設發 LINE
let isTelegramEnabled = true; // 預設發 Telegram
let isAIAdvisor = true; // 預設產出AI建議
let isTranslate = false; // 預設不翻譯名言

// 根據傳入的參數覆寫設定
if (args.includes("--line=false")) isLineEnabled = false;
if (args.includes("--line=true")) isLineEnabled = true;

if (args.includes("--telegram=false")) isTelegramEnabled = false;
if (args.includes("--telegram=true")) isTelegramEnabled = true;

if (args.includes("--aiAdvisor=false")) isAIAdvisor = false;
if (args.includes("--aiAdvisor=true")) isAIAdvisor = true;

if (args.includes("--translate=false")) isTranslate = false;
if (args.includes("--translate=true")) isTranslate = true;

console.log(
  `執行參數: LINE=${isLineEnabled}, Telegram=${isTelegramEnabled}, AIAdvisor=${isAIAdvisor}, Translate=${isTranslate}`,
);

dailyCheck({
  isLineEnabled: isLineEnabled,
  isTelegramEnabled: isTelegramEnabled,
  isTranslate: isTranslate,
  isAIAdvisor: isAIAdvisor,
}).then((result) => {
  console.log("\n=== 每日投資自檢訊息（本機測試） ===\n");
  console.log("=== 標題 ===\n");
  console.log(result.header);
  console.log("=== 簡訊版 ===\n");
  console.log(result.msg);
  console.log("\n=== 詳細數據（本機測試） ===\n");
  console.log(result.detailMsg);
  SaveTmpFile(result.lineMessages, "Line Messages", "line_message");
  SaveTmpFile(result.telegramMessages, "Telegram Messages", "telegram_message");
});
