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
 *   /status_debug   — 查看最新市場快取（含來源狀態，供除錯用）
 *   /daily    — 手動觸發每日報告
 *   /news     — 手動更新新聞池
 *   /weekly   — 手動觸發週報
 *   /monthly  — 手動觸發月報
 *   /optimize — 手動觸發規則優化器
 *
 * latest.json 結構：
 *   { _meta: { lastRun, sources }, data: { rawCnn, rawUsMarket, rawNdc, rawMargin, rawFx, rawValuation, quote } }
 */

import "dotenv/config";
import {
  handleStatus,
  handleStatusDebug,
} from "./modules/bot/handlers/statusHandlers.mjs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
import { Bot, InlineKeyboard } from "grammy";
import logger from "./utils/logger.mjs";
import { adminGuard } from "./modules/bot/middleware/adminGuard.mjs";
import {
  acquireLock,
  releaseLock,
  registerShutdownHandlers,
} from "./modules/bot/runnerLock.mjs";
import { dailyCheck } from "./dailyCheck.mjs";
import { runNewsFetch } from "./runNewsFetch.mjs";
import { runWeeklyReport } from "./runWeeklyReport.mjs";
import { runMonthlyReport } from "./runMonthlyReport.mjs";
import { runRuleOptimizer } from "./modules/ai/ruleOptimizerAgent.mjs";
import { broadcastOptimizerResult } from "./modules/notifications/notifier.mjs";
import { langfuse } from "./modules/ai/aiClient.mjs";

// ── 註冊進程終止處理器（啟動初期）──────────────────────────────────────────
registerShutdownHandlers();

// ── 環境變數檢查 ───────────────────────────────────────────────────────────
const token = process.env.TELEGRAM_API_TOKEN;
if (!token) {
  logger.error("TELEGRAM_API_TOKEN 未設定，無法啟動");
  process.exit(1);
}

// ── Mini App URL（可選，未設定時相關功能自動略過）───────────────────────────
const MINI_APP_URL = process.env.MINI_APP_URL?.trim() || null;

// ── Bot 初始化 ─────────────────────────────────────────────────────────────
const bot = new Bot(token);

// ── 白名單 Middleware（所有指令套用）──────────────────────────────────────
bot.use(adminGuard);

// ── 輔助函數：執行 runner 並回覆結果 ──────────────────────────────────────
/**
 * 包裝 runner 執行流程：取 lock → 執行 → 釋放 lock → 回覆成功/失敗
 * @param {import('grammy').Context} ctx
 * @param {string} runnerName - 顯示用名稱
 * @param {Function} fn - async runner 函數
 * @param {Object} options - 選項
 * @param {number} options.maxConcurrent - 最大並發數
 */
async function withRunner(ctx, runnerName, fn, options = {}) {
  const { maxConcurrent = 2 } = options;

  const lock = await acquireLock(runnerName, { maxConcurrent });
  if (!lock.acquired) {
    await ctx.reply(lock.message, { parse_mode: "HTML" });
    return;
  }

  await ctx.reply(`⏳ <b>${runnerName}</b> 開始執行，請稍候...`, {
    parse_mode: "HTML",
  });

  try {
    const resultMsg = await fn();
    const replyText = resultMsg
      ? `✅ <b>${runnerName}</b> 執行完成。\n\n${resultMsg}`
      : `✅ <b>${runnerName}</b> 執行完成。`;
    await ctx.reply(replyText, {
      parse_mode: "HTML",
    });
  } catch (err) {
    logger.error({ runnerName, error: err }, "Bot runner 執行失敗");
    await ctx.reply(
      `❌ <b>${runnerName}</b> 執行失敗。\n<code>${err.message}</code>`,
      { parse_mode: "HTML" },
    );
  } finally {
    releaseLock(runnerName);
  }
}

// ── Bot API 初始化任務（啟動後執行，失敗不中斷 Bot）────────────────────────
async function syncBotCommands() {
  try {
    await bot.api.setMyCommands([
      { command: "status", description: "查看最新市場快取狀態" },
      {
        command: "status_debug",
        description: "查看最新市場快取（含來源狀態，供除錯用）",
      },
      { command: "daily", description: "手動觸發每日報告（含 AI 分析）" },
      { command: "news", description: "手動更新新聞池" },
      { command: "weekly", description: "手動觸發週報" },
      { command: "monthly", description: "手動觸發月報" },
      { command: "optimize", description: "手動觸發規則優化器" },
      { command: "help", description: "顯示指令說明" },
    ]);
    logger.info("Bot setMyCommands 同步完成");
  } catch (err) {
    logger.warn(
      { error: err.message },
      "Bot setMyCommands 失敗（不影響 Bot 運作）",
    );
  }
}

