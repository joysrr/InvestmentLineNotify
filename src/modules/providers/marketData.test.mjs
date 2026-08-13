// src/modules/providers/marketData.test.mjs
// TDD: Market Data Provider 測試

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../data/archiveManager.mjs", () => ({
  archiveManager: {
    getLatestMarketData: vi.fn(),
    saveMarketData: vi.fn(),
  },
}));

vi.mock("./providerRegistry.mjs", () => ({
  providerRegistry: {
    ndcProvider: { fetch: vi.fn(), label: "NDC" },
    marginProvider: { fetch: vi.fn(), label: "Margin" },
    cnnProvider: { fetch: vi.fn(), label: "CNN" },
    usMarketProvider: { fetch: vi.fn(), label: "US Market" },
    twseValuationProvider: { fetch: vi.fn(), label: "TWSE Valuation" },
    fxProvider: { fetch: vi.fn(), label: "FX" },
    quoteProvider: { fetch: vi.fn(), label: "Quote" },
    marketOverviewProvider: { fetch: vi.fn(), label: "Market Overview" },
    institutionalProvider: { fetch: vi.fn(), label: "Institutional" },
    stockMarginProvider: { fetch: vi.fn(), label: "Stock Margin" },
    bankRateProvider: { fetch: vi.fn(), label: "Bank Rate" },
    cpiProvider: { fetch: vi.fn(), label: "CPI" },
  },
}));

vi.mock("./dataSourceConfig.mjs", () => ({
  macroDataSlots: {
    rawNdc: { providerId: "ndcProvider" },
    rawMargin: { providerId: "marginProvider" },
    rawCnn: { providerId: "cnnProvider" },
    rawUsMarket: { providerId: "usMarketProvider" },
    rawValuation: { providerId: "twseValuationProvider" },
    rawFx: { providerId: "fxProvider" },
    quote: { providerId: "quoteProvider" },
    rawMarketOverview: { providerId: "marketOverviewProvider" },
    rawInstitutional: { providerId: "institutionalProvider" },
    rawStockMargin: { providerId: "stockMarginProvider" },
    rawBankRate: { providerId: "bankRateProvider" },
    rawCpi: { providerId: "cpiProvider" },
  },
  SLOT_CRITICALITY: {
    rawNdc: { staleHours: 24, level: "NORMAL" },
    rawMargin: { staleHours: 24, level: "NORMAL" },
    rawCnn: { staleHours: 6, level: "NORMAL" },
    rawUsMarket: { staleHours: 24, level: "NORMAL" },
    rawValuation: { staleHours: 24, level: "NORMAL" },
    rawFx: { staleHours: 0.5, level: "NORMAL" },
    quote: { staleHours: 24, level: "NORMAL" },
    rawMarketOverview: { staleHours: 24, level: "NORMAL" },
    rawInstitutional: { staleHours: 24, level: "NORMAL" },
    rawStockMargin: { staleHours: 24, level: "NORMAL" },
    rawBankRate: { staleHours: 24, level: "NORMAL" },
    rawCpi: { staleHours: 24, level: "NORMAL" },
  },
}));

vi.mock("../../utils/coreUtils.mjs", () => ({
  TwDate: vi.fn(() => ({
    formatDateKey: () => "2024-01-15",
  })),
}));

vi.mock("../notifications/transports/telegramClient.mjs", () => ({
  sendSystemMessage: vi.fn().mockResolvedValue(undefined),
}));

import { fetchAllMacroData } from "./marketData.mjs";
import { archiveManager } from "../data/archiveManager.mjs";

describe("marketData - 總經與籌碼資料統一介面", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("fetchAllMacroData", () => {
    it("驗證函數存在", async () => {
      expect(typeof fetchAllMacroData).toBe("function");
    });

    it("成功執行並回傳資料", async () => {
      // Mock cache return
      archiveManager.getLatestMarketData.mockResolvedValueOnce({
        _meta: {
          lastRun: "2024-01-15T00:00:00Z",
          sources: {},
        },
        data: {},
      });

      // Mock providers to return data
      const { providerRegistry } = await import("./providerRegistry.mjs");
      Object.values(providerRegistry).forEach((p) => {
        p.fetch.mockResolvedValueOnce({ test: "data" });
      });

      const result = await fetchAllMacroData();

      expect(result).toBeDefined();
      expect(archiveManager.saveMarketData).toHaveBeenCalled();
    });

    it("無快取時仍正常執行", async () => {
      archiveManager.getLatestMarketData.mockResolvedValueOnce(null);

      const { providerRegistry } = await import("./providerRegistry.mjs");
      Object.values(providerRegistry).forEach((p) => {
        p.fetch.mockResolvedValueOnce({ test: "data" });
      });

      const result = await fetchAllMacroData();

      expect(result).toBeDefined();
    });
  });
});
