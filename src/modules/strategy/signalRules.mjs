import {
  calculateIndicators,
  last2,
  crossUpLevel,
  crossDownLevel,
  roseAboveAfterBelow,
  fellBelowAfterAbove,
  wasAboveLevel,
  wasBelowLevel,
  macdCrossUp,
  macdCrossDown,
  kdCrossDown,
  kdCrossUp,
  lastKD,
  kdSeries,
  getMACDSignal,
} from "./indicators.mjs";
import { archiveManager } from "../data/archiveManager.mjs";

const STRATEGY_URL = process.env.STRATEGY_URL;

/* 記憶體暫存 */
let _cache = {
  url: null,
  strategy: null,
  loadedAt: null,
};

export async function fetchStrategyConfig() {
  if (!STRATEGY_URL) {
    throw new Error("缺少 STRATEGY_URL 環境變數，無法載入 Strategy.json");
  }

  if (_cache.url === STRATEGY_URL && _cache.strategy) {
    return _cache.strategy;
  }

  try {
    const res = await fetch(STRATEGY_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 strategy-client",
        Accept: "application/json",
      },
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `Strategy.json HTTP ${res.status}: ${text.slice(0, 200)}`,
      );
    }

    let json = null;
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.log(`Strategy.json 解析失敗：${e.message}`, text);
      throw new Error(`Strategy.json 解析失敗：${e.message}`);
    }

    // ✅ 先驗證再寫入 cache
    validateStrategyConfig(json);

    _cache = {
      url: STRATEGY_URL,
      strategy: json,
      loadedAt: new Date(),
    };

    // 驗證通過後同步備份至本地
    await archiveManager.saveStrategyCache(json);

    return json;
  } catch (err) {
    // 第一層：記憶體 cache
    if (_cache.strategy) {
      console.warn(`⚠️ [Strategy] 遠端載入失敗，使用記憶體 cache (v${_cache.strategy.version}):`, err.message);
      return _cache.strategy;
    }

    // 第二層：本地檔案 cache
    const localCache = await archiveManager.getStrategyCache();
    if (localCache) {
      console.warn(
        `⚠️ [Strategy] 記憶體無可用，使用本地備份 (v${localCache.version}):`,
        err.message
      );
      // 回寫記憶體避免下次再讀檔案
      _cache = { url: STRATEGY_URL, strategy: localCache, loadedAt: new Date() };
      return localCache;
    }

    throw err;
  }
}

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
export function validateStrategyConfig(config) {
  assert(isObject(config), "根層級必須是一個有效的 JSON 物件");

  // 1. 基本資訊
  assertString(config.version, "version");
  assertString(config.description, "description");

  // 2. leverage
  assert(isObject(config.leverage), "leverage 必須是物件");
  assertNumber(config.leverage.targetMultiplier, "leverage.targetMultiplier");

  // 3. reserve
  assert(isObject(config.reserve), "reserve 必須是物件");
  assertNumber(config.reserve.allocationRatio, "reserve.allocationRatio");
  assert(Array.isArray(config.reserve.tiers), "reserve.tiers 必須是陣列");
  config.reserve.tiers.forEach((tier, i) => {
    assertNumber(tier.maxAsset, `reserve.tiers[${i}].maxAsset`);
    assertNumber(tier.ratio, `reserve.tiers[${i}].ratio`);
  });

  // 4. maintenance
  assert(isObject(config.maintenance), "maintenance 必須是物件");
  assertNumber(config.maintenance.protectTrigger, "maintenance.protectTrigger");
  assertNumber(config.maintenance.protectTarget, "maintenance.protectTarget");
  assertNumber(
    config.maintenance.marginCallThreshold,
    "maintenance.marginCallThreshold",
  );

  // 5. trading
  assert(isObject(config.trading), "trading 必須是物件");
  assertNumber(config.trading.minAction, "trading.minAction");
  assertNumber(config.trading.cooldownDays, "trading.cooldownDays");
  assertNumber(config.trading.transFee, "trading.transFee");
  assertNumber(config.trading.transFeeDiscount, "trading.transFeeDiscount");
  assertNumber(config.trading.taxRate, "trading.taxRate");
  assertNumber(config.trading.loanInterestRate, "trading.loanInterestRate");

  // 6. buy
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
  assertNumber(config.buy.kd.score, "buy.kd.score");

  assert(isObject(config.buy.panic), "buy.panic 必須是物件");
  assertNumber(config.buy.panic.minDropRank, "buy.panic.minDropRank");
  assertNumber(config.buy.panic.rsiDivider, "buy.panic.rsiDivider");
  assertString(config.buy.panic.minVixLevel, "buy.panic.minVixLevel");
  assertNumber(
    config.buy.panic.suggestedLeverage,
    "buy.panic.suggestedLeverage",
  );

  // 7. sell
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

  // 8. allocation
  assert(Array.isArray(config.allocation), "allocation 必須是陣列");
  config.allocation.forEach((alloc, i) => {
    assertNumber(alloc.minScore, `allocation[${i}].minScore`);
    assertNumber(alloc.leverage, `allocation[${i}].leverage`);
    assertNumber(alloc.cash, `allocation[${i}].cash`);
    assertString(alloc.comment, `allocation[${i}].comment`);
  });

  // 9. threshold
  assert(isObject(config.threshold), "threshold 必須是物件");
  const t = config.threshold;
  assertNumber(t.z2TargetRatio, "threshold.z2TargetRatio");
  assertNumber(t.reversalTriggerCount, "threshold.reversalTriggerCount");
  assertNumber(t.mmDanger, "threshold.mmDanger");
  assertNumber(t.z2RatioHigh, "threshold.z2RatioHigh");
  assertNumber(t.minActionableAmount, "threshold.minActionableAmount");
  assertNumber(t.overheatCount, "threshold.overheatCount");
  assertNumber(t.rsiOverheatLevel, "threshold.rsiOverheatLevel");
  assertNumber(t.dOverheatLevel, "threshold.dOverheatLevel");
  assertNumber(t.bias240OverheatLevel, "threshold.bias240OverheatLevel");
  assertNumber(t.rsiReversalLevel, "threshold.rsiReversalLevel");
  assertNumber(t.kReversalLevel, "threshold.kReversalLevel");
  assertNumber(t.wAggressive, "threshold.wAggressive");
  assertNumber(t.wActive, "threshold.wActive");
  assertNumber(t.vixLowComplacency, "threshold.vixLowComplacency");
  assertNumber(t.vixHighFear, "threshold.vixHighFear");
  assertNumber(t.vixPanic, "threshold.vixPanic");
  assertNumber(t.vixExtreme, "threshold.vixExtreme");
  assertNumber(t.usVixPanic, "threshold.usVixPanic");

  // 10. macroSentiment（選填，向後相容）
  if (config.macroSentiment !== undefined) {
    assert(
      isObject(config.macroSentiment),
      "macroSentiment 必須是物件",
    );
    assertBoolean(config.macroSentiment.enabled, "macroSentiment.enabled");
    assertNumber(config.macroSentiment.bullishBonus, "macroSentiment.bullishBonus");
    assertNumber(config.macroSentiment.bearishPenalty, "macroSentiment.bearishPenalty");
    assertNumber(
      config.macroSentiment.bearishCooldownMultiplier,
      "macroSentiment.bearishCooldownMultiplier",
    );
  }

  return true;
}

