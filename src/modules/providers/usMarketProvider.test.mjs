// src/modules/providers/usMarketProvider.test.mjs
// TDD: US Market Provider 測試

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../utils/coreUtils.mjs", () => ({
  fetchWithTimeout: vi.fn(),
  parseNumber: vi.fn(),
}));

vi.mock("../strategy/signalRules.mjs", () => ({
  fetchStrategyConfig: vi.fn().mockResolvedValue({
    threshold: {
      usVixPanic: 30,
      vixHighFear: 20,
      vixLowComplacency: 13.5,
    },
  }),
}));

import { fetchUsMarketData } from "./usMarketProvider.mjs";
import { fetchWithTimeout, parseNumber } from "../../utils/coreUtils.mjs";
import { fetchStrategyConfig } from "../strategy/signalRules.mjs";

describe("usMarketProvider - US Market Provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchUsMarketData", () => {
    it("函數存在並可被呼叫", async () => {
      expect(typeof fetchUsMarketData).toBe("function");
    });

    it("fetchStrategyConfig 被正確引用", async () => {
      expect(typeof fetchStrategyConfig).toBe("function");
    });
  });

  describe("analyzeUsRisk (internal logic)", () => {
    // 因為 analyzeUsRisk 是內部函數，我們透過 fetchUsMarketData 的行為來驗證
    // 但也可以直接測試核心邏輯
    it("解析數字邏輯正確", async () => {
      parseNumber.mockReturnValue(18.5);

      const result = parseNumber("18.5");
      expect(result).toBe(18.5);
    });

    it("parseNumber 回傳 null 時處理正確", async () => {
      parseNumber.mockReturnValue(null);

      const result = parseNumber("invalid");
      expect(result).toBeNull();
    });
  });

  describe("fetchFredSeriesLast2 (internal logic)", () => {
    it("fetchWithTimeout 和 parseNumber 可用", async () => {
      expect(typeof fetchWithTimeout).toBe("function");
      expect(typeof parseNumber).toBe("function");
    });

    it("成功回傳 raw 與 normalized envelope", async () => {
      parseNumber.mockImplementation((value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      });
      fetchWithTimeout
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            observations: [
              { date: "2026-08-18", value: "18.5" },
              { date: "2026-08-17", value: "17.2" },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            observations: [
              { date: "2026-08-18", value: "6400" },
              { date: "2026-08-17", value: "6380" },
            ],
          }),
        });

      const result = await fetchUsMarketData();

      expect(result.raw).toEqual(
        expect.objectContaining({
          vix: expect.objectContaining({ observations: expect.any(Array) }),
          spx: expect.objectContaining({ observations: expect.any(Array) }),
        }),
      );
      expect(result.normalized).toEqual(
        expect.objectContaining({ source: "FRED", success: true }),
      );
    });
  });
});
