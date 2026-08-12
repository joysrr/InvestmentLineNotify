/**
 * monitoring.test.mjs
 * 監控模組整合測試
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
import { errorStore } from "../../modules/monitoring/errorStore.mjs";
import { metricsCollector } from "../../modules/monitoring/metricsCollector.mjs";
import { alertEngine } from "../../modules/monitoring/alertEngine.mjs";

// 設定開發環境變數
process.env.NODE_ENV = "development";
process.env.MONITORING_ENABLED = "true";
process.env.TELEGRAM_BOT_TOKEN = "test-token";

describe("Monitoring Module", () => {
  describe("Error Store", () => {
    beforeEach(async () => {
      // 清理資料庫
      await errorStore.clear();
    });

    it("應能儲存錯誤", async () => {
      const error = new Error("Test error");
      error.statusCode = 500;
      error.request = {
        url: "/api/test",
        method: "POST",
        body: { test: true },
      };

      await errorStore.save(error);

      const errors = await errorStore.getAll();
      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe("Test error");
      expect(errors[0].statusCode).toBe(500);
    });

    it("應能去重相同錯誤", async () => {
      const error = new Error("Duplicate error");
      error.statusCode = 500;
      error.request = { url: "/api/test", method: "GET" };

      await errorStore.save(error);
      await errorStore.save(error); // 同樣錯誤

      const errors = await errorStore.getAll();
      expect(errors.length).toBe(1);
      expect(errors[0].count).toBe(2);
    });

    it("應能查詢特定時間範圍的錯誤", async () => {
      const error = new Error("Time range error");
      error.statusCode = 404;
      await errorStore.save(error);

      const since = Date.now() - 1000;
      const errors = await errorStore.getSince(since);
      expect(errors.length).toBe(1);
    });

    it("應能取得錯誤統計", async () => {
      await errorStore.save(new Error("Error 1"));
      await errorStore.save(new Error("Error 2"));
      await errorStore.save(new Error("Error 3"));

      const stats = await errorStore.getStats();
      expect(stats.total).toBe(3);
      expect(stats.byStatus).toBeDefined();
    });
  });

  describe("Metrics Collector", () => {
    beforeEach(() => {
      metricsCollector.reset();
    });

    it("應能記錄 HTTP 請求指標", () => {
      metricsCollector.recordHttpRequest({
        method: "GET",
        path: "/api/test",
        statusCode: 200,
        duration: 150,
      });

      const metrics = metricsCollector.getMetrics();
      expect(metrics.httpRequests.total).toBe(1);
      expect(metrics.httpRequests.byStatus["200"]).toBe(1);
    });

    it("應能計算 p50/p95/p99 latency", () => {
      // 記錄多個請求
      for (let i = 1; i <= 100; i++) {
        metricsCollector.recordHttpRequest({
          method: "GET",
          path: "/api/test",
          statusCode: 200,
          duration: i, // 1ms to 100ms
        });
      }

      const metrics = metricsCollector.getMetrics();
      expect(metrics.httpRequests.latency.p50).toBeGreaterThan(0);
      expect(metrics.httpRequests.latency.p95).toBeGreaterThan(
        metrics.httpRequests.latency.p50,
      );
      expect(metrics.httpRequests.latency.p99).toBeGreaterThan(
        metrics.httpRequests.latency.p95,
      );
    });

    it("應能記錄佇列深度", () => {
      metricsCollector.recordQueueDepth(5);
      metricsCollector.recordQueueDepth(10);
      metricsCollector.recordQueueDepth(3);

      const metrics = metricsCollector.getMetrics();
      expect(metrics.queueDepth.current).toBe(3);
      expect(metrics.queueDepth.max).toBe(10);
      expect(metrics.queueDepth.avg).toBeCloseTo(6);
    });

    it("應能記錄系統資源", () => {
      metricsCollector.recordSystemResources({
        memoryUsage: 100 * 1024 * 1024, // 100MB
        cpuUsage: 0.5,
      });

      const metrics = metricsCollector.getMetrics();
      expect(metrics.systemResources.memoryUsage).toBe(100 * 1024 * 1024);
      expect(metrics.systemResources.cpuUsage).toBe(0.5);
    });

    it("應能輸出快照", () => {
      metricsCollector.recordHttpRequest({
        method: "GET",
        path: "/api/test",
        statusCode: 200,
        duration: 100,
      });
      metricsCollector.recordQueueDepth(5);

      const snapshot = metricsCollector.getSnapshot();
      expect(snapshot).toHaveProperty("timestamp");
      expect(snapshot).toHaveProperty("metrics");
      expect(snapshot.metrics.httpRequests.total).toBe(1);
    });
  });

  describe("Alert Engine", () => {
    beforeEach(() => {
      alertEngine.reset();
    });

    it("應能設定告警規則", () => {
      alertEngine.addRule({
        name: "high_error_rate",
        condition: (metrics) => metrics.httpRequests.errorRate > 0.05,
        severity: "high",
        message: "錯誤率超過 5%",
      });

      const rules = alertEngine.getRules();
      expect(rules.length).toBe(1);
      expect(rules[0].name).toBe("high_error_rate");
    });

    it("應能檢查告警條件", async () => {
      alertEngine.addRule({
        name: "test_alert",
        condition: (metrics) => metrics.testValue > 100,
        severity: "medium",
        message: "測試告警",
      });

      // 不觸發告警
      let alerts = await alertEngine.check({ testValue: 50 });
      expect(alerts.length).toBe(0);

      // 觸發告警
      alerts = await alertEngine.check({ testValue: 150 });
      expect(alerts.length).toBe(1);
      expect(alerts[0].name).toBe("test_alert");
      expect(alerts[0].severity).toBe("medium");
    });

    it("應能發送通知", async () => {
      const mockNotify = vi.fn();
      alertEngine.setNotifier(mockNotify);

      alertEngine.addRule({
        name: "notify_test",
        condition: () => true,
        severity: "critical",
        message: "通知測試",
      });

      await alertEngine.check({});
      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "notify_test",
          severity: "critical",
        }),
      );
    });
  });
});
