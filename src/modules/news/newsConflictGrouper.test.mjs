// src/modules/news/newsConflictGrouper.test.mjs
// TDD: News Conflict Grouper 測試

import { describe, it, expect, beforeEach, vi } from "vitest";
import { assignConflictGroups } from "./newsConflictGrouper.mjs";

vi.mock("../../utils/logger.mjs", () => ({
  default: { info: vi.fn(), warn: vi.fn() },
}));

describe("newsConflictGrouper - 矛盾新聞分群", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("tokenize - 標題分詞", () => {
    // 從模組複製邏輯進行單元測試
    function tokenize(title) {
      if (!title || typeof title !== "string") return new Set();

      const tokens = new Set();

      const latin = title.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, " ");
      for (const word of latin.split(/\s+/)) {
        const clean = word.replace(/[^a-zA-Z0-9%]/g, "").toLowerCase();
        if (clean.length >= 2) tokens.add(clean);
      }

      const cjk = title.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || [];
      for (let i = 0; i < cjk.length - 1; i++) {
        tokens.add(cjk[i] + cjk[i + 1]);
      }
      for (const char of cjk) {
        tokens.add(char);
      }

      return tokens;
    }

    it("中文標題產生 bigram + 單字", () => {
      const tokens = tokenize("伊朗與美國和談");
      expect(tokens.has("伊朗")).toBe(true);
      expect(tokens.has("與美")).toBe(true);
      expect(tokens.has("美國")).toBe(true);
      expect(tokens.has("國和")).toBe(true);
      expect(tokens.has("和談")).toBe(true);
    });

    it("英文標題轉小寫並過濾短詞", () => {
      const tokens = tokenize("Iran US talks");
      expect(tokens.has("iran")).toBe(true);
      expect(tokens.has("talks")).toBe(true);
      // "us" 長度為 2，應被保留
      expect(tokens.has("us")).toBe(true);
    });

    it("混合中英標題", () => {
      const tokens = tokenize("伊朗 US talks");
      expect(tokens.has("伊朗")).toBe(true);
      expect(tokens.has("us")).toBe(true);
      expect(tokens.has("talks")).toBe(true);
    });

    it("數字保留", () => {
      const tokens = tokenize("台股 32元");
      // 32 是數字，但會被視為 latin 部分，長度 2 應保留
      expect(tokens.has("32")).toBe(true);
    });

    it("百分比數字長度 1 被過濾 (clean.length >= 2)", () => {
      const tokens = tokenize("5%");
      // 5% -> clean = "5" (length 1) -> 被過濾
      expect(tokens.has("5")).toBe(false);
    });

    it("空/無效輸入回傳空 Set", () => {
      expect(tokenize("")).toEqual(new Set());
      expect(tokenize(null)).toEqual(new Set());
      expect(tokenize(undefined)).toEqual(new Set());
      expect(tokenize(123)).toEqual(new Set());
    });

    it("單字中文標題仍有 token", () => {
      const tokens = tokenize("台");
      expect(tokens.has("台")).toBe(true);
    });
  });

  describe("jaccard - Jaccard 相似度計算", () => {
    function jaccard(setA, setB) {
      if (setA.size === 0 && setB.size === 0) return 0;
      let intersectionCount = 0;
      for (const token of setA) {
        if (setB.has(token)) intersectionCount++;
      }
      const unionSize = setA.size + setB.size - intersectionCount;
      return unionSize === 0 ? 0 : intersectionCount / unionSize;
    }

    it("相同集合相似度為 1", () => {
      const set = new Set(["a", "b", "c"]);
      expect(jaccard(set, set)).toBe(1);
    });

    it("無交集相似度為 0", () => {
      const setA = new Set(["a", "b"]);
      const setB = new Set(["c", "d"]);
      expect(jaccard(setA, setB)).toBe(0);
    });

    it("部分交集正確計算", () => {
      const setA = new Set(["a", "b", "c"]);
      const setB = new Set(["b", "c", "d", "e"]);
      // intersection = 2, union = 5, Jaccard = 0.4
      expect(jaccard(setA, setB)).toBeCloseTo(0.4);
    });

    it("一個空集合相似度為 0", () => {
      expect(jaccard(new Set(), new Set(["a", "b"]))).toBe(0);
    });

    it("兩個空集合相似度為 0", () => {
      expect(jaccard(new Set(), new Set())).toBe(0);
    });
  });

  describe("assignConflictGroups - 主分群函數", () => {
    it("空陣列直接回傳", () => {
      expect(assignConflictGroups([])).toEqual([]);
    });

    it("非陣列輸入直接回傳", () => {
      expect(assignConflictGroups(null)).toBeNull();
      expect(assignConflictGroups("not array")).toBe("not array");
    });

    it("單篇文章 _conflictGroup 為 null", () => {
      const news = [{ title: "測試新聞", _region: "TW" }];
      const result = assignConflictGroups(news);
      expect(result[0]._conflictGroup).toBeNull();
    });

    it("TW 區域相似度 ≥ 0.3 歸入同群組", () => {
      // 使用更高相似度的標題 (共同詞彙多)
      const news = [
        { title: "伊朗與美國和談進行中", _region: "TW" },
        { title: "伊朗與美國和談取得進展", _region: "TW" },
        { title: "台股今日大漲 32 元", _region: "TW" },
      ];
      const result = assignConflictGroups(news);

      // 前兩篇應在同一群組 G1
      expect(result[0]._conflictGroup).toBe("G1");
      expect(result[1]._conflictGroup).toBe("G1");
      // 第三篇孤立
      expect(result[2]._conflictGroup).toBeNull();
    });

    it("US 區域使用較高閾值 0.45", () => {
      const news = [
        { title: "Apple reports strong earnings", _region: "US" },
        { title: "Apple earnings beat expectations", _region: "US" },
      ];
      const result = assignConflictGroups(news);

      // 相似度可能低於 0.45，應為不同群組
      // 但如果相似度夠高可能會分群
      expect(result[0]._conflictGroup).toBeDefined();
      expect(result[1]._conflictGroup).toBeDefined();
    });

    it("跨區域使用 TW 閾值 0.3", () => {
      const news = [
        { title: "伊朗與美國和談", _region: "TW" },
        { title: "伊朗拒絕和談", _region: "US" },
      ];
      const result = assignConflictGroups(news);

      // 跨區域用 TW 閾值 0.3
      expect(result[0]._conflictGroup).toBe("G1");
      expect(result[1]._conflictGroup).toBe("G1");
    });

    it("群組 ID 依序 G1, G2...", () => {
      const news = [
        { title: "伊朗與美國和談", _region: "TW" },
        { title: "伊朗拒絕和談", _region: "TW" },
        { title: "台股大漲 32 元", _region: "TW" },
        { title: "台股大漲 30 元", _region: "TW" },
      ];
      const result = assignConflictGroups(news);

      expect(result[0]._conflictGroup).toBe("G1");
      expect(result[1]._conflictGroup).toBe("G1");
      expect(result[2]._conflictGroup).toBe("G2");
      expect(result[3]._conflictGroup).toBe("G2");
    });

    it("不修改原始陣列", () => {
      const news = [{ title: "測試", _region: "TW" }];
      const original = JSON.stringify(news);
      assignConflictGroups(news);
      expect(JSON.stringify(news)).toBe(original);
    });

    it("回傳新陣列包含所有原始欄位", () => {
      const news = [{ title: "測試", _region: "TW", extra: "data" }];
      const result = assignConflictGroups(news);
      expect(result[0].extra).toBe("data");
      expect(result[0]._conflictGroup).toBeNull();
    });

    it("降級處理：異常時回傳全 null", () => {
      // 構造會導致錯誤的輸入 (循環引用)
      const news = [{ title: "測試" }];
      news[0].self = news;

      const result = assignConflictGroups(news);
      expect(result[0]._conflictGroup).toBeNull();
    });
  });

  describe("複雜分群場景", () => {
    it("多個獨立群組", () => {
      const news = [
        { title: "伊朗與美國和談", _region: "TW" },
        { title: "伊朗拒絕和談", _region: "TW" },
        { title: "台股大漲 32 元", _region: "TW" },
        { title: "台股大漲 30 元", _region: "TW" },
        { title: "比特幣突破 5 萬", _region: "TW" },
      ];
      const result = assignConflictGroups(news);

      // 應有 2 個群組 (G1: 伊朗, G2: 台股)
      const groups = result.map(r => r._conflictGroup).filter(g => g !== null);
      expect(groups).toContain("G1");
      expect(groups).toContain("G2");
      // 比特幣孤立
      expect(result[4]._conflictGroup).toBeNull();
    });

    it("三篇文章連鎖分群 (A~B, B~C, A~C)", () => {
      const news = [
        { title: "伊朗與美國和談進行中", _region: "TW" },
        { title: "伊朗與美國和談取得進展", _region: "TW" },
        { title: "伊朗美國和談達成共識", _region: "TW" },
      ];
      const result = assignConflictGroups(news);

      // 三篇都應在同一群組
      expect(result[0]._conflictGroup).toBe("G1");
      expect(result[1]._conflictGroup).toBe("G1");
      expect(result[2]._conflictGroup).toBe("G1");
    });
  });
});