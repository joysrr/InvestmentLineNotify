/**
 * bot.mjs — Telegram Bot 長駐入口點
 *
 * 架構說明：
 * - 使用 grammY 框架，Long-Polling 模式（不需要 HTTPS 公開 URL）。
 * - 所有指令皆需通過 adminGuard middleware（白名單：TELEGRAM_USER_ID）。
 * - 排程功能（GitHub Actions Cron）維持原有機制不變，Bot 僅處理即時指令。
 * - 啟動方式：node src/bot.mjs  或  npm run bot
 *
 * 目前實作指令（Phase 1-A）：
 *   /start  — 歡迎訊息，確認 Bot 上線
 *   /help   — 列出所有可用指令
 *
 * Phase 1-B 將加入：
 *   /status, /daily, /weekly, /monthly, /news, /optimize
 */

import "dotenv/config";
import { Bot } from "grammy";
import { adminGuard } from "./modules/bot/middleware/adminGuard.mjs";

// ── 環境變數檢查 ───────────────────────────────────────────
const token = process.env.TELEGRAM_API_TOKEN;
if (!token) {
  console.error("[Bot] ❌ TELEGRAM_API_TOKEN 未設定，無法啟動。");
  process.exit(1);
}

// ── Bot 初始化 ─────────────────────────────────────────────
const bot = new Bot(token);

// ── 白名單 Middleware（所有指令套用）──────────────────────
bot.use(adminGuard);

// ── 指令：/start ───────────────────────────────────────────
bot.command("start", async (ctx) => {
  await ctx.reply(
    [
      "🤖 <b>InvestmentLineNotify Bot</b> 已上線！",
      "",
      "這是你的專屬投資助理，可隨時透過指令獲取市場資訊與 AI 分析。",
      "輸入 /help 查看所有可用指令。",
    ].join("\n"),
    { parse_mode: "HTML" }
  );
});

// ── 指令：/help ────────────────────────────────────────────
bot.command("help", async (ctx) => {
  await ctx.reply(
    [
      "📖 <b>可用指令清單</b>",
      "",
      "<b>── 即時查詢 ──</b>",
      "/status — 查看最新市場快取狀態",
      "",
      "<b>── 手動觸發排程 ──</b>",
      "/daily — 執行每日報告（含 AI 分析）",
      "/news — 更新新聞池",
      "/weekly — 生成週報",
      "/monthly — 生成月報",
      "/optimize — 執行規則優化器",
      "",
      "<b>── 說明 ──</b>",
      "/start — 顯示歡迎訊息",
      "/help — 顯示此說明",
      "",
      "⚠️ 觸發排程類指令會消耗 API 額度，請謹慎使用。",
    ].join("\n"),
    { parse_mode: "HTML" }
  );
});

// ── 錯誤處理 ───────────────────────────────────────────────
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`[Bot] ❌ 處理 update ${ctx.update.update_id} 時發生錯誤：`);
  console.error(err.error);
});

// ── 啟動 Bot（Long-Polling）────────────────────────────────
console.log("[Bot] 🚀 Bot 啟動中（Long-Polling 模式）...");
bot.start({
  onStart: (botInfo) => {
    console.log(`[Bot] ✅ 已連線：@${botInfo.username}`);
    console.log(`[Bot] 🔒 白名單 chat_id：${process.env.TELEGRAM_USER_ID}`);
  },
});

// ── 優雅關閉（SIGINT / SIGTERM）────────────────────────────
process.once("SIGINT", () => {
  console.log("[Bot] 🛑 收到 SIGINT，正在關閉...");
  bot.stop();
});
process.once("SIGTERM", () => {
  console.log("[Bot] 🛑 收到 SIGTERM，正在關閉...");
  bot.stop();
});
