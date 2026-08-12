/**
 * monitoringRoutes.mjs
 * 監控 API 端點
 */

import { errorStore } from "../../modules/monitoring/errorStore.mjs";
import { metricsCollector } from "../../modules/monitoring/metricsCollector.mjs";
import { alertEngine } from "../../modules/monitoring/alertEngine.mjs";
import { defaultNotifier } from "../../modules/monitoring/alertEngine.mjs";
import logger from "../../utils/logger.mjs";

/**
 * 註冊監控路由
 */
export default async function monitoringRoutes(fastify) {
  // 設定預設通知器
  alertEngine.setNotifier(defaultNotifier);

  // 註冊預設告警規則
  registerDefaultRules();

  /**
   * POST /api/errors - 接收錯誤回報
   */
  fastify.post(
    "/errors",
    {
      schema: {
        body: {
          type: "object",
          required: ["message"],
          properties: {
            message: { type: "string" },
            stack: { type: "string" },
            statusCode: { type: "integer" },
            request: {
              type: "object",
              properties: {
                url: { type: "string" },
                method: { type: "string" },
                body: { type: "object" },
                headers: { type: "object" },
              },
            },
            timestamp: { type: "integer" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              errorId: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const error = new Error(request.body.message);
        error.stack = request.body.stack;
        error.statusCode = request.body.statusCode || 500;
        error.request = request.body.request;
        error.timestamp = request.body.timestamp || Date.now();

        await errorStore.save(error);

        // 更新指標
        metricsCollector.recordCustomMetric("errors_reported", 1);

        return { success: true, errorId: `err_${Date.now()}` };
      } catch (err) {
        logger.error({ err: err.message }, "Failed to save error");
        reply.code(500);
        return { success: false, error: err.message };
      }
    },
  );

  /**
   * GET /api/errors - 取得錯誤列表
   */
  fastify.get(
    "/errors",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", default: 50 },
            offset: { type: "integer", default: 0 },
            since: { type: "integer" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              errors: { type: "array" },
              total: { type: "integer" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { limit = 50, offset = 0, since } = request.query;

      let errors;
      if (since) {
        errors = await errorStore.getSince(since, limit);
      } else {
        errors = await errorStore.getAll(limit, offset);
      }

      return { errors, total: errors.length };
    },
  );

  /**
   * GET /api/errors/stats - 取得錯誤統計
   */
  fastify.get(
    "/errors/stats",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              total: { type: "integer" },
              byStatus: { type: "object" },
              lastHour: { type: "integer" },
              lastDay: { type: "integer" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const stats = await errorStore.getStats();
      return stats;
    },
  );

  /**
   * GET /api/monitoring/dashboard - 監控儀表板資料
   */
  fastify.get(
    "/monitoring/dashboard",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              timestamp: { type: "integer" },
              metrics: { type: "object" },
              alerts: { type: "array" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const metrics = metricsCollector.getMetrics();
      const alerts = alertEngine.getHistory(20);

      return {
        timestamp: Date.now(),
        metrics,
        alerts,
      };
    },
  );

  /**
   * GET /api/monitoring/metrics - 取得原始指標
   */
  fastify.get("/monitoring/metrics", async (request, reply) => {
    const snapshot = metricsCollector.getSnapshot();
    return snapshot;
  });

  /**
   * POST /api/monitoring/alerts/rules - 新增告警規則
   */
  fastify.post(
    "/monitoring/alerts/rules",
    {
      schema: {
        body: {
          type: "object",
          required: ["name", "condition", "message"],
          properties: {
            name: { type: "string" },
            condition: { type: "string" }, // JavaScript 表達式字串
            severity: {
              type: "string",
              enum: ["low", "medium", "high", "critical"],
              default: "medium",
            },
            message: { type: "string" },
            cooldownMs: { type: "integer", default: 300000 },
            enabled: { type: "boolean", default: true },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              rule: { type: "object" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        // 將 condition 字串轉為函數 (簡單實作，生產環境應更安全)
        const conditionFn = new Function(
          "metrics",
          `return ${request.body.condition}`,
        );

        const rule = {
          name: request.body.name,
          condition: conditionFn,
          severity: request.body.severity,
          message: request.body.message,
          cooldownMs: request.body.cooldownMs,
          enabled: request.body.enabled,
        };

        alertEngine.addRule(rule);

        reply.code(201);
        return { success: true, rule };
      } catch (err) {
        logger.error({ err: err.message }, "Failed to add alert rule");
        reply.code(400);
        return { success: false, error: err.message };
      }
    },
  );

  /**
   * GET /api/monitoring/alerts/rules - 取得告警規則
   */
  fastify.get("/monitoring/alerts/rules", async (request, reply) => {
    const rules = alertEngine.getRules();
    return {
      rules: rules.map((r) => ({ ...r, condition: r.condition.toString() })),
    };
  });

  /**
   * DELETE /api/monitoring/alerts/rules/:name - 刪除告警規則
   */
  fastify.delete("/monitoring/alerts/rules/:name", async (request, reply) => {
    alertEngine.removeRule(request.params.name);
    return { success: true };
  });

  /**
   * GET /api/monitoring/alerts/history - 取得告警歷史
   */
  fastify.get(
    "/monitoring/alerts/history",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", default: 50 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              alerts: { type: "array" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const alerts = alertEngine.getHistory(request.query.limit || 50);
      return { alerts };
    },
  );

  /**
   * POST /api/monitoring/alerts/test - 測試告警
   */
  fastify.post("/monitoring/alerts/test", async (request, reply) => {
    await alertEngine.check({ testValue: 1000 }); // 觸發所有規則
    return { success: true };
  });

  /**
   * POST /api/monitoring/metrics/http - 記錄 HTTP 指標 (內部使用)
   */
  fastify.post(
    "/monitoring/metrics/http",
    {
      schema: {
        body: {
          type: "object",
          required: ["method", "path", "statusCode", "duration"],
          properties: {
            method: { type: "string" },
            path: { type: "string" },
            statusCode: { type: "integer" },
            duration: { type: "integer" },
          },
        },
        response: {
          200: { type: "object", properties: { success: { type: "boolean" } } },
        },
      },
    },
    async (request, reply) => {
      metricsCollector.recordHttpRequest(request.body);
      return { success: true };
    },
  );

  /**
   * POST /api/monitoring/metrics/queue - 記錄佇列深度 (內部使用)
   */
  fastify.post(
    "/monitoring/metrics/queue",
    {
      schema: {
        body: {
          type: "object",
          required: ["depth"],
          properties: {
            depth: { type: "integer" },
          },
        },
        response: {
          200: { type: "object", properties: { success: { type: "boolean" } } },
        },
      },
    },
    async (request, reply) => {
      metricsCollector.recordQueueDepth(request.body.depth);
      return { success: true };
    },
  );

  /**
   * POST /api/monitoring/metrics/worker-heartbeat - 記錄 Worker 心跳 (內部使用)
   */
  fastify.post(
    "/monitoring/metrics/worker-heartbeat",
    {
      schema: {
        body: {
          type: "object",
          required: ["workerId"],
          properties: {
            workerId: { type: "string" },
          },
        },
        response: {
          200: { type: "object", properties: { success: { type: "boolean" } } },
        },
      },
    },
    async (request, reply) => {
      metricsCollector.recordWorkerHeartbeat(request.body.workerId);
      return { success: true };
    },
  );
}

/**
 * 註冊預設告警規則
 */
function registerDefaultRules() {
  // 高錯誤率告警
  alertEngine.addRule({
    name: "high_error_rate",
    condition: (metrics) => metrics.httpRequests.errorRate > 0.05,
    severity: "high",
    message: "HTTP 錯誤率超過 5%",
    cooldownMs: 300000,
  });

  // 高 P95 latency 告警
  alertEngine.addRule({
    name: "high_p95_latency",
    condition: (metrics) => metrics.httpRequests.latency.p95 > 2000,
    severity: "medium",
    message: "P95 latency 超過 2 秒",
    cooldownMs: 300000,
  });

  // 佇列積壓告警
  alertEngine.addRule({
    name: "queue_backlog",
    condition: (metrics) => metrics.queueDepth.current > 50,
    severity: "high",
    message: "佇列積壓超過 50",
    cooldownMs: 60000,
  });

  // Worker 心跳超時告警
  alertEngine.addRule({
    name: "worker_heartbeat_timeout",
    condition: (metrics) => {
      for (const [workerId, status] of Object.entries(metrics.workerStatus)) {
        if (!status.alive) return true;
      }
      return false;
    },
    severity: "critical",
    message: "Worker 心跳超時",
    cooldownMs: 60000,
  });

  // 高記憶體使用告警
  alertEngine.addRule({
    name: "high_memory_usage",
    condition: (metrics) =>
      metrics.systemResources.memoryUsage > 500 * 1024 * 1024, // 500MB
    severity: "medium",
    message: "記憶體使用超過 500MB",
    cooldownMs: 300000,
  });
}
