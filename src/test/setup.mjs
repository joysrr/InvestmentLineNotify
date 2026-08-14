import { afterAll } from "vitest";

// 全域 Teardown: 確保測試結束時清除殘留的非同步操作
afterAll(async () => {
  // 1. 強制清除 Pino Logger 寫入流
  try {
    const loggerModule = await import("./src/utils/logger.mjs");
    if (loggerModule && loggerModule.default && loggerModule.default.flush) {
      loggerModule.default.flush();
    }
  } catch (e) {
    // 忽略找不到模組的錯誤
  }

  // 2. 斷開可能開啟的 SQLite 連線
  try {
    const dbModule = await import("./src/utils/dbClient.mjs");
    if (dbModule && dbModule.db) {
      dbModule.db.close();
    }
  } catch (e) {
    // 忽略找不到模組的錯誤
  }
});
