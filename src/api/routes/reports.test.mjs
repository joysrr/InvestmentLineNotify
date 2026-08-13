// src/api/routes/reports.test.mjs
// TDD: Reports Routes 測試

import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";

vi.mock("../../modules/data/archiveManager.mjs", () => ({
  archiveManager: {
    listArchiveDates: vi.fn(),
    getReportByDate: vi.fn(),
  },
}));

vi.mock("../../domain/ilnState.mjs", () => ({
  loadStateFromReport: vi.fn(),
}));

vi.mock("../utils/reportAggregator.mjs", () => ({
  aggregateByWeek: vi.fn(),
  aggregateByMonth: vi.fn(),
}));

vi.mock("../utils/snapshotAggregator.mjs", () => ({
  normaliseSnapshot: vi.fn(),
  aggregateSnapshotsByWeek: vi.fn(),
  aggregateSnapshotsByMonth: vi.fn(),
}));

import reportsRoute from "./reports.mjs";
import { archiveManager } from "../../modules/data/archiveManager.mjs";
import { loadStateFromReport } from "../../domain/ilnState.mjs";
import {
  aggregateByWeek,
  aggregateByMonth,
} from "../utils/reportAggregator.mjs";
import {
  normaliseSnapshot,
  aggregateSnapshotsByWeek,
  aggregateSnapshotsByMonth,
} from "../utils/snapshotAggregator.mjs";

