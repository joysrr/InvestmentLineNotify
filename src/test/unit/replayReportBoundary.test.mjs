import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  buildReplayEvidenceEnvelope,
  buildReplayEvidenceEnvelopeFromReplay,
  persistReplayEvidence,
  buildReplayReportPlan,
  verifyReplayReportFile,
  writeReplayReport,
} from "../../modules/replay/replayReportBoundary.mjs";

const report = {
  date: "2026-10-24",
  portfolioSnapshot: {
    status: "DERIVED",
    source: "DERIVED_FROM_PORTFOLIO_FIELDS_AND_MARKET_PRICES",
    asOf: "2026-10-24T06:00:00+08:00",
  },
};

describe("replay report boundary", () => {
  it("dry-run separates replayDate from dataAsOf and never writes canonical output", async () => {
    const writeFile = vi.fn();

    const plan = buildReplayReportPlan({
      replayDate: "2026-10-24",
      dataAsOf: "2026-10-24T06:00:00+08:00",
      report,
    });

    expect(plan).toEqual({
      mode: "dry-run",
      replayDate: "2026-10-24",
      dataAsOf: "2026-10-24T06:00:00+08:00",
      canonicalFilename: "2026-10-24.json",
      writeAllowed: false,
      payload: {
        ...report,
        replayDate: "2026-10-24",
        dataAsOf: "2026-10-24T06:00:00+08:00",
      },
    });

    await writeReplayReport(plan, { writeFile });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("canonical write requires explicit authorization", async () => {
    const writeFile = vi.fn();
    const plan = buildReplayReportPlan({
      replayDate: "2026-10-24",
      dataAsOf: "2026-10-24T06:00:00+08:00",
      report,
    });

    await expect(
      writeReplayReport(plan, {
        writeFile,
        outputDir: "/tmp/reports",
        allowCanonicalWrite: false,
      }),
    ).rejects.toThrow(
      "Canonical replay report write requires explicit authorization",
    );
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("file-backed verification fails closed for the existing report without portfolio provenance", async () => {
    const result = await verifyReplayReportFile({
      reportPath: "data/reports/2026-10-24.json",
      replayDate: "2026-10-24",
      dataAsOf: "2026-10-24T06:00:00+08:00",
    });

    expect(result).toMatchObject({
      status: "UNAVAILABLE",
      reason: "MISSING_PROVENANCE",
      replayDate: "2026-10-24",
      dataAsOf: "2026-10-24T06:00:00+08:00",
      writePerformed: false,
    });
    expect(result.reportPath).toBe("data/reports/2026-10-24.json");
  });

  it("builds a traceable envelope without inventing legacy replay metadata", async () => {
    const result = await verifyReplayReportFile({
      reportPath: "data/reports/2026-10-24.json",
      replayDate: "2026-10-24",
      dataAsOf: "2026-10-24T06:00:00+08:00",
    });

    const envelope = buildReplayEvidenceEnvelope(result);

    expect(envelope).toMatchObject({
      schemaVersion: "1.0",
      fixtureSource: "production",
      replayDate: "2026-10-24",
      dataAsOf: "2026-10-24T06:00:00+08:00",
      dataProvenance: null,
      strategyHash: null,
      reportHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      status: "UNAVAILABLE",
      reason: "MISSING_PROVENANCE",
    });
  });

  it("preserves synthetic replay provenance without labeling it production", async () => {
    const fixture = JSON.parse(
      await readFile("data/replay-fixtures/core-logic-v1.json", "utf8"),
    );
    const report = fixture.reports[0];

    const envelope = buildReplayEvidenceEnvelopeFromReplay({
      report,
      fixtureSource: fixture.fixtureSource,
      reportHash:
        "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });

    expect(envelope).toMatchObject({
      schemaVersion: "1.0",
      fixtureSource: "synthetic",
      replayDate: "2026-08-14",
      dataAsOf: report.replay.dataAsOf,
      dataProvenance: report.replay.dataProvenance,
      strategyHash: report.replay.strategy.hash,
      reportHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      status: "available",
    });
  });

  it("persists evidence by replayDate in a separate idempotent directory", async () => {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), "replay-evidence-"));
    const envelope = {
      schemaVersion: "1.0",
      fixtureSource: "production",
      replayDate: "2026-10-24",
      dataAsOf: "2026-10-24T06:00:00+08:00",
      reportHash:
        "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      status: "UNAVAILABLE",
      reason: "MISSING_PROVENANCE",
    };

    await expect(
      persistReplayEvidence(envelope, { outputDir }),
    ).rejects.toThrow(
      "Replay evidence persistence requires explicit authorization",
    );

    const first = await persistReplayEvidence(envelope, {
      outputDir,
      allowEvidenceWrite: true,
    });
    const second = await persistReplayEvidence(
      { ...envelope, reason: "UPDATED_REASON" },
      { outputDir, allowEvidenceWrite: true },
    );

    expect(first.path).toBe(path.join(outputDir, "2026-10-24.json"));
    expect(second.path).toBe(first.path);
    expect(JSON.parse(await readFile(first.path, "utf8")).reason).toBe(
      "UPDATED_REASON",
    );
  });
});
