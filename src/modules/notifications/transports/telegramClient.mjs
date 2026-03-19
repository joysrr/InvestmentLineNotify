const token = process.env.TELEGRAM_API_TOKEN;
const chatId = process.env.TELEGRAM_USER_ID;

export async function sendTelegramBatch(messages) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    const payload = {
      chat_id: chatId,
      text: msg.text,
      parse_mode: "HTML",
      disable_web_page_preview: true, // 避免貼連結時跑出超大網頁預覽
    };

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
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();
      if (!resData.ok) {
        console.error(`❌ 第 ${i + 1} 則發送失敗:`, resData.description);
      } else {
        console.log(`✅ 第 ${i + 1} 則發送成功`);
      }
    } catch (err) {
      console.error(`❌ 網路錯誤:`, err);
    }
  }
}
