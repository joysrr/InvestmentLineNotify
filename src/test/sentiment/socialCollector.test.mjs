import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import { collectSocialSentiment } from "../../modules/sentiment/socialCollector.mjs";

describe("socialCollector - Integration Test (Phase 2)", () => {
  it("應能彙整貼文、計分並寫入自訂的 jsonl 歷史檔案", async () => {
    const tmpHistoryPath = path.resolve(
      "/tmp",
      `test_news_history_${Date.now()}.jsonl`,
    );

    // Mock crawlers
    vi.doMock("../../modules/sentiment/crawlers/pttCrawler.mjs", () => ({
      fetchPttStockPosts: vi
        .fn()
        .mockResolvedValue([
          { platform: "PTT", title: "大漲 創高 買超 樂觀", url: "http://ptt" },
        ]),
    }));
    vi.doMock("../../modules/sentiment/crawlers/bskyCrawler.mjs", () => ({
      fetchBskyStockPosts: vi
        .fn()
        .mockResolvedValue([
          { platform: "Bluesky", title: "看好 反彈 走強", url: "http://bsky" },
        ]),
    }));

    vi.resetModules();
    const { collectSocialSentiment: collect } =
      await import("../../modules/sentiment/socialCollector.mjs");

    const result = await collect({ historyPath: tmpHistoryPath });

    expect(result.itemsCount).toBe(2);
    expect(result.score).toBeGreaterThan(60); // 看多分數應偏高
    expect(fs.existsSync(tmpHistoryPath)).toBe(true);

    const content = fs.readFileSync(tmpHistoryPath, "utf-8");
    const parsed = JSON.parse(content.trim());
    expect(parsed.score).toBe(result.score);
    expect(parsed.ptt_items).toBe(1);
    expect(parsed.bsky_items).toBe(1);

    // 清理
    if (fs.existsSync(tmpHistoryPath)) {
      fs.unlinkSync(tmpHistoryPath);
    }
  });
});
