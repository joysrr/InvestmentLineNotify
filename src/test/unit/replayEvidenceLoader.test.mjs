import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, afterEach } from "vitest";
import { loadReplayEvidenceList } from "../../modules/replay/replayEvidenceLoader.mjs";

describe("replayEvidenceLoader", () => {
  const tempDirs = [];

  afterEach(async () => {
    for (const dir of tempDirs) {
      try {
        await rm(dir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
    tempDirs.length = 0;
  });

  it("returns empty array when directory does not exist", async () => {
    const nonExistentDir = path.join(os.tmpdir(), "non-existent-evidence");
    const result = await loadReplayEvidenceList({
      evidenceDir: nonExistentDir,
    });

    expect(result).toEqual([]);
  });

  it("loads and sorts evidence files by replayDate descending", async () => {
    const evidenceDir = await mkdtemp(
      path.join(os.tmpdir(), "replay-evidence-"),
    );
    tempDirs.push(evidenceDir);

    const dates = ["2026-08-14", "2026-08-18", "2026-08-17"];
    for (const date of dates) {
      await writeFile(
        path.join(evidenceDir, `${date}.json`),
        JSON.stringify({
          schemaVersion: "1.0",
          fixtureSource: "synthetic",
          replayDate: date,
          status: "available",
        }),
      );
    }

    const result = await loadReplayEvidenceList({ evidenceDir });

    expect(result).toHaveLength(3);
    expect(result.map((e) => e.replayDate)).toEqual([
      "2026-08-18",
      "2026-08-17",
      "2026-08-14",
    ]);
  });

  it("skips non-JSON files", async () => {
    const evidenceDir = await mkdtemp(
      path.join(os.tmpdir(), "replay-evidence-"),
    );
    tempDirs.push(evidenceDir);

    await writeFile(
      path.join(evidenceDir, "2026-08-14.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        replayDate: "2026-08-14",
        status: "available",
      }),
    );

    await writeFile(path.join(evidenceDir, "README.md"), "# Evidence");
    await writeFile(path.join(evidenceDir, "notes.txt"), "notes");

    const result = await loadReplayEvidenceList({ evidenceDir });

    expect(result).toHaveLength(1);
    expect(result[0].replayDate).toBe("2026-08-14");
  });

  it("skips unparseable JSON files", async () => {
    const evidenceDir = await mkdtemp(
      path.join(os.tmpdir(), "replay-evidence-"),
    );
    tempDirs.push(evidenceDir);

    await writeFile(
      path.join(evidenceDir, "valid.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        replayDate: "2026-08-14",
        status: "available",
      }),
    );

    await writeFile(path.join(evidenceDir, "invalid.json"), "{ invalid json");

    const result = await loadReplayEvidenceList({ evidenceDir });

    expect(result).toHaveLength(1);
    expect(result[0].replayDate).toBe("2026-08-14");
  });

  it("skips files missing required fields", async () => {
    const evidenceDir = await mkdtemp(
      path.join(os.tmpdir(), "replay-evidence-"),
    );
    tempDirs.push(evidenceDir);

    await writeFile(
      path.join(evidenceDir, "valid.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        replayDate: "2026-08-14",
        status: "available",
      }),
    );

    await writeFile(
      path.join(evidenceDir, "missing-schema.json"),
      JSON.stringify({
        replayDate: "2026-08-15",
        status: "available",
      }),
    );

    await writeFile(
      path.join(evidenceDir, "missing-date.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        status: "available",
      }),
    );

    const result = await loadReplayEvidenceList({ evidenceDir });

    expect(result).toHaveLength(1);
    expect(result[0].replayDate).toBe("2026-08-14");
  });

  it("uses environment variable REPLAY_EVIDENCE_DIR when option not provided", async () => {
    const evidenceDir = await mkdtemp(
      path.join(os.tmpdir(), "replay-evidence-"),
    );
    tempDirs.push(evidenceDir);

    await writeFile(
      path.join(evidenceDir, "2026-08-14.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        replayDate: "2026-08-14",
        status: "available",
      }),
    );

    const originalEnv = process.env.REPLAY_EVIDENCE_DIR;
    process.env.REPLAY_EVIDENCE_DIR = evidenceDir;

    const result = await loadReplayEvidenceList();

    expect(result).toHaveLength(1);
    expect(result[0].replayDate).toBe("2026-08-14");

    if (originalEnv) {
      process.env.REPLAY_EVIDENCE_DIR = originalEnv;
    } else {
      delete process.env.REPLAY_EVIDENCE_DIR;
    }
  });
});
