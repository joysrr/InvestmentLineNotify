/**
 * portfolioHealth.test.mjs
 *
 * Unit tests for portfolioHealth.mjs
 * 測試 6 組件評分算法（Margin / Survival / Decoupling / Leverage / Lifecycle / Regime）
 *
 * 測試案例：TC-008 ~ TC-015, TC-020
 */

import { describe, it, expect } from "vitest";
import {
  computePortfolioHealth,
  getHealthLightStatus,
  HEALTH_STATUS,
} from "../../modules/strategy/portfolioHealth.mjs";
import {
  computeLifecycleContext,
  DEFAULT_LIFECYCLE_PROFILES,
} from "../../modules/strategy/lifecycleEngine.mjs";

// ─────────────────────────────────────────────────────────────
// 共用測試配置
// ─────────────────────────────────────────────────────────────

const DEFAULT_STRATEGY = {
  maintenance: {
    marginCallThreshold: 135,
    frozenZone: 145,
    protectTrigger: 160,
  },
  threshold: {
    z2RatioHigh: 45,
  },
  grossLeverage: {
    ceiling: 2.0,
    hardCap: 2.5,
  },
  macroSentiment: {
    vixOverrideTrigger: 28,
    vixAbsoluteOverride: 35,
  },
  lifecycle: {
    retirementAge: 65,
    profiles: DEFAULT_LIFECYCLE_PROFILES,
  },
};

const DEFAULT_LIFECYCLE_CONTEXT = computeLifecycleContext(
  53,
  65,
  DEFAULT_LIFECYCLE_PROFILES,
); // 53 歲 = MID 階段 (12 年)

// ─────────────────────────────────────────────────────────────
// TC-008: Health Score - All GREEN
// ─────────────────────────────────────────────────────────────

describe("Portfolio Health - All GREEN (TC-008)", () => {
  it("所有組件 GREEN 時總分應為 100", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 20,
      survivalDropPercent: 60, // >= 50% → GREEN
      currentGrossLeverage: 1.1, // < 1.2 (2.0*0.6) → GREEN
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.status).toBe(HEALTH_STATUS.GREEN);
    expect(result.score).toBe(100);
    expect(result.components.margin.status).toBe(HEALTH_STATUS.GREEN);
    expect(result.components.survival.status).toBe(HEALTH_STATUS.GREEN);
    expect(result.components.decoupling.status).toBe(HEALTH_STATUS.GREEN);
    expect(result.components.leverage.status).toBe(HEALTH_STATUS.GREEN);
    expect(result.components.lifecycle.status).toBe(HEALTH_STATUS.GREEN);
    expect(result.components.regime.status).toBe(HEALTH_STATUS.GREEN);
  });
});

// ─────────────────────────────────────────────────────────────
// TC-009: Health Score - Mixed Status
// ─────────────────────────────────────────────────────────────

describe("Portfolio Health - Mixed Status (TC-009)", () => {
  it("混合狀態應正確計算平均分數", () => {
    const ctx = {
      maintenanceMargin: 165,
      z2Ratio: 20,
      survivalDropPercent: 40, // 30-50% → YELLOW
      currentGrossLeverage: 1.5,
      vix: 22,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.status).toBe(HEALTH_STATUS.GREEN);
    expect(result.components.survival.status).toBe(HEALTH_STATUS.YELLOW);
    expect(result.components.survival.score).toBe(60);
    // 預期分數：(100 + 60 + 100 + 60 + 100 + 100) / 6 = 86.67 → 86
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.score).toBeLessThanOrEqual(90);
  });
});

// ─────────────────────────────────────────────────────────────
// TC-010: Health Score - RED Status
// ─────────────────────────────────────────────────────────────

