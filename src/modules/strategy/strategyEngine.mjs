import {
  getTargetLeverageByScore,
  getReserveStatus,
  getExtremeDropThreshold,
  getPostSellAllocation,
} from "./riskManagement.mjs";
import {
  validateStrategyConfig,
  fetchStrategyConfig
  computeEntryScore,
  computeReversalTriggers,
  computeOverheatState,
  computeSellSignals,
} from "./signalRules.mjs";
import {
  calculateIndicators,
  last2,
  crossUpLevel,
  crossDownLevel,
  roseAboveAfterBelow,
  fellBelowAfterAbove,
  wasAboveLevel,
  wasBelowLevel,
  macdCrossUp,
  macdCrossDown,
  kdCrossDown,
  kdCrossUp,
  lastKD,
  kdSeries,
  getMACDSignal,
} from "./indicators.mjs";
import { loadHolidaySet } from "../providers/twseProvider.mjs";
import { computeGrossLeverage } from "./leverageMonitor.mjs";
import {
  analyzeMarginRisk,
  analyzeCapitalDecoupling,
} from "./marginManager.mjs";
import { generateScoringMatrix } from "./signalGenerator.mjs";
import { archiveManager } from "../data/archiveManager.mjs";

/**
 * 維持率 4 層狀態機判斷
 * @param {number} mm - 當前維持率(%)
 * @param {Object} maint - strategy.maintenance
 * @param {Object} th - strategy.threshold
 * @returns {'critical'|'frozen'|'protect'|'normal'}
 */
function getMarginLayer(mm, maint, th) {
  const marginCallThreshold = maint.marginCallThreshold ?? 135;
  const frozenZone = maint.frozenZone ?? 145;
  const protectTrigger = maint.protectTrigger ?? 160;

  if (mm < marginCallThreshold) return "critical"; // 🔴 斷頭危機
  if (mm < frozenZone) return "frozen"; // 🟠 高危凍結
  if (mm < protectTrigger) return "protect"; // 🟡 預備金防禦
  return "normal"; // 🟢 常態運行
}

/**
 * Pre-Entry Gate：解析當前跌幅/RSI 所在的 entryGate 層級
 * @param {number} dropPercent - 當前跌幅(%)
 * @param {number} rsi - 當前 RSI
 * @param {Object} entryGateCfg - strategy.buy.entryGate
 * @returns {{ tierIndex: number, tier: Object|null, blocked: boolean, blockReason: string|null }}
 */
function resolveEntryGate(dropPercent, rsi, entryGateCfg) {
  if (!entryGateCfg?.enabled || !Array.isArray(entryGateCfg.tiers)) {
    return { tierIndex: -1, tier: null, blocked: false, blockReason: null };
  }

  const tiers = entryGateCfg.tiers;

  // 從高跌幅往低找，取第一個 minDrop <= dropPercent 的 tier
  let matchedIndex = -1;  // 改為 -1 表示未命中
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

  // allowLeverage: false → 直接封鎖加碼
  if (!tier.allowLeverage) {
    return {
      tierIndex: matchedIndex,
      tier,
      blocked: true,
      blockReason: `entryGate Tier ${matchedIndex}：${tier.note}`,
    };
  }

  // allowLeverage: true → 需確認 RSI 是否達標（低於門檻才可進場）
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

/**
 * VIX 情緒短路機制：判斷是否應覆蓋 AI BEARISH 的懲罰效果
 *
 * 短路條件（二選一，滿足其一即觸發）：
 *   1. 絕對短路：vixValue >= vixAbsoluteOverride（預設 35）— 無論趨勢強制觸發
 *   2. 趨勢短路：vixValue >= vixOverrideTrigger（預設 28）且 vixTrend === 'falling'
 *
 * vixTrend 由 vixArr 末兩筆自動推算：
 *   - vixArr 最後一筆 < 倒數第二筆 → 'falling'
 *   - vixArr 最後一筆 > 倒數第二筆 → 'rising'
 *   - 相等或資料不足 → 'flat'
 *
 * 若 config 欄位 vixOverrideTrigger / vixAbsoluteOverride 不存在，
 * 視為功能停用，直接回傳 overrideActive: false。
 *
 * @param {number} vixValue - 當前 VIX 數值
 * @param {number[]} vixArr - VIX 歷史序列（至少需 2 筆才能判斷趨勢）
 * @param {Object} config - 完整 strategy config
 * @returns {{ overrideActive: boolean, overrideReason: string, vixTrend: string }}
 */
function resolveVixOverride(vixValue, vixArr, config) {
  const cfg = config?.macroSentiment;

  // 功能未設定 → 停用
  if (cfg?.vixOverrideTrigger == null && cfg?.vixAbsoluteOverride == null) {
    return { overrideActive: false, overrideReason: "", vixTrend: "unknown" };
  }

  const absoluteThreshold = cfg.vixAbsoluteOverride ?? 35;
  const trendThreshold = cfg.vixOverrideTrigger ?? 28;

  // 推算 vixTrend 從歷史序列末兩筆
  let vixTrend = "flat";
  if (Array.isArray(vixArr) && vixArr.length >= 2) {
    const prev = vixArr[vixArr.length - 2];
    const curr = vixArr[vixArr.length - 1];
    if (Number.isFinite(prev) && Number.isFinite(curr)) {
      if (curr < prev) vixTrend = "falling";
      else if (curr > prev) vixTrend = "rising";
    }
  }

  // 絕對短路（無論趨勢）
  if (Number.isFinite(vixValue) && vixValue >= absoluteThreshold) {
    return {
      overrideActive: true,
      overrideReason: `VIX ${vixValue.toFixed(1)} ≥ 絕對門檻 ${absoluteThreshold}（強制短路）`,
      vixTrend,
    };
  }

  // 趨勢短路（需 falling）
  if (
    Number.isFinite(vixValue) &&
    vixValue >= trendThreshold &&
    vixTrend === "falling"
  ) {
    return {
      overrideActive: true,
      overrideReason: `VIX ${vixValue.toFixed(1)} ≥ 趨勢門檻 ${trendThreshold} 且趨勢下行（趨勢短路）`,
      vixTrend,
    };
  }

  // 未觸發
  return { overrideActive: false, overrideReason: "", vixTrend };
}

/**
 * 解析 valuationGuard 狀態：依據當前 PB 的歷史分位數（PR）
 * 判斷所命中的 tier，回傳對應的槓桿壓縮乘數。
 *
 * 核心邏輯：
 *  1. 從 pbHistory records（已排序的 PB 陣列）計算 PR 分位數
 *  2. 依 valuationGuard.tiers 由高到低找第一個 prThreshold <= currentPR
 *  3. 回傳該 tier 的 multiplier 與相關資訊
 *  4. 資料不足（< 126 筆）時使用 fallback：僅用靜態 PB 閾值判斷
 *
 * @param {number} currentPB - 今日大盤 PB 值
 * @param {number[]} pbRecords - 歷史 PB 陣列（由舊到新排序，已去除 null/NaN）
 * @param {Object} config - 完整 strategy config
 * @returns {{
 *   enabled: boolean,
 *   currentPR: number|null,
 *   recordCount: number,
 *   hitTierIndex: number,
 *   hitTier: Object|null,
 *   multiplier: number,
 *   isFallback: boolean,
 *   fallbackReason: string,
 *   guardActive: boolean,
 *   guardLabel: string,
 * }}
 */
function resolveValuationGuard(currentPB, pbRecords, config) {
  const cfg = config?.valuationGuard;

  // ── 功能未啟用 ──────────────────────────────────────────────
  if (!cfg?.enabled) {
    return {
      enabled: false,
      currentPR: null,
      recordCount: 0,
      hitTierIndex: -1,
      hitTier: null,
      multiplier: 1.0,
      isFallback: false,
      fallbackReason: "",
      guardActive: false,
      guardLabel: "",
    };
  }

  const tiers = Array.isArray(cfg.tiers) ? cfg.tiers : [];
  const minRecordsForPR = cfg.minRecordsForPR ?? 126;

  // ── 有效 PB records 篩選 ────────────────────────────────────
  const validRecords = Array.isArray(pbRecords)
    ? pbRecords.filter((v) => Number.isFinite(v) && v > 0)
    : [];
  const recordCount = validRecords.length;

  // ── 資料不足：fallback 模式（靜態 PB 閾值） ─────────────────
  if (recordCount < minRecordsForPR) {
    const fallbackReason = `歷史 PB 資料不足（${recordCount} 筆，門檻 ${minRecordsForPR} 筆），改用靜態 PB 閾值`;
    const fallbackPbThreshold = cfg.fallbackPbThreshold ?? 1.8;

    if (!Number.isFinite(currentPB) || currentPB < fallbackPbThreshold) {
      return {
        enabled: true,
        currentPR: null,
        recordCount,
        hitTierIndex: -1,
        hitTier: null,
        multiplier: 1.0,
        isFallback: true,
        fallbackReason,
        guardActive: false,
        guardLabel: "📊 估值守衛：未觸發（資料不足，PB 低於靜態門檻）",
      };
    }

    // fallback 觸發：取 tiers 中最低分位門檻的 tier 作為 fallback tier
    const fallbackTier = tiers.length > 0 ? tiers[0] : null;
    const fallbackMultiplier = fallbackTier?.multiplier ?? 0.8;

    return {
      enabled: true,
      currentPR: null,
      recordCount,
      hitTierIndex: 0,
      hitTier: fallbackTier,
      multiplier: fallbackMultiplier,
      isFallback: true,
      fallbackReason,
      guardActive: true,
      guardLabel: `📊 估值守衛：fallback 啟動（PB ${currentPB?.toFixed(2)} ≥ 靜態門檻 ${fallbackPbThreshold}）`,
    };
  }

  // ── 計算 PR 分位數 ────────────────────────────────────────────
  // PR = 低於 currentPB 的歷史筆數 / 總筆數 × 100
  const sorted = [...validRecords].sort((a, b) => a - b);
  const belowCount = sorted.filter((v) => v < currentPB).length;
  const currentPR = Math.round((belowCount / recordCount) * 100);

  // ── 比對 tiers（由高分位往低找，取第一個 prThreshold <= currentPR 的 tier） ──
  let hitTierIndex = -1;
  let hitTier = null;

  // tiers 預期依 prThreshold 由低到高排列（config 中的定義順序）
  // 從最高 prThreshold 往下掃，找第一個 <= currentPR
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (currentPR >= tiers[i].prThreshold) {
      hitTierIndex = i;
      hitTier = tiers[i];
      break;
    }
  }

  // 未命中任何 tier（PR 低於所有門檻）→ 不壓縮
  if (hitTierIndex === -1) {
    return {
      enabled: true,
      currentPR,
      recordCount,
      hitTierIndex: -1,
      hitTier: null,
      multiplier: 1.0,
      isFallback: false,
      fallbackReason: "",
      guardActive: false,
      guardLabel: `📊 估值守衛：未觸發（PB PR${currentPR}，低於最低門檻 ${tiers[0]?.prThreshold ?? "N/A"}）`,
    };
  }

  // ── 命中 tier，回傳壓縮資訊 ────────────────────────────────
  const multiplier = Number.isFinite(hitTier.multiplier)
    ? hitTier.multiplier
    : 1.0;
  const tierLabel = hitTier.label ?? `PR${hitTier.prThreshold}`;

  return {
    enabled: true,
    currentPR,
    recordCount,
    hitTierIndex,
    hitTier,
    multiplier,
    isFallback: false,
    fallbackReason: "",
    guardActive: true,
    guardLabel: `📊 估值守衛：${tierLabel}（PB PR${currentPR} ≥ 門檻 ${hitTier.prThreshold}，乘數 ×${multiplier}）`,
  };
}

