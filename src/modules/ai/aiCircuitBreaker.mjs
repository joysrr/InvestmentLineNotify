/**
 * aiCircuitBreaker.mjs — AI Circuit Breaker 機制（簡化版）
 *
 * 目的：
 * - 監控 AI API 的失敗率與回應時間
 * - 當失敗率超過閾值時自動降級（Circuit Open）
 * - 定期嘗試恢復（Half-Open 狀態）
 * - 防止連鎖失敗與資源耗盡
 *
 * 適用情境：單一 AI 模型（Gemini）
 *
 * 狀態轉換：
 *   CLOSED → OPEN → HALF_OPEN → CLOSED (成功) / OPEN (失敗)
 */

import logger from "../../utils/logger.mjs";

// Circuit Breaker 狀態列舉
export const CIRCUIT_STATE = {
  CLOSED: "CLOSED",   // 正常運作
  OPEN: "OPEN",       // 觸發降級，拒絕請求
  HALF_OPEN: "HALF_OPEN", // 測試恢復
};

/**
 * Circuit Breaker 配置（單一模型優化）
 */
const DEFAULT_CONFIG = {
  failureThreshold: 0.4,      // 40% 失敗率（較嚴格）
  minimumRequests: 3,         // 最小請求數才開始計算失敗率
  openDuration: 30000,        // Open 狀態持續 30 秒
  halfOpenMaxRequests: 2,     // Half-Open 允許的測試請求數
  slowThreshold: 15000,       // 15 秒視為慢請求
  slowRequestWeight: 0.5,     // 慢請求計入失敗的比例（保留設定，目前未啟用）
};

/**
 * Circuit Breaker 狀態記錄（單一實例）
 */
class CircuitBreakerState {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.state = CIRCUIT_STATE.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.totalRequests = 0;
    this.slowRequestCount = 0;

    // Half-Open 期間獨立計數
    this.halfOpenRequests = 0;
    this.halfOpenSuccessCount = 0;
    this.halfOpenFailureCount = 0;

    this.lastFailureTime = null;
    this.lastStateChangeTime = Date.now();

