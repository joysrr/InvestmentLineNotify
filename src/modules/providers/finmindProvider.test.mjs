// src/modules/providers/finmindProvider.test.mjs
// TDD: FinMind Provider 測試

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../utils/coreUtils.mjs", () => ({
  fetchWithTimeout: vi.fn(),
  parseNumber: vi.fn(),
  TwDate: vi.fn(),
}));

import { fetchFinMindMarginData } from "./finmindProvider.mjs";
import {
  fetchWithTimeout,
  parseNumber,
  TwDate,
} from "../../utils/coreUtils.mjs";

describe("finmindProvider - FinMind Provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTwDate = {
    formatDateKey: vi.fn(() => "2024-01-15"),
    dateObj: new Date("2024-01-15"),
  };
  TwDate.mockReturnValue(mockTwDate);

  describe("fetchFinMindMarginData", () => {
    it("成功回傳融資與維持率資料", async () => {
      // Mock fetchFinMindData to return the expected results directly
      const mockFetchFinMindData = vi
        .fn()
        .mockResolvedValueOnce([
          // Margin summary
          {
            date: "2024-01-12",
            TodayBalance: "350000000000",
            YesBalance: "345000000000",
          },
          {
            date: "2024-01-15",
            TodayBalance: "360000000000",
            YesBalance: "350000000000",
          },
        ])
        .mockResolvedValueOnce([
          // Ratio
          { date: "2024-01-12", TotalExchangeMarginMaintenance: "178.5" },
          { date: "2024-01-15", TotalExchangeMarginMaintenance: "180.0" },
        ]);

      // We need to mock the internal function, but since it's not exported,
      // let's test via the public function with proper mocks
      const mockResponse1 = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          status: 200,
          msg: "success",
          data: [
            {
              date: "2024-01-12",
              TodayBalance: "350000000000",
              YesBalance: "345000000000",
            },
            {
              date: "2024-01-15",
              TodayBalance: "360000000000",
              YesBalance: "350000000000",
            },
          ],
        }),
      };
      const mockResponse2 = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          status: 200,
          msg: "success",
          data: [
            { date: "2024-01-12", TotalExchangeMarginMaintenance: "178.5" },
            { date: "2024-01-15", TotalExchangeMarginMaintenance: "180.0" },
          ],
        }),
      };

      fetchWithTimeout
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      // parseNumber calls: TodayBalance, YesBalance, TotalExchangeMarginMaintenance
      parseNumber
        .mockReturnValueOnce(360000000000)
        .mockReturnValueOnce(350000000000)
        .mockReturnValueOnce(180.0);

      const result = await fetchFinMindMarginData();

      expect(fetchWithTimeout).toHaveBeenCalledTimes(2);
      expect(result.date).toBe("2024-01-15");
      expect(result.marginBalance100M).toBe(3600);
      expect(result.marginBalanceChange100M).toBe(100);
      expect(result.maintenanceRatio).toBe(180.0);
    });

    it("融資 API 失敗使用 fallback", async () => {
      const mockResponse1 = { ok: false, status: 500, json: vi.fn() };
      const mockResponse2 = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          status: 200,
          msg: "success",
          data: [
            { date: "2024-01-15", TotalExchangeMarginMaintenance: "180.0" },
          ],
        }),
      };

      fetchWithTimeout
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      parseNumber.mockReturnValue(180.0);

      const result = await fetchFinMindMarginData();

      expect(result.marginBalance100M).toBe(3000); // fallback
      expect(result.marginBalanceChange100M).toBe(0); // fallback
      expect(result.maintenanceRatio).toBe(180.0);
    });

    it("維持率 API 失敗使用 fallback", async () => {
      const mockResponse1 = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          status: 200,
          msg: "success",
          data: [
            {
              date: "2024-01-12",
              TodayBalance: "350000000000",
              YesBalance: "345000000000",
            },
            {
              date: "2024-01-15",
              TodayBalance: "360000000000",
              YesBalance: "350000000000",
            },
          ],
        }),
      };
      const mockResponse2 = { ok: false, status: 500, json: vi.fn() };

      fetchWithTimeout
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      parseNumber
        .mockReturnValueOnce(360000000000)
        .mockReturnValueOnce(350000000000);

      const result = await fetchFinMindMarginData();

      expect(result.marginBalance100M).toBe(3600);
      expect(result.marginBalanceChange100M).toBe(100);
      expect(result.maintenanceRatio).toBe(165); // fallback
    });

    it("兩個 API 都失敗回傳完整 fallback", async () => {
      fetchWithTimeout
        .mockResolvedValueOnce({ ok: false, status: 500, json: vi.fn() })
        .mockResolvedValueOnce({ ok: false, status: 500, json: vi.fn() });

      const result = await fetchFinMindMarginData();

      expect(result).toEqual({
        date: null,
        marginBalance100M: 3000,
        marginBalanceChange100M: 0,
        maintenanceRatio: 165,
      });
    });

    it("API 回傳 402 配額用完使用 fallback", async () => {
      const mockResponse1 = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ status: 402, msg: "Quota exceeded" }),
      };
      const mockResponse2 = { ok: false, status: 500, json: vi.fn() };

      fetchWithTimeout
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const result = await fetchFinMindMarginData();

      expect(result.marginBalance100M).toBe(3000);
      expect(result.maintenanceRatio).toBe(165);
    });

    it("融資資料解析失敗使用 fallback", async () => {
      const mockResponse1 = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          status: 200,
          msg: "success",
          data: [{ date: "2024-01-15", TodayBalance: null, YesBalance: null }],
        }),
      };
      const mockResponse2 = { ok: false, status: 500, json: vi.fn() };

      fetchWithTimeout
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      parseNumber.mockReturnValue(null);

      const result = await fetchFinMindMarginData();

      expect(result.marginBalance100M).toBe(3000);
      expect(result.marginBalanceChange100M).toBe(0);
    });

    it("無資料回傳 fallback", async () => {
      const mockResponse1 = {
        ok: true,
        status: 200,
        json: vi
          .fn()
          .mockResolvedValue({ status: 200, msg: "success", data: [] }),
      };
      const mockResponse2 = { ok: false, status: 500, json: vi.fn() };

      fetchWithTimeout
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const result = await fetchFinMindMarginData();

      expect(result.marginBalance100M).toBe(3000);
    });

    it("網路錯誤使用 fallback", async () => {
      fetchWithTimeout
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"));

      const result = await fetchFinMindMarginData();

      expect(result.marginBalance100M).toBe(3000);
      expect(result.maintenanceRatio).toBe(165);
    });

    it("TwDate 被正確呼叫計算日期範圍", async () => {
      const mockResponse1 = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          status: 200,
          msg: "success",
          data: [
            {
              date: "2024-01-15",
              TodayBalance: "360000000000",
              YesBalance: "350000000000",
            },
          ],
        }),
      };
      const mockResponse2 = { ok: false, status: 500, json: vi.fn() };

      fetchWithTimeout
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      parseNumber
        .mockReturnValueOnce(360000000000)
        .mockReturnValueOnce(350000000000);

      await fetchFinMindMarginData();

      expect(TwDate).toHaveBeenCalledTimes(2);
    });
  });
});