/**
 * 解析趨勢確認狀態：計算 MA20 跌破天數與 ATR 動態支撐位，
 * 供 valuationGuard latch 解鎖條件 2（價格從 ATR 低點回升）使用。
 *
 * 計算項目：
 *  1. ma20BreakDays    — 當前收盤價連續低於 MA20 的天數
 *  2. atrSupportLevel  — ATR 動態支撐位：近 N 日最低收盤 + atrMultiplier × ATR
 *  3. priceAboveAtrSupport — 當前價格是否已回升至 ATR 支撐位以上
 *
 * @param {Object} priceData - 包含歷史價格與指標序列的資料物件
 * @param {number[]} priceData.closeArr  - 收盤價序列（由舊到新）
 * @param {number[]} priceData.ma20Arr   - MA20 序列（由舊到新，與 closeArr 等長）
 * @param {number[]} priceData.atrArr    - ATR 序列（由舊到新，與 closeArr 等長）
 * @param {Object} config - 完整 strategy config
 * @returns {{
 *   ma20BreakDays: number,
 *   atrSupportLevel: number|null,
 *   priceAboveAtrSupport: boolean,
 *   currentPrice: number|null,
 *   currentMA20: number|null,
 *   currentATR: number|null,
 *   trendLabel: string,
 * }}
 */
function resolveTrendConfirmation(priceData, config) {
  const cfg = config?.valuationGuard?.latch;

  const closeArr = Array.isArray(priceData?.closeArr) ? priceData.closeArr : [];
  const ma20Arr = Array.isArray(priceData?.ma20Arr) ? priceData.ma20Arr : [];
  const atrArr = Array.isArray(priceData?.atrArr) ? priceData.atrArr : [];

  // ── 資料不足保護 ─────────────────────────────────────────────
  if (closeArr.length === 0 || ma20Arr.length === 0) {
    return {
      ma20BreakDays: 0,
      atrSupportLevel: null,
      priceAboveAtrSupport: false,
      currentPrice: null,
      currentMA20: null,
      currentATR: null,
      trendLabel: "📉 趨勢確認：資料不足",
    };
  }

  const currentPrice = closeArr[closeArr.length - 1];
  const currentMA20 = ma20Arr[ma20Arr.length - 1];
  const currentATR = atrArr.length > 0 ? atrArr[atrArr.length - 1] : null;

  // ── 1. 計算 MA20 跌破天數（從最新往回數，連續低於 MA20 的天數） ──
  let ma20BreakDays = 0;
  const minLen = Math.min(closeArr.length, ma20Arr.length);
  for (let i = minLen - 1; i >= 0; i--) {
    const close = closeArr[i];
    const ma20 = ma20Arr[i];
    if (Number.isFinite(close) && Number.isFinite(ma20) && close < ma20) {
      ma20BreakDays++;
    } else {
      break; // 一旦有一天未跌破即停止
    }
  }

  // ── 2. 計算 ATR 動態支撐位 ───────────────────────────────────
  // 支撐位 = 近 atrLookbackDays 日最低收盤價 + atrMultiplier × 當日 ATR
  const atrLookbackDays = cfg?.atrLookbackDays ?? 20;
  const atrMultiplier = cfg?.atrSupportMultiplier ?? 1.0;

  let atrSupportLevel = null;
  let priceAboveAtrSupport = false;

  if (
    Number.isFinite(currentATR) &&
    currentATR > 0 &&
    closeArr.length >= atrLookbackDays
  ) {
    const lookbackSlice = closeArr.slice(-atrLookbackDays);
    const recentLow = Math.min(...lookbackSlice.filter(Number.isFinite));
    atrSupportLevel = recentLow + atrMultiplier * currentATR;
    priceAboveAtrSupport =
      Number.isFinite(currentPrice) && currentPrice > atrSupportLevel;
  }

  // ── 3. 產生趨勢標籤供 Telegram 顯示 ─────────────────────────
  let trendLabel = "";
  if (ma20BreakDays === 0) {
    trendLabel = `📈 趨勢確認：收盤在 MA20 之上`;
  } else {
    const atrInfo =
      atrSupportLevel != null
        ? `，ATR 支撐 ${atrSupportLevel.toFixed(2)}（${priceAboveAtrSupport ? "✅ 已回升" : "❌ 未回升"}）`
        : "";
    trendLabel = `📉 趨勢確認：MA20 跌破 ${ma20BreakDays} 日${atrInfo}`;
  }

  return {
    ma20BreakDays,
    atrSupportLevel,
    priceAboveAtrSupport,
    currentPrice,
    currentMA20,
    currentATR,
    trendLabel,
  };
}

