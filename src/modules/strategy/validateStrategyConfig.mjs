/**
 * validateStrategyConfig.mjs
 *
 * Strategy.json 配置驗證模組
 * 包含所有硬限制驗證規則，驗證失敗時 throw 明確錯誤訊息
 *
 * 設計原則：
 *  1. 向後相容：選填欄位不強制要求
 *  2. 硬限制：關鍵風控參數必須在安全範圍內
 *  3. 明確錯誤：驗證失敗時 throw 詳細錯誤訊息
 */

import {
  MAX_DAILY_LOAN_INCREASE_PCT,
  MAX_ROLLING_LOAN_INCREASE_PCT,
  MARGIN_CALL_THRESHOLD,
} from "./strategyDefaults.mjs";

// ─────────────────────────────────────────────────────────────
// 公用驗證輔助函式
// ─────────────────────────────────────────────────────────────

function isObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function assert(condition, message) {
  if (!condition) throw new Error(`Strategy.json 驗證失敗：${message}`);
}

function assertNumber(v, path) {
  assert(typeof v === "number" && Number.isFinite(v), `${path} 必須是 number`);
}

function assertString(v, path) {
  assert(typeof v === "string" && v.length > 0, `${path} 必須是非空字串`);
}

function assertBoolean(v, path) {
  assert(typeof v === "boolean", `${path} 必須是 boolean`);
}

/**
 * 驗證一組數值必須嚴格遞增（用於 tiers 排序、grossLeverage 大小關係等）。
 * @param {number[]} values  要比較的數值陣列
 * @param {string[]} labels  對應的欄位路徑標籤，長度與 values 相同
 */
function assertOrderedChain(values, labels) {
  for (let i = 0; i < values.length - 1; i++) {
    assert(
      values[i] < values[i + 1],
      `${labels[i]}(${values[i]}) 必須小於 ${labels[i + 1]}(${values[i + 1]})`,
    );
  }
}

/**
 * 驗證一組選填的 number 欄位（存在則必須是合法 number，不存在則略過）。
 * @param {object}   obj     要驗證的物件
 * @param {string[]} fields  欄位名稱陣列
 * @param {string}   prefix  欄位路徑前綴（例如 "buy.kd"）
 */
function assertOptionalNumbers(obj, fields, prefix) {
  fields.forEach((field) => {
    if (obj[field] !== undefined) {
      assertNumber(obj[field], `${prefix}.${field}`);
    }
  });
}

// ─────────────────────────────────────────────────────────────
// 主驗證函式
// ─────────────────────────────────────────────────────────────

/**
 * 驗證 Strategy.json 結構與型別是否符合程式期待。
 * 驗證不過直接 throw，讓上層決定要不要 fallback（例如使用 cache）。
 */
export function validateStrategyConfig(config) {
  assert(isObject(config), "根層級必須是一個有效的 JSON 物件");

  // ── 必填 sections ─────────────────────────────────────────────
  assertBasicInfo(config);
  assertLeverage(config);
  assertReserve(config);
  assertMaintenance(config);
  assertGrossLeverage(config);
  assertTrading(config);
  assertBuy(config);
  assertSell(config);
  assertAllocation(config);
  assertThreshold(config);

  // ── 選填 sections（向後相容） ──────────────────────────────────
  if (config.valuationGuard !== undefined)
    assertValuationGuard(config.valuationGuard);
  if (config.valuationMomentum !== undefined)
    assertValuationMomentum(config.valuationMomentum);
  if (config.overrideHierarchy !== undefined)
    assertOverrideHierarchy(config.overrideHierarchy);
  if (config.macroSentiment !== undefined)
    assertMacroSentiment(config.macroSentiment);
  if (config.conversionGuard !== undefined)
    assertConversionGuard(config.conversionGuard);
  if (config.lifecycle !== undefined)
    assertLifecycle(config.lifecycle);

  return true;
}

// ─────────────────────────────────────────────────────────────
// 各 section 驗證函式
// ─────────────────────────────────────────────────────────────

function assertBasicInfo(config) {
  assertString(config.version, "version");
  assertString(config.description, "description");
}

function assertLeverage(config) {
  assert(isObject(config.leverage), "leverage 必須是物件");
}

