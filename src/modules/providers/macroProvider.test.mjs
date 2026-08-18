// src/modules/providers/macroProvider.test.mjs
// TDD: Macro Provider 測試

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../utils/coreUtils.mjs", () => ({
  fetchWithTimeout: vi.fn(),
  parseNumber: vi.fn((val) => {
    if (val === null || val === undefined || val === "") return null;
    return parseFloat(val);
  }),
}));

vi.mock("../../utils/retryUtils.mjs", () => ({
  ProviderError: class extends Error {},
}));

import { fetchCentralBankRate, fetchCpiYoY } from "./macroProvider.mjs";
import { fetchWithTimeout, parseNumber } from "../../utils/coreUtils.mjs";

describe("macroProvider - 總經指標 Provider", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("fetchCentralBankRate", () => {
    it("成功解析央行 HTML 回傳利率資料", async () => {
      const mockHtml = '<td data-th="重貼現率"><span>1.875</span></td>';
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(mockHtml),
      });
      parseNumber.mockReturnValueOnce(1.875);

      const result = await fetchCentralBankRate();

      expect(result.value).toBe(1.875);
      expect(result.source).toBe("CBC");
      expect(result.date).toBeDefined();
      expect(result.raw).toBe(mockHtml);
      expect(result.normalized).toEqual(
        expect.objectContaining({ value: 1.875, source: "CBC" }),
      );
    });

    it("HTML 解析失敗回傳 fallback 值", async () => {
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue("<html>no rate</html>"),
      });
      parseNumber.mockReturnValueOnce(null);

      const result = await fetchCentralBankRate();

      expect(result.value).toBe(2.0); // fallbackVal
      expect(result.source).toBe("fallback");
      expect(result.date).toBeNull();
    });

    it("HTTP 錯誤回傳 fallback 值", async () => {
      fetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await fetchCentralBankRate();

      expect(result.value).toBe(2.0);
      expect(result.source).toBe("fallback");
    });

    it("網路異常回傳 fallback 值", async () => {
      fetchWithTimeout.mockRejectedValueOnce(new Error("Network error"));

      const result = await fetchCentralBankRate();

      expect(result.value).toBe(2.0);
      expect(result.source).toBe("fallback");
    });
  });

  describe("fetchCpiYoY", () => {
    it("成功解析 DGBAS CPI 數據", async () => {
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          orgdata: [[2.15]],
        }),
      });
      parseNumber.mockReturnValueOnce(2.15);

      const result = await fetchCpiYoY();

      expect(result.value).toBe(2.15);
      expect(result.source).toBe("DGBAS");
      expect(result.date).toMatch(/^\d{4}-\d{2}$/);
      expect(result.raw).toEqual({ orgdata: [[2.15]] });
      expect(result.normalized).toEqual(
        expect.objectContaining({ value: 2.15, source: "DGBAS" }),
      );
    });

    it("數據解析失敗回傳 fallback 值", async () => {
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ orgdata: [] }),
      });
      parseNumber.mockReturnValueOnce(null); // 解析失敗回傳 null

      const result = await fetchCpiYoY();

      expect(result.value).toBe(2.0); // fallback
      expect(result.source).toBe("fallback");
    });

    it("HTTP 錯誤回傳 fallback 值", async () => {
      fetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await fetchCpiYoY();

      expect(result.value).toBe(2.0);
      expect(result.source).toBe("fallback");
    });

    it("網路異常回傳 fallback 值", async () => {
      fetchWithTimeout.mockRejectedValueOnce(new Error("Timeout"));

      const result = await fetchCpiYoY();

      expect(result.value).toBe(2.0);
      expect(result.source).toBe("fallback");
    });
  });
});
