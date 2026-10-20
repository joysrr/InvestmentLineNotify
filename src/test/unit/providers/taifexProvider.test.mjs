import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseTaifexSmallTxOi,
  parseTaifexNightQuote,
  fetchTaifexSmallTxRetailSentiment,
  fetchTaifexNightSession,
  clearTaifexCache,
} from "../../../modules/providers/taifexProvider.mjs";

describe("Phase 3: TAIFEX Data Provider (taifexProvider)", () => {
  beforeEach(() => {
    clearTaifexCache();
    vi.restoreAllMocks();
  });

  describe("3.1 小台指三大法人未平倉與全市場 OI 解析器 (parseTaifexSmallTxOi)", () => {
    it("正確解析小台三大法人與全市場數據並計算散戶多空比 RSR", () => {
      // 模擬期交所查詢結果數據
      const mockTaifexData = {
        totalOi: 92450,
        dealersNetOi: 3200, // 自營商小台淨部位
        sitcNetOi: -1100, // 投信小台淨部位
        finetNetOi: 18400, // 外資小台淨部位
      };

      const result = parseTaifexSmallTxOi(mockTaifexData);

      expect(result.totalOi).toBe(92450);
      expect(result.institutionalNetOi).toBe(3200 + -1100 + 18400); // 20500
      expect(result.retailNetOi).toBe(-20500); // 散戶 = -法人
      // RSR = (-20500 / 92450) * 100 = -22.17%
      expect(result.rsr).toBeCloseTo(-22.17, 2);
    });

    it("全市場 OI 為 0 或無效時回傳安全預設值，不噴錯崩潰", () => {
      const result = parseTaifexSmallTxOi({
        totalOi: 0,
        dealersNetOi: 0,
        sitcNetOi: 0,
        finetNetOi: 0,
      });

      expect(result.totalOi).toBe(0);
      expect(result.institutionalNetOi).toBe(0);
      expect(result.retailNetOi).toBe(0);
      expect(result.rsr).toBe(0);
    });
  });

  describe("3.2 台指夜盤報價解析器 (parseTaifexNightQuote)", () => {
    it("正確解析夜盤最新價、漲跌點數與百分比", () => {
      const mockQuote = {
        close: 22100,
        referencePrice: 22350, // 昨收
      };

      const result = parseTaifexNightQuote(mockQuote);

      expect(result.close).toBe(22100);
      expect(result.change).toBe(-250);
      // changePct = -250 / 22350 = -0.01118 (-1.12%)
      expect(result.changePct).toBeCloseTo(-0.0112, 4);
    });

    it("缺乏昨收參考價時回傳安全 0 漲跌幅", () => {
      const result = parseTaifexNightQuote({
        close: 22000,
        referencePrice: 0,
      });

      expect(result.close).toBe(22000);
      expect(result.change).toBe(0);
      expect(result.changePct).toBe(0);
    });
  });

  describe("3.3 網路抓取與快取降級 (fetchTaifexSmallTxRetailSentiment & fetchTaifexNightSession)", () => {
    it("成功取得並緩存小台指散戶多空比", async () => {
      const mockFetcher = vi.fn().mockResolvedValue({
        totalOi: 80000,
        dealersNetOi: 1000,
        sitcNetOi: 0,
        finetNetOi: 9000, // 法人合計 10000 -> 散戶 -10000
      });

      const data = await fetchTaifexSmallTxRetailSentiment({
        dateStr: "2026-10-20",
        fetcherFn: mockFetcher,
      });

      expect(mockFetcher).toHaveBeenCalledTimes(1);
      expect(data.rsr).toBe(-12.5); // (-10000 / 80000) * 100

      // 第二次呼叫命中 cache，不應再次觸發 mockFetcher
      const cached = await fetchTaifexSmallTxRetailSentiment({
        dateStr: "2026-10-20",
        fetcherFn: mockFetcher,
      });
      expect(mockFetcher).toHaveBeenCalledTimes(1);
      expect(cached.rsr).toBe(-12.5);
    });

    it("網路失敗且無快取時回傳安全降級空物件，不中斷主流程", async () => {
      const failingFetcher = vi
        .fn()
        .mockRejectedValue(new Error("TAIFEX 504 Gateway Timeout"));

      const data = await fetchTaifexSmallTxRetailSentiment({
        dateStr: "2026-10-21",
        fetcherFn: failingFetcher,
      });

      expect(data.rsr).toBe(0);
      expect(data.totalOi).toBe(0);
      expect(data.isFallback).toBe(true);
    });

    it("夜盤抓取失敗時安全回傳降級數值 (rNight = 0)", async () => {
      const failingNightFetcher = vi
        .fn()
        .mockRejectedValue(new Error("Network offline"));

      const data = await fetchTaifexNightSession({
        fetcherFn: failingNightFetcher,
      });

      expect(data.changePct).toBe(0);
      expect(data.isFallback).toBe(true);
    });
  });
});
