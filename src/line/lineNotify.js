const axios = require('axios');
require('dotenv').config();

const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
const USER_ID = process.env.USER_ID;

async function pushMessage(text) {
  if (!LINE_ACCESS_TOKEN || !USER_ID) {
    console.warn('缺少LINE_ACCESS_TOKEN或USER_ID，跳過推播');
    return;
  }
  try {
    await axios.post('https://api.line.me/v2/bot/message/push', {
      to: USER_ID,
      messages: [{ type: 'text', text }],
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
      }
    });
    console.log('LINE訊息已發送');
  } catch (err) {
    console.error('LINE推送錯誤:', err.response?.data || err.message);
  }
}

module.exports = { pushMessage };