import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildReplayTheoreticalShadowReport,
  mapReplayTheoreticalInputs,
} from "../../modules/strategy/replayTheoreticalAdapter.mjs";

const fixturePath = fileURLToPath(
  new URL(
    "../../../data/replay-fixtures/portfolio-shadow-v1.json",
    import.meta.url,
  ),
);

async function loadFixture() {
  return JSON.parse(await readFile(fixturePath, "utf8"));
}

describe("portfolio-shadow-v1 replay fixture", () => {
  it("provides verified portfolio inputs for shadow theory", async () => {
    const fixture = await loadFixture();
    const mapped = mapReplayTheoreticalInputs(fixture.reports[0]);

    expect(mapped).toMatchObject({
      status: "OK",
      inputs: {
        value0050: {
          value: 200000,
          source: "synthetic-portfolio",
          asOf: "2026-08-20T06:00:00Z",
          unit: "TWD",
          status: "VERIFIED",
        },
        value00675L: {
          value: 40000,
          source: "synthetic-portfolio",
          asOf: "2026-08-20T06:00:00Z",
          unit: "TWD",
          status: "VERIFIED",
        },
        totalDebt: {
          value: 200000,
          source: "synthetic-portfolio",
          asOf: "2026-08-20T06:00:00Z",
          unit: "TWD",
          status: "VERIFIED",
        },
      },
    });
  });

  it("calculates gross exposure without inventing account net asset", async () => {
    const fixture = await loadFixture();
    const report = buildReplayTheoreticalShadowReport(fixture.reports[0]);

    expect(report).toMatchObject({
      timestamp: "2026-08-20",
      actualDecision: { signal: "hold" },
      theory: {
        status: "RESEARCH_ONLY",
        grossExposure: 280000,
        currentLeverage: null,
      },
    });
  });
});
