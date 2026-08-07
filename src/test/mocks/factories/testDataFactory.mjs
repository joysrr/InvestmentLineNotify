/**
 * 測試資料 Factory Functions
 * 建立各種測試所需的 Mock 資料物件
 */

/**
 * 建立 Mock 報告
 */
export function createMockReport(overrides = {}) {
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
 * 建立多份 Mock 報告陣列
 */
export function createMockReports(count = 7, baseDate = "2026-08-06") {
  const reports = [];
  const base = new Date(baseDate);
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    reports.push(createMockReport({ date: dateStr }));
  }
  return reports;
}

/**
 * 建立 Mock 市場資料
 */
export function createMockMarketData(overrides = {}) {
  return {
    _meta: {},
    data: {
      rawUsMarket: { vix: "15.99" },
      ...overrides,
    },
  };
}

/**
 * 建立 Mock 策略設定
 */
export function createMockStrategyConfig(overrides = {}) {
  return {
    version: "2.0",
    description: "測試策略設定",
    defense: { enableDefenseLatch: true },
    buy: { minDropPercentToConsider: 2, minWeightScoreToBuy: 50 },
    sell: { minUpPercentToSell: 3 },
    allocation: [
      { minScore: 0, leverage: 1.0, cash: 0.5, comment: "現金為主" },
      { minScore: 50, leverage: 1.5, cash: 0.3, comment: "適度槓桿" },
      { minScore: 80, leverage: 2.0, cash: 0.1, comment: "高槓桿" },
    ],
    ...overrides,
  };
}

/**
 * 建立 Mock 黑名單
 */
export function createMockBlacklist(overrides = {}) {
  return {
    titleBlackListPatterns: ["測試黑名單", "垃圾訊息"],
    ...overrides,
  };
}

/**
 * 建立 Mock Valuation Guard State
 */
export function createMockValuationGuardState(overrides = {}) {
  return {
    defenseLatch: false,
    latchTriggeredAt: null,
    latchTriggeredPR: null,
    ...overrides,
  };
}

/**
 * 建立 Mock Investment Result
 */
export function createMockInvestmentResult(overrides = {}) {
  return {
    signals: {
      status: "觀望",
      score: 65,
      target: "🔹 0050 DCA",
      suggestion: "維持觀望",
      latchNowActive: false,
      signalDirection: "hold",
    },
    marketState: {
      valuation: {},
      sentiment: { vix: 15.99 },
      liquidity: {},
      economy: {},
    },
    strategySnapshot: {
      lifecycle: { currentAge: 40, retirementAge: 65 },
      profiles: {},
    },
    ...overrides,
  };
}

/**
 * 建立 Mock AI Advice Result
 */
export function createMockAiAdviceResult(overrides = {}) {
  return {
    advice: {
      summary: "測試 AI 建議摘要",
      action: "hold",
      confidence: 0.8,
      reasoning: "測試推理過程",
    },
    traceId: "mock-trace-id-" + Date.now(),
    ...overrides,
  };
}

/**
 * 建立 Mock Search Queries Result
 */
export function createMockSearchQueriesResult(overrides = {}) {
  return {
    twQueries: ["0050 股價", "台股 ETF", "00675L"],
    usQueries: ["TQQQ", "SOXL", "VIX"],
    traceId: "mock-search-trace-" + Date.now(),
    ...overrides,
  };
}

/**
 * 建立 Mock Period AI Summary Result
 */
export function createMockAiSummaryResult(overrides = {}) {
  return {
    aiSummary: "測試週期 AI 摘要內容",
    traceId: "mock-summary-trace-" + Date.now(),
    ...overrides,
  };
}

/**
 * 建立 Mock Optimizer Result
 */
export function createMockOptimizerResult(overrides = {}) {
  return {
    tw: { accepted: [{ pattern: "test" }], rejected: [] },
    us: { accepted: [], rejected: [{ pattern: "bad" }] },
    ...overrides,
  };
}

/**
 * 建立 Mock Period Stats
 */
export function createMockPeriodStats(overrides = {}) {
  return {
    period: "weekly",
    totalReports: 7,
    avgScore: 62,
    signalDistribution: { hold: 5, long: 2, short: 0 },
    ...overrides,
  };
}

/**
 * 建立 Mock Accuracy Stats
 */
export function createMockAccuracyStats(overrides = {}) {
  return {
    totalSignals: 7,
    correctPredictions: 5,
    accuracy: 0.71,
    ...overrides,
  };
}

/**
 * 建立 Mock Telegram Messages
 */
export function createMockTelegramMessages(count = 2, overrides = {}) {
  return Array.from({ length: count }, (_, i) => ({
    text: `測試訊息 ${i + 1}`,
    parse_mode: "HTML",
    ...overrides,
  }));
}

/**
 * 建立 Mock Pool Update Result
 */
export function createMockPoolUpdateResult(overrides = {}) {
  return {
    appended: 5,
    expired: 2,
    skipped_fuzzy: 1,
    total: 100,
    sourceCounts: { source1: 3, source2: 2 },
    sourceCount: 2,
    ...overrides,
  };
}

/**
 * 建立 Mock Raw News Result
 */
export function createMockRawNewsResult(overrides = {}) {
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
