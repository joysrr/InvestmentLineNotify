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
});
