import { describe, it, expect } from "vitest";
import { dedupeByUrl, categorizeRegion, isTaiwanMarket } from "./newsMatch.js";

describe("newsMatch", () => {
  describe("dedupeByUrl", () => {
    it("依 URL 去重，保留第一次出現的文章", () => {
      const articles = [
        { id: 1, url: "https://example.com/a", title: "A" },
        { id: 2, url: "https://example.com/b", title: "B" },
        { id: 3, url: "https://example.com/a", title: "A-duplicate" },
        { id: 4, url: "https://example.com/c", title: "C" },
      ];
      const result = dedupeByUrl(articles);
      expect(result).toHaveLength(3);
      expect(result.map((a) => a.id)).toEqual([1, 2, 4]);
    });

    it("支援 link 欄位作為鍵（NewsView 回退欄位）", () => {
      const articles = [
        { id: 1, link: "https://example.com/x", title: "X" },
        { id: 2, link: "https://example.com/x", title: "X-dup" },
      ];
      expect(dedupeByUrl(articles)).toHaveLength(1);
    });

    it("空陣列回傳空陣列", () => {
      expect(dedupeByUrl([])).toEqual([]);
    });
  });

  describe("isTaiwanMarket", () => {
    it("台灣來源回傳 true", () => {
      expect(isTaiwanMarket({ source: "鉅亨網" })).toBe(true);
      expect(isTaiwanMarket({ source: "ETtoday新聞雲" })).toBe(true);
      expect(isTaiwanMarket({ source: "自由財經" })).toBe(true);
    });

    it("非台灣來源回傳 false", () => {
      expect(isTaiwanMarket({ source: "Bloomberg" })).toBe(false);
      expect(isTaiwanMarket({ source: "Reuters" })).toBe(false);
      expect(isTaiwanMarket({ source: "" })).toBe(false);
    });
  });

  describe("categorizeRegion", () => {
    it("台灣文章分類為 tw", () => {
      expect(categorizeRegion({ source: "鉅亨網" })).toBe("tw");
    });

    it("非台灣文章分類為 us", () => {
      expect(categorizeRegion({ source: "Bloomberg" })).toBe("us");
    });
  });
});
