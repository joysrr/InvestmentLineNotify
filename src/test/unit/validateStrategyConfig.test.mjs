/**
 * validateStrategyConfig.test.mjs
 *
 * Unit tests for validateStrategyConfig.mjs
 * 測試 Strategy.json 配置驗證邏輯
 */

import { describe, it, expect } from "vitest";
import { validateStrategyConfig } from "../../modules/strategy/validateStrategyConfig.mjs";

// ─────────────────────────────────────────────────────────────
// 共用測試配置（最小有效配置）
// ─────────────────────────────────────────────────────────────

const minimalValidConfig = {
  version: "2.6",
  description: "Test config",
  leverage: { type: "2x", etf: "00675L" },
  reserve: {
    tiers: [
      { maxAsset: 1000000, ratio: 0.3 },
      { maxAsset: 2000000, ratio: 0.4 },
    ],
  },
  maintenance: {
    marginCallThreshold: 135,
    frozenZone: 145,
    protectTrigger: 160,
    protectTarget: 180,
  },
  grossLeverage: {
    ceiling: 2.5,
    hardCap: 3.0,
    recoveryTarget: 2.0,
  },
  trading: {
    minAction: 1000,
    cooldownDays: 1,
    transFee: 0.001425,
    transFeeDiscount: 0.25,
    taxRate: 0.003,
    loanInterestRate: 0.04,
    budget: {
      maxDailyLoanIncreasePct: 0.05,
      maxRollingLoanIncreasePct: 0.15,
      rollingDays: 10,
    },
  },
  buy: {
    minDropPercentToConsider: 1,
    minWeightScoreToBuy: 0.5,
    dropScoreRules: [
      { minDrop: 1, score: 10, label: "小跌" },
      { minDrop: 3, score: 20, label: "中跌" },
      { minDrop: 5, score: 30, label: "大跌" },
    ],
    rsi: { oversold: 30, score: 15 },
    macd: { score: 15 },
    kd: { oversoldK: 20, score: 20 },
    panic: {
      minDropRank: 80,
      rsiDivider: 2,
      minVixLevel: "30",
      suggestedLeverage: 2,
    },
  },
  sell: {
    postAllocationIndexFromEnd: 2,
    minUpPercentToSell: 2,
    minSignalCountToSell: 2,
    rsi: { overbought: 70 },
    kd: { overboughtK: 80 },
  },
  allocation: [
    { minScore: 0, leverage: 1, cash: 1, comment: "觀望" },
    { minScore: 30, leverage: 1.5, cash: 0.5, comment: "輕倉" },
    { minScore: 50, leverage: 2, cash: 0, comment: "中倉" },
    { minScore: 70, leverage: 2.5, cash: 0, comment: "重倉" },
  ],
  threshold: {
    z2TargetRatio: 0.2,
    reversalTriggerCount: 3,
    z2RatioHigh: 0.3,
    minActionableAmount: 1000,
    overheatCount: 5,
    rsiOverheatLevel: 80,
    dOverheatLevel: 75,
    bias240OverheatLevel: 5,
    rsiReversalLevel: 70,
    kReversalLevel: 80,
    wAggressive: 0.5,
    wActive: 0.7,
    vixLowComplacency: 15,
    vixHighFear: 25,
    vixPanic: 35,
    vixExtreme: 40,
    usVixPanic: 30,
  },
};

// ─────────────────────────────────────────────────────────────
// 有效配置測試
// ─────────────────────────────────────────────────────────────

