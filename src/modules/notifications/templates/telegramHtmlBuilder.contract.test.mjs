import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const templatePath = new URL("./telegramHtmlBuilder.mjs", import.meta.url);

describe("Telegram 技術訊號欄位契約", () => {
  it("應使用賣出訊號的正式欄位名稱", async () => {
    const source = await readFile(templatePath, "utf8");

    expect(source).toContain("s.flags.rsiOverbought");
    expect(source).toContain("s.flags.kdOverbought");
    expect(source).toContain("s.flags.macdDeadCross");
    expect(source).not.toContain("s.flags.rsiSell");
    expect(source).not.toContain("s.flags.kdSell");
    expect(source).not.toContain("s.flags.macdSell");
  });

  it("近期轉弱文案應與 TechnicalView 一致", async () => {
    const source = await readFile(templatePath, "utf8");

    expect(source).toContain('name: "RSI 近期轉弱"');
    expect(source).toContain('name: "KD(保守)近期轉弱"');
  });

  it("應匯出 buildNonTradingDayMessage 且格式符合休市情報卡規範", async () => {
    const { buildNonTradingDayMessage } =
      await import("./telegramHtmlBuilder.mjs");
    expect(typeof buildNonTradingDayMessage).toBe("function");

    const mockData = {
      usRisk: { riskLevel: "低風險", vix: "14.5", spxChg: "+0.5%" },
      macroData: { fx: { usdTwd: 32.1 } },
      newsSummaryText: "美股持平，科技股動能延續",
      newsStructured: {
        tw: [{ title: "台積電最新進展", summary: "產能利用率維持高檔" }],
        us: [{ title: "聯準會最新動向", summary: "降息預期明朗" }],
      },
      lastState: { totalValue: 1500000 },
      vixData: { value: 15.0 },
    };

    const messages = buildNonTradingDayMessage(
      mockData,
      "https://example.com/miniapp",
    );
    expect(Array.isArray(messages)).toBe(true);
    expect(messages.length).toBe(1);

    const card = messages[0];
    expect(card.webAppUrl).toBe("https://example.com/miniapp");
    expect(card.text).toContain("休市");
    expect(card.text).toContain("市場情報觀測");
    expect(card.text).toContain("台積電最新進展");
  });
});
