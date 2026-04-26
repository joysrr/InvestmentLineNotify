/**
 * runnerLock.mjs — 防止 Bot 與 GitHub Actions 重複觸發的 lock 機制
 *
 * 設計原則：
 * - 使用 `data/.bot_lock` flag 檔作為简易 mutex。
 * - Lock 檔內儲存 { runner, startedAt, pid }。
 * - Bot 指令觸發前檢查 lock，存在則拒絕並回覆提示。
 * - Runner 完成後（成功或失敗）必須呼叫 releaseLock() 清除 flag。
 * - 超過 30 分鐘的舊 lock 自動視為夹死並強制釋放。
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  openSync,
  closeSync,
} from "fs";
import { join } from "path";

const LOCK_PATH = join(process.cwd(), "data", ".bot_lock");
const LOCK_TIMEOUT_MS = 30 * 60 * 1000; // 30 分鐘超時強制釋放

if (process.env.GITHUB_ACTIONS === "true") {
  console.warn(
    "⚠️ [Lock] 偵測到 GitHub Actions 環境。請注意 .bot_lock 是基於本機檔案系統，跨機器時 lock 將會失效！請確保排程與 Bot 運行在同一台 VM。",
  );
}

/**
 * 嘗試取得 lock。
 * @param {string} runnerName - runner 名稱，供記錄用。
 * @returns {{ acquired: boolean, message?: string }}
 */
export function acquireLock(runnerName) {
  if (existsSync(LOCK_PATH)) {
    try {
      const lock = JSON.parse(readFileSync(LOCK_PATH, "utf-8"));
      const age = Date.now() - new Date(lock.startedAt).getTime();

      if (age < LOCK_TIMEOUT_MS) {
        return {
          acquired: false,
          message: `⏳ <b>${lock.runner}</b> 正在執行中（已過 ${Math.round(age / 1000)} 秒），請稍後再試。`,
        };
      }

      // 舊 lock 超過超時，強制釋放
      console.warn(
        `[Lock] ⚠️  舊 lock (${lock.runner}) 超過 ${LOCK_TIMEOUT_MS / 60000} 分鐘，強制釋放。`,
      );
      unlinkSync(LOCK_PATH);
    } catch {
      // lock 檔損壞，強制釋放
      unlinkSync(LOCK_PATH);
    }
  }

  try {
    const fd = openSync(LOCK_PATH, "wx");
    writeFileSync(
      fd,
      JSON.stringify({
        runner: runnerName,
        startedAt: new Date().toISOString(),
        pid: process.pid,
      }),
      "utf-8",
    );
    closeSync(fd);
    return { acquired: true };
  } catch (err) {
    if (err.code === "EEXIST") {
      return {
        acquired: false,
        message: `⏳ <b>未知</b> 正在執行中（併發鎖），請稍後再試。`,
      };
    }
    throw err;
  }
}

/**
 * 釋放 lock。必須在 runner finally 區塊呼叫。
 */
export function releaseLock() {
  try {
    if (existsSync(LOCK_PATH)) unlinkSync(LOCK_PATH);
  } catch (err) {
    console.warn("[Lock] ⚠️  釋放 lock 失敗：", err.message);
  }
}
