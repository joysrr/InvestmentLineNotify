/**
 * Mock Report Generator Factory
 * 建立符合 IReportGenerator 介面的 Mock 物件
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
    },
    strategySnapshot: {
      lifecycle: { currentAge: 40, retirementAge: 65 },
      profiles: {},
    },
    ai: {},
    ...overrides,
  };
}

/**
 * 建立預設 Period Stats
 */
function createMockPeriodStats(overrides = {}) {
  return {
    period: "weekly",
    totalReports: 7,
    avgScore: 62,
    signalDistribution: { hold: 5, long: 2, short: 0 },
    ...overrides,
  };
}

/**
 * 建立預設 Accuracy Stats
 */
function createMockAccuracyStats(overrides = {}) {
  return {
    totalSignals: 7,
    correctPredictions: 5,
    accuracy: 0.71,
    ...overrides,
  };
}

/**
 * 建立 Mock Report Generator
 * @param overrides 覆蓋預設行為的物件
 * @returns 符合 IReportGenerator 介面的 Mock 物件
 */
export function createMockReportGenerator(overrides = {}) {
  return {
    // Data Access
    loadRecentReports: vi
      .fn()
      .mockResolvedValue([
        createMockReport({ date: "2026-08-06" }),
        createMockReport({ date: "2026-08-05" }),
        createMockReport({ date: "2026-08-04" }),
        createMockReport({ date: "2026-08-03" }),
        createMockReport({ date: "2026-08-02" }),
        createMockReport({ date: "2026-08-01" }),
        createMockReport({ date: "2026-07-31" }),
      ]),

    // Statistics
    buildPeriodStats: vi.fn().mockReturnValue({
      period: "weekly",
      totalReports: 7,
      avgScore: 62,
      signalDistribution: { hold: 5, long: 2, short: 0 },
    }),

    buildSignalAccuracyStats: vi.fn().mockReturnValue({
      totalSignals: 7,
      correctPredictions: 5,
      accuracy: 0.71,
    }),

    // AI Summary
    generateAiSummary: vi.fn().mockResolvedValue("測試週期 AI 摘要內容"),

    // Message Building
    buildMessages: vi.fn().mockReturnValue([
      {
        text: "測試週期報告訊息 1",
        parse_mode: "HTML",
      },
      {
        text: "測試週期報告訊息 2",
        parse_mode: "HTML",
      },
    ]),

    // 允許覆蓋特定方法
    ...overrides,
  };
}