/**
 * 解析估值動量狀態：依據歷史序列與當前 PR，計算短期動量並回傳調整因子。
 *
 * highPRZone 三個觸發條件（取最嚴格乘數）：
 *   1. PR ≥ 85 且 prMomentum > +5（放寬門檻）→ ×0.85
 *   2. PR ≥ 85 且 VIX 單日急升 > vixSpikeThreshold（20%）→ ×0.85
 *   3. PR ≥ 85 且 VIX 絕對值 > vixAbsoluteHigh（30）→ ×0.7
 *
 * @param {number} currentPR - 今日大盤 PR 分位數
 * @param {{ date: string, pb: number }[]} pbRecords - 歷史 PB 物件陣列
 * @param {Object} config - 完整 strategy config
 * @param {{ currentVix: number|null, previousVix: number|null }} vixData - VIX 數據
 * @returns {{
 *   prMomentum: number|null,
 *   momentumAdjustment: number|string,
 *   momentumLabel: string
 * }}
 */
function resolveValuationMomentum(currentPR, pbRecords, config, vixData = {}) {
  const cfg = config?.valuationMomentum;
  if (!cfg?.enabled || currentPR == null || !Array.isArray(pbRecords)) {
    return { prMomentum: null, momentumAdjustment: 1.0, momentumLabel: "" };
  }

  const lookbackDays = cfg.lookbackDays ?? 20;

  // 取得有效交易日 PB 紀錄
  const validRecords = pbRecords.filter((r) => r.date && Number.isFinite(r.pb));
  if (validRecords.length < lookbackDays + 1) {
    return { prMomentum: null, momentumAdjustment: 1.0, momentumLabel: "（動量：資料不足）" };
  }

  // 排序確保時間一致（舊到新）
  const sortedByDate = [...validRecords].sort((a, b) => a.date.localeCompare(b.date));

  // 目標日為 N 日前
  const targetIndex = sortedByDate.length - 1 - lookbackDays;
  if (targetIndex < 0) {
    return { prMomentum: null, momentumAdjustment: 1.0, momentumLabel: "（動量：日期誤差）" };
  }

  const targetPb = sortedByDate[targetIndex].pb;

  // 計算 N 日前的 PR 分位數
  const historyUpToTarget = sortedByDate.slice(0, targetIndex + 1).map(r => r.pb);
  const totalCountPast = historyUpToTarget.length;

  if (totalCountPast < 1) {
    return { prMomentum: null, momentumAdjustment: 1.0, momentumLabel: "" };
  }

  const belowCountPast = historyUpToTarget.filter((v) => v < targetPb).length;
  const pastPR = Math.round((belowCountPast / totalCountPast) * 100);

  const prMomentum = currentPR - pastPR;

  let momentumAdjustment = 1.0;
  let momentumLabel = "";

  const risingThreshold = cfg.risingThreshold ?? 10;
  const fallingThreshold = cfg.fallingThreshold ?? -10;
  const risingPenaltyMultiplier = cfg.risingPenaltyMultiplier ?? 0.85;

  const hpr = cfg.highPRZone;
  const triggerPR = hpr?.triggerPR ?? 85;

  const { currentVix, previousVix } = vixData;

  if (currentPR >= triggerPR) {
    // ── 高位補正區（PR 85–90 過渡敏感區域） ──────────────────
    // 三個獨立觸發條件，取最嚴格乘數
    const relaxedMomentumThreshold = hpr?.relaxedMomentumThreshold ?? 5;
    const vixSpikeThreshold = hpr?.vixSpikeThreshold ?? 0.2;
    const vixSpikeMultiplier = hpr?.vixSpikeMultiplier ?? 0.85;
    const vixAbsoluteHigh = hpr?.vixAbsoluteHigh ?? 30;
    const vixAbsoluteMultiplier = hpr?.vixAbsoluteMultiplier ?? 0.7;

    // 收集所有命中的觸發條件及其乘數
    const triggers = [];

    // 條件 1：放寬動量門檻
    if (prMomentum > relaxedMomentumThreshold) {
      triggers.push({
        multiplier: risingPenaltyMultiplier,
        label: `📈 估值動量 +${prMomentum}（高位放寬門檻 +${relaxedMomentumThreshold}）→ 壓縮 ×${risingPenaltyMultiplier}`,
      });
    }

    // 條件 2：VIX 單日急升
    if (
      Number.isFinite(currentVix) &&
      Number.isFinite(previousVix) &&
      previousVix > 0
    ) {
      const vixChangeRate = (currentVix - previousVix) / previousVix;
      if (vixChangeRate > vixSpikeThreshold) {
        triggers.push({
          multiplier: vixSpikeMultiplier,
          label: `⚡ VIX 急升 ${(vixChangeRate * 100).toFixed(1)}%（門檻 ${(vixSpikeThreshold * 100).toFixed(0)}%）→ 強制壓縮 ×${vixSpikeMultiplier}`,
        });
      }
    }

    // 條件 3：VIX 絕對恐慌
    if (Number.isFinite(currentVix) && currentVix > vixAbsoluteHigh) {
      triggers.push({
        multiplier: vixAbsoluteMultiplier,
        label: `🔥 VIX ${currentVix.toFixed(1)} > ${vixAbsoluteHigh}（高位恐慌並存）→ 加重壓縮 ×${vixAbsoluteMultiplier}`,
      });
    }

    // 取最嚴格（最低）乘數
    if (triggers.length > 0) {
      triggers.sort((a, b) => a.multiplier - b.multiplier);
      momentumAdjustment = triggers[0].multiplier;
      momentumLabel = triggers[0].label;
    }
  } else {
    // ── 常規區 ────────────────────────────────────────────────
    if (prMomentum > risingThreshold) {
      momentumAdjustment = risingPenaltyMultiplier;
      momentumLabel = `📈 估值動量 +${prMomentum} → 額外壓縮 ×${momentumAdjustment}`;
    } else if (prMomentum < fallingThreshold && cfg.fallingRelief) {
      momentumAdjustment = "relief";
      momentumLabel = `📉 估值動量 ${prMomentum} → 解除一層壓縮`;
    }
  }

  return { prMomentum, momentumAdjustment, momentumLabel };
}

/**
 * 決策大腦：綜合估值、維持率、槓桿、斜率與評分矩陣產出最終建議
 */
