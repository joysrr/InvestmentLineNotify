/**
 * executor.mjs
 * 部署執行器 - 核心部署邏輯、WebSocket 推播、狀態持久化
 */

import { EventEmitter } from "events";
import { spawn } from "child_process";
import { writeFile, mkdir, readFile, readdir } from "fs/promises";
import { resolve } from "path";
import logger from "../../utils/logger.mjs";
import { randomUUID as uuidv4 } from "crypto";
import { buildDeploymentVerification } from "./deploymentVerification.mjs";
import { buildVerificationCommands } from "./deploymentVerificationCommands.mjs";
import {
  buildVersionCheckCommands,
  shouldSkipDeployment,
} from "./deploymentVersionGate.mjs";

// Lock TTL: 15 minutes max for deployment lock
export const DEPLOY_LOCK_TTL_MS = 15 * 60 * 1000;

/**
 * 檢查進程是否仍然存活
 */
export function isProcessAlive(pid) {
  if (!pid || typeof pid !== "number" || isNaN(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return false;
  }
}

// Use process.cwd() as project root for consistency across test/prod
// Dynamic functions to allow test-time override via DEPLOY_PROJECT_ROOT env var
export function getProjectRoot() {
  return process.env.DEPLOY_PROJECT_ROOT || resolve(process.cwd(), "..");
}

export function getDeployJobsDir() {
  return resolve(getProjectRoot(), "data/deployment/jobs");
}

export function getLockFile() {
  return resolve(getProjectRoot(), "data/deployment/deploy.lock");
}

// Deployment status
export const DEPLOY_STATUS = {
  QUEUED: "queued",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  SKIPPED: "skipped",
  CANCELLED: "cancelled",
  ROLLING_BACK: "rolling_back",
};

// Progress event emitter
const progressEmitter = new EventEmitter();

// Lock state
let _isLocked = false;

// Test mode flag to skip background execution
let testMode = false;

export function setTestMode(enabled) {
  testMode = enabled;
}

/**
 * 確保部署目錄存在
 */
async function ensureDeployDirs() {
  await mkdir(getDeployJobsDir(), { recursive: true });
  await mkdir(resolve(getLockFile(), ".."), { recursive: true });
}

/**
 * 取得部署鎖
 */
export async function acquireLock(jobId) {
  await ensureDeployDirs();

  // 檢查現有鎖
  try {
    const lockContent = await readFile(getLockFile(), "utf8");
    const lock = JSON.parse(lockContent);
    if (lock.jobId && lock.jobId !== jobId) {
      // 檢查是否為過期鎖（超過 TTL）或孤兒鎖（進程已不存在）
      const isStaleByTtl =
        lock.acquiredAt && Date.now() - lock.acquiredAt > DEPLOY_LOCK_TTL_MS;
      const isOrphanByPid = lock.pid && !isProcessAlive(lock.pid);

      if (!isStaleByTtl && !isOrphanByPid) {
        throw new Error(`另一個部署任務正在進行中: ${lock.jobId}`);
      }
      logger.warn(
        {
          previousJobId: lock.jobId,
          isStaleByTtl,
          isOrphanByPid,
          acquiredAt: lock.acquiredAt,
        },
        "Detected stale/orphan deployment lock. Automatically reclaiming lock.",
      );
    }
  } catch (err) {
    if (
      err.code !== "ENOENT" &&
      !err.message.startsWith("另一個部署任務正在進行中")
    ) {
      logger.warn(
        { err: err.message },
        "Failed to read lock file, assuming clear",
      );
    } else if (err.message.startsWith("另一個部署任務正在進行中")) {
      throw err;
    }
  }

  // 建立鎖 (包含 process.pid)
  const lockData = { jobId, pid: process.pid, acquiredAt: Date.now() };
  await writeFile(getLockFile(), JSON.stringify(lockData));
  _isLocked = true;
  return lockData;
}

/**
 * 釋放部署鎖
 */
export async function releaseLock(jobId) {
  try {
    const lockContent = await readFile(getLockFile(), "utf8");
    const lock = JSON.parse(lockContent);
    if (lock.jobId === jobId) {
      await writeFile(
        getLockFile(),
        JSON.stringify({ jobId: null, releasedAt: Date.now() }),
      );
      _isLocked = false;
    }
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}

/**
 * 發布部署進度
 */
function publishDeployProgress(jobId, progress) {
  progressEmitter.emit(`deploy:progress:${jobId}`, progress);
}

/**
 * 訂閱部署進度
 */
export function subscribeDeployProgress(jobId, callback) {
  progressEmitter.on(`deploy:progress:${jobId}`, callback);
  return () => progressEmitter.off(`deploy:progress:${jobId}`, callback);
}

/**
 * 儲存任務狀態
 */
async function saveJobState(jobId, state) {
  await ensureDeployDirs();
  const filePath = resolve(getDeployJobsDir(), `${jobId}.json`);
  await writeFile(filePath, JSON.stringify(state, null, 2));
}

/**
 * 讀取任務狀態
 */
export async function getJobState(jobId) {
  try {
    const filePath = resolve(getDeployJobsDir(), `${jobId}.json`);
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

/**
 * 取得部署歷史
 */
export async function getDeployHistory(limit = 20) {
  await ensureDeployDirs();
  const files = await readdir(getDeployJobsDir());
  const jobs = [];

  for (const file of files) {
    if (file.endsWith(".json")) {
      try {
        const content = await readFile(
          resolve(getDeployJobsDir(), file),
          "utf8",
        );
        jobs.push(JSON.parse(content));
      } catch {
        // 忽略無法解析的檔案
      }
    }
  }

  return jobs.sort((a, b) => b.startedAt - a.startedAt).slice(0, limit);
}

export function buildNpmCiArgs() {
  return ["ci", "--include=dev"];
}

export function getBackendBuildArgs(packageJson) {
  return packageJson?.scripts?.build ? ["run", "build"] : null;
}

export function buildFrontendPermissionArgs() {
  return ["-R", "a+rX", "dist"];
}

export function buildFrontendPermissionStep(webappPath) {
  return {
    command: "chmod",
    args: buildFrontendPermissionArgs(),
    cwd: webappPath,
  };
}

/**
 * 執行部署
 */
export async function executeDeploy(jobId, options = {}) {
  const projectRoot = getProjectRoot();
  const {
    deployPath = process.env.DEPLOY_PATH || projectRoot,
    pm2Ecosystem = process.env.PM2_ECOSYSTEM || "ecosystem.config.js",
    webappPath = process.env.WEBAPP_PATH || resolve(projectRoot, "webapp"),
    rollback = false,
    rollbackTarget = null,
  } = options;

  const state = {
    jobId,
    status: DEPLOY_STATUS.RUNNING,
    startedAt: Date.now(),
    completedAt: null,
    deployPath,
    webappPath,
    pm2Ecosystem,
    rollback,
    rollbackTarget,
    steps: [],
    logs: [],
    exitCode: null,
    error: null,
  };

  await saveJobState(jobId, state);

  const addLog = (level, message) => {
    const log = { timestamp: Date.now(), level, message };
    state.logs.push(log);
    publishDeployProgress(jobId, { ...log, jobId });
  };

  try {
    // 取得部署鎖
    await acquireLock(jobId);
  } catch (lockErr) {
    state.status = DEPLOY_STATUS.FAILED;
    state.completedAt = Date.now();
    state.error = lockErr.message;
    state.exitCode = 1;
    addLog("error", `無法取得部署鎖: ${lockErr.message}`);
    await saveJobState(jobId, state);
    return state;
  }

  const runStep = async (name, command, args, cwd, env = {}) => {
    const stepStart = Date.now();
    addLog("info", `[${name}] 開始: ${command} ${args.join(" ")}`);

    state.steps.push({
      name,
      command,
      args,
      cwd,
      startedAt: stepStart,
      completedAt: null,
      exitCode: null,
      success: false,
    });

    const stepIndex = state.steps.length - 1;

    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        env: { ...process.env, ...env },
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        const text = data.toString();
        stdout += text;
        // 即時推播每行日誌
        for (const line of text.trim().split("\n")) {
          if (line) addLog("info", `[${name}] ${line}`);
        }
      });

      child.stderr?.on("data", (data) => {
        const text = data.toString();
        stderr += text;
        for (const line of text.trim().split("\n")) {
          if (line) addLog("warn", `[${name}] ${line}`);
        }
      });

      child.on("close", (code) => {
        const completedAt = Date.now();
        const step = state.steps[stepIndex];
        step.completedAt = completedAt;
        step.exitCode = code;
        step.success = code === 0;
        step.stdout = stdout;
        step.stderr = stderr;

        if (code === 0) {
          addLog("info", `[${name}] 完成 (耗時 ${completedAt - stepStart}ms)`);
          resolve({ stdout, stderr });
        } else {
          addLog("error", `[${name}] 失敗 (exit code: ${code})`);
          reject(
            new Error(`${name} 失敗 (exit code: ${code}): ${stderr || stdout}`),
          );
        }
      });

      child.on("error", (err) => {
        addLog("error", `[${name}] 啟動失敗: ${err.message}`);
        reject(err);
      });
    });
  };

  try {
    // 步驟 1: Git 拉取最新代碼
    if (!rollback) {
      await runStep("git-fetch", "git", ["fetch", "--all"], deployPath);

      const versionCommands = buildVersionCheckCommands();
      const localVersion = await runStep(
        "git-version-local",
        versionCommands.local[0],
        versionCommands.local[1],
        deployPath,
      );
      const remoteVersion = await runStep(
        "git-version-remote",
        versionCommands.remote[0],
        versionCommands.remote[1],
        deployPath,
      );
      const versionGate = shouldSkipDeployment(
        localVersion.stdout.trim(),
        remoteVersion.stdout.trim(),
      );
      state.version = {
        local: localVersion.stdout.trim(),
        remote: remoteVersion.stdout.trim(),
      };
      if (versionGate.skip) {
        const permissionStep = buildFrontendPermissionStep(webappPath);
        await runStep(
          "chmod-frontend-dist",
          permissionStep.command,
          permissionStep.args,
          permissionStep.cwd,
        );
        state.status = DEPLOY_STATUS.SKIPPED;
        state.skipReason = versionGate.reason;
        state.commit = versionGate.commit;
        state.completedAt = Date.now();
        state.exitCode = 0;
        addLog("info", `部署略過：版本已是最新 (${versionGate.commit})`);
        return state;
      }

      await runStep(
        "git-reset",
        "git",
        ["reset", "--hard", "origin/main"],
        deployPath,
      );
    } else {
      // 回滾模式
      const targetTag = rollbackTarget || (await getLastDeployTag());
      if (!targetTag) throw new Error("找不到可回滾的部署標籤");

      await runStep("git-fetch-tags", "git", ["fetch", "--tags"], deployPath);
      await runStep(
        "git-checkout-tag",
        "git",
        ["checkout", targetTag],
        deployPath,
      );
    }

    // 步驟 2: 後端依賴安裝；部署需要 devDependencies（包含 Husky prepare）
    await runStep("npm-ci-backend", "npm", buildNpmCiArgs(), deployPath);

    // 步驟 3: 後端建置（僅在後端宣告 build script 時執行）
    const backendPackageJson = JSON.parse(
      await readFile(resolve(deployPath, "package.json"), "utf8"),
    );
    const backendBuildArgs = getBackendBuildArgs(backendPackageJson);
    if (backendBuildArgs) {
      await runStep("npm-build-backend", "npm", backendBuildArgs, deployPath);
    }

    // 步驟 4: 前端依賴安裝；Vite plugin 位於 devDependencies
    await runStep("npm-ci-frontend", "npm", buildNpmCiArgs(), webappPath);

    // 步驟 5: 前端建置
    await runStep("npm-build-frontend", "npm", ["run", "build"], webappPath);

    // 步驟 6: 公開前端產物需可由 Nginx worker 讀取
    await runStep(
      "chmod-frontend-dist",
      "chmod",
      buildFrontendPermissionArgs(),
      resolve(webappPath),
    );

    // 步驟 7: PM2 重啟服務
    await runStep(
      "pm2-reload",
      "pm2",
      ["reload", pm2Ecosystem, "--update-env"],
      deployPath,
    );

    // 步驟 7: 驗證 commit、PM2 與 API health
    const verificationCommands = buildVerificationCommands();
    const commitResult = await runStep(
      "verify-commit",
      verificationCommands.commit[0],
      verificationCommands.commit[1],
      deployPath,
    );
    const pm2Result = await runStep(
      "verify-pm2",
      verificationCommands.pm2[0],
      verificationCommands.pm2[1],
      deployPath,
    );
    const healthResult = await runStep(
      "verify-health",
      verificationCommands.health[0],
      verificationCommands.health[1],
      deployPath,
    );
    state.verification = buildDeploymentVerification({
      commit: commitResult.stdout.trim(),
      pm2: pm2Result.stdout,
      health: healthResult.stdout,
      expectedCwd: deployPath,
      expectedProcesses: ["api-server", "bot-daemon"],
    });
    if (!state.verification.ok) {
      throw new Error("部署後驗證失敗");
    }

    // 步驟 8: 打標籤記錄部署版本
    if (!rollback) {
      const tagName = `deploy-${new Date().toISOString().replace(/[:.]/g, "-")}`;
      await runStep("git-tag", "git", ["tag", tagName], deployPath);
      state.deployTag = tagName;
    }

    // 完成
    state.status = DEPLOY_STATUS.COMPLETED;
    state.completedAt = Date.now();
    state.exitCode = 0;

    addLog("info", `部署${rollback ? "回滾" : ""}成功完成`);
  } catch (err) {
    state.status = DEPLOY_STATUS.FAILED;
    state.completedAt = Date.now();
    state.error = err.message;
    state.exitCode = 1;

    addLog("error", `部署失敗: ${err.message}`);

    // 發送 Telegram 通知
    await sendFailureNotification(jobId, state, err.message);
  } finally {
    await saveJobState(jobId, state);
    await releaseLock(jobId);
  }

  return state;
}

