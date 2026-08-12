/**
 * Backtest Scheduler - Bull in-memory queue + node-cron
 * Supports: scheduled triggers, multi-config concurrency, retry on failure, result persistence
 */

import { EventEmitter } from "events";
import cron from "node-cron";
import { v4 as uuidv4 } from "uuid";
import { submitBacktestJob, getQueueStats, shutdownQueue, getJobStatus } from "./backtestQueue.mjs";
import { writeFile, mkdir, readdir, readFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import logger from "../../utils/logger.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../../../..");
const SCHEDULED_RESULTS_DIR = resolve(PROJECT_ROOT, "data/backtest/scheduled");

// Schedule status
export const SCHEDULE_STATUS = {
  SCHEDULED: "scheduled",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
};

// Schedule storage (in-memory)
const schedules = new Map();

// Cron jobs storage
const cronJobs = new Map();

// Progress event emitter
const progressEmitter = new EventEmitter();

/**
 * Ensure result directory exists
 */
async function ensureResultDir() {
  await mkdir(SCHEDULED_RESULTS_DIR, { recursive: true });
}

/**
 * Publish schedule progress
 */
function publishScheduleProgress(scheduleId, progress) {
  progressEmitter.emit(`schedule:progress:${scheduleId}`, progress);
}

/**
 * Subscribe to schedule progress
 */
export function subscribeScheduleProgress(scheduleId, callback) {
  progressEmitter.on(`schedule:progress:${scheduleId}`, callback);
  return () => progressEmitter.off(`schedule:progress:${scheduleId}`, callback);
}

/**
 * Create schedule
 */
export async function createSchedule({ configs, cron: cronExpression, concurrency = 1, retry = { maxAttempts: 3, backoffMs: 5000 } }) {
  const scheduleId = uuidv4();

  // Validate configs
  if (!configs || !Array.isArray(configs) || configs.length === 0) {
    throw new Error("configs must be a non-empty array");
  }

  // Validate each config
  for (const config of configs) {
    if (!config.start || !config.end) {
      throw new Error("Each config must have start and end");
    }
    if (config.start > config.end) {
      throw new Error(`config ${config.name || "unnamed"}: start cannot be after end`);
    }
  }

  const schedule = {
    id: scheduleId,
    configs,
    cron: cronExpression || null,
    concurrency,
    retry,
    status: SCHEDULE_STATUS.SCHEDULED,
    createdAt: Date.now(),
    nextRun: cronExpression ? getNextCronRun(cronExpression) : null,
    lastRun: null,
    runCount: 0,
    attempts: 0,
    currentAttempt: 0,
    results: [],
    error: null,
  };

  schedules.set(scheduleId, schedule);

  // Register cron job if cron expression provided
  if (cronExpression) {
    const job = cron.schedule(cronExpression, async () => {
      await executeScheduledRun(scheduleId);
    }, {
      scheduled: true,
      timezone: "Asia/Taipei",
    });
    cronJobs.set(scheduleId, job);
  }

  logger.info({ scheduleId, configsCount: configs.length, cron: cronExpression }, "Schedule created");

  return {
    jobId: scheduleId,
    status: schedule.status,
    nextRun: schedule.nextRun,
  };
}

/**
 * Get next cron run time
 */
function getNextCronRun(cronExpression) {
  try {
    const now = new Date();
    // Simple implementation: return next minute as approximation
    // Real implementation should use cron-parser for precise calculation
    const next = new Date(now.getTime() + 60000);
    next.setSeconds(0, 0);
    return next.toISOString();
  } catch {
    return null;
  }
}

/**
 * Get schedule status
 */
export async function getScheduleStatus(scheduleId) {
  const schedule = schedules.get(scheduleId);
  if (!schedule) return null;

  // Update nextRun if cron exists
  let nextRun = schedule.nextRun;
  if (schedule.cron && schedule.status === SCHEDULE_STATUS.SCHEDULED) {
    nextRun = getNextCronRun(schedule.cron);
  }

  return {
    jobId: schedule.id,
    status: schedule.status,
    configs: schedule.configs,
    cron: schedule.cron,
    concurrency: schedule.concurrency,
    retry: schedule.retry,
    nextRun,
    lastRun: schedule.lastRun ? new Date(schedule.lastRun).toISOString() : null,
    runCount: schedule.runCount,
    attempts: schedule.attempts,
    currentAttempt: schedule.currentAttempt,
    results: schedule.results,
    error: schedule.error,
    createdAt: new Date(schedule.createdAt).toISOString(),
  };
}

