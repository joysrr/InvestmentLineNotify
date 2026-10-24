const MARKET_PRICE_SOURCE = "TWSE_MIS";

export function buildMarketPriceSnapshots({ price0050, priceZ2 }) {
  return {
    price0050: buildMarketPriceSnapshot(price0050),
    priceZ2: buildMarketPriceSnapshot(priceZ2),
  };
}

export function buildMarketPriceSnapshot({
  price,
  time,
  source = MARKET_PRICE_SOURCE,
}) {
  if (
    !Number.isFinite(price) ||
    price <= 0 ||
    time == null ||
    Number.isNaN(new Date(time).getTime())
  ) {
    return {
      price: null,
      source: null,
      asOf: null,
      dataStatus: "SOURCE_UNAVAILABLE",
    };
  }

  return {
    price,
    source,
    asOf: time instanceof Date ? time.toISOString() : time,
    dataStatus: "VERIFIED",
  };
}
