/**
 * deployRoutes.mjs
 * 部署 API 端點
 */

import { deploymentExecutor } from "../../modules/deployment/executor.mjs";
import { createDeploymentAgentClient } from "../../modules/deployment/deploymentAgentClient.mjs";
import { adminGuard } from "../middleware/adminGuard.mjs";
import logger from "../../utils/logger.mjs";

/**
 * 註冊部署路由
 */
export default async function deployRoutes(fastify) {
  const deploymentAgent = createDeploymentAgentClient();

  // 所有部署端點都需要管理員權限
  fastify.addHook("preHandler", adminGuard);

  /**
   * POST /api/deploy - 觸發部署
   */
  fastify.post(
    "/deploy",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            rollback: { type: "boolean", default: false },
            rollbackTarget: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              jobId: { type: "string" },
              status: { type: "string" },
              skipReason: { type: "string" },
              commit: { type: "string" },
              version: { type: "object", additionalProperties: true },
              verification: { type: "object", additionalProperties: true },
            },
          },
          202: {
            type: "object",
            properties: {
              jobId: { type: "string" },
              status: { type: "string" },
            },
          },
          409: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
              existingJobId: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { rollback = false } = request.body;

        const result = await deploymentAgent.createDeployJob({ rollback });

        if (["queued", "skipped"].includes(result.status)) {
          reply.code(result.status === "queued" ? 202 : 200);
          return result;
        } else {
          reply.code(409);
          return {
            error: "Conflict",
            message: "另一個部署任務正在進行中",
            existingJobId: result.jobId,
          };
        }
      } catch (err) {
        if (err.message.includes("另一個部署任務")) {
          reply.code(409);
          return {
            error: "Conflict",
            message: err.message,
          };
        }

        logger.error({ err: err.message }, "Failed to create deploy job");
        reply.code(500);
        return { error: "Internal Server Error", message: err.message };
      }
    },
  );

  /**
   * GET /api/deploy/:jobId - 查詢部署狀態
   */
  fastify.get(
    "/deploy/:jobId",
    {
      schema: {
        params: {
          type: "object",
          properties: { jobId: { type: "string" } },
        },
        response: {
          200: {
            type: "object",
            properties: {
              jobId: { type: "string" },
              status: { type: "string" },
              startedAt: { type: "integer" },
              completedAt: { type: "integer" },
              deployPath: { type: "string" },
              steps: { type: "array" },
              logs: { type: "array" },
              exitCode: { type: "integer" },
              error: { type: "string" },
              deployTag: { type: "string" },
              skipReason: { type: "string" },
              commit: { type: "string" },
              version: { type: "object", additionalProperties: true },
              verification: { type: "object", additionalProperties: true },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { jobId } = request.params;

      const state = await deploymentAgent.getJobState(jobId);
      if (!state) {
        reply.code(404);
        return { error: "Not Found", message: "部署任務不存在" };
      }

      return state;
    },
  );

  /**
   * GET /api/deploy/:jobId/ws - WebSocket 即時日誌流
   */
  fastify.get(
    "/deploy/:jobId/ws",
    { websocket: true },
    async (connection, request) => {
      const { jobId } = request.params;

      // 驗證任務存在
      const state = await deploymentExecutor.getJobState(jobId);
      if (!state) {
        connection.socket.close(4004, "Job not found");
        return;
      }

      // 發送歷史日誌
      for (const log of state.logs || []) {
        connection.socket.send(JSON.stringify({ ...log, historical: true }));
      }

      // 訂閱即時進度
      const unsubscribe = deploymentExecutor.subscribeDeployProgress(
        jobId,
        (progress) => {
          if (connection.socket.readyState === 1) {
            // OPEN
            connection.socket.send(JSON.stringify(progress));
          }
        },
      );

      // 連線關閉時清理
      connection.socket.on("close", () => {
        unsubscribe();
      });

      // 如果任務已完成，發送完成訊息後關閉
      if (["completed", "failed", "cancelled"].includes(state.status)) {
        connection.socket.send(
          JSON.stringify({
            type: "done",
            status: state.status,
            exitCode: state.exitCode,
            error: state.error,
          }),
        );
        connection.socket.close(1000, "Deployment finished");
      }
    },
  );

  /**
   * GET /api/deploy/history - 取得部署歷史
   */
  fastify.get(
    "/deploy/history",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", default: 20 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              history: { type: "array" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { limit = 20 } = request.query;
      const history = await deploymentExecutor.getDeployHistory(limit);
      return { history };
    },
  );

  /**
   * POST /api/deploy/cancel/:jobId - 取消部署任務
   */
  fastify.post(
    "/deploy/cancel/:jobId",
    {
      schema: {
        params: {
          type: "object",
          properties: { jobId: { type: "string" } },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { jobId } = request.params;

      const cancelled = await deploymentExecutor.cancelDeployJob(jobId);
      if (!cancelled) {
        const state = await deploymentExecutor.getJobState(jobId);
        if (!state) {
          reply.code(404);
          return { error: "Not Found", message: "部署任務不存在" };
        }
        reply.code(400);
        return { error: "Bad Request", message: "只能取消排隊中的部署任務" };
      }

      return { success: true, message: "部署任務已取消" };
    },
  );
}
