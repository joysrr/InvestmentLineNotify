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

  return true;
}

// ── 1. 基本資訊 ──────────────────────────────────────────────────
function assertBasicInfo(config) {
  assertString(config.version, "version");
  assertString(config.description, "description");
}

// ── 2. leverage ──────────────────────────────────────────────────
// targetMultiplier 已移除，物件保留供未來擴充
function assertLeverage(config) {
  assert(isObject(config.leverage), "leverage 必須是物件");
}

// ── 3. reserve ───────────────────────────────────────────────────
// allocationRatio 已移除，邏輯由 reserve.tiers 完整承擔
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

  // maxAsset 必須嚴格遞增，確保 tier 查找邏輯正確
  assertOrderedChain(
    config.reserve.tiers.map((t) => t.maxAsset),
    config.reserve.tiers.map((_, i) => `reserve.tiers[${i}].maxAsset`),
  );
}

// ── 4. maintenance ────────────────────────────────────────────────
function assertMaintenance(config) {
  assert(isObject(config.maintenance), "maintenance 必須是物件");
  assertNumber(config.maintenance.protectTrigger, "maintenance.protectTrigger");
  assertNumber(config.maintenance.protectTarget, "maintenance.protectTarget");
  assertNumber(
    config.maintenance.marginCallThreshold,
    "maintenance.marginCallThreshold",
  );
  // frozenZone：v2.4+ 必填欄位
  assertNumber(config.maintenance.frozenZone, "maintenance.frozenZone");
}

// ── 5. grossLeverage ─────────────────────────────────────────────
/**
 * ceiling        {number} 主動擴張上限倍數（例如 2.5）
 * hardCap        {number} 被動危機紅線倍數（例如 3.0）
 * recoveryTarget {number} 強制降槓著陸目標倍數（例如 2.0）
 *
 * 大小關係：recoveryTarget < ceiling < hardCap
 */
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

// ── 6. trading ───────────────────────────────────────────────────
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
}

// ── 7. buy ───────────────────────────────────────────────────────
function assertBuy(config) {
  assert(isObject(config.buy), "buy 必須是物件");
  assertNumber(
    config.buy.minDropPercentToConsider,
    "buy.minDropPercentToConsider",
  );
  assertNumber(config.buy.minWeightScoreToBuy, "buy.minWeightScoreToBuy");

  // dropScoreRules
  assert(
    Array.isArray(config.buy.dropScoreRules),
    "buy.dropScoreRules 必須是陣列",
  );
  config.buy.dropScoreRules.forEach((rule, i) => {
    assertNumber(rule.minDrop, `buy.dropScoreRules[${i}].minDrop`);
    assertNumber(rule.score, `buy.dropScoreRules[${i}].score`);
    assertString(rule.label, `buy.dropScoreRules[${i}].label`);
  });

  // rsi
  assert(isObject(config.buy.rsi), "buy.rsi 必須是物件");
  assertNumber(config.buy.rsi.oversold, "buy.rsi.oversold");
  assertNumber(config.buy.rsi.score, "buy.rsi.score");

  // macd
  assert(isObject(config.buy.macd), "buy.macd 必須是物件");
  assertNumber(config.buy.macd.score, "buy.macd.score");

  // kd
  assert(isObject(config.buy.kd), "buy.kd 必須是物件");
  assertNumber(config.buy.kd.oversoldK, "buy.kd.oversoldK");
  assertOptionalNumbers(
    config.buy.kd,
    ["crossLevelThreshold", "lookbackDays"],
    "buy.kd",
  );
  assertNumber(config.buy.kd.score, "buy.kd.score");

  // panic
  assert(isObject(config.buy.panic), "buy.panic 必須是物件");
  assertNumber(config.buy.panic.minDropRank, "buy.panic.minDropRank");
  assertNumber(config.buy.panic.rsiDivider, "buy.panic.rsiDivider");
  assertString(config.buy.panic.minVixLevel, "buy.panic.minVixLevel");
  assertNumber(
    config.buy.panic.suggestedLeverage,
    "buy.panic.suggestedLeverage",
  );

  // entryGate：選填（v2.4+）
  if (config.buy.entryGate !== undefined) {
    assertBuyEntryGate(config.buy.entryGate);
  }
}

/**
 * @param {object}  eg            buy.entryGate 物件
 * @param {boolean} eg.enabled    是否啟用進場閘門
 * @param {Array}   eg.tiers      進場條件層
 */
function assertBuyEntryGate(eg) {
  assert(isObject(eg), "buy.entryGate 必須是物件");
  assertBoolean(eg.enabled, "buy.entryGate.enabled");
  assert(Array.isArray(eg.tiers), "buy.entryGate.tiers 必須是陣列");

  eg.tiers.forEach((tier, i) => {
    const p = `buy.entryGate.tiers[${i}]`;
    assertNumber(tier.minDrop, `${p}.minDrop`);
    assertNumber(tier.maxDrop, `${p}.maxDrop`);
    // rsiThreshold 允許 number 或 null
    assert(
      tier.rsiThreshold === null ||
        (typeof tier.rsiThreshold === "number" &&
          Number.isFinite(tier.rsiThreshold)),
      `${p}.rsiThreshold 必須是 number 或 null`,
    );
    assertBoolean(tier.allowLeverage, `${p}.allowLeverage`);
  });
}

// ── 8. sell ──────────────────────────────────────────────────────
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

