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
  valuation: {
    pe: 0,
    pb: 0,
    pr: 0, // PB 分位數 (0-100)
    yield: 0, // 殖利率 (%)
  },
  sentiment: {
    vix: 0,
    fearGreed: 0,
    isPanic: false,
  },
  liquidity: {
    marginRatio: 0, // 融資維持率 (%)
    fxRate: 0, // 美元/台幣匯率
    institutionalNetBuy: 0, // 三大法人買賣超 (百萬)
  },
  economy: {
    ndcScore: 0, // 景氣燈號分數
    ndcLight: "", // 燈號描述
    cpiYoY: 0, // CPI 年增率
    bankRate: 0, // 央行利率
  },
};

/**
 * 報告完整結構 (Full Report Schema)
 */
export const REPORT_SCHEMA = {
  id: "", // YYYY-MM-DD
  date: "",
  marketState: {}, // 遵循 MARKET_SCHEMA
  signals: {
    status: "", // 🚀, 📈, 🚨 等
    score: 0,
    target: "", // 0050, 00675L 等
    suggestion: "",
    weightDetails: {},
  },
  strategySnapshot: {}, // 完整拷貝當下的 Strategy.json
  ai: {
    analysis: "",
    risks: [],
    actions: [],
  },
};
