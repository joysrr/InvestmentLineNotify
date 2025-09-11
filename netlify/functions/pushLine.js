const axios = require('axios');

exports.handler = async function(event, context) {
  const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
  const USER_ID = process.env.USER_ID;

  if (!LINE_ACCESS_TOKEN || !USER_ID) {
    return { statusCode: 500, body: 'Missing env variables' };
  }

  const message = '今日定期檢視提醒：請確認正2ETF持倉狀況與技術指標信號。';

  try {
    await axios.post('https://api.line.me/v2/bot/message/push', {
      to: USER_ID,
      messages: [{ type: 'text', text: message }],
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
      }
    });
    return { statusCode: 200, body: 'Message sent' };
  } catch (error) {
    return { statusCode: 500, body: `Error: ${error.message}` };
  }
};
