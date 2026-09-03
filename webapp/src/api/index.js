/**
 * API 請求模組
 * 支援超時控制、指數退避重試、Telegram initData 驗證
 */

import logger from "../../../src/utils/logger.mjs";
import { triggerAuthExpired } from "../composables/useAuthExpired.js";
import { API_BASE, ENDPOINTS, buildUrl, buildUrlWithQuery } from "./config.js";

const BASE = API_BASE;

// 配置
const REQUEST_TIMEOUT = 10000; // 10 秒超時
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 800; // 基礎重試延遲 (ms)
const MAX_RETRY_DELAY = 5000; // 最大重試延遲 (ms)

/**
 * 延遲函數
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 計算指數退避延遲（帶隨機 jitter）
 * @param {number} attempt - 當前嘗試次數 (0-based)
 * @returns {number} 延遲毫秒數
 */
function getRetryDelay(attempt) {
  const exponentialDelay = BASE_RETRY_DELAY * Math.pow(2, attempt);
  const jitter = Math.random() * 200; // 0-200ms 隨機 jitter
  return Math.min(exponentialDelay + jitter, MAX_RETRY_DELAY);
}

/**
 * 檢查 Telegram WebApp SDK 是否就緒
 * @returns {string|null} initData 或 null
 */
function getInitData() {
  const initData = window.Telegram?.WebApp?.initData;
  if (!initData || initData === "") {
    return import.meta.env.DEV ? "dev-bypass" : null;
  }
  return initData;
}

/**
 * API 請求函數（支援超時、重試、指數退避）
 * @param {string} path - API 路徑
 * @param {Object} options - fetch 選項
 * @returns {Promise<any>} 解析後的 JSON 資料
 * @throws {Error} 請求失敗時拋出錯誤
 */
export async function apiFetch(path, options = {}) {
  // Test environment bypass - skip Telegram initData check and retries
  const isTestEnv =
    typeof window !== "undefined" &&
    (window.__VITEST__ ||
      window.__PLAYWRIGHT__ ||
      process.env.NODE_ENV === "test" ||
      import.meta.env.MODE === "test");

  let lastError;
  const maxRetries = isTestEnv ? 1 : MAX_RETRIES;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // 檢查 Telegram WebApp SDK 是否就緒
    const initData = getInitData();
    if (!initData && !isTestEnv) {
      const errorMsg = "Telegram SDK 未就緒 (initData 為空)";
      logger.error({ traceId: "api-fetch" }, `❌ [apiFetch] ${errorMsg}`);

      if (attempt < maxRetries) {
        const retryDelay = getRetryDelay(attempt);
        logger.info(
          { traceId: "api-fetch", retryDelay },
          `🔄 [apiFetch] 等待 ${Math.round(retryDelay)}ms 後重試...`,
        );
        await delay(retryDelay);
        continue;
      } else {
        throw new Error(errorMsg);
      }
    }

    try {
      const url =
        path.startsWith("http://") || path.startsWith("https://")
          ? path
          : `${BASE}${path}`;
      logger.info(
        {
          traceId: "api-fetch",
          method: options.method || "GET",
          url,
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES + 1,
        },
        `📡 [apiFetch] ${options.method || "GET"} ${url} (attempt ${attempt + 1}/${MAX_RETRIES + 1})`,
      );

      // 建立 AbortController 用於超時控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            "X-Telegram-Init-Data": initData,
            "Content-Type": "application/json",
            ...options.headers,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          const errorMsg = `API ${path} failed: ${response.status} ${response.statusText}`;
          logger.error(
            {
              traceId: "api-fetch",
              path,
              status: response.status,
              statusText: response.statusText,
              errorText,
            },
            `❌ [apiFetch] ${errorMsg}`,
            errorText ? ` - ${errorText}` : "",
          );

          const error = new Error(errorMsg);
          error.status = response.status;
          error.statusText = response.statusText;
          error.body = errorText;
          throw error;
        }

        const data = await response.json();
        logger.info(
          { traceId: "api-fetch", path },
          `✅ [apiFetch] Success: ${path}`,
        );
        return data;
      } catch (fetchError) {
        clearTimeout(timeoutId);

        // 檢查是否為超時錯誤
        if (fetchError.name === "AbortError") {
          throw new Error(`Request timeout: ${path} (>${REQUEST_TIMEOUT}ms)`);
        }

        throw fetchError;
      }
    } catch (err) {
      logger.error(
        { traceId: "api-fetch", path, errorMessage: err.message },
        `❌ [apiFetch] Error: ${err.message}`,
      );
      lastError = err;

      // 401 錯誤：嘗試刷新一次 Telegram initData
      if (err.status === 401 && attempt === 0) {
        logger.warn(
          { traceId: "api-fetch", path },
          "⚠️ [apiFetch] 收到 401 Unauthorized，嘗試重新取得 Telegram initData 並重試...",
        );
        window.Telegram?.WebApp?.ready?.();
        await delay(500);
        continue;
      }

      // 4xx 錯誤不重試（客戶端錯誤）
      if (err.status && err.status >= 400 && err.status < 500) {
        logger.warn(
          { traceId: "api-fetch", path, status: err.status },
          `⚠️ [apiFetch] 4xx 錯誤，停止重試`,
        );
        if (err.status === 401 && !isTestEnv) {
          triggerAuthExpired();
        }
        throw err;
      }

      // 最後一次嘗試
      if (attempt >= MAX_RETRIES) {
        break;
      }

      // 指數退避重試
      const retryDelay = getRetryDelay(attempt);
      logger.info(
        { traceId: "api-fetch", attempt, retryDelay },
        `🔄 [apiFetch] 等待 ${Math.round(retryDelay)}ms 後重試...`,
      );
      await delay(retryDelay);
    }
  }

  throw (
    lastError ?? new Error(`API ${path} failed after ${MAX_RETRIES} retries`)
  );
}

