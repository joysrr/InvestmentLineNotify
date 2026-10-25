import https from "node:https";
import logger from "../../../utils/logger.mjs";
import {
  calculateBackoffDelay,
  isRetryableError,
  ProviderError,
} from "../../../utils/retryUtils.mjs";

function requestTelegramJson(
  url,
  options,
  timeout,
  retries,
  retryDelay,
  operation,
) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      new URL(url),
      {
        ...options,
        family: 4,
        timeout,
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          if (response.statusCode < 200 || response.statusCode >= 300) {
            const error = new Error(
              `HTTP ${response.statusCode}: ${body.slice(0, 500)}`,
            );
            error.statusCode = response.statusCode;
            reject(error);
            return;
          }
          resolve({ json: async () => JSON.parse(body) });
        });
      },
    );

    request.on("timeout", () => request.destroy(new Error("Request Timeout")));
    request.on("error", reject);
    request.end(options.body);
  }).catch(async (error) => {
    if (!isRetryableError(error) || retries <= 0) {
      throw new ProviderError(error.message, {
        providerId: PROVIDER_ID,
        operation,
        statusCode: error.statusCode,
        isRetryable: isRetryableError(error),
        cause: error,
      });
    }

    const delayMs = calculateBackoffDelay(
      DEFAULT_RETRIES - retries,
      retryDelay,
      10000,
      0.5,
    );
    logger.warn(
      {
        providerId: PROVIDER_ID,
        operation,
        attempt: DEFAULT_RETRIES - retries + 1,
        delayMs: Math.round(delayMs),
      },
      "Provider HTTPS 失敗，等待後重試",
    );
    await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    return requestTelegramJson(
      url,
      options,
      timeout,
      retries - 1,
      retryDelay,
      operation,
    );
  });
}

const token = process.env.TELEGRAM_API_TOKEN;
const logToken = process.env.TELEGRAM_LOG_API_TOKEN;
const chatId = process.env.TELEGRAM_USER_ID;

// ============================================================================
// 📡 統一請求配置
// ============================================================================

const DEFAULT_TIMEOUT = 30000; // 30 秒 timeout（因應跨境網路長時間抖動）
const DEFAULT_RETRIES = 5; // 重試 5 次（共 6 次嘗試）
const DEFAULT_RETRY_DELAY = 5000; // 基礎延遲 5 秒（退避窗口約 45 秒）
const PROVIDER_ID = "telegram";

// ============================================================================
// 🔔 釘選管理
// ============================================================================

/**
 * 解除該 chat 中所有釘選訊息
 * 可在每次 pin 新訊息前獨立呼叫
 */
export async function unpinAllChatMessages() {
  const url = `https://api.telegram.org/bot${token}/unpinAllChatMessages`;

  try {
    const response = await requestTelegramJson(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId }),
      },
      DEFAULT_TIMEOUT,
      DEFAULT_RETRIES,
      DEFAULT_RETRY_DELAY,
      PROVIDER_ID,
      "unpinAllChatMessages",
    );

    const resData = await response.json();
    if (!resData.ok) {
      logger.error(
        { description: resData.description },
        `❌ [${PROVIDER_ID}] unpinAllChatMessages 失敗`,
      );
    } else {
      logger.info(`✅ [${PROVIDER_ID}] 已解除所有釘選訊息`);
    }
  } catch (error) {
    if (error instanceof ProviderError) {
      logger.error(
        { error: error.message },
        `❌ [${PROVIDER_ID}] unpinAllChatMessages 最終失敗`,
      );
    } else {
      logger.error(
        { error },
        `❌ [${PROVIDER_ID}] unpinAllChatMessages unexpected error`,
      );
    }
  }
}

// ============================================================================
// 📨 批次訊息發送
// ============================================================================

/**
 * 批次發送 Telegram 訊息
 * @param {Array} messages - 訊息陣列，每個物件包含 text, pin, disable_notification 等欄位
 */
