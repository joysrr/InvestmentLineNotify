import crypto from "crypto";

/**
 * Fastify onRequest hook — Telegram initData HMAC-SHA256 validation.
 *
 * Bypass conditions (dev / local):
 *   - NODE_ENV === 'dev'
 *   - BYPASS_INIT_DATA === 'true'
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
  // Skip guard for /health endpoint
  if (request.url === "/health") return;

  // Bypass in development mode
  if (
    process.env.NODE_ENV === "dev" ||
    process.env.BYPASS_INIT_DATA === "true"
  ) {
    return;
  }

  const rawInitData = request.headers["x-telegram-init-data"];
  if (!rawInitData) {
    return reply
      .code(403)
      .send({ error: "Missing X-Telegram-Init-Data header" });
  }

  const botToken = process.env.TELEGRAM_API_TOKEN;
  if (!botToken) {
    request.log.error(
      "❌ [initDataGuard] 缺少 TELEGRAM_API_TOKEN，無法驗證 initData",
    );
    return reply.code(500).send({ error: "Server auth configuration error" });
  }

  try {
    const params = new URLSearchParams(rawInitData);
    const receivedHash = params.get("hash");
    if (!receivedHash) {
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
      return reply.code(403).send({ error: "initData validation failed" });
    }

    const authDate = Number(params.get("auth_date"));
    if (!authDate || isNaN(authDate)) {
      return reply
        .code(401)
        .send({ error: "Missing or invalid auth_date in initData" });
    }

    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) {
      return reply
        .code(401)
        .send({ error: "initData expired (replay attack prevention)" });
    }

    const userStr = params.get("user");
    if (userStr) {
      request.telegramUser = JSON.parse(userStr);
    }
  } catch (err) {
    return reply.code(400).send({ error: "Malformed initData" });
  }
}
