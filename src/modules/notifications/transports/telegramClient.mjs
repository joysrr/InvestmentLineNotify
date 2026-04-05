const token = process.env.TELEGRAM_API_TOKEN;
const logToken = process.env.TELEGRAM_LOG_API_TOKEN;
const chatId = process.env.TELEGRAM_USER_ID;

/**
 * 解除該 chat 中所有釘選訊息。
 * 可在每次 pin 新訊息前獨立呼叫。
 * Bot 須擁有 can_pin_messages（群組/超級群組）或 can_edit_messages（頻道）權限。
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
  const sendUrl  = `https://api.telegram.org/bot${token}/sendMessage`;
  const pinUrl  = `https://api.telegram.org/bot${token}/pinChatMessage`;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    const payload = {
      chat_id: chatId,
      text: msg.text,
      parse_mode: "HTML",
      disable_web_page_preview: true, // 避免貼連結時跑出超大網頁預覽
    };

    // 如果我們設定了靜默通知，就加入這個參數
    if (msg.disable_notification) {
      payload.disable_notification = true;
    }

    // 如果這則訊息有包含網址，自動幫它加上 Inline Keyboard 按鈕
    const buttons = [];
    if (msg.sheetUrl) {
      buttons.push({ text: "📊 財富領航表", url: msg.sheetUrl });
    }
    if (msg.strategyUrl) {
      buttons.push({ text: "📄 策略設定檔", url: msg.strategyUrl });
    }

    if (buttons.length > 0) {
      payload.reply_markup = {
        // Inline 鍵盤，這裡設定為同一列橫向排開
        inline_keyboard: [buttons],
      };
    }

    try {
      const response = await fetch(sendUrl , {
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

      // 若 pin = true，釘選這則訊息
      if (msg.pin) {
        const messageId = resData.result.message_id;
        const pinResponse = await fetch(pinUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            disable_notification: true, // 靜默釘選，不推播通知
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
 * 固定靜默發送（disable_notification: true），不 pin。
 * 用於 Optimizer 執行結果、系統狀態通知等非每日報告類訊息。
 *
 * @param {string} text - 純文字或 HTML 訊息內容
 * @returns {Promise<void>}
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
