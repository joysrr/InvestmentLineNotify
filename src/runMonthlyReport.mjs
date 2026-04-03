// runMonthlyReport.mjs
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
  : `local-monthly-${Date.now()}`;

async function main() {
  console.log("📋 [MonthlyReport] 開始產生月報...");

  const reports = await loadRecentReports(30);
  console.log(`📂 [MonthlyReport] 載入 ${reports.length} 份近期報告`);

  if (reports.length < 10) {
    console.warn("⚠️ [MonthlyReport] 報告數量不足 10 份，跳過月報");
    if (process.env.TELEGRAM_API_TOKEN) {
      await sendTelegramBatch([
        `⚠️ <b>月報產生失敗</b>\n本月可用報告數量不足（${reports.length} 份），無法產生月報。`,
      ]);
    }
    return;
  }

  const stats = buildPeriodStats(reports, "monthly");
  console.log(`📈 [MonthlyReport] 統計完成，日期範圍：${stats.dateRange.from} ~ ${stats.dateRange.to}`);

  const { aiSummary } = await generatePeriodAiSummary(
    stats,
    reports,
    `過去 ${reports.length}`,
    sessionId,
  );

  const messages = buildPeriodReportMessages(stats, aiSummary, "monthly");

  if (process.env.TELEGRAM_API_TOKEN) {
    await sendTelegramBatch(messages);
    console.log("✅ [MonthlyReport] Telegram 月報發送成功");
  } else {
    console.log("⚠️ [MonthlyReport] TELEGRAM_API_TOKEN 未設定，略過推送");
    console.log("--- 月報預覽 ---");
    messages.forEach((m, i) => console.log(`[訊息 ${i + 1}]\n${m}\n`));
  }

  console.log("✅ [MonthlyReport] 月報執行完成");
}

main().catch((err) => {
  console.error("❌ [MonthlyReport] 執行失敗:", err.message);
  process.exit(1);
});