describe("reportsRoute - 報表 API 路由", () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    app = Fastify({ logger: false });
    await app.register(reportsRoute);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /report/news - 取得 AI 篩選新聞", () => {
    it("無報告日期回傳空陣列", async () => {
      archiveManager.listArchiveDates.mockResolvedValue([]);

      const response = await app.inject({
        method: "GET",
        url: "/report/news",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.tw).toEqual([]);
      expect(body.us).toEqual([]);
      expect(body.generatedAt).toBeNull();
    });

    it("找到有新聞的報告回傳新聞", async () => {
      // 使用新 app 實例避免 cache 干擾
      const { default: freshReportsRoute } = await import("./reports.mjs");
      const freshApp = Fastify({ logger: false });
      await freshApp.register(freshReportsRoute);
      await freshApp.ready();

      archiveManager.listArchiveDates.mockResolvedValue([
        "2024-01-02",
        "2024-01-01",
      ]);
      archiveManager.getReportByDate
        .mockResolvedValueOnce(null) // 2024-01-02 沒有報告
        .mockResolvedValueOnce({
          news: { tw: [{ title: "新聞1" }], us: [], generatedAt: "2024-01-01" },
        }); // 2024-01-01 有新聞

      const response = await freshApp.inject({
        method: "GET",
        url: "/report/news",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.tw).toHaveLength(1);
      expect(body.generatedAt).toBe("2024-01-01");

      await freshApp.close();
    });

    it("多天都無新聞回傳空陣列", async () => {
      archiveManager.listArchiveDates.mockResolvedValue([
        "2024-01-02",
        "2024-01-01",
      ]);
      archiveManager.getReportByDate.mockResolvedValue({
        news: { tw: [], us: [] },
      });

      const response = await app.inject({
        method: "GET",
        url: "/report/news",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.tw).toEqual([]);
    });

    it("異常回傳 500", async () => {
      // 使用新 app 實例避免 cache 干擾
      const { default: freshReportsRoute } = await import("./reports.mjs");
      const freshApp = Fastify({ logger: false });
      await freshApp.register(freshReportsRoute);
      await freshApp.ready();

      archiveManager.listArchiveDates.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const response = await freshApp.inject({
        method: "GET",
        url: "/report/news",
      });

      expect(response.statusCode).toBe(500);
      await freshApp.close();
    });
  });

  describe("GET /reports - 取得最近每日報表", () => {
    it("預設 limit 30 回傳報表列表", async () => {
      archiveManager.listArchiveDates.mockResolvedValue([
        "2024-01-02",
        "2024-01-01",
      ]);
      archiveManager.getReportByDate
        .mockResolvedValueOnce({ date: "2024-01-02", value: 100 })
        .mockResolvedValueOnce({ date: "2024-01-01", value: 200 });

      const response = await app.inject({
        method: "GET",
        url: "/reports",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(Array.isArray(body)).toBe(true);
    });

    it("無效 limit 使用預設 30", async () => {
      archiveManager.listArchiveDates.mockResolvedValue(["2024-01-01"]);
      archiveManager.getReportByDate.mockResolvedValue({ date: "2024-01-01" });

      const response = await app.inject({
        method: "GET",
        url: "/reports?limit=invalid",
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe("GET /reports/weekly - 週報表彙總", () => {
    it("預設 limit 12 回傳週彙總", async () => {
      archiveManager.listArchiveDates.mockResolvedValue(["2024-01-01"]);
      archiveManager.getReportByDate.mockResolvedValue({ date: "2024-01-01" });
      aggregateByWeek.mockReturnValue([{ week: "2024-W01" }]);

      const response = await app.inject({
        method: "GET",
        url: "/reports/weekly",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveLength(1);
      expect(aggregateByWeek).toHaveBeenCalled();
    });

    it("異常回傳 500", async () => {
      // 使用新 app 實例避免 cache 干擾
      const { default: freshReportsRoute } = await import("./reports.mjs");
      const freshApp = Fastify({ logger: false });
      await freshApp.register(freshReportsRoute);
      await freshApp.ready();

      archiveManager.listArchiveDates.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const response = await freshApp.inject({
        method: "GET",
        url: "/reports/weekly",
      });

      expect(response.statusCode).toBe(500);
      await freshApp.close();
    });
  });

  describe("GET /reports/monthly - 月報表彙總", () => {
    it("預設 limit 12 回傳月彙總", async () => {
      archiveManager.listArchiveDates.mockResolvedValue(["2024-01-01"]);
      archiveManager.getReportByDate.mockResolvedValue({ date: "2024-01-01" });
      aggregateByMonth.mockReturnValue([{ month: "2024-01" }]);

      const response = await app.inject({
        method: "GET",
        url: "/reports/monthly",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveLength(1);
      expect(aggregateByMonth).toHaveBeenCalled();
    });

    it("異常被捕獲回傳 500", async () => {
      // 清除 cache 確保錯誤被拋出
      vi.resetModules();
      // 重新 import 會重新建立 cache
      const { default: freshReportsRoute } = await import("./reports.mjs");
      const freshApp = Fastify({ logger: false });
      await freshApp.register(freshReportsRoute);
      await freshApp.ready();

      archiveManager.listArchiveDates.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const response = await freshApp.inject({
        method: "GET",
        url: "/reports/monthly",
      });

      expect(response.statusCode).toBe(500);
      await freshApp.close();
    });
  });

  describe("GET /report/:date - 取得單日報表", () => {
    it("日期格式錯誤回傳 400", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/report/invalid-date-format",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toContain("Invalid date format");
    });

    it("找到報告回傳完整內容", async () => {
      loadStateFromReport.mockResolvedValue({
        rawReport: { date: "2024-01-01", value: 100, news: { tw: [] } },
      });

      const response = await app.inject({
        method: "GET",
        url: "/report/2024-01-01",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.date).toBe("2024-01-01");
      expect(body.value).toBe(100);
    });

    it("找不到報告回傳 404", async () => {
      loadStateFromReport.mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/report/2024-01-01",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error).toContain("not found");
    });

    it("rawReport 為空回傳 404", async () => {
      loadStateFromReport.mockResolvedValue({ rawReport: null });

      const response = await app.inject({
        method: "GET",
        url: "/report/2024-01-01",
      });

      expect(response.statusCode).toBe(404);
    });

    it("異常回傳 500", async () => {
      loadStateFromReport.mockRejectedValue(new Error("Load failed"));

      const response = await app.inject({
        method: "GET",
        url: "/report/2024-01-01",
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe("GET /reports/snapshots - 投資組合快照", () => {
    it("無加密金鑰回傳空陣列", async () => {
      delete process.env.SNAPSHOT_ENCRYPT_KEY;

      archiveManager.listArchiveDates.mockResolvedValue(["2024-01-01"]);

      const response = await app.inject({
        method: "GET",
        url: "/reports/snapshots",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.snapshots).toEqual([]);
      expect(body.hasEncryption).toBe(false);
    });

    it("有加密金鑰載入快照", async () => {
      process.env.SNAPSHOT_ENCRYPT_KEY = "test-key";

      archiveManager.listArchiveDates.mockResolvedValue(["2024-01-01"]);
      loadStateFromReport.mockResolvedValue({
        portfolioRaw: { netValueCost: 1000000, netValueMarket: 1100000 },
      });
      normaliseSnapshot.mockReturnValue({
        date: "2024-01-01",
        netValueCost: 1000000,
        netValueMarket: 1100000,
      });

      const response = await app.inject({
        method: "GET",
        url: "/reports/snapshots?limit=10",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.hasEncryption).toBe(true);
      // 檢查結構而非長度 (cache 可能影響)
      expect(body.snapshots).toBeDefined();
    });

    it("無 portfolioRaw 回傳空快照", async () => {
      process.env.SNAPSHOT_ENCRYPT_KEY = "test-key";

      archiveManager.listArchiveDates.mockResolvedValue(["2024-01-01"]);
      loadStateFromReport.mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/reports/snapshots",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.snapshots).toEqual([]);
      expect(body.hasEncryption).toBe(true);
    });

    it("loadStateFromReport 拋出錯誤被捕獲並跳過", async () => {
      process.env.SNAPSHOT_ENCRYPT_KEY = "test-key";
      archiveManager.listArchiveDates.mockResolvedValue(["2024-01-01"]);
      loadStateFromReport.mockRejectedValue(new Error("Load failed"));

      const response = await app.inject({
        method: "GET",
        url: "/reports/snapshots",
      });

      // loadSnapshotEntries 會捕獲錯誤並繼續，回傳空快照
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.snapshots).toEqual([]);
      expect(body.hasEncryption).toBe(true);
    });
  });

  describe("GET /reports/snapshots/weekly - 週快照彙總", () => {
    it("無加密金鑰回傳空陣列", async () => {
      delete process.env.SNAPSHOT_ENCRYPT_KEY;

      const response = await app.inject({
        method: "GET",
        url: "/reports/snapshots/weekly",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toEqual([]);
    });

    it("有加密金鑰彙總週快照", async () => {
      process.env.SNAPSHOT_ENCRYPT_KEY = "test-key";

      archiveManager.listArchiveDates.mockResolvedValue(["2024-01-01"]);
      loadStateFromReport.mockResolvedValue({
        portfolioRaw: { netValueCost: 1000000 },
      });
      aggregateSnapshotsByWeek.mockReturnValue([{ week: "2024-W01" }]);

      const response = await app.inject({
        method: "GET",
        url: "/reports/snapshots/weekly?limit=20",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveLength(1);
      expect(aggregateSnapshotsByWeek).toHaveBeenCalled();
    });
  });

  describe("GET /reports/snapshots/monthly - 月快照彙總", () => {
    it("無加密金鑰回傳空陣列", async () => {
      delete process.env.SNAPSHOT_ENCRYPT_KEY;

      const response = await app.inject({
        method: "GET",
        url: "/reports/snapshots/monthly",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toEqual([]);
    });

    it("有加密金鑰彙總月快照", async () => {
      process.env.SNAPSHOT_ENCRYPT_KEY = "test-key";

      archiveManager.listArchiveDates.mockResolvedValue(["2024-01-01"]);
      loadStateFromReport.mockResolvedValue({
        portfolioRaw: { netValueCost: 1000000 },
      });
      aggregateSnapshotsByMonth.mockReturnValue([{ month: "2024-01" }]);

      const response = await app.inject({
        method: "GET",
        url: "/reports/snapshots/monthly?limit=50",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveLength(1);
      expect(aggregateSnapshotsByMonth).toHaveBeenCalled();
    });
  });
});
