/**
 * Mock Data Provider Factory
 * 建立符合 IDataProvider 介面的 Mock 物件
 */

import { vi } from "vitest";

/**
 * 建立預設 Mock 報告
 */
function createMockReport(overrides = {}) {
  return {
    date: "2026-08-06",
    marketState: {
      valuation: {},
      sentiment: { vix: 15.99 },
      liquidity: {},
      economy: {},
    },
    signals: {
      status: "觀望",
      score: 65,
      target: "🔹 0050 DCA",
      suggestion: "維持觀望",
      latchNowActive: false,
    },
    strategySnapshot: {
      lifecycle: { currentAge: 40, retirementAge: 65 },
      profiles: {},
    },
    ai: {},
    portfolio: {
      totalValue: 1000000,
      qty0050: 10000,
      qtyZ2: 5000,
      cash: 50000,
      totalLoan: 800000,
      lastBuyDate: "2026-01-15",
    },
    price0050: 175,
    currentPrice: 275,
    VIX: 15.99,
    ...overrides,
  };
}

/**
 * 建立預設 Mock 市場資料
 */
function createMockMarketData(overrides = {}) {
  return {
    _meta: {},
    data: {
      rawUsMarket: { vix: "15.99" },
      ...overrides,
    },
  };
}

/**
 * 建立 Mock Data Provider
 * @param overrides 覆蓋預設行為的物件
 * @returns 符合 IDataProvider 介面的 Mock 物件
 */
export function createMockDataProvider(overrides = {}) {
  const mockReport = createMockReport(overrides.latestReport);
  const mockMarketData = createMockMarketData(overrides.marketData);
  const mockReports = overrides.reports ?? [createMockReport()];
  const mockHistory = overrides.history ?? [];
  const mockStrategyConfig = overrides.strategyConfig ?? {
    version: "2.0",
    defense: {},
  };
  const mockBlacklist = overrides.blacklist ?? { titleBlackListPatterns: [] };
  const mockValuationGuardState = overrides.valuationGuardState ?? {
    defenseLatch: false,
  };

  return {
    // Reports
    getLatestReport: vi.fn().mockResolvedValue(mockReport),
    getLatestMarketData: vi.fn().mockResolvedValue(mockMarketData),
    saveReport: vi.fn().mockResolvedValue(undefined),
    saveValuationGuardState: vi.fn().mockResolvedValue(undefined),
    loadRecentReports: vi.fn().mockResolvedValue(mockReports),

    // Market History
    getStockHistory: vi.fn().mockResolvedValue(mockHistory),
    listArchiveDates: vi
      .fn()
      .mockResolvedValue([
        "2026-08-01",
        "2026-08-02",
        "2026-08-03",
        "2026-08-04",
        "2026-08-05",
        "2026-08-06",
      ]),

    // News
    updatePool: vi.fn().mockResolvedValue({
      appended: 5,
      expired: 2,
      skipped_fuzzy: 1,
      total: 100,
      sourceCounts: { source1: 3, source2: 2 },
      sourceCount: 2,
    }),
    purgeExpiredFromPool: vi.fn().mockResolvedValue(2),

    // Config
    getStrategyConfig: vi.fn().mockResolvedValue(mockStrategyConfig),
    saveStrategyConfig: vi.fn().mockResolvedValue(undefined),
    getBlacklist: vi.fn().mockResolvedValue(mockBlacklist),

    // Valuation Guard
    getValuationGuardState: vi.fn().mockResolvedValue(mockValuationGuardState),

    // 允許覆蓋特定方法
    ...overrides,
  };
}

export { createMockReport, createMockMarketData };
