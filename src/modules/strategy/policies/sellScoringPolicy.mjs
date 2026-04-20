export function computeSellSignals(data, strategy) {
  const closeArr = data.closeArr || [];
  const ma20Arr = data.ma20Arr || [];
  const atrArr = data.atrArr || [];
  
  if (closeArr.length < 2 || ma20Arr.length < 2 || atrArr.length < 2) {
    return { flags: {}, signalCount: 0, total: 2, stateFlags: {}, stateCount: 0 };
  }

  const currentClose = closeArr[closeArr.length - 1];
  const currentMA20 = ma20Arr[ma20Arr.length - 1];
  const currentATR = atrArr[atrArr.length - 1];

  // 動態追蹤停利 (Trailing Stop):
  // 放棄靜態 RSI/KD 無腦超買觸發，改採動態濾網：當價格有效跌穿 MA20 軌道下緣 (MA20 - 1.0 * ATR) 時停利出場，解決牛市主升段太早下車問題。
  const atrMultiplier = 1.0; 
  const trailingThreshold = currentMA20 - (currentATR * atrMultiplier);
  const trailingStop = currentClose < trailingThreshold;

  // RSI 超買狀態僅保留作為 stateFlags 紀錄供其他降槓邏輯參考，不再強制計算為 sell signals。
  const sell = strategy.sell || { rsi: { overbought: 75 } };
  const overbought = sell.rsi?.overbought ?? 75;
  const rsiStateOverbought = Number.isFinite(data.RSI) && data.RSI >= overbought;
  
  const flags = { trailingStop };
  const signalCount = trailingStop ? 1 : 0;
  
  const stateFlags = { rsiStateOverbought };
  const stateCount = rsiStateOverbought ? 1 : 0;

  return {
    flags,
    signalCount,
    total: 1, 
    stateFlags,
    stateCount
  };
}
