import { describe, expect, it } from "vitest";
import { buildDataEvidenceReport } from "../../../modules/verification/dataEvidenceReport.mjs";

describe("data evidence report", () => {
  it("builds externally verifiable evidence for a persisted market metric", () => {
    const report = buildDataEvidenceReport({
      generatedAt: "2026-10-21T13:00:00.000Z",
      market: {
        _meta: {
          lastRun: "2026-10-21T12:19:54.469Z",
          sources: {
            twMarketValuation: {
              status: "SUCCESS",
              lastFetch: "2026-10-21T12:19:54.469Z",
              provider: "twMarketValuation",
              dataset: "rawValuation",
              rawHash: "sha256:example",
              integrity: "verified",
            },
          },
        },
        data: {
          rawValuation: {
            pb: 4.05,
            date: "20261020",
          },
        },
      },
    });

    expect(report.schemaVersion).toBe("1.0");
    expect(report.generatedAt).toBe("2026-10-21T13:00:00.000Z");
    expect(report.instructions.length).toBeGreaterThan(0);
    expect(report.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "data.rawValuation.pb",
          value: 4.05,
          source: expect.objectContaining({
            provider: "twMarketValuation",
            status: "SUCCESS",
            lastFetch: "2026-10-21T12:19:54.469Z",
          }),
          temporal: expect.objectContaining({
            dataDate: "20261020",
            freshnessBasis: expect.any(String),
          }),
          verification: expect.objectContaining({
            background: expect.any(String),
            checks: expect.arrayContaining([expect.any(String)]),
          }),
        }),
      ]),
    );
  });

  it("includes persisted market, history, and sentiment evidence with temporal context", () => {
    const report = buildDataEvidenceReport({
      generatedAt: "2026-10-21T13:00:00.000Z",
      market: {
        _meta: {
          lastRun: "2026-10-21T12:19:54.469Z",
          sources: {
            cnnFearGreed: {
              status: "SUCCESS",
              lastFetch: "2026-10-21T12:19:54.469Z",
            },
            twMarketOverview: {
              status: "SUCCESS",
              lastFetch: "2026-10-21T12:19:54.469Z",
            },
          },
        },
        data: {
          rawCnn: { score: 29.03, timestamp: "2026-10-21T11:59:42.000Z" },
          rawMarketOverview: { taiex: 46292.93, date: "1151020" },
        },
      },
      pbHistory: [{ date: "20261020", pb: 4.05 }],
      vixHistory: [{ date: "2026-10-21", value: 28.09 }],
      sentiment: {
        date: "2026-10-21",
        updatedAt: "2026-10-21T04:00:42.402Z",
        score: 39,
        ma3: 33.7,
        ma7: 34.6,
        sampleCount: 122,
        pttItems: 20,
        bskyItems: 102,
      },
    });

    expect(report.items.map((item) => item.field)).toEqual(
      expect.arrayContaining([
        "data.rawCnn.score",
        "data.rawMarketOverview.taiex",
        "data.pbHistory.latest.pb",
        "data.vixHistory.latest.value",
        "data.sentiment.social_sentiment_daily.score",
      ]),
    );
    const cnn = report.items.find((item) => item.field === "data.rawCnn.score");
    expect(cnn.temporal.dataDate).toBe("2026-10-21T11:59:42.000Z");
    expect(cnn.verification.externalAgentStatus).toBe(
      "PENDING_EXTERNAL_VERIFICATION",
    );
  });
});
