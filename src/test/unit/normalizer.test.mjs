import { describe, expect, it } from "vitest";
import { normalizeMarketData } from "../../utils/normalizer.mjs";

describe("normalizeMarketData", () => {
  it("maps raw market slots to normalized values without mixing domains", () => {
    const result = normalizeMarketData({
      rawValuation: { pe: 26.1, pb: 4.17, currentPR: 82.5, yield: 1.59 },
      rawUsMarket: { vix: 29.07 },
      rawCnn: { score: 64.97 },
      rawMargin: { maintenanceRatio: 194.15 },
      rawFx: { currentRate: 31.882 },
      rawInstitutional: { totalNetBuy: 28074345 },
      rawNdc: { score: 41, light: "紅燈" },
      rawCpi: { value: 2.1 },
      rawBankRate: { value: 1.875 },
    });

    expect(result).toMatchObject({
      valuation: { pe: 26.1, pb: 4.17, pr: 82.5, yield: 1.59 },
      sentiment: { vix: 29.07, fearGreed: 64.97, isPanic: false },
      liquidity: {
        marginRatio: 194.15,
        fxRate: 31.882,
        institutionalNetBuy: 28.074345,
      },
      economy: { ndcScore: 41, ndcLight: "紅燈", cpiYoY: 2.1, bankRate: 1.875 },
    });
  });

  it("preserves missing raw values as null instead of zero", () => {
    const result = normalizeMarketData({});

    expect(result.valuation.pr).toBeNull();
    expect(result.liquidity.marginRatio).toBeNull();
    expect(result.liquidity.fxRate).toBeNull();
    expect(result.liquidity.institutionalNetBuy).toBeNull();
    expect(result.economy.cpiYoY).toBeNull();
  });
});
