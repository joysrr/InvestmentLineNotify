// src/modules/data/archiveManager.test.mjs
// TDD: Archive Manager 核心邏輯測試

import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs/promises";
// import path from "path"; // unused, removed for lint

// Mock fs/promises
vi.mock("fs/promises", () => {
  const mockWriteFile = vi.fn().mockResolvedValue(undefined);
  mockWriteFile.mockReturnValue(Promise.resolve().catch(() => {}));

  return {
    default: {
      mkdir: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn(),
      writeFile: mockWriteFile,
      readdir: vi.fn(),
      stat: vi.fn(),
      unlink: vi.fn(),
      rename: vi.fn().mockResolvedValue(undefined),
    },
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),
    writeFile: mockWriteFile,
    readdir: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn(),
    rename: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("path", () => ({
  default: {
    join: vi.fn((...args) => args.join("/")),
  },
  join: (...args) => args.join("/"),
}));

describe("archiveManager - 歸檔管理器", () => {
  let archiveManager;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    archiveManager = await import("./archiveManager.mjs");
  });

  describe("getTwDateStr - 台灣時間日期字串", () => {
    it("應回傳 YYYY-MM-DD 格式", () => {
      const result = archiveManager.getTwDateStr();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("getArchivePath - 歸檔路徑生成", () => {
    it("應生成正確路徑格式", () => {
      const path = archiveManager.getArchivePath("2024-01-15", "signals");
      expect(path).toContain("2024-01-15");
      expect(path).toContain("signals");
    });
  });

  describe("saveArchive - 存檔歸檔資料", () => {
    it("應呼叫 fs.writeFile 並回傳成功", async () => {
      const data = { test: "data" };
      const result = await archiveManager.saveArchive("2024-01-15", "signals", data);
      expect(result).toBe(true);
    });
  });

  describe("loadArchive - 載入歸檔資料", () => {
    it("檔案存在時應回傳解析後資料", async () => {
      const mockData = { signals: { RSI: 55 } };
      fs.readFile.mockResolvedValueOnce(JSON.stringify(mockData));
      const result = await archiveManager.loadArchive("2024-01-15", "signals");
      expect(result).toEqual(mockData);
    });

    it("檔案不存在時應回傳 null", async () => {
      fs.readFile.mockRejectedValueOnce({ code: "ENOENT" });
      const result = await archiveManager.loadArchive("2024-01-15", "signals");
      expect(result).toBeNull();
    });
  });

  describe("listArchives - 列出歸檔清單", () => {
    it("應回傳排序後的檔案清單", async () => {
      fs.readdir.mockResolvedValueOnce(["2024-01-15-signals.json", "2024-01-14-signals.json"]);
      const result = await archiveManager.listArchives("signals");
      expect(result).toEqual(["2024-01-15-signals.json", "2024-01-14-signals.json"]);
    });
  });

  describe("deleteArchive - 刪除歸檔", () => {
    it("應呼叫 fs.unlink 並回傳成功", async () => {
      const result = await archiveManager.deleteArchive("2024-01-15", "signals");
      expect(result).toBe(true);
    });
  });

  describe("archiveExists - 檢查歸檔是否存在", () => {
    it("存在時回傳 true", async () => {
      fs.stat.mockResolvedValueOnce({ isFile: () => true });
      const result = await archiveManager.archiveExists("2024-01-15", "signals");
      expect(result).toBe(true);
    });

    it("不存在時回傳 false", async () => {
      fs.stat.mockRejectedValueOnce({ code: "ENOENT" });
      const result = await archiveManager.archiveExists("2024-01-15", "signals");
      expect(result).toBe(false);
    });
  });

  describe("rotateArchives - 歸檔輪轉清理", () => {
    it("超過保留天數的檔案應被刪除", async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40);
      const oldDateStr = oldDate.toISOString().split("T")[0];
      fs.readdir.mockResolvedValueOnce([
        `${oldDateStr}-signals.json`,
        "2024-01-15-signals.json",
      ]);
      fs.stat.mockResolvedValue({ isFile: () => true });

      await archiveManager.rotateArchives("signals", 30);

      expect(fs.unlink).toHaveBeenCalled();
    });
  });

  describe("getArchiveRecords - 取得日期範圍歸檔記錄", () => {
    it("應回傳範圍內的記錄", async () => {
      fs.readdir.mockResolvedValueOnce([
        "2024-01-10-signals.json",
        "2024-01-15-signals.json",
        "2024-01-20-signals.json",
      ]);
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify({ date: "2024-01-10", signals: {} }))
        .mockResolvedValueOnce(JSON.stringify({ date: "2024-01-15", signals: {} }))
        .mockResolvedValueOnce(JSON.stringify({ date: "2024-01-20", signals: {} }));

      const result = await archiveManager.getArchiveRecords({
        start: "2024-01-12",
        end: "2024-01-18",
        type: "signals",
      });

      expect(result.length).toBe(1);
      expect(result[0].date).toBe("2024-01-15");
    });
  });
});
