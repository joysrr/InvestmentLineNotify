import { describe, expect, it } from "vitest";
import {
  buildMarketPriceSnapshot,
  buildMarketPriceSnapshots,
} from "../../modules/portfolio/marketPriceSnapshot.mjs";

describe("buildMarketPriceSnapshot", () => {
  it("normalizes a provider quote with explicit source and asOf", () => {
    expect(
      buildMarketPriceSnapshot({
        symbol: "0050.TW",
        price: 178,
        time: "2026-10-24T06:00:00+08:00",
      }),
    ).toEqual({
      price: 178,
      source: "TWSE_MIS",
      asOf: "2026-10-24T06:00:00+08:00",
      dataStatus: "VERIFIED",
    });
  });

  it("builds snapshots for both portfolio market prices", () => {
    expect(
      buildMarketPriceSnapshots({
        price0050: { price: 178, time: "2026-10-24T06:00:00+08:00" },
        priceZ2: { price: 285, time: "2026-10-24T06:00:00+08:00" },
      }),
    ).toEqual({
      price0050: {
        price: 178,
        source: "TWSE_MIS",
        asOf: "2026-10-24T06:00:00+08:00",
        dataStatus: "VERIFIED",
      },
      priceZ2: {
        price: 285,
        source: "TWSE_MIS",
        asOf: "2026-10-24T06:00:00+08:00",
        dataStatus: "VERIFIED",
      },
    });
  });

  it("preserves an explicit fallback source", () => {
    expect(
      buildMarketPriceSnapshot({
        price: 177,
        time: "2026-10-24T13:30:00+08:00",
        source: "TWSE_STOCK_DAY",
      }),
    ).toMatchObject({
      price: 177,
      source: "TWSE_STOCK_DAY",
      dataStatus: "VERIFIED",
    });
  });

  it("fails closed when provider price or time is missing", () => {
    expect(
      buildMarketPriceSnapshot({
        symbol: "00675L.TW",
        price: null,
        time: null,
      }),
    ).toEqual({
      price: null,
      source: null,
      asOf: null,
      dataStatus: "SOURCE_UNAVAILABLE",
    });
  });
});