describe("validateStrategyConfig - 有效配置", () => {
  it("最小有效配置應通過驗證", () => {
    expect(() => validateStrategyConfig(minimalValidConfig)).not.toThrow();
  });

  it("完整配置應通過驗證", () => {
    const fullConfig = {
      ...minimalValidConfig,
      valuationGuard: {
        enabled: true,
        minHistoryDays: 60,
        tiers: [
          { prThreshold: 70, label: "正常", multiplier: 1 },
          { prThreshold: 90, label: "高估", multiplier: 0.5 },
        ],
        latch: {
          enabled: true,
          triggerPrThreshold: 90,
          unlockConditions: {
            condition1: { prBelowThreshold: 70 },
            condition3: {
              ma20AboveDays: 10,
              macdPositive: true,
              trendUnlockMa60SlopeThreshold: 0.01,
            },
          },
        },
      },
      valuationMomentum: {
        enabled: true,
        lookbackDays: 20,
        risingThreshold: 0.05,
        fallingThreshold: -0.05,
        risingPenaltyMultiplier: 0.5,
        fallingRelief: true,
      },
      overrideHierarchy: {
        panicBypassEnabled: true,
        panicBypassDropPct: 0.2,
        panicVixThreshold: 35,
      },
      macroSentiment: {
        enabled: true,
        bullishBonus: 5,
        bearishPenalty: -10,
        bearishCooldownMultiplier: 1.5,
      },
      conversionGuard: {
        enabled: true,
        tiers: [
          { profitPct: 20, convertRatio: 0.3 },
          { profitPct: 50, convertRatio: 0.5 },
        ],
        allocation: [
          { minMargin: 160, repayRatio: 0.2 },
          { minMargin: 180, repayRatio: 0.5 },
        ],
      },
      lifecycle: {
        monthlyDcaAmount: 50000,
        payDay: 15,
        preInjectDays: 3,
        profiles: [
          { stage: "EARLY", maxLeverage: 3.0 },
          { stage: "MID", maxLeverage: 2.5 },
          { stage: "LATE", maxLeverage: 2.0 },
          { stage: "PRE_RETIRE", maxLeverage: 1.5 },
        ],
      },
    };

    expect(() => validateStrategyConfig(fullConfig)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
// 必填欄位驗證
// ─────────────────────────────────────────────────────────────

describe("validateStrategyConfig - 必填欄位", () => {
  it("缺少 version 應拋出錯誤", () => {
    const invalidConfig = { ...minimalValidConfig };
    delete invalidConfig.version;

    expect(() => validateStrategyConfig(invalidConfig)).toThrow(
      "version",
    );
  });

  it("缺少 description 應拋出錯誤", () => {
    const invalidConfig = { ...minimalValidConfig };
    delete invalidConfig.description;

    expect(() => validateStrategyConfig(invalidConfig)).toThrow(
      "description",
    );
  });

  it("缺少 leverage 應拋出錯誤", () => {
    const invalidConfig = { ...minimalValidConfig };
    delete invalidConfig.leverage;

    expect(() => validateStrategyConfig(invalidConfig)).toThrow(
      "leverage",
    );
  });

  it("缺少 reserve 應拋出錯誤", () => {
    const invalidConfig = { ...minimalValidConfig };
    delete invalidConfig.reserve;

    expect(() => validateStrategyConfig(invalidConfig)).toThrow(
      "reserve",
    );
  });

  it("缺少 maintenance 應拋出錯誤", () => {
    const invalidConfig = { ...minimalValidConfig };
    delete invalidConfig.maintenance;

    expect(() => validateStrategyConfig(invalidConfig)).toThrow(
      "maintenance",
    );
  });

  it("缺少 grossLeverage 應拋出錯誤", () => {
    const invalidConfig = { ...minimalValidConfig };
    delete invalidConfig.grossLeverage;

    expect(() => validateStrategyConfig(invalidConfig)).toThrow(
      "grossLeverage",
    );
  });

  it("缺少 trading 應拋出錯誤", () => {
    const invalidConfig = { ...minimalValidConfig };
    delete invalidConfig.trading;

    expect(() => validateStrategyConfig(invalidConfig)).toThrow(
      "trading",
    );
  });

  it("缺少 buy 應拋出錯誤", () => {
    const invalidConfig = { ...minimalValidConfig };
    delete invalidConfig.buy;

    expect(() => validateStrategyConfig(invalidConfig)).toThrow("buy");
  });

  it("缺少 sell 應拋出錯誤", () => {
    const invalidConfig = { ...minimalValidConfig };
    delete invalidConfig.sell;

    expect(() => validateStrategyConfig(invalidConfig)).toThrow("sell");
  });

  it("缺少 allocation 應拋出錯誤", () => {
    const invalidConfig = { ...minimalValidConfig };
    delete invalidConfig.allocation;

    expect(() => validateStrategyConfig(invalidConfig)).toThrow(
      "allocation",
    );
  });

  it("缺少 threshold 應拋出錯誤", () => {
    const invalidConfig = { ...minimalValidConfig };
    delete invalidConfig.threshold;

    expect(() => validateStrategyConfig(invalidConfig)).toThrow(
      "threshold",
    );
  });
});

// ─────────────────────────────────────────────────────────────
// 維持率階梯驗證
// ─────────────────────────────────────────────────────────────

describe("validateStrategyConfig - 維持率階梯", () => {
  it("階梯必須嚴格遞增應通過", () => {
    const config = { ...minimalValidConfig };
    expect(() => validateStrategyConfig(config)).not.toThrow();
  });

  it("階梯非遞增應拋出錯誤", () => {
    const config = {
      ...minimalValidConfig,
      maintenance: {
        marginCallThreshold: 140, // > frozenZone，錯誤
        frozenZone: 135,
        protectTrigger: 160,
        protectTarget: 180,
      },
    };

    expect(() => validateStrategyConfig(config)).toThrow(
      "marginCallThreshold",
    );
  });

  it("frozenZone > protectTrigger 應拋出錯誤", () => {
    const config = {
      ...minimalValidConfig,
      maintenance: {
        marginCallThreshold: 135,
        frozenZone: 170, // > protectTrigger，錯誤
        protectTrigger: 160,
        protectTarget: 180,
      },
    };

    expect(() => validateStrategyConfig(config)).toThrow("frozenZone");
  });
});

// ─────────────────────────────────────────────────────────────
// Gross Leverage 驗證
// ─────────────────────────────────────────────────────────────

describe("validateStrategyConfig - Gross Leverage", () => {
  it("有效配置應通過", () => {
    expect(() => validateStrategyConfig(minimalValidConfig)).not.toThrow();
  });

  it("recoveryTarget >= ceiling 應拋出錯誤", () => {
    const config = {
      ...minimalValidConfig,
      grossLeverage: {
        ceiling: 2.5,
        hardCap: 3.0,
        recoveryTarget: 2.5, // >= ceiling，錯誤
      },
    };

    expect(() => validateStrategyConfig(config)).toThrow("recoveryTarget");
  });

  it("ceiling >= hardCap 應拋出錯誤", () => {
    const config = {
      ...minimalValidConfig,
      grossLeverage: {
        ceiling: 3.0, // >= hardCap，錯誤
        hardCap: 3.0,
        recoveryTarget: 2.0,
      },
    };

    expect(() => validateStrategyConfig(config)).toThrow("ceiling");
  });

  it("hardCap 為負數應拋出錯誤", () => {
    const config = {
      ...minimalValidConfig,
      grossLeverage: {
        ceiling: 2.5,
        hardCap: -3.0,
        recoveryTarget: 2.0,
      },
    };

    expect(() => validateStrategyConfig(config)).toThrow(
      "hardCap",
    );
  });
});

// ─────────────────────────────────────────────────────────────
// Budget 硬限制驗證
// ─────────────────────────────────────────────────────────────

describe("validateStrategyConfig - Budget 硬限制", () => {
  it("預設配置應通過", () => {
    expect(() => validateStrategyConfig(minimalValidConfig)).not.toThrow();
  });

  it("maxDailyLoanIncreasePct > 15% 應拋出錯誤", () => {
    const config = {
      ...minimalValidConfig,
      trading: {
        ...minimalValidConfig.trading,
        budget: {
          maxDailyLoanIncreasePct: 0.2, // 20% > 15%，錯誤
          maxRollingLoanIncreasePct: 0.15,
          rollingDays: 10,
        },
      },
    };

    expect(() => validateStrategyConfig(config)).toThrow(
      "maxDailyLoanIncreasePct",
    );
  });

  it("maxRollingLoanIncreasePct > 20% 應拋出錯誤", () => {
    const config = {
      ...minimalValidConfig,
      trading: {
        ...minimalValidConfig.trading,
        budget: {
          maxDailyLoanIncreasePct: 0.05,
          maxRollingLoanIncreasePct: 0.25, // 25% > 20%，錯誤
          rollingDays: 10,
        },
      },
    };

    expect(() => validateStrategyConfig(config)).toThrow(
      "maxRollingLoanIncreasePct",
    );
  });

  it("等於硬限制應通過", () => {
    const config = {
      ...minimalValidConfig,
      trading: {
        ...minimalValidConfig.trading,
        budget: {
          maxDailyLoanIncreasePct: 0.15, // 正好 15%
          maxRollingLoanIncreasePct: 0.2, // 正好 20%
          rollingDays: 10,
        },
      },
    };

    expect(() => validateStrategyConfig(config)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
// Valuation Guard 驗證
// ─────────────────────────────────────────────────────────────

describe("validateStrategyConfig - Valuation Guard", () => {
  it("有效配置應通過", () => {
    const config = {
      ...minimalValidConfig,
      valuationGuard: {
        enabled: true,
        minHistoryDays: 60,
        tiers: [
          { prThreshold: 70, label: "正常", multiplier: 1 },
          { prThreshold: 90, label: "高估", multiplier: 0.5 },
        ],
      },
    };

    expect(() => validateStrategyConfig(config)).not.toThrow();
  });

  it("multiplier > 1 應拋出錯誤", () => {
    const config = {
      ...minimalValidConfig,
      valuationGuard: {
        enabled: true,
        minHistoryDays: 60,
        tiers: [
          { prThreshold: 90, label: "高估", multiplier: 1.5 }, // > 1，錯誤
        ],
      },
    };

    expect(() => validateStrategyConfig(config)).toThrow("multiplier");
  });

  it("tiers 為空陣列應拋出錯誤", () => {
    const config = {
      ...minimalValidConfig,
      valuationGuard: {
        enabled: true,
        minHistoryDays: 60,
        tiers: [],
      },
    };

    expect(() => validateStrategyConfig(config)).toThrow("tiers");
  });
});

// ─────────────────────────────────────────────────────────────
// Lifecycle 驗證
// ─────────────────────────────────────────────────────────────

describe("validateStrategyConfig - Lifecycle", () => {
  it("有效配置應通過", () => {
    const config = {
      ...minimalValidConfig,
      lifecycle: {
        monthlyDcaAmount: 50000,
        payDay: 15,
        preInjectDays: 3,
        profiles: [
          { stage: "EARLY", maxLeverage: 3.0 },
          { stage: "MID", maxLeverage: 2.5 },
        ],
      },
    };

    expect(() => validateStrategyConfig(config)).not.toThrow();
  });

  it("maxLeverage > 3.0 應拋出錯誤", () => {
    const config = {
      ...minimalValidConfig,
      lifecycle: {
        monthlyDcaAmount: 50000,
        payDay: 15,
        preInjectDays: 3,
        profiles: [
          { stage: "EARLY", maxLeverage: 3.5 }, // > 3.0，錯誤
        ],
      },
    };

    expect(() => validateStrategyConfig(config)).toThrow("maxLeverage");
  });

  it("maxLeverage = 0 應拋出錯誤", () => {
    const config = {
      ...minimalValidConfig,
      lifecycle: {
        monthlyDcaAmount: 50000,
        payDay: 15,
        preInjectDays: 3,
        profiles: [
          { stage: "EARLY", maxLeverage: 0 }, // = 0，錯誤
        ],
      },
    };

    expect(() => validateStrategyConfig(config)).toThrow("maxLeverage");
  });
});

// ─────────────────────────────────────────────────────────────
// 型別驗證
// ─────────────────────────────────────────────────────────────

describe("validateStrategyConfig - 型別驗證", () => {
  it("version 為字串應通過", () => {
    const config = { ...minimalValidConfig };
    expect(() => validateStrategyConfig(config)).not.toThrow();
  });

  it("version 為數字應拋出錯誤", () => {
    const config = { ...minimalValidConfig, version: 2.6 };
    expect(() => validateStrategyConfig(config)).toThrow("version");
  });

  it("allocation.minScore 為數字應通過", () => {
    const config = { ...minimalValidConfig };
    expect(() => validateStrategyConfig(config)).not.toThrow();
  });

  it("allocation.leverage 為負數應拋出錯誤", () => {
    const config = {
      ...minimalValidConfig,
      allocation: [
        { minScore: 0, leverage: -1, cash: 1, comment: "錯誤" },
      ],
    };

    expect(() => validateStrategyConfig(config)).toThrow("leverage");
  });

  it("allocation.cash 為負數應拋出錯誤", () => {
    const config = {
      ...minimalValidConfig,
      allocation: [
        { minScore: 0, leverage: 1, cash: -1, comment: "錯誤" },
      ],
    };

    expect(() => validateStrategyConfig(config)).toThrow("cash");
  });
});

// ─────────────────────────────────────────────────────────────
// 選填欄位測試
// ─────────────────────────────────────────────────────────────

describe("validateStrategyConfig - 選填欄位", () => {
  it("缺少選填欄位應通過", () => {
    const config = { ...minimalValidConfig };
    expect(() => validateStrategyConfig(config)).not.toThrow();
  });

  it("缺少 budget 應通過", () => {
    const config = {
      ...minimalValidConfig,
      trading: {
        minAction: 1000,
        cooldownDays: 1,
        transFee: 0.001425,
        transFeeDiscount: 0.25,
        taxRate: 0.003,
        loanInterestRate: 0.04,
      },
    };

    expect(() => validateStrategyConfig(config)).not.toThrow();
  });

  it("缺少 valuationGuard 應通過", () => {
    const config = { ...minimalValidConfig };
    expect(() => validateStrategyConfig(config)).not.toThrow();
  });

  it("缺少 lifecycle 應通過", () => {
    const config = { ...minimalValidConfig };
    expect(() => validateStrategyConfig(config)).not.toThrow();
  });
});
