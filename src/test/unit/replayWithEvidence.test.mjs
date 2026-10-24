import { mkdtemp, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("replay with evidence persistence", () => {
  it("executes synthetic fixture replay and persists evidence without canonical write", async () => {
    const { replayFixtureWithEvidence } =
      await import("../../modules/replay/replayWithEvidence.mjs");

    const outputDir = await mkdtemp(path.join(os.tmpdir(), "replay-evidence-"));

    const evaluator = async (report) => {
      return report.replay.finalDecision;
    };

    const results = await replayFixtureWithEvidence({
      fixturePath: "data/replay-fixtures/core-logic-v1.json",
      evaluator,
      evidenceOutputDir: outputDir,
      allowEvidenceWrite: true,
    });

    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({
      date: "2026-08-14",
      fixtureSource: "synthetic",
      matches: true,
      evidencePersisted: true,
    });

    const evidenceFiles = await readdir(outputDir);
    expect(evidenceFiles).toHaveLength(3);
    expect(evidenceFiles.sort()).toEqual([
      "2026-08-14.json",
      "2026-08-17.json",
      "2026-08-18.json",
    ]);

    const evidenceContent = JSON.parse(
      await readFile(path.join(outputDir, "2026-08-14.json"), "utf8"),
    );

    expect(evidenceContent).toMatchObject({
      schemaVersion: "1.0",
      fixtureSource: "synthetic",
      replayDate: "2026-08-14",
      status: "available",
    });
    expect(evidenceContent.dataAsOf).toMatchObject({
      market: { latestDate: "2026-08-14" },
    });
    expect(evidenceContent.dataProvenance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "synthetic",
          dataset: "market",
        }),
      ]),
    );
    expect(evidenceContent.strategyHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(evidenceContent.replayResultHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(evidenceContent.replayMatches).toBe(true);
  });

  it("refuses to write evidence without explicit authorization", async () => {
    const { replayFixtureWithEvidence } =
      await import("../../modules/replay/replayWithEvidence.mjs");

    const outputDir = await mkdtemp(path.join(os.tmpdir(), "replay-evidence-"));

    const evaluator = async (report) => {
      return report.replay.finalDecision;
    };

    await expect(
      replayFixtureWithEvidence({
        fixturePath: "data/replay-fixtures/core-logic-v1.json",
        evaluator,
        evidenceOutputDir: outputDir,
        allowEvidenceWrite: false,
      }),
    ).rejects.toThrow("Evidence persistence requires explicit authorization");
  });

  it("is idempotent by replayDate", async () => {
    const { replayFixtureWithEvidence } =
      await import("../../modules/replay/replayWithEvidence.mjs");

    const outputDir = await mkdtemp(path.join(os.tmpdir(), "replay-evidence-"));

    const evaluator = async (report) => {
      return report.replay.finalDecision;
    };

    const firstRun = await replayFixtureWithEvidence({
      fixturePath: "data/replay-fixtures/core-logic-v1.json",
      evaluator,
      evidenceOutputDir: outputDir,
      allowEvidenceWrite: true,
    });

    const secondRun = await replayFixtureWithEvidence({
      fixturePath: "data/replay-fixtures/core-logic-v1.json",
      evaluator,
      evidenceOutputDir: outputDir,
      allowEvidenceWrite: true,
    });

    expect(firstRun).toHaveLength(3);
    expect(secondRun).toHaveLength(3);

    const evidenceFiles = await readdir(outputDir);
    expect(evidenceFiles).toHaveLength(3);

    const firstEvidence = JSON.parse(
      await readFile(path.join(outputDir, "2026-08-14.json"), "utf8"),
    );
    expect(firstEvidence.replayDate).toBe("2026-08-14");
  });
});