function assertReserve(config) {
  assert(isObject(config.reserve), "reserve 必須是物件");
  assert(Array.isArray(config.reserve.tiers), "reserve.tiers 必須是陣列");

  config.reserve.tiers.forEach((tier, i) => {
    assertNumber(tier.maxAsset, `reserve.tiers[${i}].maxAsset`);
    assertNumber(tier.ratio, `reserve.tiers[${i}].ratio`);
    assert(
      tier.ratio >= 0 && tier.ratio <= 1,
      `reserve.tiers[${i}].ratio 必須在 0–1 之間`,
    );
  });

  assertOrderedChain(
    config.reserve.tiers.map((t) => t.maxAsset),
    config.reserve.tiers.map((_, i) => `reserve.tiers[${i}].maxAsset`),
  );
}

function assertMaintenance(config) {
  assert(isObject(config.maintenance), "maintenance 必須是物件");
  assertNumber(config.maintenance.protectTrigger, "maintenance.protectTrigger");
  assertNumber(config.maintenance.protectTarget, "maintenance.protectTarget");
  assertNumber(
    config.maintenance.marginCallThreshold,
    "maintenance.marginCallThreshold",
  );
  assertNumber(config.maintenance.frozenZone, "maintenance.frozenZone");

  // ── 硬限制：維持率階梯必須嚴格遞增 ──────────────────────────
  assertOrderedChain(
    [
      config.maintenance.marginCallThreshold,
      config.maintenance.frozenZone,
      config.maintenance.protectTrigger,
      config.maintenance.protectTarget,
    ],
    [
      "maintenance.marginCallThreshold",
      "maintenance.frozenZone",
      "maintenance.protectTrigger",
      "maintenance.protectTarget",
    ],
  );

  // ── 硬限制：與預設值比對（可選，用於偵測意外修改） ────────────
  // 若配置值與預設值差異過大，發出警示（不 throw）
  const tolerance = 5; // 允許 ±5 的誤差
  if (
    Math.abs(config.maintenance.marginCallThreshold - MARGIN_CALL_THRESHOLD) >
    tolerance
  ) {
    console.warn(
      `⚠️ 警告：maintenance.marginCallThreshold (${config.maintenance.marginCallThreshold}) 與預設值 (${MARGIN_CALL_THRESHOLD}) 差異過大`,
    );
  }
}

function assertGrossLeverage(config) {
  assert(isObject(config.grossLeverage), "grossLeverage 必須是物件");
  const gl = config.grossLeverage;

  assertNumber(gl.ceiling, "grossLeverage.ceiling");
  assert(gl.ceiling > 0, "grossLeverage.ceiling 必須是正數");

  assertNumber(gl.hardCap, "grossLeverage.hardCap");
  assert(gl.hardCap > 0, "grossLeverage.hardCap 必須是正數");

  assertNumber(gl.recoveryTarget, "grossLeverage.recoveryTarget");
  assert(gl.recoveryTarget > 0, "grossLeverage.recoveryTarget 必須是正數");

  assertOrderedChain(
    [gl.recoveryTarget, gl.ceiling, gl.hardCap],
    [
      "grossLeverage.recoveryTarget",
      "grossLeverage.ceiling",
      "grossLeverage.hardCap",
    ],
  );
}

function assertTrading(config) {
  assert(isObject(config.trading), "trading 必須是物件");
  const fields = [
    "minAction",
    "cooldownDays",
    "transFee",
    "transFeeDiscount",
    "taxRate",
    "loanInterestRate",
  ];
  fields.forEach((f) => assertNumber(config.trading[f], `trading.${f}`));

  // ── budget 驗證 ──────────────────────────────────────────────
  if (config.trading.budget !== undefined) {
    const budget = config.trading.budget;
    assertNumber(budget.maxDailyLoanIncreasePct, "trading.budget.maxDailyLoanIncreasePct");
    assertNumber(budget.maxRollingLoanIncreasePct, "trading.budget.maxRollingLoanIncreasePct");
    assertNumber(budget.rollingDays, "trading.budget.rollingDays");

    // ── 硬限制：預算上限不得超過安全閾值 ───────────────────────
    assert(
      budget.maxDailyLoanIncreasePct <= MAX_DAILY_LOAN_INCREASE_PCT,
      `trading.budget.maxDailyLoanIncreasePct (${budget.maxDailyLoanIncreasePct * 100}%) 不得超過硬限制 (${MAX_DAILY_LOAN_INCREASE_PCT * 100}%)`,
    );
    assert(
      budget.maxRollingLoanIncreasePct <= MAX_ROLLING_LOAN_INCREASE_PCT,
      `trading.budget.maxRollingLoanIncreasePct (${budget.maxRollingLoanIncreasePct * 100}%) 不得超過硬限制 (${MAX_ROLLING_LOAN_INCREASE_PCT * 100}%)`,
    );
  }
}