/**
 * 取得最後一個部署標籤
 */
async function getLastDeployTag() {
  try {
    const projectRoot = getProjectRoot();
    const { stdout } = await new Promise((resolve, reject) => {
      const child = spawn(
        "git",
        ["tag", "-l", "deploy-*", "--sort=-creatordate"],
        {
          cwd: process.env.DEPLOY_PATH || projectRoot,
        },
      );
      let stdout = "";
      child.stdout.on("data", (data) => (stdout += data.toString()));
      child.on("close", (code) =>
        code === 0 ? resolve({ stdout }) : reject(new Error("Git tag failed")),
      );
      child.on("error", reject);
    });

    const tags = stdout.trim().split("\n").filter(Boolean);
    return tags[0] || null;
  } catch {
    return null;
  }
}

/**
 * 發送失敗通知
 */
async function sendFailureNotification(jobId, state, errorMessage) {
  try {
    const { sendTelegramMessage } =
      await import("../telegram/notify.mjs").catch(() => ({
        sendTelegramMessage: null,
      }));

    if (
      sendTelegramMessage &&
      process.env.TELEGRAM_BOT_TOKEN &&
      process.env.ADMIN_USER_IDS
    ) {
      const adminIds = process.env.ADMIN_USER_IDS.split(",").map((id) =>
        id.trim(),
      );
      const message = `🚨 部署失敗\nJob ID: ${jobId}\n時間: ${new Date(state.startedAt).toISOString()}\n錯誤: ${errorMessage}\n部署路徑: ${state.deployPath}`;

      for (const adminId of adminIds) {
        await sendTelegramMessage(adminId, message).catch((err) => {
          logger.error(
            { err: err.message },
            "Failed to send Telegram deployment failure notification",
          );
        });
      }
    }
  } catch (err) {
    logger.error({ err: err.message }, "Failed to send failure notification");
  }
}

