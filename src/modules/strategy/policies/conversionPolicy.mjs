import { TwDate } from "../../../utils/coreUtils.mjs";

/**
 * 階梯式獲利轉化 (Conversion Guard)
 * 判斷 00675L 帳面獲利是否達到設定門檻，若達標則觸發部分獲利結清，
 * 並依據當下維持率決定結清資金中「還款」與「買 0050」的比例。
 *
 * @param {Object} ctx - 執行上下文，包含 currentPriceZ2, portfolio 等
 * @param {Object} strategy - Strategy.json 配置
 * @returns {Object|null} 觸發時回傳建議，否則回傳 null
 */
export function resolveConversionGuard(ctx, strategy) {
  const cg = strategy?.conversionGuard;
  if (!cg || !cg.enabled || !cg.tiers || !cg.allocation) return null;

  const { portfolio, currentPrice } = ctx;
  if (
    !portfolio ||
    typeof portfolio.avgCostZ2 !== "number" ||
    portfolio.qtyZ2 <= 0
  ) {
    return null; // 無法計算成本或無部位
  }

  const avgCost = portfolio.avgCostZ2;
  const qtyZ2 = portfolio.qtyZ2;
  const currentMargin = ctx.marginAnalysis?.currentMargin || 0;

  // 1. 計算當前未實現獲利率
  const profitPct = (currentPrice - avgCost) / avgCost;
  if (profitPct <= 0) return null;

  // 2. 匹配最高級別的 tier (tiers 應該是遞增排序的)
  let activeTier = null;
  for (let i = cg.tiers.length - 1; i >= 0; i--) {
    if (profitPct >= cg.tiers[i].profitPct) {
      activeTier = cg.tiers[i];
      break;
    }
  }

  if (!activeTier) return null;

  // 3. 計算應轉化 (賣出) 的金額與股數
  const currentZ2Value = qtyZ2 * currentPrice;
  const convertAmount = Math.round(currentZ2Value * activeTier.convertRatio);
  const minAction = strategy?.threshold?.minActionableAmount ?? 10000;
  if (convertAmount < minAction) {
    return null; // 金額過小不動作
  }

  // 4. 根據維持率決定資金去向 (allocation)
  let repayRatio = 1.0; // 預設全部還款
  // allocation 也是遞增排序 (minMargin 由小到大)
  // 找到小於等於 currentMargin 的最高級別
  let activeAlloc = cg.allocation[0];
  for (let i = 0; i < cg.allocation.length; i++) {
    if (currentMargin >= cg.allocation[i].minMargin) {
      activeAlloc = cg.allocation[i];
      repayRatio = activeAlloc.repayRatio;
    }
  }

  const repayAmount = Math.round(convertAmount * repayRatio);
  const buy0050Amount = convertAmount - repayAmount;

  return {
    marketStatus: "🔄【獲利轉化】",
    target: "🔁 轉入底倉",
    targetSuggestionShort: `獲利達 ${(profitPct * 100).toFixed(1)}%，建議賣出 00675L 約 $${convertAmount.toLocaleString()}`,
    targetSuggestion: `觸發 Conversion Guard (Tier ${(profitPct * 100).toFixed(0)}%)：賣出約 $${convertAmount.toLocaleString()} 的 00675L，並依維持率 (${currentMargin.toFixed(1)}%) 進行資金分配。`,
    suggestion:
      `• 00675L 帳面獲利：${(profitPct * 100).toFixed(1)}%\n` +
      `• 觸發門檻：≥ ${(activeTier.profitPct * 100).toFixed(0)}% (轉化比例 ${(activeTier.convertRatio * 100).toFixed(0)}%)\n` +
      `• 預計賣出金額：約 $${convertAmount.toLocaleString()}\n` +
      `• 資金去向建議：\n` +
      `  └ 優先還款：$${repayAmount.toLocaleString()} (${(repayRatio * 100).toFixed(0)}%)\n` +
      `  └ 轉入 0050：$${buy0050Amount.toLocaleString()} (${((1 - repayRatio) * 100).toFixed(0)}%)`,
    conversionData: {
      profitPct,
      convertAmount,
      repayAmount,
      buy0050Amount,
      currentMargin,
    },
  };
}
