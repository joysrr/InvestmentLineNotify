const STRESS_SCENARIOS = Object.freeze([
  Object.freeze({
    id: "COVID_CIRCUIT_BREAKER",
    mode: "SHADOW_ONLY",
    dailyReturns: Object.freeze([
      -3.5, -4.0, -6.5, -5.0, 2.0, -4.5, 5.0, 4.0, -2.0, 3.0,
    ]),
    validationTarget:
      "Verify 00675L freeze below 160% and preserve P0 0050 DCA.",
  }),
  Object.freeze({
    id: "BEAR_CHOPPY",
    mode: "SHADOW_ONLY",
    dailyReturns: Object.freeze([
      -2.0, -1.5, -3.0, 1.0, -2.5, -2.0, -3.5, 0.5, -2.0, -1.5,
    ]),
    validationTarget:
      "Verify P0 0050 DCA is not incorrectly paused during a choppy bear regime.",
  }),
  Object.freeze({
    id: "FLASH_CRASH",
    mode: "SHADOW_ONLY",
    dailyReturns: Object.freeze([-1.0, -8.5, 3.5, -1.5]),
    validationTarget:
      "Verify 00675L freeze and extreme-panic observation after a one-day shock.",
  }),
  Object.freeze({
    id: "VALUATION_REVERSION",
    mode: "SHADOW_ONLY",
    dailyReturns: Object.freeze([-1.5, -2.0, -3.5, -2.0, -3.0]),
    validationTarget:
      "Verify valuation-reversion leverage observation does not replace the actual decision.",
  }),
]);

export function getStressScenarios() {
  return STRESS_SCENARIOS.map((scenario) => ({
    ...scenario,
    dailyReturns: [...scenario.dailyReturns],
  }));
}
