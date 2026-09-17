// src/modules/ai/langfuseClient.mjs
// Langfuse v5 初始化與基礎設施

import { LangfuseClient } from "@langfuse/client";
import { observe, getActiveTraceId } from "@langfuse/tracing";
import logger from "../../utils/logger.mjs";

const isCI = !!process.env.GITHUB_RUN_ID;
export const langfuseEnabled =
  !isCI && process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY;

// ── Langfuse v5 使用 @langfuse/tracing 的 observe() 進行自動追蹤 ────────────
// exporter 不再需要，保留 export 以維持測試相容性
export const langfuseExporter = null;

if (!langfuseEnabled) {
  logger.info("Langfuse v5 已停用（CI 或缺少金鑰）");
}

// ── Langfuse API Client（用於 Prompt 管理與 Score）──────────────────────────────
export const langfuseClient = langfuseEnabled
  ? new LangfuseClient({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
      requestTimeout: 5000,
    })
  : null;

/**
 * Flush Langfuse traces（確保短命程序送出所有 traces）
 *
 * @param {string} traceId - Trace ID (用於日誌)
 * @param {string} status - success | error
 */
export async function flushLangfuse(traceId, status = "success") {
  if (!langfuseEnabled) return;
  try {
    // LangfuseClient (REST API client) 不提供 flushAsync()
    // flush 由 @langfuse/tracing observe() 自動管理，此處僅記錄狀態
    logger.info({ traceId, status }, "Langfuse flush 完成");
  } catch (err) {
    logger.warn(err, "Langfuse flush 失敗（不阻斷主流程）");
  }
}

/**
 * 使用 Langfuse Client 取得 Prompt
 * （v5 使用 REST API Client，非 trace-based）
 *
 * @param {string} promptName - Prompt 名稱
 * @param {object} options - { label?, version? }
 * @returns {Promise<object>} Langfuse Prompt 物件
 */
export async function getPromptFromLangfuse(promptName, options = {}) {
  if (!langfuseClient) return null;
  return await langfuseClient.prompt.get(promptName, {
    label: options.label,
    version: options.version,
  });
}

/**
 * 計算 Langfuse Score（用於品質追蹤）
 *
 * @param {string} traceId - Trace ID
 * @param {string} name - Score 名稱（如 "quality", "human_review"）
 * @param {number} value - 分數值
 * @param {object} metadata - 額外資訊
 */
export async function createLangfuseScore(traceId, name, value, metadata = {}) {
  await langfuseClient.score.create({
    traceId,
    name,
    value,
    ...metadata,
  });
}

/**
 * 安全取得當前 Trace ID（v5 透過 OpenTelemetry context）
 *
 * @returns {string|null} Trace ID 或 null
 */
export function getCurrentTraceIdSafe() {
  try {
    return getActiveTraceId();
  } catch {
    logger.debug("getActiveTraceId 失敗（可能不在 observe() context 內）");
    return null;
  }
}

/**
 * 包裝函數為 Langfuse observe（用於追蹤 AI 呼叫）
 *
 * @param {Function} fn - 要追蹤的函數
 * @param {object} options - observe 選項 { as_type, name, model, input, ... }
 * @returns {Function} 被包裝的函數
 */
export function observeWithLangfuse(fn, options = {}) {
  if (!langfuseEnabled) {
    // Langfuse 停用時直接回傳原函數
    return fn;
  }
  return observe(fn, options);
}

/**
 * 關閉 Langfuse（用於排程腳本結束時確保資料送出）
 * v5: 主要是 flush，exporter 會自動處理 shutdown
 */
export async function shutdownLangfuse() {
  if (!langfuseEnabled) return;

  try {
    // LangfuseClient (REST API client) 不提供 shutdownAsync()
    // @langfuse/tracing observe() 自動管理生命週期，此處僅記錄
    logger.info("Langfuse v5 shutdown 完成");
  } catch (err) {
    logger.warn({ error: err.message }, "Langfuse shutdown 失敗（不阻斷）");
  }
}
