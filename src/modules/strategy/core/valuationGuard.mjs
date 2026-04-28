export function resolveValuationGuard(currentPB, pbRecords, config) {
  if (
    currentPB == null ||
    !Array.isArray(pbRecords) ||
    pbRecords.length === 0
  ) {
    return {
      guardActive: false,
      currentPR: null,
      multiplier: 1.0,
      hitTier: null,
    };
  }

  // Calculate PR (Percentile Rank)
  const sorted = [...pbRecords].sort((a, b) => a - b);
  const rank = sorted.findIndex((v) => v >= currentPB);
  const currentPR = rank === -1 ? 100 : (rank / sorted.length) * 100;

  const tiers = [...(config?.valuationGuard?.tiers || [])].sort(
    (a, b) => a.minPr - b.minPr,
  );
  let hitTier = null;
  let hitTierIndex = -1;
  let multiplier = 1.0;
  let guardActive = false;

  for (let i = 0; i < tiers.length; i++) {
    if (currentPR >= tiers[i].minPr) {
      hitTier = tiers[i];
      hitTierIndex = i;
      multiplier = tiers[i].multiplier;
      guardActive = true;
    }
  }

  return {
    guardActive,
    currentPR: Math.round(currentPR),
    multiplier,
    hitTier,
    hitTierIndex,
  };
}

export function resolveTrendConfirmation(priceData, config) {
  const { closeArr, ma20Arr, atrArr } = priceData;
  if (!closeArr || !ma20Arr || closeArr.length < 2 || ma20Arr.length < 2) {
    return {
      trendLabel: "資料不足",
      ma20BreakDays: 0,
      priceAboveAtrSupport: false,
    };
  }

  const currentPrice = closeArr[closeArr.length - 1];
  const currentMa20 = ma20Arr[ma20Arr.length - 1];

  let ma20BreakDays = 0;
  for (let i = closeArr.length - 1; i >= 0; i--) {
    if (closeArr[i] < ma20Arr[i]) {
      ma20BreakDays++;
    } else {
      break;
    }
  }

  const atr = atrArr?.[atrArr.length - 1] || 0;
  const atrSupport = currentMa20 - atr * 1.5;
  const priceAboveAtrSupport = currentPrice > atrSupport;

  return {
    trendLabel:
      ma20BreakDays > 0 ? `📉 MA20 跌破 ${ma20BreakDays} 日` : "📈 趨勢偏多",
    ma20BreakDays,
    priceAboveAtrSupport,
  };
}

// TODO: previousVix 目前未被使用，VIX 動量邏輯尚未實作
// 呼叫端傳入 previousVix: null，待實作時需補充歷史 VIX 資料來源
export function resolveValuationMomentum(
  currentPR,
  pbRecordsObjects,
  config,
  vixData = {},
) {
  const cfg = config?.valuationGuard?.momentum;
  if (!cfg?.enabled)
    return { prMomentum: 0, momentumAdjustment: 1.0, momentumLabel: "" };

  // TODO: currentVix / previousVix 待 VIX 動量邏輯實作後接入
  // const { currentVix, previousVix } = vixData;

  // Simple momentum: compare current PR with PR 5 days ago
  const historyLen = pbRecordsObjects?.length || 0;
  const prevPR =
    historyLen >= 6 ? pbRecordsObjects[historyLen - 6].pr : currentPR;
  const prMomentum = currentPR - (prevPR || currentPR);

  let momentumAdjustment = 1.0;
  let momentumLabel = "";

  if (currentPR >= (cfg.highPRZone || 80)) {
    if (prMomentum > (cfg.relaxedMomentumThreshold || 2)) {
      momentumAdjustment = cfg.risingPenaltyMultiplier || 0.8;
      momentumLabel = `📈 估值動量 +${prMomentum} -> 壓縮 x${momentumAdjustment}`;
    }
  }

  return { prMomentum, momentumAdjustment, momentumLabel };
}

export function evaluateValuationGuard(ctx, strategy, vgResult) {
  const vgCfg = strategy?.valuationGuard;
  if (!vgCfg?.enabled) return null;

  const latchState = ctx.valuationGuardState ?? {
    latchActive: false,
    latchTriggeredAt: null,
    latchTriggeredPR: null,
  };

  const triggerPrThreshold = vgCfg?.latch?.triggerPrThreshold ?? 90;
  const prBelowThreshold =
    vgCfg?.latch?.unlockConditions?.condition1?.prBelowThreshold ?? 50;

  // Latch logic
  const shouldLatch =
    !latchState.latchActive && vgResult.currentPR >= triggerPrThreshold;
  const shouldUnlatch =
    latchState.latchActive && vgResult.currentPR < prBelowThreshold;

  // 如果觸發 latch，回傳 triggered
  if (shouldLatch) {
    return {
      valuationGuardStatus: "latch_triggered",
      marketStatus: "🚨【估值守衛：清算觸發】",
      target: "📉 立即清倉",
      targetSuggestionShort: `PR${vgResult.currentPR} 首次觸發清算`,
      suggestion: `• PB PR 分位數：${vgResult.currentPR} >= ${triggerPrThreshold} (首次觸發)`,
      shouldLatch: true,
      latchNowActive: true,
      valuationGuardResult: vgResult,
    };
  }

  // 如果已經在鎖定中且未解鎖，回傳 active
  const isCurrentlyLatched = latchState.latchActive && !shouldUnlatch;
  if (isCurrentlyLatched) {
    return {
      valuationGuardStatus: "latch_active",
      marketStatus: "🔒【估值守衛：清算鎖定】",
      target: "📉 清倉降槓",
      targetSuggestionShort: `PR${vgResult.currentPR} 觸發清算鎖定`,
      suggestion: `• PB PR 分位數：${vgResult.currentPR} >= ${triggerPrThreshold} (鎖定中)`,
      latchNowActive: true,
      valuationGuardResult: vgResult,
    };
  }

  if (vgResult.guardActive) {
    const momentumResult = resolveValuationMomentum(
      vgResult.currentPR,
      ctx.pbRecordsObjects,
      strategy,
      { currentVix: ctx.vix, previousVix: null },
    );

    let finalMultiplier = vgResult.multiplier;
    if (typeof momentumResult.momentumAdjustment === "number") {
      finalMultiplier *= momentumResult.momentumAdjustment;
    }

    // If multiplier is very low, we might want to return a decision object
    if (finalMultiplier < 0.5) {
      return {
        valuationGuardStatus: "guard_active",
        marketStatus: "🛡️【估值守衛：強勢壓縮】",
        target: "🚧 槓桿限制",
        targetSuggestionShort: `PR${vgResult.currentPR} 壓縮槓桿至 x${finalMultiplier.toFixed(2)}`,
        suggestion: `• 估值偏高，PR 分位數：${vgResult.currentPR}\n• 槓桿乘數限制：x${finalMultiplier.toFixed(2)}`,
      };
    }
  }

  return null;
}
