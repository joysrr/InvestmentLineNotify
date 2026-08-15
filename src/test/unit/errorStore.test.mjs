// src/test/unit/errorStore.test.mjs
// TDD: Error Store SQLite CRUD 分支試

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Mock better-sqlite3
const mockStmt = {
  run: vi.fn().mockReturnValue({ changes: 1 }),
  all: vi.fn().mockReturnValue([]),
  get: vi.fn().mockReturnValue({ total: 0 }),
};

let lastDbInstance = null;
class MockDatabase {
  constructor() {
    lastDbInstance = this;
    this.prepare = vi.fn().mockReturnValue(mockStmt);
    this.exec = vi.fn();
    this.close = vi.fn();
  }
}

vi.mock("better-sqlite3", () => ({
  default: MockDatabase,
}));

vi.mock("fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../utils/logger.mjs", () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("errorStore - 存 SQLite CRUD 分支", () => {
  let errorStore;
  let mockLogger;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockStmt.run.mockReturnValue({ changes: 1 });
    mockStmt.all.mockReturnValue([]);
    mockStmt.get.mockReturnValue({ total: 0 });
    lastDbInstance = null;

    const loggerModule = await import("../../utils/logger.mjs");
    mockLogger = loggerModule.default;

    vi.resetModules();
    const mod = await import("../../modules/monitoring/errorStore.mjs");
    errorStore = mod.default;
  });

  afterEach(async () => {
    await errorStore.clear();
    errorStore.close();
  });

  describe("initDb - 料庫初始化", () => {
    it("應建立資料表與索引", async () => {
      await errorStore.save({ message: "test" });

      expect(lastDbInstance.exec).toHaveBeenCalled();
      const execCalls = lastDbInstance.exec.mock.calls;
      expect(execCalls.some((call) => call[0].includes("CREATE TABLE"))).toBe(
        true,
      );
      expect(execCalls.some((call) => call[0].includes("CREATE INDEX"))).toBe(
        true,
      );
    });

    it("應建立目錄", async () => {
      const { mkdir } = await import("fs/promises");
      await errorStore.save({ message: "test" });
      expect(mkdir).toHaveBeenCalled();
    });
  });

  describe("generateErrorHash - 生成", () => {
    it("相同生成相同", async () => {
      const error = {
        message: "test error",
        statusCode: 500,
        request: { url: "/api", method: "GET" },
      };
      await errorStore.save(error);
      await errorStore.save(error);

      expect(mockStmt.run).toHaveBeenCalledTimes(2);
    });

    it("不同生成不同", async () => {
      await errorStore.save({ message: "error 1", statusCode: 500 });
      await errorStore.save({ message: "error 2", statusCode: 404 });

      expect(mockStmt.run).toHaveBeenCalledTimes(2);
    });
  });

  describe("save - 存", () => {
    it("新應 INSERT", async () => {
      await errorStore.save({
        message: "New error",
        statusCode: 500,
        request: { url: "/api/test", method: "POST", body: { foo: "bar" } },
        stack: "Error stack trace",
      });

      expect(mockStmt.run).toHaveBeenCalled();
      const args = mockStmt.run.mock.calls[0];
      expect(args[0]).toBeDefined();
      expect(args[1]).toBe("New error");
      expect(args[2]).toBe("Error stack trace");
      expect(args[3]).toBe(500);
      expect(args[4]).toBe("/api/test");
      expect(args[5]).toBe("POST");
      expect(args[6]).toBe('{"foo":"bar"}');
    });

    it("現有應 UPDATE count", async () => {
      const error = { message: "Duplicate error", statusCode: 500 };
      await errorStore.save(error);
      await errorStore.save(error);

      expect(mockStmt.run).toHaveBeenCalledTimes(2);
    });

    it("少選位時使用預設值", async () => {
      await errorStore.save({ message: "Minimal error" });

      const args = mockStmt.run.mock.calls[0];
      expect(args[2]).toBeNull();
      expect(args[3]).toBe(500);
      expect(args[4]).toBeNull();
      expect(args[5]).toBeNull();
      expect(args[6]).toBeNull();
    });
  });

  describe("getAll - 取得所有", () => {
    it("應返回列表", async () => {
      const mockRows = [
        {
          id: 1,
          hash: "abc",
          message: "Error 1",
          stack: "stack1",
          status_code: 500,
          request_url: "/a",
          request_method: "GET",
          request_body: null,
          count: 2,
          first_seen: 1000,
          last_seen: 2000,
        },
      ];
      mockStmt.all.mockReturnValue(mockRows);

      const result = await errorStore.getAll(50, 0);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        message: "Error 1",
        statusCode: 500,
        count: 2,
      });
      expect(mockStmt.all).toHaveBeenCalledWith(50, 0);
    });

    it("空結果返回空列", async () => {
      mockStmt.all.mockReturnValue([]);
      const result = await errorStore.getAll();
      expect(result).toEqual([]);
    });

    it("解 requestBody JSON", async () => {
      mockStmt.all.mockReturnValue([{ request_body: '{"key":"value"}' }]);
      const result = await errorStore.getAll();
      expect(result[0].requestBody).toEqual({ key: "value" });
    });

    it("null requestBody 返回 null", async () => {
      mockStmt.all.mockReturnValue([{ request_body: null }]);
      const result = await errorStore.getAll();
      expect(result[0].requestBody).toBeNull();
    });
  });

  describe("getSince - 取得特定時間後的", () => {
    it("應查 since 之後的", async () => {
      mockStmt.all.mockReturnValue([]);
      await errorStore.getSince(1000000, 50);
      expect(mockStmt.all).toHaveBeenCalledWith(1000000, 50);
    });
  });

  describe("getStats - 取得統計", () => {
    it("應返回統計資料", async () => {
      mockStmt.get.mockReturnValueOnce({ total: 10 });
      mockStmt.all.mockReturnValueOnce([
        { status_code: 500, count: 6 },
        { status_code: 404, count: 4 },
      ]);
      mockStmt.get.mockReturnValueOnce({ count: 3 });
      mockStmt.get.mockReturnValueOnce({ count: 8 });

      const stats = await errorStore.getStats();

      expect(stats.total).toBe(10);
      expect(stats.byStatus[500]).toBe(6);
      expect(stats.byStatus[404]).toBe(4);
      expect(stats.lastHour).toBe(3);
      expect(stats.lastDay).toBe(8);
    });
  });

  describe("cleanOld - 理", () => {
    it("應除記錄並返回除數", async () => {
      mockStmt.run.mockReturnValue({ changes: 5 });
      const deleted = await errorStore.cleanOld(30);
      expect(deleted).toBe(5);
      expect(mockStmt.run).toHaveBeenCalled();
    });
  });

  describe("clear - 空所有 (試用)", () => {
    it("應清空資料表", async () => {
      await errorStore.clear();
      expect(mockStmt.run).toHaveBeenCalled();
    });
  });

  describe("close - 關閉資料庫", () => {
    it("應關閉連線並重置 db", () => {
      errorStore.close();
    });
  });
});
