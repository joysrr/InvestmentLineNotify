/**
 * backtestRoutes.test.mjs
 * 回測 API 路由整合測試
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../../api/server.mjs";

// 設定開發環境變數以繞過 initDataGuard
process.env.NODE_ENV = "development";
process.env.BYPASS_INIT_DATA = "true";

describe("Backtest API Routes", () => {
  let app;
  let testJobIds = [];

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    // 清理測試建立的任務
    for (const jobId of testJobIds) {
      try {
        await app.inject({
          method: "DELETE",
          url: `/api/backtest/${jobId}`,
          headers: { "X-Telegram-Init-Data": "test" },
        });
      } catch {
        // ignore cleanup errors
      }
    }
    await app.close();
  });

  beforeEach(() => {
    testJobIds = [];
  });

  it("POST /api/backtest/run 應能提交回測任務", async () => {
    const config = {
      start: "2026-08-01",
      end: "2026-08-09",
      name: "api-test-submit",
      quiet: true,
      disableGuards: true,
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/backtest/run",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": "test",
      },
      payload: config,
    });

    expect(response.statusCode).toBe(202);
    const body = JSON.parse(response.body);
    expect(body.jobId).toBeDefined();
    expect(body.status).toBe("waiting");
    expect(body.message).toContain("佇列");

    testJobIds.push(body.jobId);
  });

  it("POST /api/backtest/run 應驗證必要參數", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/backtest/run",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": "test",
      },
      payload: { name: "no-dates" },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
  });

  it("POST /api/backtest/run 應驗證日期格式", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/backtest/run",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": "test",
      },
      payload: { start: "2026/08/01", end: "2026-08-09" },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    // Schema validation 失敗會回傳 "Bad Request" 或 validation 錯誤訊息
    expect(body.error).toBeDefined();
  });

  it("POST /api/backtest/run 應驗證開始日期不能晚於結束日期", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/backtest/run",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": "test",
      },
      payload: { start: "2026-08-09", end: "2026-08-01" },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toContain("開始日期不能晚於結束日期");
  });

  it("GET /api/backtest/:jobId 應能查詢任務狀態", async () => {
    // 先提交任務
    const submitResponse = await app.inject({
      method: "POST",
      url: "/api/backtest/run",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": "test",
      },
      payload: {
        start: "2026-08-01",
        end: "2026-08-09",
        name: "api-test-status",
        quiet: true,
        disableGuards: true,
      },
    });

    const { jobId } = JSON.parse(submitResponse.body);
    testJobIds.push(jobId);

    // 等待任務開始
    await new Promise((r) => setTimeout(r, 500));

    // 查詢狀態
    const response = await app.inject({
      method: "GET",
      url: `/api/backtest/${jobId}`,
      headers: { "X-Telegram-Init-Data": "test" },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.jobId).toBe(jobId);
    expect(["waiting", "active", "completed", "failed"]).toContain(body.status);
    expect(body.progress).toBeDefined();
    expect(body.createdAt).toBeDefined();
  });

  it("GET /api/backtest/:jobId 不存在的任務應回傳 404", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/backtest/non-existent-job-id",
      headers: { "X-Telegram-Init-Data": "test" },
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
  });

  it("GET /api/backtest/queue/stats 應回傳佇列統計", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/backtest/queue/stats",
      headers: { "X-Telegram-Init-Data": "test" },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(typeof body.waiting).toBe("number");
    expect(typeof body.active).toBe("number");
    expect(typeof body.completed).toBe("number");
    expect(typeof body.failed).toBe("number");
    expect(typeof body.delayed).toBe("number");
  });

  it("DELETE /api/backtest/:jobId 應能取消等待中的任務", async () => {
    const submitResponse = await app.inject({
      method: "POST",
      url: "/api/backtest/run",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": "test",
      },
      payload: {
        start: "2026-08-01",
        end: "2026-08-09",
        name: "api-test-cancel",
        quiet: true,
        disableGuards: true,
      },
    });

    const { jobId } = JSON.parse(submitResponse.body);
    testJobIds.push(jobId);

    // 立即取消
    const response = await app.inject({
      method: "DELETE",
      url: `/api/backtest/${jobId}`,
      headers: { "X-Telegram-Init-Data": "test" },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.cancelled).toBe(true);
    expect(body.jobId).toBe(jobId);
  });

  it("缺少 Telegram initData 應被拒絕 (生產環境)", async () => {
    // 暫時移除 BYPASS 來測試 guard
    const originalBypass = process.env.BYPASS_INIT_DATA;
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.BYPASS_INIT_DATA = "false";
    process.env.NODE_ENV = "production";

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/backtest/run",
        headers: { "Content-Type": "application/json" },
        payload: { start: "2026-08-01", end: "2026-08-09" },
      });

      // initDataGuard 應攔截
      expect([401, 403]).toContain(response.statusCode);
    } finally {
      // 恢復環境變數
      process.env.BYPASS_INIT_DATA = originalBypass;
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
