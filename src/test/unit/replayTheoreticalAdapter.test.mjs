import { describe, expect, it } from "vitest";
import {
  buildReplayTheoreticalShadowReport,
  mapReplayTheoreticalInputs,
} from "../../modules/strategy/replayTheoreticalAdapter.mjs";

describe("replayTheoreticalAdapter.mapReplayTheoreticalInputs", () => {
  it("returns unavailable when replay has no portfolio snapshot", () => {
    expect(
      mapReplayTheoreticalInputs({
        date: "2026-08-14",
        replay: {
          signalData: { finalScore: 3.2 },
          dataAsOf: { market: { latestDate: "2026-08-14" } },
          strategy: { hash: "sha256:fixture" },
          finalDecision: { signal: "hold" },
        },
      }),
    ).toEqual({
      status: "UNAVAILABLE",
      reason: "MISSING_PORTFOLIO_SNAPSHOT",
      inputs: null,
    });
  });

  it("maps an explicit replay portfolio snapshot", () => {
    expect(
      mapReplayTheoreticalInputs({
        date: "2026-08-14",
        replay: {
          portfolioSnapshot: {
            qty0050: 1000,
            qtyZ2: 500,
            totalLoan: 200000,
            cash: 100000,
            price0050: 200,
            priceZ2: 80,
          },
          portfolioSource: "synthetic-portfolio",
          portfolioAsOf: "2026-08-14T06:00:00Z",
        },
      }),
    ).toMatchObject({
      status: "OK",
      inputs: {
        value0050: {
          value: 200000,
          source: "synthetic-portfolio",
          asOf: "2026-08-14T06:00:00Z",
          status: "VERIFIED",
        },
        value00675L: {
          value: 40000,
          source: "synthetic-portfolio",
          asOf: "2026-08-14T06:00:00Z",
          status: "VERIFIED",
        },
        totalDebt: {
          value: 200000,
          source: "synthetic-portfolio",
          asOf: "2026-08-14T06:00:00Z",
          status: "VERIFIED",
        },
      },
    });
  });

  it("returns unavailable when portfolio provenance is missing", () => {
    expect(
      mapReplayTheoreticalInputs({
        date: "2026-08-14",
        replay: {
          portfolioSnapshot: {
            qty0050: 1000,
            qtyZ2: 500,
            totalLoan: 200000,
            cash: 100000,
            price0050: 200,
            priceZ2: 80,
          },
        },
      }),
    ).toEqual({
      status: "UNAVAILABLE",
      reason: "MISSING_PROVENANCE",
      inputs: null,
    });
  });

  it("builds a shadow report without replacing the replay decision", () => {
    expect(
      buildReplayTheoreticalShadowReport({
        date: "2026-08-14",
        replay: {
          finalDecision: { signal: "hold" },
          signalData: { finalScore: 3.2 },
        },
      }),
    ).toEqual({
      timestamp: "2026-08-14",
      actualDecision: { signal: "hold" },
      theory: {
        status: "RESEARCH_ONLY",
        grossExposure: null,
        currentLeverage: null,
        accountNetAsset: null,
        recommendedLeverage: null,
      },
      inputs: null,
      dataStatus: "UNAVAILABLE",
      dataReason: "MISSING_PORTFOLIO_SNAPSHOT",
    });
  });
});
