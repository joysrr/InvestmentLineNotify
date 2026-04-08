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
 *
 * Phase 2-C 新增：
 *   - setMyCommands：Bot 啟動時同步指令選單至 Telegram（/start 不列入）
 *   - /status Inline Button：有 MINI_APP_URL 時附加「開啟儀表板」WebApp 按鈕
 *   - setChatMenuButton：有 MINI_APP_URL 時設定左下角 Menu Button 指向 Mini App
 */

import "dotenv/config";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { Bot, InlineKeyboard } from "grammy";
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

// ── Mini App URL（可選，未設定時相關功能自動略過）───────────
const MINI_APP_URL = process.env.MINI_APP_URL?.trim() || null;

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

// ── Bot API 初始化任務（啟動後執行，失敗不中斷 Bot）─────────
/**
 * 同步指令選單至 Telegram。
 * /start 不列入選單（初次互動專用，不需出現在日常清單）。
 * 失敗時僅 log，不影響 Bot 正常運作。
 */
async function syncBotCommands() {
  try {
    await bot.api.setMyCommands([
      { command: "status",   description: "查看最新市場快取狀態" },
      { command: "daily",    description: "手動觸發每日報告（含 AI 分析）" },
      { command: "news",     description: "手動更新新聞池" },
      { command: "weekly",   description: "手動觸發週報" },
      { command: "monthly",  description: "手動觸發月報" },
      { command: "optimize", description: "手動觸發規則優化器" },
      { command: "help",     description: "顯示指令說明" },
    ]);
    console.log("[Bot] ✅ setMyCommands 同步完成。");
  } catch (err) {
    console.warn("[Bot] ⚠️ setMyCommands 失敗（不影響 Bot 運作）:", err.message);
  }
}

/**
 * 設定 Chat Menu Button（左下角按鈕）。
 * 僅在 MINI_APP_URL 已設定時執行。
 * - type "web_app"：開啟 Mini App。
 * - 使用 chat_id 指定單一使用者，避免影響其他對話。
 * - 失敗時僅 log，不中斷 Bot。
 * - TELEGRAM_USER_ID 格式異常時跳過並警告，防止 API 呼叫傳入 NaN。
 */
async function syncMenuButton() {
  if (!MINI_APP_URL) return;

  const rawUserId = process.env.TELEGRAM_USER_ID;
  const chatId = Number(rawUserId);

  if (!rawUserId || !Number.isFinite(chatId)) {
    console.warn(
      "[Bot] ⚠️ setChatMenuButton 略過：TELEGRAM_USER_ID 未設定或格式異常",
      `（值：${rawUserId}）`
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
    console.log(`[Bot] ✅ setChatMenuButton 設定完成（Mini App：${MINI_APP_URL}）。`);
  } catch (err) {
    console.warn("[Bot] ⚠️ setChatMenuButton 失敗（不影響 Bot 運作）:", err.message);
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

    // Inline Button：有 MINI_APP_URL 時附加「開啟儀表板」WebApp 按鈕
    const replyMarkup = MINI_APP_URL
      ? new InlineKeyboard().webApp("📊 開啟儀表板", MINI_APP_URL)
      : undefined;

    await ctx.reply(lines.join("\n"), { parse_mode: "HTML", reply_markup: replyMarkup });
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
  onStart: async (botInfo) => {
    console.log(`[Bot] ✅ 已連線：@${botInfo.username}`);
    console.log(`[Bot] 🔒 白名單 chat_id：${process.env.TELEGRAM_USER_ID}`);
    if (MINI_APP_URL) {
      console.log(`[Bot] 📱 Mini App URL：${MINI_APP_URL}`);
    }
    // 同步指令選單與 Menu Button（失敗不中斷 Bot）
    await syncBotCommands();
    await syncMenuButton();
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
