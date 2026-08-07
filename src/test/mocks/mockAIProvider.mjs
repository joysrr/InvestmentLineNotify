/**
 * Mock AI Provider Factory
 * 建立符合 IAIProvider 介面的 Mock 物件
 */

import { vi } from "vitest";

/**
 * 建立預設 Investment Result
 */
function createMockInvestmentResult(overrides = {}) {
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
 * 建立預設 AI Advice Result
 */
function createMockAiAdviceResult(overrides = {}) {
  return {
    advice: {
      summary: "測試 AI 建議",
      action: "hold",
      confidence: 0.8,
      reasoning: "測試推理過程",
    },
    traceId: "mock-trace-id-" + Date.now(),
    ...overrides,
  };
}

/**
 * 建立預設 Search Queries Result
 */
function createMockSearchQueriesResult(overrides = {}) {
  return {
    twQueries: ["0050 股價", "台股 ETF", "00675L"],
    usQueries: ["TQQQ", "SOXL", "VIX"],
    traceId: "mock-search-trace-" + Date.now(),
    ...overrides,
  };
}

/**
 * 建立預設 Period AI Summary Result
 */
function createMockAiSummaryResult(overrides = {}) {
  return {
    aiSummary: "測試週期 AI 摘要內容",
    traceId: "mock-summary-trace-" + Date.now(),
    ...overrides,
  };
}

/**
 * 建立預設 Optimizer Result
 */
function createMockOptimizerResult(overrides = {}) {
  return {
    tw: { accepted: [{ pattern: "test" }], rejected: [] },
    us: { accepted: [], rejected: [{ pattern: "bad" }] },
    ...overrides,
  };
}

/**
 * 建立 Mock AI Provider
 * @param overrides 覆蓋預設行為的物件
 * @returns 符合 IAIProvider 介面的 Mock 物件
 */
export function createMockAIProvider(overrides = {}) {
  return {
    // Daily Check
    getInvestmentSignal: vi
      .fn()
      .mockResolvedValue(
        createMockInvestmentResult(overrides.investmentResult),
      ),
    getAiInvestmentAdvice: vi
      .fn()
      .mockResolvedValue(createMockAiAdviceResult(overrides.aiAdviceResult)),
    shouldRunJudge: vi.fn().mockReturnValue(false),
    runJudge: vi.fn().mockResolvedValue(undefined),

    // News Fetch
    generateDailySearchQueries: vi
      .fn()
      .mockResolvedValue(
        createMockSearchQueriesResult(overrides.searchQueriesResult),
      ),

    // Period Reports
    generatePeriodAiSummary: vi
      .fn()
      .mockResolvedValue(createMockAiSummaryResult(overrides.aiSummaryResult)),

    // Optimizer
    runRuleOptimizer: vi
      .fn()
      .mockResolvedValue(createMockOptimizerResult(overrides.optimizerResult)),

    // Langfuse
    score: vi.fn().mockResolvedValue(undefined),
    shutdownAsync: vi.fn().mockResolvedValue(undefined),

    // 允許覆蓋特定方法
    ...overrides,
  };
}
