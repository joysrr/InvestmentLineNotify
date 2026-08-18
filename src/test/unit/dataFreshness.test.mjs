import { describe, expect, it } from "vitest";
import {
  applyFreshnessGuard,
  buildFreshnessGuardDecision,
  evaluateFreshness,
  evaluateFreshnessFields,
  freshnessMetadataMismatch,
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

  it("evaluates multiple fields independently", () => {
    expect(
      evaluateFreshnessFields({
        z2History: {
          latestDate: "2026-08-03",
          reportDate: "2026-08-07",
          tradingDays: [
            "2026-08-03",
            "2026-08-04",
            "2026-08-05",
            "2026-08-06",
            "2026-08-07",
          ],
          staleAfterTradingDays: 3,
        },
        institutionalHistory: {
          latestDate: null,
          reportDate: "2026-08-07",
          tradingDays: [],
          staleAfterTradingDays: 3,
        },
      }),
    ).toEqual({
      z2History: { status: "stale", tradingDayGap: 4 },
      institutionalHistory: { status: "unavailable", tradingDayGap: null },
    });
  });

  it("fails closed when replay and history metadata disagree", () => {
    expect(
      freshnessMetadataMismatch(
        { z2History: { latestDate: "2026-08-03" } },
        { z2History: { latestDate: "2026-08-04" } },
      ),
    ).toBe(true);
    expect(
      freshnessMetadataMismatch(
        { z2History: { latestDate: "2026-08-03" } },
        { z2History: { latestDate: "2026-08-03" } },
      ),
    ).toBe(false);
  });

  it("records shadow wouldBlock without changing the decision", () => {
    const decision = buildFreshnessGuardDecision({
      mode: "shadow",
      freshness: { z2History: { status: "stale" } },
      affectedSignals: ["buy_tactical"],
    });
    const result = { signals: { signalDirection: "buy_tactical" } };

    expect(decision).toEqual({
      mode: "shadow",
      wouldBlock: true,
      blockedSignals: ["buy_tactical"],
    });
    expect(applyFreshnessGuard(result, decision)).toBe(result);
  });

  it("blocks affected tactical signal in enforcement but bypasses P0 decisions", () => {
    const decision = buildFreshnessGuardDecision({
      mode: "enforcement",
      freshness: { z2History: { status: "stale" } },
      affectedSignals: ["buy_tactical"],
    });
    const tactical = { signals: { signalDirection: "buy_tactical" } };
    const crisis = { signals: { signalDirection: "margin_critical" } };

    expect(applyFreshnessGuard(tactical, decision).signals).toMatchObject({
      rawSignal: "buy_tactical",
      signalDirection: "hold",
      blockedByDataFreshness: true,
    });
    expect(applyFreshnessGuard(crisis, decision)).toBe(crisis);
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
