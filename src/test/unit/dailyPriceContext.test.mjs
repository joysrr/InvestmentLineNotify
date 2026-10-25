import { describe, expect, it } from "vitest";
import { buildDailyPriceContext } from "../../domain/dailyPriceContext.mjs";

describe("buildDailyPriceContext", () => {
  it("preserves legacy prices and exposes provenance snapshots", () => {
    expect(
      buildDailyPriceContext({
        price0050: {
          price: 178,
          asOf: "2026-10-24T06:00:00+08:00",
          source: "TWSE_MIS",
        },
        priceZ2: {
          price: 285,
          asOf: "2026-10-24T06:00:00+08:00",
          source: "TWSE_STOCK_DAY",
        },
      }),
    ).toEqual({
      price0050: 178,
      currentPriceZ2: 285,
      price0050Snapshot: {
        price: 178,
        asOf: "2026-10-24T06:00:00+08:00",
        source: "TWSE_MIS",
      },
      priceZ2Snapshot: {
        price: 285,
        asOf: "2026-10-24T06:00:00+08:00",
        source: "TWSE_STOCK_DAY",
      },
    });
  });

  it("keeps unavailable prices null and preserves their snapshots", () => {
    expect(
      buildDailyPriceContext({
        price0050: { price: null, asOf: null, source: null },
        priceZ2: { price: null, asOf: null, source: null },
      }),
    ).toEqual({
      price0050: null,
      currentPriceZ2: null,
      price0050Snapshot: { price: null, asOf: null, source: null },
      priceZ2Snapshot: { price: null, asOf: null, source: null },
    });
  });
});
