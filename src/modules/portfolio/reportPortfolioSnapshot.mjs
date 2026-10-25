import { buildDerivedPortfolioSnapshot } from "./derivedPortfolioSnapshot.mjs";
import { buildVerifiedPortfolioState } from "./verifiedPortfolioFields.mjs";

export function buildReportPortfolioSnapshot({
  portfolio,
  price0050Snapshot,
  priceZ2Snapshot,
}) {
  const verified = buildVerifiedPortfolioState(portfolio);
  if (verified.status === "VERIFIED") return verified;

  const marketAsOf =
    price0050Snapshot?.asOf &&
    String(priceZ2Snapshot?.asOf) === String(price0050Snapshot.asOf)
      ? price0050Snapshot.asOf
      : null;

  const derived = buildDerivedPortfolioSnapshot({
    portfolio,
    price0050: price0050Snapshot?.price,
    priceZ2: priceZ2Snapshot?.price,
    marketAsOf,
  });

  return derived.status === "DERIVED" ? derived : verified;
}
