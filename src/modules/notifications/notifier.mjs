import { buildTelegramMessages } from "./templates/telegramHtmlBuilder.mjs";
import { unpinAllChatMessages, sendTelegramBatch } from "./transports/telegramClient.mjs";

/**
 * 終極對外介面：廣播戰報到所有支援的平台
 */
export async function broadcastDailyReport(
  data,
  newsMessages = [],
  isTelegramEnabled,
) {
  const tasks = [];

  // 組裝並發送 Telegram
  if (isTelegramEnabled && process.env.TELEGRAM_API_TOKEN) {
    let tgMsgs = buildTelegramMessages(data);
    if (newsMessages.length) {
      tgMsgs = tgMsgs.concat(newsMessages);
    }

    tasks.push(
      unpinAllChatMessages()
        .then(() => sendTelegramBatch(tgMsgs))
        .then(() => console.log("✅ Telegram 戰報發送成功"))
        .catch((e) => console.error("❌ Telegram 發送失敗", e)),
    );
  }

  await Promise.allSettled(tasks);
}
