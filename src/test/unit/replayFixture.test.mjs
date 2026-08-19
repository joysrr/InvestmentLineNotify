import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { assessReplayAvailability } from "../../domain/replaySnapshot.mjs";

const fixturePath = path.resolve(
  process.cwd(),
  "data/replay-fixtures/core-logic-v1.json",
);

describe("versioned replay fixture", () => {
  it("contains ordered synthetic reports with available replay inputs", async () => {
    const fixture = JSON.parse(await readFile(fixturePath, "utf8"));

    expect(fixture.schemaVersion).toBe("1.0");
    expect(fixture.fixtureSource).toBe("synthetic");
    expect(fixture.reports.length).toBeGreaterThanOrEqual(3);

    const dates = fixture.reports.map((report) => report.date);
    expect(dates).toEqual([...dates].sort());

    for (const report of fixture.reports) {
      expect(assessReplayAvailability(report.replay)).toEqual({
        status: "available",
        missing: [],
      });
      expect(report.replay.schemaVersion).toBe("1.0");
      expect(report.replay.dataAsOf).toBeDefined();
      expect(report.replay.strategy.hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
  });
});
