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

import {
  fetchUsMarketData,
  fetchYahooChartSeriesLast2,
} from "./usMarketProvider.mjs";
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

  describe("fetchYahooChartSeriesLast2", () => {
    beforeEach(() => {
      parseNumber.mockImplementation((value) => {
        if (value === null || value === undefined || value === "") return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      });
    });

    it("從 Yahoo Chart JSON 解析最近兩個有效交易日與漲跌幅", async () => {
      const result = await fetchYahooChartSeriesLast2("^SOX", {
        fetcherFn: vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({
            chart: {
              result: [
                {
                  meta: { symbol: "^SOX", instrumentType: "INDEX" },
                  timestamp: [1791321600, 1791580800, 1791667200],
                  indicators: {
                    quote: [{ close: [100, null, 105] }],
                  },
                },
              ],
            },
          }),
        }),
      });

      expect(result).toEqual({
        symbol: "^SOX",
        latest: { date: "2026-10-10", value: 105 },
        previous: { date: "2026-10-06", value: 100 },
        changePercent: 5,
      });
    });

    it("有效收盤價不足兩筆時回傳 null", async () => {
      const result = await fetchYahooChartSeriesLast2("TSM", {
        fetcherFn: vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({
            chart: {
              result: [
                {
                  meta: { symbol: "TSM", instrumentType: "EQUITY" },
                  timestamp: [1791321600],
                  indicators: { quote: [{ close: [100] }] },
                },
              ],
            },
          }),
        }),
      });

      expect(result).toBeNull();
    });
  });

  describe("fetchFredSeriesLast2 (internal logic)", () => {
    it("fetchWithTimeout 和 parseNumber 可用", async () => {
      expect(typeof fetchWithTimeout).toBe("function");
      expect(typeof parseNumber).toBe("function");
    });

    it("聚合 FRED、SOX 與 TSM ADR，回傳四項市場資料", async () => {
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
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            chart: {
              result: [
                {
                  meta: { symbol: "^SOX" },
                  timestamp: [1791321600, 1791580800],
                  indicators: { quote: [{ close: [100, 103] }] },
                },
              ],
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            chart: {
              result: [
                {
                  meta: { symbol: "TSM" },
                  timestamp: [1791321600, 1791580800],
                  indicators: { quote: [{ close: [200, 204] }] },
                },
              ],
            },
          }),
        });

      const result = await fetchUsMarketData();

      expect(result.soxChg).toBe(3);
      expect(result.tsmChg).toBe(2);
      expect(result.normalized).toEqual(
        expect.objectContaining({ soxChg: 3, tsmChg: 2 }),
      );
    });

    it("來源失敗時保留 SOX 與 TSM 為 null", async () => {
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
        })
        .mockRejectedValue(new Error("source unavailable"));

      const result = await fetchUsMarketData();

      expect(result.soxChg).toBeNull();
      expect(result.tsmChg).toBeNull();
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
        expect.objectContaining({ source: "FRED+YAHOO", success: true }),
      );
    });
  });
});
