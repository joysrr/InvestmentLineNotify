import { describe, expect, it } from "vitest";
import { loadReplayFixture, replayFixture } from "./replayRunner.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const REPORTS_DIR = path.join(PROJECT_ROOT, "data/reports");

describe("replayRunner fixture loader", () => {
  it("依日期排序並驗證 fixture 的 replay inputs", async () => {
    const fixture = await loadReplayFixture(
      "data/replay-fixtures/core-logic-v1.json",
    );

    expect(fixture.fixtureSource).toBe("synthetic");
    expect(fixture.reports.map((report) => report.date)).toEqual([
      "2026-08-14",
      "2026-08-17",
      "2026-08-18",
    ]);
    expect(
      fixture.reports.every((report) => report.replay.status === "available"),
    ).toBe(true);
  });

  it("支援載入 production 報告目錄或報告物件", async () => {
    const fixture = await loadReplayFixture(REPORTS_DIR);

    expect(fixture.fixtureSource).toBe("production");
    expect(fixture.reports.length).toBeGreaterThanOrEqual(1);
    expect(
      fixture.reports.every((report) => report.replay.status === "available"),
    ).toBe(true);
  });

  it("拒絕不支援的 fixture schema", async () => {
    await expect(
      loadReplayFixture({
        schemaVersion: "9.9",
        fixtureSource: "synthetic",
        reports: [],
      }),
    ).rejects.toThrow("Unsupported replay fixture");
  });

  it("使用 evaluator 逐日重播並回傳 expected decision", async () => {
    const result = await replayFixture(
      "data/replay-fixtures/core-logic-v1.json",
      async (report) => ({ signal: report.replay.finalDecision.signal }),
    );

    expect(result).toHaveLength(3);
    expect(result.map((item) => item.date)).toEqual([
      "2026-08-14",
      "2026-08-17",
      "2026-08-18",
    ]);
    expect(result.every((item) => item.matches === true)).toBe(true);
    expect(result[0]).toMatchObject({
      fixtureSource: "synthetic",
      dataAsOf: { market: { latestDate: "2026-08-14" } },
      strategyHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      dataProvenance: [
        { provider: "synthetic", dataset: "market", integrity: "unverified" },
      ],
    });
  });

  it("產生 deterministic replay result hash", async () => {
    const evaluator = async (report) => report.replay.finalDecision;
    const first = await replayFixture(
      "data/replay-fixtures/core-logic-v1.json",
      evaluator,
    );
    const second = await replayFixture(
      "data/replay-fixtures/core-logic-v1.json",
      evaluator,
    );

    expect(first.resultHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(second.resultHash).toBe(first.resultHash);
  });
});
