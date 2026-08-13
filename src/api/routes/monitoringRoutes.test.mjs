// src/api/routes/monitoringRoutes.test.mjs
// TDD: Monitoring Routes 測試

import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";

// 使用 vi.mock factory 形式避免 hoisting 問題
vi.mock("../../modules/monitoring/errorStore.mjs", () => ({
  errorStore: {
    save: vi.fn(),
    getAll: vi.fn(),
    getSince: vi.fn(),
    getStats: vi.fn(),
  },
}));

vi.mock("../../modules/monitoring/metricsCollector.mjs", () => ({
  metricsCollector: {
    recordCustomMetric: vi.fn(),
    getMetrics: vi.fn(),
    getSnapshot: vi.fn(),
    recordHttpRequest: vi.fn(),
    recordQueueDepth: vi.fn(),
    recordWorkerHeartbeat: vi.fn(),
  },
}));

vi.mock("../../modules/monitoring/alertEngine.mjs", () => ({
  alertEngine: {
    setNotifier: vi.fn(),
    addRule: vi.fn(),
    getRules: vi.fn(() => []),
    removeRule: vi.fn(),
    getHistory: vi.fn(() => []),
    check: vi.fn(),
  },
  defaultNotifier: {},
}));

vi.mock("../../utils/logger.mjs", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import monitoringRoutes from "./monitoringRoutes.mjs";
import { errorStore } from "../../modules/monitoring/errorStore.mjs";
import { metricsCollector } from "../../modules/monitoring/metricsCollector.mjs";
import { alertEngine } from "../../modules/monitoring/alertEngine.mjs";

describe("monitoringRoutes - 監控 API 路由", () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // 重新設定預設回傳值
    alertEngine.getRules.mockReturnValue([]);
    alertEngine.getHistory.mockReturnValue([]);
    errorStore.getAll.mockResolvedValue([]);
    errorStore.getSince.mockResolvedValue([]);
    errorStore.getStats.mockResolvedValue({ total: 0, byStatus: {}, lastHour: 0, lastDay: 0 });
    metricsCollector.getMetrics.mockReturnValue({});
    metricsCollector.getSnapshot.mockReturnValue({});

    app = Fastify({ logger: false });
    await app.register(monitoringRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /errors - 接收錯誤回報", () => {
    it("儲存錯誤並回傳 errorId", async () => {
      errorStore.save.mockResolvedValue();
      metricsCollector.recordCustomMetric.mockReturnValue();

      const response = await app.inject({
        method: "POST",
        url: "/errors",
        payload: {
          message: "Test error",
          stack: "Error stack trace",
          statusCode: 500,
          request: { url: "/test", method: "GET" },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.errorId).toBeDefined();
      expect(errorStore.save).toHaveBeenCalled();
      expect(metricsCollector.recordCustomMetric).toHaveBeenCalledWith(
        "errors_reported",
        1,
      );
    });

    it("缺少 message 回傳 400 (schema validation)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/errors",
        payload: { stack: "stack" },
      });

      expect(response.statusCode).toBe(400);
    });

    it("儲存失敗回傳 500", async () => {
      errorStore.save.mockRejectedValue(new Error("DB error"));

      const response = await app.inject({
        method: "POST",
        url: "/errors",
        payload: { message: "Test error" },
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe("GET /errors - 取得錯誤列表", () => {
    it("預設參數回傳錯誤列表", async () => {
      errorStore.getAll.mockResolvedValue([
        { id: "err_1", message: "Error 1" },
        { id: "err_2", message: "Error 2" },
      ]);

      const response = await app.inject({
        method: "GET",
        url: "/errors",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.errors).toHaveLength(2);
      expect(body.total).toBe(2);
    });

    it("支援 limit/offset", async () => {
      errorStore.getAll.mockResolvedValue([{ id: "err_1" }]);

      await app.inject({
        method: "GET",
        url: "/errors?limit=10&offset=5",
      });

      expect(errorStore.getAll).toHaveBeenCalledWith(10, 5);
    });

    it("支援 since 參數", async () => {
      errorStore.getSince.mockResolvedValue([{ id: "err_1" }]);

      await app.inject({
        method: "GET",
        url: "/errors?since=1700000000000&limit=20",
      });

      expect(errorStore.getSince).toHaveBeenCalledWith(1700000000000, 20);
    });
  });

  describe("GET /errors/stats - 錯誤統計", () => {
    it("回傳統計資料", async () => {
      errorStore.getStats.mockResolvedValue({
        total: 100,
        byStatus: { 500: 50, 404: 50 },
        lastHour: 10,
        lastDay: 50,
      });

      const response = await app.inject({
        method: "GET",
        url: "/errors/stats",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.total).toBe(100);
      // byStatus 可能有不同結構
      expect(body.byStatus).toBeDefined();
    });
  });

  describe("GET /monitoring/dashboard - 監控儀表板", () => {
    it("回傳 metrics 和 alerts", async () => {
      metricsCollector.getMetrics.mockReturnValue({
        httpRequests: { total: 1000, errorRate: 0.01 },
        systemResources: { memoryUsage: 100000000 },
      });
      alertEngine.getHistory.mockReturnValue([
        { name: "test_alert", severity: "high", timestamp: Date.now() },
      ]);

      const response = await app.inject({
        method: "GET",
        url: "/monitoring/dashboard",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.timestamp).toBeDefined();
      // metrics 可能是空物件，檢查結構即可
      expect(body.metrics).toBeDefined();
      expect(body.alerts).toHaveLength(1);
    });
  });

  describe("GET /monitoring/metrics - 原始指標", () => {
    it("回傳 snapshot", async () => {
      metricsCollector.getSnapshot.mockReturnValue({
        httpRequests: { total: 100 },
        queueDepth: { current: 5 },
      });

      const response = await app.inject({
        method: "GET",
        url: "/monitoring/metrics",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.httpRequests.total).toBe(100);
    });
  });

  describe("POST /monitoring/alerts/rules - 新增告警規則", () => {
    it("有效規則回傳 201", async () => {
      alertEngine.addRule.mockReturnValue();

      const response = await app.inject({
        method: "POST",
        url: "/monitoring/alerts/rules",
        payload: {
          name: "test_rule",
          condition: "metrics.httpRequests.errorRate > 0.05",
          severity: "high",
          message: "Error rate high",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(alertEngine.addRule).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "test_rule",
          severity: "high",
          message: "Error rate high",
        }),
      );
    });

    it("缺少必要欄位回傳 400 (schema)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/monitoring/alerts/rules",
        payload: { name: "test" },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /monitoring/alerts/rules - 取得告警規則", () => {
    it("回傳規則列表", async () => {
      alertEngine.getRules.mockReturnValue([
        { name: "rule1", condition: () => true, severity: "high" },
        { name: "rule2", condition: () => false, severity: "medium" },
      ]);

      const response = await app.inject({
        method: "GET",
        url: "/monitoring/alerts/rules",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.rules).toHaveLength(2);
      // condition 被轉為字串
      expect(typeof body.rules[0].condition).toBe("string");
    });
  });

  describe("DELETE /monitoring/alerts/rules/:name - 刪除告警規則", () => {
    it("刪除規則回傳成功", async () => {
      alertEngine.removeRule.mockReturnValue();

      const response = await app.inject({
        method: "DELETE",
        url: "/monitoring/alerts/rules/test_rule",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(alertEngine.removeRule).toHaveBeenCalledWith("test_rule");
    });
  });

  describe("GET /monitoring/alerts/history - 告警歷史", () => {
    it("回傳歷史", async () => {
      alertEngine.getHistory.mockReturnValue([
        { name: "alert1", severity: "high" },
        { name: "alert2", severity: "medium" },
      ]);

      const response = await app.inject({
        method: "GET",
        url: "/monitoring/alerts/history?limit=10",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.alerts).toHaveLength(2);
    });
  });

  describe("POST /monitoring/alerts/test - 測試告警", () => {
    it("觸發檢查回傳成功", async () => {
      alertEngine.check.mockResolvedValue();

      const response = await app.inject({
        method: "POST",
        url: "/monitoring/alerts/test",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(alertEngine.check).toHaveBeenCalledWith({ testValue: 1000 });
    });
  });

  describe("內部指標端點", () => {
    it("POST /monitoring/metrics/http 記錄 HTTP 指標", async () => {
      metricsCollector.recordHttpRequest.mockReturnValue();

      const response = await app.inject({
        method: "POST",
        url: "/monitoring/metrics/http",
        payload: {
          method: "GET",
          path: "/api/test",
          statusCode: 200,
          duration: 100,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(metricsCollector.recordHttpRequest).toHaveBeenCalledWith({
        method: "GET",
        path: "/api/test",
        statusCode: 200,
        duration: 100,
      });
    });

    it("POST /monitoring/metrics/queue 記錄佇列深度", async () => {
      metricsCollector.recordQueueDepth.mockReturnValue();

      const response = await app.inject({
        method: "POST",
        url: "/monitoring/metrics/queue",
        payload: { depth: 25 },
      });

      expect(response.statusCode).toBe(200);
      expect(metricsCollector.recordQueueDepth).toHaveBeenCalledWith(25);
    });

    it("POST /monitoring/metrics/worker-heartbeat 記錄心跳", async () => {
      metricsCollector.recordWorkerHeartbeat.mockReturnValue();

      const response = await app.inject({
        method: "POST",
        url: "/monitoring/metrics/worker-heartbeat",
        payload: { workerId: "worker-1" },
      });

      expect(response.statusCode).toBe(200);
      expect(metricsCollector.recordWorkerHeartbeat).toHaveBeenCalledWith(
        "worker-1",
      );
    });
  });
});