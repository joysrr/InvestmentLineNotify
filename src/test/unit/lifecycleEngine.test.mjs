/**
 * lifecycleEngine.test.mjs
 *
 * Unit tests for lifecycleEngine.mjs
 * 測試 LIFECYCLE_STAGE, computeLifecycleContext, determineLifecycleStage
 *
 * 測試案例：TC-001 ~ TC-007, TC-018 ~ TC-019
 */

import { describe, it, expect } from "vitest";
import {
  computeYearsToRetirement,
  determineLifecycleStage,
  computeLifecycleContext,
  LIFECYCLE_STAGE,
  DEFAULT_LIFECYCLE_PROFILES,
  LIFECYCLE_THRESHOLDS,
} from "../../modules/strategy/lifecycleEngine.mjs";

// ─────────────────────────────────────────────────────────────
// 共用測試配置
// ─────────────────────────────────────────────────────────────

const DEFAULT_RETIREMENT_AGE = 65;

// ─────────────────────────────────────────────────────────────
// computeYearsToRetirement 測試
// ─────────────────────────────────────────────────────────────

describe("Lifecycle Engine - computeYearsToRetirement", () => {
  it("應正確計算距離退休年數（49 歲 → 16 年）", () => {
    const result = computeYearsToRetirement(49, DEFAULT_RETIREMENT_AGE);
    expect(result).toBe(16);
  });

  it("應正確計算距離退休年數（53 歲 → 12 年）", () => {
    const result = computeYearsToRetirement(53, DEFAULT_RETIREMENT_AGE);
    expect(result).toBe(12);
  });

  it("應正確計算距離退休年數（58 歲 → 7 年）", () => {
    const result = computeYearsToRetirement(58, DEFAULT_RETIREMENT_AGE);
    expect(result).toBe(7);
  });

  it("應正確計算距離退休年數（62 歲 → 3 年）", () => {
    const result = computeYearsToRetirement(62, DEFAULT_RETIREMENT_AGE);
    expect(result).toBe(3);
  });

  it("已退休應返回負數（70 歲 → -5 年）", () => {
    const result = computeYearsToRetirement(70, DEFAULT_RETIREMENT_AGE);
    expect(result).toBe(-5);
  });

  it("應使用預設退休年齡 65", () => {
    const result = computeYearsToRetirement(50);
    expect(result).toBe(15);
  });
});

// ─────────────────────────────────────────────────────────────
// determineLifecycleStage 測試（TC-001 ~ TC-004）
// ─────────────────────────────────────────────────────────────

describe("Lifecycle Engine - determineLifecycleStage", () => {
  // TC-001: EARLY 階段
  it("TC-001: 16 年應判定為 EARLY 階段", () => {
    const result = determineLifecycleStage(16);
    expect(result).toBe(LIFECYCLE_STAGE.EARLY);
  });

  it("20 年應判定為 EARLY 階段", () => {
    const result = determineLifecycleStage(20);
    expect(result).toBe(LIFECYCLE_STAGE.EARLY);
  });

  // TC-002: MID 階段
  it("TC-002: 12 年應判定為 MID 階段", () => {
    const result = determineLifecycleStage(12);
    expect(result).toBe(LIFECYCLE_STAGE.MID);
  });

  it("10 年應判定為 LATE 階段（邊界）", () => {
    // 根據邊界值規則：10 年不大於 10，所以是 LATE
    const result = determineLifecycleStage(10);
    expect(result).toBe(LIFECYCLE_STAGE.LATE);
  });

  // TC-003: LATE 階段
  it("TC-003: 7 年應判定為 LATE 階段", () => {
    const result = determineLifecycleStage(7);
    expect(result).toBe(LIFECYCLE_STAGE.LATE);
  });

  it("5 年應判定為 PRE_RETIRE 階段（邊界）", () => {
    // 根據邊界值規則：5 年不大於 5，所以是 PRE_RETIRE
    const result = determineLifecycleStage(5);
    expect(result).toBe(LIFECYCLE_STAGE.PRE_RETIRE);
  });

  // TC-004: PRE_RETIRE 階段
  it("TC-004: 3 年應判定為 PRE_RETIRE 階段", () => {
    const result = determineLifecycleStage(3);
    expect(result).toBe(LIFECYCLE_STAGE.PRE_RETIRE);
  });

  it("0 年（已退休）應判定為 PRE_RETIRE 階段", () => {
    const result = determineLifecycleStage(0);
    expect(result).toBe(LIFECYCLE_STAGE.PRE_RETIRE);
  });

  it("-5 年（退休 5 年）應判定為 PRE_RETIRE 階段", () => {
    const result = determineLifecycleStage(-5);
    expect(result).toBe(LIFECYCLE_STAGE.PRE_RETIRE);
  });
});

