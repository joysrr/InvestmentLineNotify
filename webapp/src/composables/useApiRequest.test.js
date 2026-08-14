import { describe, it, expect, vi, beforeEach } from "vitest";
import { nextTick } from "vue";
import { useApiRequest, useApiRequestBatch } from "./useApiRequest.js";
import { ElMessage } from "element-plus";

// Mock Element Plus
vi.mock("element-plus", () => ({
  ElMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("useApiRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("初始狀態", () => {
    const mockApi = vi.fn();
    const { loading, error, data } = useApiRequest(mockApi);

    expect(loading.value).toBe(false);
    expect(error.value).toBe(null);
    expect(data.value).toBe(null);
  });

  it("成功請求更新 data", async () => {
    const mockApi = vi.fn().mockResolvedValue({ id: 1, name: "test" });
    const { loading, error, data, execute } = useApiRequest(mockApi);

    await execute();

    expect(loading.value).toBe(false);
    expect(error.value).toBe(null);
    expect(data.value).toEqual({ id: 1, name: "test" });
    expect(mockApi).toHaveBeenCalledOnce();
  });

  it("請求中 loading 為 true", async () => {
    const mockApi = vi.fn(
      () => new Promise((resolve) => setTimeout(() => resolve("ok"), 100))
    );
    const { loading, execute } = useApiRequest(mockApi);

    const promise = execute();
    await nextTick();

    expect(loading.value).toBe(true);

    await promise;
    expect(loading.value).toBe(false);
  });

  it("失敗請求更新 error 並顯示錯誤訊息", async () => {
    const mockError = new Error("Network error");
    const mockApi = vi.fn().mockRejectedValue(mockError);
    const { loading, error, data, execute } = useApiRequest(mockApi);

    try {
      await execute();
    } catch (e) {
      // 預期會拋出錯誤
    }

    expect(loading.value).toBe(false);
    expect(error.value).toBe(mockError);
    expect(data.value).toBe(null);
    expect(ElMessage.error).toHaveBeenCalled();
  });

  it("showSuccessMessage=true 時顯示成功訊息", async () => {
    const mockApi = vi.fn().mockResolvedValue("ok");
    const { execute } = useApiRequest(mockApi, {
      showSuccessMessage: true,
      successMessage: "操作成功",
    });

    await execute();

    expect(ElMessage.success).toHaveBeenCalledWith("操作成功");
  });

  it("showErrorMessage=false 時不顯示錯誤訊息", async () => {
    const mockApi = vi.fn().mockRejectedValue(new Error("fail"));
    const { execute } = useApiRequest(mockApi, {
      showErrorMessage: false,
    });

    try {
      await execute();
    } catch (e) {
      // ignore
    }

    expect(ElMessage.error).not.toHaveBeenCalled();
  });

  it("onSuccess 回調被呼叫", async () => {
    const onSuccess = vi.fn();
    const mockApi = vi.fn().mockResolvedValue({ result: "ok" });
    const { execute } = useApiRequest(mockApi, { onSuccess });

    await execute();

    expect(onSuccess).toHaveBeenCalledWith({ result: "ok" });
  });

  it("onError 回調被呼叫", async () => {
    const onError = vi.fn();
    const mockError = new Error("fail");
    const mockApi = vi.fn().mockRejectedValue(mockError);
    const { execute } = useApiRequest(mockApi, { onError });

    try {
      await execute();
    } catch (e) {
      // ignore
    }

    expect(onError).toHaveBeenCalledWith(mockError);
  });

  it("execute 接受參數並傳遞給 apiFunc", async () => {
    const mockApi = vi.fn().mockResolvedValue("ok");
    const { execute } = useApiRequest(mockApi);

    await execute("arg1", "arg2");

    expect(mockApi).toHaveBeenCalledWith("arg1", "arg2");
  });

  it("reset 清空狀態", async () => {
    const mockApi = vi.fn().mockResolvedValue("data");
    const { loading, error, data, execute, reset } = useApiRequest(mockApi);

    await execute();
    expect(data.value).toBe("data");

    reset();

    expect(loading.value).toBe(false);
    expect(error.value).toBe(null);
    expect(data.value).toBe(null);
  });
});

describe("useApiRequestBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("並行執行多個請求", async () => {
    const api1 = vi.fn().mockResolvedValue("result1");
    const api2 = vi.fn().mockResolvedValue("result2");
    const api3 = vi.fn().mockResolvedValue("result3");

    const { dataList, executeAll } = useApiRequestBatch([api1, api2, api3]);

    await executeAll();

    expect(dataList.value).toEqual(["result1", "result2", "result3"]);
    expect(api1).toHaveBeenCalledOnce();
    expect(api2).toHaveBeenCalledOnce();
    expect(api3).toHaveBeenCalledOnce();
  });

  it("部分請求失敗時顯示警告", async () => {
    const api1 = vi.fn().mockResolvedValue("ok");
    const api2 = vi.fn().mockRejectedValue(new Error("fail"));
    const api3 = vi.fn().mockResolvedValue("ok2");

    const { dataList, errors, executeAll } = useApiRequestBatch([
      api1,
      api2,
      api3,
    ]);

    await executeAll();

    expect(dataList.value[0]).toBe("ok");
    expect(dataList.value[1]).toBe(null);
    expect(dataList.value[2]).toBe("ok2");
    expect(errors.value[1]).toBeInstanceOf(Error);
    expect(ElMessage.warning).toHaveBeenCalledWith("1 個請求失敗");
  });

  it("reset 清空狀態", async () => {
    const api1 = vi.fn().mockResolvedValue("ok");
    const { dataList, executeAll, reset } = useApiRequestBatch([api1]);

    await executeAll();
    expect(dataList.value).toEqual(["ok"]);

    reset();

    expect(dataList.value).toEqual([]);
  });
});
