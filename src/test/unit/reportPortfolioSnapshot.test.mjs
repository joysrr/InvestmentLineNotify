import { describe, expect, it } from "vitest";
import { buildReportPortfolioSnapshot } from "../../modules/portfolio/reportPortfolioSnapshot.mjs";

describe("reportPortfolioSnapshot", () => {
  it("uses verified fields when complete", () => {
    const result = buildReportPortfolioSnapshot({
      portfolio: {
        accountNetAsset: 5000000,
        collateralValue: 7000000,
        accountNetAssetSource: "BROKER_EXPORT",
        accountNetAssetAsOf: "2026-10-24T05:00:00+08:00",
        collateralValueSource: "BROKER_EXPORT",
        collateralValueAsOf: "2026-10-24T05:00:00+08:00",
      },
      price0050Snapshot: {
        price: 178,
        asOf: "2026-10-24T06:00:00+08:00",
      },
      priceZ2Snapshot: {
        price: 285,
        asOf: "2026-10-24T06:00:00+08:00",
      },
    });

    expect(result.status).toBe("VERIFIED");
    expect(result.accountNetAsset).toBe(5000000);
  });

  it("falls back to a derived snapshot only when both market timestamps exist", () => {
    const result = buildReportPortfolioSnapshot({
      portfolio: {
        qty0050: 12000,
        qtyZ2: 6000,
        cash: 80000,
        totalLoan: 900000,
      },
      price0050Snapshot: {
        price: 178,
        asOf: "2026-10-24T06:00:00+08:00",
      },
      priceZ2Snapshot: {
        price: 285,
        asOf: "2026-10-24T06:00:00+08:00",
      },
    });

    expect(result.status).toBe("DERIVED");
    expect(result.asOf).toBe("2026-10-24T06:00:00+08:00");
  });

  it("stays unavailable when market timestamp is missing", () => {
    const result = buildReportPortfolioSnapshot({
      portfolio: {
        qty0050: 12000,
        qtyZ2: 6000,
        cash: 80000,
        totalLoan: 900000,
      },
      price0050Snapshot: { price: 178, asOf: null },
      priceZ2Snapshot: { price: 285, asOf: null },
    });

    expect(result).toEqual({
      status: "UNAVAILABLE",
      reason: "ACCOUNT_FIELDS_NOT_VERIFIED",
      source: "INTERNAL_DERIVATION_ONLY",
      asOf: null,
    });
  });
});