/**
 * 轉多權重計算
 * @param {Object} data - 市場資料
 * @param {number} priceDropPercent - 跌幅百分比
 * @param {Object} strategy - 策略設定
 * @param {Object} [macroSentiment] - 總體情緒物件 { direction, bonus, penalty, label }
 *   direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
 *   bonus: 多頭加分
 *   penalty: 空頭扣分
 *   label: 顯示標籤文字
 */
export function computeEntryScore(data, priceDropPercent, strategy, macroSentiment) {
  const dropRules = Array.isArray(strategy?.buy?.dropScoreRules)
    ? strategy.buy.dropScoreRules.toSorted((a, b) => b.minDrop - a.minDrop)
    : [];
  const dropRule = dropRules.find((r) => priceDropPercent >= r.minDrop);

  const oversold = strategy.buy.rsi.oversold;
  const oversoldK = strategy.buy.kd.oversoldK;

  const kdBullLow =
    kdCrossUp(data.kdArr) &&
    wasBelowLevel(data.kdArr, oversoldK, 10, (x) => x.k);

  const signals = {
    rsiRebound: roseAboveAfterBelow(data.rsiArr, oversold, 10, {
      requireCrossToday: false,
    }),
    macdBull: macdCrossUp(data.macdArr),
    kdBullLow,
  };

  const details = {
    dropInfo: dropRule
      ? dropRule.label
      : `跌幅 ${priceDropPercent.toFixed(2)}%`,
    dropScore: dropRule ? dropRule.score : 0,
    rsiInfo: signals.rsiRebound ? `RSI 反轉 (${oversold})` : `RSI 未反轉`,
    rsiScore: signals.rsiRebound ? strategy.buy.rsi.score : 0,
    macdInfo: signals.macdBull ? "MACD 黃金交叉" : "MACD 無交叉",
    macdScore: signals.macdBull ? strategy.buy.macd.score : 0,
    kdInfo: signals.kdBullLow ? `KD 低檔交叉 (<${oversoldK})` : "KD 無交叉",
    kdScore: signals.kdBullLow ? strategy.buy.kd.score : 0,
  };

  // ── 總體情緒調整 ──────────────────────────────────────────────────────────────────
  let sentimentScore = 0;
  let sentimentInfo = "🌐 總體情緒：無數據";

  if (macroSentiment?.direction) {
    const dir = macroSentiment.direction;
    if (dir === "BULLISH") {
      sentimentScore = macroSentiment.bonus ?? 0;
      sentimentInfo = `🌐 總體情緒：📈 新聞偏多 (+${sentimentScore}分)`;
    } else if (dir === "BEARISH") {
      sentimentScore = -(macroSentiment.penalty ?? 0);
      sentimentInfo = `🌐 總體情緒：📉 新聞偏空 (${sentimentScore}分)`;
    } else {
      sentimentInfo = `🌐 總體情緒：⚖️ 中性觀望 (±0分)`;
    }
  }

  details.sentimentInfo = sentimentInfo;
  details.sentimentScore = sentimentScore;

  const score =
    details.dropScore +
    details.rsiScore +
    details.macdScore +
    details.kdScore +
    sentimentScore;

  return { weightScore: score, weightDetails: details, entrySignals: signals };
}

