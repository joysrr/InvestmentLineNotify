/**
 * interestCostFilter.test.mjs
 * 利息成本濾網單元測試
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  applyInterestCostFilter,
  getMarginFinancingData,
  applyInterestCostFilterToDecision,
} from "../../modules/strategy/policies/interestCostFilter.mjs";

describe("interestCostFilter", () => {
  describe("applyInterestCostFilter()", () => {
    const baseStrategy = {
      trading: {
        loanInterestRate: 0.022,
        budget: {},
      },
      interestCostFilter: {
        interestCostRatioThreshold: 3.0,
        interestCostToReturnRatioThreshold: 0.5,
        netReturnNegativeThreshold: 0,
      },
      expectedAnnualReturn: 0.08,
    };

    it("無借款時應回傳不需濾網", () => {
      const ctx = { netAsset: 5000000, totalLoan: 0 };
      const result = applyInterestCostFilter(ctx, baseStrategy);

      expect(result.shouldFilter).toBe(false);
      expect(result.filterReason).toContain("無借款");
      expect(result.dailyInterestCost).toBe(0);
      expect(result.annualInterestCost).toBe(0);
    });

    it("淨值為 0 時應回傳不需濾網", () => {
      const ctx = { netAsset: 0, totalLoan: 1000000 };
      const result = applyInterestCostFilter(ctx, baseStrategy);

      expect(result.shouldFilter).toBe(false);
    });

    it("正常情況應正確計算各項利息成本", () => {
      const ctx = { netAsset: 5000000, totalLoan: 1000000 };
      const result = applyInterestCostFilter(ctx, baseStrategy);

      // 年化利息 = 1000000 * 0.022 = 22000
      expect(result.annualInterestCost).toBeCloseTo(22000, 0);
      // 每日利息 = 22000 / 365
      expect(result.dailyInterestCost).toBeCloseTo(22000 / 365, 2);
      // 每月利息 = daily * 30
      expect(result.monthlyInterestCost).toBeCloseTo((22000 / 365) * 30, 2);
      // 利息佔淨值比例 = 22000 / 5000000 * 100 = 0.44%
      expect(result.interestCostRatio).toBeCloseTo(0.44, 2);
      // 利息佔預期報酬比率 = 22000 / (5000000 * 0.08) = 22000 / 400000 = 0.055
      expect(result.interestCostToReturnRatio).toBeCloseTo(0.055, 3);
      // 淨報酬 = 8% - 0.44% = 7.56%
      expect(result.netReturnAfterInterest).toBeCloseTo(0.0756, 4);
      expect(result.shouldFilter).toBe(false);
    });

    it("利息成本佔淨值超過 3% 時應觸發濾網", () => {
      const ctx = { netAsset: 5000000, totalLoan: 7000000 }; // 年息 154000，佔淨值 3.08%
      const result = applyInterestCostFilter(ctx, baseStrategy);

      expect(result.interestCostRatio).toBeGreaterThan(3.0);
      expect(result.shouldFilter).toBe(true);
      expect(result.filterReason).toContain("年化利息成本佔淨值");
    });

    it("利息成本佔預期報酬超過 50% 時應觸發濾網", () => {
      const strategy = {
        ...baseStrategy,
        expectedAnnualReturn: 0.03, // 低預期報酬 3%
      };
      const ctx = { netAsset: 5000000, totalLoan: 1000000 }; // 年息 22000，佔預期報酬 22000/150000 = 14.6%
      // 需要更高借款：1000000 * 0.022 = 22000，預期報酬 = 5000000 * 0.03 = 150000，比率 = 14.6%
      // 為了達到 50%，需要借款 340 萬：3400000 * 0.022 = 74800，74800/150000 = 49.8%
      const ctx2 = { netAsset: 5000000, totalLoan: 3500000 };
      const result = applyInterestCostFilter(ctx2, strategy);

      expect(result.interestCostToReturnRatio).toBeGreaterThan(0.5);
      expect(result.shouldFilter).toBe(true);
      expect(result.filterReason).toContain("利息成本佔預期報酬");
    });

    it("扣除利息後淨報酬為負時應觸發濾網", () => {
      const strategy = {
        ...baseStrategy,
        expectedAnnualReturn: 0.005, // 極低預期報酬 0.5%
      };
      const ctx = { netAsset: 5000000, totalLoan: 1000000 }; // 年息 22000，佔淨值 0.44%，扣除後 0.5% - 0.44% = 0.06% > 0
      // 需要更高借款
      const ctx2 = { netAsset: 5000000, totalLoan: 3000000 }; // 年息 66000，佔淨值 1.32%，扣除後 0.5% - 1.32% = -0.82%
      const result = applyInterestCostFilter(ctx2, strategy);

      expect(result.netReturnAfterInterest).toBeLessThan(0);
      expect(result.shouldFilter).toBe(true);
      expect(result.filterReason).toContain("淨報酬為負");
    });

    it("應正確計算決策影響", () => {
      const ctx = { netAsset: 5000000, totalLoan: 1000000 };
      const decision = { budgetAllowedAmount: 500000 };
      const result = applyInterestCostFilter(ctx, baseStrategy, decision);

      expect(result.breakdown.decisionImpact).toBeDefined();
      expect(result.breakdown.decisionImpact.newTotalLoan).toBe(1500000);
      expect(result.breakdown.decisionImpact.additionalDailyCost).toBeCloseTo(
        (500000 * 0.022) / 365,
        2,
      );
    });

    it("無 interestCostFilter 配置時應使用預設值", () => {
      const strategy = {
        trading: { loanInterestRate: 0.022, budget: {} },
        expectedAnnualReturn: 0.08,
      };
      const ctx = { netAsset: 5000000, totalLoan: 7000000 }; // 3.08% > 3% 預設值
      const result = applyInterestCostFilter(ctx, strategy);

      expect(result.shouldFilter).toBe(true);
    });
  });

  describe("getMarginFinancingData()", () => {
    it("應正確整合融資券資料", () => {
      const marketData = {
        rawMargin: {
          marginBalance100M: 5000,
          marginBalanceChange100M: 100,
          maintenanceRatio: 250,
          shortBalance100M: 200,
          date: "2024-01-15",
        },
        rawUsMarket: {
          vix: 18.5,
          spxChg: 0.02,
          riskLevel: "low",
        },
        rawStockMargin: { stockId: "2330", margin: 1000 },
      };

      const result = getMarginFinancingData(marketData);

      expect(result.twMargin.marginBalance100M).toBe(5000);
      expect(result.twMargin.marginBalanceChange100M).toBe(100);
      expect(result.twMargin.maintenanceRatio).toBe(250);
      expect(result.twMargin.shortBalance100M).toBe(200);
      expect(result.twMargin.date).toBe("2024-01-15");
      expect(result.stockMargin).toEqual({ stockId: "2330", margin: 1000 });
      expect(result.usMarket.vix).toBe(18.5);
      expect(result.usMarket.spxChg).toBe(0.02);
      expect(result.usMarket.riskLevel).toBe("low");
      expect(result.fetchedAt).toBeDefined();
    });

    it("缺少資料時應使用預設值 0/null", () => {
      const marketData = {};
      const result = getMarginFinancingData(marketData);

      expect(result.twMargin.marginBalance100M).toBe(0);
      expect(result.twMargin.maintenanceRatio).toBe(0);
      expect(result.stockMargin).toBeNull();
      expect(result.usMarket.vix).toBeNull();
    });
  });

  describe("applyInterestCostFilterToDecision()", () => {
    const baseDecision = {
      signalDirection: "long",
      target: "買入",
      scalingRatio: 1.0,
      targetSuggestionShort: "",
      targetSuggestion: "",
    };

    it("無需濾網時應回傳原決策", () => {
      const filterResult = { shouldFilter: false };
      const result = applyInterestCostFilterToDecision(
        baseDecision,
        filterResult,
      );

      expect(result).toEqual(baseDecision);
    });

    it("淨報酬為負時應強制 hold 並將 scalingRatio 設為 0", () => {
      const filterResult = {
        shouldFilter: true,
        netReturnAfterInterest: -0.01,
        filterReason: "淨報酬為負",
        interestCostRatio: 2.0,
        interestCostToReturnRatio: 0.3,
        dailyInterestCost: 1000,
        monthlyInterestCost: 30000,
        annualInterestCost: 365000,
      };

      const result = applyInterestCostFilterToDecision(
        baseDecision,
        filterResult,
      );

      expect(result.signalDirection).toBe("hold");
      expect(result.scalingRatio).toBe(0);
      expect(result.interestCostFilterApplied).toBe(true);
      expect(result.target).toContain("利息成本過高");
    });

    it("利息成本佔報酬 > 50% 時應將 scalingRatio 降至 0.3", () => {
      const filterResult = {
        shouldFilter: true,
        netReturnAfterInterest: 0.02,
        filterReason: "利息成本過高",
        interestCostRatio: 2.0,
        interestCostToReturnRatio: 0.6,
        dailyInterestCost: 1000,
        monthlyInterestCost: 30000,
        annualInterestCost: 365000,
      };

      const result = applyInterestCostFilterToDecision(
        baseDecision,
        filterResult,
      );

      expect(result.scalingRatio).toBe(0.3);
      expect(result.interestCostFilterApplied).toBe(true);
      expect(result.targetSuggestionShort).toContain("利息成本佔報酬");
    });

    it("利息成本佔淨值 > 3% 時應將 scalingRatio 降至 0.7", () => {
      const filterResult = {
        shouldFilter: true,
        netReturnAfterInterest: 0.03,
        filterReason: "利息成本過高",
        interestCostRatio: 4.0,
        interestCostToReturnRatio: 0.3,
        dailyInterestCost: 1000,
        monthlyInterestCost: 30000,
        annualInterestCost: 365000,
      };

      const result = applyInterestCostFilterToDecision(
        baseDecision,
        filterResult,
      );

      expect(result.scalingRatio).toBe(0.7);
      expect(result.interestCostFilterApplied).toBe(true);
      expect(result.targetSuggestionShort).toContain("利息成本");
    });

    it("應附加 interestCostInfo 供前端顯示", () => {
      const filterResult = {
        shouldFilter: true,
        netReturnAfterInterest: 0.02,
        filterReason: "測試",
        interestCostRatio: 4.0,
        interestCostToReturnRatio: 0.3,
        dailyInterestCost: 1000,
        monthlyInterestCost: 30000,
        annualInterestCost: 365000,
      };

      const result = applyInterestCostFilterToDecision(
        baseDecision,
        filterResult,
      );

      expect(result.interestCostInfo).toBeDefined();
      expect(result.interestCostInfo.dailyCost).toBe(1000);
      expect(result.interestCostInfo.monthlyCost).toBe(30000);
      expect(result.interestCostInfo.annualCost).toBe(365000);
      expect(result.interestCostInfo.costRatio).toBe(4.0);
      expect(result.interestCostInfo.netReturnAfterInterest).toBe(0.02);
    });
  });
});