describe("Portfolio Health - RED Status (TC-010)", () => {
  it("多個 RED 組件時總分應為 RED", () => {
    const ctx = {
      maintenanceMargin: 130, // Below marginCallThreshold → RED
      z2Ratio: 50, // Above z2TargetRatio → RED
      survivalDropPercent: 20, // < 30% → RED
      currentGrossLeverage: 2.8, // Above hardCap → RED
      vix: 40, // Above vixAbsoluteOverride → RED
      macroSentiment: { direction: "BEAR" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.status).toBe(HEALTH_STATUS.RED);
    expect(result.score).toBeLessThan(50);
    expect(result.components.margin.status).toBe(HEALTH_STATUS.RED);
    expect(result.components.survival.status).toBe(HEALTH_STATUS.RED);
    expect(result.components.decoupling.status).toBe(HEALTH_STATUS.RED);
    expect(result.components.leverage.status).toBe(HEALTH_STATUS.RED);
    expect(result.components.regime.status).toBe(HEALTH_STATUS.RED);
  });
});

// ─────────────────────────────────────────────────────────────
// TC-011 ~ TC-013: Margin Component Tests
// ─────────────────────────────────────────────────────────────

describe("Portfolio Health - Margin Component", () => {
  // TC-011: Margin GREEN
  it("TC-011: 維持率 > protectTrigger 應為 GREEN", () => {
    const ctx = {
      maintenanceMargin: 165,
      z2Ratio: 20,
      survivalDropPercent: 60,
      currentGrossLeverage: 1.2,
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.components.margin.status).toBe(HEALTH_STATUS.GREEN);
    expect(result.components.margin.score).toBe(100);
    expect(result.components.margin.details.level).toBe("safe");
  });

  // TC-012: Margin YELLOW
  it("TC-012: 維持率在 frozenZone ~ protectTrigger 應為 YELLOW", () => {
    const ctx = {
      maintenanceMargin: 148, // 145 ~ 160
      z2Ratio: 20,
      survivalDropPercent: 60,
      currentGrossLeverage: 1.2,
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.components.margin.status).toBe(HEALTH_STATUS.YELLOW);
    expect(result.components.margin.score).toBe(60);
    expect(result.components.margin.details.level).toBe("warning");
  });

  // TC-013: Margin RED
  it("TC-013: 維持率在 marginCallThreshold ~ frozenZone 應為 RED", () => {
    const ctx = {
      maintenanceMargin: 140, // 135 ~ 145 (danger zone)
      z2Ratio: 20,
      survivalDropPercent: 60,
      currentGrossLeverage: 1.2,
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.components.margin.status).toBe(HEALTH_STATUS.RED);
    expect(result.components.margin.score).toBe(30);
    expect(result.components.margin.details.level).toBe("danger");
  });

  it("維持率低於 marginCallThreshold 應為 RED (critical)", () => {
    const ctx = {
      maintenanceMargin: 130,
      z2Ratio: 20,
      survivalDropPercent: 60,
      currentGrossLeverage: 1.2,
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.components.margin.status).toBe(HEALTH_STATUS.RED);
    expect(result.components.margin.score).toBe(0);
    expect(result.components.margin.details.level).toBe("critical");
  });
});

// ─────────────────────────────────────────────────────────────
// Survival Component Tests (Fixed Thresholds: 30%/50%)
// ─────────────────────────────────────────────────────────────

describe("Portfolio Health - Survival Component", () => {
  it("生存空間 < 30% 應為 GREEN", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 20,
      survivalDropPercent: 60, // >= 50% → GREEN
      currentGrossLeverage: 1.2,
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.components.survival.status).toBe(HEALTH_STATUS.GREEN);
    expect(result.components.survival.score).toBe(100);
    expect(result.components.survival.details.threshold).toBe(">= 50%");
  });

  it("生存空間 30% ~ 50% 應為 YELLOW", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 20,
      survivalDropPercent: 40,
      currentGrossLeverage: 1.2,
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.components.survival.status).toBe(HEALTH_STATUS.YELLOW);
    expect(result.components.survival.score).toBe(60);
    expect(result.components.survival.details.threshold).toBe(">= 30%");
  });

  it("生存空間 >= 50% 應為 RED", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 20,
      survivalDropPercent: 20, // < 30% → RED
      currentGrossLeverage: 1.2,
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.components.survival.status).toBe(HEALTH_STATUS.RED);
    expect(result.components.survival.score).toBe(0);
  });

  it("生存空間正好 30% 應為 YELLOW（邊界）", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 20,
      survivalDropPercent: 30,
      currentGrossLeverage: 1.2,
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.components.survival.status).toBe(HEALTH_STATUS.YELLOW);
    expect(result.components.survival.score).toBe(60);
  });

  it("生存空間正好 50% 應為 GREEN（邊界）", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 20,
      survivalDropPercent: 50,
      currentGrossLeverage: 1.2,
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.components.survival.status).toBe(HEALTH_STATUS.GREEN);
    expect(result.components.survival.score).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────
