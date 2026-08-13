// src/modules/providers/historyProvider.test.mjs
// TDD: History Provider 測試

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../utils/coreUtils.mjs", () => ({
  TwDate: vi.fn(() => ({
    formatMonthKey: () => "202401",
    formatDateKey: () => "2024-01-15",
    year: 2024,
    month: 1,
    day: 15,
    dayOfWeek: 1,
  })),
  toTwseStockNo: vi.fn((symbol) => symbol.replace(".TW", "")),
  enumerateMonths: vi.fn((start, end) => ["20240101"]),
  sleep: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./twseProvider.mjs", () => ({
  fetchStockDayMonthWithCache: vi.fn(),
}));

import { fetchStockHistoryWithAutoFill } from "./historyProvider.mjs";
import { fetchStockDayMonthWithCache } from "./twseProvider.mjs";

describe("historyProvider - 歷史資料 Provider", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("fetchStockHistoryWithAutoFill", () => {
    it("成功抓取歷史資料並自動回補", async () => {
      fetchStockDayMonthWithCache.mockResolvedValueOnce([
        {
          date: "2024-01-15",
          open: 100,
          high: 105,
          low: 99,
          close: 102,
          volume: 1000,
        },
        {
          date: "2024-01-14",
          open: 98,
          high: 102,
          low: 97,
          close: 100,
          volume: 900,
        },
      ]);

      const result = await fetchStockHistoryWithAutoFill(
        "0050.TW",
        2,
        "2024-01-15",
      );

      expect(result).toHaveLength(2);
      // 資料會按日期升冪排序
      expect(result[0].date).toBe("2024-01-14");
      expect(result[1].date).toBe("2024-01-15");
    });

    it("資料筆數不足時自動往前推月份", async () => {
      fetchStockDayMonthWithCache
        .mockResolvedValueOnce([
          {
            date: "2024-01-15",
            open: 100,
            high: 105,
            low: 99,
            close: 102,
            volume: 1000,
          },
        ])
        .mockResolvedValueOnce([
          {
            date: "2023-12-29",
            open: 95,
            high: 98,
            low: 94,
            close: 97,
            volume: 800,
          },
        ]);

      const result = await fetchStockHistoryWithAutoFill(
        "0050.TW",
        2,
        "2024-01-15",
      );

      expect(result).toHaveLength(2);
      expect(fetchStockDayMonthWithCache).toHaveBeenCalledTimes(2);
    });

    it("過濾掉晚於 endISO 的資料", async () => {
      fetchStockDayMonthWithCache.mockResolvedValueOnce([
        {
          date: "2024-01-16",
          open: 100,
          high: 105,
          low: 99,
          close: 102,
          volume: 1000,
        },
        {
          date: "2024-01-15",
          open: 98,
          high: 102,
          low: 97,
          close: 100,
          volume: 900,
        },
      ]);

      const result = await fetchStockHistoryWithAutoFill(
        "0050.TW",
        10,
        "2024-01-15",
      );

      // 只應保留 2024-01-15 及之前的資料
      expect(
        result.every((r) => new Date(r.date) <= new Date("2024-01-15")),
      ).toBe(true);
    });

    it("避免重複日期", async () => {
      fetchStockDayMonthWithCache.mockResolvedValueOnce([
        {
          date: "2024-01-15",
          open: 100,
          high: 105,
          low: 99,
          close: 102,
          volume: 1000,
        },
      ]);

      const result = await fetchStockHistoryWithAutoFill(
        "0050.TW",
        10,
        "2024-01-15",
      );

      // 去重後只有一筆
      const uniqueDates = new Set(result.map((r) => r.date));
      expect(uniqueDates.size).toBe(result.length);
    });

    it("資料筆數仍不足時記錄警告", async () => {
      fetchStockDayMonthWithCache.mockResolvedValueOnce([]);

      const loggerModule = await import("../../utils/logger.mjs");
      const warnSpy = vi
        .spyOn(loggerModule.default, "warn")
        .mockImplementation(() => {});

      const result = await fetchStockHistoryWithAutoFill(
        "0050.TW",
        60,
        "2024-01-15",
      );

      expect(result).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(
        { symbol: "0050.TW", count: 0, minCount: 60 },
        "歷史資料筆數仍不足需求筆數",
      );
      warnSpy.mockRestore();
    });

    it("當月資料時等待 1500ms", async () => {
      fetchStockDayMonthWithCache.mockResolvedValueOnce([
        {
          date: "2024-01-15",
          open: 100,
          high: 105,
          low: 99,
          close: 102,
          volume: 1000,
        },
      ]);

      await fetchStockHistoryWithAutoFill("0050.TW", 1, "2024-01-15");

      const { sleep } = await import("../../utils/coreUtils.mjs");
      expect(sleep).toHaveBeenCalledWith(1500);
    });

    it("最多往回找 13 個月", async () => {
      fetchStockDayMonthWithCache.mockResolvedValue([]);

      const result = await fetchStockHistoryWithAutoFill(
        "0050.TW",
        100,
        "2024-01-15",
      );

      expect(result).toEqual([]);
      // 最多呼叫 13 次
      expect(fetchStockDayMonthWithCache).toHaveBeenCalledTimes(13);
    });
  });
});
