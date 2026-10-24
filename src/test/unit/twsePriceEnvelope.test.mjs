import { describe, expect, it } from "vitest";
import { buildTwsePriceEnvelope } from "../../modules/providers/twseProvider.mjs";

describe("buildTwsePriceEnvelope", () => {
  it("marks MIS quotes with TWSE_MIS source", () => {
    expect(
      buildTwsePriceEnvelope({
        price: 178,
        time: "2026-10-24T06:00:00+08:00",
        source: "MIS",
      }),
    ).toEqual({
      price: 178,
      time: "2026-10-24T06:00:00+08:00",
      source: "TWSE_MIS",
    });
  });

  it("marks close fallback quotes with TWSE_STOCK_DAY source", () => {
    expect(
      buildTwsePriceEnvelope({
        price: 177,
        time: "2026-10-24T13:30:00+08:00",
        source: "STOCK_DAY",
      }),
    ).toEqual({
      price: 177,
      time: "2026-10-24T13:30:00+08:00",
      source: "TWSE_STOCK_DAY",
    });
  });
});
