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

export function buildReplaySignalData(data = {}) {
  const fields = [
    "currentPR",
    "priceDropPercent",
    "sentiment",
    "bullMomentum",
    "RSI",
    "KD_K",
    "KD_D",
    "MACD",
    "ma60Slope",
    "institutionalNet",
    "institutionalHistory",
    "historyMetadata",
    "categoryResults",
    "finalScore",
    "scalingRatio",
  ];
  return Object.fromEntries(
    fields
      .filter((field) => data[field] !== undefined)
      .map((field) => [field, data[field]]),
  );
}

export function buildReportReplaySnapshot({
  result = {},
  strategySnapshot = {},
}) {
  return buildReplaySnapshot({
    signalData: result.signalData ?? result.signals ?? {},
    institutionalHistory: result.institutionalHistory ?? [],
    dataAsOf: result.historyMetadata ?? {},
    strategy: {
      version: strategySnapshot.version ?? null,
      snapshot: strategySnapshot,
    },
    rawDecision: result.rawDecision ?? null,
    finalDecision: result.finalDecision ?? result.signals ?? null,
    scoringMatrixExecuted: result.signals?.scoringMatrixExecuted === true,
  });
}
