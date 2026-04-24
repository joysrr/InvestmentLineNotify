import { describe, it, expect } from "vitest";
import {
  validateDynamicKeyword,
  mergeKeywords,
  buildSingleKeywordQueryStr,
} from "../../modules/newsFetcher.mjs";

describe("Keyword Utility Unit Test", () => {
  const mockTwBase = [
    { keyword: "台股", searchType: "intitle" },
    { keyword: "外資", searchType: "broad" },
  ];

  const mockUsBase = [{ keyword: "Fed", searchType: "broad" }];

  describe("validateDynamicKeyword", () => {
    it("應通過正常複合詞", () => {
      expect(
        validateDynamicKeyword({ keyword: "台積電 法說會" }, mockTwBase),
      ).toBe(true);
    });

    it("應拒絕單一全大寫縮寫", () => {
      expect(validateDynamicKeyword({ keyword: "ETF" }, mockTwBase)).toBe(
        false,
      );
    });

    it("應拒絕與靜態池重複項", () => {
      expect(validateDynamicKeyword({ keyword: "外資" }, mockTwBase)).toBe(
        false,
      );
    });

    it("應拒絕過長詞彙 (> 4 words)", () => {
      expect(
        validateDynamicKeyword(
          { keyword: "today US stock market analysis news" },
          mockUsBase,
        ),
      ).toBe(false);
    });
  });

  describe("mergeKeywords", () => {
    it("應合併合法項並過濾非法項", () => {
      const dynamic = [
        { keyword: "台積電 法說" }, // OK
        { keyword: "ETF" }, // Fail
        { keyword: "台股" }, // Fail (Duplicate)
      ];
      const result = mergeKeywords(mockTwBase, dynamic);
      expect(result.length).toBe(mockTwBase.length + 1);
      expect(result.some((r) => r.keyword === "台積電 法說")).toBe(true);
    });
  });

  describe("buildSingleKeywordQueryStr", () => {
    it("intitle 應產生正確格式", () => {
      const result = buildSingleKeywordQueryStr({
        keyword: "台積電",
        searchType: "intitle",
      });
      expect(result).toContain('intitle:"台積電"');
    });

    it("應包含時間限制", () => {
      const result = buildSingleKeywordQueryStr({ keyword: "台積電" });
      expect(result).toContain("+when:");
    });

    it("應正確處理排除列表", () => {
      const exclude = [{ keyword: "排行", searchType: "intitle" }];
      const result = buildSingleKeywordQueryStr({ keyword: "外資" }, exclude);
      expect(result).toContain('-intitle:"排行"');
    });
  });
});
