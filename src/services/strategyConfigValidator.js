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

  // ---- buy ----
  assert(isObject(strategy.buy), "buy 必須存在且為 object");
  assertNumber(strategy.buy.minDropPercentToConsider, "buy.minDropPercentToConsider");
  assertNumber(strategy.buy.minWeightScoreToBuy, "buy.minWeightScoreToBuy");

  assert(Array.isArray(strategy.buy.dropScoreRules), "buy.dropScoreRules 必須是 array");
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
    assert(r.leverage >= 0 && r.leverage <= 1, `allocation[${i}].leverage 必須在 0~1`);
    assert(r.cash >= 0 && r.cash <= 1, `allocation[${i}].cash 必須在 0~1`);

    // 可選：要求 leverage + cash 必須約等於 1（避免配置寫錯）
    const sum = r.leverage + r.cash;
    assert(Math.abs(sum - 1) < 1e-9, `allocation[${i}] leverage+cash 必須等於 1`);
  });

  // ---- 額外：dropScoreRules 建議由大到小（非強制，但可避免誤判）----
  for (let i = 1; i < strategy.buy.dropScoreRules.length; i++) {
    const prev = strategy.buy.dropScoreRules[i - 1].minDrop;
    const curr = strategy.buy.dropScoreRules[i].minDrop;
    assert(prev >= curr, "buy.dropScoreRules 建議依 minDrop 由大到小排序（避免較小門檻先匹配）");
  }

  return true;
}

module.exports = { validateStrategyConfig };
