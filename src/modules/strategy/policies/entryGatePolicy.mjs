/**
 * Pre-Entry Gate：解析當前跌幅/RSI 所在的 entryGate 層級
 * @param {number} dropPercent - 當前跌幅(%)
 * @param {number} rsi - 當前 RSI
 * @param {Object} entryGateCfg - strategy.buy.entryGate
 * @param {number|null} ma60Slope - 當前 MA60 斜率
 * @returns {{ tierIndex: number, tier: Object|null, blocked: boolean, blockReason: string|null }}
 */
export function resolveEntryGate(
  dropPercent,
  rsi,
  entryGateCfg,
  ma60Slope = null,
) {
  if (!entryGateCfg?.enabled || !Array.isArray(entryGateCfg.tiers)) {
    return { tierIndex: -1, tier: null, blocked: false, blockReason: null };
  }

  const tiers = entryGateCfg.tiers;

  // 從高跌幅往低找，取第一個 minDrop <= dropPercent 的 tier
  let matchedIndex = -1; // 改為 -1 表示未命中
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (dropPercent >= tiers[i].minDrop) {
      matchedIndex = i;
      break;
    }
  }

  // 若未命中，直接放行（不封鎖）
  if (matchedIndex === -1) {
    return { tierIndex: -1, tier: null, blocked: false, blockReason: null };
  }

  const tier = tiers[matchedIndex];

  // 多頭環境豁免機制 (Bull Market Relaxation)
  // 如果長期趨勢向上 (ma60Slope > 0) 且啟動豁免，則在低跌幅區間不執行 RSI 封鎖
  const isBullish = ma60Slope !== null && ma60Slope > 0;
  const isRelaxed =
    entryGateCfg.bullMarketRelaxation && isBullish && dropPercent < 15;

  // allowLeverage: false → 直接封鎖加碼 (除非被豁免，但通常 Tier 0/1 不允許加碼是硬性規定)
  if (!tier.allowLeverage && !isRelaxed) {
    return {
      tierIndex: matchedIndex,
      tier,
      blocked: true,
      blockReason: `entryGate Tier ${matchedIndex}：${tier.note}`,
    };
  }

  // allowLeverage: true 或 已被豁免 → 需確認 RSI 是否達標
  // 若處於豁免狀態，跳過 RSI 檢查
  if (isRelaxed) {
    return {
      tierIndex: matchedIndex,
      tier,
      blocked: false,
      blockReason: "多頭趨勢豁免 RSI 檢核",
    };
  }

  if (tier.rsiThreshold != null && rsi >= tier.rsiThreshold) {
    return {
      tierIndex: matchedIndex,
      tier,
      blocked: true,
      blockReason: `entryGate Tier ${matchedIndex}：跌幅達標，但 RSI ${rsi.toFixed(0)} ≥ 門檻 ${tier.rsiThreshold}，尚未超賣`,
    };
  }

  return { tierIndex: matchedIndex, tier, blocked: false, blockReason: null };
}
