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
import { readFile } from "fs/promises";
import { resolve } from "path";

const STRATEGY_URL = process.env.STRATEGY_URL;

/** 本地 Strategy.json 路徑（相對於專案根目錄） */
const LOCAL_STRATEGY_PATH = resolve(process.cwd(), "data/config/Strategy.json");

/* 記憶體暫存 */
let _cache = {
  url: null,
  strategy: null,
  loadedAt: null,
};

/**
 * 從本地 data/config/Strategy.json 讀取策略設定。
 * 驗證通過後回傳，否則拋出錯誤。
 */
async function fetchStrategyLocal() {
  const text = await readFile(LOCAL_STRATEGY_PATH, "utf-8");
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`[Strategy] 本地 JSON 解析失敗：${e.message}`);
  }
  validateStrategyConfig(json);
  return json;
}

/**
 * 從遠端 STRATEGY_URL 讀取策略設定。
 * 驗證通過後同步備份至 archiveManager，並回傳。
 */
async function fetchStrategyRemote() {
  if (!STRATEGY_URL) throw new Error("[Strategy] STRATEGY_URL 未設定");

  const res = await fetch(STRATEGY_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 strategy-client",
      Accept: "application/json",
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `[Strategy] 遠端 HTTP ${res.status}: ${text.slice(0, 200)}`,
    );
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`[Strategy] 遠端 JSON 解析失敗：${e.message}`);
  }

  validateStrategyConfig(json);

  // 驗證通過後同步備份
  await archiveManager.saveStrategyCache(json);

  return json;
}

/**
 * 載入策略設定。優先順序：
 *   1. 記憶體 cache
 *   2. 本地 data/config/Strategy.json（主要來源）
 *   3. 遠端 STRATEGY_URL（備援來源，需設定環境變數）
 *   4. archiveManager 本地備份 cache
 */