/**
 * Cancel schedule
 */
export async function cancelScheduledJob(scheduleId) {
  const schedule = schedules.get(scheduleId);
  if (!schedule) return false;

  // Can only cancel scheduled status
  if (schedule.status !== SCHEDULE_STATUS.SCHEDULED) {
    return false;
  }

  // Stop cron job
  const cronJob = cronJobs.get(scheduleId);
  if (cronJob) {
    cronJob.stop();
    cronJobs.delete(scheduleId);
  }

  schedule.status = SCHEDULE_STATUS.CANCELLED;
  schedule.error = "User cancelled";

  logger.info({ scheduleId }, "Schedule cancelled");
  return true;
}

/**
 * Manually trigger schedule execution
 */
export async function triggerSchedule(scheduleId) {
  const schedule = schedules.get(scheduleId);
  if (!schedule) return false;

  if (schedule.status === SCHEDULE_STATUS.RUNNING) {
    throw new Error("Schedule is already running");
  }

  // Async execution
  setImmediate(() => executeScheduledRun(scheduleId));
  return true;
}

/**
 * Execute scheduled run
 */
async function executeScheduledRun(scheduleId) {
  const schedule = schedules.get(scheduleId);
  if (!schedule) return;

  if (schedule.status === SCHEDULE_STATUS.RUNNING) {
    logger.warn({ scheduleId }, "Schedule already running, skipping this trigger");
    return;
  }

  schedule.status = SCHEDULE_STATUS.RUNNING;
  schedule.lastRun = Date.now();
  schedule.runCount++;
  schedule.attempts = 0;
  schedule.currentAttempt = 0;
  schedule.results = [];

  publishScheduleProgress(scheduleId, {
    stage: "starting",
    percent: 0,
    message: `Starting scheduled run (${schedule.configs.length} configs)`,
  });

  // Execute each config sequentially (can be made concurrent)
  for (let i = 0; i < schedule.configs.length; i++) {
    const config = schedule.configs[i];

    if (schedule.status === SCHEDULE_STATUS.CANCELLED) {
      break;
    }

    publishScheduleProgress(scheduleId, {
      stage: "running",
      percent: Math.round((i / schedule.configs.length) * 100),
      message: `Executing config ${i + 1}/${schedule.configs.length}: ${config.name}`,
      currentConfig: config.name,
      configIndex: i,
      totalConfigs: schedule.configs.length,
    });

    let attempt = 0;
    let success = false;
    let lastError = null;

    while (attempt <= schedule.retry.maxAttempts && !success) {
      attempt++;
      schedule.currentAttempt = attempt;

      try {
        publishScheduleProgress(scheduleId, {
          stage: "running",
          percent: Math.round((i / schedule.configs.length) * 100),
          message: `Executing ${config.name} (attempt ${attempt}/${schedule.retry.maxAttempts + 1})`,
        });

        const result = await submitBacktestJob(config);

        // Wait for job completion
        let jobStatus = await waitForJobCompletion(result.jobId, scheduleId);

        if (jobStatus.status === "completed") {
          success = true;
          schedule.results.push({
            configName: config.name,
            config,
            jobId: result.jobId,
            status: "completed",
            summary: jobStatus.result?.summary,
            completedAt: Date.now(),
          });
        } else {
          throw new Error(jobStatus.result?.error || "Backtest job failed");
        }
      } catch (err) {
        lastError = err;
        logger.warn({ err: err.message, attempt, maxAttempts: schedule.retry.maxAttempts }, "Scheduled job failed, retrying");

        if (attempt <= schedule.retry.maxAttempts) {
          // Exponential backoff
          const backoff = schedule.retry.backoffMs * Math.pow(2, attempt - 1);
          await new Promise(r => setTimeout(r, backoff));
        }
      }

      if (!success) {
        schedule.results.push({
          configName: config.name,
          config,
          status: "failed",
          error: lastError?.message,
          attempts: attempt,
          failedAt: Date.now(),
        });
      }
    }

    // Determine final status
    const failedCount = schedule.results.filter(r => r.status === "failed").length;
    if (failedCount === schedule.configs.length) {
      schedule.status = SCHEDULE_STATUS.FAILED;
      schedule.error = "All configs failed";
    } else if (failedCount > 0) {
      schedule.status = SCHEDULE_STATUS.COMPLETED; // Partial success counts as completed
    } else {
      schedule.status = SCHEDULE_STATUS.COMPLETED;
    }

    // Persist results
    await persistScheduleResults(scheduleId);

    publishScheduleProgress(scheduleId, {
      stage: schedule.status === SCHEDULE_STATUS.FAILED ? "failed" : "completed",
      percent: 100,
      message: schedule.status === SCHEDULE_STATUS.FAILED
        ? "Schedule execution failed"
        : `Schedule completed (success: ${schedule.configs.length - failedCount}/${schedule.configs.length})`,
    });

    logger.info({ scheduleId, status: schedule.status, results: schedule.results.length }, "Schedule execution completed");
}
}

