// src/modules/sentiment/crawlers/socialScoreCalculator.mjs
//
// 職責：社群貼文多空關鍵字計分器。
// 將 PTT / Bluesky 貼文依多空詞頻計算 0-100 之正規化情緒分數。

export const BULL_KEYWORDS = Object.freeze([
  "上漲",
  "大漲",
  "暴漲",
  "創高",
  "買超",
  "多方",
  "樂觀",
  "看好",
  "突破",
  "漲停",
  "收紅",
  "反彈",
  "走強",
  "軋空",
]);

export const BEAR_KEYWORDS = Object.freeze([
  "下跌",
  "大跌",
  "重挫",
  "崩跌",
  "下殺",
  "賣超",
  "空方",
  "悲觀",
  "利空",
  "跌破",
  "跌停",
  "收黑",
  "走弱",
  "賣壓",
]);

/**
 * 計算社群文章清單的綜合情緒分數 (0-100)
 * @param {Array<Object>} items 文章清單
 * @returns {number} 0-100 分數 (50 為中性)
 */
export function calcSocialSentimentScore(items = []) {
  if (!items || items.length === 0) {
    return 50;
  }

  let bull = 0;
  let bear = 0;

  for (const item of items) {
    const text = `${item.title || ""} ${item.content || ""}`;
    let bCount = 0;
    let sCount = 0;

    for (const kw of BULL_KEYWORDS) {
      if (text.includes(kw)) bCount++;
    }
    for (const kw of BEAR_KEYWORDS) {
      if (text.includes(kw)) sCount++;
    }

    if (bCount > sCount) {
      bull++;
    } else if (sCount > bCount) {
      bear++;
    }
  }

  const total = bull + bear;
  if (total === 0) {
    return 50;
  }

  const ratio = bull / total; // 0.0 ~ 1.0
  // 將比例映射至 20 ~ 80 區間，避免極端值失真
  const score = Math.round(20 + ratio * 60);
  return Math.max(0, Math.min(100, score));
}