// 轉弱指標計算
export function computeReversalTriggers(data, strategy) {
  const th = strategy.threshold;
  const rsiDrop = fellBelowAfterAbove(data.rsiArr, th.rsiReversalLevel, 10, {
    requireCrossToday: false,
  });
  const minKDArr = kdSeries(data.kdArr, (x) => Math.min(x.k, x.d));
  const kdDrop = fellBelowAfterAbove(minKDArr, th.kReversalLevel, 10, {
    requireCrossToday: false,
  });

  const kdBearCross = kdCrossDown(data.kdArr);
  const macdBearCross = macdCrossDown(data.macdArr);

  const flags = { rsiDrop, kdDrop, kdBearCross, macdBearCross };
  const triggeredCount = Object.values(flags).filter(Boolean).length;

  return { totalFactor: Object.keys(flags).length, triggeredCount, ...flags };
}

// 過熱指標
export function computeOverheatState(data, bias240, strategy) {
  const th = strategy.threshold;
  const b = Number.isFinite(bias240) ? bias240 : null;

  const last = lastKD(data.kdArr);
  const kdD = last?.d ?? null;

  const factors = {
    rsiHigh: Number.isFinite(data.RSI) && data.RSI > th.rsiOverheatLevel,
    kdHigh: Number.isFinite(kdD) && kdD > th.dOverheatLevel,
    biasHigh: Number.isFinite(b) && b > th.bias240OverheatLevel,
  };

  const factorCount = Object.keys(factors).length;
  const highCount = Object.values(factors).filter(Boolean).length;

  return {
    isOverheat: highCount >= th.overheatCount,
    factorCount,
    highCount,
    coolCount: factorCount - highCount,
    factors,
    bias240: b,
  };
}

export function computeSellSignals(data, strategy) {
  const sell = strategy.sell;
  const overbought = sell.rsi.overbought || 75;
  const overboughtK = sell.kd.overboughtK || 80;

  const last = lastKD(data.kdArr);
  const lastK = last?.k ?? null;
  const lastD = last?.d ?? null;

  const rsiStateOverbought =
    Number.isFinite(data.RSI) && data.RSI >= overbought;
  const kdStateOverbought = Number.isFinite(lastD) && lastD >= overboughtK;

  const rsiSell = fellBelowAfterAbove(data.rsiArr, overbought, 10, {
    requireCrossToday: true,
  });

  const macdSell = (() => {
    const macdMinusSignal = data.macdArr.map((x) => x.MACD - x.signal);
    const crossDown = fellBelowAfterAbove(macdMinusSignal, 0, 10, {
      requireCrossToday: true,
    });
    return crossDown;
  })();

  const kdSell = (() => {
    const crossDownKD = kdCrossDown(data.kdArr);
    const inOverboughtNow =
      Number.isFinite(lastK) &&
      Number.isFinite(lastD) &&
      Math.min(lastK, lastD) >= overboughtK;

    const dArr = kdSeries(data.kdArr, (x) => x.d);
    const dropBelow80 = fellBelowAfterAbove(dArr, overboughtK, 10, {
      requireCrossToday: true,
    });

    return (crossDownKD && inOverboughtNow) || dropBelow80;
  })();

  const flags = { rsiSell, macdSell, kdSell };
  const signalCount = Object.values(flags).filter(Boolean).length;

  const stateFlags = { rsiStateOverbought, kdStateOverbought };
  const stateCount = Object.values(stateFlags).filter(Boolean).length;

  return {
    flags,
    signalCount,
    total: 3,
    stateFlags,
    stateCount,
  };
}
