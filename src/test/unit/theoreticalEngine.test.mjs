import { describe, expect, it } from "vitest";
import {
  calculateCurrentLeverage,
  calculateEstimatedMaintenance,
  calculateGrossExposure,
  calculateCrashTolerance,
  calculateHumanCapital,
  calculateKellyLimits,
  calculateTrueExposure,
  calculateLaplaceCriterion,
  calculateTobinSeparation,
} from "../../modules/strategy/theoreticalEngine.mjs";

describe("theoreticalEngine.calculateGrossExposure", () => {
  it("calculates 0050 plus leveraged 00675L directional exposure", () => {
    expect(
      calculateGrossExposure({
        value0050: 100000,
        value00675L: 50000,
        leverageMultiplier: 2,
      }),
    ).toEqual({
      status: "OK",
      grossExposure: 200000,
    });
  });
});

describe("theoreticalEngine.calculateCurrentLeverage", () => {
  it("calculates current leverage", () => {
    expect(
      calculateCurrentLeverage({
        grossExposure: 600000,
        accountNetAsset: 300000,
      }),
    ).toEqual({
      status: "OK",
      currentLeverage: 2,
    });
  });

  it("returns UNAVAILABLE for non-positive net assets", () => {
    expect(
      calculateCurrentLeverage({
        grossExposure: 600000,
        accountNetAsset: 0,
      }),
    ).toEqual({
      status: "UNAVAILABLE",
      reason: "INVALID_ACCOUNT_NET_ASSET",
      currentLeverage: null,
    });
  });
});

describe("theoreticalEngine.calculateGrossExposure invalid inputs", () => {
  it("returns UNAVAILABLE for non-finite values", () => {
    expect(
      calculateGrossExposure({
        value0050: Number.NaN,
        value00675L: 100000,
        leverageMultiplier: 2,
      }),
    ).toEqual({
      status: "UNAVAILABLE",
      reason: "INVALID_EXPOSURE_INPUT",
      grossExposure: null,
    });
  });
});

describe("theoreticalEngine.calculateEstimatedMaintenance", () => {
  it("calculates estimated maintenance as collateral divided by debt", () => {
    expect(
      calculateEstimatedMaintenance({
        collateralValue: 180000,
        totalDebt: 100000,
      }),
    ).toEqual({
      status: "ESTIMATED",
      maintenanceRatio: 180,
    });
  });

  it("returns Infinity and NO_DEBT when debt is zero", () => {
    expect(
      calculateEstimatedMaintenance({
        collateralValue: 180000,
        totalDebt: 0,
      }),
    ).toEqual({
      status: "NO_DEBT",
      maintenanceRatio: Infinity,
    });
  });
});

describe("theoreticalEngine.calculateKellyLimits", () => {
  it("returns UNAVAILABLE when required research inputs are missing", () => {
    expect(
      calculateKellyLimits({
        mu: null,
        sigma: 0.2,
        borrowRate: 0.025,
        productCostAdjustment: 0.01,
        protectiveScale: 0.5,
      }),
    ).toEqual({
      status: "UNAVAILABLE",
      reason: "MISSING_RESEARCH_INPUT",
      kellyMax: null,
      halfKelly: null,
    });
  });

  it("returns UNMODELED when product cost is missing", () => {
    expect(
      calculateKellyLimits({
        mu: 0.1,
        sigma: 0.2,
        borrowRate: 0.025,
        productCostAdjustment: null,
        protectiveScale: 0.5,
      }),
    ).toEqual({
      status: "UNMODELED",
      reason: "MISSING_PRODUCT_COST",
      kellyMax: null,
      halfKelly: null,
    });
  });

  it("does not output positive leverage when excess return is non-positive", () => {
    expect(
      calculateKellyLimits({
        mu: 0.03,
        sigma: 0.2,
        borrowRate: 0.025,
        productCostAdjustment: 0.01,
        protectiveScale: 0.5,
      }),
    ).toEqual({
      status: "NO_POSITIVE_KELLY",
      reason: "NON_POSITIVE_EXCESS_RETURN",
      kellyMax: 0,
      halfKelly: 0,
    });
  });

  it.each([0, -0.2, Number.NaN])(
    "returns INVALID_INPUT when sigma is not a positive finite number (%s)",
    (sigma) => {
      expect(
        calculateKellyLimits({
          mu: 0.1,
          sigma,
          borrowRate: 0.025,
          productCostAdjustment: 0.01,
          protectiveScale: 0.5,
        }),
      ).toEqual({
        status: "INVALID_INPUT",
        reason: "INVALID_SIGMA",
        kellyMax: null,
        halfKelly: null,
      });
    },
  );
});

describe("theoreticalEngine.calculateHumanCapital", () => {
  it("discounts explicit investable cash flows", () => {
    expect(
      calculateHumanCapital({
        cashFlows: [100000, 100000],
        growthRate: 0,
        discountRate: 0.1,
      }),
    ).toMatchObject({
      status: "OK",
    });
    expect(
      calculateHumanCapital({
        cashFlows: [100000, 100000],
        growthRate: 0,
        discountRate: 0.1,
      }).humanCapital,
    ).toBeCloseTo(190909.0909090909, 10);
  });

  it("returns UNAVAILABLE when cash flows are missing", () => {
    expect(
      calculateHumanCapital({
        cashFlows: null,
        growthRate: 0,
        discountRate: 0.1,
      }),
    ).toEqual({
      status: "UNAVAILABLE",
      reason: "MISSING_CASH_FLOWS",
      humanCapital: null,
    });
  });
});

