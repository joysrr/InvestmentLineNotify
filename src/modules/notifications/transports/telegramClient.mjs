const token = process.env.TELEGRAM_API_TOKEN;
const logToken = process.env.TELEGRAM_LOG_API_TOKEN;
const chatId = process.env.TELEGRAM_USER_ID;

/**
 * 解除該 chat 中所有釘選訊息。
 * 可在每次 pin 新訊息前獨立呼叫。
 */
export async function unpinAllChatMessages() {
  const url = `https://api.telegram.org/bot${token}/unpinAllChatMessages`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId }),
    });
    const resData = await response.json();
    if (!resData.ok) {
      console.error(`❌ unpinAllChatMessages 失敗:`, resData.description);
    } else {
      console.log(`✅ 已解除所有釘選訊息`);
    }
  } catch (err) {
    console.error(`❌ unpinAllChatMessages 網路錯誤:`, err);
  }
}

export async function sendTelegramBatch(messages) {
  const sendUrl = `https://api.telegram.org/bot${token}/sendMessage`;
  const pinUrl  = `https://api.telegram.org/bot${token}/pinChatMessage`;

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
      const response = await fetch(sendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();
      if (!resData.ok) {
        console.error(`❌ 第 ${i + 1} 則發送失敗:`, resData.description);
        continue;
      } else {
        console.log(`✅ 第 ${i + 1} 則發送成功`);
      }

      if (msg.pin) {
        const messageId = resData.result.message_id;
        const pinResponse = await fetch(pinUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            disable_notification: true,
          }),
        });
        const pinData = await pinResponse.json();
        if (!pinData.ok) {
          console.error(`❌ 第 ${i + 1} 則釘選失敗:`, pinData.description);
        } else {
          console.log(`📌 第 ${i + 1} 則已釘選`);
        }
      }
    } catch (err) {
      console.error(`❌ 網路錯誤:`, err);
    }
  }
}

/**
 * 發送系統訊息至 Log 頻道（使用 TELEGRAM_LOG_API_TOKEN）
 * 固定靜默發送，不 pin。
 */
export async function sendSystemMessage(text) {
  if (!logToken) {
    console.warn("[SystemMsg] TELEGRAM_LOG_API_TOKEN 未設定，跳過系統訊息發送");
    return;
  }
  const url = `https://api.telegram.org/bot${logToken}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        disable_notification: true,
      }),
    });
    const resData = await response.json();
    if (!resData.ok) {
      console.warn("[SystemMsg] 系統訊息發送失敗:", resData.description);
    } else {
      console.log("[SystemMsg] ✅ 系統訊息發送成功");
    }
  } catch (err) {
    console.warn("[SystemMsg] 系統訊息網路錯誤:", err.message);
  }
}
