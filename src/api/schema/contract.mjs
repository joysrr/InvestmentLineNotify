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

export const READ_ONLY_REPORT_VIEW_SCHEMA = {
  type: "object",
  additionalProperties: true,
  required: [
    "date",
    "dataAsOf",
    "dataProvenance",
    "strategyHash",
    "fixtureSource",
    "theoreticalSnapshot",
    "availability",
  ],
  properties: {
    date: { type: "string" },
    dataAsOf: { type: ["object", "null"], additionalProperties: true },
    dataProvenance: {
      type: "array",
      items: { type: "object", additionalProperties: true },
    },
    strategyHash: { type: ["string", "null"] },
    fixtureSource: { type: ["string", "null"] },
    theoreticalSnapshot: {
      type: "object",
      required: ["status", "reason", "snapshot"],
      properties: {
        status: { type: "string", enum: ["OK", "UNAVAILABLE"] },
        reason: { type: ["string", "null"] },
        snapshot: { type: ["object", "null"], additionalProperties: true },
      },
      additionalProperties: true,
    },
    availability: {
      type: "object",
      required: ["status", "reason"],
      properties: {
        status: { type: "string", enum: ["AVAILABLE", "UNAVAILABLE"] },
        reason: { type: ["string", "null"] },
      },
      additionalProperties: false,
    },
  },
};
