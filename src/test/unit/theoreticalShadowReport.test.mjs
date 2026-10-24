import { describe, expect, it } from "vitest";
import { createTheoreticalShadowReport } from "../../modules/strategy/theoreticalShadowReport.mjs";

describe("theoreticalShadowReport.createTheoreticalShadowReport", () => {
  it("preserves actual decision and records theory status", () => {
    const mappedInputs = {
      status: "OK",
      inputs: {
        value0050: {
          value: 200000,
          source: "replay-fixture",
          asOf: "2026-10-23T06:00:00Z",
          unit: "TWD",
          status: "VERIFIED",
        },
        value00675L: {
          value: 40000,
          source: "replay-fixture",
          asOf: "2026-10-23T06:00:00Z",
          unit: "TWD",
          status: "VERIFIED",
        },
        totalDebt: {
          value: 200000,
          source: "replay-fixture",
          asOf: "2026-10-23T06:00:00Z",
          unit: "TWD",
          status: "VERIFIED",
        },
      },
    };

    expect(
      createTheoreticalShadowReport({
        timestamp: "2026-10-23T06:30:00Z",
        actualDecision: "ALLOW_DCA_0050",
        mappedInputs,
        theory: {
          status: "RESEARCH_ONLY",
          recommendedLeverage: null,
        },
      }),
    ).toEqual({
      timestamp: "2026-10-23T06:30:00Z",
      actualDecision: "ALLOW_DCA_0050",
      theory: {
        status: "RESEARCH_ONLY",
        recommendedLeverage: null,
      },
      inputs: mappedInputs.inputs,
    });
  });

  it("marks the report unavailable when mapped inputs are unavailable", () => {
    expect(
      createTheoreticalShadowReport({
        timestamp: "2026-10-23T06:30:00Z",
        actualDecision: "ALLOW_DCA_0050",
        mappedInputs: {
          status: "UNAVAILABLE",
          reason: "MISSING_PRICE",
          inputs: null,
        },
        theory: {
          status: "RESEARCH_ONLY",
          recommendedLeverage: null,
        },
      }),
    ).toEqual({
      timestamp: "2026-10-23T06:30:00Z",
      actualDecision: "ALLOW_DCA_0050",
      theory: {
        status: "RESEARCH_ONLY",
        recommendedLeverage: null,
      },
      inputs: null,
      dataStatus: "UNAVAILABLE",
      dataReason: "MISSING_PRICE",
    });
  });
});
