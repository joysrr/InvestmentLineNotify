/**
 * strategyDefaults.mjs
 *
 * 策略常數集中管理模組
 * 所有槓桿、維持率、風控相關的魔法數值皆從此匯出
 *
 * 設計原則：
 *  1. 單一來源真理（SSOT）：所有硬編碼數值集中管理
 *  2. 向後相容：預設值與現行 Strategy.json 保持一致
 *  3. 類型安全：JSDoc 註明每個常數的型別與用途
 */

// ─────────────────────────────────────────────────────────────
// 槓桿 ETF 係數
// ─────────────────────────────────────────────────────────────

/**
 * 槓桿 ETF（00675L）的內含期貨槓桿係數
 * 00675L 提供 2x 每日報酬，故固定為 2
 * @type {number}
 */
export const LEVERAGE_ETF_MULTIPLIER = 2;

// ─────────────────────────────────────────────────────────────
// 維持率（Margin）相關常數
// ─────────────────────────────────────────────────────────────

/**
 * 斷頭危機門檻（%）
 * 維持率低於此值 → 🔴 critical，強制降槓桿
 * @type {number}
 */
export const MARGIN_CALL_THRESHOLD = 135;

/**
 * 凍結區門檻（%）
 * 維持率低於此值 → 🟠 frozen，禁止進場
 * @type {number}
 */
export const FROZEN_ZONE = 145;

/**
 * 保護觸發門檻（%）
 * 維持率高於此值 → 🟢 Layer 3，常態運行
 * @type {number}
 */
export const PROTECT_TRIGGER = 160;

/**
 * 保護目標門檻（%）
 * 維持率低於此值 → 🟡 Layer 2，需要回補
 * @type {number}
 */
export const PROTECT_TARGET = 180;

// ─────────────────────────────────────────────────────────────
// Gross Leverage（綜合曝險倍數）相關常數
// ─────────────────────────────────────────────────────────────

/**
 * 主動擴張上限倍數
 * Gross Leverage > ceiling → 禁止新增借款與 00675L
 * @type {number}
 */
export const GROSS_LEVERAGE_CEILING = 2.5;

/**
 * 被動危機紅線倍數
 * Gross Leverage > hardCap → 強制賣出 00675L 至 recoveryTarget
 * @type {number}
 */
export const GROSS_LEVERAGE_HARD_CAP = 3.0;

/**
 * 強制降槓著陸目標倍數
 * 觸發 hardCap 後，降槓桿至此倍數
 * @type {number}
 */
export const GROSS_LEVERAGE_RECOVERY_TARGET = 2.0;

// ─────────────────────────────────────────────────────────────
// Budget（預算管控）相關常數
// ─────────────────────────────────────────────────────────────

/**
 * 單日借款增幅上限（%）
 * 驗證用硬上限：Strategy.json 中的 maxDailyLoanIncreasePct 不得超過此值
 * 實際操作值定義於 Strategy.json（預設 5%，遠低於此硬上限）
 * @type {number}
 */
export const MAX_DAILY_LOAN_INCREASE_PCT = 0.15; // 15%（硬上限）

/**
 * 10 天滾動借款增幅上限（%）
 * 驗證用硬上限：Strategy.json 中的 maxRollingLoanIncreasePct 不得超過此值
 * 實際操作值定義於 Strategy.json（預設 15%，遠低於此硬上限）
 * @type {number}
 */
export const MAX_ROLLING_LOAN_INCREASE_PCT = 0.2; // 20%（硬上限）

/**
 * 滾動預算計算天數
 * @type {number}
 */
export const BUDGET_ROLLING_DAYS = 10;

// ─────────────────────────────────────────────────────────────
// Valuation Guard（估值守衛）相關常數
// ─────────────────────────────────────────────────────────────

/**
 * 估值泡沫 PB 門檻
 * PB ≥ 2.2 → 停止加碼 00675L
 * @type {number}
 */
