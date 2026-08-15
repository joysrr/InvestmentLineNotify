import crypto from "crypto";
import logger from "../../utils/logger.mjs";

// 生產環境 initData 最大有效時間（原 5 分鐘放寬至 2 小時，避免 Mini App 長時間操作過期）
const MAX_AGE_SECONDS =
  process.env.NODE_ENV === "dev" || process.env.NODE_ENV === "development"
    ? 86400
    : 7200;

/**
 * Fastify onRequest hook — Telegram initData HMAC-SHA256 validation.
 *
 * Bypass conditions (dev / local / test):
 *   - NODE_ENV === 'dev'
 *   - NODE_ENV === 'development'
 *   - BYPASS_INIT_DATA === 'true'
 *   - TEST_MODE === 'true'
 *
 * In production, the caller must supply the raw initData string in the
 * `X-Telegram-Init-Data` request header.  The secret key is derived from
 * TELEGRAM_API_TOKEN per Telegram's specification:
 *   secretKey = HMAC-SHA256("WebAppData", botToken)
 *   hash      = HMAC-SHA256(dataCheckString, secretKey)
 *
 * Reference: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export async function initDataGuard(request, reply) {
  // Skip guard for /health and /healthz endpoints
  if (request.url.startsWith("/health")) return;

  // Bypass ONLY in development environment or explicit bypass flag.
  // TEST_MODE is removed — use generateValidInitData() instead for real auth testing.
  if (
    process.env.NODE_ENV === "dev" ||
    process.env.NODE_ENV === "development" ||
    process.env.BYPASS_INIT_DATA === "true"
  ) {
    return;
  }

  const rawInitData = request.headers["x-telegram-init-data"];
  if (!rawInitData) {
    const ip = request.ip || request.headers["x-forwarded-for"] || "unknown";
    logger.warn(
      {
        event: "initDataGuard",
        reason: "missing_header",
        ip,
        url: request.url,
      },
      "⚠️ [initDataGuard] 缺少 X-Telegram-Init-Data header",
    );
    return reply
      .code(403)
      .send({ error: "Missing X-Telegram-Init-Data header" });
  }

  const botToken = process.env.TELEGRAM_API_TOKEN;
  if (!botToken) {
    logger.error(
      { event: "initDataGuard", reason: "missing_token" },
      "❌ [initDataGuard] 缺少 TELEGRAM_API_TOKEN，無法驗證 initData",
    );
    return reply.code(500).send({ error: "Server auth configuration error" });
  }

  try {
    const params = new URLSearchParams(rawInitData);
    const receivedHash = params.get("hash");
    if (!receivedHash) {
      const ip = request.ip || request.headers["x-forwarded-for"] || "unknown";
      logger.warn(
        {
          event: "initDataGuard",
          reason: "missing_hash",
          ip,
          url: request.url,
        },
        "⚠️ [initDataGuard] initData 缺少 hash 欄位",
      );
      return reply.code(403).send({ error: "Missing hash in initData" });
    }

    // Build data-check string: all fields except hash, sorted alphabetically
    params.delete("hash");
    const dataCheckArr = [];
    for (const [key, value] of [...params.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      dataCheckArr.push(`${key}=${value}`);
    }
    const dataCheckString = dataCheckArr.join("\n");

    // Derive secret key
    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    // Compute expected hash
    const expectedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (expectedHash !== receivedHash) {
      const ip = request.ip || request.headers["x-forwarded-for"] || "unknown";
      logger.error(
        {
          event: "initDataGuard",
          reason: "hmac_mismatch",
          ip,
          url: request.url,
          receivedHash: receivedHash.substring(0, 16) + "...",
        },
        "🚨 [initDataGuard] HMAC 驗證失敗，可能存在篡改攻擊",
      );
      return reply.code(403).send({ error: "initData validation failed" });
    }

    const authDate = Number(params.get("auth_date"));
    if (!authDate || isNaN(authDate)) {
      const ip = request.ip || request.headers["x-forwarded-for"] || "unknown";
      logger.warn(
        {
          event: "initDataGuard",
          reason: "invalid_auth_date",
          ip,
          url: request.url,
        },
        "⚠️ [initDataGuard] auth_date 格式錯誤",
      );
      return reply
        .code(401)
        .send({ error: "Missing or invalid auth_date in initData" });
    }

    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > MAX_AGE_SECONDS) {
      const ip = request.ip || request.headers["x-forwarded-for"] || "unknown";
      const age = now - authDate;
      logger.warn(
        {
          event: "initDataGuard",
          reason: "initData_expired",
          ip,
          url: request.url,
          authDate,
          now,
          ageSeconds: age,
        },
        `⚠️ [initDataGuard] initData 已過期 (${Math.round(age / 60)} 分鐘前)，可能為重放攻擊`,
      );
      return reply
        .code(401)
        .send({ error: "initData expired (replay attack prevention)" });
    }

    const userStr = params.get("user");
    if (userStr) {
      try {
        request.telegramUser = JSON.parse(userStr);
        const userId = request.telegramUser?.id;
        if (userId) {
          logger.info(
            {
              event: "initDataGuard",
              reason: "validation_success",
              userId,
              url: request.url,
            },
            "✅ [initDataGuard] initData 驗證成功",
          );
        }
      } catch (err) {
        logger.error(
          {
            event: "initDataGuard",
            reason: "parse_user_error",
            error: err.message,
          },
          "❌ [initDataGuard] 解析 user 資料失敗",
        );
      }
    }
  } catch (err) {
    const ip = request.ip || request.headers["x-forwarded-for"] || "unknown";
    logger.error(
      {
        event: "initDataGuard",
        reason: "unexpected_error",
        ip,
        url: request.url,
        error: err.message,
      },
      "❌ [initDataGuard] 驗證過程發生未預期錯誤",
    );
    return reply.code(400).send({ error: "Malformed initData" });
  }
}