export async function sendTelegramBatch(messages) {
  const sendUrl = `https://api.telegram.org/bot${token}/sendMessage`;
  const pinUrl = `https://api.telegram.org/bot${token}/pinChatMessage`;

  let successCount = 0;
  let lastFailureError = null;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    const payload = {
      chat_id: chatId,
      text: msg.text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    };

    if (msg.disable_notification) {
      payload.disable_notification = true;
    }

    // ── Inline keyboard 按鈕組裝 ─────────────────────────────────
    // 每一個 row 是一個 Array<InlineKeyboardButton>
    const rows = [];

    // 1. MiniApp WebApp 按鈕（優先，佔獨立一列）
    if (msg.webAppUrl) {
      rows.push([
        {
          text: "📲 開啟投資儀表板",
          web_app: { url: msg.webAppUrl },
        },
      ]);
    }

    // 2. 外部連結按鈕（同一列橫向排開）
    const linkButtons = [];
    if (msg.sheetUrl) {
      linkButtons.push({ text: "📊 財富領航表", url: msg.sheetUrl });
    }
    if (msg.strategyUrl) {
      linkButtons.push({ text: "📄 策略設定檔", url: msg.strategyUrl });
    }
    if (linkButtons.length > 0) {
      rows.push(linkButtons);
    }

    if (rows.length > 0) {
      payload.reply_markup = { inline_keyboard: rows };
    }

    try {
      const response = await requestTelegramJson(
        sendUrl,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        DEFAULT_TIMEOUT,
        DEFAULT_RETRIES,
        DEFAULT_RETRY_DELAY,
        PROVIDER_ID,
        `sendMessage[${i + 1}]`,
      );

      const resData = await response.json();
      if (!resData.ok) {
        lastFailureError = new ProviderError(
          `Telegram API error: ${resData.description}`,
          { providerId: PROVIDER_ID, operation: `sendMessage[${i + 1}]` },
        );
        logger.error(
          { index: i + 1, description: resData.description },
          `❌ [${PROVIDER_ID}] 第 ${i + 1} 則發送失敗`,
        );
        continue;
      } else {
        successCount++;
        logger.info(`✅ [${PROVIDER_ID}] 第 ${i + 1} 則發送成功`);
      }

      if (msg.pin) {
        const messageId = resData.result.message_id;

        try {
          const pinResponse = await requestTelegramJson(
            pinUrl,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId,
                disable_notification: true,
              }),
            },
            DEFAULT_TIMEOUT,
            DEFAULT_RETRIES,
            DEFAULT_RETRY_DELAY,
            PROVIDER_ID,
            `pinChatMessage[${i + 1}]`,
          );

          const pinData = await pinResponse.json();
          if (!pinData.ok) {
            logger.error(
              { index: i + 1, description: pinData.description },
              `❌ [${PROVIDER_ID}] 第 ${i + 1} 則釘選失敗`,
            );
          } else {
            logger.info(`📌 [${PROVIDER_ID}] 第 ${i + 1} 則已釘選`);
          }
        } catch (pinError) {
          if (pinError instanceof ProviderError) {
            logger.error(
              { index: i + 1, error: pinError.message },
              `❌ [${PROVIDER_ID}] 第 ${i + 1} 則釘選最終失敗`,
            );
          } else {
            logger.error(
              { index: i + 1, error: pinError },
              `❌ [${PROVIDER_ID}] 第 ${i + 1} 則釘選 unexpected error`,
            );
          }
        }
      }
    } catch (error) {
      lastFailureError = error;
      if (error instanceof ProviderError) {
        logger.error(
          { index: i + 1, error: error.message },
          `❌ [${PROVIDER_ID}] 第 ${i + 1} 則發送最終失敗`,
        );
      } else {
        logger.error(
          { index: i + 1, error },
          `❌ [${PROVIDER_ID}] 第 ${i + 1} 則發送 unexpected error`,
        );
      }
    }
  }

  // 若傳入訊息且每一則都發送失敗，拋出最後的錯誤，拒絕虛假成功
  if (messages.length > 0 && successCount === 0 && lastFailureError) {
    throw lastFailureError;
  }
}

// ============================================================================
// 📡 系統訊息（Log 頻道）
// ============================================================================

/**
 * 發送系統訊息至 Log 頻道（使用 TELEGRAM_LOG_API_TOKEN）
 * 固定靜默發送，不 pin。
 */
export async function sendSystemMessage(text) {
  if (!logToken) {
    logger.warn(
      `[${PROVIDER_ID}/SystemMsg] TELEGRAM_LOG_API_TOKEN 未設定，跳過系統訊息發送`,
    );
    return;
  }

  const url = `https://api.telegram.org/bot${logToken}/sendMessage`;

  try {
    const response = await requestTelegramJson(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          disable_notification: true,
        }),
      },
      DEFAULT_TIMEOUT,
      DEFAULT_RETRIES,
      1000,
      `${PROVIDER_ID}/SystemMsg`,
      "sendSystemMessage",
    );

    const resData = await response.json();
    if (!resData.ok) {
      logger.warn(
        { description: resData.description },
        `[${PROVIDER_ID}/SystemMsg] 系統訊息發送失敗`,
      );
    } else {
      logger.info(`[${PROVIDER_ID}/SystemMsg] ✅ 系統訊息發送成功`);
    }
  } catch (error) {
    if (error instanceof ProviderError) {
      logger.warn(
        { error: error.message },
        `[${PROVIDER_ID}/SystemMsg] 系統訊息發送最終失敗`,
      );
    } else {
      logger.warn(
        { error },
        `[${PROVIDER_ID}/SystemMsg] 系統訊息 unexpected error`,
      );
    }
  }
}
