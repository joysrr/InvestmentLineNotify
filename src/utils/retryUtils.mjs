/**
 * Retry Utils - 統一重試機制工具模組
 * 提供指數退避 + Jitter 的重試邏輯
 */
import logger from "./logger.mjs";

// ============================================================================
// 📦 錯誤類別定義
// ============================================================================

/**
 * Provider 錯誤類別（API 呼叫失敗）
 */
export class ProviderError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ProviderError";
    this.providerId = options.providerId || "unknown";
    this.operation = options.operation || "unknown";
    this.statusCode = options.statusCode || null;
    this.isRetryable = options.isRetryable !== false;
    this.fallbackUsed = options.fallbackUsed || false;
    this.cause = options.cause || null;
  }
}

/**
 * AI Service 錯誤（用於 AI API 呼叫）
 */
export class AIServiceError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "AIServiceError";
    this.provider = options.provider || "unknown";
    this.model = options.model || null;
    this.statusCode = options.statusCode || null;
    this.isQuotaExhausted = options.isQuotaExhausted || false;
    this.isServiceError = options.isServiceError !== false;
    this.cause = options.cause || null;
  }
}

// ============================================================================
// ⏱️ 延遲與退避計算
// ============================================================================

/**
 * 延遲函數
 * @param {number} ms - 延遲毫秒數
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 計算指數退避延遲（含 Jitter）
 * @param {number} attempt - 當前嘗試次數（從 0 開始）
 * @param {number} baseDelay - 基礎延遲毫秒數
 * @param {number} maxDelay - 最大延遲毫秒數
 * @param {number} jitterFactor - Jitter 係數（0-1，預設 0.5）
 * @returns {number} 實際延遲毫秒數
 */
export function calculateBackoffDelay(
  attempt,
  baseDelay = 1000,
  maxDelay = 10000,
  jitterFactor = 0.5,
) {
  const exponential = baseDelay * Math.pow(2, attempt);
  const clampedExponential = Math.min(exponential, maxDelay);
  const jitter = Math.random() * clampedExponential * jitterFactor;
  return clampedExponential + jitter;
}

// ============================================================================
// 🔍 錯誤判斷工具
// ============================================================================

/**
 * 判斷錯誤是否可重試（暫態錯誤）
 * @param {Error} error - 錯誤物件
 * @returns {boolean}
 */
export function isRetryableError(error) {
  if (!error) return false;

  const message = error.message?.toLowerCase() || "";
  const errorCode = error.code?.toLowerCase() || "";
  const statusCode = error.statusCode || error.status;

  // 網路相關錯誤
  const networkErrorPatterns = [
    "timeout",
    "aborterror",
    "etimedout",
    "econnrefused",
    "econnreset",
    "enotfound",
    "socket hang up",
    "fetch failed",
    "network",
    "network error",
    "temporary network issue",
  ];

  const isNetworkError = networkErrorPatterns.some((pattern) =>
    message.includes(pattern) || errorCode.includes(pattern),
  );

  // HTTP 5xx 伺服器錯誤
  const isServerError = statusCode >= 500 && statusCode < 600;

  // 429 Too Many Requests（速率限制）
  const isRateLimitError = statusCode === 429;

  // 明確標記為可重試的錯誤
  const isExplicitlyRetryable = error.isRetryable === true;

  return (
    isNetworkError ||
    isServerError ||
    isRateLimitError ||
    isExplicitlyRetryable
  );
}

/**
 * 判斷 AI 錯誤是否可重試（包含 Quota 耗盡）
 * @param {Error} error - 錯誤物件
 * @returns {boolean}
 */
export function isAIRetryableError(error) {
  if (!error) return false;

  // AIServiceError 預設可重試
  if (error instanceof AIServiceError) {
    return error.isServiceError;
  }

  // Quota 耗盡錯誤（可重試）
  const message = error.message?.toLowerCase() || "";
  const isQuotaError =
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("too many requests");

  if (isQuotaError) return true;

  // 使用通用的可重試判斷
  return isRetryableError(error);
}

// ============================================================================
// 🔄 重試包裝器
// ============================================================================

