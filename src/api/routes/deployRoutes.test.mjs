// src/api/routes/deployRoutes.test.mjs
// TDD: Deploy Routes 測試

import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";

vi.mock("../../modules/deployment/deploymentAgentClient.mjs", () => ({
  createDeploymentAgentClient: vi.fn(),
}));

vi.mock("../../modules/deployment/executor.mjs", () => ({
  deploymentExecutor: {
    createDeployJob: vi.fn(),
    getJobState: vi.fn(),
    cancelDeployJob: vi.fn(),
    getDeployHistory: vi.fn(),
    subscribeDeployProgress: vi.fn(() => vi.fn()),
  },
}));

vi.mock("../middleware/adminGuard.mjs", () => ({
  adminGuard: vi.fn(async (request, reply) => {
    // 預設通過驗證
  }),
}));

vi.mock("../../utils/logger.mjs", () => ({
  default: { error: vi.fn(), info: vi.fn() },
}));

import deployRoutes from "./deployRoutes.mjs";
import { deploymentExecutor } from "../../modules/deployment/executor.mjs";
import { createDeploymentAgentClient } from "../../modules/deployment/deploymentAgentClient.mjs";

describe("deployRoutes - 部署 API 路由", () => {
  let app;
  let agentClient;

  beforeEach(() => {
    agentClient = {
      createDeployJob: vi.fn(),
      getJobState: vi.fn(),
    };
    createDeploymentAgentClient.mockReturnValue(agentClient);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    app = Fastify({ logger: false });
    await app.register(deployRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /deploy - 觸發部署", () => {
    it("新部署回傳 202 和 jobId", async () => {
      agentClient.createDeployJob.mockResolvedValue({
        jobId: "deploy-123",
        status: "queued",
      });

      const response = await app.inject({
        method: "POST",
        url: "/deploy",
        payload: {},
      });

      expect(response.statusCode).toBe(202);
      const body = JSON.parse(response.payload);
      expect(body.jobId).toBe("deploy-123");
      expect(body.status).toBe("queued");
    });

    it("保留 Agent 回傳的版本閘門結果", async () => {
      agentClient.createDeployJob.mockResolvedValue({
        jobId: "deploy-123",
        status: "skipped",
        skipReason: "already-up-to-date",
        commit: "ef4ca31",
        version: { local: "ef4ca31", remote: "ef4ca31" },
      });

      const response = await app.inject({
        method: "POST",
        url: "/deploy",
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toMatchObject({
        status: "skipped",
        skipReason: "already-up-to-date",
        commit: "ef4ca31",
        version: { local: "ef4ca31", remote: "ef4ca31" },
      });
    });

    it("rollback 參數正確傳遞", async () => {
      agentClient.createDeployJob.mockResolvedValue({
        jobId: "deploy-123",
        status: "queued",
      });

      await app.inject({
        method: "POST",
        url: "/deploy",
        payload: { rollback: true, rollbackTarget: "v1.0.0" },
      });

      expect(agentClient.createDeployJob).toHaveBeenCalledWith({
        rollback: true,
      });
    });

    it("部署衝突回傳 409", async () => {
      agentClient.createDeployJob.mockResolvedValue({
        jobId: "existing-job",
        status: "running",
      });

      const response = await app.inject({
        method: "POST",
        url: "/deploy",
        payload: {},
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("Conflict");
      expect(body.existingJobId).toBe("existing-job");
    });

    it("異常回傳 500", async () => {
      deploymentExecutor.createDeployJob.mockRejectedValue(
        new Error("Disk full"),
      );

      const response = await app.inject({
        method: "POST",
        url: "/deploy",
        payload: {},
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe("GET /deploy/:jobId - 查詢部署狀態", () => {
    it("找到任務回傳狀態", async () => {
      agentClient.getJobState.mockResolvedValue({
        jobId: "deploy-123",
        status: "completed",
        startedAt: Date.now(),
        completedAt: Date.now(),
        exitCode: 0,
        logs: [],
      });

      const response = await app.inject({
        method: "GET",
        url: "/deploy/deploy-123",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.jobId).toBe("deploy-123");
      expect(body.status).toBe("completed");
    });

    it("找不到任務回傳 404", async () => {
      deploymentExecutor.getJobState.mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/deploy/non-existent",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("Not Found");
    });
  });

  describe("GET /deploy/history - 部署歷史", () => {
    it("回傳歷史列表", async () => {
      deploymentExecutor.getDeployHistory.mockResolvedValue([
        { jobId: "deploy-1", status: "completed" },
        { jobId: "deploy-2", status: "failed" },
      ]);

      const response = await app.inject({
        method: "GET",
        url: "/deploy/history?limit=10",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.history).toHaveLength(2);
    });
  });

  describe("POST /deploy/cancel/:jobId - 取消部署", () => {
    it("成功取消回傳 200", async () => {
      deploymentExecutor.cancelDeployJob.mockResolvedValue(true);

      const response = await app.inject({
        method: "POST",
        url: "/deploy/cancel/deploy-123",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.message).toBe("部署任務已取消");
    });

    it("找不到任務回傳 404", async () => {
      deploymentExecutor.cancelDeployJob.mockResolvedValue(false);
      deploymentExecutor.getJobState.mockResolvedValue(null);

      const response = await app.inject({
        method: "POST",
        url: "/deploy/cancel/non-existent",
      });

      expect(response.statusCode).toBe(404);
    });

    it("無法取消 (執行中) 回傳 400", async () => {
      deploymentExecutor.cancelDeployJob.mockResolvedValue(false);
      deploymentExecutor.getJobState.mockResolvedValue({
        jobId: "deploy-123",
        status: "running",
      });

      const response = await app.inject({
        method: "POST",
        url: "/deploy/cancel/deploy-123",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("Bad Request");
    });
  });
});
