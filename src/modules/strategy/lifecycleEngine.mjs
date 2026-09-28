/**
 * lifecycleEngine.mjs
 *
 * 生命週期槓桿引擎
 * 計算 yearsToRetirement 與生命週期階段判定
 *
 * 生命週期階段（修正：最高槓桿 2.0x，符合 00675L 工具限制）：
 *  - EARLY: yearsToRetirement > 15 年（槓桿上限 2.0x）
 *  - MID: 10 < yearsToRetirement <= 15 年（槓桿上限 2.0x）
 *  - LATE: 5 < yearsToRetirement <= 10 年（槓桿上限 1.5x）
 *  - PRE_RETIRE: yearsToRetirement <= 5 年（槓桿上限 1.0x）
 */

/**
 * 生命週期階段枚举
 */
export const LIFECYCLE_STAGE = {
  EARLY: "EARLY",
  MID: "MID",
  LATE: "LATE",
  PRE_RETIRE: "PRE_RETIRE",
};

/**
 * 預設生命週期配置（若 Strategy.json 未定義）
 * 修正：最高槓桿 2.0x，符合 00675L 工具限制（2 倍槓桿 ETF）
 */
export const DEFAULT_LIFECYCLE_PROFILES = {
  [LIFECYCLE_STAGE.EARLY]: {
    maxLeverage: 2.0, // 修正：從 2.5 降至 2.0（00675L 僅 2 倍槓桿）
    maxLeverageForNewZ2: 1.5,
    minSurvivalDropLimit: 140,
    mode: "aggressive",
    description: "退休前 15 年以上，槓桿空間最大（上限 2.0x）",
  },
  [LIFECYCLE_STAGE.MID]: {
    maxLeverage: 2.0,
    maxLeverageForNewZ2: 1.5,
    minSurvivalDropLimit: 145,
    mode: "balanced",
    description: "退休前 10-15 年，穩健成長",
  },
  [LIFECYCLE_STAGE.LATE]: {
    maxLeverage: 1.5,
    maxLeverageForNewZ2: 1.0,
    minSurvivalDropLimit: 150,
    mode: "conservative",
    description: "退休前 5-10 年，逐步保守",
  },
  [LIFECYCLE_STAGE.PRE_RETIRE]: {
    maxLeverage: 1.0,
    maxLeverageForNewZ2: 0.5,
    minSurvivalDropLimit: 160,
    mode: "defensive",
    description: "退休前 5 年以內，極度保守",
  },
};

/**
 * 階段閾值（年）
 */
export const LIFECYCLE_THRESHOLDS = {
  EARLY_MAX: 999, // 無上限
  MID_MAX: 15,
  LATE_MAX: 10,
  PRE_RETIRE_MAX: 5,
};

/**
 * 計算距離退休的年數
 * @param {number} currentAge - 當前年齡
 * @param {number} retirementAge - 退休年齡（預設 65）
 * @returns {number} yearsToRetirement（負數表示已退休）
 */
export function computeYearsToRetirement(currentAge, retirementAge = 65) {
  return retirementAge - currentAge;
}

/**
 * 根據距離退休年數判定生命週期階段
 * @param {number} yearsToRetirement - 距離退休年數
 * @returns {string} 生命週期階段（EARLY / MID / LATE / PRE_RETIRE）
 */
export function determineLifecycleStage(yearsToRetirement) {
  if (yearsToRetirement > LIFECYCLE_THRESHOLDS.MID_MAX) {
    return LIFECYCLE_STAGE.EARLY;
  } else if (yearsToRetirement > LIFECYCLE_THRESHOLDS.LATE_MAX) {
    return LIFECYCLE_STAGE.MID;
  } else if (yearsToRetirement > LIFECYCLE_THRESHOLDS.PRE_RETIRE_MAX) {
    return LIFECYCLE_STAGE.LATE;
  } else {
    return LIFECYCLE_STAGE.PRE_RETIRE;
  }
}

/**
 * 獲取生命週期階段的槓桿配置
 * @param {string} stage - 生命週期階段
 * @param {Object} lifecycleProfiles - Strategy.json 中的 lifecycleProfiles（可選）
 * @returns {Object} 該階段的槓桿配置
 */
export function getLifecycleProfile(stage, lifecycleProfiles = null) {
  const profiles = lifecycleProfiles || DEFAULT_LIFECYCLE_PROFILES;
  return profiles[stage] || DEFAULT_LIFECYCLE_PROFILES[stage];
}

