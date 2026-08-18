// src/modules/simulator/dataAdapter.test.mjs
// TDD: 先寫測試再實作

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs/promises";
import path from "path";
import {
  buildSimulationInput,
  getValidatedLatestReport,
  getStockHistoryCached,
  clearHistoryCache,
  getCacheStats,
  checkHistoryCompleteness,
  mergeMonthlyHistory,
  replaceLastCandle,
  computeMA240WithFallback,
} from "./dataAdapter.mjs";
import { archiveManager } from "../data/archiveManager.mjs";
import { calculateIndicators } from "../strategy/indicators.mjs";

// Mock fs.stat for cache mtime check
vi.mock("fs/promises", () => ({
  default: {
    stat: vi.fn(),
  },
  stat: vi.fn(),
}));

// Mock archiveManager
vi.mock("../data/archiveManager.mjs", () => ({
  archiveManager: {
    getLatestReport: vi.fn(),
    getStockHistory: vi.fn(),
  },
}));

// Mock calculateIndicators
vi.mock("../strategy/indicators.mjs", () => ({
  calculateIndicators: vi.fn((history) => {
    const closes = history.map((h) => h.close);
    return {
      closes,
      highs: history.map((h) => h.high),
      lows: history.map((h) => h.low),
      rsiArr: new Array(closes.length).fill(50),
      macdArr: new Array(closes.length).fill({
        MACD: 0,
        signal: 0,
        histogram: 0,
      }),
      kdArr: new Array(closes.length).fill({ k: 50, d: 50 }),
      ma20Arr: new Array(closes.length).fill(170),
      ma60Arr: new Array(closes.length).fill(165),
      ma240Arr: new Array(closes.length).fill(155),
      ma60Slope: new Array(closes.length).fill(0.1),
      atrArr: new Array(closes.length).fill(2),
      ma240: 155,
    };
  }),
}));

function createMockHistoryFile(stockNo, monthKey, count = 20) {
  const basePrice = stockNo === "0050" ? 170 : 110;
  return Array.from({ length: count }, (_, i) => ({
    date: `${monthKey.slice(0, 4)}-${monthKey.slice(4)}-${String(i + 1).padStart(2, "0")}`,
    open: basePrice + Math.random() * 2,
    high: basePrice + Math.random() * 3,
    low: basePrice - Math.random() * 2,
    close: basePrice + (Math.random() - 0.5) * 4,
    volume: Math.floor(Math.random() * 10000000) + 1000000,
  }));
}

/** 產生最近 13 個月的 monthKeys (由舊到新) */
function getRequiredMonthKeys() {
  const now = new Date();
  const monthKeys = [];
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  return monthKeys.reverse(); // 由舊到新
}

