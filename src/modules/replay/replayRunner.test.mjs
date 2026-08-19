import { describe, expect, it } from "vitest";
import { loadReplayFixture, replayFixture } from "./replayRunner.mjs";

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
    expect(result.map((item) => item.matches)).toEqual([true, true, true]);
  });
});

// TDD: loader implementation follows the failing contract tests.
