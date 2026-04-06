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

/**
 * 月報核心邏輯。
 * 提取為独立函數供 Bot 指令與 CLI 共用。
 */
export async function runMonthlyReport() {
  console.log("📋 [MonthlyReport] 開始產生月報...");

  const allReports = await loadRecentReports(50);
  console.log(`📂 [MonthlyReport] 載入 ${allReports.length} 份報告（含後續報酬用）`);

  const reports = allReports.slice(-30);
  console.log(`📂 [MonthlyReport] 月報評估期間：${reports.length} 份`);

  if (reports.length < 10) {
    const msg = `⚠️ <b>月報產生失敗</b>\n本月可用報告數量不足（${reports.length} 份），無法產生月報。`;
    console.warn("⚠️ [MonthlyReport] 報告數量不足 10 份，跳過月報");
    if (process.env.TELEGRAM_API_TOKEN) await sendTelegramBatch([{ text: msg }]);
    return { skipped: true, reason: "insufficient_reports", count: reports.length };
  }

  const stats = buildPeriodStats(reports, "monthly");
  const accuracyStats = buildSignalAccuracyStats(reports, allReports, "monthly");
  const { aiSummary } = await generatePeriodAiSummary(
    stats, reports, `過去 ${reports.length}`, sessionId,
  );
  const messages = buildPeriodReportMessages(stats, aiSummary, "monthly", accuracyStats);

  if (process.env.TELEGRAM_API_TOKEN) {
    await sendTelegramBatch(messages);
    console.log("✅ [MonthlyReport] Telegram 月報發送成功");
  } else {
    console.log("⚠️ [MonthlyReport] TELEGRAM_API_TOKEN 未設定，略過推送");
  }

  console.log("✅ [MonthlyReport] 月報執行完成");
  return { skipped: false, reportCount: reports.length };
}

// ── CLI 入口（直接執行此檔案時）──
async function main() {
  try {
    await runMonthlyReport();
  } catch (err) {
    console.error("❌ [MonthlyReport] 執行失敗:", err.message);
    process.exit(1);
  }
}

main();
