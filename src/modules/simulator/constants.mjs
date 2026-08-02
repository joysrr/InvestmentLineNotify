// src/modules/simulator/constants.mjs
// 純常數字面量 (DEC-23)

/** 價格邊界 */
export const PRICE_BOUNDS = {
  MIN: 50,
  MAX: 500,
  WARNING_THRESHOLD_PCT: 0.1,
  DANGER_THRESHOLD_PCT: 0.2,
};

/** RSI 邊界 */
export const RSI_BOUNDS = { MIN: 1, MAX: 99 };

/** 掃描器參數 (DEC-12, DEC-13, D3, D4) */
export const SCAN_CONFIG = {
  RANGE_PCT: 0.15, // ±15%
  STEP_PCT: 0.005, // 0.5% 步距
  MAX_ITERATIONS: 200, // 上限
  TOLERANCE: 0.01, // 1% 容忍度
  EARLY_STOP: true, // 找到完全符合提前結束
};

/** RSI 二分搜尋參數 (D5, DEC-11) */
export const RSI_SOLVER_CONFIG = {
  INITIAL_RANGE_PCT: 0.3, // ±30%
  TOLERANCE: 0.5, // 0.5 RSI 點
  MAX_ITERATIONS: 50,
};

/** MA240 Fallback 閾值 (DEC-06) */
export const MA240_FALLBACK_THRESHOLDS = {
  FULL: 240,
  MA60_PROXY: 60,
  MA20_PROXY: 20,
};

/** 快取設定 (D6, DEC-28) */
export const HISTORY_CACHE_CONFIG = {
  TTL_MS: 5 * 60 * 1000, // 5 分鐘
};

/** 歷史資料需求月數 (足夠 MA240 等所有指標) */
export const REQUIRED_HISTORY_MONTHS = 13;

/** 支援的反向目標類型 (DEC-04) */
export const REVERSE_TARGET_TYPES = [
  "maintenanceRatio",
  "rsi",
  "ma20",
  "ma60",
  "ma240Bias",
  "kdCross",
  "macdCross",
  "strategyScore",
  "portfolioHealth",
];

/** KD/MACD 交叉方向 */
export const CROSS_DIRECTIONS = ["golden", "dead"];

/** Portfolio Health 狀態 */
export const PORTFOLIO_HEALTH_STATUS = ["green", "yellow", "red"];

/** API 版本前綴 (DEC-34) */
export const API_VERSION_PREFIX = "/api/v1";

/** 資料品質標籤 */
export const DATA_QUALITY_LABELS = {
  OK: "ok",
  FALLBACK_USED: "fallback_used",
  INSUFFICIENT_DATA: "insufficient_data",
};

/** 模擬計算模式 */
export const CALCULATION_MODE = {
  FORWARD: "forward",
  REVERSE_ANALYTICAL: "reverse_analytical",
  REVERSE_SCAN: "reverse_scan",
};

/** 錯誤代碼 (DEC-17) */
export const ERROR_CODES = {
  BAD_REQUEST: "BAD_REQUEST",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFLICT: "CONFLICT",
  DATA_NOT_READY: "DATA_NOT_READY",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
};

/** HTTP 狀態碼映射 */
export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

/** 409 Conflict 觸發條件代碼 (DEC-18) */
export const CONFLICT_REASONS = {
  REPORT_EXPIRED: "REPORT_EXPIRED",
  HISTORY_INCOMPLETE: "HISTORY_INCOMPLETE",
  PORTFOLIO_INVALID: "PORTFOLIO_INVALID",
  STRATEGY_LOAD_FAILED: "STRATEGY_LOAD_FAILED",
};
