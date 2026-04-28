// 所有可計入 sell signal 的訊號數量（新增訊號時務必同步更新此常數）
const TOTAL_SELL_SIGNALS = 1;

export function computeSellSignals(data, strategy) {
  const closeArr = data.closeArr || [];
  const ma20Arr = data.ma20Arr || [];
  const atrArr = data.atrArr || [];

  if (closeArr.length < 2 || ma20Arr.length < 2 || atrArr.length < 2) {
    return {
      flags: {},
      signalCount: 0,
      total: TOTAL_SELL_SIGNALS,
      stateFlags: {},
      stateCount: 0,
    };
  }

  const currentClose = closeArr[closeArr.length - 1];
  const currentMA20 = ma20Arr[ma20Arr.length - 1];
  const currentATR = atrArr[atrArr.length - 1];

  // 動態追蹤停利 (Trailing Stop)：
  // 當價格有效跌穿 MA20 軌道下緣 (MA20 - 1.0 * ATR) 時停利出場
  const atrMultiplier = 1.0;
  const trailingThreshold = currentMA20 - currentATR * atrMultiplier;
  const trailingStop = currentClose < trailingThreshold;

  // RSI 超買狀態僅保留作為 stateFlags 紀錄供降槓邏輯參考，不計入 sell signals
  const sell = strategy.sell || { rsi: { overbought: 75 } };
  const overbought = sell.rsi?.overbought ?? 75;
  const rsiStateOverbought =
    Number.isFinite(data.RSI) && data.RSI >= overbought;

  const flags = { trailingStop };
  const signalCount = trailingStop ? 1 : 0;

  const stateFlags = { rsiStateOverbought };
  const stateCount = rsiStateOverbought ? 1 : 0;

  return {
    flags,
    signalCount,
    total: TOTAL_SELL_SIGNALS,
    stateFlags,
    stateCount,
  };
}
