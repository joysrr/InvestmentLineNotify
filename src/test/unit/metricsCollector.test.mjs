// src/test/unit/metricsCollector.test.mjs
// TDD: MetricsCollector 指標收集與計算分支覆蓋

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../utils/logger.mjs", () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("metricsCollector - 指標收集與計算", () => {
  let metricsCollector;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../../modules/monitoring/metricsCollector.mjs");
    metricsCollector = mod.default;
    metricsCollector.reset();
  });

  describe("constructor & reset", () => {
    it("初始化時重設所有指標", () => {
      expect(metricsCollector.httpRequests.total).toBe(0);
      expect(metricsCollector.queueDepth.current).toBe(0);
      expect(metricsCollector.queueDepth.min).toBe(Infinity);
      expect(metricsCollector.systemResources.memoryUsage).toBe(0);
    });

    it("reset 清空所有紀錄", () => {
      metricsCollector.recordHttpRequest({ method: "GET", path: "/api", statusCode: 200, duration: 100 });
      metricsCollector.reset();

      expect(metricsCollector.httpRequests.total).toBe(0);
      expect(metricsCollector.httpRequests.durations).toEqual([]);
    });
  });

  describe("recordHttpRequest", () => {
    it("累計 total/byMethod/byPath/byStatus", () => {
      metricsCollector.recordHttpRequest({ method: "GET", path: "/a", statusCode: 200, duration: 50 });
      metricsCollector.recordHttpRequest({ method: "GET", path: "/b", statusCode: 200, duration: 60 });
      metricsCollector.recordHttpRequest({ method: "POST", path: "/a", statusCode: 201, duration: 70 });

      const m = metricsCollector.getMetrics();
      expect(m.httpRequests.total).toBe(3);
      expect(m.httpRequests.byMethod.GET).toBe(2);
      expect(m.httpRequests.byMethod.POST).toBe(1);
      expect(m.httpRequests.byPath["/a"]).toBe(2);
      expect(m.httpRequests.byPath["/b"]).toBe(1);
      expect(m.httpRequests.byStatus["200"]).toBe(2);
      expect(m.httpRequests.byStatus["201"]).toBe(1);
    });

    it("statusCode >= 400 累計 errors", () => {
      metricsCollector.recordHttpRequest({ method: "GET", path: "/x", statusCode: 200, duration: 10 });
      metricsCollector.recordHttpRequest({ method: "GET", path: "/y", statusCode: 404, duration: 20 });
      metricsCollector.recordHttpRequest({ method: "GET", path: "/z", statusCode: 500, duration: 30 });

      const m = metricsCollector.getMetrics();
      expect(m.httpRequests.errors).toBe(2);
    });

    it("發送 httpRequest 事件", () => {
      const listener = vi.fn();
      metricsCollector.on("httpRequest", listener);

      metricsCollector.recordHttpRequest({ method: "GET", path: "/a", statusCode: 200, duration: 10 });
      expect(listener).toHaveBeenCalledWith({ method: "GET", path: "/a", statusCode: 200, duration: 10 });
    });

    it("durations 陣列超過 10000 時 trim 到 5000", () => {
      for (let i = 0; i < 10001; i++) {
        metricsCollector.recordHttpRequest({ method: "GET", path: "/x", statusCode: 200, duration: i });
      }

      expect(metricsCollector.httpRequests.durations.length).toBe(5000);
      // 確認保留的是最新 5000
      expect(metricsCollector.httpRequests.durations[0]).toBe(5001);
    });
  });

  describe("recordQueueDepth", () => {
    it("更新 current/max/min/sum/count", () => {
      metricsCollector.recordQueueDepth(5);
      metricsCollector.recordQueueDepth(10);
      metricsCollector.recordQueueDepth(3);

      const m = metricsCollector.getMetrics();
      expect(m.queueDepth.current).toBe(3);
      expect(m.queueDepth.max).toBe(10);
      expect(m.queueDepth.min).toBe(3);
      expect(m.queueDepth.avg).toBeCloseTo(6);
    });

    it("min 為 Infinity 時 getMetrics 將其轉為 0", () => {
      metricsCollector.recordQueueDepth(0); // 仍然會設 min = 0

      // 強制 min 為 Infinity 場景
      metricsCollector.reset();
      const m = metricsCollector.getMetrics();
      expect(m.queueDepth.min).toBe(0);
    });

    it("count = 0 時 avg = 0", () => {
      const m = metricsCollector.getMetrics();
      expect(m.queueDepth.avg).toBe(0);
    });

    it("發送 queueDepth 事件", () => {
      const listener = vi.fn();
      metricsCollector.on("queueDepth", listener);

      metricsCollector.recordQueueDepth(42);
      expect(listener).toHaveBeenCalledWith({ depth: 42 });
    });
  });

  describe("recordSystemResources", () => {
    it("更新 memoryUsage/cpuUsage", () => {
      metricsCollector.recordSystemResources({ memoryUsage: 80, cpuUsage: 0.5 });

      const m = metricsCollector.getMetrics();
      expect(m.systemResources.memoryUsage).toBe(80);
      expect(m.systemResources.cpuUsage).toBe(0.5);
    });

    it("發送 systemResources 事件", () => {
      const listener = vi.fn();
      metricsCollector.on("systemResources", listener);

      metricsCollector.recordSystemResources({ memoryUsage: 1, cpuUsage: 2 });
      expect(listener).toHaveBeenCalledWith({ memoryUsage: 1, cpuUsage: 2 });
    });
  });

  describe("recordWorkerHeartbeat & getWorkerStatus", () => {
    it("記錄 worker 心跳", () => {
      metricsCollector.recordWorkerHeartbeat("worker-1");

      const status = metricsCollector.getWorkerStatus();
      expect(status["worker-1"]).toBeDefined();
      expect(status["worker-1"].alive).toBe(true);
      expect(status["worker-1"].lastHeartbeat).toBeGreaterThan(0);
    });

    it("maxAgeMs 過期判斷", () => {
      const oldTimestamp = Date.now() - 120000;
      metricsCollector.workerHeartbeats.set("worker-old", oldTimestamp);

      const status = metricsCollector.getWorkerStatus(60000);
      expect(status["worker-old"].alive).toBe(false);
      expect(status["worker-old"].ageMs).toBeGreaterThan(60000);
    });

    it("發送 workerHeartbeat 事件", () => {
      const listener = vi.fn();
      metricsCollector.on("workerHeartbeat", listener);

      metricsCollector.recordWorkerHeartbeat("worker-2");
      expect(listener).toHaveBeenCalledWith({ workerId: "worker-2" });
    });
  });

  describe("recordCustomMetric", () => {
    it("累計自訂指標", () => {
      metricsCollector.recordCustomMetric("custom", 10);
      metricsCollector.recordCustomMetric("custom", 20);
      metricsCollector.recordCustomMetric("custom", 30);

      const m = metricsCollector.getMetrics();
      expect(m.customMetrics.custom).toHaveLength(3);
    });

    it("陣列超過 1000 時 shift 第一個", () => {
      for (let i = 0; i < 1001; i++) {
        metricsCollector.recordCustomMetric("metric", i);
      }

      const arr = metricsCollector.customMetrics.get("metric");
      expect(arr.length).toBe(1000);
      expect(arr[0].value).toBe(1); // 0 被 shift 掉了
    });
  });

  describe("calculatePercentiles", () => {
    it("空陣列 -> p50/p95/p99 = 0", () => {
      const result = metricsCollector.calculatePercentiles([]);
      expect(result).toEqual({ p50: 0, p95: 0, p99: 0 });
    });

    it("計算 p50/p95/p99", () => {
      const durations = Array.from({ length: 100 }, (_, i) => i + 1);
      const result = metricsCollector.calculatePercentiles(durations);

      expect(result.p50).toBeGreaterThan(0);
      expect(result.p95).toBeGreaterThan(result.p50);
      expect(result.p99).toBeGreaterThan(result.p95);
    });

    it("不修改原陣列 (使用 spread)", () => {
      const durations = [3, 1, 2];
      const original = [...durations];
      metricsCollector.calculatePercentiles(durations);

      expect(durations).toEqual(original);
    });
  });

  describe("getMetrics - 聚合", () => {
    it("errorRate 計算", () => {
      metricsCollector.recordHttpRequest({ method: "GET", path: "/", statusCode: 200, duration: 10 });
      metricsCollector.recordHttpRequest({ method: "GET", path: "/", statusCode: 500, duration: 10 });

      const m = metricsCollector.getMetrics();
      expect(m.httpRequests.errorRate).toBe(0.5);
    });

    it("total = 0 時 errorRate = 0", () => {
      const m = metricsCollector.getMetrics();
      expect(m.httpRequests.errorRate).toBe(0);
    });

    it("包含所有子指標", () => {
      const m = metricsCollector.getMetrics();
      expect(m).toHaveProperty("httpRequests");
      expect(m).toHaveProperty("queueDepth");
      expect(m).toHaveProperty("systemResources");
      expect(m).toHaveProperty("workerStatus");
      expect(m).toHaveProperty("customMetrics");
    });
  });

  describe("getSnapshot", () => {
    it("回傳 timestamp + metrics", () => {
      const snapshot = metricsCollector.getSnapshot();
      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(snapshot.metrics).toBeDefined();
      expect(snapshot.metrics).toHaveProperty("httpRequests");
    });
  });
});
