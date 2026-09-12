import { describe, it, expect } from "vitest";
import {
  calculateSentimentIndicators,
  calculateDivergence,
  generateDailySnapshot,
} from "../../modules/sentiment/sentimentEngine.mjs";

describe("Phase 1: sentimentEngine (TDD)", () => {
  describe("calculateSentimentIndicators", () => {
    it("當歷史資料為空時應回傳資料累積中", () => {
      const result = calculateSentimentIndicators([]);
      expect(result.date).toBe("資料累積中");
      expect(result.score).toBe(0.0);
      expect(result["3d_ma"]).toBe("資料累積中");
      expect(result["7d_ma"]).toBe("資料累積中");
      expect(result.signals).toEqual([]);
    });

    it("應正確去重同日資料並計算 3D MA 與 7D MA", () => {
      const mockHistory = [
        { date: "2026-09-01", score: 50 },
        { date: "2026-09-02", score: 60 },
        { date: "2026-09-03", score: 70 }, // 3D MA = (50+60+70)/3 = 60.0
        { date: "2026-09-04", score: 80 },
        { date: "2026-09-05", score: 65 },
        { date: "2026-09-06", score: 55 },
        { date: "2026-09-07", score: 75 }, // 7D MA = (50+60+70+80+65+55+75)/7 = 65.0
      ];

      const res = calculateSentimentIndicators(mockHistory);
      expect(res.date).toBe("2026-09-07");
      expect(res.score).toBe(75);
      expect(res["3d_ma"]).toBeCloseTo((65 + 55 + 75) / 3, 2);
      expect(res["7d_ma"]).toBeCloseTo(65.0, 2);
    });

    it("應識別 VOLATILITY_SPIKE (今日與昨日差距超過 10)", () => {
      const mockHistory = [
        { date: "2026-09-01", score: 50 },
        { date: "2026-09-02", score: 65 }, // 跳動 +15
      ];
      const res = calculateSentimentIndicators(mockHistory);
      expect(res.signals.some((s) => s.type === "VOLATILITY_SPIKE")).toBe(true);
    });

    it("應識別 GOLDEN_CROSS (3D MA 向上突破 7D MA 差距 >= 2.0)", () => {
      // 構造前日 3d <= 7d，今日 3d > 7d (gap >= 2)
      const mockHistory = [
        { date: "2026-09-01", score: 50 },
        { date: "2026-09-02", score: 50 },
        { date: "2026-09-03", score: 50 },
        { date: "2026-09-04", score: 50 },
        { date: "2026-09-05", score: 50 },
        { date: "2026-09-06", score: 50 },
        { date: "2026-09-07", score: 50 }, // 7d=50, 3d=50
        { date: "2026-09-08", score: 90 }, // 3d=(50+50+90)/3=63.3, 7d=(50*6+90)/7=55.7 -> gap=7.6
      ];
      const res = calculateSentimentIndicators(mockHistory);
      expect(res.signals.some((s) => s.type === "GOLDEN_CROSS")).toBe(true);
    });
  });

  describe("calculateDivergence", () => {
    it("當價格資料不足 10 天時應回傳資料不足", () => {
      const res = calculateDivergence([], [{ date: "2026-09-01", close: 100 }]);
      expect(res.status).toBe("資料不足");
      expect(res.detail).toContain("不足10日");
    });

    it("當 7D MA > 80 且價格未創新高時應觸發 BEARISH_DIVERGENCE", () => {
      const sentimentHistory = Array.from({ length: 8 }, (_, i) => ({
        date: `2026-09-0${i + 1}`,
        score: 85,
      }));
      // 10 天價格，前幾天創高 150，今日回檔至 140 (未創新高)
      const priceHistory = [
        { date: "2026-09-01", close: 130 },
        { date: "2026-09-02", close: 135 },
        { date: "2026-09-03", close: 140 },
        { date: "2026-09-04", close: 145 },
        { date: "2026-09-05", close: 150 }, // 最高
        { date: "2026-09-06", close: 148 },
        { date: "2026-09-07", close: 145 },
        { date: "2026-09-08", close: 142 },
        { date: "2026-09-09", close: 141 },
        { date: "2026-09-10", close: 140 }, // 今日未創新高
      ];

      const res = calculateDivergence(sentimentHistory, priceHistory, 10);
      expect(res.status).toBe("觸發");
      expect(res.type).toBe("BEARISH_DIVERGENCE");
    });
  });

  describe("generateDailySnapshot", () => {
    it("應產出符合 SocialSentimentProvider 契約結構的 JSON 物件", () => {
      const sentimentHistory = [
        {
          date: "2026-09-01",
          score: 60,
          topic_names: ["台積電", "AI"],
          items: [
            {
              title: "台積電衝高",
              source: "PTT",
              sentiment: "BULLISH",
              url: "http://ptt",
            },
          ],
        },
      ];
      const snapshot = generateDailySnapshot(sentimentHistory, []);
      expect(snapshot).toHaveProperty("date");
      expect(snapshot).toHaveProperty("score");
      expect(snapshot).toHaveProperty("ma3");
      expect(snapshot).toHaveProperty("ma7");
      expect(snapshot).toHaveProperty("divergenceStatus");
      expect(snapshot).toHaveProperty("signals");
      expect(snapshot).toHaveProperty("hotTopics");
    });
  });
});
