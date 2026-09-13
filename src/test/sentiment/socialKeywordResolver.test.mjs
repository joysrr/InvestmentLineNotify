import { describe, it, expect, vi } from "vitest";
import { resolveSocialKeywords } from "../../modules/sentiment/socialKeywordResolver.mjs";

describe("socialKeywordResolver (TDD)", () => {
  it("當無自訂關鍵字時，應從 baseTwQueries 提取精煉社群關鍵字並包含核心標的", () => {
    const keywords = resolveSocialKeywords();

    // 應包含投資組合核心標的
    expect(keywords).toContain("台股");
    expect(keywords).toContain("0050");
    expect(keywords).toContain("00675L");
    expect(keywords).toContain("台積電");

    // 應從 baseTwQueries 提煉出重點籌碼/流動性詞彙
    expect(keywords).toContain("外資");
    expect(keywords).toContain("三大法人");

    // 長度應控制在合適區間 (避免 API 呼叫過多或過慢，例如 6-10 組)
    expect(keywords.length).toBeGreaterThanOrEqual(5);
    expect(keywords.length).toBeLessThanOrEqual(12);
  });

  it("當有動態 AI 關鍵字傳入時，應與核心關鍵字融合去重", () => {
    const dynamicInput = ["聯發科", "AI晶片", "台積電"];
    const keywords = resolveSocialKeywords({ dynamicKeywords: dynamicInput });

    expect(keywords).toContain("聯發科");
    expect(keywords).toContain("AI晶片");
    expect(keywords).toContain("0050");

    // 不應出現重複詞
    const unique = new Set(keywords);
    expect(unique.size).toBe(keywords.length);
  });

  it("當使用者明確傳入自訂完整清單時，應優先使用該清單", () => {
    const custom = ["自訂詞A", "自訂詞B"];
    const keywords = resolveSocialKeywords({ customKeywords: custom });
    expect(keywords).toEqual(["自訂詞A", "自訂詞B"]);
  });
});
