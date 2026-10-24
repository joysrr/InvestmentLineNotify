import { mapReportTheoreticalSnapshot } from "./reportTheoreticalSnapshotAdapter.mjs";

function buildAvailability(report) {
  if (report?.replay?.status === "available") {
    return { status: "AVAILABLE", reason: null };
  }

  return {
    status: "UNAVAILABLE",
    reason: report?.replay?.reason ?? "MISSING_PROVENANCE",
  };
}

/**
 * Builds the read-only report view consumed by API/UI layers.
 * This function only maps persisted data; it never fetches or writes data.
 */
export function buildReportReadOnlyView(
  report = {},
  { replayMetadata = {} } = {},
) {
  const theoreticalSnapshot = mapReportTheoreticalSnapshot(report);
  const replay = report.replay ?? {};

  return {
    date: report.date ?? null,
    dataAsOf: replay.dataAsOf ?? null,
    dataProvenance: replay.dataProvenance ?? [],
    strategyHash: replay.strategy?.hash ?? null,
    fixtureSource:
      report.replayMetadata?.fixtureSource ??
      replayMetadata.fixtureSource ??
      null,
    theoreticalSnapshot,
    availability: buildAvailability(report),
  };
}
