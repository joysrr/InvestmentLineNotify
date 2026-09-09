// runMonthlyReport.mjs
import "dotenv/config";
import { fileURLToPath } from "url";
import {
  loadRecentReports,
  buildPeriodStats,
  generatePeriodAiSummary,
  buildSignalAccuracyStats,
} from "./modules/ai/periodReportAgent.mjs";
import {
  buildPeriodReportMessages,
  buildCompactPeriodMessage,
} from "./modules/notifications/templates/periodReportBuilder.mjs";
import { sendTelegramBatch } from "./modules/notifications/transports/telegramClient.mjs";
import { shutdownLangfuse } from "./modules/ai/langfuseClient.mjs";
import logger from "./utils/logger.mjs";

const sessionId = process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_WORKFLOW}-${process.env.GITHUB_RUN_ID}`
  : `local-monthly-${Date.now()}`;

/**
 * 月報核心邏輯。
 * 發送策略：
 *   - TELEGRAM_WEBAPP_URL 已設定 → buildCompactPeriodMessage() （1 則 + WebApp 按鈕）
 *   - TELEGRAM_WEBAPP_URL 未設定 → buildPeriodReportMessages()  （原杧3 則）
 */
export async function runMonthlyReport() {
  logger.info("📋 [MonthlyReport] 開始產生月報...");

  // 載入 50 份是為了提供足夠的歷史資料來計算「後續報酬 (accuracyStats)」。
  const allReports = await loadRecentReports(50);
  logger.info(
    `📂 [MonthlyReport] 載入 ${allReports.length} 份報告（含後續報酬用）`,
  );

  // 但我們只取最後的 30 份（約一個月的交易日）作為本次月報的評估主體。
  const reports = allReports.slice(-30);
  logger.info(`📂 [MonthlyReport] 月報評估期間：${reports.length} 份`);

  if (reports.length < 10) {
    const msg = `⚠️ <b>月報產生失敗</b>\n本月可用報告數量不足（${reports.length} 份），無法產生月報。`;
    logger.warn("⚠️ [MonthlyReport] 報告數量不足 10 份，跳過月報");
    if (process.env.TELEGRAM_API_TOKEN)
      await sendTelegramBatch([{ text: msg }]);
    return {
      skipped: true,
      reason: "insufficient_reports",
      count: reports.length,
    };
  }

  const stats = buildPeriodStats(reports, "monthly");
  const accuracyStats = buildSignalAccuracyStats(
    reports,
    allReports,
    "monthly",
  );

  let aiSummary = null;
  try {
    const result = await generatePeriodAiSummary(
      stats,
      reports,
      `過去 ${reports.length}`,
      sessionId,
    );
    aiSummary = result.aiSummary;
  } catch (err) {
    logger.warn(
      err,
      "⚠️ [MonthlyReport] AI 摘要產生失敗，將降級發送純統計報告",
    );
  }

  const webAppUrl = process.env.TELEGRAM_WEBAPP_URL || null;

  let messages;
  if (webAppUrl) {
    messages = buildCompactPeriodMessage(
      stats,
      aiSummary,
      "monthly",
      webAppUrl,
    );
    logger.info("[MonthlyReport] MiniApp 模式：發送精簡月報卡");
  } else {
    messages = buildPeriodReportMessages(
      stats,
      aiSummary,
      "monthly",
      accuracyStats,
    );
    logger.info("[MonthlyReport] 完整模式：發送 3 則月報");
  }

  if (process.env.TELEGRAM_API_TOKEN) {
    await sendTelegramBatch(messages);
    logger.info("✅ [MonthlyReport] Telegram 月報發送成功");
  } else {
    logger.warn("⚠️ [MonthlyReport] TELEGRAM_API_TOKEN 未設定，略過推送");
  }

  logger.info("✅ [MonthlyReport] 月報執行完成");
  return { skipped: false, reportCount: reports.length };
}

// ── CLI 入口（直接執行此檔案時）──
async function main() {
  try {
    await runMonthlyReport();
  } catch (err) {
    logger.error(err, "❌ [MonthlyReport] 執行失敗");
    process.exit(1);
  } finally {
    logger.info("🔒 [MonthlyReport] 正在關閉 Langfuse...");
    try {
      await shutdownLangfuse();
      logger.info("✅ [MonthlyReport] Langfuse 已關閉");
    } catch (e) {
      logger.warn(e, "⚠️ Langfuse 關閉失敗");
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
