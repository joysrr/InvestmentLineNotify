import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";

import { useOfflineQueue } from "../composables/useOfflineQueue.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useOfflineQueue", () => {
  it("初始佇列為空，pendingCount 為 0", () => {
    const { queue, pendingCount } = useOfflineQueue();
    expect(queue.value).toEqual([]);
    expect(pendingCount.value).toBe(0);
  });

  it("enqueue 會將請求放入佇列，flush 後依序執行並解析", async () => {
    const { queue, pendingCount, enqueue, flush } = useOfflineQueue();

    const fn1 = vi.fn().mockResolvedValue("a");
    const fn2 = vi.fn().mockResolvedValue("b");

    const p1 = enqueue({ key: "1", fn: fn1 });
    const p2 = enqueue({ key: "2", fn: fn2 });

    expect(queue.value).toHaveLength(2);
    expect(pendingCount.value).toBe(2);

    const results = await flush();
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
    expect(results).toEqual([
      { ok: true, value: "a" },
      { ok: true, value: "b" },
    ]);
    await expect(p1).resolves.toBe("a");
    await expect(p2).resolves.toBe("b");
    expect(queue.value).toHaveLength(0);
    expect(pendingCount.value).toBe(0);
  });

  it("flush 時若請求失敗，會拒絕對應 Promise 並標記 ok=false", async () => {
    const { enqueue, flush } = useOfflineQueue();

    const error = new Error("boom");
    const p = enqueue({ key: "fail", fn: () => Promise.reject(error) });

    const results = await flush();
    expect(results).toEqual([{ ok: false, error }]);
    await expect(p).rejects.toBe(error);
  });

  it("clear 會清空佇列", () => {
    const { enqueue, clear, queue, pendingCount } = useOfflineQueue();

    enqueue({ key: "1", fn: () => Promise.resolve() });
    expect(queue.value).toHaveLength(1);

    clear();
    expect(queue.value).toHaveLength(0);
    expect(pendingCount.value).toBe(0);
  });
});
