function normalizeQuote(quote) {
  return {
    price: quote?.price ?? null,
    time: quote?.time ?? null,
    source: quote?.source ?? null,
  };
}

export function buildDailyPriceContext({ price0050, priceZ2 }) {
  const normalized0050 = normalizeQuote(price0050);
  const normalizedZ2 = normalizeQuote(priceZ2);

  return {
    price0050: normalized0050.price,
    currentPriceZ2: normalizedZ2.price,
    price0050Snapshot: normalized0050,
    priceZ2Snapshot: normalizedZ2,
  };
}