/**
 * Wait for job completion
 */
async function waitForJobCompletion(jobId, scheduleId, timeoutMs = 300000) {
  const startTime = Date.now();
  const pollInterval = 2000;

  return new Promise((resolve) => {
    const check = async () => {
      // Check if schedule was cancelled
      const schedule = schedules.get(scheduleId);
      if (schedule?.status === SCHEDULE_STATUS.CANCELLED) {
        return resolve({ status: "cancelled", result: { error: "Schedule cancelled" } });
      }

      const status = await getJobStatus(jobId);
      if (!status) {
        return resolve({ status: "not_found", result: { error: "Job not found" } });
      }

      if (status.status === "completed") {
        resolve({ status: "completed", result: status.result });
      } else if (status.status === "failed") {
        resolve({ status: "failed", result: status.result });
      } else if (Date.now() - startTime > timeoutMs) {
        resolve({ status: "timeout", result: { error: "Job execution timeout" } });
      } else {
        setTimeout(check, pollInterval);
      }
    };

    check();
  });
}

/**
 * Persist schedule results
 */
async function persistScheduleResults(scheduleId) {
  await ensureResultDir();

  const schedule = schedules.get(scheduleId);
  if (!schedule) return;

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `schedule_${scheduleId}_${timestamp}.json`;
  const filePath = resolve(SCHEDULED_RESULTS_DIR, fileName);

  const data = {
    jobId: scheduleId,
    cron: schedule.cron,
    configs: schedule.configs,
    status: schedule.status,
    runCount: schedule.runCount,
    lastRun: schedule.lastRun ? new Date(schedule.lastRun).toISOString() : null,
    results: schedule.results,
    error: schedule.error,
    completedAt: new Date().toISOString(),
  };

  await writeFile(filePath, JSON.stringify(data, null, 2));
  logger.info({ scheduleId, file: fileName }, "Schedule results persisted");
}

/**
 * Get all schedules
 */
export async function getAllSchedules() {
  const all = [];
  for (const [id, schedule] of schedules) {
    all.push(await getScheduleStatus(id));
  }
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Stop scheduler
 */
export function stop() {
  for (const [id, job] of cronJobs) {
    job.stop();
  }
  cronJobs.clear();
  schedules.clear();
  progressEmitter.removeAllListeners();
}

/**
 * Get scheduler stats (including schedule info)
 */
export async function getSchedulerStats() {
  const queueStats = await getQueueStats();
  const scheduledCount = Array.from(schedules.values()).filter(s => s.status === SCHEDULE_STATUS.SCHEDULED).length;
  const runningCount = Array.from(schedules.values()).filter(s => s.status === SCHEDULE_STATUS.RUNNING).length;

  return {
    ...queueStats,
    schedules: {
      scheduled: scheduledCount,
      running: runningCount,
      total: schedules.size,
    },
  };
}

export default {
  createSchedule,
  getScheduleStatus,
  cancelScheduledJob,
  triggerSchedule,
  getAllSchedules,
  stop,
  getSchedulerStats,
  subscribeScheduleProgress,
  SCHEDULE_STATUS,
};