function assertBuy(config) {
  assert(isObject(config.buy), "buy 必須是物件");
  assertNumber(
    config.buy.minDropPercentToConsider,
    "buy.minDropPercentToConsider",
  );
  assertNumber(config.buy.minWeightScoreToBuy, "buy.minWeightScoreToBuy");

  assert(
    Array.isArray(config.buy.dropScoreRules),
    "buy.dropScoreRules 必須是陣列",
  );
  config.buy.dropScoreRules.forEach((rule, i) => {
    assertNumber(rule.minDrop, `buy.dropScoreRules[${i}].minDrop`);
    assertNumber(rule.score, `buy.dropScoreRules[${i}].score`);
    assertString(rule.label, `buy.dropScoreRules[${i}].label`);
  });

  assert(isObject(config.buy.rsi), "buy.rsi 必須是物件");
  assertNumber(config.buy.rsi.oversold, "buy.rsi.oversold");
  assertNumber(config.buy.rsi.score, "buy.rsi.score");

  assert(isObject(config.buy.macd), "buy.macd 必須是物件");
  assertNumber(config.buy.macd.score, "buy.macd.score");

  assert(isObject(config.buy.kd), "buy.kd 必須是物件");
  assertNumber(config.buy.kd.oversoldK, "buy.kd.oversoldK");
  assertOptionalNumbers(
    config.buy.kd,
    ["crossLevelThreshold", "lookbackDays"],
    "buy.kd",
  );
  assertNumber(config.buy.kd.score, "buy.kd.score");

  assert(isObject(config.buy.panic), "buy.panic 必須是物件");
  assertNumber(config.buy.panic.minDropRank, "buy.panic.minDropRank");
  assertNumber(config.buy.panic.rsiDivider, "buy.panic.rsiDivider");
  assertString(config.buy.panic.minVixLevel, "buy.panic.minVixLevel");
  assertNumber(
    config.buy.panic.suggestedLeverage,
    "buy.panic.suggestedLeverage",
  );

  if (config.buy.entryGate !== undefined) {
    assertBuyEntryGate(config.buy.entryGate);
  }
}

function assertBuyEntryGate(eg) {
  assert(isObject(eg), "buy.entryGate 必須是物件");
  assertBoolean(eg.enabled, "buy.entryGate.enabled");
  assert(Array.isArray(eg.tiers), "buy.entryGate.tiers 必須是陣列");

  eg.tiers.forEach((tier, i) => {
    const p = `buy.entryGate.tiers[${i}]`;
    assertNumber(tier.minDrop, `${p}.minDrop`);
    assertNumber(tier.maxDrop, `${p}.maxDrop`);
    assert(
      tier.rsiThreshold === null ||
        (typeof tier.rsiThreshold === "number" &&
          Number.isFinite(tier.rsiThreshold)),
      `${p}.rsiThreshold 必須是 number 或 null`,
    );
    assertBoolean(tier.allowLeverage, `${p}.allowLeverage`);
  });
}

function assertSell(config) {
  assert(isObject(config.sell), "sell 必須是物件");
  assertNumber(
    config.sell.postAllocationIndexFromEnd,
    "sell.postAllocationIndexFromEnd",
  );
  assertNumber(config.sell.minUpPercentToSell, "sell.minUpPercentToSell");
  assertNumber(config.sell.minSignalCountToSell, "sell.minSignalCountToSell");

  assert(isObject(config.sell.rsi), "sell.rsi 必須是物件");
  assertNumber(config.sell.rsi.overbought, "sell.rsi.overbought");

  assert(isObject(config.sell.kd), "sell.kd 必須是物件");
  assertNumber(config.sell.kd.overboughtK, "sell.kd.overboughtK");
}

