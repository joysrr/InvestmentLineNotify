/**
 * backtestQueue.mjs
 * 回測 Job Queue 服務 - 支援 Bull/Redis (生產) 或 In-Memory (開發/測試)
 * 支援：非同步提交、進度追蹤、結果查詢、WebSocket 推播
 */

import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import { BacktestRunner } from "./backtestRunner.mjs";
import { archiveManager } from "../data/archiveManager.mjs";
import logger from "../../utils/logger.mjs";

// 判斷是否使用 Redis
let USE_REDIS = process.env.USE_REDIS === "true" && process.env.REDIS_URL;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let backtestQueue = null;
let redisPublisher = null;
let inMemoryJobs = new Map();

// Job 狀態對應
const JOB_STATUS = {
  WAITING: "waiting",
  ACTIVE: "active",
  COMPLETED: "completed",
  FAILED: "failed",
  DELAYED: "delayed",
};

// 進度 EventEmitter (供 WebSocket 訂閱)
const progressEmitter = new EventEmitter();

/**
 * 發布進度 (Redis 或記憶體)
 */
async function publishProgress(jobId, progress) {
  progressEmitter.emit(`progress:${jobId}`, progress);

  if (USE_REDIS && redisPublisher) {
    try {
      await redisPublisher.publish(
        `backtest:progress:${jobId}`,
        JSON.stringify(progress),
      );
    } catch (err) {
      logger.warn({ err, jobId }, "Redis 發布進度失敗");
    }
  }
}

/**
 * 建構 timeline 從報告資料
 */
function buildTimelineFromReports(reports) {
  return reports.map((r) => ({
    date: r.date,
    price0050: r.signals?.price0050 ?? r.price0050,
    price00675L: r.signals?.currentPrice ?? r.currentPrice,
    vix: r.marketState?.sentiment?.vix ?? r.VIX,
    pb: r.marketState?.valuation?.pb ?? r.rawValuation?.pb,
  }));
}

/**
 * 執行回測邏輯 (共用)
 */
