/**
 * Adapts an explicit replay portfolio snapshot for shadow-mode theory.
 * Market signals are not a substitute for holdings or account data.
 */

import {
  calculateCurrentLeverage,
  calculateGrossExposure,
} from "./theoreticalEngine.mjs";
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
  const grossExposure =
    mappedInputs.status === "OK"
      ? calculateGrossExposure({
          value0050: mappedInputs.inputs.value0050.value,
          value00675L: mappedInputs.inputs.value00675L.value,
          leverageMultiplier: 2,
        })
      : null;
  const currentLeverage =
    grossExposure?.status === "OK" && mappedInputs.inputs.accountNetAsset
      ? calculateCurrentLeverage({
          grossExposure: grossExposure.grossExposure,
          accountNetAsset: mappedInputs.inputs.accountNetAsset.value,
        })
      : null;

  return createTheoreticalShadowReport({
    timestamp: report.date,
    actualDecision: report.replay?.finalDecision ?? null,
    mappedInputs,
    theory: {
      status: "RESEARCH_ONLY",
      grossExposure: grossExposure?.grossExposure ?? null,
      currentLeverage: currentLeverage?.currentLeverage ?? null,
      accountNetAsset: mappedInputs.inputs?.accountNetAsset?.value ?? null,
      recommendedLeverage: null,
    },
  });
}
