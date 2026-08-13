// src/modules/providers/providerRegistry.test.mjs
// TDD: Provider Registry 測試

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock 所有依賴的 provider
vi.mock("./usMarketProvider.mjs", () => ({
  fetchUsMarketData: vi.fn(),
}));
vi.mock("./cnnProvider.mjs", () => ({
  fetchFearAndGreedIndex: vi.fn(),
}));
vi.mock("./kgiProvider.mjs", () => ({
  fetchTwseMarginData: vi.fn(),
}));
vi.mock("./finmindProvider.mjs", () => ({
  fetchFinMindMarginData: vi.fn(),
}));
vi.mock("./yahooProvider.mjs", () => ({
  fetchUsdTwdExchangeRate: vi.fn(),
}));
vi.mock("./ndcProvider.mjs", () => ({
  fetchBusinessIndicator: vi.fn(),
}));
vi.mock("./quoteProvider.mjs", () => ({
  getDailyQuote: vi.fn(),
}));
vi.mock("./twseProvider.mjs", () => ({
  fetchMarketValuation: vi.fn(),
  fetchMarketOverview: vi.fn(),
  fetchStockInstitutionalData: vi.fn(),
  fetchStockMarginData: vi.fn(),
}));
vi.mock("./macroProvider.mjs", () => ({
  fetchCentralBankRate: vi.fn(),
  fetchCpiYoY: vi.fn(),
}));

import { providerRegistry, ProviderError } from "./providerRegistry.mjs";
import { fetchUsMarketData } from "./usMarketProvider.mjs";
import { fetchFearAndGreedIndex } from "./cnnProvider.mjs";
import { fetchTwseMarginData } from "./kgiProvider.mjs";
import { fetchFinMindMarginData } from "./finmindProvider.mjs";
import { fetchUsdTwdExchangeRate } from "./yahooProvider.mjs";
import { fetchBusinessIndicator } from "./ndcProvider.mjs";
import { getDailyQuote } from "./quoteProvider.mjs";
import {
  fetchMarketValuation,
  fetchMarketOverview,
  fetchStockInstitutionalData,
  fetchStockMarginData,
} from "./twseProvider.mjs";
import * as macroProvider from "./macroProvider.mjs";