// ─── 公開 API ────────────────────────────────────────────────────────────────────
// 使用集中化配置 (src/api/config.js)

export const fetchReports = (limit = 30) =>
  apiFetch(buildUrlWithQuery(ENDPOINTS.reports.list, { limit }));

export const fetchWeeklyReports = (limit = 12) =>
  apiFetch(buildUrlWithQuery(ENDPOINTS.reports.weekly, { limit }));

export const fetchMonthlyReports = (limit = 12) =>
  apiFetch(buildUrlWithQuery(ENDPOINTS.reports.monthly, { limit }));

export const fetchNews = () => apiFetch(buildUrl(ENDPOINTS.news));

export const fetchStatus = () => apiFetch(buildUrl(ENDPOINTS.status));

export const fetchReportNews = () => apiFetch(buildUrl(ENDPOINTS.reportNews));

// ── Portfolio Snapshots ────────────────────────────────────────────────────────
export const fetchSnapshots = (limit = 90) =>
  apiFetch(buildUrlWithQuery(ENDPOINTS.reports.snapshots.list, { limit }));

export const fetchSnapshotsWeekly = (limit = 52) =>
  apiFetch(buildUrlWithQuery(ENDPOINTS.reports.snapshots.weekly, { limit }));

export const fetchSnapshotsMonthly = (limit = 120) =>
  apiFetch(buildUrlWithQuery(ENDPOINTS.reports.snapshots.monthly, { limit }));

export const fetchStrategyConfig = () =>
  apiFetch(buildUrl(ENDPOINTS.strategyConfig));

export const fetchReportSignals = (date) =>
  apiFetch(buildUrl(ENDPOINTS.reports.signals(date)));

// ── Portfolio Health (Phase 1) ────────────────────────────────────────────────

export const fetchPortfolioHealth = (params = {}) => {
  const query = new URLSearchParams();
  if (params.maintenanceMargin != null)
    query.append("maintenanceMargin", params.maintenanceMargin);
  if (params.z2Ratio != null) query.append("z2Ratio", params.z2Ratio);
  if (params.survivalDropPercent != null)
    query.append("survivalDropPercent", params.survivalDropPercent);
  if (params.currentGrossLeverage != null)
    query.append("currentGrossLeverage", params.currentGrossLeverage);
  if (params.vix != null) query.append("vix", params.vix);
  if (params.macroSentiment != null)
    query.append("macroSentiment", params.macroSentiment);
  if (params.currentAge != null) query.append("currentAge", params.currentAge);

  return apiFetch(
    `/api/portfolio/health${query.toString() ? `?${query.toString()}` : ""}`,
  );
};

// ── Strategy Status (StrategyStatusView: detailed breakdown) ────────────────
export const fetchStrategyStatus = () => apiFetch("/api/strategy-status");
export const updateStrategyConfig = (config) =>
  apiFetch("/api/strategy-config", {
    method: "POST",
    body: JSON.stringify(config),
  });
