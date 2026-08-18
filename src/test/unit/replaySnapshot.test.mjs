import { describe, expect, it } from "vitest";
import {
  buildReportReplaySnapshot,
  buildReplaySignalData,
  buildReplaySnapshot,
  canonicalizeJson,
  withFreshnessObservation,
  normalizeReplayCompatibility,
  sha256,
} from "../../domain/replaySnapshot.mjs";

describe("replaySnapshot", () => {
  it("canonicalizes object keys independent of insertion order", () => {
    expect(canonicalizeJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it("creates a deterministic SHA-256 hash", () => {
    expect(sha256("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("marks legacy reports as replay unavailable", () => {
    expect(normalizeReplayCompatibility({ date: "2026-08-17" })).toEqual({
      date: "2026-08-17",
      replay: {
        status: "unavailable",
        schemaVersion: null,
        reason: "legacy_report_without_replay_inputs",
      },
    });
  });

  it("preserves an existing replay snapshot", () => {
    const replay = { schemaVersion: "1.0", status: "available" };
    expect(normalizeReplayCompatibility({ replay }).replay).toBe(replay);
  });

  it("keeps only replay-relevant scoring fields", () => {
    const result = buildReplaySignalData({
      currentPR: 42,
      institutionalNet: 12.5,
      institutionalHistory: [{ date: "2026-08-11", value: 12.4 }],
      historyMetadata: { z2: { latestDate: "2026-08-03" } },
      categoryResults: { technical: 2 },
      closeArr: [1, 2, 3],
      news: "omit",
    });

    expect(result).toEqual({
      currentPR: 42,
      institutionalNet: 12.5,
      institutionalHistory: [{ date: "2026-08-11", value: 12.4 }],
      historyMetadata: { z2: { latestDate: "2026-08-03" } },
      categoryResults: { technical: 2 },
    });
  });

  it("builds a report replay snapshot from strategy output", () => {
    const result = buildReportReplaySnapshot({
      result: {
        replaySignalData: { currentPR: 42 },
        signals: { scoringMatrixExecuted: true, signalDirection: "buy" },
        institutionalHistory: [{ date: "2026-08-11", value: 12.4 }],
        historyMetadata: { z2: { latestDate: "2026-08-03" } },
      },
      strategySnapshot: { version: "2.8", threshold: 4 },
      reportDate: "2026-08-17",
    });

    expect(result.schemaVersion).toBe("1.0");
    expect(result.signalData).toEqual({ currentPR: 42 });
    expect(result.finalDecision.signalDirection).toBe("buy");
    expect(result.strategy.version).toBe("2.8");
  });

  it("stores a shadow freshness observation without changing the action", () => {
    const report = { signals: { signalDirection: "buy_tactical" } };
    const observation = {
      mode: "shadow",
      wouldBlock: true,
      blockedSignals: ["buy_tactical"],
    };

    expect(withFreshnessObservation(report, observation)).toEqual({
      ...report,
      replay: { shadowGuardDecision: observation },
    });
    expect(report.signals.signalDirection).toBe("buy_tactical");
  });

  it("builds the first replay snapshot", () => {
    const result = buildReplaySnapshot({
      signalData: { currentPR: 42, institutionalNet: 12.5 },
      institutionalHistory: [{ date: "2026-08-11", value: 12.4 }],
      dataAsOf: { z2History: { latestDate: "2026-08-03" } },
      strategy: { version: "2.8", snapshot: { threshold: 4 } },
      rawDecision: { signal: "buy_tactical", finalScore: 4.2 },
      finalDecision: { signal: "buy_tactical" },
      scoringMatrixExecuted: true,
    });

    expect(result.schemaVersion).toBe("1.0");
    expect(result.signalData.currentPR).toBe(42);
    expect(result.institutionalHistory).toEqual([
      { date: "2026-08-11", value: 12.4 },
    ]);
    expect(result.strategy.hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(result.rawDecision.signal).toBe("buy_tactical");
  });
});
