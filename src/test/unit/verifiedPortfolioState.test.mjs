import { describe, expect, it } from "vitest";
import { buildVerifiedPortfolioState } from "../../modules/portfolio/verifiedPortfolioFields.mjs";

describe("verified portfolio state", () => {
  it("returns unavailable when the existing portfolio has no verified fields", () => {
    expect(buildVerifiedPortfolioState({ totalLoan: 900000 })).toEqual({
      status: "UNAVAILABLE",
      reason: "ACCOUNT_FIELDS_NOT_VERIFIED",
      source: "INTERNAL_DERIVATION_ONLY",
      asOf: null,
    });
  });

  it("preserves verified fields as a read-only account snapshot", () => {
    expect(
      buildVerifiedPortfolioState({
        date: "2026-10-24",
        qty0050: 12000,
        qtyZ2: 6000,
        totalLoan: 900000,
        cash: 80000,
        accountNetAsset: 1450000,
        accountNetAssetSource: "broker-readonly-export",
        accountNetAssetAsOf: "2026-10-24T06:00:00+08:00",
        collateralValue: 1800000,
        collateralValueSource: "broker-readonly-export",
        collateralValueAsOf: "2026-10-24T06:00:00+08:00",
      }),
    ).toEqual({
      status: "VERIFIED",
      source: "broker-readonly-export",
      asOf: "2026-10-24T06:00:00+08:00",
      accountNetAsset: 1450000,
      accountNetAssetSource: "broker-readonly-export",
      accountNetAssetAsOf: "2026-10-24T06:00:00+08:00",
      collateralValue: 1800000,
      collateralValueSource: "broker-readonly-export",
      collateralValueAsOf: "2026-10-24T06:00:00+08:00",
    });
  });
});
