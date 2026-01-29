import { dailyCheck } from "./dailyCheck.mjs";
import fs from "fs";
import path from "path";

dailyCheck(true).then((result) => {
  console.log("\n=== 每日投資自檢訊息（本機測試） ===\n");
  console.log("=== 標題 ===\n");
  console.log(result.header);
  console.log("=== 簡訊版 ===\n");
  console.log(result.msg);
  console.log("\n=== 詳細數據（本機測試） ===\n");
  console.log(result.detailMsg);
  // ⚡️ 新增：將 Prompt 與數據輸出成暫存 JSON
  try {
    const tempFilePath = path.join(process.cwd(), "tmp_messages.json");
    fs.writeFileSync(
      tempFilePath,
      JSON.stringify(result.messages, null, 2),
      "utf8",
    );
    console.log(`\n📝 [Debug] Flex Messages 已導出至: ${tempFilePath}`);
  } catch (err) {
    console.warn("⚠️ 無法寫入暫存 Flex Messages 檔案:", err.message);
  }
});
