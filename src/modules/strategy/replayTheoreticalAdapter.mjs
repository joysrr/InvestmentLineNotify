/**
 * Adapts an explicit replay portfolio snapshot for shadow-mode theory.
 * Market signals are not a substitute for holdings or account data.
 */

import { mapTheoreticalInputs } from "./theoreticalInputMapper.mjs";
import { createTheoreticalShadowReport } from "./theoreticalShadowReport.mjs";

export function mapReplayTheoreticalInputs(report) {
  const snapshot = report?.replay?.portfolioSnapshot;
  if (!snapshot) {
    return {
      status: "UNAVAILABLE",
      reason: "MISSING_PORTFOLIO_SNAPSHOT",
      inputs: null,
    };
  }

  return mapTheoreticalInputs({
    snapshot,
    source: report.replay.portfolioSource,
    asOf: report.replay.portfolioAsOf,
  });
}

export function buildReplayTheoreticalShadowReport(report) {
  const mappedInputs = mapReplayTheoreticalInputs(report);
  return createTheoreticalShadowReport({
    timestamp: report.date,
    actualDecision: report.replay?.finalDecision ?? null,
    mappedInputs,
    theory: {
      status: "RESEARCH_ONLY",
      recommendedLeverage: null,
    },
  });
}
