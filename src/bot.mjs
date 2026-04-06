/**
 * bot.mjs — Telegram Bot 長駐入口點
 *
 * 架構說明：
 * - 使用 grammY 框架，Long-Polling 模式（不需要 HTTPS 公開 URL）。
 * - 所有指令皆需通過 adminGuard middleware（白名單：TELEGRAM_USER_ID）。
 * - 排程功能（GitHub Actions Cron）維持原有機制不變，Bot 僅處理即時指令。
 * - 啟動方式：node src/bot.mjs  或  npm run bot
 *
 * 實作指令：
 *   /start    — 歡迎訊息
 *   /help     — 列出指令
 *   /status   — 查看最新市場快取（零 API 消耗）
 *   /daily    — 手動觸發每日報告
 *   /news     — 手動更新新聞池
 *   /weekly   — 手動觸發週報
 *   /monthly  — 手動觸發月報
 *   /optimize — 手動觸發規則優化器
 */

import "dotenv/config";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { Bot } from "grammy";
import { adminGuard } from "./modules/bot/middleware/adminGuard.mjs";
import { acquireLock, releaseLock } from "./modules/bot/runnerLock.mjs";
import { dailyCheck } from "./dailyCheck.mjs";
import { runNewsFetch } from "./runNewsFetch.mjs";
import { runWeeklyReport } from "./runWeeklyReport.mjs";
import { runMonthlyReport } from "./runMonthlyReport.mjs";
import { runRuleOptimizer } from "./modules/ai/ruleOptimizerAgent.mjs";
import { broadcastOptimizerResult } from "./modules/notifications/notifier.mjs";
import { langfuse } from "./modules/ai/aiClient.mjs";

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

// ── 輔助函數：執行 runner 并回覆結果 ───────────────────
/**
 * 包裝 runner 執行流程：取 lock → 執行 → 釋放 lock → 回覆成功/失敗
 * @param {import('grammy').Context} ctx
 * @param {string} runnerName - 顯示用名稱
 * @param {Function} fn - async runner 函數
 */
async function withRunner(ctx, runnerName, fn) {
  const lock = acquireLock(runnerName);
  if (!lock.acquired) {
    await ctx.reply(lock.message, { parse_mode: "HTML" });
    return;
  }

  await ctx.reply(`⏳ <b>${runnerName}</b> 開始執行，請稍候...`, { parse_mode: "HTML" });

  try {
    await fn();
    await ctx.reply(`✅ <b>${runnerName}</b> 執行完成。`, { parse_mode: "HTML" });
  } catch (err) {
    console.error(`[Bot] ❌ ${runnerName} 執行失敗:`, err);
    await ctx.reply(
      `❌ <b>${runnerName}</b> 執行失敗。\n<code>${err.message}</code>`,
      { parse_mode: "HTML" }
    );
  } finally {
    releaseLock();
  }
}

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
      "/status — 查看最新市場快取（零 API 消耗）",
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

// ── 指令：/status ──────────────────────────────────────────
bot.command("status", async (ctx) => {
  const latestPath = join(process.cwd(), "data", "market", "latest.json");

  if (!existsSync(latestPath)) {
    await ctx.reply("⚠️ 尚無市場快取資料，請先執行 /daily 。");
    return;
  }

  try {
    const data = JSON.parse(readFileSync(latestPath, "utf-8"));
    const lines = [
      "📊 <b>最新市場快取</b>",
      "",
    ];

    // 快取時間
    if (data.fetchedAt || data.updatedAt) {
      lines.push(`🕒 更新時間：<code>${data.fetchedAt ?? data.updatedAt}</code>`);
      lines.push("");
    }

    // 0050 價格
    const price0050 = data.price0050 ?? data.tw0050?.price ?? data["0050"]?.price;
    if (price0050 != null) lines.push(`🏆 0050：<b>${price0050}</b>`);

    // 00675L 價格
    const priceZ2 = data.price00675L ?? data.tw00675L?.price ?? data["00675L"]?.price;
    if (priceZ2 != null) lines.push(`⚡  00675L：<b>${priceZ2}</b>`);

    // VIX
    const vix = data.vix ?? data.fearGreed?.vix;
    if (vix != null) lines.push(`🟡 VIX：<b>${vix}</b>`);

    // Fear & Greed
    const fg = data.fearGreedIndex ?? data.fearGreed?.value;
    if (fg != null) lines.push(`🟢 Fear & Greed：<b>${fg}</b>`);

    if (lines.length <= 2) {
      lines.push("資料格式異常，請異常報告給開發者。");
    }

    await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
  } catch (err) {
    await ctx.reply(`❌ 讀取市場快取失敗：<code>${err.message}</code>`, { parse_mode: "HTML" });
  }
});

// ── 指令：/daily ──────────────────────────────────────────
bot.command("daily", async (ctx) => {
  await withRunner(ctx, "每日報告 (daily)", () =>
    dailyCheck({ isTelegramEnabled: true, isAIAdvisor: true })
  );
});

// ── 指令：/news ────────────────────────────────────────────
bot.command("news", async (ctx) => {
  await withRunner(ctx, "新聞更新 (news)", runNewsFetch);
});

// ── 指令：/weekly ─────────────────────────────────────────
bot.command("weekly", async (ctx) => {
  await withRunner(ctx, "週報 (weekly)", runWeeklyReport);
});

// ── 指令：/monthly ────────────────────────────────────────
bot.command("monthly", async (ctx) => {
  await withRunner(ctx, "月報 (monthly)", runMonthlyReport);
});

// ── 指令：/optimize ───────────────────────────────────────
bot.command("optimize", async (ctx) => {
  await withRunner(ctx, "規則優化器 (optimize)", async () => {
    const result = await runRuleOptimizer();
    await broadcastOptimizerResult(result, null).catch(() => {});
  });
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
  langfuse.shutdownAsync().catch(() => {});
});
process.once("SIGTERM", () => {
  console.log("[Bot] 🛑 收到 SIGTERM，正在關閉...");
  bot.stop();
  langfuse.shutdownAsync().catch(() => {});
});
