import { describe, expect, it } from "vitest";

import { buildReportReadOnlyView } from "../../modules/strategy/reportReadOnlyView.mjs";

describe("buildReportReadOnlyView", () => {
  it("legacy report stays unavailable without fabricating provenance", () => {
    const view = buildReportReadOnlyView({
      date: "2026-10-24",
      signals: { status: "hold" },
      portfolio: { totalLoan: 100000 },
    });

    expect(view).toEqual({
      date: "2026-10-24",
      dataAsOf: null,
      dataProvenance: [],
      strategyHash: null,
      fixtureSource: null,
      theoreticalSnapshot: {
        status: "UNAVAILABLE",
        reason: "MISSING_PROVENANCE",
        snapshot: null,
      },
      availability: {
        status: "UNAVAILABLE",
        reason: "MISSING_PROVENANCE",
      },
    });
  });

  it("preserves replay provenance and strategy hash as read-only metadata", () => {
    const view = buildReportReadOnlyView({
      date: "2026-08-14",
      replay: {
        dataAsOf: { market: { latestDate: "2026-08-14" } },
        dataProvenance: [
          { provider: "synthetic", dataset: "market", integrity: "unverified" },
        ],
        strategy: {
          hash: "sha256:981ef783fca08c480753a1aa221a1b94926538c77d31a6272cd192e69c47637d",
        },
        status: "available",
      },
      replayMetadata: { fixtureSource: "synthetic" },
      portfolioSnapshot: {
        status: "UNAVAILABLE",
        reason: "MISSING_PROVENANCE",
      },
    });

    expect(view.date).toBe("2026-08-14");
    expect(view.dataAsOf).toEqual({ market: { latestDate: "2026-08-14" } });
    expect(view.dataProvenance[0].provider).toBe("synthetic");
    expect(view.strategyHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(view.fixtureSource).toBe("synthetic");
    expect(view.theoreticalSnapshot.status).toBe("UNAVAILABLE");
    expect(view.availability).toEqual({ status: "AVAILABLE", reason: null });
  });
});
