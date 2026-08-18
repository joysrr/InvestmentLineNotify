// src/modules/providers/cnnProvider.test.mjs
// TDD: CNN Provider 測試

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../utils/logger.mjs", () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../utils/coreUtils.mjs", () => ({
  fetchWithTimeout: vi.fn(),
  parseNumber: vi.fn(),
}));

import { fetchFearAndGreedIndex } from "./cnnProvider.mjs";
import { fetchWithTimeout, parseNumber } from "../../utils/coreUtils.mjs";
import logger from "../../utils/logger.mjs";

describe("cnnProvider - CNN Fear & Greed Provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchFearAndGreedIndex", () => {
    it("成功回傳完整指數資料", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          fear_and_greed: {
            score: 45,
            rating: "fear",
            previous_close: 50,
            previous_1_week: 55,
            previous_1_month: 60,
            previous_1_year: 40,
            timestamp: "2024-01-15T12:00:00Z",
          },
        }),
      };
      fetchWithTimeout.mockResolvedValue(mockResponse);
      parseNumber.mockImplementation((val) => val);

      const result = await fetchFearAndGreedIndex();

      expect(fetchWithTimeout).toHaveBeenCalled();
      expect(result.score).toBe(45);
      expect(result.rating).toBe("fear");
      expect(result.previousClose).toBe(50);
      expect(result.previous1Week).toBe(55);
      expect(result.previous1Month).toBe(60);
      expect(result.previous1Year).toBe(40);
      expect(result.timestamp).toEqual(new Date("2024-01-15T12:00:00Z"));
      expect(result.raw).toEqual(
        expect.objectContaining({ fear_and_greed: expect.any(Object) }),
      );
      expect(result.normalized).toEqual(
        expect.objectContaining({ score: 45, rating: "fear" }),
      );
    });

    it("HTTP 錯誤回傳預設值", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      };
      fetchWithTimeout.mockResolvedValue(mockResponse);

      const result = await fetchFearAndGreedIndex();

      expect(result.score).toBe(50);
      expect(result.rating).toBe("neutral");
      expect(logger.error).toHaveBeenCalled();
    });

    it("JSON 結構不符合預期回傳預設值", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ fear_and_greed: {} }),
      };
      fetchWithTimeout.mockResolvedValue(mockResponse);

      const result = await fetchFearAndGreedIndex();

      expect(result.score).toBe(50);
      expect(result.rating).toBe("neutral");
      expect(logger.error).toHaveBeenCalled();
    });

    it("缺少 rating 使用預設 neutral", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          fear_and_greed: { score: 60 },
        }),
      };
      fetchWithTimeout.mockResolvedValue(mockResponse);
      parseNumber.mockImplementation((val, options) => {
        if (options?.fallback === null) {
          if (val === null || val === undefined || val === "") return null;
          return val;
        }
        return val;
      });

      const result = await fetchFearAndGreedIndex();

      expect(result.score).toBe(60);
      expect(result.rating).toBe("neutral");
    });

    it("缺少 timestamp 使用當前時間", async () => {
      const before = new Date();
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          fear_and_greed: { score: 60 },
        }),
      };
      fetchWithTimeout.mockResolvedValue(mockResponse);
      parseNumber.mockImplementation((val, options) => {
        if (options?.fallback === null) {
          if (val === null || val === undefined || val === "") return null;
          return val;
        }
        return val;
      });

      const result = await fetchFearAndGreedIndex();

      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
    });

    it("網路超時回傳預設值並記錄警告", async () => {
      const timeoutError = new Error("Timeout");
      fetchWithTimeout.mockRejectedValue(timeoutError);

      const result = await fetchFearAndGreedIndex();

      expect(result.score).toBe(50);
      expect(result.rating).toBe("neutral");
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("超時"));
    });

    it("網路錯誤回傳預設值並記錄錯誤", async () => {
      fetchWithTimeout.mockRejectedValue(new Error("Network error"));

      const result = await fetchFearAndGreedIndex();

      expect(result.score).toBe(50);
      expect(result.rating).toBe("neutral");
      expect(logger.error).toHaveBeenCalled();
    });

    it("safeFormatNumber 處理 null 值使用 fallback", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          fear_and_greed: {
            score: 60,
            previous_close: null,
            previous_1_week: null,
          },
        }),
      };
      fetchWithTimeout.mockResolvedValue(mockResponse);
      parseNumber.mockReturnValue(null);

      const result = await fetchFearAndGreedIndex();

      expect(result.previousClose).toBe(50); // fallback
      expect(result.previous1Week).toBe(50); // fallback
    });

    it("safeFormatNumber 處理數字正確格式化", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          fear_and_greed: {
            score: 60.1234,
            previous_close: 55.5678,
          },
        }),
      };
      fetchWithTimeout.mockResolvedValue(mockResponse);
      // parseNumber 返回傳入的值 (模擬 coreUtils 的行為)
      // 但實際會被呼叫 parseNumber(val, { decimals: null, fallback: null })
      parseNumber.mockImplementation((val, options) => {
        if (options?.fallback === null) {
          // 當 fallback 為 null 時，解析失敗返回 null
          if (val === null || val === undefined || val === "") return null;
          return val;
        }
        return val;
      });

      const result = await fetchFearAndGreedIndex();

      expect(result.score).toBe(60.12);
      expect(result.previousClose).toBe(55.57);
    });
  });
});