async function syncMenuButton() {
  if (!MINI_APP_URL) return;

  const rawUserId = process.env.TELEGRAM_USER_ID;
  const chatId = Number(rawUserId);

  if (!rawUserId || !Number.isFinite(chatId)) {
    logger.warn(
      { rawUserId },
      "Bot setChatMenuButton 略過：TELEGRAM_USER_ID 未設定或格式異常",
    );
    return;
  }

  try {
    await bot.api.setChatMenuButton({
      chat_id: chatId,
      menu_button: {
        type: "web_app",
        text: "📊 儀表板",
        web_app: { url: MINI_APP_URL },
      },
    });
    logger.info({ miniAppUrl: MINI_APP_URL }, "Bot setChatMenuButton 設定完成");
  } catch (err) {
    logger.warn(
      { error: err.message },
      "Bot setChatMenuButton 失敗（不影響 Bot 運作）",
    );
  }
}

// ── 指令：/start ──────────────────────────────────────────────────────────
bot.command("start", async (ctx) => {
  await ctx.reply(
    [
      "🤖 <b>InvestmentLineNotify Bot</b> 已上線！",
      "",
      "這是你的專屬投資助理，可隨時透過指令獲取市場資訊與 AI 分析。",
      "輸入 /help 查看所有可用指令。",
    ].join("\n"),
    { parse_mode: "HTML" },
  );
});

// ── 指令：/help ───────────────────────────────────────────────────────────
bot.command("help", async (ctx) => {
  await ctx.reply(
    [
      "📖 <b>可用指令清單</b>",
      "",
      "<b>── 即時查詢 ──</b>",
      "/status — 查看最新市場快取（零 API 消耗）",
      "/status_debug — 查看最新市場快取（含來源狀態，供除錯用）",
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
    { parse_mode: "HTML" },
  );
});

// ── 指令：/status ─────────────────────────────────────────────────────────
bot.command("status", (ctx) => handleStatus(ctx, MINI_APP_URL));

// ── 指令：/status_debug ─────────────────────────────────────────────────────
bot.command("status_debug", handleStatusDebug);

// ── 指令：/daily ──────────────────────────────────────────────────────────
bot.command("daily", async (ctx) => {
  await withRunner(ctx, "每日報告 (daily)", async () =>
    dailyCheck({ isTelegramEnabled: true, isAIAdvisor: true }),
  );
});

// ── 指令：/news ───────────────────────────────────────────────────────────
bot.command("news", async (ctx) => {
  await withRunner(ctx, "新聞更新 (news)", async () => {
    const res = await runNewsFetch();
    return `新增: ${res.appended} 篇\npool 總量: ${res.total} 篇`;
  });
});

// ── 指令：/weekly ─────────────────────────────────────────────────────────
bot.command("weekly", async (ctx) => {
  await withRunner(ctx, "週報 (weekly)", async () => await runWeeklyReport());
});

// ── 指令：/monthly ────────────────────────────────────────────────────────
bot.command("monthly", async (ctx) => {
  await withRunner(ctx, "月報 (monthly)", async () => await runMonthlyReport());
});

// ── 指令：/optimize ───────────────────────────────────────────────────────
bot.command("optimize", async (ctx) => {
  await withRunner(ctx, "規則優化器 (optimize)", async () => {
    const result = await runRuleOptimizer();
    await broadcastOptimizerResult(result, null).catch(() => {});
  });
});

// ── 錯誤處理 ──────────────────────────────────────────────────────────────
bot.catch(async (err) => {
  const ctx = err.ctx;
  logger.error(
    { updateId: ctx.update.update_id, error: err.error },
    "Bot 處理 update 時發生錯誤",
  );
  try {
    if (ctx && ctx.reply) {
      await ctx.reply(
        "❌ 抱歉，處理您的指令時發生未預期的錯誤。請查看系統日誌。",
        { parse_mode: "HTML" },
      );
    }
  } catch (e) {
    logger.error({ error: e }, "Bot 嘗試回覆錯誤訊息時再度失敗");
  }
});

// ── 啟動 Bot（Long-Polling）──────────────────────────────────────────────
logger.info("Bot 啟動中（Long-Polling 模式）");
bot.start({
  drop_pending_updates: true,
  onStart: async (botInfo) => {
    logger.info({ username: botInfo.username }, "Bot 已連線");
    logger.info({ chatId: process.env.TELEGRAM_USER_ID }, "Bot 白名單 chat_id");
    if (MINI_APP_URL) {
      logger.info({ miniAppUrl: MINI_APP_URL }, "Bot Mini App URL");
    }
    await syncBotCommands();
    await syncMenuButton();
  },
});

// ── 優雅關閉（SIGINT / SIGTERM）──────────────────────────────────────────
process.once("SIGINT", () => {
  logger.info("Bot 收到 SIGINT，正在關閉...");
  bot.stop();
  langfuse.shutdownAsync().catch(() => {});
});
process.once("SIGTERM", () => {
  logger.info("Bot 收到 SIGTERM，正在關閉...");
  bot.stop();
  langfuse.shutdownAsync().catch(() => {});
});
