// runWeeklyReport.mjs
import "dotenv/config";
import {
  loadRecentReports,
  buildPeriodStats,
  generatePeriodAiSummary,
  buildSignalAccuracyStats,
} from "./modules/ai/periodReportAgent.mjs";
import { buildPeriodReportMessages } from "./modules/notifications/templates/periodReportBuilder.mjs";
import { sendTelegramBatch } from "./modules/notifications/transports/telegramClient.mjs";

const sessionId = process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_WORKFLOW}-${process.env.GITHUB_RUN_ID}`
  : `local-weekly-${Date.now()}`;

/**
 * 週報核心邏輯。
 * 提取為独立函數供 Bot 指令與 CLI 共用。
 */
export async function runWeeklyReport() {
  console.log("📊 [WeeklyReport] 開始產生週報...");

  const reports = await loadRecentReports(7);
  console.log(`📂 [WeeklyReport] 載入 ${reports.length} 份近期報告`);

  if (reports.length < 3) {
    const msg = `⚠️ <b>週報產生失敗</b>\n本週可用報告數量不足（${reports.length} 份），無法產生週報。`;
    console.warn("⚠️ [WeeklyReport] 報告數量不足 3 份，跳過週報");
    if (process.env.TELEGRAM_API_TOKEN) await sendTelegramBatch([{ text: msg }]);
    return { skipped: true, reason: "insufficient_reports", count: reports.length };
  }

  const stats = buildPeriodStats(reports, "weekly");
  const accuracyStats = buildSignalAccuracyStats(reports, reports, "weekly");
  const { aiSummary } = await generatePeriodAiSummary(
    stats, reports, `過去 ${reports.length}`, sessionId,
  );
  const messages = buildPeriodReportMessages(stats, aiSummary, "weekly", accuracyStats);

  if (process.env.TELEGRAM_API_TOKEN) {
    await sendTelegramBatch(messages);
    console.log("✅ [WeeklyReport] Telegram 週報發送成功");
  } else {
    console.log("⚠️ [WeeklyReport] TELEGRAM_API_TOKEN 未設定，略過推送");
  }

  console.log("✅ [WeeklyReport] 週報執行完成");
  return { skipped: false, reportCount: reports.length };
}

// ── CLI 入口（直接執行此檔案時）──
async function main() {
  try {
    await runWeeklyReport();
  } catch (err) {
    console.error("❌ [WeeklyReport] 執行失敗:", err.message);
    process.exit(1);
  }
}

main();
