// runWeeklyReport.mjs
import "dotenv/config";
import {
  loadRecentReports,
  buildPeriodStats,
  generatePeriodAiSummary,
} from "./modules/ai/periodReportAgent.mjs";
import { buildPeriodReportMessages } from "./modules/notifications/templates/periodReportBuilder.mjs";
import { sendTelegramBatch } from "./modules/notifications/transports/telegramClient.mjs";

const sessionId = process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_WORKFLOW}-${process.env.GITHUB_RUN_ID}`
  : `local-weekly-${Date.now()}`;

async function main() {
  console.log("📊 [WeeklyReport] 開始產生週報...");

  const reports = await loadRecentReports(7);
  console.log(`📂 [WeeklyReport] 載入 ${reports.length} 份近期報告`);

  if (reports.length < 3) {
    console.warn("⚠️ [WeeklyReport] 報告數量不足 3 份，跳過週報");
    if (process.env.TELEGRAM_API_TOKEN) {
      await sendTelegramBatch([
        `⚠️ <b>週報產生失敗</b>\n本週可用報告數量不足（${reports.length} 份），無法產生週報。`,
      ]);
    }
    return;
  }

  const stats = buildPeriodStats(reports, "weekly");
  console.log(`📈 [WeeklyReport] 統計完成，日期範圍：${stats.dateRange.from} ~ ${stats.dateRange.to}`);

  const { aiSummary } = await generatePeriodAiSummary(
    stats,
    reports,
    `過去 ${reports.length}`,
    sessionId,
  );

  const messages = buildPeriodReportMessages(stats, aiSummary, "weekly");

  if (process.env.TELEGRAM_API_TOKEN) {
    await sendTelegramBatch(messages);
    console.log("✅ [WeeklyReport] Telegram 週報發送成功");
  } else {
    console.log("⚠️ [WeeklyReport] TELEGRAM_API_TOKEN 未設定，略過推送");
    console.log("--- 週報預覽 ---");
    messages.forEach((m, i) => console.log(`[訊息 ${i + 1}]\n${m}\n`));
  }

  console.log("✅ [WeeklyReport] 週報執行完成");
}

main().catch((err) => {
  console.error("❌ [WeeklyReport] 執行失敗:", err.message);
  process.exit(1);
});
