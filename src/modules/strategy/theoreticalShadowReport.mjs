/**
 * Builds a read-only shadow report.
 * This module must not mutate strategy decisions or perform I/O.
 */

export function createTheoreticalShadowReport({
  timestamp,
  actualDecision,
  mappedInputs,
  theory,
}) {
  const report = {
    timestamp,
    actualDecision,
    theory,
    inputs: mappedInputs.inputs,
  };

  if (mappedInputs.status !== "OK") {
    report.dataStatus = mappedInputs.status;
    report.dataReason = mappedInputs.reason;
  }

  return report;
}
