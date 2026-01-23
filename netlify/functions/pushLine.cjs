// netlify/functions/pushLine.cjs

exports.handler = async (event, context) => {
  // 使用動態 import 載入你原本的 ESM 邏輯
  const { handler } = await import('./pushLineLogic.mjs');
  return handler(event, context);
};