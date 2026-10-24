/**
 * Builds a read-only derived portfolio snapshot.
 * Derived values must never be treated as externally verified account values.
 */

const DERIVED_SOURCE = "DERIVED_FROM_PORTFOLIO_FIELDS_AND_MARKET_PRICES";

function unavailable() {
  return {
    status: "UNAVAILABLE",
    reason: "MISSING_DERIVED_PORTFOLIO_INPUT",
    snapshot: null,
  };
}

export function buildDerivedPortfolioSnapshot({
  portfolio,
  price0050,
  priceZ2,
  marketAsOf,
}) {
  const values = [
    portfolio?.qty0050,
    portfolio?.qtyZ2,
    portfolio?.cash,
    portfolio?.totalLoan,
    price0050,
    priceZ2,
  ];

  if (!marketAsOf || !values.every(Number.isFinite)) return unavailable();

  const value0050 = portfolio.qty0050 * price0050;
  const value00675L = portfolio.qtyZ2 * priceZ2;
  const collateralValue = value0050 + value00675L;
  const accountNetAsset =
    collateralValue + portfolio.cash - portfolio.totalLoan;

  if (!Number.isFinite(accountNetAsset) || !Number.isFinite(collateralValue)) {
    return unavailable();
  }

  return {
    status: "DERIVED",
    reason: DERIVED_SOURCE,
    source: DERIVED_SOURCE,
    asOf: marketAsOf,
    accountNetAsset,
    collateralValue,
    accountNetAssetSource: DERIVED_SOURCE,
    accountNetAssetAsOf: marketAsOf,
    collateralValueSource: DERIVED_SOURCE,
    collateralValueAsOf: marketAsOf,
  };
}
