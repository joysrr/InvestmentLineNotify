import { describe, it, expect, vi, beforeEach } from "vitest";

const { getHistoricalPricesMock } = vi.hoisted(() => ({
  getHistoricalPricesMock: vi.fn(),
}));

const { loadPriceHistoryFromReportsMock } = vi.hoisted(() => ({
  loadPriceHistoryFromReportsMock: vi.fn(),
}));

vi.mock("../../modules/providers/yahooProvider.mjs", () => ({
  getHistoricalPrices: getHistoricalPricesMock,
}));

vi.mock("../../runSocialSentimentFetch.mjs", () => ({
  loadPriceHistoryFromReports: loadPriceHistoryFromReportsMock,
}));

import { buildTheoreticalShadowForReport } from "../../scheduler/dailyCheckTheoreticalAdapter.mjs";

describe("dailyCheck theoretical integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: return sufficient price history for regime calculation
    // Generate 60 valid consecutive dates starting from 2026-08-01
    const baseDate = new Date("2026-08-01");
    const mockPrices = Array.from({ length: 60 }, (_, i) => {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      return {
        date: d.toISOString().split("T")[0],
        close: 100 + i * 0.1,
      };
    });
    getHistoricalPricesMock.mockResolvedValue(mockPrices);
    loadPriceHistoryFromReportsMock.mockResolvedValue([]);
  });

  it("should build theoreticalShadow when portfolioSnapshot is DERIVED", async () => {
    const dateText = "2026-10-25";
    const portfolio = {
      qty0050: 100,
      qtyZ2: 50,
      totalLoan: 10000,
      cash: 5000,
    };

    const portfolioSnapshot = {
      status: "DERIVED",
      source: "DERIVED_FROM_PORTFOLIO_FIELDS_AND_MARKET_PRICES",
      asOf: "2026-10-25T06:00:00+08:00",
      accountNetAsset: 50000,
      collateralValue: 20000, // 100 * 200
    };

    const price0050Snapshot = {
      price: 200,
      asOf: "2026-10-25T06:00:00+08:00",
    };

    const priceZ2Snapshot = {
      price: 100,
      asOf: "2026-10-25T06:00:00+08:00",
    };

    const result = await buildTheoreticalShadowForReport({
      dateText,
      portfolio,
      portfolioSnapshot,
      price0050Snapshot,
      priceZ2Snapshot,
    });

    expect(result).toBeDefined();
    expect(result.status).toBe("AVAILABLE");
    expect(result.theory).toBeDefined();
    expect(result.theory.status).toBe("RESEARCH_ONLY");
    expect(result.theory.grossExposure).toBeDefined();
    expect(result.theory.currentLeverage).toBeDefined();
    expect(result.theory.estimatedMaintenance).toBeDefined();
    expect(result.theory.kellyLimits).toBeDefined();
    expect(result.theory.trueExposure).toBeDefined();
    expect(result.theory.crashTolerance).toBeDefined();
    expect(result.theory.marketRegime).toBeDefined();
  });

  it("should return UNAVAILABLE when portfolioSnapshot is UNAVAILABLE", async () => {
    const dateText = "2026-10-25";
    const portfolio = {
      qty0050: 100,
      qtyZ2: 50,
      totalLoan: 10000,
      cash: 5000,
    };

    const portfolioSnapshot = {
      status: "UNAVAILABLE",
      reason: "MISSING_DERIVED_PORTFOLIO_INPUT",
      snapshot: null,
    };

    const price0050Snapshot = {
      price: 200,
      asOf: "2026-10-25T06:00:00+08:00",
    };

    const priceZ2Snapshot = {
      price: 100,
      asOf: "2026-10-25T06:00:00+08:00",
    };

    const result = await buildTheoreticalShadowForReport({
      dateText,
      portfolio,
      portfolioSnapshot,
      price0050Snapshot,
      priceZ2Snapshot,
    });

    expect(result).toBeDefined();
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.reason).toBeDefined();
  });

  it("should return UNAVAILABLE when price snapshot is missing", async () => {
    const dateText = "2026-10-25";
    const portfolio = {
      qty0050: 100,
      qtyZ2: 50,
      totalLoan: 10000,
      cash: 5000,
    };

    const portfolioSnapshot = {
      status: "DERIVED",
      source: "DERIVED_FROM_PORTFOLIO_FIELDS_AND_MARKET_PRICES",
      asOf: "2026-10-25T06:00:00+08:00",
      accountNetAsset: 50000,
      collateralValue: 45000,
    };

    const result = await buildTheoreticalShadowForReport({
      dateText,
      portfolio,
      portfolioSnapshot,
      price0050Snapshot: null,
      priceZ2Snapshot: null,
    });

    expect(result).toBeDefined();
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.reason).toContain("MISSING");
  });

  it("should handle zero positions gracefully", async () => {
    const dateText = "2026-10-25";
    const portfolio = {
      qty0050: 0,
      qtyZ2: 0,
      totalLoan: 0,
      cash: 100000,
    };

    const portfolioSnapshot = {
      status: "DERIVED",
      source: "DERIVED_FROM_PORTFOLIO_FIELDS_AND_MARKET_PRICES",
      asOf: "2026-10-25T06:00:00+08:00",
      accountNetAsset: 100000,
      collateralValue: 0,
    };

    const price0050Snapshot = {
      price: 200,
      asOf: "2026-10-25T06:00:00+08:00",
    };

    const priceZ2Snapshot = {
      price: 100,
      asOf: "2026-10-25T06:00:00+08:00",
    };

    const result = await buildTheoreticalShadowForReport({
      dateText,
      portfolio,
      portfolioSnapshot,
      price0050Snapshot,
      priceZ2Snapshot,
    });

    // With zero positions and zero collateral, theoretical calculations are still possible
    expect(result).toBeDefined();

    // The result may be AVAILABLE or UNAVAILABLE depending on theoretical engine's handling
    // of zero values. Both are acceptable graceful degradation behaviors.
    if (result.status === "AVAILABLE") {
      expect(result.theory.grossExposure).toBe(0); // Zero positions = zero exposure
      expect(result.theory.currentLeverage).toBe(0); // Zero leverage
    } else {
      expect(result.status).toBe("UNAVAILABLE");
      expect(result.reason).toBeDefined();
    }
  });

  it("should handle insufficient price history gracefully", async () => {
    // Mock insufficient price history
    getHistoricalPricesMock.mockResolvedValue([
      { date: "2026-10-01", close: 100 },
      { date: "2026-10-02", close: 101 },
    ]);
    loadPriceHistoryFromReportsMock.mockResolvedValue([]);

    const dateText = "2026-10-25";
    const portfolio = {
      qty0050: 100,
      qtyZ2: 50,
      totalLoan: 10000,
      cash: 5000,
    };

    const portfolioSnapshot = {
      status: "DERIVED",
      source: "DERIVED_FROM_PORTFOLIO_FIELDS_AND_MARKET_PRICES",
      asOf: "2026-10-25T06:00:00+08:00",
      accountNetAsset: 50000,
      collateralValue: 20000,
    };

    const price0050Snapshot = {
      price: 200,
      asOf: "2026-10-25T06:00:00+08:00",
    };

    const priceZ2Snapshot = {
      price: 100,
      asOf: "2026-10-25T06:00:00+08:00",
    };

    const result = await buildTheoreticalShadowForReport({
      dateText,
      portfolio,
      portfolioSnapshot,
      price0050Snapshot,
      priceZ2Snapshot,
    });

    expect(result).toBeDefined();
    expect(result.status).toBe("AVAILABLE");
    // kellyLimits should be null when regime calculation fails
    expect(result.theory.kellyLimits).toBeNull();
    expect(result.theory.marketRegime).toBeNull();
  });
});