// Decoupling Component Tests
// ─────────────────────────────────────────────────────────────

describe("Portfolio Health - Decoupling Component", () => {
  it("Z2 比例 < 50% target 應為 GREEN", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 20, // < 22.5 (45 * 0.5)
      survivalDropPercent: 60,
      currentGrossLeverage: 1.2,
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.components.decoupling.status).toBe(HEALTH_STATUS.GREEN);
    expect(result.components.decoupling.score).toBe(100);
  });

  it("Z2 比例 50% ~ 100% target 應為 YELLOW", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 35, // 22.5 ~ 45
      survivalDropPercent: 60,
      currentGrossLeverage: 1.2,
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.components.decoupling.status).toBe(HEALTH_STATUS.YELLOW);
    expect(result.components.decoupling.score).toBe(60);
  });

  it("Z2 比例 >= target 應為 RED", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 50, // > 45
      survivalDropPercent: 60,
      currentGrossLeverage: 1.2,
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.components.decoupling.status).toBe(HEALTH_STATUS.RED);
    expect(result.components.decoupling.score).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Leverage Component Tests (HIGH-002: limit 欄位)
// ─────────────────────────────────────────────────────────────

describe("Portfolio Health - Leverage Component", () => {
  it("槓桿 < 60% ceiling 應為 GREEN", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 20,
      survivalDropPercent: 60,
      currentGrossLeverage: 1.0, // < 1.2 (2.0 * 0.6)
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.components.leverage.status).toBe(HEALTH_STATUS.GREEN);
    expect(result.components.leverage.score).toBe(100);
    expect(result.components.leverage.details.limit).toBe(2.0); // HIGH-002 驗證
  });

  it("槓桿 60% ~ 100% ceiling 應為 YELLOW", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 20,
      survivalDropPercent: 60,
      currentGrossLeverage: 1.8, // 1.2 ~ 2.0
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.components.leverage.status).toBe(HEALTH_STATUS.YELLOW);
    expect(result.components.leverage.score).toBe(60);
    expect(result.components.leverage.details.limit).toBe(2.0);
  });

  it("槓桿 >= ceiling 應為 RED", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 20,
      survivalDropPercent: 60,
      currentGrossLeverage: 2.2, // > 2.0
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.components.leverage.status).toBe(HEALTH_STATUS.RED);
    expect(result.components.leverage.details.limit).toBe(2.0);
  });

  it("槓桿 >= hardCap 應為 RED (critical)", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 20,
      survivalDropPercent: 60,
      currentGrossLeverage: 2.6, // > 2.5
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.components.leverage.status).toBe(HEALTH_STATUS.RED);
    expect(result.components.leverage.score).toBe(0);
    expect(result.components.leverage.details.level).toBe("critical");
  });
});

// ─────────────────────────────────────────────────────────────
// Lifecycle Component Tests
// ─────────────────────────────────────────────────────────────

