import { describe, it, expect, vi } from "vitest";
import { parsePttStockHtml } from "../../modules/sentiment/crawlers/pttCrawler.mjs";
import { parseBskyPosts } from "../../modules/sentiment/crawlers/bskyCrawler.mjs";
import {
  calcSocialSentimentScore,
  BULL_KEYWORDS,
  BEAR_KEYWORDS,
} from "../../modules/sentiment/crawlers/socialScoreCalculator.mjs";

describe("Phase 2: Crawlers & Social Scoring (TDD)", () => {
  describe("pttCrawler - parsePttStockHtml", () => {
    it("應正確解析 PTT 股版文章列表與上一頁連結", () => {
      const mockHtml = `
        <div class="action-bar">
          <a class="btn wide" href="/bbs/Stock/index7120.html">‹ 上頁</a>
        </div>
        <div class="r-list-container action-bar-margin bbs-screen">
          <div class="r-ent">
            <div class="nrec"><span class="hl f2">15</span></div>
            <div class="title">
              <a href="/bbs/Stock/M.1726000000.A.123.html">[標的] 2330 台積電 多</a>
            </div>
            <div class="meta">
              <div class="author">hero123</div>
              <div class="date"> 9/12</div>
            </div>
          </div>
          <div class="r-ent">
            <div class="nrec"></div>
            <div class="title">
              <a href="/bbs/Stock/M.1726000001.A.456.html">[新聞] 大盤重挫下殺收黑</a>
            </div>
            <div class="meta">
              <div class="author">reporter</div>
              <div class="date"> 9/12</div>
            </div>
          </div>
        </div>
      `;

      const { items, prevUrl } = parsePttStockHtml(
        mockHtml,
        "https://www.ptt.cc",
      );

      expect(prevUrl).toBe("https://www.ptt.cc/bbs/Stock/index7120.html");
      expect(items).toHaveLength(2);
      expect(items[0].platform).toBe("PTT");
      expect(items[0].board).toBe("Stock");
      expect(items[0].title).toBe("[標的] 2330 台積電 多");
      expect(items[0].author).toBe("hero123");
      expect(items[0].url).toBe(
        "https://www.ptt.cc/bbs/Stock/M.1726000000.A.123.html",
      );
    });
  });

  describe("bskyCrawler - parseBskyPosts", () => {
    it("應正確解析 Bluesky 貼文 JSON 結構", () => {
      const mockResponse = {
        posts: [
          {
            uri: "at://did:plc:123/app.bsky.feed.post/456",
            author: { handle: "investor.bsky.social" },
            record: {
              text: "今天 0050 與台積電持續上漲，外資買超創高！",
              createdAt: "2026-09-12T08:00:00.000Z",
            },
          },
        ],
      };

      const items = parseBskyPosts(mockResponse);
      expect(items).toHaveLength(1);
      expect(items[0].platform).toBe("Bluesky");
      expect(items[0].title).toBe("今天 0050 與台積電持續上漲，外資買超創高！");
      expect(items[0].author).toBe("investor.bsky.social");
    });
  });

  describe("socialScoreCalculator", () => {
    it("空陣列應回傳基準分數 50", () => {
      expect(calcSocialSentimentScore([])).toBe(50);
    });

    it("全是看多關鍵字時應給予偏高分數 (>= 75)", () => {
      const bullishItems = [
        { title: "大漲 創高 買超 樂觀 看好" },
        { title: "反彈 走強 突破 多方" },
      ];
      const score = calcSocialSentimentScore(bullishItems);
      expect(score).toBeGreaterThanOrEqual(75);
    });

    it("全是看空關鍵字時應給予偏低分數 (<= 25)", () => {
      const bearishItems = [
        { title: "下跌 大跌 重挫 崩跌 下殺" },
        { title: "賣超 悲觀 跌破 走弱" },
      ];
      const score = calcSocialSentimentScore(bearishItems);
      expect(score).toBeLessThanOrEqual(25);
    });
  });
});
