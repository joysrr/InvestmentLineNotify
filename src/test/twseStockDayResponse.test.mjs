import { describe, expect, it } from "vitest";
import { parseStockDayResponse } from "../modules/providers/twseProvider.mjs";

describe("TWSE STOCK_DAY response", () => {
  it("rejects non-OK responses instead of returning empty history", () => {
    expect(() =>
      parseStockDayResponse(
        { stat: "查無此資料", data: [] },
        "00675L",
        "202609",
      ),
    ).toThrow(/TWSE STOCK_DAY 00675L 202609/);
  });

  it("normalizes a successful response into historical rows", () => {
    const result = parseStockDayResponse(
      {
        stat: "OK",
        data: [["115/09/01", "1,000", "100", "10", "11", "9", "10.5"]],
      },
      "00675L",
      "202609",
    );

    expect(result).toEqual([
      {
        date: "2026-09-01",
        open: 10,
        high: 11,
        low: 9,
        close: 10.5,
        volume: 1000,
      },
    ]);
  });
});
