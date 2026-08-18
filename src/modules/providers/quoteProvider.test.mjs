// src/modules/providers/quoteProvider.test.mjs
// TDD: Quote Provider 測試

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../utils/coreUtils.mjs", () => ({
  fetchWithTimeout: vi.fn(),
  TwDate: vi.fn(() => ({
    formatDateKey: () => "2024-01-15",
  })),
}));

vi.mock("../data/archiveManager.mjs", () => ({
  archiveManager: {
    getLatestMarketData: vi.fn(),
  },
}));

import { getDailyQuote } from "./quoteProvider.mjs";
import { fetchWithTimeout } from "../../utils/coreUtils.mjs";
import { archiveManager } from "../data/archiveManager.mjs";

describe("quoteProvider - 每日一句 Provider", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("fetchFromQuotable", () => {
    it("成功回傳名言資料", async () => {
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: vi
          .fn()
          .mockResolvedValue([
            { content: "Test quote", author: "Test Author" },
          ]),
      });

      // 透過 getDailyQuote 間接測試
      archiveManager.getLatestMarketData.mockResolvedValueOnce(null);

      const result = await getDailyQuote();

      expect(result.quote).toBe("Test quote");
      expect(result.author).toBe("Test Author");
      expect(result.source).toBe("quotable");
      expect(result.raw).toEqual(
        expect.objectContaining({
          content: "Test quote",
          author: "Test Author",
        }),
      );
      expect(result.normalized).toEqual(
        expect.objectContaining({ quote: "Test quote", source: "quotable" }),
      );
    });

    it("HTTP 錯誤拋出錯誤", async () => {
      fetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      archiveManager.getLatestMarketData.mockResolvedValueOnce(null);

      // 會 fallback 到 ZenQuotes
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([{ q: "Zen quote", a: "Zen Author" }]),
      });

      const result = await getDailyQuote();
      expect(result.quote).toBe("Zen quote");
    });

    it("空回應拋出錯誤", async () => {
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });

      archiveManager.getLatestMarketData.mockResolvedValueOnce(null);

      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([{ q: "Zen quote", a: "Zen Author" }]),
      });

      const result = await getDailyQuote();
      expect(result.quote).toBe("Zen quote");
    });
  });

  describe("fetchFromZenQuotes", () => {
    it("成功回傳名言資料", async () => {
      archiveManager.getLatestMarketData.mockResolvedValueOnce(null);

      fetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([{ q: "Zen quote", a: "Zen Author" }]),
      });

      const result = await getDailyQuote();

      expect(result.quote).toBe("Zen quote");
      expect(result.author).toBe("Zen Author");
      expect(result.source).toBe("zenquotes");
    });

    it("HTTP 錯誤拋出錯誤", async () => {
      fetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      archiveManager.getLatestMarketData.mockResolvedValueOnce(null);

      fetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await getDailyQuote();

      // 兩個都失敗，使用 fallback
      expect(result.quote).toContain("下跌是加碼的禮物");
      expect(result.source).toBe("fallback");
    });
  });

  describe("getDailyQuote - 整合測試", () => {
    it("有快取時直接回傳快取", async () => {
      archiveManager.getLatestMarketData.mockResolvedValueOnce({
        data: {
          quote: {
            date: "2024-01-15",
            quote: "Cached quote",
            author: "Cached Author",
            source: "cached",
          },
        },
      });

      const result = await getDailyQuote();

      expect(result.quote).toBe("Cached quote");
      expect(result.author).toBe("Cached Author");
      expect(result.source).toBe("cached");
      expect(fetchWithTimeout).not.toHaveBeenCalled();
    });

    it("快取日期不同時重新抓取", async () => {
      archiveManager.getLatestMarketData.mockResolvedValueOnce({
        data: {
          quote: {
            date: "2024-01-14", // 昨天的日期
            quote: "Old quote",
            author: "Old Author",
            source: "cached",
          },
        },
      });

      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: vi
          .fn()
          .mockResolvedValue([{ content: "New quote", author: "New Author" }]),
      });

      const result = await getDailyQuote();

      expect(result.quote).toBe("New quote");
      expect(result.date).toBe("2024-01-15");
    });

    it("讀取快取失敗繼續執行 API 抓取", async () => {
      archiveManager.getLatestMarketData.mockRejectedValueOnce(
        new Error("Cache error"),
      );

      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: vi
          .fn()
          .mockResolvedValue([{ content: "API quote", author: "API Author" }]),
      });

      const result = await getDailyQuote();

      expect(result.quote).toBe("API quote");
    });

    it("兩個 API 都失敗使用 fallback", async () => {
      archiveManager.getLatestMarketData.mockResolvedValueOnce(null);

      fetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      fetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await getDailyQuote();

      expect(result.quote).toContain("下跌是加碼的禮物");
      expect(result.author).toBe("—");
      expect(result.source).toBe("fallback");
    });
  });
});
