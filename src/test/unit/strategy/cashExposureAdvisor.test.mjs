import { describe, it, expect } from "vitest";
import { evaluateCashExposure } from "../../../modules/strategy/cashExposureAdvisor.mjs";

describe("CashExposureAdvisor: cash-driven exposure analysis", () => {
  it("exposureGap <= 0 → OVER_EXPOSED, suggestedDcaAmt 0", () => {
    const result = evaluateCashExposure({
      cash: 500000,
      grossExposure: 1000000,
      accountNetAsset: 800000,
      kellyConservative: 1.0,
      radarTriggered: [],
    });
    expect(result.status).toBe("OVER_EXPOSED");
    expect(result.suggestedDcaAmt).toBe(0);
    expect(result.exposureGap).toBeLessThanOrEqual(0);
  });

  it("cash <= 0 → INSUFFICIENT_CASH, suggestedDcaAmt 0", () => {
    const result = evaluateCashExposure({
      cash: 0,
      grossExposure: 500000,
      accountNetAsset: 800000,
      kellyConservative: 1.0,
      radarTriggered: [],
    });
    expect(result.status).toBe("INSUFFICIENT_CASH");
    expect(result.suggestedDcaAmt).toBe(0);
  });

  it("cash 足夠且雷達清晰 → RECOMMEND_DCA, suggestedDcaAmt = min(cash×50%, gap)", () => {
    const result = evaluateCashExposure({
      cash: 200000,
      grossExposure: 500000,
      accountNetAsset: 1000000,
      kellyConservative: 1.0,
      radarTriggered: [],
    });
    expect(result.status).toBe("RECOMMEND_DCA");
    expect(result.targetExposure).toBe(1000000);
    expect(result.exposureGap).toBe(500000);
    expect(result.cashAdequacy).toBe(false); // 現金不足填補整個缺口
    expect(result.suggestedDcaAmt).toBe(100000); // min(200000×0.5=100000, gap 500000)
  });

  it("現金完全充足 (cash ≥ gap) → cashAdequacy true, suggestedDcaAmt = min(cash×50%, gap)", () => {
    const result = evaluateCashExposure({
      cash: 600000,
      grossExposure: 500000,
      accountNetAsset: 1000000,
      kellyConservative: 1.0,
      radarTriggered: [],
    });
    expect(result.status).toBe("RECOMMEND_DCA");
    expect(result.cashAdequacy).toBe(true);
    expect(result.suggestedDcaAmt).toBe(300000); // min(600000×0.5=300000, gap 500000)
  });

  it("cash 部分充裕 (cash×50% < gap) → suggestedDcaAmt = cash×50%", () => {
    const result = evaluateCashExposure({
      cash: 100000,
      grossExposure: 500000,
      accountNetAsset: 1000000,
      kellyConservative: 1.0,
      radarTriggered: [],
    });
    expect(result.status).toBe("RECOMMEND_DCA");
    expect(result.suggestedDcaAmt).toBe(50000);
  });

  it("radarTriggered 不為空 → DEFER, suggestedDcaAmt 0", () => {
    const result = evaluateCashExposure({
      cash: 500000,
      grossExposure: 500000,
      accountNetAsset: 1000000,
      kellyConservative: 1.0,
      radarTriggered: ["EXTREME_PANIC"],
    });
    expect(result.status).toBe("DEFER");
    expect(result.suggestedDcaAmt).toBe(0);
    expect(result.message).toContain("EXTREME_PANIC");
  });

  it("accountNetAsset 未提供 → UNAVAILABLE, suggestedDcaAmt 0", () => {
    const result = evaluateCashExposure({
      cash: 500000,
      grossExposure: 500000,
      accountNetAsset: undefined,
      kellyConservative: 1.0,
      radarTriggered: [],
    });
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.suggestedDcaAmt).toBe(0);
  });
});
