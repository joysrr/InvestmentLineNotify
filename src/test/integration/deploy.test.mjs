/**
 * deploy.test.mjs
 * 部署模組整合測試
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
import { deploymentExecutor } from "../../modules/deployment/executor.mjs";
import { adminGuard } from "../../api/middleware/adminGuard.mjs";

// 設定開發環境變數
process.env.NODE_ENV = "development";
process.env.ADMIN_USER_IDS = "123456789,987654321";
process.env.DEPLOY_PATH = "/opt/data/projects/InvestmentLineNotify";
process.env.PM2_ECOSYSTEM = "ecosystem.config.js";
process.env.WEBAPP_PATH = "/opt/data/projects/InvestmentLineNotify/webapp";
process.env.BYPASS_ADMIN_GUARD = "true";

describe("Deployment Module", () => {
  beforeAll(async () => {
    // Enable test mode to skip background execution
    deploymentExecutor.setTestMode(true);

    // 確保部署目錄存在
    const { mkdir } = await import("fs/promises");
    const { resolve } = await import("path");
    const { fileURLToPath } = await import("url");
    const __dirname = resolve(
      fileURLToPath(import.meta.url),
      "../../modules/deployment",
    );
    const PROJECT_ROOT = resolve(__dirname, "../../../..");
    const DEPLOY_JOBS_DIR = resolve(PROJECT_ROOT, "data/deployment/jobs");
    const LOCK_FILE = resolve(PROJECT_ROOT, "data/deployment/deploy.lock");
    await mkdir(DEPLOY_JOBS_DIR, { recursive: true });
    await mkdir(resolve(LOCK_FILE, ".."), { recursive: true });
  });

  afterAll(async () => {
    // Disable test mode
    deploymentExecutor.setTestMode(false);

    // 強制清理鎖檔案
    const { writeFile } = await import("fs/promises");
    const { resolve } = await import("path");
    const { fileURLToPath } = await import("url");
    const __dirname = resolve(
      fileURLToPath(import.meta.url),
      "../../modules/deployment",
    );
    const PROJECT_ROOT = resolve(__dirname, "../../../..");
    const LOCK_FILE = resolve(PROJECT_ROOT, "data/deployment/deploy.lock");
    try {
      await writeFile(
        LOCK_FILE,
        JSON.stringify({ jobId: null, releasedAt: Date.now() }),
      );
    } catch {
      // ignore
    }
  });

  beforeEach(async () => {
    // 清理部署狀態
    const { getDeployHistory, cancelDeployJob } =
      await import("../../modules/deployment/executor.mjs");
    const history = await getDeployHistory(100);
    for (const job of history) {
      if (job.status === "running" || job.status === "queued") {
        await cancelDeployJob(job.jobId);
      }
    }

    // 清理鎖檔案
    const { writeFile } = await import("fs/promises");
    const { resolve } = await import("path");
    const { fileURLToPath } = await import("url");
    const __dirname = resolve(
      fileURLToPath(import.meta.url),
      "../../modules/deployment",
    );
    const PROJECT_ROOT = resolve(__dirname, "../../../..");
    const LOCK_FILE = resolve(PROJECT_ROOT, "data/deployment/deploy.lock");
    try {
      await writeFile(
        LOCK_FILE,
        JSON.stringify({ jobId: null, releasedAt: Date.now() }),
      );
    } catch {
      // 忽略錯誤
    }
  });

  describe("Admin Guard", () => {
    it("應允許開發環境繞過管理員檢查", async () => {
      const mockRequest = {
        headers: {},
        telegramUser: null,
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      // 在開發環境且 BYPASS_ADMIN_GUARD=true 時應通過
      await adminGuard(mockRequest, mockReply);
      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user.isAdmin).toBe(true);
    });

    it("應在生產環境拒絕非管理員", async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalBypass = process.env.BYPASS_ADMIN_GUARD;

      process.env.NODE_ENV = "production";
      process.env.BYPASS_ADMIN_GUARD = "false";

      // 重新載入模組
      vi.resetModules();
      const { adminGuard: prodAdminGuard } =
        await import("../../api/middleware/adminGuard.mjs");

      const mockRequest = {
        headers: {},
        telegramUser: { id: 999999999 },
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await prodAdminGuard(mockRequest, mockReply);
      expect(mockReply.code).toHaveBeenCalledWith(403);

      // 恢復環境
      process.env.NODE_ENV = originalEnv;
      process.env.BYPASS_ADMIN_GUARD = originalBypass;
    });
  });

  describe("Deployment Executor", () => {
    beforeEach(async () => {
      // 清理部署狀態
      const { getDeployHistory, cancelDeployJob } =
        await import("../../modules/deployment/executor.mjs");
      const history = await getDeployHistory(100);
      for (const job of history) {
        if (job.status === "running" || job.status === "queued") {
          await cancelDeployJob(job.jobId);
        }
      }

      // 清理鎖檔案
      const { writeFile, unlink } = await import("fs/promises");
      const { resolve } = await import("path");
      const { fileURLToPath } = await import("url");
      const __dirname = resolve(
        fileURLToPath(import.meta.url),
        "../../modules/deployment",
      );
      const PROJECT_ROOT = resolve(__dirname, "../../../..");
      const LOCK_FILE = resolve(PROJECT_ROOT, "data/deployment/deploy.lock");
      try {
        await unlink(LOCK_FILE);
      } catch {
        // 忽略錯誤
      }
    });

    it("應能建立部署任務並回傳 jobId", async () => {
      const result = await deploymentExecutor.createDeployJob({});

      expect(result).toHaveProperty("jobId");
      expect(result).toHaveProperty("status");
      expect(typeof result.jobId).toBe("string");
      expect(result.jobId.length).toBeGreaterThan(0);
    });

    it("應能查詢部署狀態", async () => {
      const result = await deploymentExecutor.createDeployJob({});
      const state = await deploymentExecutor.getJobState(result.jobId);

      expect(state).toBeDefined();
      expect(state.jobId).toBe(result.jobId);
      // In test mode, status should be completed immediately
      expect(["queued", "completed"]).toContain(state.status);
    });

    it("應能取得部署歷史", async () => {
      const history = await deploymentExecutor.getDeployHistory(10);

      expect(Array.isArray(history)).toBe(true);
    });

    it("應能取消排隊中的部署", async () => {
      // 在 test mode 下需要手動創建 queued 狀態的任務
      const { randomUUID: uuidv4 } = await import("crypto");
      const { writeFile, access } = await import("fs/promises");
      const { resolve } = await import("path");
      const { fileURLToPath } = await import("url");

      // Use the same path resolution as executor.mjs
      process.env.DEPLOY_PROJECT_ROOT =
        "/opt/data/projects/InvestmentLineNotify";
      const PROJECT_ROOT = "/opt/data/projects/InvestmentLineNotify";
      const DEPLOY_JOBS_DIR = resolve(PROJECT_ROOT, "data/deployment/jobs");

      const jobId = uuidv4();

      const state = {
        jobId,
        status: "queued",
        startedAt: Date.now(),
        completedAt: null,
        steps: [],
        logs: [],
        exitCode: null,
        error: null,
      };

      await writeFile(
        resolve(DEPLOY_JOBS_DIR, `${jobId}.json`),
        JSON.stringify(state, null, 2),
      );

      // Verify file exists
      const filePath = resolve(DEPLOY_JOBS_DIR, `${jobId}.json`);
      const exists = await access(filePath)
        .then(() => true)
        .catch(() => false);
      console.log("File exists:", exists, "at", filePath);
      console.log("DEPLOY_JOBS_DIR:", DEPLOY_JOBS_DIR);

      // Debug: check executor's DEPLOY_JOBS_DIR
      const { getJobState } =
        await import("../../modules/deployment/executor.mjs");
      const verifyState = await getJobState(jobId);
      console.log("verifyState:", verifyState);

      const cancelled = await deploymentExecutor.cancelDeployJob(jobId);

      expect(cancelled).toBe(true);

      const resultState = await deploymentExecutor.getJobState(jobId);
      expect(resultState.status).toBe("cancelled");
    });

    it("不應能取消執行中的部署", async () => {
      // 在 test mode 下，任務會立即完成，手動設定為 running 來測試
      const result = await deploymentExecutor.createDeployJob({});
      const jobId = result.jobId;

      const state = await deploymentExecutor.getJobState(jobId);
      if (state) {
        state.status = "running";
        const { writeFile } = await import("fs/promises");
        const { resolve } = await import("path");
        const { fileURLToPath } = await import("url");
        const __dirname = resolve(
          fileURLToPath(import.meta.url),
          "../../modules/deployment",
        );
        const PROJECT_ROOT = resolve(__dirname, "../../../..");
        const DEPLOY_JOBS_DIR = resolve(PROJECT_ROOT, "data/deployment/jobs");
        await writeFile(
          resolve(DEPLOY_JOBS_DIR, `${jobId}.json`),
          JSON.stringify(state, null, 2),
        );
      }

      const cancelled = await deploymentExecutor.cancelDeployJob(jobId);
      expect(cancelled).toBe(false);
    });
  });

  describe("Deploy Routes (Integration)", () => {
    it("應有部署相關路由定義", async () => {
      // 驗證路由模組可以正確匯入
      const { default: deployRoutes } =
        await import("../../api/routes/deployRoutes.mjs");
      expect(typeof deployRoutes).toBe("function");
    });
  });
});
