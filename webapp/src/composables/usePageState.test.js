import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { usePageState } from "./usePageState.js";

describe("usePageState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("初始狀態為 'empty'（無資料）", () => {
    const { state } = usePageState();
    expect(state.value).toBe("empty");
  });

  it("呼叫 run() 時，狀態先變 'loading'，完成後變 'ready'", async () => {
    const { state, run } = usePageState();
    let resolveFetch;
    const fetcher = () =>
      new Promise((res) => {
        resolveFetch = res;
      });

    const promise = run(fetcher);
    expect(state.value).toBe("loading");

    resolveFetch({ data: [1, 2, 3] });
    await promise;
    expect(state.value).toBe("ready");
  });

  it("fetcher 拋錯時，狀態變 'error'", async () => {
    const { state, run, error } = usePageState();
    const fetcher = () => Promise.reject(new Error("網路錯誤"));

    await run(fetcher).catch(() => {});
    expect(state.value).toBe("error");
    expect(error.value).toBeInstanceOf(Error);
    expect(error.value.message).toBe("網路錯誤");
  });

  it("data 為空陣列時，狀態為 'empty'", () => {
    const { state, data } = usePageState();
    data.value = [];
    expect(state.value).toBe("empty");
  });

  it("data 為非空陣列時，狀態為 'ready'", () => {
    const { state, data } = usePageState();
    data.value = [{ id: 1 }];
    expect(state.value).toBe("ready");
  });

  it("run() 完成後 error 被清除", async () => {
    const { state, run, error } = usePageState();
    let resolveFetch;
    const fetcher = () =>
      new Promise((res) => {
        resolveFetch = res;
      });

    const promise = run(fetcher);
    resolveFetch("ok");
    await promise;
    expect(error.value).toBeNull();
    expect(state.value).toBe("ready");
  });

  it("loading 時 fetcher 拋錯，狀態變 error；再次 run 成功後回到 ready", async () => {
    const { state, run, error } = usePageState();
    let resolveFetch;
    const fetcher = () =>
      new Promise((_, rej) => {
        resolveFetch = rej;
      });

    const first = run(fetcher);
    expect(state.value).toBe("loading");
    resolveFetch(new Error("網路斷線"));
    await first.catch(() => {});
    expect(state.value).toBe("error");
    expect(error.value).toBeInstanceOf(Error);

    let resolve2;
    const fetcher2 = () =>
      new Promise((res) => {
        resolve2 = res;
      });
    const second = run(fetcher2);
    expect(state.value).toBe("loading");
    resolve2({ data: [1] });
    await second;
    expect(state.value).toBe("ready");
    expect(error.value).toBeNull();
  });

  it("ready 狀態下再次 run()，狀態先回 loading，完成後回 ready", async () => {
    const { state, run, data } = usePageState();
    data.value = [{ id: 1 }];
    expect(state.value).toBe("ready");

    let resolveFetch;
    const fetcher = () =>
      new Promise((res) => {
        resolveFetch = res;
      });
    const promise = run(fetcher);
    expect(state.value).toBe("loading");
    resolveFetch([2]);
    await promise;
    expect(state.value).toBe("ready");
    expect(data.value).toEqual([2]);
  });
});
