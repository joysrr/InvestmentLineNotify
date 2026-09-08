/**
 * Langfuse v5 Client 初始化與封裝
 *
 * 遷移自 langfuse@3.38.20 到 @langfuse/tracing@5.11.0 + @langfuse/otel@5.11.0
 *
 * v5 架構：基於 OpenTelemetry，使用 observe() decorator 或手動 span 管理
 */

import { LangfuseExporter } from "@langfuse/otel";
import { LangfuseAPIClient } from "@langfuse/client";
import { flush } from "@langfuse/tracing";
import logger from "../../utils/logger.mjs";

// ── Langfuse OTEL Exporter（自動送出 traces）─────────────────────────────────
export const langfuseExporter = new LangfuseExporter({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",

  // 短命程序設定：每次呼叫立即送出
  flushAt: 1,
  flushInterval: 1000, // 1 秒

  // 可選：debug mode
  debug: process.env.LANGFUSE_DEBUG === "true",
});

// ── Langfuse API Client（用於 Prompt 管理與 Score）──────────────────────────
export const langfuseClient = new LangfuseAPIClient({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
});

/**
 * Flush Langfuse traces（確保短命程序送出所有 traces）
 *
 * @param {string} traceId - Trace ID (用於日誌)
 * @param {string} status - success | error
 */
export async function flushLangfuse(traceId, status = "success") {
  try {
    await flush();
    logger.info({ traceId, status }, "Langfuse flush 完成");
  } catch (err) {
    logger.warn(
      { traceId, error: err.message },
      "Langfuse flush 失敗（不阻斷主流程）",
    );
  }
}

/**
 * 取得 Langfuse Prompt（v5 API Client）
 *
 * @param {string} promptName - Prompt 名稱
 * @param {object} options - { label?, version? }
 * @returns {Promise<object>} Prompt 物件
 */
export async function getLangfusePrompt(promptName, options = {}) {
  try {
    const prompt = await langfuseClient.prompts.get(promptName, {
      label: options.label || "production",
      version: options.version,
    });

    logger.debug(
      { promptName, version: prompt.version, label: options.label },
      "Langfuse prompt 取得成功",
    );

    return prompt;
  } catch (err) {
    logger.error(
      { promptName, error: err.message },
      "Langfuse prompt 取得失敗",
    );
    throw err;
  }
}

/**
 * 寫入 Score 至 Langfuse（v5 API Client）
 *
 * @param {object} payload - { traceId, observationId?, name, value, comment? }
 */
export async function writeLangfuseScore(payload) {
  try {
    await langfuseClient.score.create({
      traceId: payload.traceId,
      observationId: payload.observationId,
      name: payload.name,
      value: payload.value,
      comment: payload.comment,
    });

    logger.debug(
      { traceId: payload.traceId, name: payload.name, value: payload.value },
      "Langfuse score 寫入成功",
    );
  } catch (err) {
    logger.warn(
      { name: payload.name, error: err.message },
      "Langfuse score 寫入失敗（不阻斷主流程）",
    );
  }
}
