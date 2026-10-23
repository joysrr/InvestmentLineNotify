/**
 * adminGuard.mjs
 * 管理員權限中介軟體 - 檢查 initDataGuard 解析出的 user_id 是否在 ADMIN_USER_IDS 中
 */

import logger from "../../utils/logger.mjs";

/**
 * 解析管理員 Telegram user ID 清單。
 * ADMIN_USER_IDS 優先；單一使用者部署環境 fallback 到 TELEGRAM_USER_ID。
 */
function getAdminUserIds() {
  const ids = process.env.ADMIN_USER_IDS || process.env.TELEGRAM_USER_ID;
  if (!ids) return new Set();

  return new Set(
    ids
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => BigInt(id)), // 使用 BigInt 處理大數字
  );
}

const ADMIN_USER_IDS = getAdminUserIds();

/**
 * 管理員守衛中介軟體
 * 需在 initDataGuard 之後使用 (initDataGuard 會設定 request.telegramUser)
 */
export async function adminGuard(request, reply) {
  // 開發環境繞過
  if (
    process.env.NODE_ENV === "development" &&
    process.env.BYPASS_ADMIN_GUARD === "true"
  ) {
    request.user = { id: 123456789n, isAdmin: true };
    return;
  }

  // 檢查是否已通過 initData 驗證
  if (!request.telegramUser || !request.telegramUser.id) {
    logger.warn({ url: request.url }, "Admin guard: user not authenticated");
    return reply.code(401).send({
      error: "Unauthorized",
      message: "需要 Telegram 認證",
    });
  }

  const userId = BigInt(request.telegramUser.id);
  const isAdmin = ADMIN_USER_IDS.has(userId);

  if (!isAdmin) {
    logger.warn(
      { userId: userId.toString() },
      "Admin guard: user not authorized",
    );
    return reply.code(403).send({
      error: "Forbidden",
      message: "需要管理員權限",
    });
  }

  request.user = { id: userId, isAdmin: true, ...request.telegramUser };
  logger.debug({ userId: userId.toString() }, "Admin guard passed");
}

/**
 * 重新載入管理員清單 (用於測試或熱更新)
 */
export function reloadAdminUserIds() {
  const newIds = getAdminUserIds();
  ADMIN_USER_IDS.clear();
  for (const id of newIds) {
    ADMIN_USER_IDS.add(id);
  }
  logger.info({ count: ADMIN_USER_IDS.size }, "Admin user IDs reloaded");
}

export { ADMIN_USER_IDS };
export default adminGuard;
