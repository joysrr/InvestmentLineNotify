/**
 * Production artifact synchronization tests.
 * TDD red phase: these tests define the isolated data/logs snapshot contract.
 */

import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { syncProductionArtifacts } from "./productionArtifactSync.mjs";

const temporaryDirectories = [];

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "investnotify-artifacts-"));
  temporaryDirectories.push(root);

  const sourceDataDir = join(root, "production", "data");
  const sourceLogsDir = join(root, "production", "logs");
  const destinationRoot = join(root, "diagnostics");

  await mkdir(sourceDataDir, { recursive: true });
  await mkdir(sourceLogsDir, { recursive: true });
  await writeFile(join(sourceDataDir, "reports.json"), '{"ok":true}');
  await writeFile(join(sourceLogsDir, "api.log"), "request log");
  await writeFile(join(sourceDataDir, ".env"), "SECRET=should-not-copy");
  await writeFile(join(sourceDataDir, ".bot_lock"), "runtime-lock");

  return { sourceDataDir, sourceLogsDir, destinationRoot };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("syncProductionArtifacts", () => {
  it("同步 data 與 logs 到獨立快照，並產生 manifest", async () => {
    const fixture = await createFixture();

    const result = await syncProductionArtifacts(fixture);

    expect(result.status).toBe("completed");
    expect(result.snapshotDir).toContain("diagnostics");
    expect(
      await readFile(join(result.snapshotDir, "data", "reports.json"), "utf8"),
    ).toBe('{"ok":true}');
    expect(
      await readFile(join(result.snapshotDir, "logs", "api.log"), "utf8"),
    ).toBe("request log");
    await expect(
      readFile(join(result.snapshotDir, "data", ".env"), "utf8"),
    ).rejects.toThrow();
    await expect(
      readFile(join(result.snapshotDir, "data", ".bot_lock"), "utf8"),
    ).rejects.toThrow();

    const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));
    expect(manifest.operation).toBe("sync-production-artifacts");
    expect(manifest.sources).toEqual({
      data: fixture.sourceDataDir,
      logs: fixture.sourceLogsDir,
    });
    expect(manifest.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ relativePath: "data/reports.json" }),
        expect.objectContaining({ relativePath: "logs/api.log" }),
      ]),
    );
  });

  it("dry-run 不建立快照檔案，但回傳預計同步清單", async () => {
    const fixture = await createFixture();

    const result = await syncProductionArtifacts({ ...fixture, dryRun: true });

    expect(result.status).toBe("dry-run");
    expect(result.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ relativePath: "data/reports.json" }),
        expect.objectContaining({ relativePath: "logs/api.log" }),
      ]),
    );
    await expect(
      readFile(
        join(fixture.destinationRoot, "latest", "manifest.json"),
        "utf8",
      ),
    ).rejects.toThrow();
  });
});
