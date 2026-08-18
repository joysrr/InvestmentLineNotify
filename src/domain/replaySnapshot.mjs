import { createHash } from "node:crypto";

export function canonicalizeJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalizeJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function normalizeReplayCompatibility(report = {}) {
  if (report.replay) return report;
  return {
    ...report,
    replay: {
      status: "unavailable",
      schemaVersion: null,
      reason: "legacy_report_without_replay_inputs",
    },
  };
}

export function buildReplaySnapshot(input = {}) {
  const strategy = input.strategy || {};
  const strategyPayload = {
    version: strategy.version ?? null,
    snapshot: strategy.snapshot ?? {},
  };

  return {
    schemaVersion: "1.0",
    signalData: input.signalData ?? {},
    institutionalHistory: input.institutionalHistory ?? [],
    dataAsOf: input.dataAsOf ?? {},
    strategy: {
      ...strategyPayload,
      hash: `sha256:${sha256(canonicalizeJson(strategyPayload))}`,
    },
    rawDecision: input.rawDecision ?? null,
    finalDecision: input.finalDecision ?? null,
    scoringMatrixExecuted: input.scoringMatrixExecuted === true,
  };
}
