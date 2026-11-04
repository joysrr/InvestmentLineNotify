import { describe, it, expect } from "vitest";
import { evaluateCashExposure } from "../../../modules/strategy/cashExposureAdvisor.mjs";

describe("CashExposureAdvisor: cash-driven exposure analysis", () => {
  it("exposureGap <= 0 → OVER_EXPOSED, suggestedDcaAmt 0", () => {
    const result = evaluateCashExposure({
      cash: 500000,
      grossExposure: 1000000,
      accountNetAsset: 800000,
      portfolio: { targetLeverage: 1.0 },
      strategy: { allocation: [{ minScore: -99, leverage: 0.15 }] },
      lifecycleContext: { profile: { maxLeverageForNewZ2: 1.5 } },
      marketScore: 4,
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
      portfolio: { targetLeverage: 1.0 },
      strategy: { allocation: [{ minScore: -99, leverage: 0.15 }] },
      lifecycleContext: { profile: { maxLeverageForNewZ2: 1.5 } },
      marketScore: 4,
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
      portfolio: { targetLeverage: 1.0 },
      strategy: { allocation: [{ minScore: -99, leverage: 0.15 }] },
      lifecycleContext: { profile: { maxLeverageForNewZ2: 1.5 } },
      marketScore: 4,
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
      portfolio: { targetLeverage: 1.0 },
      strategy: { allocation: [{ minScore: -99, leverage: 0.15 }] },
      lifecycleContext: { profile: { maxLeverageForNewZ2: 1.5 } },
      marketScore: 4,
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
      portfolio: { targetLeverage: 1.0 },
      strategy: { allocation: [{ minScore: -99, leverage: 0.15 }] },
      lifecycleContext: { profile: { maxLeverageForNewZ2: 1.5 } },
      marketScore: 4,
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
      portfolio: { targetLeverage: 1.0 },
      strategy: { allocation: [{ minScore: -99, leverage: 0.15 }] },
      lifecycleContext: { profile: { maxLeverageForNewZ2: 1.5 } },
      marketScore: 4,
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
      portfolio: { targetLeverage: 1.0 },
      strategy: { allocation: [{ minScore: -99, leverage: 0.15 }] },
      lifecycleContext: { profile: { maxLeverageForNewZ2: 1.5 } },
      marketScore: 4,
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
        portfolio: { targetLeverage: 1.0 },
        strategy: { allocation: [{ minScore: -99, leverage: 0.15 }] },
        lifecycleContext: { profile: { maxLeverageForNewZ2: 1.5 } },
        marketScore: 4,
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

    it("totalDebt === 0 + 現金充足 (600,000) → 動態批次計算", () => {
      const result = evaluateCashExposure({
        cash: 600000,
        grossExposure: 500000,
        accountNetAsset: 1000000,
        portfolio: { targetLeverage: 1.0 },
        strategy: { allocation: [{ minScore: -99, leverage: 0.15 }] },
        lifecycleContext: { profile: { maxLeverageForNewZ2: 1.5 } },
        marketScore: 4,
        radarTriggered: ["extremePanicRadar"],
        totalDebt: 0,
      });
      expect(result.status).toBe("CRISIS_ACCUMULATE");
      // 曝險缺口 = 1,000,000 - 500,000 = 500,000
      // 資本缺口 = 500,000 / 2 = 250,000
      // 均攤批次 = 250,000 / 10 = 25,000
      // 現金 10% = 600,000 × 0.1 = 60,000
      // batchLimit = min(25,000, 60,000, 250,000) = 25,000
      expect(result.suggestedDcaAmt).toBe(25000);
      expect(result.batchLimit).toBe(25000);
    });

    it("totalDebt 為字串 '0' 時型別防護正確生效 → CRISIS_ACCUMULATE", () => {
      const result = evaluateCashExposure({
        cash: 300000,
        grossExposure: 500000,
        accountNetAsset: 1000000,
        portfolio: { targetLeverage: 1.0 },
        strategy: { allocation: [{ minScore: -99, leverage: 0.15 }] },
        lifecycleContext: { profile: { maxLeverageForNewZ2: 1.5 } },
        marketScore: 4,
        radarTriggered: ["vixSpike"],
        totalDebt: "0",
      });
      expect(result.status).toBe("CRISIS_ACCUMULATE");
      // 曝險缺口 = 500,000
      // 資本缺口 = 250,000
      // 均攤批次 = 25,000
      // 現金 10% = 30,000
      // batchLimit = min(25,000, 30,000, 250,000) = 25,000
      expect(result.suggestedDcaAmt).toBe(25000);
    });

    it("totalDebt === 0 + 基本面雷達 → DEFER (suggestedDcaAmt 0)", () => {
      const result = evaluateCashExposure({
        cash: 500000,
        grossExposure: 500000,
        accountNetAsset: 1000000,
        portfolio: { targetLeverage: 1.0 },
        strategy: { allocation: [{ minScore: -99, leverage: 0.15 }] },
        lifecycleContext: { profile: { maxLeverageForNewZ2: 1.5 } },
        marketScore: 4,
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
        portfolio: { targetLeverage: 1.0 },
        strategy: { allocation: [{ minScore: -99, leverage: 0.15 }] },
        lifecycleContext: { profile: { maxLeverageForNewZ2: 1.5 } },
        marketScore: 4,
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
        portfolio: { targetLeverage: 1.0 },
        strategy: { allocation: [{ minScore: -99, leverage: 0.15 }] },
        lifecycleContext: { profile: { maxLeverageForNewZ2: 1.5 } },
        marketScore: 4,
        radarTriggered: ["extremePanicRadar"],
        totalDebt: 100000,
      });
      expect(result.status).toBe("DEFER");
      expect(result.suggestedDcaAmt).toBe(0);
    });
  });

  // ============================================================
  // Phase 7: 階層式取得目標槓桿與全動態自適應加碼
  // ============================================================
  describe("Phase 7 — resolveTargetLeverage() 階層式取得", () => {
    it("優先級 1：用戶主動指定 portfolio.targetLeverage", () => {
      const result = evaluateCashExposure({
        cash: 500000,
        totalDebt: 0,
        radarTriggered: ["extremePanicRadar"],
        accountNetAsset: 2500000,
        grossExposure: 1950000, // 當前 0.78x
        portfolio: { targetLeverage: 1.25 }, // 用戶指定 1.25x
        strategy: {
          buy: { panic: { suggestedLeverage: 0.3 } }, // 1.3x 恐慌檔位
          allocation: [{ minScore: -99, leverage: 0.15 }], // 1.15x 評分階梯
        },
        lifecycleContext: { profile: { maxLeverageForNewZ2: 1.5 } },
        marketScore: 4,
      });
      expect(result.status).toBe("CRISIS_ACCUMULATE");
      // 目標曝險 = 2,500,000 × 1.25 = 3,125,000
      expect(result.targetExposure).toBe(3125000);
    });

    it("優先級 2：策略恐慌檔位（用戶未指定時）", () => {
      const result = evaluateCashExposure({
        cash: 500000,
        totalDebt: 0,
        radarTriggered: ["extremePanicRadar"],
        accountNetAsset: 2500000,
        grossExposure: 1950000,
        portfolio: {}, // 無用戶指定
        strategy: {
          buy: { panic: { suggestedLeverage: 0.3 } }, // 1.3x 恐慌檔位
          allocation: [{ minScore: -99, leverage: 0.15 }],
        },
        lifecycleContext: { profile: { maxLeverageForNewZ2: 1.5 } },
        marketScore: 4,
      });
      expect(result.status).toBe("CRISIS_ACCUMULATE");
      // 目標曝險 = 2,500,000 × 1.3 = 3,250,000
      expect(result.targetExposure).toBe(3250000);
    });

    it("優先級 3：評分階梯（無用戶指定、無恐慌檔位）", () => {
      const result = evaluateCashExposure({
        cash: 500000,
        totalDebt: 0,
        radarTriggered: ["extremePanicRadar"],
        accountNetAsset: 2500000,
        grossExposure: 1950000,
        portfolio: {},
        strategy: {
          allocation: [
            { minScore: -99, leverage: 0.15 },
            { minScore: 6, leverage: 0.4 }, // score 6 → 1.4x
          ],
        },
        lifecycleContext: { profile: { maxLeverageForNewZ2: 1.5 } },
        marketScore: 6,
      });
      expect(result.status).toBe("CRISIS_ACCUMULATE");
      // 目標曝險 = 2,500,000 × 1.4 = 3,500,000
      expect(result.targetExposure).toBe(3500000);
    });

    it("優先級 4：生命週期天花板（用戶指定超過上限時自動降低）", () => {
      const result = evaluateCashExposure({
        cash: 500000,
        totalDebt: 0,
        radarTriggered: ["extremePanicRadar"],
        accountNetAsset: 2500000,
        grossExposure: 1950000,
        portfolio: { targetLeverage: 2.0 }, // 用戶指定 2.0x
        strategy: {
          buy: { panic: { suggestedLeverage: 0.3 } },
          allocation: [{ minScore: -99, leverage: 0.15 }],
        },
        lifecycleContext: { profile: { maxLeverageForNewZ2: 1.5 } }, // 天花板 1.5x
        marketScore: 4,
      });
      expect(result.status).toBe("CRISIS_ACCUMULATE");
      // 目標曝險 = 2,500,000 × 1.5（天花板攔截）= 3,750,000
      expect(result.targetExposure).toBe(3750000);
    });
  });

  describe("Phase 7 — 動態批次計算（移除 MAX_BATCH 硬編碼）", () => {
    it("小資產帳戶：缺口 10 萬，批次上限 = min(1萬/批, 現金 10%, 總缺口)", () => {
      const result = evaluateCashExposure({
        cash: 150000,
        totalDebt: 0,
        radarTriggered: ["extremePanicRadar"],
        accountNetAsset: 500000,
        grossExposure: 300000, // 0.6x
        portfolio: { targetLeverage: 1.2 }, // 目標 1.2x → 600,000
        strategy: { allocation: [{ minScore: -99, leverage: 0.15 }] },
        lifecycleContext: { profile: { maxLeverageForNewZ2: 1.5 } },
        marketScore: 4,
      });
      expect(result.status).toBe("CRISIS_ACCUMULATE");
      // 曝險缺口 = 600,000 - 300,000 = 300,000
      // 資本缺口 = 300,000 / 2 = 150,000
      // 均攤批次 = 150,000 / 10 = 15,000
      // 現金 10% = 150,000 × 0.1 = 15,000
      // batchLimit = min(15,000, 15,000, 150,000) = 15,000
      expect(result.batchLimit).toBe(15000);
    });

    it("大資產帳戶：缺口 100 萬，批次上限受現金 10% 限制", () => {
      const result = evaluateCashExposure({
        cash: 800000,
        totalDebt: 0,
        radarTriggered: ["extremePanicRadar"],
        accountNetAsset: 5000000,
        grossExposure: 3900000, // 0.78x
        portfolio: { targetLeverage: 1.2 }, // 目標 1.2x → 6,000,000
        strategy: { allocation: [{ minScore: -99, leverage: 0.15 }] },
        lifecycleContext: { profile: { maxLeverageForNewZ2: 1.5 } },
        marketScore: 4,
      });
      expect(result.status).toBe("CRISIS_ACCUMULATE");
      // 曝險缺口 = 6,000,000 - 3,900,000 = 2,100,000
      // 資本缺口 = 2,100,000 / 2 = 1,050,000
      // 均攤批次 = 1,050,000 / 10 = 105,000
      // 現金 10% = 800,000 × 0.1 = 80,000（限制因子）
      // batchLimit = min(105,000, 80,000, 1,050,000) = 80,000
      expect(result.batchLimit).toBe(80000);
    });

    it("極小缺口：當前已接近目標，批次上限自動縮小", () => {
      const result = evaluateCashExposure({
        cash: 500000,
        totalDebt: 0,
        radarTriggered: ["extremePanicRadar"],
        accountNetAsset: 2500000,
        grossExposure: 2990000, // 1.196x，已非常接近 1.2x
        portfolio: { targetLeverage: 1.2 },
        strategy: { allocation: [{ minScore: -99, leverage: 0.15 }] },
        lifecycleContext: { profile: { maxLeverageForNewZ2: 1.5 } },
        marketScore: 4,
      });
      expect(result.status).toBe("CRISIS_ACCUMULATE");
      // 曝險缺口 = 3,000,000 - 2,990,000 = 10,000
      // 資本缺口 = 10,000 / 2 = 5,000
      // 均攤批次 = 5,000 / 10 = 500
      // 現金 10% = 500,000 × 0.1 = 50,000
      // batchLimit = min(500, 50,000, 5,000) = 500（百元取整）
      expect(result.batchLimit).toBe(500);
    });
  });
});
