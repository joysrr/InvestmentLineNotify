/**
 * Maps a formal daily report to a read-only theory snapshot.
 * No derived account net asset and no decision mutation.
 */

function unavailable(reason) {
  return { status: "UNAVAILABLE", reason, snapshot: null };
}

function hasFiniteValues(values) {
  return values.every(Number.isFinite);
}

export function mapReportTheoreticalSnapshot(report) {
  const declaredSnapshot = report?.portfolioSnapshot;
  if (declaredSnapshot?.status === "UNAVAILABLE") {
    return unavailable(
      declaredSnapshot.reason ?? "PORTFOLIO_SNAPSHOT_UNAVAILABLE",
    );
  }

  if (
    declaredSnapshot?.status === "DERIVED" ||
    (typeof declaredSnapshot?.source === "string" &&
      declaredSnapshot.source.startsWith("DERIVED_"))
  ) {
    return unavailable("NON_VERIFIED_ACCOUNT_FIELDS");
  }

  const portfolio = report?.portfolio;
  if (!portfolio) return unavailable("MISSING_PORTFOLIO");

  const source = portfolio.accountNetAssetSource;
  const asOf = portfolio.accountNetAssetAsOf;
  const collateralSource = portfolio.collateralValueSource;
  const collateralAsOf = portfolio.collateralValueAsOf;
  if (source == null || asOf == null) {
    return unavailable("MISSING_PROVENANCE");
  }

  if (
    (typeof source === "string" && source.startsWith("DERIVED_")) ||
    (typeof collateralSource === "string" &&
      collateralSource.startsWith("DERIVED_"))
  ) {
    return unavailable("NON_VERIFIED_ACCOUNT_FIELDS");
  }

  if (
    portfolio.accountNetAsset == null ||
    portfolio.collateralValue == null ||
    collateralSource == null ||
    collateralAsOf == null
  ) {
    return unavailable("MISSING_VERIFIED_ACCOUNT_FIELDS");
  }

  if (
    portfolio.accountNetAsset == null ||
    portfolio.collateralValue == null ||
    portfolio.collateralValueSource == null ||
    portfolio.collateralValueAsOf == null
  ) {
    return unavailable("MISSING_VERIFIED_ACCOUNT_FIELDS");
  }

  const snapshot = {
    qty0050: portfolio.qty0050,
    qtyZ2: portfolio.qtyZ2,
    price0050: report.price0050,
    priceZ2: report.currentPrice,
    totalLoan: portfolio.totalLoan,
    accountNetAsset: portfolio.accountNetAsset,
    accountNetAssetSource: source,
    accountNetAssetAsOf: asOf,
    collateralValue: portfolio.collateralValue,
    collateralValueSource: portfolio.collateralValueSource,
    collateralValueAsOf: portfolio.collateralValueAsOf,
  };

  if (
    !hasFiniteValues([
      snapshot.qty0050,
      snapshot.qtyZ2,
      snapshot.price0050,
      snapshot.priceZ2,
      snapshot.totalLoan,
      snapshot.accountNetAsset,
      snapshot.collateralValue,
    ])
  ) {
    return unavailable("INVALID_REPORT_NUMBER");
  }

  return { status: "OK", source, asOf, snapshot };
}
