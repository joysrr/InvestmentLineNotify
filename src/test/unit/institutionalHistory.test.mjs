import { describe, expect, it } from "vitest";
import { buildInstitutionalHistory } from "../../modules/strategy/institutionalHistory.mjs";

describe("buildInstitutionalHistory", () => {
  it("sorts valid trading dates, converts units, and excludes the current date", () => {
    const result = buildInstitutionalHistory(
      [
        { date: "20260814", totalNetBuy: 28074345 },
        { date: "20260812", totalNetBuy: -1000000 },
        { date: "20260813", totalNetBuy: 5000000 },
        { date: "invalid", totalNetBuy: 999999 },
        { date: "20260812", totalNetBuy: null },
      ],
      "20260814",
    );

    expect(result).toEqual([-1, 5]);
  });

  it("ignores missing and malformed provider records", () => {
    expect(
      buildInstitutionalHistory(
        [null, {}, { date: "20260812", totalNetBuy: "bad" }],
        "20260814",
      ),
    ).toEqual([]);
  });
});
