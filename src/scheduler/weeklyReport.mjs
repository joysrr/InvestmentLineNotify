// src/scheduler/weeklyReport.mjs
// 週報核心邏輯
// 發送策略：
//   - TELEGRAM_WEBAPP_URL 已設定 → buildCompactPeriodMessage() （1 則 + WebApp 按鈕）
//   - TELEGRAM_WEBAPP_URL 未設定 → buildPeriodReportMessages()  （原本 2 則）

import { fileURLToPath } from "url";
import {
  loadRecentReports,
  buildPeriodStats,
  generatePeriodAiSummary,
  buildSignalAccuracyStats,
} from "../modules/ai/periodReportAgent.mjs";
import {
  buildPeriodReportMessages,
  buildCompactPeriodMessage,
} from "../modules/notifications/templates/periodReportBuilder.mjs";
import { sendTelegramBatch } from "../modules/notifications/transports/telegramClient.mjs";
import { shutdownLangfuse } from "../modules/ai/langfuseClient.mjs";
import logger from "../utils/logger.mjs";

/**
 * 週報核心邏輯
 * @param {Object} deps - 依賴注入物件
 * @param {Object} deps.dataProvider - 符合 IDataProvider 介面
 * @param {Object} deps.aiProvider - 符合 IAIProvider 介面
 * @param {Object} deps.notifier - 符合 INotifier 介面
 * @returns {Promise<Object>} 執行結果
 */
export async function runWeeklyReport(deps = {}) {
  const { _dataProvider, _aiProvider, _notifier } = deps;

  logger.info("📊 [WeeklyReport] 開始產生週報...");

  const reports = await loadRecentReports(7);
  logger.info(`📂 [WeeklyReport] 載入 ${reports.length} 份近期報告`);

  if (reports.length < 3) {
    const msg = `⚠️ <b>週報產生失敗</b>\n本週可用報告數量不足（${reports.length} 份），無法產生週報。`;
    logger.warn("⚠️ [WeeklyReport] 報告數量不足 3 份，跳過週報");
    if (process.env.TELEGRAM_API_TOKEN) {
      await sendTelegramBatch([{ text: msg }]);
    }
    return {
      skipped: true,
      reason: "insufficient_reports",
      count: reports.length,
    };
  }

  const stats = buildPeriodStats(reports, "weekly");
  const accuracyStats = buildSignalAccuracyStats(reports, reports, "weekly");

  let aiSummary = null;
  try {
    const result = await generatePeriodAiSummary(
      stats,
      reports,
      `過去 ${reports.length}`,
      `local-weekly-${Date.now()}`,
    );
    aiSummary = result.aiSummary;
  } catch (err) {
    logger.warn(err, "⚠️ [WeeklyReport] AI 摘要產生失敗，將降級發送純統計報告");
  }

  const webAppUrl = process.env.TELEGRAM_WEBAPP_URL || null;

  let messages;
  if (webAppUrl) {
    messages = buildCompactPeriodMessage(stats, aiSummary, "weekly", webAppUrl);
    logger.info("[WeeklyReport] MiniApp 模式：發送精簡週報卡");
  } else {
    messages = buildPeriodReportMessages(
      stats,
      aiSummary,
      "weekly",
      accuracyStats,
    );
    logger.info("[WeeklyReport] 完整模式：發送 2 則週報");
  }

  if (process.env.TELEGRAM_API_TOKEN) {
    await sendTelegramBatch(messages);
    logger.info("✅ [WeeklyReport] Telegram 週報發送成功");
  } else {
    logger.warn("⚠️ [WeeklyReport] TELEGRAM_API_TOKEN 未設定，略過推送");
  }

  logger.info("✅ [WeeklyReport] 週報執行完成");
  return { skipped: false, reportCount: reports.length };
}

// ── CLI 入口（直接執行此檔案時）──
async function main() {
  try {
    await runWeeklyReport({});
  } catch (err) {
    logger.error(err, "❌ [WeeklyReport] 執行失敗");
    process.exit(1);
  } finally {
    logger.info("🔒 [WeeklyReport] 正在關閉 Langfuse...");
    try {
      await shutdownLangfuse();
      logger.info("✅ [WeeklyReport] Langfuse 已關閉");
    } catch (e) {
      logger.warn(e, "⚠️ Langfuse 關閉失敗");
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
