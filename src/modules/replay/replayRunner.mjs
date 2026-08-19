import { readFile } from "node:fs/promises";
import path from "node:path";
import { assessReplayAvailability } from "../../domain/replaySnapshot.mjs";

const SUPPORTED_SCHEMA = "1.0";

export async function loadReplayFixture(source) {
  const fixture =
    typeof source === "string"
      ? JSON.parse(await readFile(path.resolve(process.cwd(), source), "utf8"))
      : source;

  if (
    !fixture ||
    fixture.schemaVersion !== SUPPORTED_SCHEMA ||
    fixture.fixtureSource !== "synthetic" ||
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
  return Promise.all(
    fixture.reports.map(async (report) => {
      const replayDecision = await evaluator(report);
      const expectedDecision = report.replay.finalDecision;
      return {
        date: report.date,
        status: report.replay.status,
        expectedDecision,
        replayDecision,
        matches:
          JSON.stringify(replayDecision) === JSON.stringify(expectedDecision),
      };
    }),
  );
}

export { SUPPORTED_SCHEMA };

// ponytail: synthetic fixtures only; production report loader comes later.
