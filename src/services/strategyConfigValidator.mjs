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
 * 驗證 Strategy.json 結構與型別是否符合程式期待。
 * - 驗證不過直接 throw，讓上層決定要不要 fallback（例如使用 cache）。
 */
function validateStrategyConfig(strategy) {
  assert(isObject(strategy), "根節點必須是 object");

  // ---- leverage ----
  assert(isObject(strategy.leverage), "leverage 必須存在且為 object");
  assertNumber(strategy.leverage.targetMultiplier, "leverage.targetMultiplier");

  // ---- buy ----
  assert(isObject(strategy.buy), "buy 必須存在且為 object");
  assertNumber(
    strategy.buy.minDropPercentToConsider,
    "buy.minDropPercentToConsider",
  );
  assertNumber(strategy.buy.minWeightScoreToBuy, "buy.minWeightScoreToBuy");

  assert(
    Array.isArray(strategy.buy.dropScoreRules),
    "buy.dropScoreRules 必須是 array",
  );
  assert(strategy.buy.dropScoreRules.length > 0, "buy.dropScoreRules 不可為空");

  strategy.buy.dropScoreRules.forEach((r, i) => {
    assert(isObject(r), `buy.dropScoreRules[${i}] 必須是 object`);
    assertNumber(r.minDrop, `buy.dropScoreRules[${i}].minDrop`);
    assertNumber(r.score, `buy.dropScoreRules[${i}].score`);
    assertString(r.label, `buy.dropScoreRules[${i}].label`);
  });

  assert(isObject(strategy.buy.rsi), "buy.rsi 必須存在且為 object");
  assertNumber(strategy.buy.rsi.oversold, "buy.rsi.oversold");
  assertNumber(strategy.buy.rsi.score, "buy.rsi.score");

  assert(isObject(strategy.buy.macd), "buy.macd 必須存在且為 object");
  assertNumber(strategy.buy.macd.score, "buy.macd.score");

  assert(isObject(strategy.buy.kd), "buy.kd 必須存在且為 object");
  assertNumber(strategy.buy.kd.oversoldK, "buy.kd.oversoldK");
  assertNumber(strategy.buy.kd.score, "buy.kd.score");

  // ---- sell ----
  assert(isObject(strategy.sell), "sell 必須存在且為 object");
  assertNumber(strategy.sell.postAllocationIndexFromEnd, "sell.postAllocationIndexFromEnd");
  assertNumber(strategy.sell.minUpPercentToSell, "sell.minUpPercentToSell");
  assertNumber(strategy.sell.minSignalCountToSell, "sell.minSignalCountToSell");

  assert(isObject(strategy.sell.rsi), "sell.rsi 必須存在且為 object");
  assertNumber(strategy.sell.rsi.overbought, "sell.rsi.overbought");

  assert(isObject(strategy.sell.kd), "sell.kd 必須存在且為 object");
  assertNumber(strategy.sell.kd.overboughtK, "sell.kd.overboughtK");

  // ---- allocation ----
  assert(Array.isArray(strategy.allocation), "allocation 必須是 array");
  assert(strategy.allocation.length > 0, "allocation 不可為空");

  strategy.allocation.forEach((r, i) => {
    assert(isObject(r), `allocation[${i}] 必須是 object`);
    assertNumber(r.minScore, `allocation[${i}].minScore`);
    assertNumber(r.leverage, `allocation[${i}].leverage`);
    assertNumber(r.cash, `allocation[${i}].cash`);
    assert(
      r.leverage >= 0 && r.leverage <= 1,
      `allocation[${i}].leverage 必須在 0~1`,
    );
    assert(r.cash >= 0 && r.cash <= 1, `allocation[${i}].cash 必須在 0~1`);

    // 可選：要求 leverage + cash 必須約等於 1（避免配置寫錯）
    const sum = r.leverage + r.cash;
    assert(
      Math.abs(sum - 1) < 1e-9,
      `allocation[${i}] leverage+cash 必須等於 1`,
    );
  });

  // ---- threshold ----
  assert(isObject(strategy.threshold), "threshold 必須存在且為 object");

  assertNumber(strategy.threshold.z2TargetRatio, "threshold.z2TargetRatio");
  assertNumber(strategy.threshold.reversalTriggerCount, "threshold.reversalTriggerCount");
  assertNumber(strategy.threshold.mmDanger, "threshold.mmDanger");
  assertNumber(strategy.threshold.z2RatioHigh, "threshold.z2RatioHigh");
  assertNumber(strategy.threshold.overheatCount, "threshold.overheatCount");

  // 過熱門檻（用於 overheat state）
  assertNumber(strategy.threshold.rsiOverheatLevel, "threshold.rsiOverheatLevel");
  assertNumber(strategy.threshold.dOverheatLevel, "threshold.dOverheatLevel");
  assertNumber(strategy.threshold.bias240OverheatLevel, "threshold.bias240OverheatLevel");

  // 轉弱/反轉門檻（用於 reversal triggers）
  assertNumber(strategy.threshold.rsiReversalLevel, "threshold.rsiReversalLevel");
  assertNumber(strategy.threshold.kReversalLevel, "threshold.kReversalLevel");

  assertNumber(strategy.threshold.wAggressive, "threshold.wAggressive");
  assertNumber(strategy.threshold.wActive, "threshold.wActive");

  assertNumber(strategy.threshold.vixLowComplacency, "threshold.vixLowComplacency");
  assertNumber(strategy.threshold.vixHighFear, "threshold.vixHighFear");

  // 0~100 類（RSI/KD）
  assert(strategy.threshold.rsiOverheatLevel >= 0 && strategy.threshold.rsiOverheatLevel <= 100, "threshold.rsiOverheatLevel 範圍 0~100");
  assert(strategy.threshold.dOverheatLevel >= 0 && strategy.threshold.dOverheatLevel <= 100, "threshold.dOverheatLevel 範圍 0~100");
  assert(strategy.threshold.rsiReversalLevel >= 0 && strategy.threshold.rsiReversalLevel <= 100, "threshold.rsiReversalLevel 範圍 0~100");
  assert(strategy.threshold.kReversalLevel >= 0 && strategy.threshold.kReversalLevel <= 100, "threshold.kReversalLevel 範圍 0~100");

  // 合理關係：overheat 應 >= reversal（避免門檻顛倒）
  assert(strategy.threshold.rsiOverheatLevel >= strategy.threshold.rsiReversalLevel, "rsiOverheatLevel 必須 >= rsiReversalLevel");
  assert(strategy.threshold.dOverheatLevel >= strategy.threshold.kReversalLevel, "dOverheatLevel 必須 >= kReversalLevel");

  return true;
}

export { validateStrategyConfig };