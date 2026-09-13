// src/modules/sentiment/socialKeywordResolver.mjs
//
// 職責：解析並調適社群採集關鍵字。
// 結合系統新聞核心詞池 (baseTwQueries) 與 AI 動態發現詞，
// 確保社群輿情採集貼合投資組合標的（0050、00675L、台積電）與最新市場焦點。

import { baseTwQueries } from "../keywordConfig.mjs";

/**
 * 預設必備核心資產標的詞
 */
export const CORE_PORTFOLIO_KEYWORDS = Object.freeze([
  "台股",
  "0050",
  "00675L",
  "台積電",
  "大盤",
]);

/**
 * 從新聞靜態詞池提煉高頻社群熱點詞
 */
export const CORE_MARKET_TOPICS = Object.freeze([
  "外資",
  "三大法人",
  "融資",
  "國安基金",
]);

/**
 * 解析出社群搜尋的最佳化關鍵字清單
 * @param {Object} [options]
 * @param {Array<string>} [options.customKeywords] 使用者或上層自訂之覆蓋清單
 * @param {Array<string>} [options.dynamicKeywords] AI 動態關鍵字或新聞焦點詞
 * @param {number} [options.maxKeywords] 最大關鍵字數量限制（預設 8）
 * @returns {Array<string>} 精煉去重後的關鍵字清單
 */
export function resolveSocialKeywords(options = {}) {
  if (
    Array.isArray(options.customKeywords) &&
    options.customKeywords.length > 0
  ) {
    return options.customKeywords;
  }

  const maxKeywords = options.maxKeywords || 8;
  const result = [];
  const seen = new Set();

  const addWord = (raw) => {
    if (!raw || typeof raw !== "string") return;
    const word = raw.trim();
    if (!word || seen.has(word)) return;
    seen.add(word);
    result.push(word);
  };

  // 1. 優先加入投資組合核心標的
  for (const kw of CORE_PORTFOLIO_KEYWORDS) {
    addWord(kw);
  }

  // 2. 融入 AI 動態關鍵字（若有）
  if (Array.isArray(options.dynamicKeywords)) {
    for (const kw of options.dynamicKeywords) {
      if (result.length >= maxKeywords) break;
      addWord(kw);
    }
  }

  // 3. 補充新聞詞池中的籌碼/流動性核心詞
  for (const kw of CORE_MARKET_TOPICS) {
    if (result.length >= maxKeywords) break;
    addWord(kw);
  }

  return result;
}
