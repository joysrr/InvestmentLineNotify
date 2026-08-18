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

export function buildDataProvenance({
  provider = null,
  dataset = null,
  path = null,
  raw,
  normalized,
} = {}) {
  const provenance = { provider, dataset, path };
  if (raw === undefined || normalized === undefined) {
    return { ...provenance, integrity: "unverified" };
  }
  return {
    ...provenance,
    rawHash: `sha256:${sha256(canonicalizeJson(raw))}`,
    normalizedHash: `sha256:${sha256(canonicalizeJson(normalized))}`,
    integrity: "verified",
  };
}

export function buildSourceProvenance({ sources = {}, datasets = {} } = {}) {
  return Object.entries(datasets)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dataset, provider]) => {
      const meta = sources[provider] ?? {};
      return {
        provider,
        dataset,
        ...(meta.status !== undefined ? { status: meta.status } : {}),
        ...(meta.lastFetch !== undefined ? { lastFetch: meta.lastFetch } : {}),
        integrity: "unverified",
      };
    });
}

export function assessReplayAvailability(replay = {}) {
  const missing = [];
  if (!replay.signalData || Object.keys(replay.signalData).length === 0) {
    missing.push("signalData");
  }
  if (!replay.dataAsOf || Object.keys(replay.dataAsOf).length === 0) {
    missing.push("dataAsOf");
  }
  if (!replay.strategy?.hash) missing.push("strategy.hash");
  if (!replay.finalDecision) missing.push("finalDecision");
  return {
    status: missing.length === 0 ? "available" : "unavailable",
    missing,
  };
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

export function withFreshnessObservation(report, observation) {
  return {
    ...report,
    replay: {
      ...(report.replay ?? {}),
      shadowGuardDecision: observation,
    },
  };
}

export function buildReplaySnapshot(input = {}) {
  const strategy = input.strategy || {};
  const strategyPayload = {
    version: strategy.version ?? null,
    snapshot: strategy.snapshot ?? {},
  };

  const replay = {
    schemaVersion: "1.0",
    signalData: input.signalData ?? {},
    institutionalHistory: input.institutionalHistory ?? [],
    dataAsOf: input.dataAsOf ?? {},
    dataProvenance: input.dataProvenance ?? [],
    strategy: {
      ...strategyPayload,
      hash: `sha256:${sha256(canonicalizeJson(strategyPayload))}`,
    },
    rawDecision: input.rawDecision ?? null,
    finalDecision: input.finalDecision ?? null,
    scoringMatrixExecuted: input.scoringMatrixExecuted === true,
  };
  return { ...replay, status: assessReplayAvailability(replay).status };
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
    signalData: result.replaySignalData ?? result.signalData ?? {},
    institutionalHistory: result.institutionalHistory ?? [],
    dataAsOf: result.historyMetadata ?? {},
    dataProvenance:
      result.dataProvenance ?? buildSourceProvenance(result.sourceMetadata),
    strategy: {
      version: strategySnapshot.version ?? null,
      snapshot: strategySnapshot,
    },
    rawDecision: result.rawDecision ?? null,
    finalDecision: result.finalDecision ?? result.signals ?? null,
    scoringMatrixExecuted: result.signals?.scoringMatrixExecuted === true,
  });
}
