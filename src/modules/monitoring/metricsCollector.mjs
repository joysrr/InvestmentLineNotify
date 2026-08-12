/**
 * metricsCollector.mjs
 * 效能指標收集器
 */

import { EventEmitter } from "events";

class MetricsCollector extends EventEmitter {
  constructor() {
    super();
    // Initialize Maps first
    this.workerHeartbeats = new Map();
    this.customMetrics = new Map();
    this.reset();
  }

  /**
   * 重設所有指標
   */
  reset() {
    this.httpRequests = {
      total: 0,
      byMethod: {},
      byPath: {},
      byStatus: {},
      durations: [],
      errors: 0,
    };
    this.queueDepth = {
      current: 0,
      max: 0,
      min: Infinity,
      sum: 0,
      count: 0,
    };
    this.systemResources = {
      memoryUsage: 0,
      cpuUsage: 0,
    };
    this.workerHeartbeats = new Map();
    this.customMetrics = new Map();
  }

  /**
   * 記錄 HTTP 請求
   */
  recordHttpRequest({ method, path, statusCode, duration }) {
    this.httpRequests.total++;
    this.httpRequests.byMethod[method] =
      (this.httpRequests.byMethod[method] || 0) + 1;
    this.httpRequests.byPath[path] = (this.httpRequests.byPath[path] || 0) + 1;
    this.httpRequests.byStatus[String(statusCode)] =
      (this.httpRequests.byStatus[String(statusCode)] || 0) + 1;
    this.httpRequests.durations.push(duration);

    if (statusCode >= 400) {
      this.httpRequests.errors++;
    }

    // 保持 durations 陣列在合理大小 (最多 10000)
    if (this.httpRequests.durations.length > 10000) {
      this.httpRequests.durations = this.httpRequests.durations.slice(-5000);
    }

    this.emit("httpRequest", { method, path, statusCode, duration });
  }

  /**
   * 記錄佇列深度
   */
  recordQueueDepth(depth) {
    this.queueDepth.current = depth;
    this.queueDepth.max = Math.max(this.queueDepth.max, depth);
    this.queueDepth.min = Math.min(this.queueDepth.min, depth);
    this.queueDepth.sum += depth;
    this.queueDepth.count++;

    this.emit("queueDepth", { depth });
  }

  /**
   * 記錄系統資源
   */
  recordSystemResources({ memoryUsage, cpuUsage }) {
    this.systemResources.memoryUsage = memoryUsage;
    this.systemResources.cpuUsage = cpuUsage;

    this.emit("systemResources", { memoryUsage, cpuUsage });
  }

  /**
   * 記錄 Worker 心跳
   */
  recordWorkerHeartbeat(workerId) {
    this.workerHeartbeats.set(workerId, Date.now());
    this.emit("workerHeartbeat", { workerId });
  }

  /**
   * 取得 Worker 狀態
   */
  getWorkerStatus(maxAgeMs = 60000) {
    const now = Date.now();
    const status = {};
    for (const [workerId, lastHeartbeat] of this.workerHeartbeats) {
      status[workerId] = {
        alive: now - lastHeartbeat <= maxAgeMs,
        lastHeartbeat,
        ageMs: now - lastHeartbeat,
      };
    }
    return status;
  }

  /**
   * 記錄自訂指標
   */
  recordCustomMetric(name, value) {
    if (!this.customMetrics.has(name)) {
      this.customMetrics.set(name, []);
    }
    const arr = this.customMetrics.get(name);
    arr.push({ value, timestamp: Date.now() });
    if (arr.length > 1000) arr.shift();
  }

  /**
   * 計算 latency percentiles
   */
  calculatePercentiles(durations) {
    if (durations.length === 0) return { p50: 0, p95: 0, p99: 0 };

    const sorted = [...durations].sort((a, b) => a - b);
    const getPercentile = (p) => sorted[Math.floor((sorted.length * p) / 100)];

    return {
      p50: getPercentile(50),
      p95: getPercentile(95),
      p99: getPercentile(99),
    };
  }

  /**
   * 取得目前指標
   */
  getMetrics() {
    const latency = this.calculatePercentiles(this.httpRequests.durations);
    const errorRate =
      this.httpRequests.total > 0
        ? this.httpRequests.errors / this.httpRequests.total
        : 0;

    return {
      httpRequests: {
        total: this.httpRequests.total,
        byMethod: { ...this.httpRequests.byMethod },
        byPath: { ...this.httpRequests.byPath },
        byStatus: { ...this.httpRequests.byStatus },
        latency,
        errors: this.httpRequests.errors,
        errorRate,
      },
      queueDepth: {
        current: this.queueDepth.current,
        max: this.queueDepth.max,
        min: this.queueDepth.min === Infinity ? 0 : this.queueDepth.min,
        avg:
          this.queueDepth.count > 0
            ? this.queueDepth.sum / this.queueDepth.count
            : 0,
      },
      systemResources: { ...this.systemResources },
      workerStatus: this.getWorkerStatus(),
      customMetrics: Object.fromEntries(this.customMetrics),
    };
  }

  /**
   * 取得快照 (用於定期存檔)
   */
  getSnapshot() {
    return {
      timestamp: Date.now(),
      metrics: this.getMetrics(),
    };
  }
}

export const metricsCollector = new MetricsCollector();
export default metricsCollector;