describe("dataAdapter - 核心資料適配器", () => {
  let mockLatestReport;
  const requiredMonthKeys = getRequiredMonthKeys();

  beforeEach(() => {
    clearHistoryCache();
    vi.clearAllMocks();

    // 使用今天的日期 (確保在 24 小時內)
    const today = new Date().toISOString().split("T")[0];

    mockLatestReport = {
      date: today,
      currentPrice: 116.5,
      price0050: 175.0,
      basePrice: 115.0,
      VIX: 18.5,
      macroMarketDirection: "NEUTRAL",
      portfolio: {
        qty0050: 10000,
        qtyZ2: 5000,
        cash: 50000,
        totalLoan: 800000,
        lastBuyDate: "2026-01-15",
      },
      vixArr: Array.from({ length: 30 }, () => 15 + Math.random() * 10),
      rawValuation: { pb: 1.15 },
      rawUsMarket: { vix: 18.5 },
      rawCnn: { score: 45 },
      rawMargin: { maintenanceRatio: 142.5 },
      rawFx: { currentRate: 31.2 },
      pbRecords: [],
      pbRecordsObjects: [],
      valuationGuardState: { defenseLatch: false },
      institutionalNet: 5000,
      institutionalHistory: [],
    };

    // Setup mock for getLatestReport
    archiveManager.getLatestReport.mockResolvedValue(mockLatestReport);

    // Setup mock for getStockHistory - 所有月份都回傳 mock data
    archiveManager.getStockHistory.mockImplementation((stockNo, monthKey) => {
      return createMockHistoryFile(stockNo, monthKey, 20);
    });

    // Mock fs.stat 回傳 mtime <= cached.mtime (快取有效)
    fs.stat.mockResolvedValue({ mtimeMs: Date.now() - 1000 });
  });

  afterEach(() => {
    clearHistoryCache();
  });

  describe("getStockHistoryCached - 快取機制 (TTL + mtime)", () => {
    it("首次讀取應呼叫 archiveManager.getStockHistory", async () => {
      const mockData = createMockHistoryFile("0050", "202608");
      archiveManager.getStockHistory.mockResolvedValueOnce(mockData);

      const result = await getStockHistoryCached("0050", "202608");

      expect(archiveManager.getStockHistory).toHaveBeenCalledWith(
        "0050",
        "202608",
      );
      expect(result).toEqual(mockData);
    });

    it("第二次讀取同一月份應從快取回傳 (不再呼叫 archiveManager)", async () => {
      const mockData = createMockHistoryFile("0050", "202608");
      archiveManager.getStockHistory.mockResolvedValue(mockData);

      await getStockHistoryCached("0050", "202608");
      // 重置 mock 實作為拋出錯誤，確保第二次不會呼叫
      archiveManager.getStockHistory.mockReset();
      archiveManager.getStockHistory.mockRejectedValue(
        new Error("Should not be called"),
      );

      const result = await getStockHistoryCached("0050", "202608");

      expect(result).toEqual(mockData);
    });

    it("不同股票代號應分別快取", async () => {
      const data0050 = createMockHistoryFile("0050", "202608");
      const dataZ2 = createMockHistoryFile("00675L", "202608");
      archiveManager.getStockHistory
        .mockResolvedValueOnce(data0050)
        .mockResolvedValueOnce(dataZ2);

      await getStockHistoryCached("0050", "202608");
      await getStockHistoryCached("00675L", "202608");

      expect(archiveManager.getStockHistory).toHaveBeenCalledTimes(2);
    });

    it("getCacheStats 應回傳正確統計", async () => {
      const mockData = createMockHistoryFile("0050", "202608");
      archiveManager.getStockHistory.mockResolvedValueOnce(mockData);

      await getStockHistoryCached("0050", "202608");
      const stats = getCacheStats();

      expect(stats.size).toBe(1);
      expect(stats.keys).toContain("0050_202608");
    });
  });

  describe("checkHistoryCompleteness - 歷史完整性檢查 (DEC-05)", () => {
    it("所有月份存在時回傳 complete: true", async () => {
      const monthKeys = ["202607", "202608"];
      archiveManager.getStockHistory.mockResolvedValue(
        createMockHistoryFile("0050", "202608"),
      );

      const result = await checkHistoryCompleteness(monthKeys, "0050");

      expect(result.complete).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it("缺月時回傳 complete: false 並列出缺失月份", async () => {
      const monthKeys = ["202607", "202608"];
      // mock 順序：第一次呼叫是 202607 (缺失)，第二次是 202608 (有資料)
      archiveManager.getStockHistory
        .mockResolvedValueOnce(null) // 202607 缺
        .mockResolvedValueOnce(createMockHistoryFile("0050", "202608"));

      const result = await checkHistoryCompleteness(monthKeys, "0050");

      expect(result.complete).toBe(false);
      expect(result.missing).toContain("202607");
    });

    it("空陣列視為缺月", async () => {
      const monthKeys = ["202608"];
      archiveManager.getStockHistory.mockResolvedValue([]);

      const result = await checkHistoryCompleteness(monthKeys, "0050");

      expect(result.complete).toBe(false);
      expect(result.missing).toContain("202608");
    });
  });

  describe("mergeMonthlyHistory - 合併月份歷史", () => {
    it("合併多月份並按日期排序 (舊到新)", async () => {
      const data1 = createMockHistoryFile("0050", "202607", 10);
      const data2 = createMockHistoryFile("0050", "202608", 10);
      archiveManager.getStockHistory
        .mockResolvedValueOnce(data1)
        .mockResolvedValueOnce(data2);

      const result = await mergeMonthlyHistory("0050", ["202607", "202608"]);

      expect(result.length).toBe(20);
      // 檢查排序：2026-07 的日期應在 2026-08 之前
      expect(result[0].date.startsWith("2026-07")).toBe(true);
      expect(result[19].date.startsWith("2026-08")).toBe(true);
    });
  });

  describe("replaceLastCandle - 替換最新 K 棒 (DEC-02)", () => {
    it("替換收盤價並調整 high/low", () => {
      const history = [
        {
          date: "2026-07-30",
          open: 170,
          high: 172,
          low: 169,
          close: 171,
          volume: 1000,
        },
        {
          date: "2026-07-31",
          open: 171,
          high: 173,
          low: 170,
          close: 172,
          volume: 1000,
        }, // 原收盤 172
      ];

      const result = replaceLastCandle(history, 180); // 模擬價格 180

      expect(result[1].close).toBe(180);
      expect(result[1].high).toBe(180); // max(173, 180) = 180
      expect(result[1].low).toBe(170); // min(170, 180) = 170
      // 原陣列不應被修改
      expect(history[1].close).toBe(172);
    });

    it("模擬價格低於原 low 時 low 被更新", () => {
      const history = [
        {
          date: "2026-07-31",
          open: 171,
          high: 173,
          low: 170,
          close: 172,
          volume: 1000,
        },
      ];

      const result = replaceLastCandle(history, 160);

      expect(result[0].close).toBe(160);
      expect(result[0].high).toBe(173); // max(173, 160) = 173
      expect(result[0].low).toBe(160); // min(170, 160) = 160
    });

    it("空陣列回傳空陣列", () => {
      expect(replaceLastCandle([], 180)).toEqual([]);
    });
  });

  describe("computeMA240WithFallback - 分級 Fallback (DEC-06)", () => {
    it("≥240 筆資料：正常 MA240，quality=ok", () => {
      const closes = Array.from({ length: 250 }, (_, i) => 150 + i * 0.1);
      const result = computeMA240WithFallback(closes);

      expect(Number.isFinite(result.ma240)).toBe(true);
      expect(result.ma240Quality).toBe("ok");
    });

    it("60-239 筆：用 MA60 代理，quality=fallback_used", () => {
      const closes = Array.from({ length: 100 }, (_, i) => 150 + i * 0.1);
      const result = computeMA240WithFallback(closes);

      expect(Number.isFinite(result.ma240)).toBe(true);
      expect(result.ma240Quality).toBe("fallback_used");
    });

    it("20-59 筆：用 MA20 代理，quality=fallback_used", () => {
      const closes = Array.from({ length: 40 }, (_, i) => 150 + i * 0.1);
      const result = computeMA240WithFallback(closes);

      expect(Number.isFinite(result.ma240)).toBe(true);
      expect(result.ma240Quality).toBe("fallback_used");
    });

    it("<20 筆：ma240=null，quality=insufficient_data", () => {
      const closes = Array.from({ length: 10 }, (_, i) => 150 + i * 0.1);
      const result = computeMA240WithFallback(closes);

      expect(result.ma240).toBeNull();
      expect(result.ma240Quality).toBe("insufficient_data");
    });
  });

  describe("buildSimulationInput - formal macro data bridge", () => {
    it("應從 report.macroData.rawInstitutional 建立 institutionalNet", async () => {
      const report = {
        ...mockLatestReport,
        institutionalNet: undefined,
        institutionalHistory: undefined,
        macroData: {
          rawInstitutional: { totalNetBuy: 28074345 },
        },
      };

      const result = await buildSimulationInput(report, 175, 116.5);

      expect(result.institutionalNet).toBeCloseTo(28.074345, 6);
    });

    it("應從 normalized marketState 建立 valuation 與 CNN fallback", async () => {
      const report = {
        ...mockLatestReport,
        rawValuation: undefined,
        rawCnn: undefined,
        marketState: {
          valuation: { pb: 1.8, currentPR: 45 },
          sentiment: { cnnScore: 45 },
        },
      };

      const result = await buildSimulationInput(report, 175, 116.5);

      expect(result.rawValuation).toEqual({ pb: 1.8, currentPR: 45 });
      expect(result.rawCnn).toEqual({ score: 45 });
    });
  });

  describe("buildSimulationInput - 模擬輸入建構", () => {
    it("正常建構 SimulationInput，包含所有必要欄位", async () => {
      const result = await buildSimulationInput(mockLatestReport, 180);

      // 價格欄位
      expect(result.currentPrice).toBeCloseTo(120, 0); // 180 * (116.5/175) ≈ 119.8
      expect(result.price0050).toBe(180);
      expect(result.basePrice).toBe(115);

      // 價格序列
      expect(Array.isArray(result.closeArr)).toBe(true);
      expect(result.closeArr.length).toBeGreaterThan(200); // 13月 × ~20筆
      expect(Array.isArray(result.closeArr0050)).toBe(true); // DEC-03

      // 指標陣列
      expect(Array.isArray(result.ma20Arr)).toBe(true);
      expect(Array.isArray(result.ma60Arr)).toBe(true);
      expect(Array.isArray(result.ma240Arr)).toBe(true);
      expect(Array.isArray(result.rsiArr)).toBe(true);
      expect(Array.isArray(result.kdArr)).toBe(true);
      expect(Array.isArray(result.macdArr)).toBe(true);
      expect(Array.isArray(result.atrArr)).toBe(true);

      // 投資組合
      expect(result.portfolio).toEqual(mockLatestReport.portfolio);

      // 市場環境
      expect(result.VIX).toBe(18.5);
      expect(result.macroMarketDirection).toBe("NEUTRAL");

      // 資料品質標籤
      expect(result.dataQuality).toBeDefined();
      expect(result.dataQuality.rsi).toBe("ok");
      expect(result.dataQuality.kd).toBe("ok");
    });

    it("提供 priceZ2 時使用指定值而非同比例", async () => {
      const result = await buildSimulationInput(mockLatestReport, 180, 125);

      expect(result.currentPrice).toBe(125);
      expect(result.price0050).toBe(180);
    });

    it("缺月時拋出 HISTORY_INCOMPLETE 錯誤 (DEC-05)", async () => {
      archiveManager.getStockHistory.mockResolvedValueOnce(null); // 第一個月份缺失

      await expect(buildSimulationInput(mockLatestReport, 180)).rejects.toThrow(
        "HISTORY_INCOMPLETE",
      );
    });

    it("最新戰報過期拋出 REPORT_EXPIRED", async () => {
      const oldReport = { ...mockLatestReport, date: "2026-07-01" };
      archiveManager.getLatestReport.mockResolvedValue(oldReport);

      await expect(getValidatedLatestReport()).rejects.toThrow(
        "REPORT_EXPIRED",
      );
    });

    it("戰報缺少必要欄位拋出 DATA_NOT_READY", async () => {
      const badReport = { ...mockLatestReport, portfolio: null };
      archiveManager.getLatestReport.mockResolvedValue(badReport);

      await expect(getValidatedLatestReport()).rejects.toThrow(
        "DATA_NOT_READY",
      );
    });
  });

  describe("getValidatedLatestReport - 戰報驗證", () => {
    it("有效戰報直接回傳", async () => {
      archiveManager.getLatestReport.mockResolvedValue(mockLatestReport);

      const result = await getValidatedLatestReport();

      expect(result).toEqual(mockLatestReport);
    });

    it("無戰報拋出 REPORT_EXPIRED", async () => {
      archiveManager.getLatestReport.mockResolvedValue(null);

      await expect(getValidatedLatestReport()).rejects.toThrow(
        "REPORT_EXPIRED",
      );
    });
  });
});
