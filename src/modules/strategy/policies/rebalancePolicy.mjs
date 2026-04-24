import { getPostSellAllocation } from "../riskManagement.mjs";

export function buildSellBackToAllocation(ctx, strategy) {
  const post = getPostSellAllocation(strategy);
  const targetLeverage = post.leverage;
  const targetZ2Value = ctx.netAsset * targetLeverage;

  const sellAmount = Math.max(0, ctx.currentZ2Value - targetZ2Value);

  return {
    marketStatus: "🎯【停利/降槓桿】",
    target: "🛎️ 結帳還款",
    targetSuggestionShort: `賣出 00675L 降槓桿至 ${(post.leverage * 100).toFixed(0)}%`,
    targetSuggestion: `賣出部分00675L並還款，恢復槓桿 ${(targetLeverage * 100).toFixed(0)}% / 現金 ${(post.cash * 100).toFixed(0)}%`,
    suggestion:
      `• 觸發條件：已滿足策略設定之停利與訊號數量門檻\n` +
      `• 目標配置：槓桿降至 ${(targetLeverage * 100).toFixed(0)}%，現金儲備提升至 ${(post.cash * 100).toFixed(0)}%\n` +
      `• 執行步驟：建議賣出約 ${sellAmount.toLocaleString("zh-TW", { maximumFractionDigits: 0 })} 元的 00675L 並進行還款`,
    postAllocation: post,
    sellAmount,
  };
}
