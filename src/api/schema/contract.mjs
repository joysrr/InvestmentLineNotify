/**
 * ILN 2.0 數據契約 (Data Contract)
 *
 * 核心原則：
 * 1. 完整拷貝：Report 必須包含當下完整的 Strategy Snapshot。
 * 2. 全量數字化：所有數值欄位統一為 Number，不帶單位符號。
 * 3. 語意分類：分為 valuation, sentiment, liquidity, economy 四大維度。
 */

/**
 * 標準化市場狀態 (Canonical Market State)
 */
export const MARKET_SCHEMA = {
  type: "object",
  additionalProperties: true,
  properties: {
    valuation: { type: "object", additionalProperties: true },
    sentiment: { type: "object", additionalProperties: true },
    liquidity: { type: "object", additionalProperties: true },
    economy: { type: "object", additionalProperties: true },
  },
};

/**
 * 報告完整結構 (Full Report Schema)
 */
export const REPORT_SCHEMA = {
  type: "object",
  additionalProperties: true,
  properties: {
    id: { type: "string" },
    date: { type: "string" },
    marketState: MARKET_SCHEMA,
    signals: { type: "object", additionalProperties: true },
    strategySnapshot: { type: "object", additionalProperties: true },
    ai: { type: "object", additionalProperties: true },
  },
};