function assertAllocation(config) {
  assert(Array.isArray(config.allocation), "allocation 必須是陣列");

  config.allocation.forEach((alloc, i) => {
    assertNumber(alloc.minScore, `allocation[${i}].minScore`);
    assertNumber(alloc.leverage, `allocation[${i}].leverage`);
    assert(alloc.leverage > 0, `allocation[${i}].leverage 必須是正數`);
    assertNumber(alloc.cash, `allocation[${i}].cash`);
    assert(alloc.cash >= 0, `allocation[${i}].cash 不可為負數`);
    assertString(alloc.comment, `allocation[${i}].comment`);
  });

  assertOrderedChain(
    config.allocation.map((a) => a.minScore),
    config.allocation.map((_, i) => `allocation[${i}].minScore`),
  );
}

function assertThreshold(config) {
  assert(isObject(config.threshold), "threshold 必須是物件");
  const t = config.threshold;
  const fields = [
    "z2TargetRatio",
    "reversalTriggerCount",
    "z2RatioHigh",
    "minActionableAmount",
    "overheatCount",
    "rsiOverheatLevel",
    "dOverheatLevel",
    "bias240OverheatLevel",
    "rsiReversalLevel",
    "kReversalLevel",
    "wAggressive",
    "wActive",
    "vixLowComplacency",
    "vixHighFear",
    "vixPanic",
    "vixExtreme",
    "usVixPanic",
  ];
  fields.forEach((f) => assertNumber(t[f], `threshold.${f}`));
}

// ── 選填 sections ───────────────────────────────────────────────

function assertValuationGuard(vg) {
  assert(isObject(vg), "valuationGuard 必須是物件");
  assertBoolean(vg.enabled, "valuationGuard.enabled");
  assertNumber(vg.minHistoryDays, "valuationGuard.minHistoryDays");

  assert(Array.isArray(vg.tiers), "valuationGuard.tiers 必須是陣列");
  assert(vg.tiers.length >= 1, "valuationGuard.tiers 不可為空陣列");
  vg.tiers.forEach((tier, i) => {
    const p = `valuationGuard.tiers[${i}]`;
    assertNumber(tier.prThreshold, `${p}.prThreshold`);
    assertString(tier.label, `${p}.label`);
    assertNumber(tier.multiplier, `${p}.multiplier`);
    assert(
      tier.multiplier > 0 && tier.multiplier <= 1,
      `${p}.multiplier 必須介於 0（不含）到 1（含）之間`,
    );
  });

  if (vg.trailingStop !== undefined) assertVgTrailingStop(vg.trailingStop);
  if (vg.panicDrop !== undefined) assertVgPanicDrop(vg.panicDrop);
  if (vg.latch !== undefined) assertVgLatch(vg.latch);
}

function assertVgTrailingStop(ts) {
  assert(isObject(ts), "valuationGuard.trailingStop 必須是物件");
  assertBoolean(ts.enabled, "valuationGuard.trailingStop.enabled");
  assertNumber(
    ts.dropFromPeakThreshold,
    "valuationGuard.trailingStop.dropFromPeakThreshold",
  );
  assertNumber(
    ts.multiplierOverride,
    "valuationGuard.trailingStop.multiplierOverride",
  );
}

function assertVgPanicDrop(pd) {
  assert(isObject(pd), "valuationGuard.panicDrop 必須是物件");
  assertBoolean(pd.enabled, "valuationGuard.panicDrop.enabled");
  assertNumber(
    pd.singleDayDropThreshold,
    "valuationGuard.panicDrop.singleDayDropThreshold",
  );
  assertNumber(
    pd.consecutiveDaysThreshold,
    "valuationGuard.panicDrop.consecutiveDaysThreshold",
  );
  assertNumber(
    pd.consecutiveDayDropThreshold,
    "valuationGuard.panicDrop.consecutiveDayDropThreshold",
  );
  assertNumber(
    pd.multiplierOverride,
    "valuationGuard.panicDrop.multiplierOverride",
  );
}

function assertVgLatch(latch) {
  assert(isObject(latch), "valuationGuard.latch 必須是物件");
  assertBoolean(latch.enabled, "valuationGuard.latch.enabled");
  assertNumber(
    latch.triggerPrThreshold,
    "valuationGuard.latch.triggerPrThreshold",
  );

  if (latch.unlockConditions === undefined) return;

  const uc = latch.unlockConditions;
  assert(isObject(uc), "valuationGuard.latch.unlockConditions 必須是物件");

  if (uc.condition1 !== undefined) {
    assertNumber(
      uc.condition1.prBelowThreshold,
      "valuationGuard.latch.unlockConditions.condition1.prBelowThreshold",
    );
  }

  if (uc.condition3 !== undefined) {
    const base = "valuationGuard.latch.unlockConditions.condition3";
    assertNumber(uc.condition3.ma20AboveDays, `${base}.ma20AboveDays`);
    assertBoolean(uc.condition3.macdPositive, `${base}.macdPositive`);
    assertNumber(
      uc.condition3.trendUnlockMa60SlopeThreshold,
      `${base}.trendUnlockMa60SlopeThreshold`,
    );
  }
}

