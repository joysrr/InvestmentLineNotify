// src/modules/providers/basePriceProvider.test.mjs
// TDD: Base Price Provider 測試

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../utils/coreUtils.mjs", () => ({
  fetchWithTimeout: vi.fn(),
  parseNumber: vi.fn(),
}));

vi.mock("../../utils/logger.mjs", () => ({
  default: {
    warn: vi.fn(),
  },
}));

import { fetchLatestBasePrice } from "./basePriceProvider.mjs";
import { fetchWithTimeout, parseNumber } from "../../utils/coreUtils.mjs";

describe("basePriceProvider - 基準價 Provider", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules(); // 重置模組快取
  });

  describe("fetchLatestBasePrice", () => {
    it("驗證函數存在", async () => {
      expect(typeof fetchLatestBasePrice).toBe("function");
    });

    it("缺少 URL 時拋出錯誤", async () => {
      await expect(fetchLatestBasePrice(undefined)).rejects.toThrow("缺少 BASE_PRICE_URL");
    });

    it("成功取得並回傳結果", async () => {
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue("2024-01-15, 125.67"),
      };
      fetchWithTimeout.mockResolvedValueOnce(mockResponse);
      parseNumber.mockReturnValue(125.67);

      const result = await fetchLatestBasePrice("http://test.com/BasePrice.txt");

      expect(result.baseDate).toBe("2024-01-15");
      expect(result.basePrice).toBe(125.67);
    });

    it("HTTP 錯誤且無快取時拋出錯誤", async () => {
      // 重置模組確保無快取
      vi.resetModules();
      const { fetchLatestBasePrice: freshFetch } = await import("./basePriceProvider.mjs");
      
      const mockResponse = {
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue("Not found"),
      };
      fetchWithTimeout.mockResolvedValueOnce(mockResponse);

      await expect(freshFetch("http://test.com/BasePrice.txt")).rejects.toThrow("HTTP 404");
    });
  });
});