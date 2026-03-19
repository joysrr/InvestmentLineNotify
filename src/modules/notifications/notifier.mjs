import { buildFlexCarouselFancy } from "./templates/lineFlexBuilder.mjs";
import { buildTelegramMessages } from "./templates/telegramHtmlBuilder.mjs";
import { pushLine } from "./transports/lineClient.mjs";
import { sendTelegramBatch } from "./transports/telegramClient.mjs";

/**
 * 終極對外介面：廣播戰報到所有支援的平台
 */
export async function broadcastDailyReport(
  data,
  newsMessages = [],
  isLineEnabled,
  isTelegramEnabled,
) {
  const tasks = [];

  // 1. 組裝並發送 LINE
  if (isLineEnabled && process.env.LINE_ACCESS_TOKEN) {
    const flexMsg = buildFlexCarouselFancy(data);
    tasks.push(
      pushLine([
        { type: "flex", altText: "📊 今日投資戰報", contents: flexMsg },
      ])
        .then(() => console.log("✅ LINE 戰報發送成功"))
        .catch((e) => console.error("❌ LINE 發送失敗", e)),
    );
  }

  // 2. 組裝並發送 Telegram
  if (isTelegramEnabled && process.env.TELEGRAM_API_TOKEN) {
    let tgMsgs = buildTelegramMessages(data);
    if (newsMessages.length) {
      tgMsgs = tgMsgs.concat(newsMessages);
    }
    tasks.push(
      sendTelegramBatch(tgMsgs)
        .then(() => console.log("✅ Telegram 戰報發送成功"))
        .catch((e) => console.error("❌ Telegram 發送失敗", e)),
    );
  }

  await Promise.allSettled(tasks);
}