async function executeBacktest({ jobId, config, updateProgress }) {
  const {
    start,
    end,
    name,
    quiet,
    disableGuards,
    buyTactical,
    buyTacticalBullish,
    disableLoanGuard,
    initialCash,
    monthlyDca,
    pledgeRatio,
    interestRate,
  } = config;

  await updateProgress({
    stage: "loading_reports",
    percent: 10,
    message: "載入歷史報告中...",
  });
  await publishProgress(jobId, {
    stage: "loading_reports",
    percent: 10,
    message: "載入歷史報告中...",
  });

  const reports = await archiveManager.getArchiveRecords({ start, end });

  if (reports.length === 0) {
    throw new Error(`找不到指定日期範圍內的報告: ${start} ~ ${end}`);
  }

  await updateProgress({
    stage: "building_timeline",
    percent: 20,
    message: `建構 timeline (${reports.length} 筆)...`,
  });
  await publishProgress(jobId, {
    stage: "building_timeline",
    percent: 20,
    message: `建構 timeline (${reports.length} 筆)...`,
  });

  const timeline = buildTimelineFromReports(reports);

  // 寫入暫存 timeline
  const fs = await import("fs/promises");
  const path = await import("path");
  const PROJECT_ROOT = process.cwd();
  const backtestDir = path.resolve(PROJECT_ROOT, "data/backtest");
  await fs.mkdir(backtestDir, { recursive: true });
  const timelinePath = path.resolve(backtestDir, `timeline_${jobId}.json`);
  await fs.writeFile(timelinePath, JSON.stringify(timeline, null, 2));

  await updateProgress({
    stage: "running_backtest",
    percent: 30,
    message: "執行回測中...",
  });
  await publishProgress(jobId, {
    stage: "running_backtest",
    percent: 30,
    message: "執行回測中...",
  });

  const runner = new BacktestRunner({
    name: name || jobId,
    quiet: quiet ?? true,
    disableGuards: disableGuards ?? true,
    buyTactical,
    buyTacticalBullish,
    disableLoanGuard,
    initialCash: initialCash ?? 0,
    monthlyDca: monthlyDca ?? 30000,
    pledgeRatio: pledgeRatio ?? 0.6,
    interestRate: interestRate ?? 0.022,
  });

  // 模擬進度更新
  const progressInterval = setInterval(async () => {
    await updateProgress({
      percent: Math.min(90, (await updateProgress({})).percent + 5),
    });
  }, 2000);

  try {
    const summary = await runner.run();
    clearInterval(progressInterval);

    await updateProgress({
      stage: "completed",
      percent: 100,
      message: "回測完成",
    });
    await publishProgress(jobId, {
      stage: "completed",
      percent: 100,
      message: "回測完成",
    });

    // 輸出 CSV 結果
    const csvPath = path.resolve(
      PROJECT_ROOT,
      `data/backtest/results_${name || jobId}_${start}_${end}.csv`,
    );
    const { results } = runner;
    const csvHeader =
      "date,netAsset,qty0050,qtyZ2,totalLoan,actualLeverage,maintenanceMargin,advice,score,signal,price0050,priceZ2";
    const csvRows = results.map((r) =>
      [
        r.date,
        r.netAsset.toFixed(0),
        r.qty0050,
        r.qtyZ2,
        r.totalLoan.toFixed(0),
        r.actualLeverage.toFixed(4),
        r.maintenanceMargin === 999 ? "" : r.maintenanceMargin.toFixed(1),
        r.advice ?? "",
        r.score ?? "",
        r.signal ?? "",
        r.price0050.toFixed(2),
        r.priceZ2.toFixed(2),
      ].join(","),
    );
    await fs.writeFile(csvPath, [csvHeader, ...csvRows].join("\n"));

    return {
      jobId,
      status: JOB_STATUS.COMPLETED,
      summary: {
        name: summary.name,
        returnPct: summary.returnPct,
        finalNetAsset: summary.finalNetAsset,
        qty0050: summary.qty0050,
        qtyZ2: summary.qtyZ2,
        totalLoan: summary.totalLoan,
        finalLeverage: summary.finalLeverage,
        minMm: summary.minMm,
        startDate: start,
        endDate: end,
        totalDays: reports.length,
      },
      csvPath,
      completedAt: new Date().toISOString(),
    };
  } catch (err) {
    clearInterval(progressInterval);
    throw err;
  }
}

/**
 * 初始化 Redis 連線 (僅生產環境)
 */
async function initRedis() {
  if (!USE_REDIS) return;

  try {
    const Bull = (await import("bull")).default;
    const { createClient } = await import("redis");

    backtestQueue = new Bull("backtest", {
      redis: REDIS_URL,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    });

    redisPublisher = createClient({ url: REDIS_URL });
    await redisPublisher.connect();

    // 註冊 Job 處理器
    backtestQueue.process(2, async (job) => {
      const { jobId, config } = job.data;
      return executeBacktest({
        jobId,
        config,
        updateProgress: (p) => job.updateProgress(p),
      });
    });

    backtestQueue.on("completed", (job, result) => {
      logger.info(
        { jobId: job.id, name: result.summary?.name },
        "回測任務完成",
      );
    });

    backtestQueue.on("failed", (job, err) => {
      logger.error({ err, jobId: job?.id }, "回測任務失敗");
    });

    logger.info("Redis Queue 已啟用");
  } catch (err) {
    logger.error({ err }, "Redis 初始化失敗，回退至記憶體模式");
    USE_REDIS = false;
  }
}

/**
 * 提交回測任務
 */