export const VALUATION_FOAM_PB_THRESHOLD = 2.2;

/**
 * 高估鎖定 PR 門檻（%）
 * PR ≥ 90 → 觸發 latch 鎖定機制
 * @type {number}
 */
export const VALUATION_LATCH_TRIGGER_PR = 90;

/**
 * 高估解鎖 PR 門檻（%）
 * PR < 70 → 解除 latch
 * @type {number}
 */
export const VALUATION_LATCH_UNLOCK_PR = 70;

// ─────────────────────────────────────────────────────────────
// Panic Bypass（恐慌繞過）相關常數
// ─────────────────────────────────────────────────────────────

/**
 * 恐慌繞過觸發跌幅（%）
 * priceDrop > 20% 且 VIX > 35 → 啟動 panic bypass
 * @type {number}
 */
export const PANIC_BYPASS_DROP_PCT = 0.2; // 20%

/**
 * 恐慌繞過 VIX 門檻
 * VIX > 35 且跌幅 > 20% → 啟動 panic bypass
 * @type {number}
 */
export const PANIC_BYPASS_VIX_THRESHOLD = 35;

// ─────────────────────────────────────────────────────────────
// 預設配置物件（供快速引用）
// ─────────────────────────────────────────────────────────────

/**
 * 維持率配置（與 Strategy.json 的 maintenance 對應）
 * @type {{ marginCallThreshold: number, frozenZone: number, protectTrigger: number, protectTarget: number }}
 */
export const DEFAULT_MAINTENANCE_CONFIG = {
  marginCallThreshold: MARGIN_CALL_THRESHOLD,
  frozenZone: FROZEN_ZONE,
  protectTrigger: PROTECT_TRIGGER,
  protectTarget: PROTECT_TARGET,
};

/**
 * Gross Leverage 配置（與 Strategy.json 的 grossLeverage 對應）
 * @type {{ ceiling: number, hardCap: number, recoveryTarget: number }}
 */
export const DEFAULT_GROSS_LEVERAGE_CONFIG = {
  ceiling: GROSS_LEVERAGE_CEILING,
  hardCap: GROSS_LEVERAGE_HARD_CAP,
  recoveryTarget: GROSS_LEVERAGE_RECOVERY_TARGET,
};

/**
 * Budget 配置（與 Strategy.json 的 trading.budget 對應）
 * @type {{ maxDailyLoanIncreasePct: number, maxRollingLoanIncreasePct: number, rollingDays: number }}
 */
export const DEFAULT_BUDGET_CONFIG = {
  maxDailyLoanIncreasePct: MAX_DAILY_LOAN_INCREASE_PCT,
  maxRollingLoanIncreasePct: MAX_ROLLING_LOAN_INCREASE_PCT,
  rollingDays: BUDGET_ROLLING_DAYS,
};

/**
 * 所有常數的匯總物件（用於驗證與文件生成）
 * @type {object}
 */
export const ALL_DEFAULTS = {
  leverage: {
    LEVERAGE_ETF_MULTIPLIER,
  },
  margin: {
    MARGIN_CALL_THRESHOLD,
    FROZEN_ZONE,
    PROTECT_TRIGGER,
    PROTECT_TARGET,
  },
  grossLeverage: {
    GROSS_LEVERAGE_CEILING,
    GROSS_LEVERAGE_HARD_CAP,
    GROSS_LEVERAGE_RECOVERY_TARGET,
  },
  budget: {
    MAX_DAILY_LOAN_INCREASE_PCT,
    MAX_ROLLING_LOAN_INCREASE_PCT,
    BUDGET_ROLLING_DAYS,
  },
  valuation: {
    VALUATION_FOAM_PB_THRESHOLD,
    VALUATION_LATCH_TRIGGER_PR,
    VALUATION_LATCH_UNLOCK_PR,
  },
  panicBypass: {
    PANIC_BYPASS_DROP_PCT,
    PANIC_BYPASS_VIX_THRESHOLD,
  },
};
