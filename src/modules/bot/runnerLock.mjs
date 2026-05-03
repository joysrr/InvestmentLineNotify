/**
 * runnerLock.mjs — 防止 Bot 與 GitHub Actions 重複觸發的 lock 機制
 *
 * 設計原則：
 * - 使用 `proper-lockfile` 實現真正的原子鎖操作
 * - Lock 檔內儲存 { runner, startedAt, pid }。
 * - Bot 指令觸發前檢查 lock，存在則拒絕並回覆提示。
 * - Runner 完成後（成功或失敗）必須呼叫 releaseLock() 清除 flag。
 * - 超過 30 分鐘的舊 lock 自動視為卡死並強制釋放。
 * - 支援信號量機制（Semaphore）控制最大並發數。
 * - 註冊進程終止處理器（SIGINT/SIGTERM）確保優雅釋放 lock。
 */

import lockfile from "proper-lockfile";
import { existsSync, readFileSync, mkdirSync } from "fs";
import { join } from "path";
import logger from "../../utils/logger.mjs";

const LOCK_PATH = join(process.cwd(), "data", ".bot_lock");
const LOCK_DIR = join(process.cwd(), "data");
const LOCK_TIMEOUT_MS = 30 * 60 * 1000; // 30 分鐘超時強制釋放
const DEFAULT_MAX_CONCURRENT = 2; // 預設最大並發數

// 確保 data 目錄存在
if (!existsSync(LOCK_DIR)) {
  mkdirSync(LOCK_DIR, { recursive: true });
}

if (process.env.GITHUB_ACTIONS === "true") {
  logger.warn(
    "⚠️ [Lock] 偵測到 GitHub Actions 環境。請注意 lock 是基於本機檔案系統，跨機器時 lock 將會失效！請確保排程與 Bot 運行在同一台 VM。",
  );
}

// 全域狀態追蹤
const activeLocks = new Map(); // runnerName → { pid, startedAt, release }
let isShuttingDown = false;

/**
 * 嘗試取得 lock。
 * @param {string} runnerName - runner 名稱，供記錄用。
 * @param {Object} options - 選項。
 * @param {number} options.maxConcurrent - 最大並發數，預設 2。
 * @param {number} options.timeout - 等待 lock 超時時間 (ms)，預設 0 (不等待)。
 * @returns {Promise<{ acquired: boolean, message?: string }>}
 */
export async function acquireLock(runnerName, options = {}) {
  const { maxConcurrent = DEFAULT_MAX_CONCURRENT } = options;

  if (isShuttingDown) {
    return {
      acquired: false,
      message: "🛑 系統正在關閉中，拒絕新請求。",
    };
  }

  // 檢查當前並發數
  const currentActiveCount = activeLocks.size;
  if (currentActiveCount >= maxConcurrent) {
    return {
      acquired: false,
      message: `🚫 達到最大並發數限制 (${maxConcurrent})，目前有 ${currentActiveCount} 個任務正在執行，請稍後再試。`,
    };
  }

  // 檢查現有 lock 是否超時
  if (existsSync(LOCK_PATH)) {
    try {
      const lock = JSON.parse(readFileSync(LOCK_PATH, "utf-8"));
      const age = Date.now() - new Date(lock.startedAt).getTime();

      if (age >= LOCK_TIMEOUT_MS) {
        logger.warn(
          `[Lock] ⚠️ 舊 lock (${lock.runner}) 超過 ${LOCK_TIMEOUT_MS / 60000} 分鐘，強制釋放。`,
        );
        try {
          await lockfile.unlock(LOCK_PATH);
        } catch (err) {
          logger.warn(`[Lock] ⚠️ 強制釋放 lock 失敗：${err.message}`);
        }
      }
    } catch (err) {
      logger.warn(`[Lock] ⚠️ Lock 檔損壞，嘗試清理：${err.message}`);
      try {
        await lockfile.unlock(LOCK_PATH);
      } catch {
        // ignore unlock error during cleanup
      }
    }
  }

  const lockData = {
    runner: runnerName,
    startedAt: new Date().toISOString(),
    pid: process.pid,
  };

  try {
    // 寫入 lock 資料到檔案
    const { writeFileSync } = await import("fs");
    writeFileSync(LOCK_PATH, JSON.stringify(lockData, null, 2), "utf-8");

    // 使用 proper-lockfile 取得原子鎖
    const release = await lockfile.lock(LOCK_PATH, {
      stale: LOCK_TIMEOUT_MS,
      update: LOCK_TIMEOUT_MS / 2, // 每 15 分鐘更新一次鎖
      retries: {
        retries: 50, // 最大重試 50 次（約 5 秒）
        minTimeout: 100,
        maxTimeout: 200,
        randomize: true,
      },
    });

    // 註冊全域追蹤
    activeLocks.set(runnerName, {
      pid: process.pid,
      startedAt: lockData.startedAt,
      release,
    });

    logger.info(`[Lock] ✅ ${runnerName} 已取得 lock (PID: ${process.pid})`);
    return { acquired: true };
  } catch (err) {
    if (err.code === "ELOCKED" || err.message.includes("is locked")) {
      // 檢查是否為同一 runner 的重複請求
      if (existsSync(LOCK_PATH)) {
        try {
          const lock = JSON.parse(readFileSync(LOCK_PATH, "utf-8"));
          if (lock.runner === runnerName) {
            return {
              acquired: false,
              message: `⏳ <b>${runnerName}</b> 已經在執行中，請勿重複觸發。`,
            };
          }
          const age = Date.now() - new Date(lock.startedAt).getTime();
          return {
            acquired: false,
            message: `⏳ <b>${lock.runner}</b> 正在執行中（已過 ${Math.round(age / 1000)} 秒），請稍後再試。`,
          };
        } catch {
          // ignore parse error, fallback to default message
        }
      }
      return {
        acquired: false,
        message: `⏳ 任務正在執行中，請稍後再試。`,
      };
    }

    logger.error(`[Lock] ❌ 取得 lock 失敗：`, err);
    throw err;
  }
}