/**
 * 建立部署任務
 */
export async function createDeployJob(options = {}) {
  const jobId = uuidv4();

  const state = {
    jobId,
    status: DEPLOY_STATUS.QUEUED,
    startedAt: Date.now(),
    completedAt: null,
    ...options,
    steps: [],
    logs: [],
    exitCode: null,
    error: null,
  };

  await saveJobState(jobId, state);

  // 非同步執行部署（鎖在 executeDeploy 中取得） - test mode 時不啟動背景任務
  if (!testMode) {
    setImmediate(() => executeDeploy(jobId, options));
  } else {
    // Test mode: immediately mark as completed
    state.status = DEPLOY_STATUS.COMPLETED;
    state.completedAt = Date.now();
    state.exitCode = 0;
    await saveJobState(jobId, state);
  }

  return { jobId, status: state.status };
}

/**
 * 取消部署任務
 */
export async function cancelDeployJob(jobId) {
  const state = await getJobState(jobId);
  if (!state) return false;

  if (state.status !== DEPLOY_STATUS.QUEUED) {
    return false; // 只能取消排隊中的任務
  }

  state.status = DEPLOY_STATUS.CANCELLED;
  state.completedAt = Date.now();
  state.error = "User cancelled";

  await saveJobState(jobId, state);
  await releaseLock(jobId);

  return true;
}

export const deploymentExecutor = {
  executeDeploy,
  createDeployJob,
  cancelDeployJob,
  getJobState,
  getDeployHistory,
  subscribeDeployProgress,
  DEPLOY_STATUS,
  setTestMode,
  acquireLock,
  releaseLock,
  isProcessAlive,
  DEPLOY_LOCK_TTL_MS,
  getLockFile,
  getProjectRoot,
  getDeployJobsDir,
};

export default deploymentExecutor;
