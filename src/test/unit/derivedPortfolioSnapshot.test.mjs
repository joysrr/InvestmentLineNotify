import { describe, expect, it } from "vitest";
import { buildDerivedPortfolioSnapshot } from "../../modules/portfolio/derivedPortfolioSnapshot.mjs";

describe("derivedPortfolioSnapshot", () => {
  it("derives account net asset and collateral value from portfolio fields and prices", () => {
    expect(
      buildDerivedPortfolioSnapshot({
        portfolio: {
          qty0050: 12000,
          qtyZ2: 6000,
          cash: 80000,
          totalLoan: 900000,
        },
        price0050: 178,
        priceZ2: 285,
        marketAsOf: "2026-10-24T06:00:00+08:00",
      }),
    ).toEqual({
      status: "DERIVED",
      reason: "DERIVED_FROM_PORTFOLIO_FIELDS_AND_MARKET_PRICES",
      source: "DERIVED_FROM_PORTFOLIO_FIELDS_AND_MARKET_PRICES",
      asOf: "2026-10-24T06:00:00+08:00",
      accountNetAsset: 3026000,
      collateralValue: 3846000,
      accountNetAssetSource: "DERIVED_FROM_PORTFOLIO_FIELDS_AND_MARKET_PRICES",
      accountNetAssetAsOf: "2026-10-24T06:00:00+08:00",
      collateralValueSource: "DERIVED_FROM_PORTFOLIO_FIELDS_AND_MARKET_PRICES",
      collateralValueAsOf: "2026-10-24T06:00:00+08:00",
    });
  });

  it("fails closed when a required derived input is missing", () => {
    expect(
      buildDerivedPortfolioSnapshot({
        portfolio: {
          qty0050: 12000,
          qtyZ2: 6000,
          cash: 80000,
          totalLoan: 900000,
        },
        price0050: null,
        priceZ2: 285,
        marketAsOf: "2026-10-24T06:00:00+08:00",
      }),
    ).toEqual({
      status: "UNAVAILABLE",
      reason: "MISSING_DERIVED_PORTFOLIO_INPUT",
      snapshot: null,
    });
  });

  it("does not claim verified provenance", () => {
    const result = buildDerivedPortfolioSnapshot({
      portfolio: {
        qty0050: 12000,
        qtyZ2: 6000,
        cash: 80000,
        totalLoan: 900000,
      },
      price0050: 178,
      priceZ2: 285,
      marketAsOf: "2026-10-24T06:00:00+08:00",
    });

    expect(result.status).not.toBe("VERIFIED");
  });
});
