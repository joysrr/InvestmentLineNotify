import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the socialSentimentProvider module factory function
const mockFetchSocialSentiment = vi.fn();

// TDD: Verify dailyRunContext includes socialSentiment in the context
// Mock ALL providers to isolate the dailyRunContext logic
vi.mock("../modules/providers/twseProvider.mjs", () => ({
  getTwVix: vi.fn().mockResolvedValue(null),
  fetchLatestClose: vi.fn().mockResolvedValue(null),
  fetchRealtimeFromMis: vi.fn().mockResolvedValue(null),
  isMarketOpenTodayTWSE: vi.fn().mockResolvedValue(false),
}));
vi.mock("../modules/providers/historyProvider.mjs", () => ({
  fetchStockHistoryWithAutoFillDetailed: vi.fn().mockResolvedValue({
    status: "available",
    data: Array(60).fill({
      date: "2026-09-12",
      close: 100,
      open: 100,
      high: 100,
      low: 100,
      volume: 1000,
    }),
    required: 60,
    count: 60,
    failedMonths: [],
    lastError: null,
  }),
}));
vi.mock("../modules/providers/basePriceProvider.mjs", () => ({
  fetchLatestBasePrice: vi.fn().mockResolvedValue({ basePrice: null }),
}));
vi.mock("../modules/providers/marketData.mjs", () => ({
  fetchAllMacroData: vi.fn().mockResolvedValue({}),
}));
vi.mock("../modules/providers/socialSentimentProvider.mjs", () => ({
  fetchSocialSentimentData: mockFetchSocialSentiment,
}));
vi.mock("../modules/storage.mjs", () => ({
  fetchLastPortfolioState: vi.fn().mockResolvedValue({}),
}));
const mockGetNewsTelegramMessages = vi.fn();
vi.mock("../modules/newsFetcher.mjs", () => ({
  getNewsTelegramMessages: mockGetNewsTelegramMessages,
}));
vi.mock("../modules/ai/aiCoach.mjs", () => ({
  analyzeMacroNewsWithAI: vi.fn().mockResolvedValue({}),
}));
vi.mock("../modules/ai/aiDataPreprocessor.mjs", () => ({
  formatMacroChipForCoach: vi.fn().mockReturnValue(""),
  formatMacroAnalysisForCoach: vi.fn().mockReturnValue(""),
}));
vi.mock("../modules/data/archiveManager.mjs", () => ({
  archiveManager: {
    getLastBuyDate: vi.fn().mockResolvedValue(null),
    getVixHistory: vi.fn().mockResolvedValue([]),
    saveVixHistory: vi.fn().mockResolvedValue(),
    load: vi.fn().mockResolvedValue(null),
  },
}));
vi.mock("../modules/assets/assetRegistry.mjs", () => ({
  getDefaultAssetRegistry: vi.fn().mockReturnValue({}),
  SchemaMapper: class {},
}));
vi.mock("../utils/coreUtils.mjs", () => ({
  stepTimer: vi.fn(() => () => {}),
}));
vi.mock("../utils/logger.mjs", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetNewsTelegramMessages.mockResolvedValue({
    messages: [],
    summaryText: "",
    structured: { tw: [], us: [] },
  });
});

describe("DailyRunContext - Social Sentiment Integration (Phase 4)", () => {
  it("AI 新聞精選失敗時應保留失敗狀態", async () => {
    mockGetNewsTelegramMessages.mockResolvedValueOnce({
      messages: [],
      summaryText: "",
      structured: { tw: [], us: [] },
      analysisStatus: "failed",
    });

    const { buildDailyRunContext } =
      await import("../domain/dailyRunContext.mjs");

    const ctx = await buildDailyRunContext({ isCallAI: true });

    expect(ctx.newsAnalysisStatus).toBe("failed");
  });

  it("應包含 socialSentiment 字段在 buildDailyRunContext 回傳物件中", async () => {
    mockFetchSocialSentiment.mockResolvedValue({
      date: "2026-09-12",
      score: 65.0,
      ma3: 63.0,
      ma7: 58.0,
      divergenceStatus: "NONE",
      signals: [],
      hotTopics: [],
      success: true,
    });

    const { buildDailyRunContext } =
      await import("../domain/dailyRunContext.mjs");

    const ctx = await buildDailyRunContext({ isCallAI: false });

    expect(ctx).toHaveProperty("socialSentiment");
    expect(ctx.socialSentiment).not.toBeNull();
    expect(ctx.socialSentiment.score).toBe(65.0);
    expect(ctx.socialSentiment.ma3).toBe(63.0);
    expect(ctx.socialSentiment.ma7).toBe(58.0);
  });

  it("當 socialSentiment 撈取失敗時，應回傳 null 而不影響其他欄位", async () => {
    mockFetchSocialSentiment.mockRejectedValue(new Error("file not found"));

    const { buildDailyRunContext } =
      await import("../domain/dailyRunContext.mjs");

    const ctx = await buildDailyRunContext({ isCallAI: false });

    expect(ctx).toHaveProperty("socialSentiment");
    expect(ctx.socialSentiment).toBeNull();
  });
});
