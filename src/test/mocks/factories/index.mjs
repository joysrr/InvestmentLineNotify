/**
 * Factories 統一導出
 * 所有測試資料 Factory 的單一入口
 */

export {
  createMockReport,
  createMockReports,
  createMockMarketData,
  createMockStrategyConfig,
  createMockBlacklist,
  createMockValuationGuardState,
  createMockInvestmentResult,
  createMockAiAdviceResult,
  createMockSearchQueriesResult,
  createMockAiSummaryResult,
  createMockOptimizerResult,
  createMockPeriodStats,
  createMockAccuracyStats,
  createMockTelegramMessages,
  createMockPoolUpdateResult,
  createMockRawNewsResult,
} from "./testDataFactory.mjs";