/**
 * 計算當前生命週期上下文（整合年齡、階段、槓桿配置）
 * @param {number} currentAge - 當前年齡
 * @param {number} retirementAge - 退休年齡（預設 65）
 * @param {Object} lifecycleProfiles - Strategy.json 中的 lifecycleProfiles（可選）
 * @returns {{
 *   currentAge: number,
 *   retirementAge: number,
 *   yearsToRetirement: number,
 *   stage: string,
 *   profile: Object,
 *   description: string
 * }}
 * @throws {Error} currentAge 非有效數值時拋出錯誤（MED-001 修正）
 */
export function computeLifecycleContext(
  currentAge,
  retirementAge = 65,
  lifecycleProfiles = null,
) {
  // MED-001 修正：加入參數驗證
  if (typeof currentAge !== "number" || isNaN(currentAge)) {
    throw new Error(
      `computeLifecycleContext: currentAge 必須是有效數值，收到: ${currentAge}`,
    );
  }
  if (typeof retirementAge !== "number" || isNaN(retirementAge)) {
    throw new Error(
      `computeLifecycleContext: retirementAge 必須是有效數值，收到: ${retirementAge}`,
    );
  }

  const yearsToRetirement = computeYearsToRetirement(currentAge, retirementAge);
  const stage = determineLifecycleStage(yearsToRetirement);
  const profile = getLifecycleProfile(stage, lifecycleProfiles);

  return {
    currentAge,
    retirementAge,
    yearsToRetirement,
    stage,
    profile,
    description: `${stage} - ${profile.description}`,
  };
}

/**
 * 驗證生命週期配置的有效性
 * @param {Object} lifecycleProfiles - 生命週期配置
 * @returns {boolean} 配置是否有效
 * @throws {Error} 配置無效時拋出錯誤
 */
export function validateLifecycleProfiles(lifecycleProfiles) {
  if (!lifecycleProfiles) return true; // 可選配置

  const requiredStages = Object.values(LIFECYCLE_STAGE);
  for (const stage of requiredStages) {
    const profile = lifecycleProfiles[stage];
    if (!profile) continue; // 允許部分定義，使用預設值補全

    if (
      profile.maxLeverage != null &&
      (profile.maxLeverage < 0 || profile.maxLeverage > 3.0)
    ) {
      throw new Error(
        `lifecycleProfiles.${stage}.maxLeverage 必須在 0-3.0 之間`,
      );
    }
    if (
      profile.maxLeverageForNewZ2 != null &&
      profile.maxLeverageForNewZ2 < 0
    ) {
      throw new Error(
        `lifecycleProfiles.${stage}.maxLeverageForNewZ2 不能為負數`,
      );
    }
    if (
      profile.maxLeverageForNewZ2 != null &&
      profile.maxLeverage != null &&
      profile.maxLeverageForNewZ2 > profile.maxLeverage
    ) {
      throw new Error(
        `lifecycleProfiles.${stage}.maxLeverageForNewZ2 不能大於 maxLeverage`,
      );
    }
  }

  return true;
}

// ─────────────────────────────────────────────────────────────
// 測試入口（node lifecycleEngine.mjs --test）
// ─────────────────────────────────────────────────────────────

if (process.argv.includes("--test")) {
  console.log("=== Lifecycle Engine 測試 ===\n");

  // 測試 computeYearsToRetirement
  console.log("1. computeYearsToRetirement:");
  console.log(`   30 歲，退休 65 歲：${computeYearsToRetirement(30)}年`);
  console.log(`   50 歲，退休 65 歲：${computeYearsToRetirement(50)}年`);
  console.log(`   65 歲，退休 65 歲：${computeYearsToRetirement(65)}年`);
  console.log(`   70 歲，退休 65 歲：${computeYearsToRetirement(70)}年\n`);

  // 測試 determineLifecycleStage
  console.log("2. determineLifecycleStage:");
  console.log(`   20 年：${determineLifecycleStage(20)}`);
  console.log(`   12 年：${determineLifecycleStage(12)}`);
  console.log(`   7 年：${determineLifecycleStage(7)}`);
  console.log(`   3 年：${determineLifecycleStage(3)}\n`);

  // 測試 computeLifecycleContext
  console.log("3. computeLifecycleContext:");
  const context = computeLifecycleContext(35);
  console.log(`   35 歲：${JSON.stringify(context, null, 2)}\n`);

  console.log("✅ 測試完成");
}
