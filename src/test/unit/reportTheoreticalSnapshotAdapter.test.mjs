import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { mapReportTheoreticalSnapshot } from "../../modules/strategy/reportTheoreticalSnapshotAdapter.mjs";

const completeReport = {
  date: "2026-10-24",
  price0050: 178,
  currentPrice: 285,
  portfolio: {
    qty0050: 12000,
    qtyZ2: 6000,
    totalLoan: 900000,
    accountNetAsset: 1450000,
    accountNetAssetSource: "broker-readonly-export",
    accountNetAssetAsOf: "2026-10-24T06:00:00+08:00",
    collateralValue: 1800000,
    collateralValueSource: "broker-readonly-export",
    collateralValueAsOf: "2026-10-24T06:00:00+08:00",
  },
};

describe("reportTheoreticalSnapshotAdapter", () => {
  it("maps a complete report snapshot with explicit provenance", () => {
    expect(mapReportTheoreticalSnapshot(completeReport)).toEqual({
      status: "OK",
      source: "broker-readonly-export",
      asOf: "2026-10-24T06:00:00+08:00",
      snapshot: {
        qty0050: 12000,
        qtyZ2: 6000,
        price0050: 178,
        priceZ2: 285,
        totalLoan: 900000,
        accountNetAsset: 1450000,
        accountNetAssetSource: "broker-readonly-export",
        accountNetAssetAsOf: "2026-10-24T06:00:00+08:00",
        collateralValue: 1800000,
        collateralValueSource: "broker-readonly-export",
        collateralValueAsOf: "2026-10-24T06:00:00+08:00",
      },
    });
  });

  it("fails closed for the existing report without verified account fields", async () => {
    const report = JSON.parse(
      await readFile(
        new URL("../../../data/reports/2026-10-24.json", import.meta.url),
        "utf8",
      ),
    );

    expect(mapReportTheoreticalSnapshot(report)).toEqual({
      status: "UNAVAILABLE",
      reason: "MISSING_PROVENANCE",
      snapshot: null,
    });
  });

  it("preserves an explicit unavailable portfolio snapshot reason", () => {
    const report = {
      portfolioSnapshot: {
        status: "UNAVAILABLE",
        reason: "ACCOUNT_FIELDS_NOT_VERIFIED",
        source: "INTERNAL_DERIVATION_ONLY",
        asOf: null,
      },
    };

    expect(mapReportTheoreticalSnapshot(report)).toEqual({
      status: "UNAVAILABLE",
      reason: "ACCOUNT_FIELDS_NOT_VERIFIED",
      snapshot: null,
    });
  });

  it("fails closed when verified account fields are incomplete", () => {
    const report = structuredClone(completeReport);
    delete report.portfolio.collateralValueAsOf;

    expect(mapReportTheoreticalSnapshot(report)).toEqual({
      status: "UNAVAILABLE",
      reason: "MISSING_VERIFIED_ACCOUNT_FIELDS",
      snapshot: null,
    });
  });

  it("fails closed when a report number is not finite", () => {
    const report = structuredClone(completeReport);
    report.portfolio.accountNetAsset = Number.NaN;

    expect(mapReportTheoreticalSnapshot(report)).toEqual({
      status: "UNAVAILABLE",
      reason: "INVALID_REPORT_NUMBER",
      snapshot: null,
    });
  });
});
