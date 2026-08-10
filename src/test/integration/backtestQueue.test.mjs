/**
 * backtestQueue.test.mjs
 * 回測 Queue 整合測試
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  submitBacktestJob,
  getJobStatus,
  cancelJob,
  getQueueStats,
  subscribeProgress,
  shutdownQueue,
  JOB_STATUS,
} from "../../modules/backtest/backtestQueue.mjs";
import { archiveManager } from "../../modules/data/archiveManager.mjs";

// 設定開發環境變數以繞過 initDataGuard (若 queue 內部有用到)
process.env.NODE_ENV = "development";
process.env.BYPASS_INIT_DATA = "true";

describe("Backtest Queue", () => {
  let testJobIds = [];

  beforeAll(async () => {
    // 確保有測試資料
    const reports = await archiveManager.getArchiveRecords({
      start: "2026-08-01",
      end: "2026-08-09",
    });
    if (reports.length === 0) {
      console.warn("⚠️ 無測試資料，部分測試可能跳過");
    }
  });

  afterAll(async () => {
    // 清理測試建立的任務
    for (const jobId of testJobIds) {
      try {
        await cancelJob(jobId);
      } catch {
        // ignore cleanup errors
      }
    }
    await shutdownQueue();
  });

  it("應能提交回測任務並回傳 jobId", async () => {
    const config = {
      start: "2026-08-01",
      end: "2026-08-09",
      name: "test-queue-submit",
      quiet: true,
      disableGuards: true,
    };

    const { jobId, status } = await submitBacktestJob(config);

    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe("string");
    expect(jobId.length).toBeGreaterThan(0);
    expect(status).toBe(JOB_STATUS.WAITING);

    testJobIds.push(jobId);
  });

  it("應能查詢任務狀態", async () => {
    const config = {
      start: "2026-08-01",
      end: "2026-08-09",
      name: "test-queue-status",
      quiet: true,
      disableGuards: true,
    };

    const { jobId } = await submitBacktestJob(config);
    testJobIds.push(jobId);

    // 等待任務開始處理
    await new Promise((r) => setTimeout(r, 500));

    const status = await getJobStatus(jobId);

    expect(status).toBeDefined();
    expect(status.jobId).toBe(jobId);
    expect(["waiting", "active", "completed", "failed"]).toContain(
      status.status,
    );
    expect(status.progress).toBeDefined();
    expect(status.createdAt).toBeDefined();
  });

  it("應能取得佇列統計", async () => {
    const stats = await getQueueStats();

    expect(stats).toBeDefined();
    expect(typeof stats.waiting).toBe("number");
    expect(typeof stats.active).toBe("number");
    expect(typeof stats.completed).toBe("number");
    expect(typeof stats.failed).toBe("number");
    expect(typeof stats.delayed).toBe("number");
    expect(
      stats.waiting +
        stats.active +
        stats.completed +
        stats.failed +
        stats.delayed,
    ).toBeGreaterThanOrEqual(0);
  });

  it("應能取消等待中的任務", async () => {
    const config = {
      start: "2026-08-01",
      end: "2026-08-09",
      name: "test-queue-cancel",
      quiet: true,
      disableGuards: true,
    };

    const { jobId } = await submitBacktestJob(config);
    testJobIds.push(jobId);

    // 立即取消 (還在 waiting 狀態)
    const cancelled = await cancelJob(jobId);

    expect(cancelled).toBe(true);

    // 驗證狀態已變更
    const status = await getJobStatus(jobId);
    expect(status.status).toBe(JOB_STATUS.FAILED);
    expect(status.result?.error).toBe("任務已取消");
  });

  it("進度訂閱應能收到更新", async () => {
    const config = {
      start: "2026-08-01",
      end: "2026-08-09",
      name: "test-queue-progress",
      quiet: true,
      disableGuards: true,
    };

    const { jobId } = await submitBacktestJob(config);
    testJobIds.push(jobId);

    const progressUpdates = [];
    const unsubscribe = subscribeProgress(jobId, (progress) => {
      progressUpdates.push(progress);
    });

    // 等待一段時間讓任務處理並發送進度
    await new Promise((r) => setTimeout(r, 2000));

    unsubscribe();

    // 至少應收到一個進度更新
    expect(progressUpdates.length).toBeGreaterThan(0);

    // 驗證進度格式
    const lastProgress = progressUpdates[progressUpdates.length - 1];
    expect(lastProgress).toHaveProperty("stage");
    expect(lastProgress).toHaveProperty("percent");
    expect(lastProgress).toHaveProperty("message");
  });

  it("不存在的任務查詢應回傳 null", async () => {
    const status = await getJobStatus("non-existent-job-id-12345");
    expect(status).toBeNull();
  });

  it("取消不存在的任務應回傳 false", async () => {
    const cancelled = await cancelJob("non-existent-job-id-12345");
    expect(cancelled).toBe(false);
  });
});
