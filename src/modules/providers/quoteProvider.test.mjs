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

  describe("ZenQuotes fallback provider", () => {
    it("直接使用可用的 ZenQuotes 回傳名言資料", async () => {
      archiveManager.getLatestMarketData.mockResolvedValueOnce(null);
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([{ q: "Zen quote", a: "Zen Author" }]),
      });

      const result = await getDailyQuote();

      expect(result.quote).toBe("Zen quote");
      expect(result.author).toBe("Zen Author");
      expect(result.source).toBe("zenquotes");
      expect(result.raw).toEqual(
        expect.objectContaining({ q: "Zen quote", a: "Zen Author" }),
      );
      expect(result.normalized).toEqual(
        expect.objectContaining({ quote: "Zen quote", source: "zenquotes" }),
      );
    });

    it("HTTP 錯誤使用固定 fallback", async () => {
      archiveManager.getLatestMarketData.mockResolvedValueOnce(null);
      fetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await getDailyQuote();
      expect(result.source).toBe("fallback");
    });

    it("空回應使用固定 fallback", async () => {
      archiveManager.getLatestMarketData.mockResolvedValueOnce(null);
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });

      const result = await getDailyQuote();
      expect(result.source).toBe("fallback");
    });
  });

  describe("fetchFromZenQuotes", () => {
    it("成功回傳名言資料", async () => {
      archiveManager.getLatestMarketData.mockResolvedValueOnce(null);
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([{ q: "Zen quote", a: "Zen Author" }]),
      });

      const result = await getDailyQuote();

      expect(result.quote).toBe("Zen quote");
      expect(result.author).toBe("Zen Author");
      expect(result.source).toBe("zenquotes");
    });

    it("HTTP 錯誤使用固定 fallback", async () => {
      archiveManager.getLatestMarketData.mockResolvedValueOnce(null);
      fetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await getDailyQuote();
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
        json: vi.fn().mockResolvedValue([{ q: "New quote", a: "New Author" }]),
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
        json: vi.fn().mockResolvedValue([{ q: "API quote", a: "API Author" }]),
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
