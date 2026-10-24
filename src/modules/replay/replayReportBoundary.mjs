import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile as writeTextFile } from "node:fs/promises";
import path from "node:path";
import { mapReportTheoreticalSnapshot } from "../strategy/reportTheoreticalSnapshotAdapter.mjs";

function hashContent(content) {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function replayMetadata(report) {
  return {
    dataProvenance: report.replay?.dataProvenance ?? null,
    strategyHash: report.replay?.strategy?.hash ?? null,
  };
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function assertReplayDate(replayDate) {
  if (!DATE_PATTERN.test(replayDate)) {
    throw new TypeError("replayDate must use YYYY-MM-DD format");
  }
}

function assertDataAsOf(dataAsOf) {
  if (typeof dataAsOf !== "string" || Number.isNaN(Date.parse(dataAsOf))) {
    throw new TypeError("dataAsOf must be a valid ISO date-time");
  }
}

export function buildReplayReportPlan({ replayDate, dataAsOf, report }) {
  assertReplayDate(replayDate);
  assertDataAsOf(dataAsOf);

  if (!report || typeof report !== "object" || Array.isArray(report)) {
    throw new TypeError("report must be an object");
  }

  return {
    mode: "dry-run",
    replayDate,
    dataAsOf,
    canonicalFilename: `${replayDate}.json`,
    writeAllowed: false,
    payload: {
      ...report,
      replayDate,
      dataAsOf,
    },
  };
}

export async function verifyReplayReportFile({
  reportPath,
  replayDate,
  dataAsOf,
}) {
  assertReplayDate(replayDate);
  assertDataAsOf(dataAsOf);

  const content = await readFile(reportPath, "utf8");
  const report = JSON.parse(content);
  if (report.date !== replayDate) {
    throw new Error(
      `Replay report date mismatch: expected ${replayDate}, got ${report.date}`,
    );
  }

  const snapshot = mapReportTheoreticalSnapshot(report);
  return {
    status: snapshot.status,
    reason: snapshot.status === "UNAVAILABLE" ? snapshot.reason : undefined,
    replayDate,
    dataAsOf,
    reportPath,
    reportHash: hashContent(content),
    ...replayMetadata(report),
    snapshot: snapshot.snapshot,
    writePerformed: false,
  };
}

export function buildReplayEvidenceEnvelope(result) {
  if (!result || typeof result !== "object") {
    throw new TypeError("replay verification result must be an object");
  }

  return {
    schemaVersion: "1.0",
    fixtureSource: "production",
    replayDate: result.replayDate,
    dataAsOf: result.dataAsOf,
    dataProvenance: result.dataProvenance ?? null,
    strategyHash: result.strategyHash ?? null,
    reportHash: result.reportHash ?? null,
    status: result.status,
    ...(result.reason ? { reason: result.reason } : {}),
  };
}

export function buildReplayEvidenceEnvelopeFromReplay({
  report,
  fixtureSource,
  reportHash,
}) {
  if (!report || typeof report !== "object" || !report.replay) {
    throw new TypeError("replay report with replay metadata is required");
  }
  assertReplayDate(report.date);
  if (!["synthetic", "production"].includes(fixtureSource)) {
    throw new TypeError("fixtureSource must be synthetic or production");
  }

  return {
    schemaVersion: report.replay.schemaVersion ?? "1.0",
    fixtureSource,
    replayDate: report.date,
    dataAsOf: report.replay.dataAsOf ?? null,
    dataProvenance: report.replay.dataProvenance ?? null,
    strategyHash: report.replay.strategy?.hash ?? null,
    reportHash: reportHash ?? null,
    status: report.replay.status ?? "unavailable",
    ...(report.replay.reason ? { reason: report.replay.reason } : {}),
  };
}

export async function persistReplayEvidence(
  envelope,
  { outputDir, allowEvidenceWrite = false } = {},
) {
  if (!envelope || typeof envelope !== "object") {
    throw new TypeError("replay evidence envelope must be an object");
  }
  assertReplayDate(envelope.replayDate);
  if (!allowEvidenceWrite) {
    throw new Error(
      "Replay evidence persistence requires explicit authorization",
    );
  }
  if (typeof outputDir !== "string" || outputDir.length === 0) {
    throw new TypeError("outputDir must be provided for replay evidence");
  }

  await mkdir(outputDir, { recursive: true });
  const evidencePath = path.join(outputDir, `${envelope.replayDate}.json`);
  await writeTextFile(evidencePath, JSON.stringify(envelope, null, 2));
  return { written: true, path: evidencePath };
}

export async function writeReplayReport(
  plan,
  { outputDir, writeFile, allowCanonicalWrite = false } = {},
) {
  if (!plan || plan.mode !== "dry-run") {
    throw new TypeError("replay report plan must be a dry-run plan");
  }

  if (!allowCanonicalWrite) {
    if (outputDir) {
      throw new Error(
        "Canonical replay report write requires explicit authorization",
      );
    }
    return { written: false, reason: "DRY_RUN" };
  }

  if (typeof writeFile !== "function") {
    throw new TypeError("writeFile must be provided for canonical writes");
  }

  if (typeof outputDir !== "string" || outputDir.length === 0) {
    throw new TypeError("outputDir must be provided for canonical writes");
  }

  await writeFile(
    path.join(outputDir, plan.canonicalFilename),
    JSON.stringify(plan.payload, null, 2),
  );

  return {
    written: true,
    path: path.join(outputDir, plan.canonicalFilename),
  };
}
