import { describe, expect, it } from "vitest";
import { mapVerifiedPortfolioFields } from "../../modules/portfolio/verifiedPortfolioFields.mjs";

function row(values) {
  return { get: (key) => values[key] ?? "" };
}

describe("verifiedPortfolioFields", () => {
  it("maps complete explicitly verified account fields", () => {
    expect(
      mapVerifiedPortfolioFields(
        row({
          帳戶淨資產: "1450000",
          擔保品市值: "1800000",
          帳戶淨資產來源: "broker-readonly-export",
          帳戶淨資產時間: "2026-10-24T06:00:00+08:00",
          擔保品市值來源: "broker-readonly-export",
          擔保品市值時間: "2026-10-24T06:00:00+08:00",
        }),
      ),
    ).toEqual({
      status: "VERIFIED",
      accountNetAsset: 1450000,
      accountNetAssetSource: "broker-readonly-export",
      accountNetAssetAsOf: "2026-10-24T06:00:00+08:00",
      collateralValue: 1800000,
      collateralValueSource: "broker-readonly-export",
      collateralValueAsOf: "2026-10-24T06:00:00+08:00",
    });
  });

  it("fails closed when any verified field or provenance is missing", () => {
    expect(
      mapVerifiedPortfolioFields(
        row({
          帳戶淨資產: "1450000",
          擔保品市值: "1800000",
          帳戶淨資產來源: "broker-readonly-export",
          帳戶淨資產時間: "2026-10-24T06:00:00+08:00",
          擔保品市值來源: "broker-readonly-export",
        }),
      ),
    ).toEqual({
      status: "UNAVAILABLE",
      reason: "MISSING_VERIFIED_ACCOUNT_FIELDS",
    });
  });
});
