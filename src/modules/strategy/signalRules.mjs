/**
 * signalRules.mjs
 * Strategy 模組的統一入口 (Facade)。
 *
 * 自身實作：
 *  - fetchStrategyConfig()     策略載入（含 memory cache）
 *  - computeReversalTriggers() 轉弱指標
 *  - computeOverheatState()    過熱指標
 *
 * Re-export（原始實作在各自 policy 模組）：
 *  - validateStrategyConfig    ← strategySchema.mjs
 *  - computeEntryScore         ← policies/entryScoringPolicy.mjs
 *  - computeSellSignals        ← policies/sellScoringPolicy.mjs
 */
import {
  fellBelowAfterAbove,
  macdCrossDown,
  kdCrossDown,
  lastKD,
  kdSeries,
} from "./indicators.mjs";
import { fetchStrategyConfigUnified } from "./strategyLoader.mjs";

import { validateStrategyConfig } from "./strategySchema.mjs";
export { validateStrategyConfig };
export { computeEntryScore } from "./policies/entryScoringPolicy.mjs";

/* 記憶體暫存 */
let _cache = {
  strategy: null,
  loadedAt: null,
};

/**
 * 載入策略設定。優先順序已移交至 strategyLoader.mjs
 */
export async function fetchStrategyConfig() {
  // 1. 記憶體 cache（同次執行不重複讀檔）
  if (_cache.strategy) {
    return _cache.strategy;
  }

  const json = await fetchStrategyConfigUnified();
  _cache = { strategy: json, loadedAt: new Date() };
  return json;
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

export { computeSellSignals } from "./policies/sellScoringPolicy.mjs";