// ── 9. allocation ─────────────────────────────────────────────────
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

  // minScore 必須嚴格遞增，確保 allocation 比對邏輯優先順序正確
  assertOrderedChain(
    config.allocation.map((a) => a.minScore),
    config.allocation.map((_, i) => `allocation[${i}].minScore`),
  );
}

// ── 10. threshold ─────────────────────────────────────────────────
function assertThreshold(config) {
  assert(isObject(config.threshold), "threshold 必須是物件");
  const t = config.threshold;
  const fields = [
    "z2TargetRatio",
    "reversalTriggerCount",
    "mmDanger",
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

// ── valuationGuard（選填，v2.6+） ─────────────────────────────────
/**
 * @param {object}  vg
 * @param {boolean} vg.enabled             是否啟用估值保護
 * @param {number}  vg.minHistoryDays      最低歷史天數門檻
 * @param {Array}   vg.tiers               PR 分位數壓縮層
 * @param {object}  [vg.trailingStop]      追蹤停損壓縮（選填）
 * @param {object}  [vg.panicDrop]         高估區急跌解鎖（選填）
 * @param {object}  [vg.latch]             高估鎖定機制（選填）
 */
function assertValuationGuard(vg) {
  assert(isObject(vg), "valuationGuard 必須是物件");
  assertBoolean(vg.enabled, "valuationGuard.enabled");
  assertNumber(vg.minHistoryDays, "valuationGuard.minHistoryDays");

  // tiers
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

/**
 * @param {object}  ts
 * @param {boolean} ts.enabled                  是否啟用追蹤停損
 * @param {number}  ts.dropFromPeakThreshold    從高點回落比例（例如 0.08 = 8%）
 * @param {number}  ts.multiplierOverride       觸發後套用的壓縮倍率
 */
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

/**
 * @param {object}  pd
 * @param {boolean} pd.enabled                      是否啟用急跌解鎖
 * @param {number}  pd.singleDayDropThreshold       單日跌幅門檻（0–1，例如 0.05）
 * @param {number}  pd.consecutiveDaysThreshold     連續跌日天數門檻
 * @param {number}  pd.consecutiveDayDropThreshold  每日跌幅門檻（0–1，例如 0.03）
 * @param {number}  pd.multiplierOverride           急跌解鎖後套用倍率（通常 1.0）
 */
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

/**
 * @param {object}  latch
 * @param {boolean} latch.enabled               是否啟用高估鎖定
 * @param {number}  latch.triggerPrThreshold    觸發 latch 的 PR 門檻
 * @param {object}  [latch.unlockConditions]    解鎖條件（選填）
 */
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
    /**
     * trendUnlockMa60SlopeThreshold {number}
     * MA60 斜率輔助解鎖門檻，搭配 condition3 使用。
     * 計算方式：calcSlopeN(ma60Arr, N) > threshold 時視為趨勢向上。
     * 例如 0.001 表示每日平均上升 0.1%。
     */
    assertNumber(
      uc.condition3.trendUnlockMa60SlopeThreshold,
      `${base}.trendUnlockMa60SlopeThreshold`,
    );
  }
}

// ── valuationMomentum（選填，v2.6+） ──────────────────────────────
/**
 * @param {object}  vm
 * @param {boolean} vm.enabled                  是否啟用估值動能
 * @param {number}  vm.lookbackDays             回顧天數
 * @param {number}  vm.risingThreshold          上漲門檻
 * @param {number}  vm.fallingThreshold         下跌門檻
 * @param {number}  vm.risingPenaltyMultiplier  上漲懲罰倍率
 * @param {boolean} vm.fallingRelief            下跌時是否提供緩解
 * @param {object}  [vm.highPRZone]             高 PR 區設定（選填）
 */
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

// ── overrideHierarchy（選填，v2.6+） ──────────────────────────────
/**
 * @param {object}  oh
 * @param {boolean} oh.panicBypassEnabled   是否啟用 panic bypass
 * @param {number}  oh.panicBypassDropPct   觸發 bypass 的跌幅百分比
 * @param {number}  oh.panicVixThreshold    觸發 bypass 的 VIX 門檻
 */
function assertOverrideHierarchy(oh) {
  assert(isObject(oh), "overrideHierarchy 必須是物件");
  assertBoolean(oh.panicBypassEnabled, "overrideHierarchy.panicBypassEnabled");
  assertNumber(oh.panicBypassDropPct, "overrideHierarchy.panicBypassDropPct");
  assertNumber(oh.panicVixThreshold, "overrideHierarchy.panicVixThreshold");
}

// ── macroSentiment（選填，向後相容） ──────────────────────────────
/**
 * @param {object}  ms
 * @param {boolean} ms.enabled                    是否啟用總經情緒
 * @param {number}  ms.bullishBonus                多頭加分
 * @param {number}  ms.bearishPenalty              空頭扣分
 * @param {number}  ms.bearishCooldownMultiplier   空頭冷卻倍率
 * @param {number}  [ms.vixOverrideTrigger]        VIX 覆蓋觸發值（選填，v2.5+）
 * @param {number}  [ms.vixAbsoluteOverride]       VIX 絕對覆蓋值（選填，v2.5+）
 */
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

// ── conversionGuard（選填） ──────────────────────────────
/**
 * @param {object}  cg
 * @param {boolean} cg.enabled
 * @param {Array}   cg.tiers       [{ profitPct: 0.3, convertRatio: 0.15 }, ...]
 * @param {Array}   cg.allocation  [{ minMargin: 0, repayRatio: 1.0 }, ...]
 */
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