/**
 * 指數退避重試包裝器
 * @param {Function} fn - 要執行的異步函數
 * @param {Object} options - 選項
 * @param {string} options.operationName - 操作名稱（用於日誌）
 * @param {number} options.maxRetries - 最大重試次數
 * @param {number} options.baseDelay - 基礎延遲毫秒數
 * @param {number} options.maxDelay - 最大延遲毫秒數
 * @param {number} options.jitterFactor - Jitter 係數（0-1）
 * @param {Function} options.isRetryable - 自定義可重試判斷函數
 * @param {Function} options.onRetry - 重試時回調 (attempt, error, delayMs)
 * @returns {Promise<any>}
 * @throws {Error} 當所有重試失敗時
 */
export async function withRetry(
  fn,
  {
    operationName = "unknown",
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    jitterFactor = 0.5,
    isRetryable = isRetryableError,
    onRetry = null,
  } = {},
) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 檢查是否可重試
      if (!isRetryable(error)) {
        logger.error(
          { operationName, error: error.message },
          "Retry 遇到非暫態錯誤，跳过重試"
        );
        throw error;
      }

      // 如果還有重試機會
      if (attempt < maxRetries) {
        const delayMs = calculateBackoffDelay(attempt, baseDelay, maxDelay, jitterFactor);

        // 呼叫回調
        if (typeof onRetry === "function") {
          onRetry(attempt + 1, error, delayMs);
        } else {
          logger.warn(
            { 
              operationName, 
              attempt: attempt + 1, 
              maxRetries,
              delayMs: Math.round(delayMs),
              error: error.message 
            },
            "Retry 失敗，等待後重試"
          );
        }

        await delay(delayMs);
      } else {
        logger.error(
          { operationName, attempts: maxRetries + 1, error: lastError.message },
          "Retry 最終失敗"
        );
      }
    }
  }

  throw lastError;
}

/**
 * 簡易版重試包裝器（使用預設配置）
 * @param {Function} fn - 要執行的異步函數
 * @param {string} operationName - 操作名稱
 * @param {number} maxRetries - 最大重試次數
 * @returns {Promise<any>}
 */
export async function retrySimple(fn, operationName = "unknown", maxRetries = 3) {
  return withRetry(fn, {
    operationName,
    maxRetries,
    baseDelay: 1000,
    maxDelay: 10000,
    jitterFactor: 0.5,
  });
}

// ============================================================================
// 🌐 Fetch 重試包裝器（含 Timeout）
// ============================================================================

/**
 * 具備 Timeout + Retry + 錯誤分類的 fetch 封裝（標準版）
 * @param {string} url
 * @param {RequestInit} [options={}]
 * @param {number} [timeout=30000] - 單次請求逾時 ms
 * @param {number} [retries=2]     - 最大重試次數
 * @param {number} [retryDelay=1000] - 首次重試等待 ms（指數退避：1000→2000→4000）
 * @param {string} [providerId='fetch'] - Provider ID（用於日誌）
 * @param {string} [operation='fetch'] - 操作名稱（用於日誌）
 * @returns {Promise<Response>}
 * @throws {ProviderError} 當所有重試失敗或遇到非暫態錯誤時
 */
export async function fetchWithTimeout(
  url,
  options = {},
  timeout = 30000,
  retries = 2,
  retryDelay = 1000,
  providerId = "fetch",
  operation = "fetch",
) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.statusCode = response.status;
        throw error;
      }

      return response;
    } catch (error) {
      lastError =
        error.name === "AbortError"
          ? new Error(`Request Timeout after ${timeout}ms: ${url}`)
          : error;

      const retryable = isRetryableError(lastError);

      if (retryable && attempt < retries) {
        const delayMs = calculateBackoffDelay(attempt, retryDelay, 10000, 0.5);
        logger.warn(
          { providerId, operation, attempt: attempt + 1, delayMs: Math.round(delayMs) },
          "Provider fetch 失敗，等待後重試"
        );
        await delay(delayMs);
      } else if (!retryable) {
        // 非暫態錯誤，立即拋出不重試
        throw new ProviderError(lastError.message, {
          providerId,
          operation,
          statusCode: lastError.statusCode,
          isRetryable: false,
          cause: lastError,
        });
      }
    } finally {
      clearTimeout(id);
    }
  }

  throw new ProviderError(
    `[fetchWithTimeout] All ${retries} retries failed: ${lastError.message}`,
    {
      providerId,
      operation,
      isRetryable: false,
      cause: lastError,
    },
  );
}
