// runMonthlyReport.mjs
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
  : `local-monthly-${Date.now()}`;

async function main() {
  console.log("📋 [MonthlyReport] 開始產生月報...");

  // 讀取 30 天用於統計，額外讀取到 50 天用於計算 +20 日報酬
  const allReports = await loadRecentReports(50);
  console.log(`📂 [MonthlyReport] 載入 ${allReports.length} 份報告（含後續報酬用）`);

  // 取最近 30 天作為月報評估期間
  const reports = allReports.slice(-30);
  console.log(`📂 [MonthlyReport] 月報評估期間：${reports.length} 份`);

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

  // 準確率計算：targetReports = 近 30 天，priceSeriesReports = 全部 50 天（含後續價格）
  const accuracyStats = buildSignalAccuracyStats(reports, allReports, "monthly");
  console.log(`🎯 [MonthlyReport] 訊號統計：買進 ${accuracyStats?.buySignalCount ?? 0} 次，冷卻封鎖 ${accuracyStats?.cooldownBlockedCount ?? 0} 次`);

  const { aiSummary } = await generatePeriodAiSummary(
    stats,
    reports,
    `過去 ${reports.length}`,
    sessionId,
  );

  const messages = buildPeriodReportMessages(stats, aiSummary, "monthly", accuracyStats);

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
