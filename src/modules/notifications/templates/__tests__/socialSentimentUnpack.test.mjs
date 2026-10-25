import { describe, it, expect } from "vitest";
import { buildNonTradingDayMessage } from "../telegramHtmlBuilder.mjs";

describe("buildNonTradingDayMessage socialSentiment.data unpack", () => {
  it("should read score from nested data.score for trend display", () => {
    const msg = buildNonTradingDayMessage(
      {
        usRisk: {},
        macroData: {},
        newsStructured: { tw: [], us: [] },
        socialSentiment: {
          success: true,
          data: { score: 75, scoreLabel: "偏多" },
        },
        newsSummaryText: "test summary",
        lastState: { totalValue: 1500000 },
      },
      "https://example.com/app",
    );
    expect(Array.isArray(msg)).toBe(true);
    expect(msg[0].text).toMatch(/偏多|多|75/);
  });

  it("should show 無即時社群數據 when socialSentiment is null", () => {
    const msg = buildNonTradingDayMessage(
      {
        usRisk: {},
        macroData: {},
        newsStructured: { tw: [], us: [] },
        socialSentiment: null,
        newsSummaryText: "",
        lastState: {},
      },
      "https://example.com/app",
    );
    expect(msg[0].text).toContain("無即時社群數據");
  });
});
