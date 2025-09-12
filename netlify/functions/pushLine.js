const axios = require('axios');

exports.handler = async function(event, context) {
  const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
  const USER_ID = process.env.USER_ID;

  if (!LINE_ACCESS_TOKEN || !USER_ID) {
    return { statusCode: 500, body: 'Missing env variables' };
  }

  const message =`
正2ETF每日投資自檢提醒

1️⃣ 資金分配與現金比率：有無偏離原計畫？
2️⃣ 技術指標(RSI/MACD/KD)：出現共振進出場訊號？有無超買超賣？
3️⃣ 持倉損益：是否接近、超過止損點？需停損嗎？
4️⃣ 獲利與減碼：波段獲利超過30%/50%？需分批獲利了結嗎？
5️⃣ 心理紀律：今日無情緒操作，嚴守紀律

（請於盤前/盤後檢查）
`;

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
