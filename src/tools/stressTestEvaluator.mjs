import { evaluatePersonalMarginBreaker } from "../modules/strategy/marginStateMachine.mjs";

const REQUIRED_STATE_KEYS = ["freeze00675L", "pauseP1", "p0Exempt"];

export function evaluateStressDay({ day, snapshot, expectedState }) {
  if (
    !Number.isInteger(day) ||
    !snapshot ||
    !Number.isFinite(snapshot.totalAssets) ||
    !Number.isFinite(snapshot.totalLiabilities) ||
    !expectedState
  ) {
    return {
      status: "UNAVAILABLE",
      mode: "SHADOW_ONLY",
      day: Number.isInteger(day) ? day : null,
      reason: "MISSING_OR_INVALID_STRESS_INPUT",
      expectedState: expectedState ?? null,
      actualState: null,
      differences: [],
      tradeSignal: null,
    };
  }

  const breaker = evaluatePersonalMarginBreaker(snapshot);
  const actualState = Object.fromEntries(
    REQUIRED_STATE_KEYS.map((key) => [key, breaker.constraints[key]]),
  );
  const differences = REQUIRED_STATE_KEYS.filter(
    (key) => expectedState[key] !== actualState[key],
  ).map((key) => ({
    field: key,
    expected: expectedState[key],
    actual: actualState[key],
  }));

  return {
    status: "OK",
    mode: "SHADOW_ONLY",
    day,
    expectedState,
    actualState,
    differences,
    tradeSignal: null,
  };
}
