import { canonicalizeJson, sha256 } from "../../domain/replaySnapshot.mjs";
import { persistReplayEvidence } from "./replayReportBoundary.mjs";
import { replayFixture } from "./replayRunner.mjs";

export async function replayFixtureWithEvidence({
  fixturePath,
  evaluator,
  evidenceOutputDir,
  allowEvidenceWrite = false,
}) {
  if (!allowEvidenceWrite) {
    throw new Error("Evidence persistence requires explicit authorization");
  }

  const replayResults = await replayFixture(fixturePath, evaluator);

  const enrichedResults = [];

  for (const result of replayResults) {
    const replayResultHash = `sha256:${sha256(canonicalizeJson(result.replayDecision))}`;

    const envelope = {
      schemaVersion: "1.0",
      fixtureSource: result.fixtureSource,
      replayDate: result.date,
      dataAsOf: result.dataAsOf,
      dataProvenance: result.dataProvenance,
      strategyHash: result.strategyHash,
      status: result.status,
      replayResultHash,
      replayMatches: result.matches,
    };

    await persistReplayEvidence(envelope, {
      outputDir: evidenceOutputDir,
      allowEvidenceWrite: true,
    });

    enrichedResults.push({
      ...result,
      evidencePersisted: true,
    });
  }

  return enrichedResults;
}