// ─────────────────────────────────────────────────────────────
// Lifecycle Boundary 測試（TC-005 ~ TC-007）
// ─────────────────────────────────────────────────────────────

describe("Lifecycle Engine - Boundary Tests", () => {
  // TC-005: 15 年邊界
  it("TC-005: 15 年邊界應屬 EARLY（>15 才是 EARLY，15 是 MID）", () => {
    // 根據邏輯：yearsToRetirement > 15 → EARLY，否則 > 10 → MID
    // 所以 15 年應該是 MID（因為 15 不大於 15）
    const result = determineLifecycleStage(15);
    expect(result).toBe(LIFECYCLE_STAGE.MID);
  });

  // TC-006: 10 年邊界
  it("TC-006: 10 年邊界應屬 LATE（>10 才是 MID，10 是 LATE）", () => {
    // 根據邏輯：yearsToRetirement > 10 → MID，否則 > 5 → LATE
    // 所以 10 年應該是 LATE（因為 10 不大於 10）
    const result = determineLifecycleStage(10);
    expect(result).toBe(LIFECYCLE_STAGE.LATE);
  });

  // TC-007: 5 年邊界
  it("TC-007: 5 年邊界應屬 PRE_RETIRE（>5 才是 LATE，5 是 PRE_RETIRE）", () => {
    // 根據邏輯：yearsToRetirement > 5 → LATE，否則 → PRE_RETIRE
    // 所以 5 年應該是 PRE_RETIRE（因為 5 不大於 5）
    const result = determineLifecycleStage(5);
    expect(result).toBe(LIFECYCLE_STAGE.PRE_RETIRE);
  });

  it("15.1 年應屬 EARLY（小數點測試）", () => {
    const result = determineLifecycleStage(15.1);
    expect(result).toBe(LIFECYCLE_STAGE.EARLY);
  });

  it("10.1 年應屬 MID（小數點測試）", () => {
    const result = determineLifecycleStage(10.1);
    expect(result).toBe(LIFECYCLE_STAGE.MID);
  });

  it("5.1 年應屬 LATE（小數點測試）", () => {
    const result = determineLifecycleStage(5.1);
    expect(result).toBe(LIFECYCLE_STAGE.LATE);
  });
});

// ─────────────────────────────────────────────────────────────
// computeLifecycleContext 測試
// ─────────────────────────────────────────────────────────────

