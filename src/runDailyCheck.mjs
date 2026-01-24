import { dailyCheck } from "./dailyCheck.mjs";

dailyCheck(true).then((result) => {
  console.log("\n=== 每日投資自檢訊息（本機測試） ===\n");
  console.log("=== 標題 ===\n");
  console.log(result.header);
  console.log("=== 簡訊版 ===\n");
  console.log(result.msg);
  console.log("\n=== 詳細數據（本機測試） ===\n");
  console.log(result.detailMsg);
  console.log("\n=== LINE 訊息結構（本機測試） ===\n");
  console.log(JSON.stringify(result.messages, null, 2));
});