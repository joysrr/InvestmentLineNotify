// 取得目標槓桿比例
export function getTargetLeverageByScore(score, strategy) {
  const rules = Array.isArray(strategy?.allocation) ? strategy.allocation : [];

  // 從高分到低分找到第一個符合的規則
  const matchedRule = rules
    .filter((r) => r.minScore !== -99) // 排除底倉
    .sort((a, b) => b.minScore - a.minScore)
    .find((r) => score >= r.minScore);

  if (matchedRule) {
    return {
      leverage: matchedRule.leverage,
      cash: matchedRule.cash,
      comment: matchedRule.comment,
      minScore: matchedRule.minScore,
    };
  }

  // 找不到就回傳底倉
  const baseRule = rules.find((r) => r.minScore === -99);
  return {
    leverage: baseRule?.leverage || 0.15,
    cash: baseRule?.cash || 0.85,
    comment: baseRule?.comment || "底倉",
    minScore: -99,
  };
}

// 計算預備金狀態
export function getReserveStatus(ctx, strategy) {
  const tiers = strategy?.reserve?.tiers || [];

  // 找到當前資產對應的預備金比例
  let targetRatio = 0.1; // 預設 10%
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
    isInsufficient: achievementRate < 80, // 低於 80% 算不足
  };
}

// 取得極端恐慌買入條件
export function getExtremeDropThreshold(strategy) {
  const rules = Array.isArray(strategy?.buy?.dropScoreRules)
    ? strategy.buy.dropScoreRules.toSorted((a, b) => b.minDrop - a.minDrop)
    : [];

  const rank = strategy?.buy?.panic?.minDropRank ?? 2;

  if (rules.length < rank) {
    return rules[0]?.minDrop ?? 30;
  }

  return rules[rank - 1]?.minDrop ?? 30;
}

export function getPostSellAllocation(strategy) {
  const rules = Array.isArray(strategy?.allocation) ? strategy.allocation : [];
  const n = Number(strategy?.sell?.postAllocationIndexFromEnd ?? 2);

  if (rules.length < n) {
    throw new Error(
      `strategy.allocation 長度不足：len=${rules.length}, 但 postAllocationIndexFromEnd=${n}`,
    );
  }

  const rule = rules.at(-n);
  if (!rule) throw new Error("取得 post allocation 失敗");
  return rule;
}
