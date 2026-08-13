// src/modules/data/archiveManager.test.mjs
// TDD: Archive Manager 核心邏輯測試

import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs/promises";

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

  describe("getLatestReport - 讀取最新報告", () => {
    it("有報告時應回傳解析後資料", async () => {
      const mockReport = { date: "2024-01-15", signals: { RSI: 55 } };
      fs.readdir.mockResolvedValueOnce(["2024-01-14.json", "2024-01-15.json"]);
      fs.readFile.mockResolvedValueOnce(JSON.stringify(mockReport));

      const result = await archiveManager.archiveManager.getLatestReport();
      expect(result).toEqual(mockReport);
    });

    it("無報告時應回傳 null", async () => {
      fs.readdir.mockResolvedValueOnce([]);
      const result = await archiveManager.archiveManager.getLatestReport();
      expect(result).toBeNull();
    });

    it("讀取失敗時應回傳 null", async () => {
      fs.readdir.mockRejectedValueOnce(new Error("ENOENT"));
      const result = await archiveManager.archiveManager.getLatestReport();
      expect(result).toBeNull();
    });
  });

  describe("getReportByDate - 讀取指定日期報告", () => {
    it("存在時應回傳解析後資料", async () => {
      const mockReport = { signals: { RSI: 60 } };
      fs.readFile.mockResolvedValueOnce(JSON.stringify(mockReport));

      const result = await archiveManager.archiveManager.getReportByDate("2024-01-15");
      expect(result).toEqual({ ...mockReport, date: "2024-01-15" });
    });

    it("不存在時應回傳 null", async () => {
      fs.readFile.mockRejectedValueOnce({ code: "ENOENT" });
      const result = await archiveManager.archiveManager.getReportByDate("2024-01-15");
      expect(result).toBeNull();
    });

    it("格式錯誤時應回傳 null", async () => {
      const result = await archiveManager.archiveManager.getReportByDate("invalid-date");
      expect(result).toBeNull();
    });
  });

  describe("getPreviousAdviceSummary - 取得前次 AI 建議摘要", () => {
    it("有歷史報告且含 AI 欄位時應回傳格式化摘要", async () => {
      const mockReport = {
        date: "2024-01-14",
        ai: {
          action_items: ["買入 0050", "設定停損"],
          mindset_advice: "保持耐心",
          risk_warnings: ["VIX 過高"]
        },
        signals: {
          marketStatus: "上漲",
          targetSuggestionShort: "買入"
        }
      };
      // Today is real date (2026-08-13), so 2024-01-15 is not "today" and is included
      // Latest non-today file is 2024-01-15
      fs.readdir.mockResolvedValueOnce(["2024-01-14.json", "2024-01-15.json"]);
      fs.readFile.mockResolvedValueOnce(JSON.stringify(mockReport));

      const result = await archiveManager.archiveManager.getPreviousAdviceSummary();
      // Since today is 2026-08-13, both 2024-01-14 and 2024-01-15 are not "today"
      // Latest is 2024-01-15, but the mock report has date "2024-01-14"
      // The function uses the file's dateKey, not the report's date field
      expect(result).toContain("2024-01-15"); // dateKey from filename
      expect(result).toContain("買入 0050");
      expect(result).toContain("保持耐心");
      expect(result).toContain("VIX 過高");
    });

    it("無歷史報告時應回傳空字串", async () => {
      // Only one file which is "today" (but today is 2026-08-13, so this won't match)
      // Actually need to mock a file that matches today's format
      // Since real today is 2026-08-13, we need a 2026-08-13.json file
      fs.readdir.mockResolvedValueOnce(["2026-08-13.json"]);
      const result = await archiveManager.archiveManager.getPreviousAdviceSummary();
      expect(result).toBe("");
    });

    it("AI 欄位不存在時應回傳空字串", async () => {
      fs.readdir.mockResolvedValueOnce(["2024-01-14.json", "2024-01-15.json"]);
      fs.readFile.mockResolvedValueOnce(JSON.stringify({ date: "2024-01-14", signals: {} }));
      const result = await archiveManager.archiveManager.getPreviousAdviceSummary();
      expect(result).toBe("");
    });
  });

  describe("getArchiveRecords - 取得日期範圍歸檔記錄", () => {
    it("應回傳範圍內的記錄 (由舊到新排序)", async () => {
      fs.readdir.mockResolvedValueOnce([
        "2024-01-10.json",
        "2024-01-15.json",
        "2024-01-20.json"
      ]);
      // Code filters to only 2024-01-15 (within range 2024-01-12 to 2024-01-18)
      // Then reads ONLY that one file
      fs.readFile.mockResolvedValueOnce(JSON.stringify({ date: "2024-01-15", signals: {} }));

      const result = await archiveManager.archiveManager.getArchiveRecords({
        start: "2024-01-12",
        end: "2024-01-18"
      });

      expect(result.length).toBe(1);
      expect(result[0].date).toBe("2024-01-15");
    });

    it("範圍外無資料時應回傳空陣列", async () => {
      fs.readdir.mockResolvedValueOnce(["2024-01-10.json", "2024-01-20.json"]);
      // Both filtered out, no readFile calls
      const result = await archiveManager.archiveManager.getArchiveRecords({
        start: "2024-01-12",
        end: "2024-01-18"
      });

      expect(result).toEqual([]);
    });
  });

  describe("listArchiveDates - 列出所有歷史報告日期", () => {
    it("應回傳由新到舊排序的日期陣列", async () => {
      fs.readdir.mockResolvedValueOnce(["2024-01-10.json", "2024-01-15.json", "2024-01-20.json"]);
      const result = await archiveManager.archiveManager.listArchiveDates();
      expect(result).toEqual(["2024-01-20", "2024-01-15", "2024-01-10"]);
    });

    it("無報告時應回傳空陣列", async () => {
      fs.readdir.mockRejectedValueOnce(new Error("ENOENT"));
      const result = await archiveManager.archiveManager.listArchiveDates();
      expect(result).toEqual([]);
    });
  });

  describe("getHistoricalLoan - 取得指定天數前貸款總額", () => {
    it("有資料時應回傳 totalLoan", async () => {
      fs.readdir.mockResolvedValueOnce(["2024-01-10.json", "2024-01-15.json"]);
      fs.readFile.mockResolvedValueOnce(JSON.stringify({ signals: { totalLoan: 50000 } }));

      const result = await archiveManager.archiveManager.getHistoricalLoan(5);
      expect(typeof result).toBe("number");
    });

    it("無資料時應回傳 0", async () => {
      fs.readdir.mockResolvedValueOnce([]);
      const result = await archiveManager.archiveManager.getHistoricalLoan(5);
      expect(result).toBe(0);
    });
  });

  describe("getHighsSince - 取得買入後最高價序列", () => {
    it("應回傳最高價陣列", async () => {
      const result = await archiveManager.archiveManager.getHighsSince("2024-01-15");
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getVixHistory / saveVixHistory - VIX 歷史", () => {
    it("getVixHistory 應回傳陣列", async () => {
      fs.readFile.mockResolvedValueOnce(JSON.stringify([
        { date: "2024-01-10", value: 15.5 },
        { date: "2024-01-11", value: 16.2 }
      ]));
      const result = await archiveManager.archiveManager.getVixHistory();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it("saveVixHistory 應寫入並去重", async () => {
      fs.readFile.mockResolvedValueOnce(JSON.stringify([
        { date: "2024-01-10", value: 15.5 }
      ]));
      await archiveManager.archiveManager.saveVixHistory(16.0, "2024-01-11");
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe("saveNewsLog - 新聞篩選紀錄", () => {
    it("應寫入新聞紀錄檔案", async () => {
      const articles = [{ title: "Test" }];
      await archiveManager.archiveManager.saveNewsLog(articles, "TW", { source: "test" });
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe("cleanOldArchives - 自動清理", () => {
    it("應清理超過保留期限的檔案", async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40);
      const oldDateStr = oldDate.toISOString().split("T")[0];

      fs.readdir
        .mockResolvedValueOnce([`${oldDateStr}.json`, "2024-01-15.json"]) // MARKET_HISTORY
        .mockResolvedValueOnce([`${oldDateStr}.json`, "2024-01-15.json"]) // REPORTS
        .mockResolvedValueOnce([`${oldDateStr}.json`, "2024-01-15.json"]); // NEWS_LOGS

      fs.stat.mockResolvedValue({ mtimeMs: oldDate.getTime() });

      await archiveManager.archiveManager.cleanOldArchives(30, 0);
      expect(fs.unlink).toHaveBeenCalled();
    });
  });

  describe("getStockHistory / saveStockHistory - 股價歷史", () => {
    it("getStockHistory 應回傳解析後資料", async () => {
      fs.readFile.mockResolvedValueOnce(JSON.stringify([{ date: "2024-01-15", high: 180 }]));
      const result = await archiveManager.archiveManager.getStockHistory("0050", "202401");
      expect(result).toEqual([{ date: "2024-01-15", high: 180 }]);
    });

    it("saveStockHistory 應寫入檔案", async () => {
      await archiveManager.archiveManager.saveStockHistory("0050", "202401", [{ date: "2024-01-15", high: 180 }]);
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe("saveLastBuyDate / getLastBuyDate - 最後買入日期備份", () => {
    it("saveLastBuyDate 應寫入檔案", async () => {
      await archiveManager.archiveManager.saveLastBuyDate("2024-01-15");
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it("getLastBuyDate 應回傳日期字串", async () => {
      fs.readFile.mockResolvedValueOnce(JSON.stringify({ lastBuyDate: "2024-01-15" }));
      const result = await archiveManager.archiveManager.getLastBuyDate();
      expect(result).toBe("2024-01-15");
    });

    it("無檔案時 getLastBuyDate 應回傳 null", async () => {
      fs.readFile.mockRejectedValueOnce({ code: "ENOENT" });
      const result = await archiveManager.archiveManager.getLastBuyDate();
      expect(result).toBeNull();
    });
  });

  describe("saveStrategyCache / getStrategyCache - 策略本地備份", () => {
    it("saveStrategyCache 應寫入檔案", async () => {
      await archiveManager.archiveManager.saveStrategyCache({ version: "1.0", buy: {} });
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it("getStrategyCache 應回傳策略物件", async () => {
      fs.readFile.mockResolvedValueOnce(JSON.stringify({ config: { version: "1.0" } }));
      const result = await archiveManager.archiveManager.getStrategyCache();
      expect(result).toEqual({ version: "1.0" });
    });
  });

  describe("getPbHistory / savePbHistory / appendPbHistory - PB 歷史", () => {
    it("getPbHistory 應回傳排序去重後陣列", async () => {
      fs.readFile.mockResolvedValueOnce(JSON.stringify([
        { date: "2024-01-10", pb: 1.5 },
        { date: "2024-01-11", pb: 1.6 }
      ]));
      const result = await archiveManager.archiveManager.getPbHistory();
      expect(result.length).toBe(2);
      expect(result[0].date).toBe("2024-01-10");
    });

    it("savePbHistory 應去重排序寫入", async () => {
      await archiveManager.archiveManager.savePbHistory([
        { date: "2024-01-11", pb: 1.6 },
        { date: "2024-01-10", pb: 1.5 },
        { date: "2024-01-10", pb: 1.4 } // 重複日期
      ]);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it("appendPbHistory 相同日期應回傳 false", async () => {
      fs.readFile.mockResolvedValueOnce(JSON.stringify([{ date: "2024-01-10", pb: 1.5 }]));
      const result = await archiveManager.archiveManager.appendPbHistory("2024-01-10", 1.6);
      expect(result).toBe(false);
    });

    it("appendPbHistory 新日期應回傳 true", async () => {
      fs.readFile.mockResolvedValueOnce(JSON.stringify([{ date: "2024-01-10", pb: 1.5 }]));
      const result = await archiveManager.archiveManager.appendPbHistory("2024-01-11", 1.6);
      expect(result).toBe(true);
    });
  });

  describe("getValuationGuardState / saveValuationGuardState - 估值防禦狀態", () => {
    it("getValuationGuardState 應回傳狀態物件", async () => {
      fs.readFile.mockResolvedValueOnce(JSON.stringify({ defenseLatch: true }));
      const result = await archiveManager.archiveManager.getValuationGuardState();
      expect(result).toEqual({ defenseLatch: true });
    });

    it("saveValuationGuardState 應寫入檔案", async () => {
      await archiveManager.archiveManager.saveValuationGuardState({ defenseLatch: true, latchReason: "test" });
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });
});
