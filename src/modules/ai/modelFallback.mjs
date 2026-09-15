// src/modules/ai/modelFallback.mjs
//
// 職責：解析 Gemini 多模型 Fallback 清單。
//
// 設計邏輯：
//   1. 主模型永遠是 GEMINI_MODEL（env）或硬編碼 defaultModel
//   2. 備用模型從 GEMINI_MODEL_FALLBACKS（env，逗號分隔）讀取
//   3. 自動去重、過濾空值
//   4. callAI 在 quota 耗盡時依序嘗試備用模型，所有模型失敗才報錯

/**
 * 解析 Gemini 模型 Fallback 清單。
 *
 * @param {object} opts
 * @param {string} opts.defaultModel        - 主模型名稱
 * @param {string|undefined} opts.fallbacksEnv - GEMINI_MODEL_FALLBACKS 環境變數值（逗號分隔）
 * @returns {string[]} 去重後的模型清單，第一個為主模型
 */
export function resolveGeminiModelList({ defaultModel, fallbacksEnv }) {
  const seen = new Set();
  const list = [];

  const add = (model) => {
    const m = model?.trim();
    if (m && !seen.has(m)) {
      seen.add(m);
      list.push(m);
    }
  };

  add(defaultModel);

  if (fallbacksEnv) {
    for (const m of fallbacksEnv.split(",")) {
      add(m);
    }
  }

  return list;
}

/**
 * 從環境變數建立 Gemini 模型清單（生產用）。
 * @returns {string[]}
 */
export function buildGeminiModelListFromEnv() {
  return resolveGeminiModelList({
    defaultModel: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
    fallbacksEnv: process.env.GEMINI_MODEL_FALLBACKS,
  });
}
