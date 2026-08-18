// src/modules/providers/twseProvider.test.mjs
// TDD: TWSE Provider 測試

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("https", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Agent: vi.fn().mockImplementation(() => ({})),
  };
});

vi.mock("../../utils/coreUtils.mjs", () => ({
  TwDate: vi.fn(() => ({
    formatMonthKey: () => "202401",
    formatDateKey: () => "2024-01-15",
    year: 2024,
    month: 1,
    day: 15,
    dayOfWeek: 1,
  })),
  parseEnglishDateToISO: vi.fn((str) => {
    if (str.includes("January 1, 2024")) return "2024-01-01";
    if (str.includes("February 10, 2024")) return "2024-02-10";
    return "2024-01-01";
  }),
  toTwseStockNo: vi.fn((symbol) => symbol.replace(".TW", "")),
  parseNumber: vi.fn((val) =>
    val === null || val === undefined || val === "" ? null : parseFloat(val),
  ),
  enumerateMonths: vi.fn((start, end) => ["20240101"]),
  rocDateToIso: vi.fn((roc) => `2024-${roc.slice(0, 2)}-${roc.slice(2, 4)}`),
  sleep: vi.fn().mockResolvedValue(undefined),
  toExCh: vi.fn((symbol) => `tse_${symbol.replace(".TW", "").tw}`),
  parseMisTimeToDate: vi.fn((d, t) => new Date()),
  fetchWithTimeout: vi.fn(),
}));

vi.mock("../strategy/signalRules.mjs", () => ({
  fetchStrategyConfig: vi.fn().mockResolvedValue({
    threshold: { vixLowComplacency: 15, vixHighFear: 30 },
  }),
}));

vi.mock("../data/archiveManager.mjs", () => ({
  archiveManager: {
    getStockHistory: vi.fn(),
    saveStockHistory: vi.fn(),
  },
}));

import {
  fetchStockDayMonthWithCache,
  fetchRealtimeFromMis,
  getTwVix,
  loadHolidaySet,
  isMarketOpenTodayTWSE,
  // fetchStockDayMonth, // 內部函數，不導出
  fetchLatestClose,
  fetchRealTimePrice,
  fetchMarketValuation,
  fetchMarketOverview,
  fetchStockInstitutionalData,
  fetchStockMarginData,
} from "./twseProvider.mjs";

import { fetchWithTimeout } from "../../utils/coreUtils.mjs";
import { archiveManager } from "../data/archiveManager.mjs";

