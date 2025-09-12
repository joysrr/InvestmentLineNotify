const { dailyCheck } = require('../../src/dailyCheck');

exports.handler = async function(event, context) {
  await dailyCheck(true);
  return {
    statusCode: 200,
    body: 'LINE 技術指標與投報率每日通知已發送',
  };
};

// 本機測試可在 dailyCheck.js 裡呼叫