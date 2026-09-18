/**
 * News Fetch 排程單元測試
 * 測試 src/scheduler/newsFetch.mjs 的核心邏輯
 */

// Mock external dependencies at the top level
vi.mock("../../../../src/modules/ai/aiClient.mjs", () => ({
  langfuse: { score: vi.fn(), shutdownAsync: vi.fn() },
}));

vi.mock("../../../../src/utils/logger.mjs", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the internal modules that runNewsFetch uses
vi.mock("../../../../src/modules/data/archiveManager.mjs", () => ({
  archiveManager: {
    getLatestMarketData: vi.fn(),
  },
}));

vi.mock("../../../../src/modules/ai/aiCoach.mjs", () => ({
  generateDailySearchQueries: vi.fn(),
}));

vi.mock("../../../../src/modules/newsFetcher.mjs", () => ({
  getRawNews: vi.fn(),
}));

vi.mock("../../../../src/modules/data/newsPoolManager.mjs", () => ({
  updatePool: vi.fn(),
  purgeExpiredFromPool: vi.fn(),
}));

vi.mock("../../../../src/runSocialSentimentFetch.mjs", () => ({
  runSocialSentimentFetch: vi.fn(),
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import { runNewsFetch } from "../../../../src/scheduler/newsFetch.mjs";

describe("NewsFetch Scheduler - 單元測試", () => {
  let mockDataProvider;
  let mockAIProvider;
  let mockNotifier;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDataProvider = {
      archiveManager: {
        getLatestMarketData: vi.fn(),
      },
    };
    mockAIProvider = {
      generateDailySearchQueries: vi.fn(),
    };
    mockNotifier = {
      sendTelegramBatch: vi.fn(),
    };
  });

  it("應成功執行新聞抓取管線並回傳 appended/total", async () => {
    // Arrange
    const mockMarketData = { _meta: {}, data: { rawUsMarket: { vix: 18.5 } } };
    const mockSearchResult = {
      twQueries: ["0050"],
      usQueries: ["TQQQ"],
      traceId: "trace-1",
    };
    const mockRawNewsResult = {
      articles: [
        {
          title: "測試新聞 1",
          url: "https://example.com/1",
          source: "src1",
          publishedAt: "2026-08-06T10:00:00Z",
        },
        {
          title: "測試新聞 2",
          url: "https://example.com/2",
          source: "src2",
          publishedAt: "2026-08-06T11:00:00Z",
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
    };
    const mockUpdatePoolResult = {
      appended: 5,
      expired: 2,
      skipped_fuzzy: 1,
      total: 100,
      sourceCounts: { source1: 3, source2: 2 },
      sourceCount: 2,
    };

    // Mock the archiveManager.getLatestMarketData
    const { archiveManager } =
      await import("../../../../src/modules/data/archiveManager.mjs");
    archiveManager.getLatestMarketData.mockResolvedValue({
      _meta: {},
      data: { rawUsMarket: { vix: 18.5 } },
    });

    // Mock generateDailySearchQueries
    const { generateDailySearchQueries } =
      await import("../../../../src/modules/ai/aiCoach.mjs");
    generateDailySearchQueries.mockResolvedValue({
      twQueries: ["0050"],
      usQueries: ["TQQQ"],
      traceId: "trace-1",
    });

    // Mock getRawNews
    const { getRawNews } =
      await import("../../../../src/modules/newsFetcher.mjs");
    getRawNews.mockResolvedValue({
      articles: [
        {
          title: "測試新聞 1",
          url: "https://example.com/1",
          source: "src1",
          publishedAt: "2026-08-06T10:00:00Z",
        },
        {
          title: "測試新聞 2",
          url: "https://example.com/2",
          source: "src2",
          publishedAt: "2026-08-06T11:00:00Z",
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
    });

    // Mock updatePool
    const { updatePool } =
      await import("../../../../src/modules/data/newsPoolManager.mjs");
    updatePool.mockResolvedValue({
      appended: 5,
      expired: 2,
      skipped_fuzzy: 1,
      total: 100,
      sourceCounts: { source1: 3, source2: 2 },
      sourceCount: 2,
    });

    // Mock langfuse.score
    const { langfuse } =
      await import("../../../../src/modules/ai/aiClient.mjs");
    langfuse.score.mockResolvedValue(undefined);

    // Act
    const result = await runNewsFetch({});

    // Assert
    expect(result).toHaveProperty("appended");
    expect(result).toHaveProperty("total");
    expect(typeof result.appended).toBe("number");
    expect(typeof result.total).toBe("number");
  });

  it("新聞流程完成後應更新社群情緒快照", async () => {
    const { archiveManager } =
      await import("../../../../src/modules/data/archiveManager.mjs");
    archiveManager.getLatestMarketData.mockResolvedValue({
      data: { rawUsMarket: { vix: 18.5 } },
    });

    const { generateDailySearchQueries } =
      await import("../../../../src/modules/ai/aiCoach.mjs");
    generateDailySearchQueries.mockResolvedValue({
      twQueries: ["0050"],
      usQueries: [],
      traceId: null,
    });

    const { getRawNews } =
      await import("../../../../src/modules/newsFetcher.mjs");
    getRawNews.mockResolvedValue({ articles: [], metrics: {} });

    const { runSocialSentimentFetch } =
      await import("../../../../src/runSocialSentimentFetch.mjs");
    runSocialSentimentFetch.mockResolvedValue({ success: true });

    await runNewsFetch({});

    expect(runSocialSentimentFetch).toHaveBeenCalledOnce();
  });

  it("社群情緒更新失敗時不應阻斷新聞流程", async () => {
    const { archiveManager } =
      await import("../../../../src/modules/data/archiveManager.mjs");
    archiveManager.getLatestMarketData.mockResolvedValue({ data: {} });

    const { generateDailySearchQueries } =
      await import("../../../../src/modules/ai/aiCoach.mjs");
    generateDailySearchQueries.mockResolvedValue({
      twQueries: ["0050"],
      usQueries: [],
      traceId: null,
    });

    const { getRawNews } =
      await import("../../../../src/modules/newsFetcher.mjs");
    getRawNews.mockResolvedValue({ articles: [], metrics: {} });

    const { runSocialSentimentFetch } =
      await import("../../../../src/runSocialSentimentFetch.mjs");
    runSocialSentimentFetch.mockRejectedValue(
      new Error("sentiment unavailable"),
    );

    await expect(runNewsFetch({})).resolves.toEqual({ appended: 0, total: 0 });
  });

  it("無有效文章時應回傳 appended: 0, total: 0", async () => {
    // Arrange
    const { archiveManager } =
      await import("../../../../src/modules/data/archiveManager.mjs");
    archiveManager.getLatestMarketData.mockResolvedValue({
      _meta: {},
      data: { rawUsMarket: { vix: 18.5 } },
    });

    const { generateDailySearchQueries } =
      await import("../../../../src/modules/ai/aiCoach.mjs");
    generateDailySearchQueries.mockResolvedValue({
      twQueries: ["0050"],
      usQueries: ["TQQQ"],
      traceId: "trace-1",
    });

    const { getRawNews } =
      await import("../../../../src/modules/newsFetcher.mjs");
    getRawNews.mockResolvedValue({
      articles: [],
      metrics: {
        keywordYieldRate: 0,
        matchedQueryCount: 0,
        totalQueryCount: 10,
        dynamicMatchedQueryCount: 0,
        dynamicQueryCount: 5,
        dynamicKeywordYieldRate: 0,
      },
    });

    // Act
    const result = await runNewsFetch({});

    // Assert
    expect(result.appended).toBe(0);
    expect(result.total).toBe(0);
  });

  it("市場資料讀取失敗時應使用預設值並繼續執行", async () => {
    // Arrange
    const { archiveManager } =
      await import("../../../../src/modules/data/archiveManager.mjs");
    archiveManager.getLatestMarketData.mockRejectedValue(new Error("DB error"));

    const { generateDailySearchQueries } =
      await import("../../../../src/modules/ai/aiCoach.mjs");
    generateDailySearchQueries.mockResolvedValue({
      twQueries: [],
      usQueries: [],
      traceId: null,
    });

    const { getRawNews } =
      await import("../../../../src/modules/newsFetcher.mjs");
    getRawNews.mockResolvedValue({ articles: [], metrics: {} });

    // Act
    const result = await runNewsFetch({});

    // Assert
    expect(result).toHaveProperty("appended");
    expect(result).toHaveProperty("total");
  });
});
