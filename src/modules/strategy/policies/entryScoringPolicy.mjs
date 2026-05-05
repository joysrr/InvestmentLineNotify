import {
  roseAboveAfterBelow,
  macdCrossUp,
  kdCrossUp,
  wasBelowLevel,
} from "../indicators.mjs";

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

  const oversold = strategy.buy.rsi?.oversold ?? 30;
  const oversoldK = strategy.buy.kd?.oversoldK ?? 20;
  const crossLevelThreshold = strategy.buy.kd?.crossLevelThreshold ?? 50;
  const kdLookback = strategy.buy.kd?.lookbackDays ?? 18;

  const kdBullLow =
    kdCrossUp(data.kdArr) &&
    data.kdArr[data.kdArr.length - 1].k < crossLevelThreshold &&
    wasBelowLevel(data.kdArr, oversoldK, kdLookback, (x) => x.k);

  const signals = {
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
    rsiScore: signals.rsiRebound ? (strategy.buy.rsi?.score ?? 0) : 0,
    macdInfo: signals.macdBull ? "MACD 黃金交叉" : "MACD 無交叉",
    macdScore: signals.macdBull ? (strategy.buy.macd?.score ?? 0) : 0,
    kdInfo: signals.kdBullLow ? `KD 低檔交叉 (<${oversoldK})` : "KD 無交叉",
    kdScore: signals.kdBullLow ? (strategy.buy.kd?.score ?? 0) : 0,
  };

  // 左側交易與技術濾網去相關化 (Left-side vs Technical Decoupling)
  // 無論左側/右側，動能分數統一取 MAX 解決 RSI/KD 共線性 (Collinearity) 問題
  const momentumScore = Math.max(details.rsiScore, details.kdScore);

  // 左側區間：在訊號 label 加上前綴，明示為「確認訊號」而非主要觸發依據
  const isLeftSideRegime = !!dropRule;
  if (isLeftSideRegime) {
    if (signals.rsiRebound) details.rsiInfo = `[左側確認] RSI 反轉`;
    if (signals.kdBullLow) details.kdInfo = `[左側確認] KD 低檔交叉`;
  }

  let sentimentScore = 0;
  let sentimentInfo = "🌐 總體情緒：無數據";

  if (macroSentiment?.direction) {
    const dir = macroSentiment.direction;
    if (dir === "BULL") {
      sentimentScore = macroSentiment.bonus ?? 0;
      sentimentInfo = `🌐 總體情緒：📈 新聞偏多 (+${sentimentScore}分)`;
    } else if (dir === "BEAR") {
      sentimentScore = -(macroSentiment.penalty ?? 0);
      sentimentInfo = `🌐 總體情緒：📉 新聞偏空 (${sentimentScore}分)`;
    } else {
      sentimentInfo = `🌐 總體情緒：⚖️ 中性觀望 (±0分)`;
    }
  }

  details.sentimentInfo = sentimentInfo;
  details.sentimentScore = sentimentScore;

  // 總分 = 跌幅分數 + 去相關動能分數 + MACD 分數 + 情緒分數
  const score =
    details.dropScore + momentumScore + details.macdScore + sentimentScore;

  return { weightScore: score, weightDetails: details, entrySignals: signals };
}