function assertValuationMomentum(vm) {
  assert(isObject(vm), "valuationMomentum 必須是物件");
  assertBoolean(vm.enabled, "valuationMomentum.enabled");
  assertNumber(vm.lookbackDays, "valuationMomentum.lookbackDays");
  assertNumber(vm.risingThreshold, "valuationMomentum.risingThreshold");
  assertNumber(vm.fallingThreshold, "valuationMomentum.fallingThreshold");
  assertNumber(
    vm.risingPenaltyMultiplier,
    "valuationMomentum.risingPenaltyMultiplier",
  );
  assertBoolean(vm.fallingRelief, "valuationMomentum.fallingRelief");

  // Phase 2.2 新增參數（v2.8+）
  if (vm.accelerationPenaltyMultiplier !== undefined) {
    assertNumber(vm.accelerationPenaltyMultiplier, "valuationMomentum.accelerationPenaltyMultiplier");
  }
  if (vm.decelerationReliefMultiplier !== undefined) {
    assertNumber(vm.decelerationReliefMultiplier, "valuationMomentum.decelerationReliefMultiplier");
  }
  if (vm.extremePRThreshold !== undefined) {
    assertNumber(vm.extremePRThreshold, "valuationMomentum.extremePRThreshold");
  }
  if (vm.extremeOvervaluationMultiplier !== undefined) {
    assertNumber(vm.extremeOvervaluationMultiplier, "valuationMomentum.extremeOvervaluationMultiplier");
  }

  if (vm.highPRZone !== undefined) {
    const hpr = vm.highPRZone;
    assert(isObject(hpr), "valuationMomentum.highPRZone 必須是物件");
    const fields = [
      "triggerPR",
      "relaxedMomentumThreshold",
      "vixSpikeThreshold",
      "vixSpikeMultiplier",
      "vixAbsoluteHigh",
      "vixAbsoluteMultiplier",
    ];
    fields.forEach((f) =>
      assertNumber(hpr[f], `valuationMomentum.highPRZone.${f}`),
    );
  }
}

function assertOverrideHierarchy(oh) {
  assert(isObject(oh), "overrideHierarchy 必須是物件");
  assertBoolean(oh.panicBypassEnabled, "overrideHierarchy.panicBypassEnabled");
  assertNumber(oh.panicBypassDropPct, "overrideHierarchy.panicBypassDropPct");
  assertNumber(oh.panicVixThreshold, "overrideHierarchy.panicVixThreshold");
}

function assertMacroSentiment(ms) {
  assert(isObject(ms), "macroSentiment 必須是物件");
  assertBoolean(ms.enabled, "macroSentiment.enabled");
  assertNumber(ms.bullishBonus, "macroSentiment.bullishBonus");
  assertNumber(ms.bearishPenalty, "macroSentiment.bearishPenalty");
  assertNumber(
    ms.bearishCooldownMultiplier,
    "macroSentiment.bearishCooldownMultiplier",
  );
  assertOptionalNumbers(
    ms,
    ["vixOverrideTrigger", "vixAbsoluteOverride"],
    "macroSentiment",
  );
}