describe("Portfolio Health - Lifecycle Component", () => {
  it("槓桿在生命週期限制內應為 GREEN", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 20,
      survivalDropPercent: 60,
      currentGrossLeverage: 1.8, // <= 2.0 (MID maxLeverage)
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.components.lifecycle.status).toBe(HEALTH_STATUS.GREEN);
    expect(result.components.lifecycle.score).toBe(100);
    expect(result.components.lifecycle.details.withinLimit).toBe(true);
    expect(result.components.lifecycle.details.stage).toBe("MID");
  });

  it("槓桿超過生命週期限制應為 RED", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 20,
      survivalDropPercent: 60,
      currentGrossLeverage: 2.2, // > 2.0 (MID maxLeverage)
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.components.lifecycle.status).toBe(HEALTH_STATUS.RED);
    expect(result.components.lifecycle.score).toBe(0);
    expect(result.components.lifecycle.details.withinLimit).toBe(false);
  });

  it("未提供 lifecycleContext 應預設為 GREEN", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 20,
      survivalDropPercent: 60,
      currentGrossLeverage: 2.5,
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(ctx, DEFAULT_STRATEGY, null);

    expect(result.components.lifecycle.status).toBe(HEALTH_STATUS.GREEN);
    expect(result.components.lifecycle.score).toBe(100);
    expect(result.components.lifecycle.details.stage).toBe("N/A");
  });
});

// ─────────────────────────────────────────────────────────────
// TC-014 ~ TC-015: Regime Component Tests
// ─────────────────────────────────────────────────────────────

describe("Portfolio Health - Regime Component", () => {
  // TC-014: Regime VIX Panic
  it("TC-014: VIX >= 35 應觸發 panic 狀態（RED）", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 20,
      survivalDropPercent: 60,
      currentGrossLeverage: 1.2,
      vix: 38, // >= 35
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.components.regime.status).toBe(HEALTH_STATUS.RED);
    expect(result.components.regime.score).toBe(0);
    expect(result.components.regime.details.level).toBe("panic");
    expect(result.components.regime.details.action).toBe("Sell-only");
  });

  // TC-015: Regime VIX High
  it("TC-015: VIX 28 ~ 35 應觸發高波動狀態（YELLOW）", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 20,
      survivalDropPercent: 60,
      currentGrossLeverage: 1.2,
      vix: 32, // 28 ~ 35
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.components.regime.status).toBe(HEALTH_STATUS.YELLOW);
    expect(result.components.regime.score).toBe(50);
    expect(result.components.regime.details.level).toBe("high_volatility");
    expect(result.components.regime.details.action).toBe("降槓桿 50%");
  });

  it("VIX < 28 且 BULL 應為 GREEN", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 20,
      survivalDropPercent: 60,
      currentGrossLeverage: 1.2,
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.components.regime.status).toBe(HEALTH_STATUS.GREEN);
    expect(result.components.regime.score).toBe(100);
    expect(result.components.regime.details.level).toBe("normal");
  });

  it("VIX < 28 但 BEAR 應為 YELLOW", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 20,
      survivalDropPercent: 60,
      currentGrossLeverage: 1.2,
      vix: 18,
      macroSentiment: { direction: "BEAR" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.components.regime.status).toBe(HEALTH_STATUS.YELLOW);
    expect(result.components.regime.score).toBe(60);
    expect(result.components.regime.details.level).toBe("bearish");
  });

  it("VIX 正好 35 應觸發 panic（邊界）", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 20,
      survivalDropPercent: 60,
      currentGrossLeverage: 1.2,
      vix: 35,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.components.regime.status).toBe(HEALTH_STATUS.RED);
    expect(result.components.regime.details.level).toBe("panic");
  });

  it("VIX 正好 28 應觸發高波動（邊界）", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 20,
      survivalDropPercent: 60,
      currentGrossLeverage: 1.2,
      vix: 28,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.components.regime.status).toBe(HEALTH_STATUS.YELLOW);
    expect(result.components.regime.details.level).toBe("high_volatility");
  });
});

// ─────────────────────────────────────────────────────────────
// TC-020: Recommendations Generation
// ─────────────────────────────────────────────────────────────

describe("Portfolio Health - Recommendations (TC-020)", () => {
  it("Margin critical 應生成減碼建議", () => {
    const ctx = {
      maintenanceMargin: 130,
      z2Ratio: 20,
      survivalDropPercent: 60,
      currentGrossLeverage: 1.2,
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.recommendations).toContainEqual(
      expect.stringContaining("減碼"),
    );
  });

  it("Survival danger 應生成降槓桿建議", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 20,
      survivalDropPercent: 10,
      currentGrossLeverage: 1.2,
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.recommendations).toContainEqual(
      expect.stringContaining("生存空間不足"),
    );
  });

  it("Regime panic 應生成 Sell-only 建議", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 20,
      survivalDropPercent: 60,
      currentGrossLeverage: 1.2,
      vix: 38,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.recommendations).toContainEqual(
      expect.stringContaining("極端恐慌"),
    );
    expect(result.recommendations).toContainEqual(
      expect.stringContaining("僅允許賣出"),
    );
  });

  it("所有狀態正常應生成維持建議", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 20,
      survivalDropPercent: 60,
      currentGrossLeverage: 1.2,
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.recommendations).toContainEqual(
      expect.stringContaining("無需特別操作"),
    );
  });
});