export async function fetchStrategyConfig() {
  // 1. 記憶體 cache（同次執行不重複讀檔）
  if (_cache.strategy) {
    return _cache.strategy;
  }

  let json = null;
  let source = null;

  // 2. 本地優先
  try {
    json = await fetchStrategyLocal();
    source = "local";
    console.log(`[Strategy] 載入本地設定 v${json.version}`);
  } catch (localErr) {
    console.warn(`⚠️ [Strategy] 本地讀取失敗：${localErr.message}`);

    // 3. 遠端備援
    if (STRATEGY_URL) {
      try {
        json = await fetchStrategyRemote();
        source = "remote";
        console.log(`[Strategy] 載入遠端設定 v${json.version}`);
      } catch (remoteErr) {
        console.warn(`⚠️ [Strategy] 遠端載入失敗：${remoteErr.message}`);
      }
    }
  }

  // 4. archiveManager 備份 cache（最後防線）
  if (!json) {
    const localCache = await archiveManager.getStrategyCache();
    if (localCache) {
      console.warn(
        `⚠️ [Strategy] 使用 archiveManager 備份 v${localCache.version}`,
      );
      json = localCache;
      source = "archive";
    }
  }

  if (!json) {
    throw new Error(
      "[Strategy] 所有來源均無法載入 Strategy.json，請檢查本地檔案或 STRATEGY_URL 環境變數",
    );
  }

  _cache = { url: source, strategy: json, loadedAt: new Date() };
  return json;
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

  // 2. leverage（targetMultiplier 已移除，leverage 物件保留供未來擴充）
  assert(isObject(config.leverage), "leverage 必須是物件");

  // 3. reserve（allocationRatio 已移除，邏輯由 reserve.tiers 完整承擔）
  assert(isObject(config.reserve), "reserve 必須是物件");
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
  // frozenZone：新增必填欄位（v2.4+）
  assertNumber(config.maintenance.frozenZone, "maintenance.frozenZone");

  // ── grossLeverage 驗證 ──────────────────────────────────────────
  /**
   * ceiling {number}        主動擴張上限倍數（例如 2.5）
   * hardCap {number}        被動危機紅線倍數（例如 3.0）
   * recoveryTarget {number} 強制降槓著陸目標倍數（例如 2.0）
   *
   * 大小關係必須滿足：recoveryTarget < ceiling < hardCap
   */
  assert(isObject(config.grossLeverage), "grossLeverage 必須是物件");
  const gl = config.grossLeverage;

  assertNumber(gl.ceiling, "grossLeverage.ceiling");
  assert(gl.ceiling > 0, "grossLeverage.ceiling 必須是正數");

  assertNumber(gl.hardCap, "grossLeverage.hardCap");
  assert(gl.hardCap > 0, "grossLeverage.hardCap 必須是正數");

  assertNumber(gl.recoveryTarget, "grossLeverage.recoveryTarget");
  assert(gl.recoveryTarget > 0, "grossLeverage.recoveryTarget 必須是正數");

  // 大小關係強制檢查：recoveryTarget < ceiling < hardCap
  assert(
    gl.recoveryTarget < gl.ceiling,
    `grossLeverage：recoveryTarget(${gl.recoveryTarget}) 必須小於 ceiling(${gl.ceiling})`,
  );
  assert(
    gl.ceiling < gl.hardCap,
    `grossLeverage：ceiling(${gl.ceiling}) 必須小於 hardCap(${gl.hardCap})`,
  );
  // ────────────────────────────────────────────────────────────────

  // ── valuationGuard 驗證（選填，向後相容；v2.6+ 新增）──────────────────────
  /**
   * valuationGuard 估值保護層，全部選填，缺失時由 resolveValuationGuard() 視為停用。
   *
   * enabled                    {boolean} 是否啟用估值保護
   * minHistoryDays             {number}  最低歷史天數門檻（低於此值觸發 fallback）
   *
   * tiers[]                    {Array}   PR 分位數壓縮層
   *   .prThreshold             {number}  觸發門檻（PR 百分位數，0–100）
   *   .label                   {string}  顯示標籤
   *   .multiplier              {number}  槓桿壓縮倍率（0–1）
   *
   * trailingStop               {Object}  追蹤停損壓縮
   *   .enabled                 {boolean}
   *   .dropFromPeakThreshold   {number}  從高點回落比例（例如 0.08 = 8%）
   *   .multiplierOverride      {number}  觸發後套用的壓縮倍率
   *
   * panicDrop                  {Object}  高估區急跌解鎖
   *   .enabled                          {boolean}
   *   .singleDayDropThreshold           {number}  單日跌幅門檻（例如 0.05 = 5%）
   *   .consecutiveDaysThreshold         {number}  連續跌幅天數
   *   .consecutiveDayDropThreshold      {number}  每日跌幅門檻（例如 0.03 = 3%）
   *   .multiplierOverride               {number}  急跌解鎖後套用的倍率（通常 1.0）
   *
   * latch                      {Object}  高估鎖定機制
   *   .enabled                 {boolean}
   *   .triggerPrThreshold      {number}  觸發 latch 的 PR 門檻
   *   .unlockConditions        {Object}
   *     .condition1.prBelowThreshold         {number}  PR 回落解鎖門檻
   *     .condition3.ma20AboveDays            {number}  MA20 站上連續天數
   *     .condition3.macdPositive             {boolean} MACD 柱狀需為正
   *     .condition3.trendUnlockMa60SlopeThreshold {number} MA60 斜率門檻
   */
  if (config.valuationGuard !== undefined) {
    const vg = config.valuationGuard;
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

    // trailingStop
    if (vg.trailingStop !== undefined) {
      const ts = vg.trailingStop;
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

    // panicDrop
    if (vg.panicDrop !== undefined) {
      const pd = vg.panicDrop;
      assert(isObject(pd), "valuationGuard.panicDrop 必須是物件");
      /**
       * panicDrop.enabled                  {boolean} 是否啟用急跌解鎖
       * panicDrop.singleDayDropThreshold   {number}  單日跌幅門檻（0–1，例如 0.05）
       * panicDrop.consecutiveDaysThreshold {number}  連續跌日天數門檻
       * panicDrop.consecutiveDayDropThreshold {number} 每日跌幅門檻（0–1，例如 0.03）
       * panicDrop.multiplierOverride       {number}  急跌解鎖後套用倍率（通常 1.0）
       */
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

    // latch
    if (vg.latch !== undefined) {
      const latch = vg.latch;
      assert(isObject(latch), "valuationGuard.latch 必須是物件");
      assertBoolean(latch.enabled, "valuationGuard.latch.enabled");
      assertNumber(
        latch.triggerPrThreshold,
        "valuationGuard.latch.triggerPrThreshold",
      );

      if (latch.unlockConditions !== undefined) {
        const uc = latch.unlockConditions;
        assert(
          isObject(uc),
          "valuationGuard.latch.unlockConditions 必須是物件",
        );

        if (uc.condition1 !== undefined) {
          assertNumber(
            uc.condition1.prBelowThreshold,
            "valuationGuard.latch.unlockConditions.condition1.prBelowThreshold",
          );
        }
        if (uc.condition3 !== undefined) {
          assertNumber(
            uc.condition3.ma20AboveDays,
            "valuationGuard.latch.unlockConditions.condition3.ma20AboveDays",
          );
          assertBoolean(
            uc.condition3.macdPositive,
            "valuationGuard.latch.unlockConditions.condition3.macdPositive",
          );
          /**
           * trendUnlockMa60SlopeThreshold {number}
           * MA60 斜率輔助解鎖門檻，搭配 condition3 使用。
           * 計算方式：calcSlopeN(ma60Arr, N) > threshold 時視為趨勢向上。
           * 例如 0.001 表示每日平均上升 0.1%。
           */
          assertNumber(
            uc.condition3.trendUnlockMa60SlopeThreshold,
            "valuationGuard.latch.unlockConditions.condition3.trendUnlockMa60SlopeThreshold",
          );
        }
      }
    }
  }
  // ────────────────────────────────────────────────────────────────────────────

  // ── valuationMomentum 驗證（選填，向後相容；v2.6+ 新增）──────────────────
  if (config.valuationMomentum !== undefined) {
    const vm = config.valuationMomentum;
    assert(isObject(vm), "valuationMomentum 必須是物件");
    assertBoolean(vm.enabled, "valuationMomentum.enabled");
    assertNumber(vm.lookbackDays, "valuationMomentum.lookbackDays");
    assertNumber(vm.risingThreshold, "valuationMomentum.risingThreshold");
    assertNumber(vm.fallingThreshold, "valuationMomentum.fallingThreshold");
    assertNumber(vm.risingPenaltyMultiplier, "valuationMomentum.risingPenaltyMultiplier");
    assertBoolean(vm.fallingRelief, "valuationMomentum.fallingRelief");

    if (vm.highPRZone !== undefined) {
      const hpr = vm.highPRZone;
      assert(isObject(hpr), "valuationMomentum.highPRZone 必須是物件");
      assertNumber(hpr.triggerPR, "valuationMomentum.highPRZone.triggerPR");
      assertNumber(hpr.relaxedMomentumThreshold, "valuationMomentum.highPRZone.relaxedMomentumThreshold");
      assertNumber(hpr.vixSpikeThreshold, "valuationMomentum.highPRZone.vixSpikeThreshold");
      assertNumber(hpr.vixSpikeMultiplier, "valuationMomentum.highPRZone.vixSpikeMultiplier");
      assertNumber(hpr.vixAbsoluteHigh, "valuationMomentum.highPRZone.vixAbsoluteHigh");
      assertNumber(hpr.vixAbsoluteMultiplier, "valuationMomentum.highPRZone.vixAbsoluteMultiplier");
    }
  }
  // ────────────────────────────────────────────────────────────────────────────

  // ── overrideHierarchy 驗證（選填，向後相容；v2.6+ 新增）─────────────────
  if (config.overrideHierarchy !== undefined) {
    const oh = config.overrideHierarchy;
    assert(isObject(oh), "overrideHierarchy 必須是物件");
    assertBoolean(oh.panicBypassEnabled, "overrideHierarchy.panicBypassEnabled");
    assertNumber(oh.panicBypassDropPct, "overrideHierarchy.panicBypassDropPct");
    assertNumber(oh.panicVixThreshold, "overrideHierarchy.panicVixThreshold");
  }
  // ────────────────────────────────────────────────────────────────────────────

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

  // buy.entryGate：選填，向後相容（v2.4+ 新增）
  if (config.buy.entryGate !== undefined) {
    assert(isObject(config.buy.entryGate), "buy.entryGate 必須是物件");
    assertBoolean(config.buy.entryGate.enabled, "buy.entryGate.enabled");
    assert(
      Array.isArray(config.buy.entryGate.tiers),
      "buy.entryGate.tiers 必須是陣列",
    );
    config.buy.entryGate.tiers.forEach((tier, i) => {
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
    assert(isObject(config.macroSentiment), "macroSentiment 必須是物件");
    assertBoolean(config.macroSentiment.enabled, "macroSentiment.enabled");
    assertNumber(
      config.macroSentiment.bullishBonus,
      "macroSentiment.bullishBonus",
    );
    assertNumber(
      config.macroSentiment.bearishPenalty,
      "macroSentiment.bearishPenalty",
    );
    assertNumber(
      config.macroSentiment.bearishCooldownMultiplier,
      "macroSentiment.bearishCooldownMultiplier",
    );
    // vixOverrideTrigger / vixAbsoluteOverride：選填，向後相容（v2.5+ 新增）
    // 若存在則必須是合法 number，缺少時由 resolveVixOverride() 視為停用
    if (config.macroSentiment.vixOverrideTrigger !== undefined) {
      assertNumber(
        config.macroSentiment.vixOverrideTrigger,
        "macroSentiment.vixOverrideTrigger",
      );
    }
    if (config.macroSentiment.vixAbsoluteOverride !== undefined) {
      assertNumber(
        config.macroSentiment.vixAbsoluteOverride,
        "macroSentiment.vixAbsoluteOverride",
      );
    }
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
export function computeEntryScore(
  data,
  priceDropPercent,
  strategy,
  macroSentiment,
) {
  const dropRules = Array.isArray(strategy?.buy?.dropScoreRules)
    ? strategy.buy.dropScoreRules.toSorted((a, b) => b.minDrop - a.minDrop)
    : [];
  const dropRule = dropRules.find((r) => priceDropPercent >= r.minDrop);

  const oversold = strategy.buy.rsi.oversold;
  const oversoldK = strategy.buy.kd.oversoldK;

  // lookback 18：對應 Slow KD(9,3,3) 超賣區停留時間通常 5–20 天
  const kdBullLow =
    kdCrossUp(data.kdArr) &&
    wasBelowLevel(data.kdArr, oversoldK, 18, (x) => x.k);

  const signals = {
    // lookback 14：對應 RSI14 週期；requireCrossToday: true 確保只在「今天剛穿越」才觸發一次
    // 修正前 requireCrossToday: false 會在 10 天窗口內每天持續觸發 +3 虛假加分
    rsiRebound: roseAboveAfterBelow(data.rsiArr, oversold, 14, {
      requireCrossToday: true,
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
  // lookback 14：對應 RSI14 週期，避免短暫假訊號
  const rsiDrop = fellBelowAfterAbove(data.rsiArr, th.rsiReversalLevel, 14, {
    requireCrossToday: false,
  });
  const minKDArr = kdSeries(data.kdArr, (x) => Math.min(x.k, x.d));
  // lookback 15：對應 Slow KD(9,3,3) 平均週期
  const kdDrop = fellBelowAfterAbove(minKDArr, th.kReversalLevel, 15, {
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
  const overbought = sell.rsi.overbought ?? 75;
  const overboughtK = sell.kd.overboughtK ?? 80;

  const last = lastKD(data.kdArr);
  const lastK = last?.k ?? null;
  const lastD = last?.d ?? null;

  const rsiStateOverbought =
    Number.isFinite(data.RSI) && data.RSI >= overbought;
  const kdStateOverbought = Number.isFinite(lastD) && lastD >= overboughtK;

  // lookback 15：捕捉高位緩慢盤整後的過熱回落（原 10 天可能在高位停留期間錯失訊號）
  const rsiSell = fellBelowAfterAbove(data.rsiArr, overbought, 15, {
    requireCrossToday: true,
  });

  const macdSell = (() => {
    const macdMinusSignal = data.macdArr.map((x) => x.MACD - x.signal);
    // lookback 20：對應 MACD 慢線 26 日週期，牛市中交叉後死叉可能需 2–4 週
    const crossDown = fellBelowAfterAbove(macdMinusSignal, 0, 20, {
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
    // lookback 20：Slow KD 高位停留可達 3–4 週（15–20 天），原 10 天窗口不足
    const dropBelow80 = fellBelowAfterAbove(dArr, overboughtK, 20, {
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
