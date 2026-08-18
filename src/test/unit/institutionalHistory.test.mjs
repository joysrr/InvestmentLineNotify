import { describe, expect, it } from "vitest";
import {
  buildInstitutionalHistory,
  extractInstitutionalHistoryRecords,
} from "../../modules/strategy/institutionalHistory.mjs";

describe("extractInstitutionalHistoryRecords", () => {
  it("extracts raw institutional records from market snapshots", () => {
    expect(
      extractInstitutionalHistoryRecords([
        {
          date: "2026-08-14",
          data: {
            rawInstitutional: { date: "20260813", totalNetBuy: 5000000 },
          },
        },
        {
          date: "2026-08-15",
          data: { rawInstitutional: null },
        },
      ]),
    ).toEqual([{ date: "20260813", totalNetBuy: 5000000 }]);
  });
});

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

  it("uses the last valid record when a trading date is duplicated", () => {
    expect(
      buildInstitutionalHistory(
        [
          { date: "20260812", totalNetBuy: 1000000 },
          { date: "20260812", totalNetBuy: 3000000 },
        ],
        "20260814",
      ),
    ).toEqual([3]);
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