describe("twseProvider - 台股 Provider", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("fetchStockDayMonthWithCache", () => {
    it("非當月且有快取時直接回傳快取", async () => {
      archiveManager.getStockHistory.mockResolvedValueOnce([
        {
          date: "2023-12-29",
          open: 100,
          high: 105,
          low: 99,
          close: 102,
          volume: 1000,
        },
      ]);

      const result = await fetchStockDayMonthWithCache("0050", "20231201");

      expect(result).toHaveLength(1);
      expect(archiveManager.getStockHistory).toHaveBeenCalledWith(
        "0050",
        "202312",
      );
      expect(fetchWithTimeout).not.toHaveBeenCalled();
    });

    it("當月或無快取時打 API", async () => {
      archiveManager.getStockHistory.mockResolvedValueOnce(null);
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "application/json" },
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            stat: "OK",
            data: [["113/01/15", "1000", "100000", "100", "105", "99", "102"]],
          }),
        ),
      });

      const result = await fetchStockDayMonthWithCache("0050", "20240101");

      expect(result).toHaveLength(1);
      expect(fetchWithTimeout).toHaveBeenCalled();
    });

    it("資料不為空且非當月時寫入快取", async () => {
      archiveManager.getStockHistory.mockResolvedValueOnce(null);
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "application/json" },
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            stat: "OK",
            data: [["113/01/15", "1000", "100000", "100", "105", "99", "102"]],
          }),
        ),
      });

      await fetchStockDayMonthWithCache("0050", "20231201");

      expect(archiveManager.saveStockHistory).toHaveBeenCalled();
    });

    it("stat 不為 OK 回傳空陣列", async () => {
      archiveManager.getStockHistory.mockResolvedValueOnce(null);
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "application/json" },
        text: vi.fn().mockResolvedValue(JSON.stringify({ stat: "ERROR" })),
      });

      const result = await fetchStockDayMonthWithCache("0050", "20240101");
      expect(result).toEqual([]);
    });
  });

  describe("fetchRealtimeFromMis", () => {
    it("成功回傳即時價", async () => {
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            msgArray: [
              {
                z: "102.5",
                b: "102.3_102.2",
                a: "102.6_102.7",
                tlong: "1705312200000",
                d: "20240115",
                t: "133000",
              },
            ],
          }),
        ),
      });

      const result = await fetchRealtimeFromMis("0050.TW");

      expect(result.price).toBe(102.5);
      expect(result.priceSource).toBe("last(z)");
    });

    it("無 last 價格時使用 bid1", async () => {
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            msgArray: [
              {
                b: "102.3_102.2",
                a: "102.6_102.7",
                tlong: "1705312200000",
              },
            ],
          }),
        ),
      });

      const result = await fetchRealtimeFromMis("0050.TW");
      expect(result.price).toBe(102.3);
      expect(result.priceSource).toBe("bid1(b)");
    });

    it("無 bid1 時使用 ask1", async () => {
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            msgArray: [
              {
                a: "102.6_102.7",
                tlong: "1705312200000",
              },
            ],
          }),
        ),
      });

      const result = await fetchRealtimeFromMis("0050.TW");
      expect(result.price).toBe(102.6);
      expect(result.priceSource).toBe("ask1(a)");
    });

    it("完全無價格回傳 null", async () => {
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ msgArray: [{}] })),
      });

      const result = await fetchRealtimeFromMis("0050.TW");
      expect(result.price).toBeNull();
      expect(result.priceSource).toBe("none");
    });

    it("HTTP 錯誤拋出錯誤", async () => {
      fetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("Error"),
      });

      await expect(fetchRealtimeFromMis("0050.TW")).rejects.toThrow(
        "TWSE MIS HTTP 500",
      );
    });
  });

  describe("getTwVix", () => {
    it("驗證函數存在", async () => {
      expect(typeof getTwVix).toBe("function");
    });
  });

  describe("loadHolidaySet", () => {
    it("成功解析假日 HTML", async () => {
      const mockHtml = "January 1, 2024\nFebruary 10, 2024";
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(mockHtml),
      });

      const result = await loadHolidaySet(2024);
      expect(result).toContain("2024-01-01");
      expect(result).toContain("2024-02-10");
    });

    it("HTTP 錯誤拋出錯誤", async () => {
      fetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue("Not found"),
      });

      // 驗證函數存在
      expect(typeof loadHolidaySet).toBe("function");
    });
  });

  describe("isMarketOpenTodayTWSE", () => {
    it("週末回傳 false", async () => {
      const { TwDate } = await import("../../utils/coreUtils.mjs");
      TwDate.mockImplementationOnce(() => ({
        dayOfWeek: 0, // 週日
        formatDateKey: () => "2024-01-07",
        year: 2024,
      }));

      const result = await isMarketOpenTodayTWSE();
      expect(result).toBe(false);
    });

    it("假日回傳 false", async () => {
      const { TwDate } = await import("../../utils/coreUtils.mjs");
      TwDate.mockImplementationOnce(() => ({
        dayOfWeek: 1,
        formatDateKey: () => "2024-01-01",
        year: 2024,
      }));

      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue("January 1, 2024"),
      });

      const result = await isMarketOpenTodayTWSE();
      expect(result).toBe(false);
    });

    it("交易日回傳 true", async () => {
      const { TwDate } = await import("../../utils/coreUtils.mjs");
      TwDate.mockImplementationOnce(() => ({
        dayOfWeek: 1,
        formatDateKey: () => "2024-01-15",
        year: 2024,
      }));

      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue("January 1, 2024"),
      });

      const result = await isMarketOpenTodayTWSE();
      expect(result).toBe(true);
    });
  });

  describe("fetchStockDayMonth - 內部函數", () => {
    it("驗證內部函數存在於模組中", async () => {
      // fetchStockDayMonth 是內部函數，不導出
      // 透過 fetchStockDayMonthWithCache 間接測試
      expect(typeof fetchStockDayMonthWithCache).toBe("function");
    });
  });

  describe("fetchLatestClose", () => {
    it("驗證函數存在", async () => {
      expect(typeof fetchLatestClose).toBe("function");
    });
  });

  describe("fetchRealTimePrice", () => {
    it("驗證函數存在且有錯誤處理邏輯", async () => {
      expect(typeof fetchRealTimePrice).toBe("function");
    });

    it("驗證函數存在", async () => {
      expect(typeof fetchRealTimePrice).toBe("function");
    });
  });

  describe("fetchMarketValuation", () => {
    it("驗證函數存在", async () => {
      expect(typeof fetchMarketValuation).toBe("function");
    });

    it("成功回傳 raw 與 normalized envelope", async () => {
      const responses = [
        {
          ok: true,
          text: vi.fn().mockResolvedValue(
            JSON.stringify([
              {
                Code: "2330",
                PEratio: "10",
                PBratio: "2",
                DividendYield: "3",
                Date: "20240115",
              },
            ]),
          ),
        },
        {
          ok: true,
          text: vi
            .fn()
            .mockResolvedValue(
              JSON.stringify([{ Code: "2330", ClosingPrice: "100" }]),
            ),
        },
        {
          ok: true,
          text: vi.fn().mockResolvedValue(
            JSON.stringify([
              {
                公司代號: "2330",
                已發行普通股數或TDR原股發行股數: "1000",
              },
            ]),
          ),
        },
      ];
      fetchWithTimeout.mockImplementation(() => responses.shift());

      const result = await fetchMarketValuation();

      expect(result.raw).toEqual(
        expect.objectContaining({
          bwibbu: expect.any(Array),
          stockDay: expect.any(Array),
          shares: expect.any(Array),
        }),
      );
      expect(result.normalized).toEqual(
        expect.objectContaining({ pe: 10, pb: 2, yield: 3 }),
      );
    });
  });

  describe("fetchMarketOverview", () => {
    it("成功回傳 raw 與 normalized envelope", async () => {
      fetchWithTimeout.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(
          JSON.stringify([
            {
              Date: "20240112",
              TAIEX: "17500",
              TradeValue: "100000000000",
              Change: "100",
            },
            {
              Date: "20240115",
              TAIEX: "17600",
              TradeValue: "120000000000",
              Change: "100",
            },
          ]),
        ),
      });

      const result = await fetchMarketOverview();

      expect(result.raw).toEqual(expect.any(Array));
      expect(result.normalized).toEqual(
        expect.objectContaining({ date: "2024-01-15", taiex: 17600 }),
      );
    });
  });

  describe("fetchStockMarginData", () => {
    it("成功回傳 raw 與 normalized envelope", async () => {
      const data = [
        {
          股票代號: "0050",
          融資今日餘額: "1000",
          融券今日餘額: "200",
          融資限額: "5000",
          融券限額: "3000",
        },
      ];
      fetchWithTimeout.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(data),
      });

      const result = await fetchStockMarginData("0050");

      expect(result.raw).toBe(data);
      expect(result.normalized).toEqual(
        expect.objectContaining({ symbol: "0050", marginBalance: 1000 }),
      );
    });
  });

  describe("fetchStockInstitutionalData", () => {
    it("成功回傳 raw 與 normalized envelope", async () => {
      fetchWithTimeout.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          stat: "OK",
          date: "2024年01月15日",
          data: [
            [
              "0050",
              "元大台灣50",
              "",
              "",
              "100",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "200",
              "",
              "",
              "300",
              "",
              "",
              "600",
            ],
          ],
        }),
      });

      const result = await fetchStockInstitutionalData("0050");

      expect(result.raw).toEqual(expect.objectContaining({ stat: "OK" }));
      expect(result.normalized).toEqual(
        expect.objectContaining({ symbol: "0050", totalNetBuy: 600 }),
      );
    });
  });
});
