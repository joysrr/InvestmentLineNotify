import { describe, it, expect, vi } from "vitest";

describe("runSocialSentimentFetch - Native Implementation (Phase 3)", () => {
  it("應能調用原生 collectSocialSentiment 與 generateDailySnapshot 並成功產生快照", async () => {
    vi.doMock("../modules/sentiment/socialCollector.mjs", () => ({
      collectSocialSentiment: vi.fn().mockResolvedValue({
        date: "2026-09-12",
        score: 65,
        itemsCount: 5,
      }),
      DEFAULT_NEWS_HISTORY_PATH: "/tmp/mock_news_history.jsonl",
    }));

    vi.doMock("../modules/sentiment/sentimentEngine.mjs", () => ({
      generateDailySnapshot: vi.fn().mockReturnValue({
        date: "2026-09-12",
        score: 65,
        ma3: 62.5,
        ma7: 60.0,
        divergenceStatus: "NONE",
        signals: [],
        hotTopics: [],
      }),
    }));

    vi.resetModules();
    const { runSocialSentimentFetch } =
      await import("../runSocialSentimentFetch.mjs");

    const result = await runSocialSentimentFetch();

    expect(result.success).toBe(true);
    expect(result.snapshot).toBeDefined();
    expect(result.snapshot.score).toBe(65);
    expect(result.outputPath).toContain("social_sentiment_daily.json");
  });

  it("當採集或計算過程發生例外時，應優雅捕捉並回傳 success: false 與 error 訊息", async () => {
    vi.doMock("../modules/sentiment/socialCollector.mjs", () => ({
      collectSocialSentiment: vi
        .fn()
        .mockRejectedValue(new Error("Network timeout")),
      DEFAULT_NEWS_HISTORY_PATH: "/tmp/mock_news_history.jsonl",
    }));

    vi.resetModules();
    const { runSocialSentimentFetch } =
      await import("../runSocialSentimentFetch.mjs");

    const result = await runSocialSentimentFetch();

    expect(result.success).toBe(false);
    expect(result.error).toContain("Network timeout");
  });
});
