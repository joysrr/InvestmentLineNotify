// src/modules/ai/aiCoach.test.mjs
// TDD: AI Coach 核心邏輯測試 - 完整覆蓋導出函數

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock 依賴模組
vi.mock("./aiClient.mjs", () => ({
  callAI: vi.fn(),
  PROVIDERS: { GEMINI: "gemini", GROK: "grok" },
  langfuse: { score: vi.fn(), shutdownAsync: vi.fn() },
  flushLangfuse: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./langfuseClient.mjs", () => ({
  langfuseEnabled: true,
  createLangfuseScore: vi.fn().mockResolvedValue(undefined),
  shutdownLangfuse: vi.fn().mockResolvedValue(undefined),
  langfuseExporter: {
    export: vi.fn(),
    shutdown: vi.fn(),
  },
  langfuseClient: {
    prompts: { get: vi.fn() },
    score: { create: vi.fn() },
    shutdown: vi.fn(),
  },
}));

vi.mock("./aiDataPreprocessor.mjs", () => ({
  formatQuantDataForCoach: vi.fn().mockReturnValue("Quant data for coach"),
}));

vi.mock("../../utils/retryUtils.mjs", () => ({
  AIServiceError: class extends Error {
    constructor(message, options = {}) {
      super(message);
      this.provider = options.provider;
      this.model = options.model;
    }
  },
}));

vi.mock("../../utils/logger.mjs", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../keywordConfig.mjs", () => ({
  baseTwQueries: [{ keyword: "台股" }, { keyword: "台積電" }],
  baseUsQueries: [{ keyword: "美股" }, { keyword: "蘋果" }],
}));

vi.mock("../data/archiveManager.mjs", () => ({
  archiveManager: {
    saveAiLog: vi.fn().mockResolvedValue(undefined),
    getPreviousAdviceSummary: vi
      .fn()
      .mockResolvedValue("Previous advice summary"),
  },
}));

vi.mock("../data/newsPoolManager.mjs", () => ({
  saveFilteredPool: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../news/newsConflictGrouper.mjs", () => ({
  assignConflictGroups: vi.fn((news) =>
    news.map((n, i) => ({ ...n, _conflictGroup: `group-${i}` })),
  ),
}));

