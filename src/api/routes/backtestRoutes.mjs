/**
 * backtestRoutes.mjs
 * 回測非同步 API 路由
 * - POST /api/backtest/run - 提交回測任務
 * - GET /api/backtest/:jobId - 查詢任務狀態/結果
 * - GET /api/backtest/:jobId/ws - WebSocket 進度推播
 * - DELETE /api/backtest/:jobId - 取消任務
 * - GET /api/backtest/queue/stats - 佇列統計
 */

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

const BACKTEST_CONFIG_SCHEMA = {
  type: "object",
  required: ["start", "end"],
  properties: {
    start: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    end: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    name: { type: "string", maxLength: 64 },
    quiet: { type: "boolean" },
    disableGuards: { type: "boolean" },
    buyTactical: { type: "number", minimum: 0, maximum: 20 },
    buyTacticalBullish: { type: "number", minimum: 0, maximum: 20 },
    disableLoanGuard: { type: "boolean" },
    initialCash: { type: "number", minimum: 0 },
    monthlyDca: { type: "number", minimum: 0 },
    pledgeRatio: { type: "number", minimum: 0, maximum: 1 },
    interestRate: { type: "number", minimum: 0, maximum: 1 },
  },
};

async function backtestRoutes(fastify) {
  // POST /backtest/run - 提交回測任務
  fastify.post(
    "/backtest/run",
    {
      schema: {
        body: BACKTEST_CONFIG_SCHEMA,
        response: {
          202: {
            type: "object",
            properties: {
              jobId: { type: "string" },
              status: { type: "string" },
              message: { type: "string" },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      const config = request.body;

      // 驗證日期
      if (config.start > config.end) {
        return reply.code(400).send({ error: "開始日期不能晚於結束日期" });
      }

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(config.start) || !dateRegex.test(config.end)) {
        return reply.code(400).send({ error: "日期格式必須為 YYYY-MM-DD" });
      }

      try {
        const { jobId, status } = await submitBacktestJob(config);
        return reply.code(202).send({
          jobId,
          status,
          message:
            "回測任務已提交至佇列，請使用 GET /api/backtest/:jobId 查詢進度或透過 WebSocket 監聽",
        });
      } catch (err) {
        fastify.log.error({ err }, "提交回測任務失敗");
        return reply.code(500).send({ error: "提交回測任務失敗" });
      }
    },
  );

  // GET /backtest/:jobId - 查詢任務狀態/結果
  fastify.get(
    "/backtest/:jobId",
    {
      schema: {
        params: {
          type: "object",
          properties: { jobId: { type: "string" } },
          required: ["jobId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              jobId: { type: "string" },
              status: { type: "string" },
              progress: { type: "object" },
              result: { type: "object" },
              createdAt: { type: "number" },
              processedAt: { type: "number" },
              finishedAt: { type: "number" },
            },
          },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      const { jobId } = request.params;
      const status = await getJobStatus(jobId);

      if (!status) {
        return reply.code(404).send({ error: "找不到指定的任務" });
      }

      return status;
    },
  );

  // GET /backtest/queue/stats - 佇列統計
  fastify.get(
    "/backtest/queue/stats",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              waiting: { type: "number" },
              active: { type: "number" },
              completed: { type: "number" },
              failed: { type: "number" },
              delayed: { type: "number" },
            },
          },
        },
      },
    },
    async () => {
      return await getQueueStats();
    },
  );

  // DELETE /backtest/:jobId - 取消任務
  fastify.delete(
    "/backtest/:jobId",
    {
      schema: {
        params: {
          type: "object",
          properties: { jobId: { type: "string" } },
          required: ["jobId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              jobId: { type: "string" },
              cancelled: { type: "boolean" },
              message: { type: "string" },
            },
          },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      const { jobId } = request.params;
      const cancelled = await cancelJob(jobId);

      if (!cancelled) {
        return reply
          .code(404)
          .send({ error: "找不到任務或任務無法取消 (可能已在執行或已完成)" });
      }

      return { jobId, cancelled: true, message: "任務已取消" };
    },
  );

  // ============ 排程管理 API ============

  // POST /backtest/schedule - 建立排程
  fastify.post(
    "/backtest/schedule",
    {
      schema: {
        body: {
          type: "object",
          required: ["configs"],
          properties: {
            configs: {
              type: "array",
              minItems: 1,
              items: BACKTEST_CONFIG_SCHEMA,
            },
            cron: {
              type: "string",
              pattern:
                "^(\\*|[0-9\\-/,]+)\\s+(\\*|[0-9\\-/,]+)\\s+(\\*|[0-9\\-/,]+)\\s+(\\*|[0-9\\-/,]+)\\s+(\\*|[0-9\\-/,]+)$",
            },
            concurrency: {
              type: "integer",
              minimum: 1,
              maximum: 4,
              default: 1,
            },
            retry: {
              type: "object",
              properties: {
                maxAttempts: {
                  type: "integer",
                  minimum: 1,
                  maximum: 5,
                  default: 3,
                },
                backoffMs: {
                  type: "integer",
                  minimum: 1000,
                  maximum: 60000,
                  default: 5000,
                },
              },
            },
          },
        },
        response: {
          202: {
            type: "object",
            properties: {
              jobId: { type: "string" },
              status: { type: "string" },
              nextRun: { type: ["string", "null"] },
              message: { type: "string" },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      const { configs, cron, concurrency, retry } = request.body;

      // 驗證每個 config 的日期
      for (const config of configs) {
        if (config.start > config.end) {
          return reply.code(400).send({
            error: `config ${config.name || "unnamed"}: 開始日期不能晚於結束日期`,
          });
        }
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(config.start) || !dateRegex.test(config.end)) {
          return reply.code(400).send({ error: "日期格式必須為 YYYY-MM-DD" });
        }
      }

      try {
        const { jobId, status, nextRun } = await createSchedule({
          configs,
          cron,
          concurrency,
          retry,
        });
        return reply.code(202).send({
          jobId,
          status,
          nextRun,
          message: cron
            ? "排程已建立，將按 cron 表達式定時執行"
            : "一次性排程已建立，可手動觸發執行",
        });
      } catch (err) {
        fastify.log.error({ err }, "建立排程失敗");
        return reply.code(500).send({ error: "建立排程失敗" });
      }
    },
  );

  // GET /backtest/schedule/status - 查看所有排程狀態
  fastify.get(
    "/backtest/schedule/status",
    {
      schema: {
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                jobId: { type: "string" },
                status: { type: "string" },
                configs: { type: "array" },
                cron: { type: ["string", "null"] },
                concurrency: { type: "integer" },
                nextRun: { type: ["string", "null"] },
                lastRun: { type: ["string", "null"] },
                runCount: { type: "integer" },
                results: { type: "array" },
                error: { type: ["string", "null"] },
                createdAt: { type: "string" },
              },
            },
          },
        },
      },
    },
    async () => {
      return await getAllSchedules();
    },
  );

  // GET /backtest/schedule/:jobId - 查詢單一排程狀態
  fastify.get(
    "/backtest/schedule/:jobId",
    {
      schema: {
        params: {
          type: "object",
          properties: { jobId: { type: "string" } },
          required: ["jobId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              jobId: { type: "string" },
              status: { type: "string" },
              configs: { type: "array" },
              cron: { type: ["string", "null"] },
              concurrency: { type: "integer" },
              nextRun: { type: ["string", "null"] },
              lastRun: { type: ["string", "null"] },
              runCount: { type: "integer" },
              attempts: { type: "integer" },
              currentAttempt: { type: "integer" },
              results: { type: "array" },
              error: { type: ["string", "null"] },
              createdAt: { type: "string" },
            },
          },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      const { jobId } = request.params;
      const status = await getScheduleStatus(jobId);

      if (!status) {
        return reply.code(404).send({ error: "找不到指定的排程" });
      }

      return status;
    },
  );

  // POST /backtest/schedule/:jobId/trigger - 手動觸發排程
  fastify.post(
    "/backtest/schedule/:jobId/trigger",
    {
      schema: {
        params: {
          type: "object",
          properties: { jobId: { type: "string" } },
          required: ["jobId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              triggered: { type: "boolean" },
              message: { type: "string" },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      const { jobId } = request.params;
      try {
        const triggered = await triggerSchedule(jobId);
        if (!triggered) {
          return reply.code(404).send({ error: "找不到排程或排程正在執行中" });
        }
        return { triggered: true, message: "排程已手動觸發執行" };
      } catch (err) {
        if (err.message.includes("正在執行中")) {
          return reply.code(400).send({ error: err.message });
        }
        fastify.log.error({ err }, "手動觸發排程失敗");
        return reply.code(500).send({ error: "觸發排程失敗" });
      }
    },
  );

  // DELETE /backtest/schedule/:jobId - 取消排程
  fastify.delete(
    "/backtest/schedule/:jobId",
    {
      schema: {
        params: {
          type: "object",
          properties: { jobId: { type: "string" } },
          required: ["jobId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              jobId: { type: "string" },
              cancelled: { type: "boolean" },
              message: { type: "string" },
            },
          },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      const { jobId } = request.params;
      const cancelled = await cancelScheduledJob(jobId);

      if (!cancelled) {
        return reply
          .code(404)
          .send({ error: "找不到排程或排程無法取消 (可能已在執行或已完成)" });
      }

      return { jobId, cancelled: true, message: "排程已取消" };
    },
  );

  // GET /backtest/scheduler/stats - 排程器統計
  fastify.get(
    "/backtest/scheduler/stats",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              waiting: { type: "number" },
              active: { type: "number" },
              completed: { type: "number" },
              failed: { type: "number" },
              delayed: { type: "number" },
              schedules: {
                type: "object",
                properties: {
                  scheduled: { type: "number" },
                  running: { type: "number" },
                  total: { type: "integer" },
                },
              },
            },
          },
        },
      },
    },
    async () => {
      return await getSchedulerStats();
    },
  );
}

export default backtestRoutes;
