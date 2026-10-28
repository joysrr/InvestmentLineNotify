import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const FIXTURE_PATH = resolve(
  new URL(
    "../../data/replay-fixtures/stress-scenarios-v1.json",
    import.meta.url,
  ).pathname,
);
const MISSING_FIXTURE_PATH = resolve(
  new URL(
    "../../data/replay-fixtures/stress-scenarios-missing-v1.json",
    import.meta.url,
  ).pathname,
);

function assertValidDay(day) {
  if (
    !Number.isInteger(day.day) ||
    !Number.isFinite(day.dailyReturn) ||
    !Number.isFinite(day.snapshot?.totalAssets) ||
    !Number.isFinite(day.snapshot?.totalLiabilities) ||
    typeof day.expectedState?.freeze00675L !== "boolean" ||
    day.expectedState?.p0Exempt !== true
  ) {
    throw new Error("Invalid stress scenario day");
  }
}

export async function loadStressScenarioFixture() {
  const fixture = JSON.parse(await readFile(FIXTURE_PATH, "utf8"));
  if (
    fixture.schemaVersion !== "1.0" ||
    fixture.fixtureSource !== "synthetic" ||
    !Array.isArray(fixture.scenarios) ||
    fixture.scenarios.length !== 4
  ) {
    throw new Error("Invalid stress scenario fixture");
  }

  for (const scenario of fixture.scenarios) {
    if (
      typeof scenario.scenarioId !== "string" ||
      !Array.isArray(scenario.days)
    ) {
      throw new Error("Invalid stress scenario");
    }
    scenario.days.forEach(assertValidDay);
  }

  return fixture;
}

export async function loadMissingStressScenarioFixture() {
  const fixture = JSON.parse(await readFile(MISSING_FIXTURE_PATH, "utf8"));
  if (
    fixture.schemaVersion !== "1.0" ||
    fixture.fixtureSource !== "synthetic" ||
    fixture.scenarioId !== "MISSING_DATA_FAIL_CLOSED" ||
    !fixture.day
  ) {
    throw new Error("Invalid missing stress scenario fixture");
  }

  return fixture;
}