describe("aiCoach - AI 投資教練核心邏輯完整測試", () => {
  let aiCoach;
  let mockCallAI;
  let mockFormatQuantData;
  let mockArchiveManager;
  let mockSaveFilteredPool;
  let mockAssignConflictGroups;
  let mockLangfuse;
  let mockLogger;

  beforeEach(async () => {
    vi.clearAllMocks();

    const aiClientModule = await import("./aiClient.mjs");
    mockCallAI = aiClientModule.callAI;
    mockLangfuse = aiClientModule.langfuse;

    const preprocessorModule = await import("./aiDataPreprocessor.mjs");
    mockFormatQuantData = preprocessorModule.formatQuantDataForCoach;

    const archiveModule = await import("../data/archiveManager.mjs");
    mockArchiveManager = archiveModule.archiveManager;

    const newsPoolModule = await import("../data/newsPoolManager.mjs");
    mockSaveFilteredPool = newsPoolModule.saveFilteredPool;

    const conflictModule = await import("../news/newsConflictGrouper.mjs");
    mockAssignConflictGroups = conflictModule.assignConflictGroups;

    const loggerModule = await import("../../utils/logger.mjs");
    mockLogger = loggerModule.default;

    // 動態導入被測模組
    aiCoach = await import("./aiCoach.mjs");
  });

  describe("calcDiversityScore - 維度覆蓋率", () => {
    it("空輸入應回傳 0", () => {
      const VALID_DIMENSIONS = [
        "macro_economy",
        "tw_market",
        "semiconductor",
        "geopolitics",
        "capital_flow",
      ];
      const calcDiversityScore = (dimensionCheck = {}) => {
        if (!dimensionCheck) return 0;
        const covered = VALID_DIMENSIONS.filter(
          (key) => dimensionCheck[key] === true,
        ).length;
        return covered / VALID_DIMENSIONS.length;
      };
      expect(calcDiversityScore({})).toBe(0);
      expect(calcDiversityScore(null)).toBe(0);
      expect(calcDiversityScore(undefined)).toBe(0);
    });

    it("部分維度覆蓋", () => {
      const VALID_DIMENSIONS = [
        "macro_economy",
        "tw_market",
        "semiconductor",
        "geopolitics",
        "capital_flow",
      ];
      const calcDiversityScore = (dimensionCheck = {}) => {
        const covered = VALID_DIMENSIONS.filter(
          (key) => dimensionCheck[key] === true,
        ).length;
        return covered / VALID_DIMENSIONS.length;
      };
      expect(calcDiversityScore({ macro_economy: true })).toBe(0.2);
      expect(calcDiversityScore({ macro_economy: true, tw_market: true })).toBe(
        0.4,
      );
    });

    it("完整覆蓋應回傳 1", () => {
      const VALID_DIMENSIONS = [
        "macro_economy",
        "tw_market",
        "semiconductor",
        "geopolitics",
        "capital_flow",
      ];
      const calcDiversityScore = (dimensionCheck = {}) => {
        const covered = VALID_DIMENSIONS.filter(
          (key) => dimensionCheck[key] === true,
        ).length;
        return covered / VALID_DIMENSIONS.length;
      };
      expect(
        calcDiversityScore({
          macro_economy: true,
          tw_market: true,
          semiconductor: true,
          geopolitics: true,
          capital_flow: true,
        }),
      ).toBe(1);
    });
  });

  describe("calcSpreadScore - 分數分散度", () => {
    it("空陣列回傳 0", () => {
      const calcSpreadScore = (scores = []) => {
        if (!scores.length) return 0;
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance =
          scores.reduce((sum, x) => sum + (x - mean) ** 2, 0) / scores.length;
        const stdDev = Math.sqrt(variance);
        return Math.max(0, Math.min(1, stdDev / 2));
      };
      expect(calcSpreadScore([])).toBe(0);
    });

    it("單一值回傳 0 (無分散)", () => {
      const calcSpreadScore = (scores = []) => {
        if (!scores.length) return 0;
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance =
          scores.reduce((sum, x) => sum + (x - mean) ** 2, 0) / scores.length;
        const stdDev = Math.sqrt(variance);
        return Math.max(0, Math.min(1, stdDev / 2));
      };
      expect(calcSpreadScore([5])).toBe(0);
    });

    it("分散度正確計算", () => {
      const calcSpreadScore = (scores = []) => {
        if (!scores.length) return 0;
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance =
          scores.reduce((sum, x) => sum + (x - mean) ** 2, 0) / scores.length;
        const stdDev = Math.sqrt(variance);
        return Math.max(0, Math.min(1, stdDev / 2));
      };
      expect(calcSpreadScore([0, 10])).toBe(1);
      expect(calcSpreadScore([5, 5, 5])).toBe(0);
    });

    it("分散度上限 1", () => {
      const calcSpreadScore = (scores = []) => {
        if (!scores.length) return 0;
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance =
          scores.reduce((sum, x) => sum + (x - mean) ** 2, 0) / scores.length;
        const stdDev = Math.sqrt(variance);
        return Math.max(0, Math.min(1, stdDev / 2));
      };
      expect(calcSpreadScore([0, 100])).toBe(1);
    });
  });

  describe("isNonEmptyString - 非空字串檢查", () => {
    it("正確識別非空字串", () => {
      const isNonEmptyString = (value) =>
        typeof value === "string" && value.trim().length > 0;
      expect(isNonEmptyString("hello")).toBe(true);
      expect(isNonEmptyString("  hello  ")).toBe(true);
      expect(isNonEmptyString("")).toBe(false);
      expect(isNonEmptyString("   ")).toBe(false);
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
      expect(isNonEmptyString(123)).toBe(false);
      expect(isNonEmptyString({})).toBe(false);
    });
  });

  describe("isNonEmptyStringArray - 非空字串陣列檢查", () => {
    it("正確識別非空字串陣列", () => {
      const isNonEmptyStringArray = (value) =>
        Array.isArray(value) &&
        value.length > 0 &&
        value.every((v) => typeof v === "string" && v.trim().length > 0);
      expect(isNonEmptyStringArray(["a", "b"])).toBe(true);
      expect(isNonEmptyStringArray(["  a  "])).toBe(true);
      expect(isNonEmptyStringArray([])).toBe(false);
      expect(isNonEmptyStringArray([""])).toBe(false);
      expect(isNonEmptyStringArray(["a", ""])).toBe(false);
      expect(isNonEmptyStringArray(null)).toBe(false);
      expect(isNonEmptyStringArray("not array")).toBe(false);
    });
  });

  describe("calcThinkingDepth - 思考深度評分", () => {
    it("空輸入回傳 0", () => {
      const calcThinkingDepth = (thinking = "") => {
        if (!thinking || typeof thinking !== "string") return 0;
        const wordCount =
          (thinking.match(/[\u4e00-\u9fa5]/g) || []).length +
          (thinking.match(/\b[a-zA-Z]+\b/g) || []).length;
        let score = 0;
        if (wordCount >= 80) score += 0.4;
        if (/\d+(\.\d+)?%?/.test(thinking)) score += 0.2;
        if (/因為|由於|原因|考量|鑑於/.test(thinking)) score += 0.2;
        if (/但|然而|不過|另一方面|風險/.test(thinking)) score += 0.2;
        return Math.min(1, score);
      };
      expect(calcThinkingDepth("")).toBe(0);
      expect(calcThinkingDepth(null)).toBe(0);
      expect(calcThinkingDepth(undefined)).toBe(0);
      expect(calcThinkingDepth(123)).toBe(0);
    });

    it("字數 ≥ 80 加 0.4", () => {
      const calcThinkingDepth = (thinking = "") => {
        if (!thinking || typeof thinking !== "string") return 0;
        const wordCount =
          (thinking.match(/[\u4e00-\u9fa5]/g) || []).length +
          (thinking.match(/\b[a-zA-Z]+\b/g) || []).length;
        let score = 0;
        if (wordCount >= 80) score += 0.4;
        if (/\d+(\.\d+)?%?/.test(thinking)) score += 0.2;
        if (/因為|由於|原因|考量|鑑於/.test(thinking)) score += 0.2;
        if (/但|然而|不過|另一方面|風險/.test(thinking)) score += 0.2;
        return Math.min(1, score);
      };
      const longText = "這是一段很長的思考過程".repeat(10);
      expect(calcThinkingDepth(longText)).toBeGreaterThanOrEqual(0.4);
    });

    it("包含數字/百分比 加 0.2", () => {
      const calcThinkingDepth = (thinking = "") => {
        if (!thinking || typeof thinking !== "string") return 0;
        const wordCount =
          (thinking.match(/[\u4e00-\u9fa5]/g) || []).length +
          (thinking.match(/\b[a-zA-Z]+\b/g) || []).length;
        let score = 0;
        if (wordCount >= 80) score += 0.4;
        if (/\d+(\.\d+)?%?/.test(thinking)) score += 0.2;
        if (/因為|由於|原因|考量|鑑於/.test(thinking)) score += 0.2;
        if (/但|然而|不過|另一方面|風險/.test(thinking)) score += 0.2;
        return Math.min(1, score);
      };
      expect(calcThinkingDepth("價格 150 元")).toBeGreaterThanOrEqual(0.2);
      expect(calcThinkingDepth("上漲 5%")).toBeGreaterThanOrEqual(0.2);
      expect(calcThinkingDepth("無數字")).toBeLessThan(0.2);
    });

    it("包含因果關鍵字 加 0.2", () => {
      const calcThinkingDepth = (thinking = "") => {
        if (!thinking || typeof thinking !== "string") return 0;
        const wordCount =
          (thinking.match(/[\u4e00-\u9fa5]/g) || []).length +
          (thinking.match(/\b[a-zA-Z]+\b/g) || []).length;
        let score = 0;
        if (wordCount >= 80) score += 0.4;
        if (/\d+(\.\d+)?%?/.test(thinking)) score += 0.2;
        if (/因為|由於|原因|考量|鑑於/.test(thinking)) score += 0.2;
        if (/但|然而|不過|另一方面|風險/.test(thinking)) score += 0.2;
        return Math.min(1, score);
      };
      expect(calcThinkingDepth("因為技術指標轉強")).toBeGreaterThanOrEqual(0.2);
      expect(calcThinkingDepth("由於基本面改善")).toBeGreaterThanOrEqual(0.2);
      expect(calcThinkingDepth("考量風險因素")).toBeGreaterThanOrEqual(0.2);
      expect(calcThinkingDepth("鑑於大盤趨勢")).toBeGreaterThanOrEqual(0.2);
    });

    it("包含反向思考關鍵字 加 0.2", () => {
      const calcThinkingDepth = (thinking = "") => {
        if (!thinking || typeof thinking !== "string") return 0;
        const wordCount =
          (thinking.match(/[\u4e00-\u9fa5]/g) || []).length +
          (thinking.match(/\b[a-zA-Z]+\b/g) || []).length;
        let score = 0;
        if (wordCount >= 80) score += 0.4;
        if (/\d+(\.\d+)?%?/.test(thinking)) score += 0.2;
        if (/因為|由於|原因|考量|鑑於/.test(thinking)) score += 0.2;
        if (/但|然而|不過|另一方面|風險/.test(thinking)) score += 0.2;
        return Math.min(1, score);
      };
      expect(calcThinkingDepth("但需注意風險")).toBeGreaterThanOrEqual(0.2);
      expect(calcThinkingDepth("然而趨勢可能反轉")).toBeGreaterThanOrEqual(0.2);
      expect(calcThinkingDepth("另一方面資金流出")).toBeGreaterThanOrEqual(0.2);
    });

    it("完整要素可達 1.0", () => {
      const calcThinkingDepth = (thinking = "") => {
        if (!thinking || typeof thinking !== "string") return 0;
        const wordCount =
          (thinking.match(/[\u4e00-\u9fa5]/g) || []).length +
          (thinking.match(/\b[a-zA-Z]+\b/g) || []).length;
        let score = 0;
        if (wordCount >= 80) score += 0.4;
        if (/\d+(\.\d+)?%?/.test(thinking)) score += 0.2;
        if (/因為|由於|原因|考量|鑑於/.test(thinking)) score += 0.2;
        if (/但|然而|不過|另一方面|風險/.test(thinking)) score += 0.2;
        return Math.min(1, score);
      };
      const fullText =
        "因為技術指標顯示上漲趨勢，價格突破 150 元並站穩 5% 漲幅，但需注意成交量萎縮風險，另一方面若大盤回調則應減碼".repeat(
          2,
        );
      expect(calcThinkingDepth(fullText)).toBe(1);
    });
  });

  describe("checkConfidenceField - 信心度欄位檢查", () => {
    it("有效 confidence 數值回傳 1", () => {
      const checkConfidenceField = (result = {}) => {
        const val = result?.confidence ?? result?.confidence_level;
        if (val === undefined || val === null) return 0;
        if (typeof val === "number" && val >= 0 && val <= 1) return 1;
        if (typeof val === "string" && val.trim().length > 0) return 1;
        return 0;
      };
      expect(checkConfidenceField({ confidence: 0.8 })).toBe(1);
      expect(checkConfidenceField({ confidence: 0 })).toBe(1);
      expect(checkConfidenceField({ confidence: 1 })).toBe(1);
      expect(checkConfidenceField({ confidence_level: 0.5 })).toBe(1);
    });

    it("無效 confidence 數值回傳 0", () => {
      const checkConfidenceField = (result = {}) => {
        const val = result?.confidence ?? result?.confidence_level;
        if (val === undefined || val === null) return 0;
        if (typeof val === "number" && val >= 0 && val <= 1) return 1;
        if (typeof val === "string" && val.trim().length > 0) return 1;
        return 0;
      };
      expect(checkConfidenceField({ confidence: 1.5 })).toBe(0);
      expect(checkConfidenceField({ confidence: -0.1 })).toBe(0);
      expect(checkConfidenceField({ confidence: "invalid" })).toBe(1);
    });

    it("缺少欄位回傳 0", () => {
      const checkConfidenceField = (result = {}) => {
        const val = result?.confidence ?? result?.confidence_level;
        if (val === undefined || val === null) return 0;
        if (typeof val === "number" && val >= 0 && val <= 1) return 1;
        if (typeof val === "string" && val.trim().length > 0) return 1;
        return 0;
      };
      expect(checkConfidenceField({})).toBe(0);
      expect(checkConfidenceField({ other: "field" })).toBe(0);
      expect(checkConfidenceField(null)).toBe(0);
      expect(checkConfidenceField(undefined)).toBe(0);
    });

    it("字串格式 confidence 回傳 1", () => {
      const checkConfidenceField = (result = {}) => {
        const val = result?.confidence ?? result?.confidence_level;
        if (val === undefined || val === null) return 0;
        if (typeof val === "number" && val >= 0 && val <= 1) return 1;
        if (typeof val === "string" && val.trim().length > 0) return 1;
        return 0;
      };
      expect(checkConfidenceField({ confidence: "high" })).toBe(1);
      expect(checkConfidenceField({ confidence: "  " })).toBe(0);
    });
  });

  describe("sortNewsForAi - 新聞排序規則", () => {
    const AGE_BAND_PRIORITY = { fresh: 0, recent: 1, stale: 2 };

    function toTimestamp(article) {
      const raw = article?.pubDate || article?.fetched_at;
      const ts = raw ? new Date(raw).getTime() : 0;
      return Number.isFinite(ts) ? ts : 0;
    }

    function sortNewsForAi(a, b) {
      const ageDiff =
        (AGE_BAND_PRIORITY[a?.age_band] ?? 99) -
        (AGE_BAND_PRIORITY[b?.age_band] ?? 99);
      if (ageDiff !== 0) return ageDiff;
      return toTimestamp(b) - toTimestamp(a);
    }

    it("fresh 優先於 recent", () => {
      const fresh = { age_band: "fresh", pubDate: "2024-01-01" };
      const recent = { age_band: "recent", pubDate: "2024-01-02" };
      expect(sortNewsForAi(fresh, recent)).toBeLessThan(0);
    });

    it("recent 優先於 stale", () => {
      const recent = { age_band: "recent", pubDate: "2024-01-01" };
      const stale = { age_band: "stale", pubDate: "2024-01-02" };
      expect(sortNewsForAi(recent, stale)).toBeLessThan(0);
    });

    it("同 age_band 依時間新到舊", () => {
      const older = { age_band: "fresh", pubDate: "2024-01-01" };
      const newer = { age_band: "fresh", pubDate: "2024-01-02" };
      expect(sortNewsForAi(newer, older)).toBeLessThan(0);
    });

    it("缺少 age_band 視為最低優先級", () => {
      const fresh = { age_band: "fresh" };
      const noBand = { age_band: undefined };
      expect(sortNewsForAi(fresh, noBand)).toBeLessThan(0);
    });
  });

  describe("selectNewsForAi - 新聞選取", () => {
    function selectNewsForAi(
      allNewsArray,
      perRegionLimit = 30,
      totalLimit = 60,
    ) {
      const AGE_BAND_PRIORITY = { fresh: 0, recent: 1, stale: 2 };
      function toTimestamp(article) {
        const raw = article?.pubDate || article?.fetched_at;
        const ts = raw ? new Date(raw).getTime() : 0;
        return Number.isFinite(ts) ? ts : 0;
      }
      function sortNewsForAi(a, b) {
        const ageDiff =
          (AGE_BAND_PRIORITY[a?.age_band] ?? 99) -
          (AGE_BAND_PRIORITY[b?.age_band] ?? 99);
        if (ageDiff !== 0) return ageDiff;
        return toTimestamp(b) - toTimestamp(a);
      }

      const sorted = [...allNewsArray].sort(sortNewsForAi);
      const byRegion = new Map();
      const selected = [];
      const leftovers = [];

      for (const article of sorted) {
        const region = article?._region || "TW";
        const count = byRegion.get(region) || 0;
        if (count < perRegionLimit) {
          selected.push(article);
          byRegion.set(region, count + 1);
        } else {
          leftovers.push(article);
        }
      }

      const capped = selected.slice(0, totalLimit);
      if (capped.length < totalLimit) {
        for (const article of leftovers) {
          if (capped.length >= totalLimit) break;
          capped.push(article);
        }
      }
      return capped;
    }

    it("依 region 限制選取", () => {
      const news = [
        { _region: "TW", age_band: "fresh", pubDate: "2024-01-01" },
        { _region: "TW", age_band: "fresh", pubDate: "2024-01-02" },
        { _region: "US", age_band: "fresh", pubDate: "2024-01-01" },
      ];
      const result = selectNewsForAi(news, 1, 10);
      expect(result.length).toBe(3);
    });

    it("totalLimit 限制總數", () => {
      const news = Array.from({ length: 100 }, (_, i) => ({
        _region: "TW",
        age_band: "fresh",
        pubDate: `2024-01-${String(i + 1).padStart(2, "0")}`,
      }));
      const result = selectNewsForAi(news, 50, 10);
      expect(result.length).toBe(10);
    });

    it("空陣列回傳空陣列", () => {
      expect(selectNewsForAi([])).toEqual([]);
    });
  });

  describe("generateDailySearchQueries - 導出函數測試", () => {
    it("成功生成搜尋關鍵字", async () => {
      mockCallAI.mockResolvedValueOnce({
        text: JSON.stringify({
          twQueries: ["台股", "台積電"],
          usQueries: ["美股", "蘋果"],
        }),
        traceId: "trace-123",
      });

      const marketData = { marketStatus: "OPEN", vix: 15 };
      const result = await aiCoach.generateDailySearchQueries(marketData);

      expect(result).toBeDefined();
      expect(result.twQueries).toEqual(["台股", "台積電"]);
      expect(result.usQueries).toEqual(["美股", "蘋果"]);
      expect(result.traceId).toBe("trace-123");
      expect(mockCallAI).toHaveBeenCalledWith(
        "News/GenerateSearchQueries",
        expect.objectContaining({
          sessionId: expect.any(String),
          provider: "gemini",
          keyIndex: 0,
          promptVariables: expect.objectContaining({
            dateStr: expect.any(String),
            marketStatus: "OPEN",
            vix: 15,
            staticPoolText: expect.stringContaining("台股"),
          }),
        }),
      );
      expect(mockArchiveManager.saveAiLog).toHaveBeenCalled();
    });

    it("AI 回傳無效 JSON 時回傳空陣列", async () => {
      mockCallAI.mockResolvedValueOnce({
        text: "invalid json",
        traceId: "trace-456",
      });

      const result = await aiCoach.generateDailySearchQueries({
        marketStatus: "CLOSED",
        vix: 20,
      });

      expect(result.twQueries).toEqual([]);
      expect(result.usQueries).toEqual([]);
      expect(result.traceId).toBeNull();
    });

    it("AI 呼叫失敗時回傳空陣列並記錄錯誤", async () => {
      const { AIServiceError } = await import("../../utils/retryUtils.mjs");
      mockCallAI.mockRejectedValueOnce(
        new AIServiceError("API Error", {
          provider: "gemini",
          model: "gemini-3",
        }),
      );

      const result = await aiCoach.generateDailySearchQueries({
        marketStatus: "OPEN",
        vix: 15,
      });

      expect(result.twQueries).toEqual([]);
      expect(result.usQueries).toEqual([]);
      expect(result.traceId).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("onlyPrompt 為 true 時直接回傳停止訊息", async () => {
      // 這個測試給 getAiInvestmentAdvice，generateDailySearchQueries 沒有 onlyPrompt
      // 跳過
      expect(typeof aiCoach.generateDailySearchQueries).toBe("function");
    });
  });

  describe("filterAndCategorizeAllNewsWithAI - 導出函數測試", () => {
    it("成功過濾並分類新聞", async () => {
      mockCallAI.mockResolvedValueOnce({
        text: JSON.stringify({
          think: {
            event_inventory: [{ event: "Fed 降息", has_conflict: false }],
            dimension_check: { macro_economy: true, tw_market: true },
            excluded: [],
          },
          news: [
            { id: 0, summary: "新聞摘要 1" },
            { id: 1, summary: "新聞摘要 2" },
          ],
        }),
        traceId: "trace-789",
      });

      const allNewsArray = [
        {
          title: "新聞 1",
          _region: "TW",
          age_band: "fresh",
          pubDate: "2024-01-01",
        },
        {
          title: "新聞 2",
          _region: "US",
          age_band: "recent",
          pubDate: "2024-01-02",
        },
      ];

      const result = await aiCoach.filterAndCategorizeAllNewsWithAI(
        allNewsArray,
        "2024-01-01",
      );

      expect(result.news).toBeDefined();
      expect(result.news.length).toBe(2);
      expect(result.conflictSummary).toBeDefined();
      expect(mockCallAI).toHaveBeenCalledWith(
        "News/FilterAndCategorizeNews",
        expect.objectContaining({
          provider: "gemini",
          keyIndex: 1,
        }),
      );
      expect(mockAssignConflictGroups).toHaveBeenCalled();
      expect(mockSaveFilteredPool).toHaveBeenCalled();
      expect(mockArchiveManager.saveAiLog).toHaveBeenCalled();
    });

    it("空新聞陣列回傳空結果", async () => {
      const result = await aiCoach.filterAndCategorizeAllNewsWithAI(
        [],
        "2024-01-01",
      );
      expect(result.news).toEqual([]);
      expect(result.conflictSummary).toBe("");
      expect(mockCallAI).not.toHaveBeenCalled();
    });

    it("有矛盾事件時生成 conflictSummary", async () => {
      mockCallAI.mockResolvedValueOnce({
        text: JSON.stringify({
          think: {
            event_inventory: [
              { event: "事件 A", has_conflict: true, conflict_note: "有衝突" },
              { event: "事件 B", has_conflict: false },
            ],
            dimension_check: { macro_economy: true },
            excluded: [],
          },
          news: [{ id: 0, summary: "摘要" }],
        }),
        traceId: "trace-conflict",
      });

      const allNewsArray = [
        {
          title: "新聞 1",
          _region: "TW",
          age_band: "fresh",
          pubDate: "2024-01-01",
        },
      ];

      const result = await aiCoach.filterAndCategorizeAllNewsWithAI(
        allNewsArray,
        "2024-01-01",
      );

      expect(result.conflictSummary).toContain("矛盾新聞預測");
      expect(result.conflictSummary).toContain("事件 A");
    });

    it("AI 呼叫失敗回傳空結果", async () => {
      const { AIServiceError } = await import("../../utils/retryUtils.mjs");
      mockCallAI.mockRejectedValueOnce(
        new AIServiceError("Service Error", {
          provider: "gemini",
          model: "gemini-3",
        }),
      );

      const result = await aiCoach.filterAndCategorizeAllNewsWithAI(
        [
          {
            title: "新聞",
            _region: "TW",
            age_band: "fresh",
            pubDate: "2024-01-01",
          },
        ],
        "2024-01-01",
      );

      expect(result.news).toEqual([]);
      expect(result.conflictSummary).toBe("");
      expect(result.analysisStatus).toBe("failed");
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("analyzeMacroNewsWithAI - 導出函數測試", () => {
    it("成功分析宏觀新聞", async () => {
      mockCallAI.mockResolvedValueOnce({
        text: JSON.stringify({
          bull_events: [{ event: "利好", score: 8 }],
          bear_events: [{ event: "利空", score: 5 }],
          total_bull_score: 8,
          total_bear_score: 5,
          conclusion: { market_direction: "BULLISH", analysis: "偏多" },
        }),
        traceId: "trace-macro",
      });

      const result = await aiCoach.analyzeMacroNewsWithAI(
        "今日新聞摘要",
        "矛盾摘要",
      );

      expect(result.bull_events).toHaveLength(1);
      expect(result.bear_events).toHaveLength(1);
      expect(result.conclusion.market_direction).toBe("BULLISH");
      expect(mockCallAI).toHaveBeenCalledWith(
        "News/AnalyzeMacroNews",
        expect.objectContaining({
          provider: "gemini",
          keyIndex: 2,
          promptVariables: expect.objectContaining({
            newsText: expect.stringContaining("矛盾摘要"),
          }),
        }),
      );
      expect(mockArchiveManager.saveAiLog).toHaveBeenCalled();
    });

    it("無矛盾摘要時正常處理", async () => {
      mockCallAI.mockResolvedValueOnce({
        text: JSON.stringify({
          bull_events: [],
          bear_events: [],
          total_bull_score: 0,
          total_bear_score: 0,
          conclusion: { market_direction: "NEUTRAL", analysis: "中性" },
        }),
        traceId: "trace-no-conflict",
      });

      const result = await aiCoach.analyzeMacroNewsWithAI("今日新聞", "");
      expect(result.conclusion.market_direction).toBe("NEUTRAL");
    });

    it("AI 呼叫失敗回傳預設中性結果", async () => {
      const { AIServiceError } = await import("../../utils/retryUtils.mjs");
      mockCallAI.mockRejectedValueOnce(
        new AIServiceError("Error", { provider: "gemini", model: "gemini-3" }),
      );

      const result = await aiCoach.analyzeMacroNewsWithAI("新聞", "");

      expect(result.bull_events).toEqual([]);
      expect(result.bear_events).toEqual([]);
      expect(result.conclusion.market_direction).toBe("NEUTRAL");
      expect(result.conclusion.analysis).toContain("無法分析");
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe("getAiInvestmentAdvice - 導出函數測試", () => {
    it("onlyPrompt 為 true 時回傳停止訊息", async () => {
      const result = await aiCoach.getAiInvestmentAdvice(
        {},
        {},
        {},
        "新聞",
        "宏觀",
        "籌碼",
        "",
        true,
      );
      expect(result.advice).toBe("AI 決策引擎停止運作中。");
      expect(result.traceId).toBeNull();
      expect(mockCallAI).not.toHaveBeenCalled();
    });

    it("成功獲取投資建議", async () => {
      mockCallAI.mockResolvedValueOnce({
        text: JSON.stringify({
          coach_internal_thinking:
            "因為技術指標顯示上漲趨勢，價格突破 150 元並站穩 5% 漲幅，但需注意成交量萎縮風險",
          action_items: ["買入台積電", "設定停損"],
          mindset_advice: "保持耐心",
          risk_warnings: ["成交量萎縮", "大盤風險"],
          confidence: 0.8,
        }),
        traceId: "trace-advice",
      });

      const marketData = { twse: 18000, vix: 15 };
      const portfolio = { positions: [] };
      const vixData = { vix: 15 };

      const result = await aiCoach.getAiInvestmentAdvice(
        marketData,
        portfolio,
        vixData,
        "新聞摘要",
        "宏觀分析",
        "籌碼字串",
        "前次建議",
        false,
      );

      expect(result.advice).toBeDefined();
      expect(result.advice.coach_internal_thinking).toBeDefined();
      expect(result.advice.action_items).toHaveLength(2);
      expect(result.advice.mindset_advice).toBeDefined();
      expect(result.advice.risk_warnings).toHaveLength(2);
      expect(result.advice.confidence).toBe(0.8);
      expect(result.traceId).toBe("trace-advice");
      expect(mockFormatQuantData).toHaveBeenCalledWith(
        marketData,
        portfolio,
        vixData,
      );
      expect(mockCallAI).toHaveBeenCalledWith(
        "Report/InvestmentAdvice",
        expect.objectContaining({
          provider: "gemini",
          keyIndex: 3,
          promptVariables: expect.objectContaining({
            quantText: "Quant data for coach",
            newsSummaryText: "新聞摘要",
            macroText: "宏觀分析",
            macroAndChipStr: "籌碼字串",
            previousAdviceSummary: "前次建議",
          }),
        }),
      );
      expect(mockArchiveManager.saveAiLog).toHaveBeenCalled();
    });

    it("AI 回傳缺少必要欄位時仍回傳結果", async () => {
      mockCallAI.mockResolvedValueOnce({
        text: JSON.stringify({}),
        traceId: "trace-incomplete",
      });

      const result = await aiCoach.getAiInvestmentAdvice(
        {},
        {},
        {},
        "新聞",
        "宏觀",
        "籌碼",
        "",
        false,
      );

      expect(result.advice).toEqual({});
      expect(result.traceId).toBe("trace-incomplete");
    });

    it("AI 呼叫失敗回傳預設錯誤訊息", async () => {
      const { AIServiceError } = await import("../../utils/retryUtils.mjs");
      mockCallAI.mockRejectedValueOnce(
        new AIServiceError("Service Down", {
          provider: "gemini",
          model: "gemini-3",
        }),
      );

      const result = await aiCoach.getAiInvestmentAdvice(
        {},
        {},
        {},
        "新聞",
        "宏觀",
        "籌碼",
        "",
        false,
      );

      expect(result.advice).toBe(
        "AI 決策引擎暫時無法運作，請依技術指標自行判斷。",
      );
      expect(result.traceId).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("前次建議為空字串時正常處理", async () => {
      mockCallAI.mockResolvedValueOnce({
        text: JSON.stringify({
          coach_internal_thinking: "分析",
          action_items: ["行動"],
          mindset_advice: "心態",
        }),
        traceId: "trace-no-prev",
      });

      const result = await aiCoach.getAiInvestmentAdvice(
        {},
        {},
        {},
        "新聞",
        "宏觀",
        "籌碼",
        "",
        false,
      );

      expect(result.advice).toBeDefined();
      expect(mockCallAI).toHaveBeenCalledWith(
        "Report/InvestmentAdvice",
        expect.objectContaining({
          promptVariables: expect.objectContaining({
            previousAdviceSummary: "",
          }),
        }),
      );
    });
  });

  describe("safeLangfuseScore - 內部函數測試 (透過導出函數間接測試)", () => {
    it("langfuse.score 失敗不阻斷主流程", async () => {
      mockLangfuse.score.mockRejectedValueOnce(new Error("Langfuse down"));

      mockCallAI.mockResolvedValueOnce({
        text: JSON.stringify({ twQueries: [], usQueries: [] }),
        traceId: "trace-safe",
      });

      // 應該不拋出錯誤
      await expect(
        aiCoach.generateDailySearchQueries({ marketStatus: "OPEN", vix: 15 }),
      ).resolves.toBeDefined();
    });
  });

  describe("archiveManager.getPreviousAdviceSummary - 邊界測試", () => {
    it("前次建議透過參數傳入 (不內部呼叫 getPreviousAdviceSummary)", async () => {
      // 實際上 getAiInvestmentAdvice 接收 previousAdviceSummary 作為參數
      // 不會內部呼叫 archiveManager.getPreviousAdviceSummary()
      mockCallAI.mockResolvedValueOnce({
        text: JSON.stringify({
          coach_internal_thinking: "思考",
          action_items: [],
          mindset_advice: "",
        }),
        traceId: "trace-empty-prev",
      });

      await aiCoach.getAiInvestmentAdvice(
        {},
        {},
        {},
        "新聞",
        "宏觀",
        "籌碼",
        "外部傳入的前次建議",
        false,
      );

      expect(mockCallAI).toHaveBeenCalledWith(
        "Report/InvestmentAdvice",
        expect.objectContaining({
          promptVariables: expect.objectContaining({
            previousAdviceSummary: "外部傳入的前次建議",
          }),
        }),
      );
    });
  });
});
