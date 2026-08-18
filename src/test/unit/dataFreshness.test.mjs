import { describe, expect, it } from "vitest";
import {
  evaluateFreshness,
  tradingDayGap,
} from "../../domain/dataFreshness.mjs";

describe("data freshness", () => {
  it("counts gaps from the supplied trading-day sequence", () => {
    expect(
      tradingDayGap("2026-08-03", "2026-08-07", [
        "2026-08-03",
        "2026-08-04",
        "2026-08-05",
        "2026-08-06",
        "2026-08-07",
      ]),
    ).toBe(4);
  });

  it("marks missing data unavailable", () => {
    expect(evaluateFreshness(null, "2026-08-17", [], 3)).toEqual({
      status: "unavailable",
      tradingDayGap: null,
    });
  });

  it("marks gap at the configured threshold stale", () => {
    expect(
      evaluateFreshness(
        "2026-08-03",
        "2026-08-07",
        ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07"],
        3,
      ),
    ).toEqual({ status: "stale", tradingDayGap: 4 });
  });
});
