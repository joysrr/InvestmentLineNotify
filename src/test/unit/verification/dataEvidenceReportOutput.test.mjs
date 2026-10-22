import { describe, expect, it } from "vitest";
import {
  renderEvidenceMarkdown,
  loadPersistedEvidenceInputs,
} from "../../../modules/verification/dataEvidenceReportOutput.mjs";

describe("data evidence report output", () => {
  it("renders a Markdown report with source, temporal, and verification evidence", () => {
    const report = {
      schemaVersion: "1.0",
      reportType: "data-evidence",
      generatedAt: "2026-10-21T13:00:00.000Z",
      verificationScope:
        "persisted evidence only; no external API re-fetch was performed",
      instructions: ["Check the source."],
      items: [
        {
          field: "data.rawValuation.pb",
          value: 4.05,
          unit: "倍",
          source: {
            provider: "twMarketValuation",
            dataset: "rawValuation",
            status: "SUCCESS",
            endpoint: null,
          },
          temporal: {
            dataDate: "20261020",
            fetchedAt: "2026-10-21T12:19:54.469Z",
            persistedAt: "2026-10-21T12:19:54.469Z",
            freshnessBasis: "最近交易日",
          },
          verification: {
            background: "台股市場整體淨值比。",
            checks: ["查核官方來源。"],
            calculation: "來源直接提供。",
            externalAgentStatus: "PENDING_EXTERNAL_VERIFICATION",
          },
        },
      ],
    };

    const markdown = renderEvidenceMarkdown(report);

    expect(markdown).toContain("# Data Evidence Report");
    expect(markdown).toContain("PENDING_EXTERNAL_VERIFICATION");
    expect(markdown).toContain("data.rawValuation.pb");
    expect(markdown).toContain("20261020");
    expect(markdown).toContain("查核官方來源。");
  });

  it("loads the persisted evidence inputs from the project data directory", () => {
    const inputs = loadPersistedEvidenceInputs(
      "/workspace/projects/InvestmentLineNotify",
    );

    expect(inputs.market.data).toBeDefined();
    expect(Array.isArray(inputs.pbHistory)).toBe(true);
    expect(Array.isArray(inputs.vixHistory)).toBe(true);
    expect(inputs.sentiment).toBeDefined();
  });
});