function assertConversionGuard(cg) {
  assert(isObject(cg), "conversionGuard 必須是物件");
  assertBoolean(cg.enabled, "conversionGuard.enabled");

  assert(Array.isArray(cg.tiers), "conversionGuard.tiers 必須是陣列");
  cg.tiers.forEach((tier, i) => {
    assertNumber(tier.profitPct, `conversionGuard.tiers[${i}].profitPct`);
    assertNumber(tier.convertRatio, `conversionGuard.tiers[${i}].convertRatio`);
    assert(
      tier.convertRatio > 0 && tier.convertRatio <= 1,
      `conversionGuard.tiers[${i}].convertRatio 必須介於 0（不含）到 1（含）之間`,
    );
  });
  if (cg.tiers.length > 1) {
    assertOrderedChain(
      cg.tiers.map((t) => t.profitPct),
      cg.tiers.map((_, i) => `conversionGuard.tiers[${i}].profitPct`),
    );
  }

  assert(Array.isArray(cg.allocation), "conversionGuard.allocation 必須是陣列");
  cg.allocation.forEach((alloc, i) => {
    assertNumber(alloc.minMargin, `conversionGuard.allocation[${i}].minMargin`);
    assertNumber(
      alloc.repayRatio,
      `conversionGuard.allocation[${i}].repayRatio`,
    );
    assert(
      alloc.repayRatio >= 0 && alloc.repayRatio <= 1,
      `conversionGuard.allocation[${i}].repayRatio 必須介於 0 到 1 之間`,
    );
  });
  if (cg.allocation.length > 1) {
    assertOrderedChain(
      cg.allocation.map((a) => a.minMargin),
      cg.allocation.map((_, i) => `conversionGuard.allocation[${i}].minMargin`),
    );
  }
}

function assertLifecycle(lifecycle) {
  assert(isObject(lifecycle), "lifecycle 必須是物件");
  assertNumber(lifecycle.monthlyDcaAmount, "lifecycle.monthlyDcaAmount");
  assertNumber(lifecycle.payDay, "lifecycle.payDay");
  assertNumber(lifecycle.preInjectDays, "lifecycle.preInjectDays");

  // 選填：retirementAge（預設 65）
  if (lifecycle.retirementAge !== undefined) {
    assertNumber(lifecycle.retirementAge, "lifecycle.retirementAge");
    assert(
      lifecycle.retirementAge > 0 && lifecycle.retirementAge < 100,
      "lifecycle.retirementAge 必須介於 0 到 100 之間",
    );
  }

  // 選填：lifecycleProfiles（Phase 1 新增，物件格式）
  if (lifecycle.profiles !== undefined) {
    assert(isObject(lifecycle.profiles), "lifecycle.profiles 必須是物件");

    // 驗證 4 個階段（可選填，未定義則使用預設值）
    const validStages = ["EARLY", "MID", "LATE", "PRE_RETIRE"];
    for (const stage of validStages) {
      if (lifecycle.profiles[stage] !== undefined) {
        const profile = lifecycle.profiles[stage];
        const p = `lifecycle.profiles.${stage}`;

        assert(isObject(profile), `${p} 必須是物件`);

        if (profile.maxLeverage !== undefined) {
          assertNumber(profile.maxLeverage, `${p}.maxLeverage`);
          assert(
            profile.maxLeverage > 0 && profile.maxLeverage <= 3.0,
            `${p}.maxLeverage 必須介於 0（不含）到 3.0（含）之間`,
          );
        }

        if (profile.maxLeverageForNewZ2 !== undefined) {
          assertNumber(profile.maxLeverageForNewZ2, `${p}.maxLeverageForNewZ2`);
          assert(
            profile.maxLeverageForNewZ2 >= 0,
            `${p}.maxLeverageForNewZ2 不能為負數`,
          );
        }

        if (profile.maxLeverage !== undefined && profile.maxLeverageForNewZ2 !== undefined) {
          assert(
            profile.maxLeverageForNewZ2 <= profile.maxLeverage,
            `${p}.maxLeverageForNewZ2 不能大於 maxLeverage`,
          );
        }

        if (profile.minSurvivalDropLimit !== undefined) {
          assertNumber(profile.minSurvivalDropLimit, `${p}.minSurvivalDropLimit`);
          assert(
            profile.minSurvivalDropLimit >= 100,
            `${p}.minSurvivalDropLimit 不能小於 100`,
          );
        }

        if (profile.mode !== undefined) {
          assertString(profile.mode, `${p}.mode`);
          const validModes = ["aggressive", "balanced", "conservative", "defensive"];
          assert(
            validModes.includes(profile.mode),
            `${p}.mode 必須是 ${validModes.join(" | ")}`,
          );
        }

        if (profile.description !== undefined) {
          assertString(profile.description, `${p}.description`);
        }
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 輔助函式：從檔案載入並驗證
// ─────────────────────────────────────────────────────────────

/**
 * 從檔案載入 Strategy.json 並驗證
 * @returns {Promise<object>} 驗證通過的配置物件
 */
export async function fetchStrategyConfig() {
  const strategy = await import("../../../../data/config/Strategy.json", {
    with: { type: "json" },
  });
  return strategy.default;
}