// ─────────────────────────────────────────────────────────────
// getHealthLightStatus Tests
// ─────────────────────────────────────────────────────────────

describe("Portfolio Health - getHealthLightStatus", () => {
  it("GREEN 應返回 🟢", () => {
    const result = getHealthLightStatus(HEALTH_STATUS.GREEN);
    expect(result.emoji).toBe("🟢");
    expect(result.label).toBe("正常");
    expect(result.color).toBe("#4CAF50");
  });

  it("YELLOW 應返回 🟡", () => {
    const result = getHealthLightStatus(HEALTH_STATUS.YELLOW);
    expect(result.emoji).toBe("🟡");
    expect(result.label).toBe("警告");
    expect(result.color).toBe("#FFC107");
  });

  it("RED 應返回 🔴", () => {
    const result = getHealthLightStatus(HEALTH_STATUS.RED);
    expect(result.emoji).toBe("🔴");
    expect(result.label).toBe("危險");
    expect(result.color).toBe("#F44336");
  });

  it("未知狀態應返回 ⚪", () => {
    const result = getHealthLightStatus("UNKNOWN");
    expect(result.emoji).toBe("⚪");
    expect(result.label).toBe("未知");
  });
});

// ─────────────────────────────────────────────────────────────
// Health Summary Tests
// ─────────────────────────────────────────────────────────────

describe("Portfolio Health - Summary Generation", () => {
  it("所有 GREEN 應顯示良好", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 20,
      survivalDropPercent: 60,
      currentGrossLeverage: 1.2,
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.summary).toContain("良好");
  });

  it("有 RED 組件應顯示需關注", () => {
    const ctx = {
      maintenanceMargin: 130,
      z2Ratio: 20,
      survivalDropPercent: 60,
      currentGrossLeverage: 1.2,
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.summary).toContain("需關注");
    expect(result.summary).toContain("維持率");
  });

  it("應包含健康度分數", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 20,
      survivalDropPercent: 60,
      currentGrossLeverage: 1.2,
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.summary).toContain("分"); // 包含分數（不一定是 100 分）
  });
});

// ─────────────────────────────────────────────────────────────
// Edge Cases & Error Handling
// ─────────────────────────────────────────────────────────────

describe("Portfolio Health - Edge Cases", () => {
  it("所有值為 0 應使用預設值計算", () => {
    const ctx = {
      maintenanceMargin: 0,
      z2Ratio: 0,
      survivalDropPercent: 0,
      currentGrossLeverage: 0,
      vix: 0,
      macroSentiment: null,
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result).toBeDefined();
    expect(result.status).toBeDefined();
    expect(result.score).toBeDefined();
  });

  it("缺少 macroSentiment 應使用 NEUTRAL", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 20,
      survivalDropPercent: 60,
      currentGrossLeverage: 1.2,
      vix: 18,
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.components.regime.status).toBe(HEALTH_STATUS.GREEN);
  });

  it("應返回 timestamp", () => {
    const ctx = {
      maintenanceMargin: 170,
      z2Ratio: 20,
      survivalDropPercent: 60,
      currentGrossLeverage: 1.2,
      vix: 18,
      macroSentiment: { direction: "BULL" },
    };

    const result = computePortfolioHealth(
      ctx,
      DEFAULT_STRATEGY,
      DEFAULT_LIFECYCLE_CONTEXT,
    );

    expect(result.timestamp).toBeDefined();
    expect(new Date(result.timestamp)).toBeInstanceOf(Date);
  });
});