    // 歷史記錄
    this.history = [];
    this.maxHistorySize = 50;
  }

  /**
   * 檢查當前狀態是否允許發出請求
   * - CLOSED: 永遠允許
   * - OPEN: 拒絕（但若 openDuration 已過則先嘗試轉 Half-Open 再放行）
   * - HALF_OPEN: 僅允許 halfOpenMaxRequests 次測試
   */
  canRequest() {
    // OPEN 狀態下若已超過 openDuration，主動轉 Half-Open 以接受測試請求
    if (this.state === CIRCUIT_STATE.OPEN) {
      const now = Date.now();
      if (now - this.lastStateChangeTime >= this.config.openDuration) {
        this._transitionToHalfOpen();
      } else {
        return false;
      }
    }

    if (this.state === CIRCUIT_STATE.HALF_OPEN) {
      // Half-Open 期間限制請求數
      return this.halfOpenRequests < this.config.halfOpenMaxRequests;
    }

    // CLOSED
    return true;
  }

  /**
   * 記錄一次請求
   */
  recordRequest(duration, isSuccess) {
    // Half-Open 期間另外計數
    if (this.state === CIRCUIT_STATE.HALF_OPEN) {
      this.halfOpenRequests++;
      if (isSuccess) {
        this.halfOpenSuccessCount++;
      } else {
        this.halfOpenFailureCount++;
        this.lastFailureTime = Date.now();
      }
    } else {
      // CLOSED 期間正常累計
      this.totalRequests++;
      if (duration > this.config.slowThreshold) {
        this.slowRequestCount++;
      }
      if (isSuccess) {
        this.successCount++;
      } else {
        this.failureCount++;
        this.lastFailureTime = Date.now();
      }
    }

    // 記錄歷史（不論狀態）
    this.history.push({
      timestamp: Date.now(),
      duration,
      isSuccess,
      state: this.state,
    });
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    // 檢查狀態轉換
    this._checkStateTransition();
  }

  /**
   * 檢查並執行狀態轉換
   */
  _checkStateTransition() {
    const now = Date.now();

    switch (this.state) {
      case CIRCUIT_STATE.CLOSED:
        if (this._shouldOpenCircuit()) {
          this._transitionToOpen();
        }
        break;

      case CIRCUIT_STATE.OPEN:
        // 由 canRequest() 主動觸發轉 Half-Open，這裡保留作 fallback
        if (now - this.lastStateChangeTime >= this.config.openDuration) {
          this._transitionToHalfOpen();
        }
        break;

      case CIRCUIT_STATE.HALF_OPEN:
        // 任何一次失敗就立即關閉（fail-fast）
        if (this.halfOpenFailureCount > 0) {
          this._transitionToOpen();
        } else if (this.halfOpenRequests >= this.config.halfOpenMaxRequests) {
          // 測試額度用完且沒失敗 → 視為恢復
          if (this._isHalfOpenSuccessful()) {
            this._transitionToClosed();
          } else {
            this._transitionToOpen();
          }
        }
        break;
    }
  }

  /**
   * 是否應該開啟 Circuit
   */
  _shouldOpenCircuit() {
    if (this.totalRequests < this.config.minimumRequests) {
      return false;
    }
    const failureRate = this.failureCount / this.totalRequests;
    return failureRate >= this.config.failureThreshold;
  }

  /**
   * Half-Open 是否成功（成功率 > 50%）
   */
  _isHalfOpenSuccessful() {
    if (this.halfOpenRequests === 0) return false;
    const rate = this.halfOpenSuccessCount / this.halfOpenRequests;
    return rate > 0.5;
  }

  /**
   * 轉換到 Open 狀態
   */
  _transitionToOpen() {
    const oldState = this.state;
    this.state = CIRCUIT_STATE.OPEN;
    this.lastStateChangeTime = Date.now();

    logger.warn({
      event: "circuitOpen",
      oldState,
      newState: this.state,
      failureCount: this.failureCount,
      totalRequests: this.totalRequests,
      failureRate:
        this.totalRequests > 0
          ? this.failureCount / this.totalRequests
          : 0,
      halfOpenSuccessCount: this.halfOpenSuccessCount,
      halfOpenFailureCount: this.halfOpenFailureCount,
    });

    // 進入 OPEN 後重置 Half-Open 計數，等下次轉 Half-Open 用
    this.halfOpenRequests = 0;
    this.halfOpenSuccessCount = 0;
    this.halfOpenFailureCount = 0;
  }

  /**
   * 轉換到 Half-Open 狀態
   */
  _transitionToHalfOpen() {
    const oldState = this.state;
    this.state = CIRCUIT_STATE.HALF_OPEN;
    this.lastStateChangeTime = Date.now();
    this.halfOpenRequests = 0;
    this.halfOpenSuccessCount = 0;
    this.halfOpenFailureCount = 0;

    logger.info({
      event: "circuitHalfOpen",
      oldState,
      newState: this.state,
    });
  }

  /**
   * 轉換到 Closed 狀態
   */
  _transitionToClosed() {
    const oldState = this.state;
    this.state = CIRCUIT_STATE.CLOSED;
    this.lastStateChangeTime = Date.now();

    this.failureCount = 0;
    this.successCount = 0;
    this.totalRequests = 0;
    this.slowRequestCount = 0;
    this.halfOpenRequests = 0;
    this.halfOpenSuccessCount = 0;
    this.halfOpenFailureCount = 0;

    logger.info({
      event: "circuitClosed",
      oldState,
      newState: this.state,
    });
  }

  /**
   * 獲取當前狀態
   */
  getStatus() {
    const failureRate =
      this.totalRequests > 0
        ? +(this.failureCount / this.totalRequests).toFixed(2)
        : 0;

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      failureRate,
      slowRequestCount: this.slowRequestCount,
      timeInCurrentState: Date.now() - this.lastStateChangeTime,
      halfOpenRequests: this.halfOpenRequests,
      halfOpenSuccessCount: this.halfOpenSuccessCount,
      halfOpenFailureCount: this.halfOpenFailureCount,
    };
  }

  /**
   * 重置 Circuit Breaker
   */
  reset() {
    this.state = CIRCUIT_STATE.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.totalRequests = 0;
    this.slowRequestCount = 0;
    this.halfOpenRequests = 0;
    this.halfOpenSuccessCount = 0;
    this.halfOpenFailureCount = 0;
    this.lastFailureTime = null;
    this.lastStateChangeTime = Date.now();
    this.history = [];

    logger.info({ event: "circuitReset" });
  }
}

// 全域實例
const aiCircuitBreaker = new CircuitBreakerState();

/** 檢查是否可以發出 AI 請求 */
export function canMakeAIRequest() {
  if (!aiCircuitBreaker.canRequest()) {
    const status = aiCircuitBreaker.getStatus();
    logger.warn({
      event: "requestRejected",
      reason: "circuitOpen",
      state: status,
    });
    return false;
  }
  return true;
}

/** 記錄 AI 請求結果 */
export function recordAIRequestResult(duration, isSuccess) {
  aiCircuitBreaker.recordRequest(duration, isSuccess);
}

/** 獲取 Circuit Breaker 狀態 */
export function getCircuitBreakerStatus() {
  return aiCircuitBreaker.getStatus();
}

/** 重置 Circuit Breaker */
export function resetCircuitBreaker() {
  aiCircuitBreaker.reset();
  return { success: true };
}

/** 檢查 Circuit 是否開啟（用於降級決策） */
export function isCircuitOpen() {
  return aiCircuitBreaker.state === CIRCUIT_STATE.OPEN;
}

/** 檢查 Circuit 是否關閉（允許請求） */
export function isCircuitClosed() {
  return aiCircuitBreaker.state === CIRCUIT_STATE.CLOSED;
}