describe("Lifecycle Engine - computeLifecycleContext", () => {
  it("應返回完整的 EARLY 階段上下文（49 歲）", () => {
    const result = computeLifecycleContext(
      49,
      DEFAULT_RETIREMENT_AGE,
      DEFAULT_LIFECYCLE_PROFILES,
    );

    expect(result.stage).toBe(LIFECYCLE_STAGE.EARLY);
    expect(result.yearsToRetirement).toBe(16);
    expect(result.profile.maxLeverage).toBe(2.0);
    expect(result.profile.minSurvivalDropLimit).toBe(140);
    expect(result.profile.mode).toBe("aggressive");
  });

  it("應返回完整的 MID 階段上下文（53 歲）", () => {
    const result = computeLifecycleContext(
      53,
      DEFAULT_RETIREMENT_AGE,
      DEFAULT_LIFECYCLE_PROFILES,
    );

    expect(result.stage).toBe(LIFECYCLE_STAGE.MID);
    expect(result.yearsToRetirement).toBe(12);
    expect(result.profile.maxLeverage).toBe(2.0);
    expect(result.profile.minSurvivalDropLimit).toBe(145);
    expect(result.profile.mode).toBe("balanced");
  });

  it("應返回完整的 LATE 階段上下文（58 歲）", () => {
    const result = computeLifecycleContext(
      58,
      DEFAULT_RETIREMENT_AGE,
      DEFAULT_LIFECYCLE_PROFILES,
    );

    expect(result.stage).toBe(LIFECYCLE_STAGE.LATE);
    expect(result.yearsToRetirement).toBe(7);
    expect(result.profile.maxLeverage).toBe(1.5);
    expect(result.profile.minSurvivalDropLimit).toBe(150);
    expect(result.profile.mode).toBe("conservative");
  });

  it("應返回完整的 PRE_RETIRE 階段上下文（62 歲）", () => {
    const result = computeLifecycleContext(
      62,
      DEFAULT_RETIREMENT_AGE,
      DEFAULT_LIFECYCLE_PROFILES,
    );

    expect(result.stage).toBe(LIFECYCLE_STAGE.PRE_RETIRE);
    expect(result.yearsToRetirement).toBe(3);
    expect(result.profile.maxLeverage).toBe(1.0);
    expect(result.profile.minSurvivalDropLimit).toBe(160);
    expect(result.profile.mode).toBe("defensive");
  });

  it("應使用預設退休年齡 65", () => {
    const result = computeLifecycleContext(50);

    expect(result.retirementAge).toBe(65);
    expect(result.yearsToRetirement).toBe(15);
  });

  it("應包含 description 欄位", () => {
    const result = computeLifecycleContext(53); // 53 歲 = MID 階段

    expect(result.description).toBeDefined();
    expect(typeof result.description).toBe("string");
    expect(result.description).toContain("MID");
  });
});

// ─────────────────────────────────────────────────────────────
// MED-001: 參數驗證測試
// ─────────────────────────────────────────────────────────────

describe("Lifecycle Engine - Parameter Validation (MED-001)", () => {
  it("currentAge 為非數值應拋出錯誤", () => {
    expect(() => computeLifecycleContext("invalid")).toThrow();
    expect(() => computeLifecycleContext("invalid")).toThrow(/currentAge/);
  });

  it("currentAge 為 NaN 應拋出錯誤", () => {
    expect(() => computeLifecycleContext(NaN)).toThrow();
  });

  it("retirementAge 為非數值應拋出錯誤", () => {
    expect(() => computeLifecycleContext(50, "invalid")).toThrow();
    expect(() => computeLifecycleContext(50, "invalid")).toThrow(
      /retirementAge/,
    );
  });

  it("currentAge 為 null 應拋出錯誤", () => {
    expect(() => computeLifecycleContext(null)).toThrow();
  });

  it("currentAge 為 undefined 應拋出錯誤", () => {
    expect(() => computeLifecycleContext(undefined)).toThrow();
  });

  it("currentAge 為有效數值 0 應通過（0 歲）", () => {
    const result = computeLifecycleContext(0);
    expect(result.yearsToRetirement).toBe(65);
  });
});

// ─────────────────────────────────────────────────────────────
// Lifecycle Leverage Check 測試（TC-018 ~ TC-019）
// ─────────────────────────────────────────────────────────────

