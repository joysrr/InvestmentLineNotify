import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  acquireLock,
  releaseLock,
  isProcessAlive,
  DEPLOY_LOCK_TTL_MS,
  getLockFile,
  executeDeploy,
  DEPLOY_STATUS,
  getJobState,
} from "./executor.mjs";

describe("Deployment Lock and Stale Recovery", () => {
  let testDir;

  beforeEach(async () => {
    testDir = resolve(
      tmpdir(),
      `deploy-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    process.env.DEPLOY_PROJECT_ROOT = testDir;
    await mkdir(resolve(testDir, "data/deployment"), { recursive: true });
  });

  afterEach(async () => {
    delete process.env.DEPLOY_PROJECT_ROOT;
    await rm(testDir, { recursive: true, force: true });
  });

  it("isProcessAlive accurately detects current process and non-existent pid", () => {
    expect(isProcessAlive(process.pid)).toBe(true);
    // PID 9999999 is almost certainly non-existent
    expect(isProcessAlive(99999999)).toBe(false);
    expect(isProcessAlive(null)).toBe(false);
    expect(isProcessAlive(undefined)).toBe(false);
  });

  it("acquireLock records pid and acquiredAt", async () => {
    const lock = await acquireLock("job-123");
    expect(lock.jobId).toBe("job-123");
    expect(lock.pid).toBe(process.pid);
    expect(typeof lock.acquiredAt).toBe("number");

    const lockContent = JSON.parse(await readFile(getLockFile(), "utf8"));
    expect(lockContent.jobId).toBe("job-123");
    expect(lockContent.pid).toBe(process.pid);
  });

  it("acquireLock automatically reclaims stale lock when TTL exceeded", async () => {
    // Write an expired lock (> 15 minutes ago) with dead PID
    const expiredTime = Date.now() - DEPLOY_LOCK_TTL_MS - 5000;
    await writeFile(
      getLockFile(),
      JSON.stringify({
        jobId: "old-stale-job",
        pid: 99999999,
        acquiredAt: expiredTime,
      }),
    );

    // acquireLock should succeed and reclaim the lock
    const lock = await acquireLock("new-job-456");
    expect(lock.jobId).toBe("new-job-456");

    const currentLock = JSON.parse(await readFile(getLockFile(), "utf8"));
    expect(currentLock.jobId).toBe("new-job-456");
  });

  it("acquireLock automatically reclaims orphan lock when process PID is dead", async () => {
    // Write a lock acquired recently but with a dead PID
    const recentTime = Date.now() - 1000;
    await writeFile(
      getLockFile(),
      JSON.stringify({
        jobId: "crashed-job",
        pid: 99999999,
        acquiredAt: recentTime,
      }),
    );

    // acquireLock should detect dead PID and reclaim
    const lock = await acquireLock("fresh-job-789");
    expect(lock.jobId).toBe("fresh-job-789");

    const currentLock = JSON.parse(await readFile(getLockFile(), "utf8"));
    expect(currentLock.jobId).toBe("fresh-job-789");
  });

  it("acquireLock rejects when lock is actively held by a running process within TTL", async () => {
    // Current process is alive!
    await writeFile(
      getLockFile(),
      JSON.stringify({
        jobId: "active-job",
        pid: process.pid,
        acquiredAt: Date.now(),
      }),
    );

    await expect(acquireLock("another-job")).rejects.toThrow(
      "另一個部署任務正在進行中: active-job",
    );
  });

  it("executeDeploy gracefully catches lock acquisition failure without crashing and records failed state", async () => {
    // Actively hold lock
    await writeFile(
      getLockFile(),
      JSON.stringify({
        jobId: "active-job",
        pid: process.pid,
        acquiredAt: Date.now(),
      }),
    );

    // Attempting to execute deploy with another job should return failed state, not unhandled exception
    const state = await executeDeploy("blocked-job", { testMode: true });
    expect(state.status).toBe(DEPLOY_STATUS.FAILED);
    expect(state.error).toContain("另一個部署任務正在進行中");
    expect(state.exitCode).toBe(1);

    const savedState = await getJobState("blocked-job");
    expect(savedState.status).toBe(DEPLOY_STATUS.FAILED);
    expect(savedState.error).toContain("另一個部署任務正在進行中");
  });
});
