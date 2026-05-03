import { macdCrossDown } from "../indicators.mjs";

// 所有可計入 sell signal 的訊號數量
const TOTAL_SELL_SIGNALS = 3;

export function computeSellSignals(data, strategy) {
  if (!data.closeArr || data.closeArr.length < 2) {
    return {
      flags: {},
      signalCount: 0,
      total: TOTAL_SELL_SIGNALS,
      stateFlags: {},
      stateCount: 0,
    };
  }

  // 1. RSI 狀態
  const rsiCfg = strategy.sell?.rsi || { overbought: 75 };
  const overbought = rsiCfg.overbought ?? 75;
  const rsiStateOverbought =
    Number.isFinite(data.RSI) && data.RSI >= overbought;

  // 2. KD 狀態
  const kdCfg = strategy.sell?.kd || { overboughtK: 80 };
  const overboughtK = kdCfg.overboughtK ?? 80;
  const lastKD = data.kdArr?.at(-1);
  const kdStateOverbought = lastKD && lastKD.k >= overboughtK;

  // 3. MACD 死叉
  const isMacdDeadCross = macdCrossDown(data.macdArr);

  // 賣出訊號計分 (不再包含 hardcoded trailing stop，追蹤停損已交由 Engine 層統一負責)
  const flags = {
    rsiOverbought: rsiStateOverbought,
    kdOverbought: kdStateOverbought,
    macdDeadCross: isMacdDeadCross,
  };

  const signalCount =
    (flags.rsiOverbought ? 1 : 0) +
    (flags.kdOverbought ? 1 : 0) +
    (flags.macdDeadCross ? 1 : 0);

  // 狀態紀錄供降槓邏輯參考
  const stateFlags = { rsiStateOverbought, kdStateOverbought };
  const stateCount =
    (stateFlags.rsiStateOverbought ? 1 : 0) +
    (stateFlags.kdStateOverbought ? 1 : 0);

  return {
    flags,
    signalCount,
    total: TOTAL_SELL_SIGNALS,
    stateFlags,
    stateCount,
  };
}
