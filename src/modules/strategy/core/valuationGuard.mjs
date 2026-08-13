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

export function resolveTrendConfirmation(priceData, _config) {
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
  const cfg = config?.valuationMomentum;
  if (!cfg?.enabled) {
    return {
      prMomentum: 0,
      prMomentumTrend: 0,
      momentumAdjustment: 1.0,
      momentumLabel: "",
      isInHighPRZone: false,
      isExtremeOvervaluation: false,
    };
  }

  const { currentVix, previousVix } = vixData;
  const highPRZone = cfg.highPRZone || { triggerPR: 85 };
  const extremePRThreshold = cfg.extremePRThreshold ?? 95;

  // ── VIX 歷史數據接入（已完成）───────────────────────────────────
  // previousVix 現已從 ctx.vixArr 取得（見 strategyEngine.mjs）
  // VIX 動能補正常態運作
  // ─────────────────────────────────────────────────────────────

  // 一階動能：PR 變化量（6 天對比）
  const historyLen = pbRecordsObjects?.length || 0;
  const prevPR =
    historyLen >= 6 ? pbRecordsObjects[historyLen - 6].pr : currentPR;
  const prMomentum = currentPR - (prevPR || currentPR);

  // 二階動能：動能趨勢（加速度）
  // 計算 12 天前的 PR，用於計算動能變化
  const prevPrevPR =
    historyLen >= 12 ? pbRecordsObjects[historyLen - 12].pr : prevPR;
  const prevMomentum = prevPR - (prevPrevPR || prevPR);
  const prMomentumTrend = prMomentum - prevMomentum;

  let momentumAdjustment = 1.0;
  let momentumLabel = [];

  // 檢查是否進入高估區
  const isInHighPRZone = currentPR >= highPRZone.triggerPR;
  const isExtremeOvervaluation = currentPR >= extremePRThreshold;

  // ── 極度高估硬條件（PR ≥ 95%）──────────────────────────────────
  if (isExtremeOvervaluation) {
    momentumAdjustment = cfg.extremeOvervaluationMultiplier ?? 0.5;
    momentumLabel.push(
      `🔴 極度高估 PR${currentPR}% -> 槓桿壓縮 x${momentumAdjustment}`,
    );
  }
  // ─────────────────────────────────────────────────────────────

  if (isInHighPRZone && !isExtremeOvervaluation) {
    // 極度高估時跳過其他懲罰計算（已應用最嚴懲罰）
    // 1. PR 動能檢查（一階導數）
    const risingThreshold = cfg.relaxedMomentumThreshold || 5;
    if (prMomentum > risingThreshold) {
      const risingPenalty = cfg.risingPenaltyMultiplier || 0.85;
      momentumAdjustment *= risingPenalty;
      momentumLabel.push(`📈 估值動能 +${prMomentum.toFixed(1)}`);
    }

    // 2. PR 動能趨勢檢查（二階導數）
    if (prMomentumTrend > 3) {
      const accelerationPenalty = cfg.accelerationPenaltyMultiplier ?? 0.9;
      momentumAdjustment *= accelerationPenalty;
      momentumLabel.push(`⚡ 動能加速 +${prMomentumTrend.toFixed(1)}`);
    } else if (prMomentumTrend < -3) {
      const decelerationRelief = cfg.decelerationReliefMultiplier ?? 1.05;
      momentumAdjustment = Math.min(
        momentumAdjustment * decelerationRelief,
        1.0,
      );
      momentumLabel.push(`📉 動能放緩 ${prMomentumTrend.toFixed(1)}`);
    }

    // 3. VIX 動能檢查
    if (currentVix != null && previousVix != null) {
      const vixSpikeThreshold = highPRZone.vixSpikeThreshold || 0.2;
      const vixSpikeMultiplier = highPRZone.vixSpikeMultiplier || 0.85;
      const vixAbsoluteHigh = highPRZone.vixAbsoluteHigh || 30;
      const vixAbsoluteMultiplier = highPRZone.vixAbsoluteMultiplier || 0.7;

      // VIX 急升（恐慌）
      const vixSpike =
        (currentVix - previousVix) / previousVix > vixSpikeThreshold;
      if (vixSpike) {
        momentumAdjustment *= vixSpikeMultiplier;
        momentumLabel.push(`⚡ VIX 急升 ${(vixSpike * 100).toFixed(0)}%`);
      }

      // VIX 絕對值過高
      if (currentVix > vixAbsoluteHigh) {
        momentumAdjustment *= vixAbsoluteMultiplier;
        momentumLabel.push(`🚨 VIX 高位 ${currentVix}`);
      }
    }

    // 4. VIX 絕對值過高（無 previousVix 時）
    if (currentVix != null && previousVix == null) {
      const vixAbsoluteHigh = highPRZone.vixAbsoluteHigh || 30;
      const vixAbsoluteMultiplier = highPRZone.vixAbsoluteMultiplier || 0.7;

      if (currentVix > vixAbsoluteHigh) {
        momentumAdjustment *= vixAbsoluteMultiplier;
        momentumLabel.push(`🚨 VIX 高位 ${currentVix}`);
      }
    }
  } else if (isExtremeOvervaluation && currentVix != null) {
    // 極度高估時仍檢查 VIX（額外風險因子）
    const vixAbsoluteHigh = highPRZone.vixAbsoluteHigh || 30;
    const vixAbsoluteMultiplier = highPRZone.vixAbsoluteMultiplier || 0.7;

    if (currentVix > vixAbsoluteHigh) {
      momentumAdjustment *= vixAbsoluteMultiplier;
      momentumLabel.push(`🚨 VIX 高位 ${currentVix}`);
    }
  }

  const finalLabel =
    momentumLabel.length > 0
      ? momentumLabel.join(" → ") + ` -> 壓縮 x${momentumAdjustment.toFixed(2)}`
      : "";

  return {
    prMomentum,
    prMomentumTrend,
    momentumAdjustment,
    momentumLabel: finalLabel,
    isInHighPRZone,
    isExtremeOvervaluation,
  };
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
    // 從 ctx.vixArr 取得 VIX 歷史數據
    const vixArr = ctx.vixArr || [];
    const currentVix = vixArr.length > 0 ? vixArr[vixArr.length - 1] : null;
    const previousVix = vixArr.length > 1 ? vixArr[vixArr.length - 2] : null;

    const momentumResult = resolveValuationMomentum(
      vgResult.currentPR,
      ctx.pbRecordsObjects,
      strategy,
      { currentVix, previousVix },
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
        valuationMomentumResult: momentumResult,
      };
    }
  }

  return null;
}
