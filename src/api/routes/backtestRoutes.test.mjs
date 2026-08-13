// src/api/routes/backtestRoutes.test.mjs
// TDD: Backtest Routes 測試

import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";

// Mock 依賴
vi.mock("../../modules/backtest/backtestQueue.mjs", () => ({
  submitBacktestJob: vi.fn(),
  getJobStatus: vi.fn(),
  cancelJob: vi.fn(),
  getQueueStats: vi.fn(),
}));

vi.mock("../../modules/backtest/backtestScheduler.ts", () => ({
  createSchedule: vi.fn(),
  getScheduleStatus: vi.fn(),
  cancelScheduledJob: vi.fn(),
  triggerSchedule: vi.fn(),
  getAllSchedules: vi.fn(),
  getSchedulerStats: vi.fn(),
}));

import backtestRoutes from "./backtestRoutes.mjs";
import {
  submitBacktestJob,
  getJobStatus,
  cancelJob,
  getQueueStats,
} from "../../modules/backtest/backtestQueue.mjs";
import {
  createSchedule,
  getScheduleStatus,
  cancelScheduledJob,
  triggerSchedule,
  getAllSchedules,
  getSchedulerStats,
} from "../../modules/backtest/backtestScheduler.ts";

describe("backtestRoutes - 回測 API 路由", () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    app = Fastify({ logger: false });
    await app.register(backtestRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /backtest/run - 提交回測任務", () => {
    it("有效配置回傳 202 和 jobId", async () => {
      submitBacktestJob.mockResolvedValue({
        jobId: "test-job-123",
        status: "queued",
      });

      const response = await app.inject({
        method: "POST",
        url: "/backtest/run",
        payload: {
          start: "2024-01-01",
          end: "2024-12-31",
        },
      });

      expect(response.statusCode).toBe(202);
      const body = JSON.parse(response.payload);
      expect(body.jobId).toBe("test-job-123");
      expect(body.status).toBe("queued");
      expect(body.message).toContain("佇列");
    });

    it("開始日期晚於結束日期回傳 400", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/backtest/run",
        payload: {
          start: "2024-12-31",
          end: "2024-01-01",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("開始日期不能晚於結束日期");
    });

    it("日期格式錯誤回傳 400", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/backtest/run",
        payload: {
          start: "2024/01/01",
          end: "2024-12-31",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      // Fastify schema validation 回傳標準錯誤訊息
      expect(body.error).toBeDefined();
    });

    it("submitBacktestJob 異常回傳 500", async () => {
      submitBacktestJob.mockRejectedValue(new Error("Queue full"));

      const response = await app.inject({
        method: "POST",
        url: "/backtest/run",
        payload: {
          start: "2024-01-01",
          end: "2024-12-31",
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("提交回測任務失敗");
    });

    it("可選參數正確傳遞", async () => {
      submitBacktestJob.mockResolvedValue({
        jobId: "test-job-123",
        status: "queued",
      });

      await app.inject({
        method: "POST",
        url: "/backtest/run",
        payload: {
          start: "2024-01-01",
          end: "2024-12-31",
          name: "My Backtest",
          quiet: true,
          disableGuards: true,
          buyTactical: 5,
          initialCash: 1000000,
        },
      });

      expect(submitBacktestJob).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "My Backtest",
          quiet: true,
          disableGuards: true,
          buyTactical: 5,
          initialCash: 1000000,
        }),
      );
    });
  });

  describe("GET /backtest/:jobId - 查詢任務狀態", () => {
    it("找到任務回傳狀態", async () => {
      getJobStatus.mockResolvedValue({
        jobId: "test-job-123",
        status: "completed",
        progress: { current: 100, total: 100 },
        result: { totalReturn: 0.15 },
        createdAt: Date.now(),
        processedAt: Date.now(),
        finishedAt: Date.now(),
      });

      const response = await app.inject({
        method: "GET",
        url: "/backtest/test-job-123",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.jobId).toBe("test-job-123");
      expect(body.status).toBe("completed");
    });

    it("找不到任務回傳 404", async () => {
      getJobStatus.mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/backtest/non-existent",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("找不到指定的任務");
    });
  });

  describe("GET /backtest/queue/stats - 佇列統計", () => {
    it("回傳佇列統計", async () => {
      getQueueStats.mockResolvedValue({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
      });

      const response = await app.inject({
        method: "GET",
        url: "/backtest/queue/stats",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.waiting).toBe(5);
      expect(body.active).toBe(2);
      expect(body.completed).toBe(100);
    });
  });

  describe("DELETE /backtest/:jobId - 取消任務", () => {
    it("成功取消回傳 200", async () => {
      cancelJob.mockResolvedValue(true);

      const response = await app.inject({
        method: "DELETE",
        url: "/backtest/test-job-123",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.cancelled).toBe(true);
      expect(body.message).toBe("任務已取消");
    });

    it("無法取消回傳 404", async () => {
      cancelJob.mockResolvedValue(false);

      const response = await app.inject({
        method: "DELETE",
        url: "/backtest/test-job-123",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error).toContain("無法取消");
    });
  });

  describe("排程管理 API", () => {
    describe("POST /backtest/schedule - 建立排程", () => {
      it("有效排程回傳 202", async () => {
        createSchedule.mockResolvedValue({
          jobId: "schedule-123",
          status: "scheduled",
          nextRun: "2024-01-01T00:00:00.000Z",
        });

        const response = await app.inject({
          method: "POST",
          url: "/backtest/schedule",
          payload: {
            configs: [{ start: "2024-01-01", end: "2024-12-31" }],
            cron: "0 0 * * *",
            concurrency: 2,
          },
        });

        expect(response.statusCode).toBe(202);
        const body = JSON.parse(response.payload);
        expect(body.jobId).toBe("schedule-123");
        expect(body.message).toContain("排程已建立");
      });

      it("缺少 configs 回傳 400 (Fastify schema 驗證)", async () => {
        const response = await app.inject({
          method: "POST",
          url: "/backtest/schedule",
          payload: { cron: "0 0 * * *" },
        });

        expect(response.statusCode).toBe(400);
      });

      it("config 日期錯誤回傳 400", async () => {
        const response = await app.inject({
          method: "POST",
          url: "/backtest/schedule",
          payload: {
            configs: [{ start: "2024-12-31", end: "2024-01-01" }],
          },
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.payload);
        expect(body.error).toContain("開始日期不能晚於結束日期");
      });

      it("createSchedule 異常回傳 500", async () => {
        createSchedule.mockRejectedValue(new Error("Scheduler error"));

        const response = await app.inject({
          method: "POST",
          url: "/backtest/schedule",
          payload: {
            configs: [{ start: "2024-01-01", end: "2024-12-31" }],
          },
        });

        expect(response.statusCode).toBe(500);
        const body = JSON.parse(response.payload);
        expect(body.error).toBe("建立排程失敗");
      });
    });

    describe("GET /backtest/schedule/status - 所有排程狀態", () => {
      it("回傳排程列表", async () => {
        getAllSchedules.mockResolvedValue([
          { jobId: "s1", status: "scheduled", configs: [] },
          { jobId: "s2", status: "running", configs: [] },
        ]);

        const response = await app.inject({
          method: "GET",
          url: "/backtest/schedule/status",
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);
        expect(body).toHaveLength(2);
      });
    });

    describe("GET /backtest/schedule/:jobId - 單一排程狀態", () => {
      it("找到排程回傳狀態", async () => {
        getScheduleStatus.mockResolvedValue({
          jobId: "schedule-123",
          status: "scheduled",
          configs: [],
          cron: "0 0 * * *",
        });

        const response = await app.inject({
          method: "GET",
          url: "/backtest/schedule/schedule-123",
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);
        expect(body.jobId).toBe("schedule-123");
      });

      it("找不到排程回傳 404", async () => {
        getScheduleStatus.mockResolvedValue(null);

        const response = await app.inject({
          method: "GET",
          url: "/backtest/schedule/non-existent",
        });

        expect(response.statusCode).toBe(404);
      });
    });

    describe("POST /backtest/schedule/:jobId/trigger - 手動觸發", () => {
      it("成功觸發回傳 200", async () => {
        triggerSchedule.mockResolvedValue(true);

        const response = await app.inject({
          method: "POST",
          url: "/backtest/schedule/schedule-123/trigger",
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);
        expect(body.triggered).toBe(true);
      });

      it("無法觸發回傳 404", async () => {
        triggerSchedule.mockResolvedValue(false);

        const response = await app.inject({
          method: "POST",
          url: "/backtest/schedule/schedule-123/trigger",
        });

        expect(response.statusCode).toBe(404);
      });

      it("正在執行中回傳 400", async () => {
        const err = new Error("排程正在執行中");
        triggerSchedule.mockRejectedValue(err);

        const response = await app.inject({
          method: "POST",
          url: "/backtest/schedule/schedule-123/trigger",
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.payload);
        expect(body.error).toBe("排程正在執行中");
      });
    });

    describe("DELETE /backtest/schedule/:jobId - 取消排程", () => {
      it("成功取消回傳 200", async () => {
        cancelScheduledJob.mockResolvedValue(true);

        const response = await app.inject({
          method: "DELETE",
          url: "/backtest/schedule/schedule-123",
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);
        expect(body.cancelled).toBe(true);
      });

      it("無法取消回傳 404", async () => {
        cancelScheduledJob.mockResolvedValue(false);

        const response = await app.inject({
          method: "DELETE",
          url: "/backtest/schedule/schedule-123",
        });

        expect(response.statusCode).toBe(404);
      });
    });

    describe("GET /backtest/scheduler/stats - 排程器統計", () => {
      it("回傳統計資料", async () => {
        getSchedulerStats.mockResolvedValue({
          waiting: 1,
          active: 2,
          completed: 50,
          failed: 2,
          delayed: 0,
          schedules: { scheduled: 3, running: 1, total: 4 },
        });

        const response = await app.inject({
          method: "GET",
          url: "/backtest/scheduler/stats",
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);
        expect(body.waiting).toBe(1);
        expect(body.schedules.total).toBe(4);
      });
    });
  });
});
