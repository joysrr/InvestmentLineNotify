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

import { fetchStrategyConfigUnified } from "./strategyLoader.mjs";

/**
 * 載入策略設定。優先順序已移交至 strategyLoader.mjs
 */
export async function fetchStrategyConfig() {
  // 1. 記憶體 cache（同次執行不重複讀檔）
  if (_cache.strategy) {
    return _cache.strategy;
  }

  const json = await fetchStrategyConfigUnified();
  _cache = { url: "unified", strategy: json, loadedAt: new Date() };
  return json;
}

import { validateStrategyConfig } from "./strategySchema.mjs";
export { validateStrategyConfig };
export { computeEntryScore } from "./policies/entryScoringPolicy.mjs";

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