describe("providerRegistry - Provider 註冊表", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ndcBusinessIndicator", () => {
    it("有正確的 label", () => {
      expect(providerRegistry.ndcBusinessIndicator.label).toBe(
        "景氣燈號 (NDC)",
      );
    });

    it("呼叫 fetchBusinessIndicator", async () => {
      fetchBusinessIndicator.mockResolvedValue({ indicator: "green" });

      const result = await providerRegistry.ndcBusinessIndicator.fetch();

      expect(fetchBusinessIndicator).toHaveBeenCalled();
      expect(result).toEqual({ indicator: "green" });
    });
  });

  describe("marginKgi", () => {
    it("有正確的 label", () => {
      expect(providerRegistry.marginKgi.label).toBe("融資餘額 (KGI / MoneyDJ)");
    });

    it("呼叫 fetchTwseMarginData", async () => {
      fetchTwseMarginData.mockResolvedValue({ margin: 500000 });

      const result = await providerRegistry.marginKgi.fetch();

      expect(fetchTwseMarginData).toHaveBeenCalled();
      expect(result).toEqual({ margin: 500000 });
    });
  });

  describe("marginFinMind", () => {
    it("有正確的 label", () => {
      expect(providerRegistry.marginFinMind.label).toBe(
        "融資餘額 / 維持率 (FinMind)",
      );
    });

    it("呼叫 fetchFinMindMarginData", async () => {
      fetchFinMindMarginData.mockResolvedValue({ margin: 600000, ratio: 0.4 });

      const result = await providerRegistry.marginFinMind.fetch();

      expect(fetchFinMindMarginData).toHaveBeenCalled();
      expect(result).toEqual({ margin: 600000, ratio: 0.4 });
    });
  });

  describe("cnnFearGreed", () => {
    it("有正確的 label", () => {
      expect(providerRegistry.cnnFearGreed.label).toBe("CNN Fear & Greed");
    });

    it("呼叫 fetchFearAndGreedIndex", async () => {
      fetchFearAndGreedIndex.mockResolvedValue({
        index: 50,
        classification: "Neutral",
      });

      const result = await providerRegistry.cnnFearGreed.fetch();

      expect(fetchFearAndGreedIndex).toHaveBeenCalled();
      expect(result).toEqual({ index: 50, classification: "Neutral" });
    });
  });

  describe("usMarketFred", () => {
    it("有正確的 label", () => {
      expect(providerRegistry.usMarketFred.label).toBe("美股風險 (FRED)");
    });

    it("呼叫 fetchUsMarketData", async () => {
      fetchUsMarketData.mockResolvedValue({ sp500: 4500 });

      const result = await providerRegistry.usMarketFred.fetch();

      expect(fetchUsMarketData).toHaveBeenCalled();
      expect(result).toEqual({ sp500: 4500 });
    });
  });

  describe("twMarketValuation", () => {
    it("有正確的 label", () => {
      expect(providerRegistry.twMarketValuation.label).toBe(
        "台股大盤估值 (PB/PE)",
      );
    });

    it("呼叫 fetchMarketValuation", async () => {
      fetchMarketValuation.mockResolvedValue({ pb: 1.5, pe: 18 });

      const result = await providerRegistry.twMarketValuation.fetch();

      expect(fetchMarketValuation).toHaveBeenCalled();
      expect(result).toEqual({ pb: 1.5, pe: 18 });
    });
  });

  describe("twMarketOverview", () => {
    it("有正確的 label", () => {
      expect(providerRegistry.twMarketOverview.label).toBe("大盤量價 (FMTQIK)");
    });

    it("呼叫 fetchMarketOverview", async () => {
      fetchMarketOverview.mockResolvedValue({ volume: 3000, change: 1.5 });

      const result = await providerRegistry.twMarketOverview.fetch();

      expect(fetchMarketOverview).toHaveBeenCalled();
      expect(result).toEqual({ volume: 3000, change: 1.5 });
    });
  });

  describe("usdTwdYahoo", () => {
    it("有正確的 label", () => {
      expect(providerRegistry.usdTwdYahoo.label).toBe("USD/TWD 匯率 (Yahoo)");
    });

    it("呼叫 fetchUsdTwdExchangeRate", async () => {
      fetchUsdTwdExchangeRate.mockResolvedValue({ rate: 31.5 });

      const result = await providerRegistry.usdTwdYahoo.fetch();

      expect(fetchUsdTwdExchangeRate).toHaveBeenCalled();
      expect(result).toEqual({ rate: 31.5 });
    });
  });

  describe("stockInstitutionalTwse", () => {
    it("有正確的 label", () => {
      expect(providerRegistry.stockInstitutionalTwse.label).toBe(
        "個股三大法人買賣超",
      );
    });

    it("預設 ticker 為 0050", async () => {
      fetchStockInstitutionalData.mockResolvedValue({ institutional: "buy" });

      const result = await providerRegistry.stockInstitutionalTwse.fetch();

      expect(fetchStockInstitutionalData).toHaveBeenCalledWith("0050");
      expect(result).toEqual({ institutional: "buy" });
    });

    it("接受自訂 ticker", async () => {
      fetchStockInstitutionalData.mockResolvedValue({ institutional: "sell" });

      const result =
        await providerRegistry.stockInstitutionalTwse.fetch("2330");

      expect(fetchStockInstitutionalData).toHaveBeenCalledWith("2330");
    });
  });

  describe("stockMarginTwse", () => {
    it("有正確的 label", () => {
      expect(providerRegistry.stockMarginTwse.label).toBe("個股融資融券");
    });

    it("預設 ticker 為 00675L", async () => {
      fetchStockMarginData.mockResolvedValue({ margin: 1000 });

      const result = await providerRegistry.stockMarginTwse.fetch();

      expect(fetchStockMarginData).toHaveBeenCalledWith("00675L");
      expect(result).toEqual({ margin: 1000 });
    });

    it("接受自訂 ticker", async () => {
      fetchStockMarginData.mockResolvedValue({ margin: 2000 });

      const result = await providerRegistry.stockMarginTwse.fetch("2330");

      expect(fetchStockMarginData).toHaveBeenCalledWith("2330");
    });
  });

  describe("twCentralBankRate", () => {
    it("有正確的 label", () => {
      expect(providerRegistry.twCentralBankRate.label).toBe(
        "台灣基準利率 (央行)",
      );
    });

    it("呼叫 macroProvider.fetchCentralBankRate", async () => {
      macroProvider.fetchCentralBankRate.mockResolvedValue({ rate: 1.875 });

      const result = await providerRegistry.twCentralBankRate.fetch();

      expect(macroProvider.fetchCentralBankRate).toHaveBeenCalled();
      expect(result).toEqual({ rate: 1.875 });
    });
  });

  describe("twCpiYoY", () => {
    it("有正確的 label", () => {
      expect(providerRegistry.twCpiYoY.label).toBe(
        "消費者物價指數年增率 (CPI)",
      );
    });

    it("呼叫 macroProvider.fetchCpiYoY", async () => {
      macroProvider.fetchCpiYoY.mockResolvedValue({ cpi: 2.5 });

      const result = await providerRegistry.twCpiYoY.fetch();

      expect(macroProvider.fetchCpiYoY).toHaveBeenCalled();
      expect(result).toEqual({ cpi: 2.5 });
    });
  });

  describe("dailyQuote", () => {
    it("有正確的 label", () => {
      expect(providerRegistry.dailyQuote.label).toBe("每日一句");
    });

    it("呼叫 getDailyQuote", async () => {
      getDailyQuote.mockResolvedValue({ quote: "Stay hungry" });

      const result = await providerRegistry.dailyQuote.fetch();

      expect(getDailyQuote).toHaveBeenCalled();
      expect(result).toEqual({ quote: "Stay hungry" });
    });
  });

  describe("ProviderError export", () => {
    it("匯出 ProviderError", () => {
      expect(ProviderError).toBeDefined();
      expect(typeof ProviderError).toBe("function");
    });
  });

  describe("所有 provider 都有 label 和 fetch", () => {
    it("每個 provider 都包含必要屬性", () => {
      const providers = Object.values(providerRegistry);
      for (const provider of providers) {
        expect(provider).toHaveProperty("label");
        expect(typeof provider.label).toBe("string");
        expect(provider).toHaveProperty("fetch");
        expect(typeof provider.fetch).toBe("function");
      }
    });
  });
});
