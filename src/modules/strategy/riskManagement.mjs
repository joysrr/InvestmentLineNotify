// 取得目標槓桿比例
export function getTargetLeverageByScore(score, strategy) {
  const rules = Array.isArray(strategy?.allocation) ? strategy.allocation : [];
  const nonBase = rules.filter((r) => r.minScore !== -99);

  // schema 已保證 minScore 嚴格遞增，從高分到低分倒序找第一個符合者
  const matchedRule = nonBase.toReversed().find((r) => score >= r.minScore);

  if (matchedRule) {
    return {
      leverage: matchedRule.leverage,
      cash: matchedRule.cash,
      comment: matchedRule.comment,
      minScore: matchedRule.minScore,
    };
  }

  // 找不到就回傳底倉（minScore === -99）
  const baseRule = rules.find((r) => r.minScore === -99);
  return {
    leverage: baseRule?.leverage ?? 0.15,
    cash: baseRule?.cash ?? 0.85,
    comment: baseRule?.comment ?? "底倉",
    minScore: -99,
  };
}

/** 當 netAsset 超出所有 tiers 時，預備金比例退守此預設值 */
const RESERVE_RATIO_FALLBACK = 0.1;

/** 預備金達成率低於此百分比視為不足 */
const RESERVE_INSUFFICIENT_THRESHOLD = 80;

// 計算預備金狀態
export function getReserveStatus(ctx, strategy) {
  const tiers = strategy?.reserve?.tiers ?? [];
  const lastTier = tiers.at(-1);
  let targetRatio = lastTier?.ratio ?? RESERVE_RATIO_FALLBACK;

  for (const tier of tiers) {
    if (ctx.netAsset <= tier.maxAsset) {
      targetRatio = tier.ratio;
      break;
    }
  }

  const targetReserve = ctx.netAsset * targetRatio;
  const currentReserve = ctx.reserveCash || 0; // 假設 ctx 有提供
  const achievementRate =
    targetReserve > 0 ? (currentReserve / targetReserve) * 100 : 0;

  return {
    targetReserve,
    currentReserve,
    achievementRate,
    isInsufficient: achievementRate < RESERVE_INSUFFICIENT_THRESHOLD,
  };
}

/** 當 dropScoreRules 資料不足時，極端恐慌買入的跌幅門檻預設值 */
const EXTREME_DROP_THRESHOLD_FALLBACK = 30;

// 取得極端恐慌買入條件
export function getExtremeDropThreshold(strategy) {
  const rules = Array.isArray(strategy?.buy?.dropScoreRules)
    ? strategy.buy.dropScoreRules.toSorted((a, b) => b.minDrop - a.minDrop)
    : [];

  const rank = strategy?.buy?.panic?.minDropRank ?? 2;

  if (rules.length < rank) {
    return rules[0]?.minDrop ?? EXTREME_DROP_THRESHOLD_FALLBACK;
  }

  return rules[rank - 1]?.minDrop ?? EXTREME_DROP_THRESHOLD_FALLBACK;
}

/**
 * 取得賣出後的目標倉位設定（從 allocation 陣列尾端倒數第 n 筆）。
 * postAllocationIndexFromEnd 代表賣出後降至倒數第幾個等級。
 * @param {object} strategy
 * @returns {{ leverage, cash, comment, minScore }}
 */
export function getPostSellAllocation(strategy) {
  const rules = Array.isArray(strategy?.allocation) ? strategy.allocation : [];
  const n = Number(strategy?.sell?.postAllocationIndexFromEnd ?? 2);

  if (rules.length < n) {
    throw new Error(
      `strategy.allocation 長度不足：len=${rules.length}, 但 postAllocationIndexFromEnd=${n}`,
    );
  }

  return rules.at(-n);
}