export async function buildDecision(
  ctx,
  strategy,
  grossLeverageResult,
  ma60Slope = null,
) {
  const th = strategy.threshold;
  const maint = strategy.maintenance;

  const {
    maintenanceMargin,
    z2Ratio,
    netAsset,
    currentZ2Value,
    entry,
    overheat,
    reversal,
    sellSignals,
    cooldownStatus,
    valuation,
  } = ctx;

  const reserveStatus = getReserveStatus(ctx, strategy);
  const marginLayer = getMarginLayer(maintenanceMargin, maint, th);

  // ─────────────────────────────────────────────────────────────
  // 維持率 4 層狀態機（越危險越優先，最先被檢出）
  // ─────────────────────────────────────────────────────────────

  // 🔴 Layer 0：斷頭危機 < marginCallThreshold(135)
  // 強制市價降槓桿警示，一票否決所有加碼，優先指示補足保證金
  if (marginLayer === "critical") {
    const marginCallThreshold = maint.marginCallThreshold ?? 135;
    return {
      maintenanceLayer: "critical",
      marketStatus: "🔴【斷頭危機】",
      target: "🛑 強制降槓桿",
      targetSuggestionShort: "立即補保證金或市價降槓桿，禁止一切加碼",
      targetSuggestion:
        "維持率已低於斷頭警戒線，必須立即行動：補充保證金或市價賣出 00675L 降槓桿",
      suggestion:
        `• 當前維持率：${maintenanceMargin.toFixed(0)}% (斷頭門檻 ${marginCallThreshold}%)\n` +
        `• ⚠️ 警告：系統已進入強制降槓桿模式，所有加碼操作被一票否決\n` +
        `• 優先行動 1：立即補充保證金（現金或追加擔保品）\n` +
        `• 優先行動 2：若無現金，市價賣出部分 00675L 降低槓桿\n` +
        `• 目標：維持率回升至 ${maint.frozenZone ?? 145}% 以上後再評估後續操作`,
      maintenanceMargin,
      marginCallThreshold,
    };
  }

  // 🟠 Layer 1：高危凍結 135–145% (frozenZone)
  // 禁止所有新進場，強烈通知補足保證金
  if (marginLayer === "frozen") {
    const frozenZone = maint.frozenZone ?? 145;
    const marginCallThreshold = maint.marginCallThreshold ?? 135;
    const totalLoan = ctx.totalLoan || 0;
    const currentCollateral = (maintenanceMargin / 100) * totalLoan;
    const targetCollateral = (frozenZone / 100) * totalLoan;
    const needAmount = Math.max(0, targetCollateral - currentCollateral);
    const reserveSufficient = reserveStatus.currentReserve >= needAmount;

    return {
      maintenanceLayer: "frozen",
      marketStatus: "🟠【高危凍結】",
      target: "🚫 禁止進場",
      targetSuggestionShort: "禁止所有新進場；強烈建議立即補足保證金",
      targetSuggestion: `維持率 ${maintenanceMargin.toFixed(0)}% 進入高危走廊（${marginCallThreshold}–${frozenZone}%），禁止任何新開倉，請立即補足保證金`,
      suggestion:
        `• 當前維持率：${maintenanceMargin.toFixed(0)}% (高危區間 ${marginCallThreshold}–${frozenZone}%)\n` +
        `• 🚫 所有新進場操作已凍結（包含 0050 DCA 與 00675L 加碼）\n` +
        `• 資金缺口：約 ${needAmount.toLocaleString("zh-TW", { maximumFractionDigits: 0 })} 元（補至解凍線 ${frozenZone}%）\n` +
        `• 預備金狀態：${reserveSufficient ? "✅ 充足，可立即動用" : "⚠️ 不足，需補充額外現金"}\n\n` +
        `【執行步驟】\n` +
        `1. ${reserveSufficient ? "動用預備金補充保證金或買入 0050" : "優先補充現金至帳戶"}\n` +
        `2. 嚴禁在此區間追加 00675L 槓桿部位\n` +
        `3. 維持率回升至 ${frozenZone}% 以上後，自動解除凍結`,
      maintenanceMargin,
      frozenZone,
      needAmount,
      reserveSufficient,
    };
  }

  // 🟡 Layer 2：預備金防禦 145–160% (protectTrigger)
  // 暫停高槓桿加碼，優先充實擔保品，允許 baseline DCA
  if (marginLayer === "protect") {
    const protectTarget = maint.protectTarget || 180;
    const totalLoan = ctx.totalLoan || 0;
    const currentCollateral = (maintenanceMargin / 100) * totalLoan;
    const targetCollateral = (protectTarget / 100) * totalLoan;
    const needAmount = Math.max(0, targetCollateral - currentCollateral);
    const reserveSufficient = reserveStatus.currentReserve >= needAmount;

    return {
      maintenanceLayer: "protect",
      marketStatus: "🛡️【維持率低於安全線】",
      target: "🧯 預備金防禦",
      targetSuggestionShort: "動用預備金或補充抵押品；允許 0050 DCA",
      targetSuggestion: `維持率低於 ${maint.protectTrigger}%，建議動用預備金買入 0050 或補充現金，目標維持率 ${protectTarget}%`,
      suggestion:
        `• 當前維持率：${maintenanceMargin.toFixed(0)}% (低於安全線 ${maint.protectTrigger}%)\n` +
        `• 補足目標：${protectTarget}%\n` +
        `• 資金缺口：約 ${needAmount.toLocaleString("zh-TW", { maximumFractionDigits: 0 })} 元\n` +
        `• 當前預備金：${reserveStatus.currentReserve.toLocaleString("zh-TW", { maximumFractionDigits: 0 })} 元\n` +
        `• 預備金狀態：${reserveSufficient ? "✅ 充足，可立即動用" : "⚠️ 不足，需補充額外現金"}\n\n` +
        `【執行步驟】\n` +
        `1. ${reserveSufficient ? "動用預備金買入 0050 (提升抵押品價值)" : "優先補充現金還款"}\n` +
        `2. ${reserveSufficient ? "或補充現金還款 (降低借款)" : "或動用部分預備金買入 0050"}\n` +
        `3. 暫停 00675L 槓桿加碼，允許 0050 baseline DCA 維持`,
      maintenanceMargin,
      protectTrigger: maint.protectTrigger,
      protectTarget,
      reserveStatus,
      needAmount,
      reserveSufficient,
    };
  }

  // 🟢 Layer 3：常態運行 >= protectTrigger(160)
  // 以下為原有策略邏輯完整執行

  // ── 預先計算 Priority 3 極端恐慌破冰 (Extremely Panic Bypass) ──
  // 供 Priority 2 (Gross Leverage) 與 Priority 7 使用
  const ohCfg = strategy?.overrideHierarchy;
  const panicBypassEnabled = ohCfg?.panicBypassEnabled ?? false;
  const panicBypassDropPct = ohCfg?.panicBypassDropPct ?? 0.20;
  const panicVixThreshold = ohCfg?.panicVixThreshold ?? 35;

  const isPanicBypass = 
    panicBypassEnabled && 
    ctx.priceDropPercent > panicBypassDropPct && 
    ctx.vix > panicVixThreshold;

  // 將狀態存入 ctx 供後續模組讀取
  ctx.panicBypassActive = isPanicBypass;

  // ─────────────────────────────────────────────────────────────
  // Priority 2：Gross Leverage 天花板（維持率正常後才執行）
  // hardcap_breach → 強制降槓，Priority 高於 ceiling_breach
  // ceiling_breach → 一票否決新增槓桿，但不強制砍倉
  // ─────────────────────────────────────────────────────────────
  if (grossLeverageResult) {
    if (grossLeverageResult.status === "hardcap_breach") {
      return {
        maintenanceLayer: "normal",
        grossLeverageStatus: "hardcap_breach",
        grossLeverage: grossLeverageResult.grossLeverage,
        marketStatus: "🚨【Gross Leverage 危機紅線】",
        target: "📉 強制降槓",
        targetSuggestionShort: `綜合曝險 ${grossLeverageResult.grossLeverage.toFixed(2)}x 超越危機紅線，強制賣出 00675L 降槓至 ${grossLeverageResult.recoveryTarget}x`,
        targetSuggestion: grossLeverageResult.message,
        suggestion:
          `• 綜合曝險倍數（Gross Leverage）：${grossLeverageResult.grossLeverage.toFixed(2)}x\n` +
          `• 危機紅線：${strategy.grossLeverage.hardCap}x\n` +
          `• 著陸目標：${grossLeverageResult.recoveryTarget}x\n` +
          `• ⚠️ 必須一次性賣出足夠的 00675L，使曝險降至著陸目標，避免凌遲式砍倉\n` +
          `• 恐慌加碼通道在此狀態下完全封閉`,
      };
    }

    if (grossLeverageResult.status === "ceiling_breach") {
      const bypassWarning = isPanicBypass
        ? "\n\n⚠️ <b>極端恐慌破冰：估值防禦已 Bypass</b>\n⚠️ <b>但因 Gross Leverage 超限，加碼行為受限</b>"
        : "";
      return {
        maintenanceLayer: "normal",
        grossLeverageStatus: "ceiling_breach",
        grossLeverage: grossLeverageResult.grossLeverage,
        marketStatus: isPanicBypass ? "🚨【恐慌破冰 + 曝險限縮】" : "⚠️【Gross Leverage 主動上限】",
        target: "🚫 禁止加碼",
        targetSuggestionShort: `綜合曝險 ${grossLeverageResult.grossLeverage.toFixed(2)}x 超額，${isPanicBypass ? "限縮為 0050 現貨" : "一票否決新增槓桿"}`,
        targetSuggestion: grossLeverageResult.message,
        suggestion:
          `• 綜合曝險倍數（Gross Leverage）：${grossLeverageResult.grossLeverage.toFixed(2)}x\n` +
          `• 主動上限：${strategy.grossLeverage.ceiling}x\n` +
          `• ⚠️ 禁止新增質押借款與 00675L 買入\n` +
          `• 允許操作：0050 現貨買入（不增加借款槓桿）` +
          bypassWarning,
        panicBypassActive: isPanicBypass,
      };
    }
  }

  // 移除之前重複添加的 Priority 3 代碼（因為已經移到上面了）

  // ─────────────────────────────────────────────────────────────
  // Priority 3：極端恐慌破冰 (已移至 Priority 2 之前計算)
  // ─────────────────────────────────────────────────────────────


  // ─────────────────────────────────────────────────────────────
  // Priority 4：valuationGuard 估值守衛（latch 觸發/維持/解鎖）
  // 優先序：grossLeverage 之後、entryGate 之前
  // ─────────────────────────────────────────────────────────────
  const vgCfg = strategy?.valuationGuard;

  // ── 趨勢確認（輔助決策與解鎖） ──────────────────
  const trendConfirmation = resolveTrendConfirmation(
    {
      closeArr: ctx.closeArr ?? [],
      ma20Arr: ctx.ma20Arr ?? [],
      atrArr: ctx.atrArr ?? [],
    },
    strategy,
  );

  if (vgCfg?.enabled && ctx.pbRecords != null && !ctx.panicBypassActive) {
    const currentPB = ctx.valuation?.pb ?? null;
    const pbRecords = ctx.pbRecords ?? [];

    // ── 計算當日 PR 分位數與 tier ─────────────────────────────
    const vgResult = resolveValuationGuard(currentPB, pbRecords, strategy);

    // ── latch 狀態機 ─────────────────────────────────────────
    // latchState 由 dailyCheck.mjs 從 valuationGuardState.json 注入（步驟 3-7）
    // 此處僅讀取，不寫入（寫入由 dailyCheck.mjs 在 decision 回傳後處理）
    const latchState = ctx.valuationGuardState ?? {
      latchActive: false,
      latchTriggeredAt: null,
      latchTriggeredPR: null,
    };

    const slopeThreshold =
      vgCfg?.latch?.unlockConditions?.condition3
        ?.trendUnlockMa60SlopeThreshold ?? 0;
    const ma60SlopeOk =
      Number.isFinite(ma60Slope) && ma60Slope > slopeThreshold;

    // MACD 柱狀翻正判斷
    const macdHistogramPositive = (() => {
      const arr = ctx.macdArr;
      if (!Array.isArray(arr) || arr.length === 0) return false;
      const last = arr[arr.length - 1];
      return Number.isFinite(last?.histogram) && last.histogram > 0;
    })();

    // ── latch 解鎖判斷（三條件任一滿足即解鎖） ──────────────
    // 條件 1：PR 已回落至 latch.triggerPrThreshold 以下
    const prBelowThreshold =
      vgCfg?.latch?.unlockConditions?.condition1?.prBelowThreshold ?? 50;
    const unlockCond1 =
      vgResult.currentPR != null && vgResult.currentPR < prBelowThreshold;

    // 條件 2：價格從 ATR 低點回升（站回 ATR 支撐位之上）
    const unlockCond2 = vgCfg?.latch?.unlockConditions?.condition2
      ?.usesPanicDrop
      ? trendConfirmation.priceAboveAtrSupport
      : false;

    // 條件 3：趨勢強勢反轉（MA20 站回 + MACD 柱狀正 + MA60 斜率向上）
    const unlockCond3 =
      trendConfirmation.ma20BreakDays === 0 &&
      macdHistogramPositive &&
      ma60SlopeOk;

    const shouldUnlatch =
      latchState.latchActive && (unlockCond1 || unlockCond2 || unlockCond3);

    // ── latch 觸發判斷（PR ≥ triggerPrThreshold → 強制清算後 latch 鎖定） ──
    const triggerPrThreshold = vgCfg?.latch?.triggerPrThreshold ?? 90;
    const shouldLatch =
      !latchState.latchActive &&
      vgResult.currentPR != null &&
      vgResult.currentPR >= triggerPrThreshold;

    // ── 決定當前 latch 生效狀態 ───────────────────────────────
    const latchNowActive = shouldUnlatch
      ? false
      : shouldLatch
        ? true
        : latchState.latchActive;

    // ── latch 生效：強制清倉路由 ─────────────────────────────
    if (latchNowActive) {
      const postLatchMultiplier = vgCfg?.latch?.postLatchMultiplier ?? 0.3;
      const unlockReasons = [];
      if (!unlockCond1)
        unlockReasons.push(
          `PR ${vgResult.currentPR} ≥ 解鎖門檻 ${prBelowThreshold}（條件 1 未達）`,
        );
      if (!unlockCond2)
        unlockReasons.push(`價格未回升至 ATR 支撐位以上（條件 2 未達）`);
      if (!unlockCond3) {
        const reasons = [];
        if (trendConfirmation.ma20BreakDays > 0)
          reasons.push(`MA20 仍跌破 ${trendConfirmation.ma20BreakDays} 日`);
        if (!macdHistogramPositive) reasons.push("MACD 柱狀未翻正");
        if (!ma60SlopeOk)
          reasons.push(
            `MA60 斜率 ${Number.isFinite(ma60Slope) ? ma60Slope.toFixed(4) : "N/A"} ≤ 門檻 ${slopeThreshold}`,
          );
        unlockReasons.push(
          `趨勢未確認（${reasons.join("、")}）（條件 3 未達）`,
        );
      }

      return {
        maintenanceLayer: "normal",
        valuationGuardStatus: "latch_active",
        valuationGuardResult: vgResult,
        trendConfirmation,
        latchNowActive: true,
        shouldLatch,
        shouldUnlatch: false,
        marketStatus: "🔒【估值守衛：清算鎖定】",
        target: "📉 清倉降槓",
        targetSuggestionShort: `PR${vgResult.currentPR ?? "N/A"} 觸發清算鎖定，槓桿壓縮至 ×${postLatchMultiplier}`,
        targetSuggestion: `估值守衛 latch 生效：PB 歷史分位數 PR${vgResult.currentPR ?? "N/A"} 超過硬鎖門檻 ${triggerPrThreshold}，系統鎖定至解鎖條件達成`,
        suggestion:
          `• PB：${currentPB?.toFixed(2) ?? "N/A"}，PR 分位數：${vgResult.currentPR ?? "N/A"}\\n` +
          `• 硬鎖門檻：PR${triggerPrThreshold}，觸發日：${latchState.latchTriggeredAt ?? "今日"}\\n` +
          `• 槓桿乘數（latch 後）：×${postLatchMultiplier}\\n` +
          `• 解鎖條件未達：\\n  - ${unlockReasons.join("\\n  - ")}\\n` +
          `• ${trendConfirmation.trendLabel}`,
      };
    }

    // ── latch 本日觸發：強制清算（PR ≥ triggerPrThreshold 首次命中） ──
    if (shouldLatch) {
      return {
        maintenanceLayer: "normal",
        valuationGuardStatus: "latch_triggered",
        valuationGuardResult: vgResult,
        trendConfirmation,
        latchNowActive: true,
        shouldLatch: true,
        shouldUnlatch: false,
        marketStatus: "🚨【估值守衛：清算觸發】",
        target: "📉 立即清倉",
        targetSuggestionShort: `PR${vgResult.currentPR} 首次觸發清算，賣出全部 00675L`,
        targetSuggestion: `估值守衛首次觸發：PB PR${vgResult.currentPR} ≥ ${triggerPrThreshold}，立即賣出所有 00675L 並鎖定`,
        suggestion:
          `• PB：${currentPB?.toFixed(2) ?? "N/A"}，PR 分位數：${vgResult.currentPR}\\n` +
          `• 首次觸發硬鎖門檻 PR${triggerPrThreshold}\\n` +
          `• ⚠️ 立即賣出所有 00675L 部位，鎖定直至解鎖條件達成\\n` +
          `• 後續每日繼續確認解鎖三條件進度`,
      };
    }

    // ── 未觸發 latch，但 valuationGuard tier 生效：壓縮槓桿乘數 ──
    if (vgResult.guardActive) {
      // 疊加動量調整 (計畫 C)
      // 從 vixArr 取得前一交易日 VIX，供 highPRZone VIX 急升判斷使用
      const vixArrLocal = ctx.vixArr ?? [];
      const currentVix = ctx.vix ?? null;
      const previousVix =
        vixArrLocal.length >= 2
          ? vixArrLocal[vixArrLocal.length - 2]
          : null;

      const momentumResult = resolveValuationMomentum(
        vgResult.currentPR,
        ctx.pbRecordsObjects,
        strategy,
        { currentVix, previousVix }
      );

      let finalMultiplier = vgResult.multiplier;
      if (momentumResult.momentumAdjustment === "relief") {
        const tiers = strategy.valuationGuard?.tiers ?? [];
        if (vgResult.hitTierIndex < tiers.length - 1) {
          finalMultiplier = tiers[vgResult.hitTierIndex + 1].multiplier;
        } else {
          finalMultiplier = 1.0;
        }
      } else if (typeof momentumResult.momentumAdjustment === "number") {
        finalMultiplier *= momentumResult.momentumAdjustment;
      }

      // 將 multiplier 注入 ctx，供 Priority 7 正常進場路由使用
      ctx.valuationGuardMultiplier = finalMultiplier;
      ctx.valuationGuardResult = vgResult;
      ctx.valuationMomentumResult = momentumResult;
      ctx.trendConfirmation = trendConfirmation;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // ★ Pre-Entry Gate：左側進擊矩陣前置過濾（依跌幅層級限制允許操作）
  // entryGate 在估值泡沫/再平衡/恐慌買入之前執行，確保所有買入路徑均受過濾
  // ─────────────────────────────────────────────────────────────
  const entryGateCfg = strategy.buy?.entryGate;
  const gateResult = resolveEntryGate(
    ctx.priceDropPercent,
    ctx.rsi,
    entryGateCfg,
  );

  if (gateResult.blocked) {
    const tierIndex = gateResult.tierIndex;
    const tier = gateResult.tier;
    const tierLabels = [
      "底倉通道",
      "淺層修正通道",
      "深度回撤通道",
      "極端恐慌通道",
    ];
    const tierEmojis = ["🌱", "🟡", "🟠", "🔴"];
    const tierLabel = tierLabels[tierIndex] ?? `Tier ${tierIndex}`;
    const tierEmoji = tierEmojis[tierIndex] ?? "⚙️";

    const rsiInfo =
      tier.rsiThreshold != null
        ? `RSI 門檻：${tier.rsiThreshold}（當前 ${ctx.rsi.toFixed(0)}）`
        : "RSI 門檻：不適用";

    return {
      maintenanceLayer: "normal",
      entryGateLevel: tierIndex,
      entryGateLabel: tierLabel,
      entryGateBlocked: true,
      marketStatus: `${tierEmoji}【前置過濾：${tierLabel}】`,
      target: "🚧 槓桿封鎖",
      targetSuggestionShort: `${tier.note}（跌幅 ${ctx.priceDropPercent.toFixed(1)}%）`,
      targetSuggestion: `entryGate ${tierLabel}：${tier.note}`,
      suggestion:
        `• 當前跌幅：${ctx.priceDropPercent.toFixed(1)}%（區間 ${tier.minDrop}–${tier.maxDrop === 999 ? "∞" : tier.maxDrop}%）\n` +
        `• ${rsiInfo}\n` +
        `• 封鎖原因：${gateResult.blockReason}\n` +
        `• ⚠️ 本層通道不允許 00675L 加碼（entryGate 前置過濾）\n` +
        `• 允許操作：0050 DCA 照常執行`,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // ★ 核心計分矩陣 (Scoring Matrix) 決策引擎注入
  // ─────────────────────────────────────────────────────────────
  const scoringData = {
    institutionalNet: ctx.institutionalNet || 0,
    institutionalHistory: ctx.institutionalHistory || [],
    sentimentScore: ctx.macroSentiment?.direction === 'BULLISH' ? (ctx.macroSentiment.bonus || 0) : (ctx.macroSentiment?.direction === 'BEARISH' ? -(ctx.macroSentiment.penalty || 0) : 0),
    ma60SlopeHistory: ctx.ma60SlopeHistory || [],
    hasTacticalPosition: ctx.z2Ratio > 15
  };
  
  const scoreResult = generateScoringMatrix(ctx.indicators, ctx.priceDropPercent, strategy, scoringData);
  const { finalScore, signal, scalingRatio, categoryResults } = scoreResult;

  // --- 1.5.A) 預算管控 (Budget Control) ---
  const budgetCfg = strategy.trading?.budget;
  const rollingLoanDays = budgetCfg?.rollingDays || 10;
  const historyLoan10d = await archiveManager.getHistoricalLoan(rollingLoanDays);
  const currentLoan = ctx.portfolio?.totalLoan || 0;
  const effectiveNetAsset = netAsset || ctx.netAsset || 1;
  
  const rollingNetIncrease = Math.max(0, currentLoan - historyLoan10d);
  const dailyCap = effectiveNetAsset * (budgetCfg?.maxDailyLoanIncreasePct || 0.05);
  const rollingCap = effectiveNetAsset * (budgetCfg?.maxRollingLoanIncreasePct || 0.15);
  
  const availableDaily = dailyCap; // 簡化：當日通常只執行一筆
  const availableRolling = Math.max(0, rollingCap - rollingNetIncrease);
  const finalAvailableBudget = Math.min(availableDaily, availableRolling);

  // --- 1.5.B) 動態移動停利 (Trailing Stop) 監控 ---
  const tsCfg = strategy.sell?.trailingStop;
  let trailingActive = false;
  let dynamicAnchor = null;

  if (tsCfg?.enabled && ctx.z2Ratio > 0 && ctx.portfolio?.lastBuyDate) {
    const buyDate = ctx.portfolio.lastBuyDate;
    const highsSince = await archiveManager.getHighsSince(buyDate);
    const currentPrice = ctx.currentPrice;
    
    // 啟動條件 1：獲利 > 10% (基於收盤價簡單推算，完美應記錄買入均價)
    const profitOk = currentPrice > (ctx.portfolio.avgCostZ2 || ctx.basePrice || 9999) * (1 + tsCfg.activationProfitPct);
    
    // 啟動條件 2：連續 2 日站穩 MA20
    const ma20Arr = ctx.indicators?.ma20Arr || [];
    const closeArr = ctx.indicators?.closes || [];
    let ma20Stable = false;
    if (closeArr.length >= 2 && ma20Arr.length >= 2) {
      const c1 = closeArr.at(-1), c2 = closeArr.at(-2);
      const m1 = ma20Arr.at(-1), m2 = ma20Arr.at(-2);
      if (c1 > m1 && c2 > m2) ma20Stable = true;
    }

    if (profitOk || ma20Stable) {
      trailingActive = true;
      if (tsCfg.anchorType === 'ma20') {
        dynamicAnchor = ma20Arr.at(-1) * (1 - tsCfg.stopLossBuffer);
      } else if (tsCfg.anchorType === 'atr') {
        const hhv = Math.max(...highsSince, currentPrice); // 含今日
        const atr = ctx.indicators?.atrArr?.at(-1) || 0;
        dynamicAnchor = hhv - (atr * tsCfg.atrMultiplier);
      }
    }
  }

  // 1.5.C) 停損與絕對優先權 Override (Priority High)
  const stopLossTriggered = trendConfirmation.ma20BreakDays >= (strategy.sell?.ma20StopDays ?? 3);
  const trailingTriggered = trailingActive && dynamicAnchor && ctx.currentPrice < dynamicAnchor;
  
  if ((stopLossTriggered || trailingTriggered) && ctx.z2Ratio > 0) {
    const reason = trailingTriggered ? `動態停引 (錨點: ${dynamicAnchor.toFixed(1)})` : `MA20 跌破 ${trendConfirmation.ma20BreakDays} 日`;
    return {
      maintenanceLayer: "normal",
      marketStatus: "🚨【動態停損/停利：減碼保護】",
      target: "📉 減碼還款",
      targetSuggestionShort: `${reason}，降至 Baseline`,
      targetSuggestion: `觸發受控退場：${reason}，系統強制減持 00675L 至基礎水位`,
      suggestion:
        `• 觸發原因：${reason}\n` +
        `• 執行策略：減碼至 Baseline (單筆 DCA) 水位以保護利潤並降低風險\n` +
        `• 停利錨點：${dynamicAnchor ? dynamicAnchor.toFixed(1) : "N/A"}\n` +
        `• 啟動狀態：${trailingActive ? "已啟動 (Active)" : "建倉陣痛期 (Cushioning)"}`,
      finalScore,
      categoryResults,
      trailingActive,
      dynamicAnchor
    };
  }

  // 1.6) 估值極度昂貴：防泡沫機制 (PB > 2.2)
  const pbValue = valuation?.pb;
  if (pbValue != null && pbValue >= 2.2) {
    return {
      marketStatus: "🫧【估值泡沫】",
      target: "🛑 鎖定風險",
      targetSuggestionShort: `大盤 PB 達 ${pbValue}，停止加碼 00675L 預防劇烈修正`,
      targetSuggestion: `大盤 PB 高達 ${pbValue} 進入泡沫警戒區，強制暫停撥款買入，建議視情況降槓桿`,
      suggestion:
        `• 大盤股價淨值比 (PB)：${pbValue} (極端門檻 2.2)\n` +
        `• 風控說明：歷史數據顯示大盤 PB 超過 2.2 常伴隨毀滅性回檔。即使技術面呈多頭，系統仍強制在此階段停止買進，保護資金安全。`,
    };
  }

  // 2) 再平衡：00675L 佔比過高
  if (z2Ratio > th.z2RatioHigh) {
    const targetZ2Value = netAsset * th.z2TargetRatio;
    const sellAmount = Math.max(0, currentZ2Value - targetZ2Value);

    if (sellAmount > th.minActionableAmount) {
      return {
        marketStatus: "⚖️【再平衡】",
        target: "🔻 降槓桿",
        targetSuggestionShort: "賣出 00675L 還款，恢復目標佔比",
        targetSuggestion: "賣出部分 00675L 並還款，恢復到目標佔比",
        suggestion:
          `• 00675L 當前佔比：${z2Ratio.toFixed(1)}%\n` +
          `• 警戒上限門檻：${th.z2RatioHigh}%\n` +
          `• 目標佔比設定：${(th.z2TargetRatio * 100).toFixed(0)}%\n` +
          `• 建議賣出金額：約 ${sellAmount.toLocaleString("zh-TW", { maximumFractionDigits: 0 })} 元並全數還款`,
      };
    }
  }

  // 3) 評分驅動決策 (Scoring Driven)
  // --- 戰術加碼路徑 ---
  if (signal === "buy_tactical") {
    // 檢查冷卻期
    if (cooldownStatus.inCooldown) {
      return {
        marketStatus: "⏰【加碼冷卻中】",
        target: "⏸️ 等待冷卻",
        suggestion: `評分 ${finalScore.toFixed(1)} 分符合加碼，但處於冷卻期（剩餘 ${cooldownStatus.daysLeft} 天）`,
        finalScore,
        categoryResults
      };
    }

    const scalingText = scalingRatio < 1.0 ? ` (縮放撥款 ${scalingRatio * 100}%)` : "";
    
    // 檢查預算上限
    const suggestedValue = dailyCap * scalingRatio; // 假設預算基礎為單日上限
    const budgetCapped = suggestedValue > finalAvailableBudget;
    const finalAllocRatio = budgetCapped ? (finalAvailableBudget / dailyCap) : scalingRatio;

    return {
      marketStatus: budgetCapped ? "💰【預算受限加碼】" : "🚀【戰術進攻】",
      target: "⚡ 撥款加碼",
      targetSuggestionShort: `評分 ${finalScore.toFixed(1)} 達標，${budgetCapped ? "預算封頂撥款" : "建議撥款"}${scalingText}`,
      targetSuggestion: `分批買入 00675L，${budgetCapped ? "因 10 日滾動預算封頂，今日僅能動用：" + (finalAllocRatio * 100).toFixed(1) + "%" : "今日預算動用率：" + (scalingRatio * 100).toFixed(0) + "%"}`,
      suggestion:
        `• 決策總分：${finalScore.toFixed(1)} 分\n` +
        `• 撥款比例：${(finalAllocRatio * 100).toFixed(1)}% ${budgetCapped ? "(⚠️ 預算上限攔截)" : ""}\n` +
        `• 餘額狀態：可用預算 $${finalAvailableBudget.toLocaleString("zh-TW")} / 滾動上限剩餘 $${availableRolling.toLocaleString("zh-TW")}\n` +
        Object.values(categoryResults).map(c => `  └ ${c.label}：${c.finalScore.toFixed(1)} ${c.isCapped ? "(已封頂)" : ""}`).join("\n"),
      finalScore,
      scalingRatio: finalAllocRatio,
      categoryResults,
      budgetInfo: { availableRolling, finalAvailableBudget, budgetCapped }
    };
  }

  // --- 戰術減倉路徑 ---
  if (signal === "sell_tactical" || signal === "exit_buffer") {
    const reason = signal === "exit_buffer" ? "遲滯緩衝退場" : "評分轉空減倉";
    return {
      marketStatus: "🛡️【主動防禦】",
      target: "🔻 降槓桿",
      targetSuggestionShort: `${reason}（總分 ${finalScore.toFixed(1)}）`,
      targetSuggestion: `評分已跌破門檻，建議賣出 00675L 還款`,
      suggestion: `• 決策總分：${finalScore.toFixed(1)} 分\n• 訊號原因：${reason}\n• 行動：結清戰術加碼部位，降低利息支出並提高維持率`,
      finalScore,
      categoryResults,
      trailingActive,
      dynamicAnchor
    };
  }

  // 4) 市場中性區 (Neutral Zone)：僅執行 0050 DCA
  return {
    marketStatus: "🌱【中性/常態佈局】",
    target: "🔹 0050 DCA",
    targetSuggestionShort: "僅執行 0050 定時定額，暫停 00675L 活動",
    targetSuggestion: "市場處於中性區間（總分 " + finalScore.toFixed(1) + "），僅執行 0050 基礎保底投入",
    suggestion:
      `• 決策總分：${finalScore.toFixed(1)} 分 (中性區 -4 ~ +4)\n` +
      `• 行動建議：維持 0050 基礎加碼，不觸發 00675L 戰術槓桿，節省利息並靜待訊號共振`,
    finalScore,
    categoryResults,
    trailingActive,
    dynamicAnchor
  };
}

function buildSellBackToAllocation(ctx, strategy) {
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

/**
 * 檢查是否在 Cooldown 期間 (以「交易日」計算)
 * @param {Date|string} lastBuyDate - 最後買入日期
 * @param {number} cooldownTradingDays - 冷卻「交易日」天數
 * @returns {Promise<Object>} { inCooldown, daysLeft, lastBuyDate, message }
 */
async function checkCooldown(lastBuyDate, cooldownTradingDays) {
  if (!lastBuyDate) {
    return {
      inCooldown: false,
      daysLeft: 0,
      lastBuyDate: null,
      message: "無歷史買入記錄",
    };
  }

  const today = new Date();
  const lastBuy = new Date(lastBuyDate);

  today.setHours(0, 0, 0, 0);
  lastBuy.setHours(0, 0, 0, 0);

  const startYear = lastBuy.getFullYear();
  const endYear = today.getFullYear();

  const holidays = new Set();

  try {
    for (let y = startYear; y <= endYear; y++) {
      const yearHolidays = await loadHolidaySet(y);
      yearHolidays.forEach((dateStr) => holidays.add(dateStr));
    }
  } catch (e) {
    console.warn("⚠️ 無法取得 TWSE 假日，將退回使用六日計算交易日:", e.message);
  }

  let tradingDaysPassed = 0;
  let currentDate = new Date(lastBuy);
  currentDate.setDate(currentDate.getDate() + 1);

  while (currentDate <= today) {
    const dayOfWeek = currentDate.getDay();
    const isoDate = currentDate.toISOString().split("T")[0];
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidays.has(isoDate);

    if (!isWeekend && !isHoliday) {
      tradingDaysPassed++;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  const daysLeft = Math.max(0, cooldownTradingDays - tradingDaysPassed);
  const lastBuyStr = lastBuy.toISOString().split("T")[0];

  return {
    inCooldown: daysLeft > 0,
    daysLeft,
    lastBuyDate: lastBuyStr,
    tradingDaysPassed,
    message:
      daysLeft > 0
        ? `最後買入：${lastBuyStr}，經過 ${tradingDaysPassed} 交易日`
        : `已過 ${tradingDaysPassed} 個交易日`,
  };
}

/**
 * 從 strategy.macroSentiment config 與外部傳入的 market_direction
 * 組裝成 computeEntryScore 所需的 macroSentiment 物件。
 * 若功能未啟用或無方向資料，回傳 null。
 *
 * 節四整合：若 vixOverride.overrideActive === true，
 * bearishPenalty 強制設為 0（短路屏蔽），並在回傳物件中標記短路狀態。
 *
 * @param {string|null} marketDirection - 'BULLISH' | 'BEARISH' | 'NEUTRAL' | null
 * @param {Object} strategy - 完整策略設定
 * @param {{ overrideActive: boolean, overrideReason: string }} vixOverride - VIX 短路狀態
 * @returns {Object|null}
 */
function buildMacroSentiment(marketDirection, strategy, vixOverride) {
  const cfg = strategy?.macroSentiment;
  if (!cfg?.enabled || !marketDirection) return null;

  const isOverrideActive = vixOverride?.overrideActive === true;

  // bearishPenalty：短路啟動時強制為 0，正常時從 config 讀取
  const effectivePenalty = isOverrideActive ? 0 : (cfg.bearishPenalty ?? 0);

  return {
    direction: marketDirection,
    bonus: cfg.bullishBonus ?? 0,
    penalty: effectivePenalty,
    // 短路標記：供 Telegram 模板（節五）識別並顯示 ⚡ VIX 情緒短路 提示
    vixOverrideActive: isOverrideActive,
    vixOverrideReason: isOverrideActive
      ? (vixOverride.overrideReason ?? "")
      : "",
  };
}

export async function evaluateInvestmentSignal(data, strategy) {
  const priceChangePercent =
    ((data.currentPrice - data.basePrice) / data.basePrice) * 100;
  const priceUpPercent = Math.max(0, priceChangePercent);
  const priceDropPercent = Math.max(0, -priceChangePercent);

  const current0050Value = data.portfolio.qty0050 * data.price0050;
  const currentZ2Value = data.portfolio.qtyZ2 * data.currentPrice;

  // ── 使用 marginManager 計算維持率與壓力測試 (排除 00675L) ───────
  const marginAnalysis = analyzeMarginRisk(
    data.portfolio,
    data.price0050,
    strategy,
  );
  const maintenanceMargin = marginAnalysis.currentMargin;

  // ── 資金解耦分析 ──────────────────────────────────────────────
  const decouplingAnalysis = analyzeCapitalDecoupling(data.portfolio, {
    price0050: data.price0050,
    priceZ2: data.currentPrice,
  });

  const netAsset =
    current0050Value +
    currentZ2Value +
    data.portfolio.cash -
    data.portfolio.totalLoan;
  const z2Ratio = netAsset > 0 ? (currentZ2Value / netAsset) * 100 : 0;

  const ma240 =
    Number.isFinite(data.ma240) && data.ma240 > 0 ? data.ma240 : null;
  const bias240 = ma240 ? ((data.currentPrice - ma240) / ma240) * 100 : null;

  const grossAsset = current0050Value + currentZ2Value + data.portfolio.cash;
  const actualLeverage = netAsset > 0 ? grossAsset / netAsset : 0;

  let historicalLevel = "⚖️【中位階】";
  if (bias240 > 25) historicalLevel = "🔥【極高位階/過熱】";
  else if (bias240 > 15) historicalLevel = "🏜️【高位階/偏貴】";
  else if (bias240 < 0) historicalLevel = "🧊【低位階/便宜】";

  const baseCooldownDays = strategy.trading.cooldownDays || 20;
  const cfg = strategy?.macroSentiment;

  // ─── VIX 情緒短路：先解析短路狀態，再傳入 buildMacroSentiment ───
  // resolveVixOverride 使用 data.vixArr（歷史序列）判斷趨勢；
  // 若 data.vixArr 不存在，fallback 為 [data.VIX]，趨勢判斷降為 'flat'
  const vixArr =
    Array.isArray(data.vixArr) && data.vixArr.length > 0
      ? data.vixArr
      : Number.isFinite(data.VIX)
        ? [data.VIX]
        : [];
  const vixOverride = resolveVixOverride(data.VIX, vixArr, strategy);

  // macroSentiment：傳入 vixOverride，由 buildMacroSentiment 決定是否屏蔽 bearishPenalty
  const macroSentiment = buildMacroSentiment(
    data.macroMarketDirection ?? null,
    strategy,
    vixOverride,
  );

  // effectiveCooldownDays：短路啟動時跳過 bearishCooldownMultiplier 延長
  const isBearish = cfg?.enabled && data.macroMarketDirection === "BEARISH";
  const effectiveCooldownDays =
    isBearish &&
    !vixOverride.overrideActive &&
    Number.isFinite(cfg.bearishCooldownMultiplier)
      ? Math.round(baseCooldownDays * cfg.bearishCooldownMultiplier)
      : baseCooldownDays;

  const lastBuyDate = data.portfolio?.lastBuyDate ?? null;
  const cooldownStatus = await checkCooldown(
    lastBuyDate,
    effectiveCooldownDays,
  );

  if (effectiveCooldownDays !== baseCooldownDays) {
    cooldownStatus.message += ` (⚠️ 空頭情緒延長冷卻至 ${effectiveCooldownDays} 交易日)`;
  }

  const ctx = {
    priceChangePercent,
    priceUpPercent,
    priceDropPercent,

    maintenanceMargin,
    z2Ratio,
    netAsset,
    currentZ2Value,
    vix: data.VIX,
    rsi: data.RSI,

    reserveCash: data.portfolio?.cash || 0,

    cooldownStatus,

    entry: computeEntryScore(data, priceDropPercent, strategy, macroSentiment),
    overheat: computeOverheatState(data, bias240, strategy),
    reversal: computeReversalTriggers(data, strategy),
    sellSignals: computeSellSignals(data, strategy),
    valuation: data.rawValuation || null,
    // ── valuationGuard 所需欄位 ──────────────────────────────
    pbRecords: data.pbRecords ?? [],
    pbRecordsObjects: data.pbRecordsObjects ?? [],
    valuationGuardState: data.valuationGuardState ?? null,
    closeArr: data.closeArr ?? [],
    ma20Arr: data.ma20Arr ?? [],
    atrArr: data.atrArr ?? [],
    macdArr: data.macdArr ?? [],
    // ── valuationMomentum 所需欄位 ───────────────────────────
    vixArr: vixArr,
    ma60SlopeHistory: data.ma60SlopeArr || [],
    institutionalNet: data.institutionalNet || 0,
    institutionalHistory: data.institutionalHistory || [],
    // ── 壓力測試與解耦數據 ──────────────────────────────────
    marginAnalysis,
    decouplingAnalysis,
    // ── 指標序列供計分矩陣使用 ───────────────────────────────
    indicators: {
      rsiArr: data.rsiArr || [],
      kdArr: data.kdArr || [],
      macdArr: data.macdArr || []
    }
  };

  // ── Gross Leverage 計算 ──────────────────────────────────────
  const etf0050Value = data.portfolio.qty0050 * data.price0050;
  const etf675LValue = data.portfolio.qtyZ2 * data.currentPrice;
  const glConfig = strategy.grossLeverage;
  const grossLeverageResult = glConfig
    ? computeGrossLeverage(
        { etf0050Value, etf675LValue, netAssetValue: netAsset },
        glConfig,
      )
    : null;
  // ─────────────────────────────────────────────────────────────
  const ma60Slope =
    Array.isArray(data.ma60SlopeArr) && data.ma60SlopeArr.length > 0
      ? data.ma60SlopeArr[data.ma60SlopeArr.length - 1]
      : null;

  const decision = await buildDecision(ctx, strategy, grossLeverageResult, ma60Slope);
  const macdSignal = getMACDSignal(data.macdArr);

  return {
    currentPrice: data.currentPrice,
    basePrice: data.basePrice,
    totalLoan: data.portfolio.totalLoan,
    actualLeverage,
    historicalLevel,
    netAsset: ctx.netAsset,
    bias240: bias240,
    priceChangePercent,
    priceChangePercentText: priceChangePercent.toFixed(2),
    priceUpPercent: priceUpPercent,
    priceUpPercentText: priceUpPercent.toFixed(2),
    priceDropPercent: priceDropPercent,
    priceDropPercentText: priceDropPercent.toFixed(2),
    RSI: data.RSI,
    KD_K: Number.isFinite(data.KD_K) ? data.KD_K : null,
    KD_D: Number.isFinite(data.KD_D) ? data.KD_D : null,
    overheat: ctx.overheat,
    reversal: ctx.reversal,
    weightScore: ctx.entry.weightScore,
    weightDetails: ctx.entry.weightDetails,
    sellSignals: ctx.sellSignals,
    macdSignal,
    maintenanceMargin,
    z2Ratio,
    strategy,
    macroSentiment,
    effectiveCooldownDays,
    vixOverride,
    ...decision,
    grossLeverage: grossLeverageResult?.grossLeverage ?? null,
    grossLeverageStatus: grossLeverageResult?.status ?? "normal",
    entryGateLevel: decision.entryGateLevel ?? null,
    entryGateLabel: decision.entryGateLabel ?? null,
    entryGateBlocked: decision.entryGateBlocked ?? false,
    cooldownStatus,
    marginAnalysis,
    decouplingAnalysis,
  };
}

export async function getInvestmentSignalAsync(data) {
  const strategy = await fetchStrategyConfig();
  validateStrategyConfig(strategy);
  return await evaluateInvestmentSignal(data, strategy);
}
