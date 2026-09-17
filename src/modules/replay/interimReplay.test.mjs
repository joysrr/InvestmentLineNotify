import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runInterimReplay } from "./interimReplay.mjs";

const SYNTHETIC_FIXTURE = "data/replay-fixtures/core-logic-v1.json";

describe("runInterimReplay", () => {
  it("針對 production-style 報告目錄執行中途 replay 並計算 matches", async () => {
    const fixture = JSON.parse(
      await readFile(path.resolve(process.cwd(), SYNTHETIC_FIXTURE), "utf8"),
    );
    const reportsDir = await mkdtemp(path.join(os.tmpdir(), "interim-replay-"));

    try {
      await Promise.all(
        fixture.reports.map((report) =>
          writeFile(
            path.join(reportsDir, `${report.date}.json`),
            JSON.stringify(report),
          ),
        ),
      );
      const results = await runInterimReplay(reportsDir);

      expect(results.length).toBe(fixture.reports.length);
      expect(results.resultHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(results.every((r) => typeof r.matches === "boolean")).toBe(true);
    } finally {
      await rm(reportsDir, { recursive: true, force: true });
    }
  });
});
