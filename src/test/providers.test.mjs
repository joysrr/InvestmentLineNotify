import { describe, it, expect } from "vitest";
import { fetchFearAndGreedIndex } from "../modules/providers/cnnProvider.mjs";
import { fetchUsdTwdExchangeRate } from "../modules/providers/yahooProvider.mjs";
import { fetchBusinessIndicator } from "../modules/providers/ndcProvider.mjs";
import { fetchTwseMarginData } from "../modules/providers/kgiProvider.mjs";
import { fetchFinMindMarginData } from "../modules/providers/finmindProvider.mjs";
import {
  fetchRealtimeFromMis,
  getTwVix,
  loadHolidaySet,
  isMarketOpenTodayTWSE,
  fetchStockHistory,
  fetchLatestClose,
  fetchRealTimePrice,
  fetchMarketValuation,
  fetchMarketOverview,
} from "../modules/providers/twseProvider.mjs";
import {
  formatCnnDataForAi,
  formatMarginForAi,
  formatFxForAi,
  formatBusinessIndicatorForAi,
} from "../modules/ai/aiDataPreprocessor.mjs";

describe("Market Data Providers Integration", () => {
  it("CNN Fear & Greed Index API", async () => {
    const result = await fetchFearAndGreedIndex();
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("KGI Margin Data API", async () => {
    const result = await fetchTwseMarginData();
    expect(result).toBeDefined();
    expect(result.maintenanceRatio).toBeGreaterThan(130);
  });

  it("Yahoo USD/TWD Exchange Rate API", async () => {
    const result = await fetchUsdTwdExchangeRate();
    expect(result).toBeDefined();
    const rate = result.currentRate || result.exchangeRate;
    expect(rate).toBeGreaterThan(25);
    expect(rate).toBeLessThan(40);
  });

  it("NDC Business Indicator API", async () => {
    const result = await fetchBusinessIndicator();
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(9);
  });

  it("TWSE Market Valuation PB/PE", async () => {
    const result = await fetchMarketValuation();
    expect(result).toBeDefined();
    if (result.pb !== null) {
      expect(result.pb).toBeGreaterThan(0.5);
    }
  });

  it("AI Data Preprocessor: formatCnnDataForAi", () => {
    const mockData = { score: 20, rating: "extreme fear", previousClose: 25 };
    const formatted = formatCnnDataForAi(mockData);
    expect(formatted["當前狀態"]).toContain("極度恐慌");
  });
});
