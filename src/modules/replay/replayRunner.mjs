import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  assessReplayAvailability,
  canonicalizeJson,
  sha256,
} from "../../domain/replaySnapshot.mjs";

const SUPPORTED_SCHEMA = "1.0";

export async function loadReplayFixture(source) {
  let fixture;

  if (typeof source === "string") {
    let resolvedPath = path.resolve(process.cwd(), source);
    let stats;
    try {
      stats = await stat(resolvedPath);
    } catch {
      // 嘗試專案根目錄備用路徑
      resolvedPath = path.resolve(process.cwd(), "..", source);
      try {
        stats = await stat(resolvedPath);
      } catch {
        resolvedPath = path.resolve(
          "/workspace/projects/InvestmentLineNotify",
          source,
        );
        stats = await stat(resolvedPath);
      }
    }
    if (stats.isDirectory()) {
      const files = await readdir(resolvedPath);
      const reports = [];
      for (const file of files.sort()) {
        if (!file.endsWith(".json")) continue;
        const filePath = path.join(resolvedPath, file);
        try {
          const content = JSON.parse(await readFile(filePath, "utf8"));
          if (content && typeof content.replay === "object") {
            reports.push(content);
          }
        } catch {
          // Skip unparseable files
        }
      }
      fixture = {
        schemaVersion: SUPPORTED_SCHEMA,
        fixtureSource: "production",
        reports,
      };
    } else {
      fixture = JSON.parse(await readFile(resolvedPath, "utf8"));
    }
  } else {
    fixture = source;
  }

  if (
    !fixture ||
    fixture.schemaVersion !== SUPPORTED_SCHEMA ||
    !["synthetic", "production"].includes(fixture.fixtureSource) ||
    !Array.isArray(fixture.reports)
  ) {
    throw new Error(
      `Unsupported replay fixture: schema ${fixture?.schemaVersion}`,
    );
  }

  const reports = fixture.reports
    .map((report) => ({ ...report }))
    .sort((left, right) => left.date.localeCompare(right.date));

  for (const report of reports) {
    const availability = assessReplayAvailability(report.replay);
    if (availability.status !== "available") {
      throw new Error(
        `Replay inputs unavailable for ${report.date}: ${availability.missing.join(", ")}`,
      );
    }
  }

  return { ...fixture, reports };
}

export async function replayFixture(source, evaluator) {
  if (typeof evaluator !== "function") {
    throw new TypeError("replay evaluator must be a function");
  }

  const fixture = await loadReplayFixture(source);
  const results = await Promise.all(
    fixture.reports.map(async (report) => {
      const replayDecision = await evaluator(report);
      const expectedDecision = report.replay.finalDecision;
      const isSubsetMatch =
        typeof replayDecision === "object" &&
        replayDecision !== null &&
        typeof expectedDecision === "object" &&
        expectedDecision !== null &&
        Object.keys(replayDecision).every(
          (k) =>
            JSON.stringify(replayDecision[k]) ===
            JSON.stringify(expectedDecision[k]),
        );

      const matches =
        JSON.stringify(replayDecision) === JSON.stringify(expectedDecision) ||
        isSubsetMatch;

      return {
        date: report.date,
        fixtureSource: fixture.fixtureSource,
        dataAsOf: report.replay.dataAsOf,
        dataProvenance: report.replay.dataProvenance,
        strategyHash: report.replay.strategy.hash,
        status: report.replay.status,
        expectedDecision,
        replayDecision,
        matches,
      };
    }),
  );

  const resultHash = `sha256:${sha256(canonicalizeJson(results))}`;
  results.resultHash = resultHash;
  return results;
}

export { SUPPORTED_SCHEMA };

// ponytail: synthetic fixtures only; production report loader comes later.
