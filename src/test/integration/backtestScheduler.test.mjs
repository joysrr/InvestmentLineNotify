/**
 * backtestScheduler.test.mjs
 * 回測排程器整合測試
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";

// Mock submitBacktestJob at TOP LEVEL to control backtest execution (DEC-28/35)
// 直接 Mock 佇列層，避免 backtestQueue 內部實例化 BacktestRunner
vi.mock("../../modules/backtest/backtestQueue.mjs", () => {
  const mockSubmitBacktestJob = vi.fn().mockImplementation((config) => {
    // 根據配置決定成功或失敗
    const isRetryTest = config.name === "test-retry-fail";
    const isInvalidDate = config.start === "2020-01-01";

    if (isRetryTest || isInvalidDate) {
      // 返回會失敗的 job
      return Promise.resolve({
        jobId: `mock-fail-${Date.now()}-${Math.random()}`,
        status: "waiting",
      });
    }

    // 正常成功
    return Promise.resolve({
      jobId: `mock-success-${Date.now()}-${Math.random()}`,
      status: "waiting",
    });
  });

  const mockGetJobStatus = vi.fn().mockImplementation((jobId) => {
    if (jobId.includes("mock-fail")) {
      return Promise.resolve({
        jobId,
        status: "failed",
        result: { error: "找不到指定日期範圍內的報告" },
      });
    }
    return Promise.resolve({
      jobId,
      status: "completed",
      result: {
        summary: {
          name: "mock-backtest",
          returnPct: 15.5,
          winRate: 62.3,
          maxDrawdown: 8.2,
          finalNetAsset: 115500,
          qty0050: 1000,
          qtyZ2: 500,
          totalLoan: 30000,
          finalLeverage: 1.2,
          minMm: 0.15,
          signalCategoryStats: {
            categories: {},
            monthlyData: {},
            summary: {
              totalDays: 65,
              totalCategories: 1,
              startDate: "2026-08-01",
              endDate: "2026-10-05",
            },
          },
        },
      },
    });
  });

  return {
    submitBacktestJob: mockSubmitBacktestJob,
    getJobStatus: mockGetJobStatus,
    getQueueStats: vi.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    }),
    shutdownQueue: vi.fn().mockResolvedValue(undefined),
    JOB_STATUS: {
      WAITING: "waiting",
      ACTIVE: "active",
      COMPLETED: "completed",
      FAILED: "failed",
      DELAYED: "delayed",
    },
  };
});

import backtestScheduler from "../../modules/backtest/backtestScheduler.ts";
import {
  submitBacktestJob,
  getQueueStats,
  shutdownQueue,
} from "../../modules/backtest/backtestQueue.mjs";
import { archiveManager } from "../../modules/data/archiveManager.mjs";

// 設定開發環境變數
process.env.NODE_ENV = "development";
process.env.BYPASS_INIT_DATA = "true";
process.env.USE_REDIS = "false";

describe("Backtest Scheduler", () => {
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
    // 清理測試建立的排程
    for (const jobId of testJobIds) {
      try {
        await backtestScheduler.cancelScheduledJob(jobId);
      } catch {
        // ignore cleanup errors
      }
    }
    await shutdownQueue();
    backtestScheduler.stop();
  });

  beforeEach(() => {
    testJobIds = [];
  });

  describe("排程管理", () => {
    it("應能建立排程並返回 jobId", async () => {
      const configs = [
        {
          start: "2026-08-01",
          end: "2026-08-09",
          name: "test-schedule-1",
          quiet: true,
          disableGuards: true,
        },
      ];

      const result = await backtestScheduler.createSchedule({
        configs,
        cron: "0 2 * * *", // 每天凌晨 2 點
      });

      expect(result).toBeDefined();
      expect(result.jobId).toBeDefined();
      expect(typeof result.jobId).toBe("string");
      expect(result.status).toBe("scheduled");

      testJobIds.push(result.jobId);
    });

    it("應能建立無 cron 的一次性排程", async () => {
      const configs = [
        {
          start: "2026-08-01",
          end: "2026-08-09",
          name: "test-once",
          quiet: true,
          disableGuards: true,
        },
      ];

      const result = await backtestScheduler.createSchedule({
        configs,
        // 不提供 cron，應為一次性執行
      });

      expect(result).toBeDefined();
      expect(result.jobId).toBeDefined();
      expect(result.status).toBe("scheduled");

      testJobIds.push(result.jobId);
    });

    it("應能查詢排程狀態", async () => {
      const configs = [
        {
          start: "2026-08-01",
          end: "2026-08-09",
          name: "test-status",
          quiet: true,
          disableGuards: true,
        },
      ];

      const { jobId } = await backtestScheduler.createSchedule({
        configs,
        cron: "0 2 * * *",
      });
      testJobIds.push(jobId);

      // 等待一下
      await new Promise((r) => setTimeout(r, 100));

      const status = await backtestScheduler.getScheduleStatus(jobId);

      expect(status).toBeDefined();
      expect(status.jobId).toBe(jobId);
      expect(["scheduled", "running", "completed", "failed"]).toContain(
        status.status,
      );
      expect(status.nextRun).toBeDefined();
      expect(status.configs).toBeDefined();
      expect(Array.isArray(status.configs)).toBe(true);
    });

    it("應能取消排程任務", async () => {
      const configs = [
        {
          start: "2026-08-01",
          end: "2026-08-09",
          name: "test-cancel",
          quiet: true,
          disableGuards: true,
        },
      ];

      const { jobId } = await backtestScheduler.createSchedule({
        configs,
        cron: "0 2 * * *",
      });

      const cancelled = await backtestScheduler.cancelScheduledJob(jobId);

      expect(cancelled).toBe(true);

      // 驗證狀態已變更
      const status = await backtestScheduler.getScheduleStatus(jobId);
      expect(status.status).toBe("cancelled");
    });

    it("取消不存在的排程應回傳 false", async () => {
      const cancelled = await backtestScheduler.cancelScheduledJob(
        "non-existent-job-id",
      );
      expect(cancelled).toBe(false);
    });
  });

  describe("排程執行", () => {
    it("手動觸發排程應立即執行", async () => {
      const configs = [
        {
          start: "2026-08-01",
          end: "2026-08-09", // 使用較長期限確保有資料
          name: "test-manual-trigger",
          quiet: true,
          disableGuards: true,
        },
      ];

      const { jobId } = await backtestScheduler.createSchedule({
        configs,
        // 無 cron，一次性
      });
      testJobIds.push(jobId);

      // 手動觸發
      const triggered = await backtestScheduler.triggerSchedule(jobId);
      expect(triggered).toBe(true);

      // 等待任務完成
      await new Promise((r) => setTimeout(r, 10000));

      const status = await backtestScheduler.getScheduleStatus(jobId);
      expect(["completed", "running", "failed"]).toContain(status.status);
    }, 20000);

    it("多組參數併行執行", async () => {
      const configs = [
        {
          start: "2026-08-01",
          end: "2026-08-09",
          name: "test-concurrent-1",
          quiet: true,
          disableGuards: true,
        },
        {
          start: "2026-08-01",
          end: "2026-08-09",
          name: "test-concurrent-2",
          quiet: true,
          disableGuards: true,
          monthlyDca: 50000,
        },
        {
          start: "2026-08-01",
          end: "2026-08-09",
          name: "test-concurrent-3",
          quiet: true,
          disableGuards: true,
          pledgeRatio: 0.5,
        },
      ];

      const { jobId } = await backtestScheduler.createSchedule({
        configs,
        concurrency: 2,
      });
      testJobIds.push(jobId);

      const triggered = await backtestScheduler.triggerSchedule(jobId);
      expect(triggered).toBe(true);

      // 等待完成
      await new Promise((r) => setTimeout(r, 25000));

      const status = await backtestScheduler.getScheduleStatus(jobId);
      expect(["completed", "running", "failed"]).toContain(status.status);
      expect(status.results).toBeDefined();
      expect(status.results.length).toBe(3);
    }, 30000);
  });

  describe("失敗重試", () => {
    it("失敗任務應自動重試 (最多 3 次)", async () => {
      // 使用無效日期範圍導致失敗
      const configs = [
        {
          start: "2020-01-01", // 很早的日期，資料庫可能沒有
          end: "2020-01-02",
          name: "test-retry-fail",
          quiet: true,
          disableGuards: true,
        },
      ];

      const { jobId } = await backtestScheduler.createSchedule({
        configs,
        retry: {
          maxAttempts: 3,
          backoffMs: 100, // 縮短回退時間加快測試
        },
      });
      testJobIds.push(jobId);

      const triggered = await backtestScheduler.triggerSchedule(jobId);
      expect(triggered).toBe(true);

      // 等待重試完成 - 增加等待時間以確保所有重試完成
      await new Promise((r) => setTimeout(r, 8000));

      const status = await backtestScheduler.getScheduleStatus(jobId);
      expect(status.status).toBe("failed");
      // 檢查總嘗試次數 >= 3 (初始 + 3次重試)
      expect(status.attempts).toBeGreaterThanOrEqual(3);
    }, 15000);
  });

  describe("結果持久化", () => {
    it("完成的排程應自動存檔結果", async () => {
      const configs = [
        {
          start: "2026-08-01",
          end: "2026-08-09",
          name: "test-persist",
          quiet: true,
          disableGuards: true,
        },
      ];

      const { jobId } = await backtestScheduler.createSchedule({ configs });
      testJobIds.push(jobId);

      await backtestScheduler.triggerSchedule(jobId);

      // 等待完成 - 增加超時
      await new Promise((r) => setTimeout(r, 10000));

      const status = await backtestScheduler.getScheduleStatus(jobId);
      expect(["completed", "failed"]).toContain(status.status);
      // 檢查結果檔案是否存在 - 使用與 scheduler 相同的路徑解析
      const fs = await import("fs/promises");
      const path = await import("path");
      const { fileURLToPath } = await import("url");
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const PROJECT_ROOT = path.resolve(__dirname, "../../../..");
      const resultDir = path.resolve(PROJECT_ROOT, "data/backtest/scheduled");

      console.log("Looking for result files in:", resultDir);
      const files = await fs.readdir(resultDir);
      console.log("Files found:", files);
      const resultFiles = files.filter(
        (f) => f.includes(jobId) || f.includes("test-persist"),
      );

      expect(resultFiles.length).toBeGreaterThan(0);

      // 驗證檔案格式
      for (const file of resultFiles) {
        const content = await fs.readFile(
          path.resolve(resultDir, file),
          "utf-8",
        );
        const data = JSON.parse(content);
        expect(data).toHaveProperty("jobId");
        // The persisted file has results array with summary inside
        expect(data).toHaveProperty("results");
        expect(data.results.length).toBeGreaterThan(0);
        expect(data.results[0]).toHaveProperty("summary");
        expect(data).toHaveProperty("completedAt");
      }
    }, 15000);
  });

  describe("API 端點整合", () => {
    // 這部分在 backtestRoutes.test.mjs 中測試
    it("應能透過佇列統計查看排程任務", async () => {
      const stats = await getQueueStats();
      expect(stats).toBeDefined();
      expect(typeof stats.waiting).toBe("number");
      expect(typeof stats.active).toBe("number");
    });
  });
});