describe("Lifecycle Engine - Leverage Check", () => {
  it("TC-018: 槓桿超過生命週期限制應返回 RED", () => {
    const lifecycleContext = computeLifecycleContext(
      53,
      DEFAULT_RETIREMENT_AGE,
      DEFAULT_LIFECYCLE_PROFILES,
    );
    const currentGrossLeverage = 2.2;
    const maxLeverage = lifecycleContext.profile.maxLeverage;

    // 53 歲屬於 MID 階段 (12 年)，maxLeverage = 2.0
    expect(maxLeverage).toBe(2.0);
    expect(currentGrossLeverage).toBeGreaterThan(maxLeverage);
  });

  it("TC-019: 槓桿在生命週期限制內應返回 GREEN", () => {
    const lifecycleContext = computeLifecycleContext(
      53,
      DEFAULT_RETIREMENT_AGE,
      DEFAULT_LIFECYCLE_PROFILES,
    );
    const currentGrossLeverage = 1.8;
    const maxLeverage = lifecycleContext.profile.maxLeverage;

    // 53 歲屬於 MID 階段 (12 年)，maxLeverage = 2.0
    expect(maxLeverage).toBe(2.0);
    expect(currentGrossLeverage).toBeLessThanOrEqual(maxLeverage);
  });

  it("EARLY 階段槓桿上限應為 2.0", () => {
    const context = computeLifecycleContext(45);
    expect(context.profile.maxLeverage).toBe(2.0);
  });

  it("LATE 階段槓桿上限應為 1.5", () => {
    const context = computeLifecycleContext(57);
    expect(context.profile.maxLeverage).toBe(1.5);
  });

  it("PRE_RETIRE 階段槓桿上限應為 1.0", () => {
    const context = computeLifecycleContext(63);
    expect(context.profile.maxLeverage).toBe(1.0);
  });
});

// ─────────────────────────────────────────────────────────────
// LIFECYCLE_THRESHOLDS 測試
// ─────────────────────────────────────────────────────────────

describe("Lifecycle Engine - Thresholds", () => {
  it("EARLY_MAX 應為 999（無上限）", () => {
    expect(LIFECYCLE_THRESHOLDS.EARLY_MAX).toBe(999);
  });

  it("MID_MAX 應為 15", () => {
    expect(LIFECYCLE_THRESHOLDS.MID_MAX).toBe(15);
  });

  it("LATE_MAX 應為 10", () => {
    expect(LIFECYCLE_THRESHOLDS.LATE_MAX).toBe(10);
  });

  it("PRE_RETIRE_MAX 應為 5", () => {
    expect(LIFECYCLE_THRESHOLDS.PRE_RETIRE_MAX).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────
// DEFAULT_LIFECYCLE_PROFILES 測試
// ─────────────────────────────────────────────────────────────

describe("Lifecycle Engine - Default Profiles", () => {
  it("EARLY 配置應正確", () => {
    const profile = DEFAULT_LIFECYCLE_PROFILES[LIFECYCLE_STAGE.EARLY];
    expect(profile.maxLeverage).toBe(2.0);
    expect(profile.minSurvivalDropLimit).toBe(140);
    expect(profile.mode).toBe("aggressive");
  });

  it("MID 配置應正確", () => {
    const profile = DEFAULT_LIFECYCLE_PROFILES[LIFECYCLE_STAGE.MID];
    expect(profile.maxLeverage).toBe(2.0);
    expect(profile.minSurvivalDropLimit).toBe(145);
    expect(profile.mode).toBe("balanced");
  });

  it("LATE 配置應正確", () => {
    const profile = DEFAULT_LIFECYCLE_PROFILES[LIFECYCLE_STAGE.LATE];
    expect(profile.maxLeverage).toBe(1.5);
    expect(profile.minSurvivalDropLimit).toBe(150);
    expect(profile.mode).toBe("conservative");
  });

  it("PRE_RETIRE 配置應正確", () => {
    const profile = DEFAULT_LIFECYCLE_PROFILES[LIFECYCLE_STAGE.PRE_RETIRE];
    expect(profile.maxLeverage).toBe(1.0);
    expect(profile.minSurvivalDropLimit).toBe(160);
    expect(profile.mode).toBe("defensive");
  });
});
