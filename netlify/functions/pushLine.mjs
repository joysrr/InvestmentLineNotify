import { dailyCheck } from '../../src/dailyCheck.mjs';

export const handler = async () => {
  const result = await dailyCheck(true);
  return {
    statusCode: 200,
    body: 'LINE 技術指標與投報率每日通知已發送',
  };
};

// 本機測試可在 dailyCheck.js 裡呼叫