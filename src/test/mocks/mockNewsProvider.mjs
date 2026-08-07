/**
 * Mock News Provider Factory
 * 建立符合 INewsProvider 介面的 Mock 物件
 */

import { vi } from "vitest";

/**
 * 建立預設 Market Data
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
 * 建立預設 Raw News Result
 */
function createMockRawNewsResult(overrides = {}) {
  return {
    articles: [
      {
        title: "測試新聞標題 1",
        url: "https://example.com/news1",
        source: "source1",
        publishedAt: "2026-08-06T10:00:00Z",
        content: "測試新聞內容 1",
      },
      {
        title: "測試新聞標題 2",
        url: "https://example.com/news2",
        source: "source2",
        publishedAt: "2026-08-06T11:00:00Z",
        content: "測試新聞內容 2",
      },
    ],
    metrics: {
      keywordYieldRate: 0.5,
      matchedQueryCount: 5,
      totalQueryCount: 10,
      dynamicMatchedQueryCount: 3,
      dynamicQueryCount: 5,
      dynamicKeywordYieldRate: 0.6,
    },
    ...overrides,
  };
}

/**
 * 建立 Mock News Provider
 * @param overrides 覆蓋預設行為的物件
 * @returns 符合 INewsProvider 介面的 Mock 物件
 */
export function createMockNewsProvider(overrides = {}) {
  return {
    // Data Access
    getLatestMarketData: vi
      .fn()
      .mockResolvedValue(createMockMarketData(overrides.marketData)),
    updatePool: vi.fn().mockResolvedValue({
      appended: 5,
      expired: 2,
      skipped_fuzzy: 1,
      total: 100,
      sourceCounts: { source1: 3, source2: 2 },
      sourceCount: 2,
    }),
    purgeExpiredFromPool: vi.fn().mockResolvedValue(2),

    // AI Operations
    generateDailySearchQueries: vi.fn().mockResolvedValue({
      twQueries: ["0050 股價", "台股 ETF", "00675L"],
      usQueries: ["TQQQ", "SOXL", "VIX"],
      traceId: "mock-search-trace-" + Date.now(),
    }),
    getRawNews: vi
      .fn()
      .mockResolvedValue(createMockRawNewsResult(overrides.rawNewsResult)),

    // Langfuse
    score: vi.fn().mockResolvedValue(undefined),

    // 允許覆蓋特定方法
    ...overrides,
  };
}