describe("theoreticalEngine.calculateTrueExposure", () => {
  it("divides gross exposure by financial capital plus human capital", () => {
    expect(
      calculateTrueExposure({
        grossExposure: 300000,
        financialCapital: 100000,
        humanCapital: 200000,
      }),
    ).toEqual({
      status: "OK",
      trueExposure: 1,
    });
  });

  it("returns UNAVAILABLE when human capital is missing", () => {
    expect(
      calculateTrueExposure({
        grossExposure: 300000,
        financialCapital: 100000,
        humanCapital: null,
      }),
    ).toEqual({
      status: "UNAVAILABLE",
      reason: "MISSING_HUMAN_CAPITAL",
      trueExposure: null,
    });
  });
});

describe("theoreticalEngine.calculateCrashTolerance", () => {
  it("calculates the proportional decline to a target maintenance ratio", () => {
    expect(
      calculateCrashTolerance({
        currentMaintenance: 200,
        targetMaintenance: 160,
      }),
    ).toMatchObject({
      status: "ESTIMATED",
    });
    expect(
      calculateCrashTolerance({
        currentMaintenance: 200,
        targetMaintenance: 160,
      }).crashTolerance,
    ).toBeCloseTo(0.2, 10);
  });

  it("returns UNAVAILABLE when maintenance inputs are invalid", () => {
    expect(
      calculateCrashTolerance({
        currentMaintenance: 0,
        targetMaintenance: 130,
      }),
    ).toMatchObject({
      status: "UNAVAILABLE",
      reason: "INVALID_MAINTENANCE_INPUT",
    });
  });

  it("計算實際追繳門檻場景：當前 180% vs 追繳門檻 130%", () => {
    // 模擬真實情境：擔保品 1,800,000 / 融資 1,000,000 = 180%
    // 證券商追繳門檻 130%
    const result = calculateCrashTolerance({
      currentMaintenance: 180,
      targetMaintenance: 130,
    });

    expect(result.status).toBe("ESTIMATED");
    // 可承受跌幅 = 1 - 130/180 = 27.8%
    expect(result.crashTolerance).toBeCloseTo(0.278, 3);
  });

  it("避免單位不一致錯誤：不接受小數形式的 targetMaintenance", () => {
    // 這是之前的 Bug：targetMaintenance: 0.3 導致錯誤結果 99.8%
    const wrongResult = calculateCrashTolerance({
      currentMaintenance: 180,
      targetMaintenance: 0.3, // 錯誤！應使用 130 而非 0.3
    });

    // 結果會是 1 - 0.3/180 = 0.998 (99.8%)，這是不合理的
    expect(wrongResult.crashTolerance).toBeCloseTo(0.998, 3);

    // 正確用法應該傳入百分比數字
    const correctResult = calculateCrashTolerance({
      currentMaintenance: 180,
      targetMaintenance: 130,
    });

    expect(correctResult.crashTolerance).toBeCloseTo(0.278, 3);
  });
});

describe("theoreticalEngine.calculateLaplaceCriterion", () => {
  it("returns minimax loss and worst scenario", () => {
    expect(
      calculateLaplaceCriterion({
        scenarios: [
          { name: "COVID 熔斷", maxLoss: 0.4 },
          { name: "熊市震盪", maxLoss: 0.25 },
          { name: "閃崩", maxLoss: 0.35 },
          { name: "估值回歸", maxLoss: 0.2 },
        ],
      }),
    ).toEqual({
      status: "OK",
      minimaxLoss: 0.2,
      worstScenario: "估值回歸",
    });
  });

  it("returns UNAVAILABLE when scenarios is empty", () => {
    expect(
      calculateLaplaceCriterion({
        scenarios: [],
      }),
    ).toEqual({
      status: "UNAVAILABLE",
      reason: "MISSING_SCENARIOS",
      minimaxLoss: null,
      worstScenario: null,
    });
  });

  it("returns UNAVAILABLE when scenarios is missing", () => {
    expect(
      calculateLaplaceCriterion({
        scenarios: null,
      }),
    ).toEqual({
      status: "UNAVAILABLE",
      reason: "MISSING_SCENARIOS",
      minimaxLoss: null,
      worstScenario: null,
    });
  });
});

describe("theoreticalEngine.calculateTobinSeparation", () => {
  it("returns risky and risk-free asset ratios", () => {
    expect(
      calculateTobinSeparation({
        riskyAssetValue: 600000,
        riskFreeAssetValue: 400000,
      }),
    ).toEqual({
      status: "OK",
      riskyRatio: 0.6,
      riskFreeRatio: 0.4,
    });
  });

  it("returns UNAVAILABLE when values are invalid", () => {
    expect(
      calculateTobinSeparation({
        riskyAssetValue: null,
        riskFreeAssetValue: 400000,
      }),
    ).toEqual({
      status: "UNAVAILABLE",
      reason: "INVALID_ASSET_INPUT",
      riskyRatio: null,
      riskFreeRatio: null,
    });
  });

  it("returns UNAVAILABLE when total asset is zero", () => {
    expect(
      calculateTobinSeparation({
        riskyAssetValue: 0,
        riskFreeAssetValue: 0,
      }),
    ).toEqual({
      status: "UNAVAILABLE",
      reason: "ZERO_TOTAL_ASSET",
      riskyRatio: null,
      riskFreeRatio: null,
    });
  });
});
