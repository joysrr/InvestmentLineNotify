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

  describe("Debt-Aware Crisis Accumulation (OPPORTUNITY vs DEFENSE)", () => {
    it("totalDebt === 0 + 純恐慌型雷達 (extremePanicRadar) → CRISIS_ACCUMULATE, batchLimit 10% 現金", () => {
      const result = evaluateCashExposure({
        cash: 200000,
        grossExposure: 500000,
        accountNetAsset: 1000000,
        kellyConservative: 1.0,
        radarTriggered: ["extremePanicRadar"],
        totalDebt: 0,
      });
      expect(result.status).toBe("CRISIS_ACCUMULATE");
      expect(result.suggestedDcaAmt).toBe(20000); // 200,000 * 10%
      expect(result.message).toContain("恐慌加碼模式");
      expect(result.message).toContain("20,000");
      expect(result.batchRationale).toBeDefined();
      expect(result.disclaimer).toContain("複利損耗");
    });

    it("totalDebt === 0 + 現金充足 (600,000) → 受 MAX_BATCH (50,000) 截斷", () => {
      const result = evaluateCashExposure({
        cash: 600000,
        grossExposure: 500000,
        accountNetAsset: 1000000,
        kellyConservative: 1.0,
        radarTriggered: ["extremePanicRadar"],
        totalDebt: 0,
      });
      expect(result.status).toBe("CRISIS_ACCUMULATE");
      expect(result.suggestedDcaAmt).toBe(50000); // min(60,000, 50,000)
      expect(result.message).toContain("50,000");
    });

    it("totalDebt 為字串 '0' 時型別防護正確生效 → CRISIS_ACCUMULATE", () => {
      const result = evaluateCashExposure({
        cash: 300000,
        grossExposure: 500000,
        accountNetAsset: 1000000,
        kellyConservative: 1.0,
        radarTriggered: ["vixSpike"],
        totalDebt: "0",
      });
      expect(result.status).toBe("CRISIS_ACCUMULATE");
      expect(result.suggestedDcaAmt).toBe(30000);
    });

    it("totalDebt === 0 + 基本面雷達 → DEFER (suggestedDcaAmt 0)", () => {
      const result = evaluateCashExposure({
        cash: 500000,
        grossExposure: 500000,
        accountNetAsset: 1000000,
        kellyConservative: 1.0,
        radarTriggered: ["macroRecessionRadar"],
        totalDebt: 0,
      });
      expect(result.status).toBe("DEFER");
      expect(result.suggestedDcaAmt).toBe(0);
      expect(result.message).toContain("基本面雷達觸發");
    });

    it("totalDebt === 0 + 同時觸發恐慌與基本面雷達 → DEFER (基本面優先安全原則)", () => {
      const result = evaluateCashExposure({
        cash: 500000,
        grossExposure: 500000,
        accountNetAsset: 1000000,
        kellyConservative: 1.0,
        radarTriggered: ["extremePanicRadar", "macroRecessionRadar"],
        totalDebt: 0,
      });
      expect(result.status).toBe("DEFER");
      expect(result.suggestedDcaAmt).toBe(0);
      expect(result.message).toContain("基本面雷達觸發");
    });

    it("totalDebt > 0 (有借款) + 恐慌雷達 → DEFER (維持防斷頭邏輯)", () => {
      const result = evaluateCashExposure({
        cash: 500000,
        grossExposure: 500000,
        accountNetAsset: 1000000,
        kellyConservative: 1.0,
        radarTriggered: ["extremePanicRadar"],
        totalDebt: 100000,
      });
      expect(result.status).toBe("DEFER");
      expect(result.suggestedDcaAmt).toBe(0);
    });
  });
});
