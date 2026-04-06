/**
 * adminGuard.mjs
 * grammY middleware：白名單守衛
 *
 * 只允許 TELEGRAM_USER_ID 對應的 chat 傳送指令。
 * 其他來源的訊息一律靜默忽略（不回應，不記錄，避免暴露系統存在）。
 *
 * 設計原則：
 * - 沿用既有的 TELEGRAM_USER_ID env var，不新增 ADMIN_CHAT_ID。
 * - 僅在 chat.id 層級過濾，適用 private chat 與群組皆可。
 * - 若 TELEGRAM_USER_ID 未設定，直接拒絕所有請求並印出警告。
 */

const allowedChatId = process.env.TELEGRAM_USER_ID
  ? String(process.env.TELEGRAM_USER_ID)
  : null;

if (!allowedChatId) {
  console.warn("[adminGuard] ⚠️  TELEGRAM_USER_ID 未設定，所有 Bot 指令將被拒絕。");
}

/**
 * grammY middleware function
 * 用法：bot.use(adminGuard)
 *
 * @param {import('grammy').Context} ctx
 * @param {Function} next
 */
export async function adminGuard(ctx, next) {
  const incomingId = String(ctx.chat?.id ?? "");

  if (!allowedChatId || incomingId !== allowedChatId) {
    // 靜默忽略，不回應
    console.log(
      `[adminGuard] 🚫 拒絕非授權來源：chat_id=${incomingId}`
    );
    return;
  }

  await next();
}
