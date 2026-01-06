const axios = require("axios");
require("dotenv").config();

const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
const USER_ID = process.env.USER_ID;

/**
 * 發送 LINE push 訊息（文字）。
 */
async function pushMessage(text) {
  if (!LINE_ACCESS_TOKEN || !USER_ID) {
    console.warn("缺少 LINE_ACCESS_TOKEN 或 USER_ID，跳過推播");
    return;
  }

  await axios.post(
    "https://api.line.me/v2/bot/message/push",
    {
      to: USER_ID,
      messages: [{ type: "text", text }],
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_ACCESS_TOKEN}`,
      },
    },
  );
}

module.exports = { pushMessage };
