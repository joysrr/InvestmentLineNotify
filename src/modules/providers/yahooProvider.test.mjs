// src/modules/providers/yahooProvider.test.mjs
// TDD: Yahoo Provider 測試

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../utils/coreUtils.mjs", () => ({
  fetchWithTimeout: vi.fn(),
}));

import { fetchUsdTwdExchangeRate } from "./yahooProvider.mjs";
import { fetchWithTimeout } from "../../utils/coreUtils.mjs";

describe("yahooProvider - Yahoo Finance Provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchUsdTwdExchangeRate", () => {
    it("成功回傳完整匯率資料", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          chart: {
            result: [
              {
                meta: {
                  regularMarketPrice: 31.5432,
                  previousClose: 31.4000,
                  chartPreviousClose: 31.3000,
                },
                indicators: {
                  quote: [{ close: [31.1, 31.2, 31.3, 31.4, 31.5432] }],
                },
              },
            ],
          },
        }),
      };
      fetchWithTimeout.mockResolvedValue(mockResponse);

      const result = await fetchUsdTwdExchangeRate();

      expect(fetchWithTimeout).toHaveBeenCalled();
      expect(result.currentRate).toBe(31.5432);
      expect(result.previousClose).toBe(31.4);
      expect(result.changePercent).toBeCloseTo(0.46, 1);
      expect(result.historicalPrices).toHaveLength(5);
    });

    it("HTTP 錯誤回傳預設空值", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
      };
      fetchWithTimeout.mockResolvedValue(mockResponse);

      const result = await fetchUsdTwdExchangeRate();

      expect(result.currentRate).toBeNull();
      expect(result.previousClose).toBeNull();
      expect(result.changePercent).toBeNull();
      expect(result.historicalPrices).toEqual([]);
    });

    it("JSON 結構異常回傳預設空值", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ chart: { result: [] } }),
      };
      fetchWithTimeout.mockResolvedValue(mockResponse);

      const result = await fetchUsdTwdExchangeRate();

      expect(result.currentRate).toBeNull();
      expect(result.previousClose).toBeNull();
      expect(result.changePercent).toBeNull();
      expect(result.historicalPrices).toEqual([]);
    });

    it("meta 缺少 previousClose 使用 chartPreviousClose", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          chart: {
            result: [
              {
                meta: {
                  regularMarketPrice: 31.5432,
                  chartPreviousClose: 31.4000,
                },
                indicators: {
                  quote: [{ close: [31.4, 31.5432] }],
                },
              },
            ],
          },
        }),
      };
      fetchWithTimeout.mockResolvedValue(mockResponse);

      const result = await fetchUsdTwdExchangeRate();

      expect(result.previousClose).toBe(31.4);
    });

    it("meta 缺少 previousClose 和 chartPreviousClose 使用陣列倒數第二筆", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          chart: {
            result: [
              {
                meta: {
                  regularMarketPrice: 31.5432,
                },
                indicators: {
                  quote: [{ close: [31.3, 31.4, 31.5432] }],
                },
              },
            ],
          },
        }),
      };
      fetchWithTimeout.mockResolvedValue(mockResponse);

      const result = await fetchUsdTwdExchangeRate();

      expect(result.previousClose).toBe(31.4);
    });

    it("close 陣列包含 null 值被過濾", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          chart: {
            result: [
              {
                meta: {
                  regularMarketPrice: 31.5432,
                  previousClose: 31.4000,
                },
                indicators: {
                  quote: [{ close: [31.1, null, 31.3, null, 31.5432] }],
                },
              },
            ],
          },
        }),
      };
      fetchWithTimeout.mockResolvedValue(mockResponse);

      const result = await fetchUsdTwdExchangeRate();

      expect(result.historicalPrices).toEqual([31.1, 31.3, 31.5432]);
    });

    it("網路超時回傳預設空值", async () => {
      const timeoutError = new Error("Timeout");
      fetchWithTimeout.mockRejectedValue(timeoutError);

      const result = await fetchUsdTwdExchangeRate();

      expect(result.currentRate).toBeNull();
      expect(result.previousClose).toBeNull();
      expect(result.changePercent).toBeNull();
      expect(result.historicalPrices).toEqual([]);
    });

    it("網路錯誤回傳預設空值", async () => {
      fetchWithTimeout.mockRejectedValue(new Error("Network error"));

      const result = await fetchUsdTwdExchangeRate();

      expect(result.currentRate).toBeNull();
      expect(result.previousClose).toBeNull();
      expect(result.changePercent).toBeNull();
      expect(result.historicalPrices).toEqual([]);
    });

    it("regularMarketPrice 非數字回傳預設空值", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          chart: {
            result: [
              {
                meta: {
                  regularMarketPrice: "invalid",
                  previousClose: 31.4000,
                },
                indicators: {
                  quote: [{ close: [31.4] }],
                },
              },
            ],
          },
        }),
      };
      fetchWithTimeout.mockResolvedValue(mockResponse);

      const result = await fetchUsdTwdExchangeRate();

      expect(result.currentRate).toBeNull();
    });

    it("previousClose 為 0 不計算 changePercent", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          chart: {
            result: [
              {
                meta: {
                  regularMarketPrice: 31.5432,
                  previousClose: 0,
                },
                indicators: {
                  quote: [{ close: [31.5432] }],
                },
              },
            ],
          },
        }),
      };
      fetchWithTimeout.mockResolvedValue(mockResponse);

      const result = await fetchUsdTwdExchangeRate();

      expect(result.currentRate).toBe(31.5432);
      // previousClose 為 0 時不設定 (因為 > 0 條件失敗)，保持預設 null
      expect(result.previousClose).toBeNull();
      expect(result.changePercent).toBeNull();
    });
  });
});