/**
 * 釋放 lock。必須在 runner finally 區塊呼叫。
 * @param {string} runnerName - 可選，runner 名稱，用於驗證。
 */
export async function releaseLock(runnerName) {
  try {
    const lockInfo = activeLocks.get(runnerName);

    if (lockInfo && typeof lockInfo.release === "function") {
      try {
        await lockInfo.release();
        logger.info(`[Lock] ✅ ${runnerName} 已釋放 lock`);
      } catch (err) {
        if (!err.message.includes("Not locked")) {
          logger.warn(`[Lock] ⚠️ 釋放 lock 失敗：${err.message}`);
        }
      }
    } else if (existsSync(LOCK_PATH)) {
      // 如果沒有 release 函數，嘗試直接刪除檔案
      try {
        await lockfile.unlock(LOCK_PATH);
        logger.info(`[Lock] ✅ ${runnerName} 已釋放 lock (force unlock)`);
      } catch (err) {
        if (!err.message.includes("Not locked")) {
          logger.warn(`[Lock] ⚠️ 強制釋放 lock 失敗：${err.message}`);
        }
      }
    }

    // 清除全域追蹤
    activeLocks.delete(runnerName);
  } catch (err) {
    logger.warn(`[Lock] ⚠️ 釋放 lock 失敗：${err.message}`);
  }
}

/**
 * 獲取當前 lock 狀態資訊。
 * @returns {{ hasLock: boolean, lockInfo?: Object, activeCount: number }}
 */
export function getLockStatus() {
  if (!existsSync(LOCK_PATH)) {
    return { hasLock: false, activeCount: activeLocks.size };
  }

  try {
    const lock = JSON.parse(readFileSync(LOCK_PATH, "utf-8"));
    const age = Date.now() - new Date(lock.startedAt).getTime();

    return {
      hasLock: true,
      lockInfo: {
        runner: lock.runner,
        pid: lock.pid,
        startedAt: lock.startedAt,
        ageSeconds: Math.round(age / 1000),
      },
      activeCount: activeLocks.size,
    };
  } catch {
    return { hasLock: false, activeCount: activeLocks.size };
  }
}

/**
 * 註冊進程終止處理器，確保優雅釋放 lock。
 * 應在應用程式啟動時呼叫一次。
 */
export function registerShutdownHandlers() {
  const gracefulShutdown = async (signal) => {
    if (isShuttingDown) return;

    isShuttingDown = true;
    logger.info(`[Lock] 🛑 收到 ${signal}，正在準備關閉...`);

    // 釋放所有 lock
    for (const [runnerName, lockInfo] of activeLocks.entries()) {
      try {
        if (typeof lockInfo.release === "function") {
          await lockInfo.release();
        } else if (existsSync(LOCK_PATH)) {
          await lockfile.unlock(LOCK_PATH);
        }
        logger.info(`[Lock] 📝 釋放 lock：${runnerName}`);
      } catch (err) {
        logger.warn(
          `[Lock] ⚠️ 關閉時釋放 lock 失敗 (${runnerName}): ${err.message}`,
        );
      }
    }

    activeLocks.clear();
    logger.info(`[Lock] ✅ 所有 lock 已釋放，準備退出`);
    process.exit(0);
  };

  process.once("SIGINT", () => gracefulShutdown("SIGINT"));
  process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));

  // 處理未處理的異常
  process.on("uncaughtException", (err) => {
    logger.error(`[Lock] ❌ Uncaught Exception:`, err);
    gracefulShutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.error(
      `[Lock] ❌ Unhandled Rejection at:`,
      promise,
      "reason:",
      reason,
    );
  });
}
