import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCompactMessage } from "../../modules/notifications/templates/telegramHtmlBuilder.mjs";

function build速報Data() {
  return {
    result: {
      signals: {
        marketStatus: "偏空防守",
        macroMarketDirection: "BEARISH",
        target: "P0 基礎 DCA",
        targetSuggestionShort: "維持基礎投入，暫停 P1 條件加碼",
        weightScore: 6.5,
        strategy: { buy: { minWeightScoreToBuy: 8 } },
        bias240: -3.2,
        reversal: { triggeredCount: 1, totalFactor: 4 },
        sellSignals: { signalCount: 0, total: 3 },
      },
    },
    macroAnalysis: {
      conclusion: {
        market_direction: "BEARISH",
        short_summary: "利率與美元上行，流動性緊縮壓力升溫。",
      },
      total_bull_score: 14,
      total_bear_score: 18,
    },
    newsStructured: {
      tw: [
        { title: "台股量能收縮，市場風險偏好轉弱" },
        { title: "外資期貨部位轉為保守" },
        { title: "不應顯示的第三則新聞" },
      ],
      us: [{ title: "美債殖利率與美元同步走高" }],
    },
    vixData: { value: 22.6 },
    usRisk: { spxChg: "-0.25%", vix: "16.04" },
  };
}

describe("Telegram compact market card contract", () => {
  it("shows the canonical trend and investment direction at the top", () => {
    const [{ text }] = buildCompactMessage(
      build速報Data(),
      "https://example.com/app",
    );

    expect(text).toContain("大趨勢：偏空防守");
    expect(text).toContain("投資方向：P0 基礎 DCA");
    expect(text).toContain("維持基礎投入，暫停 P1 條件加碼");
    expect(text).not.toContain("狀態：未知");
  });

  it("shows only the first two curated news headlines", () => {
    const [{ text }] = buildCompactMessage(
      build速報Data(),
      "https://example.com/app",
    );

    expect(text).toContain("台股量能收縮，市場風險偏好轉弱");
    expect(text).toContain("外資期貨部位轉為保守");
    expect(text).not.toContain("不應顯示的第三則新聞");
  });

  it("maps the real daily report schema and curated runtime headlines", () => {
    const report = JSON.parse(
      fs.readFileSync("data/reports/2026-10-01.json", "utf8"),
    );
    const [{ text }] = buildCompactMessage(
      {
        result: report,
        newsMessages: [
          { title: "正式新聞主旨一" },
          { title: "正式新聞主旨二" },
          { title: "不應顯示的第三則正式新聞" },
        ],
      },
      "https://example.com/app",
    );

    expect(text).toContain("大趨勢：正常偏多");
    expect(text).toContain("投資方向：🔹 0050 DCA");
    expect(text).toContain("正式新聞主旨一");
    expect(text).toContain("正式新聞主旨二");
    expect(text).not.toContain("不應顯示的第三則正式新聞");
    expect(text).not.toContain("undefined");
  });

  it("keeps valid zero signal values instead of replacing them with missing data", () => {
    const data = build速報Data();
    data.result.signals.weightScore = 0;
    data.result.signals.reversal = { triggeredCount: 0, totalFactor: 4 };
    data.result.signals.sellSignals = { signalCount: 0, total: 3 };

    const [{ text }] = buildCompactMessage(data, "https://example.com/app");

    expect(text).toContain("評分：0.0pt");
    expect(text).toContain("轉弱：0/4");
    expect(text).toContain("賣出：0/3");
  });
});