export async function submitBacktestJob(config) {
  const jobId = uuidv4();

  if (USE_REDIS && backtestQueue) {
    await backtestQueue.add("backtest", { jobId, config }, { jobId });
    return { jobId, status: JOB_STATUS.WAITING };
  }

  // 記憶體模式
  const job = {
    id: jobId,
    data: { jobId, config },
    status: JOB_STATUS.WAITING,
    progress: { stage: "waiting", percent: 0, message: "等待執行..." },
    returnvalue: null,
    timestamp: Date.now(),
    processedOn: null,
    finishedOn: null,
  };

  inMemoryJobs.set(jobId, job);

  // 非同步執行 (不阻塞)
  setImmediate(async () => {
    job.status = JOB_STATUS.ACTIVE;
    job.processedOn = Date.now();
    job.progress = { stage: "running", percent: 5, message: "開始執行..." };

    try {
      const result = await executeBacktest({
        jobId,
        config,
        updateProgress: async (p) => {
          job.progress = { ...job.progress, ...p };
          await publishProgress(jobId, job.progress);
        },
      });
      job.status = JOB_STATUS.COMPLETED;
      job.returnvalue = result;
      job.finishedOn = Date.now();
    } catch (err) {
      job.status = JOB_STATUS.FAILED;
      job.returnvalue = { error: err.message };
      job.finishedOn = Date.now();
      logger.error({ err, jobId }, "記憶體模式回測失敗");
    }
  });

  return { jobId, status: JOB_STATUS.WAITING };
}

/**
 * 查詢任務狀態
 */
export async function getJobStatus(jobId) {
  if (USE_REDIS && backtestQueue) {
    const job = await backtestQueue.getJob(jobId);
    if (!job) return null;

    const progress = await job.progress();
    const state = await job.getState();
    const result = job.returnvalue;

    return {
      jobId: job.id,
      status: state,
      progress,
      result,
      createdAt: job.timestamp,
      processedAt: job.processedOn,
      finishedAt: job.finishedOn,
    };
  }

  // 記憶體模式
  const job = inMemoryJobs.get(jobId);
  if (!job) return null;

  return {
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    result: job.returnvalue,
    createdAt: job.timestamp,
    processedAt: job.processedOn,
    finishedAt: job.finishedOn,
  };
}

/**
 * 取消任務
 */
export async function cancelJob(jobId) {
  if (USE_REDIS && backtestQueue) {
    const job = await backtestQueue.getJob(jobId);
    if (!job) return false;

    const state = await job.getState();
    if (state === "active" || state === "waiting" || state === "delayed") {
      await job.remove();
      return true;
    }
    return false;
  }

  // 記憶體模式
  const job = inMemoryJobs.get(jobId);
  if (!job) return false;

  if (job.status === JOB_STATUS.WAITING || job.status === JOB_STATUS.ACTIVE) {
    job.status = JOB_STATUS.FAILED;
    job.returnvalue = { error: "任務已取消" };
    job.finishedOn = Date.now();
    return true;
  }
  return false;
}

/**
 * 取得佇列統計
 */
export async function getQueueStats() {
  if (USE_REDIS && backtestQueue) {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      backtestQueue.getWaitingCount(),
      backtestQueue.getActiveCount(),
      backtestQueue.getCompletedCount(),
      backtestQueue.getFailedCount(),
      backtestQueue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
  }

  // 記憶體模式
  let waiting = 0,
    active = 0,
    completed = 0,
    failed = 0,
    delayed = 0;
  for (const job of inMemoryJobs.values()) {
    switch (job.status) {
      case JOB_STATUS.WAITING:
        waiting++;
        break;
      case JOB_STATUS.ACTIVE:
        active++;
        break;
      case JOB_STATUS.COMPLETED:
        completed++;
        break;
      case JOB_STATUS.FAILED:
        failed++;
        break;
      case JOB_STATUS.DELAYED:
        delayed++;
        break;
    }
  }
  return { waiting, active, completed, failed, delayed };
}

/**
 * 訂閱進度 (供 WebSocket 使用)
 */
export function subscribeProgress(jobId, callback) {
  progressEmitter.on(`progress:${jobId}`, callback);
  return () => progressEmitter.off(`progress:${jobId}`, callback);
}

/**
 * 關閉佇列 (優雅關機)
 */
export async function shutdownQueue() {
  if (USE_REDIS && backtestQueue) {
    await backtestQueue.close();
    if (redisPublisher) await redisPublisher.quit();
  }
  inMemoryJobs.clear();
  progressEmitter.removeAllListeners();
}

// 初始化
await initRedis();

export { JOB_STATUS, progressEmitter };
