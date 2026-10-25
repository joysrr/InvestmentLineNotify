import { escapeHTML, TwDate } from "../../../utils/coreUtils.mjs";
import { formatRegimeStatus } from "../../strategy/regimePolicy.mjs";

// ── 常數 ─────────────────────────────────────────────────
const GOAL_ASSET = 74_800_000;
const GOAL_YEARS = 33;
const SEP = "\n─────────────────\n";

// ── 輔助函式 ───────────────────────────────────────────────

/** 緊湊型點陣進度条 */
function goalBar(current, target, width = 20) {
  const c = Number(current),
    t = Number(target);
  if (!Number.isFinite(c) || !Number.isFinite(t) || t <= 0) {
    return "░".repeat(width);
  }
  const filled = Math.max(1, Math.round(Math.min(1, c / t) * width));
  return "█".repeat(filled) + "░".repeat(width - filled);
}

/** 預算進度條 */
function _budgetBar(used, total, width = 10) {
  const ratio = Math.min(1, Math.max(0, used / total));
  const filled = Math.round(ratio * width);
  const icon = ratio >= 0.9 ? "🔴" : ratio >= 0.7 ? "🟡" : "🟢";
  return `${icon} [${"■".repeat(filled)}${"□".repeat(width - filled)}] ${(ratio * 100).toFixed(0)}%`;
}

/**
 * 維持率標籤（4 層狀態機同步版本）
 * 對應 strategyEngine.mjs 的 getMarginLayer() 邏輯：
 *   🔴 critical  < 135%
 *   🟠 frozen    135–145%
 *   🟡 protect   145–160%
 *   🟢 normal    >= 160%
 */
function mmTag(mm, hasLoan) {
  if (!hasLoan || !Number.isFinite(mm)) return { icon: "▫️", label: "未借款" };
  if (mm >= 160) return { icon: "✅", label: "健康" };
  if (mm >= 145) return { icon: "🟡", label: "預備金防禦" };
  if (mm >= 135) return { icon: "🟠", label: "高危凍結" };
  return { icon: "🔴", label: "斷頭危機" };
}

/** 槓桿標籤（降低圓點飽和度，改用更專業的符號） */
function levTag(lev, targetMulti) {
  const v = Number(lev);
  if (!Number.isFinite(v) || v <= 0) return { icon: "▫️", label: "--" };
  if (v > targetMulti) return { icon: "⚠️", label: "超標" };
  if (v === targetMulti) return { icon: "⚖️", label: "滿載" };
  if (v < 1.2) return { icon: "🔹", label: "保守" };
  return { icon: "🔸", label: "適中" };
}

/** 觸發比例 icon */
function signalIcon(triggered, total) {
  const ratio = triggered / total;
  if (ratio === 0) return "▫️";
  if (ratio <= 0.33) return "🔸";
  if (ratio <= 0.66) return "⚠️";
  return "🔥";
}

/** PE 位階判定 */
function peStatus(pe) {
  if (pe == null) return { label: "N/A", emoji: "⬜" };
  if (pe < 12) return { label: "極度低估", emoji: "🧨" };
  if (pe < 15) return { label: "低估", emoji: "❄️" };
  if (pe < 20) return { label: "合理", emoji: "⚖️" };
  if (pe < 25) return { label: "偏高", emoji: "🔸" };
  return { label: "高估", emoji: "🔥" };
}

/** PB 位階判定 */
function pbStatus(pb) {
  if (pb == null) return { label: "N/A", emoji: "⬜" };
  if (pb < 1.5) return { label: "極度低估", emoji: "🧨" };
  if (pb < 2.0) return { label: "低估", emoji: "❄️" };
  if (pb < 3.0) return { label: "合理", emoji: "⚖️" };
  if (pb < 4.0) return { label: "偏高", emoji: "🔸" };
  return { label: "高估", emoji: "🔥" };
}

/** 格式化估值日期 (YYYYMMDD → MM/DD) */
function fmtValDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return "";
  return `${dateStr.slice(4, 6)}/${dateStr.slice(6, 8)}`;
}

/** 進場評分列 (有分數給星星，沒分數留白) */
function _scoreRow(label, score, info) {
  const isScored = Number.isFinite(score) && score > 0;
  const icon = isScored ? "⭐" : "➖";
  const scoreStr = Number.isFinite(score) ? `${score}pt` : "--";

  if (isScored) {
    return `${icon} <b>${label}</b>  <code>${scoreStr}</code>  <i>${escapeHTML(info || "─")}</i>`;
  } else {
    return `${icon} <i>${label}  <code>${scoreStr}</code>  ${escapeHTML(info || "─")}</i>`;
  }
}

/** 訊號列（轉弱/賣出） (觸發用閃電/鈴聲，未觸發用點) */
function signalRow({ name, value, condition, triggered }) {
  const icon = triggered ? "⚡" : "▫️";

  if (triggered) {
    return `${icon} <b>${name}</b>  <code>${String(value ?? "--")}</code>  <i>${escapeHTML(condition || "")}</i>`;
  } else {
    return `${icon} <i>${name}  <code>${String(value ?? "--")}</code>  ${escapeHTML(condition || "")}</i>`;
  }
}

/**
 * entryGate 通道標示列
 * @param {Object} result - evaluateInvestmentSignal 回傳結果
 * @returns {string} 格式化後的單行標示，或空字串（不顯示時）
 */
function entryGateTag(result) {
  const level = result.entryGateLevel;
  const label = result.entryGateLabel;
  const blocked = result.entryGateBlocked;

  // entryGate 未啟用或無資料時不顯示
  if (level == null || level < 0) return "";

  const tierEmojis = ["🌱", "🟡", "🟠", "🔴"];
  const emoji = tierEmojis[level] ?? "⚙️";

  if (blocked) {
    return `\n🚪 進場通道：${emoji} <b>Tier ${level} — ${escapeHTML(label ?? "")}（封鎖中）</b>`;
  }
  return `\n🚪 進場通道：${emoji} <b>Tier ${level} — ${escapeHTML(label ?? "")}</b>`;
}

/**
 * VIX 情緒短路標示列
 *
 * 當 result.macroSentiment.vixOverrideActive === true 時，
 * 輸出一行 ⚡ 提示，說明 AI BEARISH 懲罰已被覆蓋。
 * 舊資料相容：vixOverrideActive 不存在時回傳空字串，不噴錯。
 *
 * @param {Object} result - evaluateInvestmentSignal 回傳結果
 * @returns {string} 格式化後的單行標示，或空字串
 */
function vixOverrideTag(result) {
  const macro = result?.macroSentiment;
  if (!macro?.vixOverrideActive) return "";
  const reason = escapeHTML(macro.vixOverrideReason ?? "");
  return `\n⚡ <b>VIX 情緒短路</b> — AI BEARISH 已覆蓋（${reason}），扣分與冷卻抑制已解除`;
}

/**
 * 評分內閣明細表
 * @param {Object} result - evaluateInvestmentSignal 回傳結果
 * @returns {string} 格式化後的明細
 */
function scoringCabinetTable(result) {
  const cats = result.categoryResults;
  if (!cats) return "";

  const rows = Object.values(cats).map((c) => {
    const icon = c.finalScore > 0 ? "➕" : c.finalScore < 0 ? "➖" : "▫️";
    const capStatus = c.isCapped ? " (已封頂)" : "";
    return `${icon} <b>${c.label}</b>  <code>${c.finalScore.toFixed(1)}pt</code>  <i>${capStatus}</i>`;
  });

  let scalingText = "";
  if (result.scalingRatio && result.scalingRatio < 1.0) {
    scalingText = `\n<blockquote>⚖️ <b>部位縮放：${result.scalingRatio * 100}% 撥款</b></blockquote>`;
  }

  return rows.join("\n") + scalingText;
}

/**
 * Gross Leverage 綜合曝險倍數標示列
 *
 * status 對應三種顯示層級：
 *   hardcap_breach → 🚨 危機紅線（強顯示）
 *   ceiling_breach → ⚠️ 主動上限（警示顯示）
 *   normal         → 🟢 正常（靜默略過，不輸出）
 *   null / 無資料  → 不輸出
 *
 * @param {Object} result - evaluateInvestmentSignal 回傳結果
 * @returns {string} 格式化後的單行標示，或空字串
 */
function grossLeverageTag(result) {
  const gl = result?.grossLeverage;
  const status = result?.grossLeverageStatus;

  if (!Number.isFinite(gl) || !status || status === "normal") return "";

  const glStr = gl.toFixed(2);

  if (status === "hardcap_breach") {
    return `\n🚨 <b>Gross Leverage 危機紅線</b>：<code>${glStr}x</code> — 超越強制砍倉上限`;
  }

  if (status === "ceiling_breach") {
    return `\n⚠️ <b>Gross Leverage 主動上限</b>：<code>${glStr}x</code> — 禁止新增槓桿`;
  }

  return "";
}

/**
 * valuationGuard 估值守衛標示列
 *
 * 顯示規則：
 *   latch_triggered → 🚨 強顯示（首次觸發清算）
 *   latch_active    → 🔒 強顯示（持續鎖定中，附解鎖未達原因）
 *   guardActive     → 📊 中度顯示（tier 壓縮生效，顯示 PR 分位數與乘數）
 *   未觸發           → 靜默略過，回傳空字串
 *
 * @param {Object} result - evaluateInvestmentSignal 回傳結果
 * @returns {string} 格式化後的標示列，或空字串
 */
function valuationGuardTag(result) {
  const status = result?.valuationGuardStatus;
  const vgResult = result?.valuationGuardResult;
  const vmResult = result?.valuationMomentumResult;

  // latch 首次觸發
  if (status === "latch_triggered") {
    const pr = vgResult?.currentPR ?? "N/A";
    return `\n🚨 <b>估值守衛：清算觸發</b> — PB PR<code>${pr}</code> 超過硬鎖門檻，立即清倉 00675L`;
  }

  // latch 持續鎖定
  if (status === "latch_active") {
    const pr = vgResult?.currentPR ?? "N/A";
    const triggeredAt = result?.latchState?.latchTriggeredAt ?? null;
    const dateHint = triggeredAt ? `（觸發日 ${escapeHTML(triggeredAt)}）` : "";
    return `\n🔒 <b>估值守衛：清算鎖定中</b> — PB PR<code>${pr}</code> ${dateHint}，解鎖條件未達`;
  }

  // tier 壓縮生效（未觸發 latch）
  if (vgResult?.guardActive) {
    const pr = vgResult.currentPR ?? "N/A";
    const multiplier =
      result.valuationGuardMultiplier ?? vgResult.multiplier ?? 1.0;
    const tierLabel = escapeHTML(
      vgResult.hitTier?.label ?? `PR${vgResult.hitTier?.prThreshold ?? ""}`,
    );
    let str = `\n📊 <b>估值守衛</b>：PB PR<code>${pr}</code> — ${tierLabel}（槓桿壓縮 ×<code>${multiplier}</code>）`;
    if (vmResult?.momentumLabel) {
      str += `\n   ${escapeHTML(vmResult.momentumLabel)}`;
    }
    return str;
  }

  return "";
}

/**
 * 當前生效優先層標示（Priority 層級徽章）
 *
 * 將 result.maintenanceLayer / grossLeverageStatus / valuationGuardStatus
 * 組合為單行「生效層」說明，供訊息頂部快速識別系統當前路由層級。
 * 常態運行（normal + 無特殊狀態）時靜默略過。
 *
 * @param {Object} result - evaluateInvestmentSignal 回傳結果
 * @returns {string} 格式化後的單行標示，或空字串
 */
function activePriorityTag(result) {
  const layer = result?.maintenanceLayer;
  const glStatus = result?.grossLeverageStatus;
  const vgStatus = result?.valuationGuardStatus;

  // Priority 1：維持率危機層
  if (layer === "critical")
    return `\n🏷 <b>生效層：Priority 1</b> — 維持率斷頭危機`;
  if (layer === "frozen")
    return `\n🏷 <b>生效層：Priority 1</b> — 維持率高危凍結`;
  if (layer === "protect")
    return `\n🏷 <b>生效層：Priority 1</b> — 維持率預備金防禦`;

  // Priority 2：Gross Leverage
  if (glStatus === "hardcap_breach")
    return `\n🏷 <b>生效層：Priority 2</b> — Gross Leverage 危機紅線`;
  if (glStatus === "ceiling_breach")
    return `\n🏷 <b>生效層：Priority 2</b> — Gross Leverage 主動上限`;

  // Priority 3：Extremely Panic Bypass
  if (result?.panicBypassActive)
    return `\n🏷 <b>生效層：Priority 3</b> — 極端恐慌破冰 (Bypass)`;

  // Priority 4：valuationGuard
  if (vgStatus === "latch_triggered")
    return `\n🏷 <b>生效層：Priority 4</b> — 估值守衛清算觸發`;
  if (vgStatus === "latch_active")
    return `\n🏷 <b>生效層：Priority 4</b> — 估值守衛清算鎖定`;
  if (result?.valuationGuardResult?.guardActive)
    return `\n🏷 <b>生效層：Priority 4</b> — 估值守衛 tier 壓縮`;

  // 常態運行：靜默
  return "";
}

/**
 * Trailing Stop 移動停利標籤
 * @param {Object} result
 * @returns {string}
 */
function trailingStopTag(result) {
  const active = result.trailingActive;
  const anchor = result.dynamicAnchor;
  if (anchor == null) {
    return `\n🛡 <b>核心守備</b>：⏳ 建倉陣痛期 (獲利門檻未達)`;
  }
  const statusText = active ? "🔒 監控中 (Active)" : "⏳ 緩衝中";
  return `\n🛡 <b>核心守備</b>：<b>${statusText}</b> — 停利防線 <code>${anchor.toFixed(1)}</code>`;
}

/**
 * 預算管控標籤
 * @param {Object} result
 * @returns {string}
 */
function budgetControlTag(result) {
  const b = result.budgetInfo;
  if (!b) return "";
  const capped = b.budgetCapped ? "🚨 <b>預算封頂</b>" : "✅ <b>額度充足</b>";
  return `\n💰 <b>資金預算</b>：${capped} (剩餘 <code>$${Math.floor(b.availableRolling).toLocaleString("zh-TW")}</code>)`;
}

/**
 * Conversion Guard 轉化標籤
 * @param {Object} result
 * @returns {string}
 */
function conversionGuardTag(result) {
  const cg = result?.conversionData;
  if (!cg) return "";
  return `\n🔄 <b>獲利轉化</b>：賣出 00675L <code>$${cg.convertAmount.toLocaleString()}</code> → 還款 <code>$${cg.repayAmount.toLocaleString()}</code> / 買 0050 <code>$${cg.buy0050Amount.toLocaleString()}</code>`;
}

/**
 * 壓力測試簡易表格
 * @param {Object} result - evaluateInvestmentSignal 回傳結果
 * @returns {string} 格式化後的表格 HTML
 */
function stressTestTable(result) {
  const analysis = result.marginAnalysis;
  const survival = result.survivalAnalysis; // [NEW]
  if (!analysis || !analysis.stressTests || analysis.totalLoan <= 0) return "";

  const rows = analysis.stressTests
    .map((t) => {
      return `<code>-${t.drop}% 跌至 ${t.price} → 維持率 ${t.margin}% ${t.status}</code>`;
    })
    .join("\n");

  const safety =
    survival?.survivalDropLimit ?? analysis.riskAssessment.survivalDropLimit;
  const refill =
    survival?.refillRequirement ?? analysis.riskAssessment.refillRequirement;
  const limitDownMargin =
    survival?.nextDayLimitDownMargin ?? analysis.stressTests[0]?.margin;

  const safetyStr = safety !== null ? `${safety.toFixed(1)}%` : "N/A";
  const refillStr =
    refill > 0
      ? `需求注入額：$${refill.toLocaleString("en-US")}`
      : "✅ 現金充足";

  // 根據安全邊際給予顏色建議
  let safetyIcon = "🟢";
  if (safety < 10) safetyIcon = "🔴";
  else if (safety < 20) safetyIcon = "🟠";
  else if (safety < 30) safetyIcon = "🟡";

  return (
    `\n\n🛡 <b>0050 質押風險與生存邊際</b>${SEP}${rows}\n` +
    `${safetyIcon} <b>生存邊際 (至 135%)：<code>${safetyStr}</code></b>\n` +
    `📊 隔日跌停預估維持率：<code>${limitDownMargin}%</code>\n` +
    `📍 補足線建議 (160%)：<code>${refillStr}</code>`
  );
}

/**
 * 資金解耦與比例分析
 * @param {Object} result
 * @returns {string}
 */
function decouplingRow(result) {
  const dec = result.decouplingAnalysis;
  if (!dec) return "";
  return (
    `\n⚖️ <b>資金解耦分析</b>${SEP}` +
    `🛡 基礎資產 (0050-Loan)：<tg-spoiler>${dec.baseRatio}%</tg-spoiler>\n` +
    `⚔️ 戰術槓桿 (00675L)：<tg-spoiler>${dec.tacticRatio}%</tg-spoiler>`
  );
}

// ── 主程式：完整版訊息（原不動） ───────────────────────────────

export function buildTelegramMessages({
  result,
  vixData,
  usRisk,
  macroData,
  macroAnalysis,
  config,
  dateText: _dateText,
  aiAdvice,
  quote,
}) {
  const strategy = result.strategy || {};
  const th = strategy.threshold || {};
  const buyTh = strategy.buy || {};
  const sellTh = strategy.sell || {};
  const s = result.sellSignals ?? { flags: {} };
  const r = result.reversal ?? {};
  const w = result.weightDetails ?? {};

  // ── 資產數值 ──
  const currentAsset = Number(result.netAsset || 0);
  const totalLoan = Number(result.totalLoan || 0);
  const grossAsset = currentAsset + totalLoan;
  const mm = Number(result.maintenanceMargin);
  const hasLoan = totalLoan > 0;
  const mmInfo = mmTag(mm, hasLoan);

  // ── 槓桿 ──
  const levValue = Number(result.actualLeverage);
  const targetMulti = Number.isFinite(strategy.leverage?.targetMultiplier)
    ? strategy.leverage.targetMultiplier
    : 1.8;
  const levInfo = levTag(levValue, targetMulti);

  // ── 00675L 佔比 ──
  const z2Ratio = Number(result.z2Ratio);
  const z2TargetPct = Number.isFinite(th.z2TargetRatio)
    ? th.z2TargetRatio * 100
    : 40;
  const z2Safe = z2Ratio <= z2TargetPct;

  // ── VIX ──
  const vixValue = vixData?.value != null ? Number(vixData.value) : NaN;
  const vixLow = Number.isFinite(th.vixLowComplacency)
    ? th.vixLowComplacency
    : 13.5;
  const vixHigh = Number.isFinite(th.vixHighFear) ? th.vixHighFear : 20;
  let vixLabel = "正常 ⚖️";
  if (Number.isFinite(vixValue)) {
    if (vixValue < vixLow) vixLabel = "過度安逸 ❄️";
    else if (vixValue > vixHigh) vixLabel = "恐慌 🔥";
  }

  // ── 進場評分 ──
  const score = Number(result.weightScore);
  const minScore = Number(buyTh.minWeightScoreToBuy ?? NaN);
  const scoreOk =
    Number.isFinite(score) && Number.isFinite(minScore) && score >= minScore;

  const _dropScore = Number.isFinite(w.dropScore) ? w.dropScore : 0;
  const _rsiScore = Number.isFinite(w.rsiScore) ? w.rsiScore : 0;
  const _macdScore = Number.isFinite(w.macdScore) ? w.macdScore : 0;
  const _kdScore = Number.isFinite(w.kdScore) ? w.kdScore : 0;

  // ── 技術指標 ──
  const rsi = Number(result.RSI);
  const kd_d = Number(result.KD_D);
  const kd_k = Number(result.KD_K);
  const kdCons = Math.min(kd_k, kd_d);
  const bias = Number(result.bias240);
  const rsiAlert =
    Number.isFinite(rsi) && rsi > Number(th.rsiOverheatLevel ?? 80);
  const dAlert =
    Number.isFinite(kd_d) && kd_d > Number(th.dOverheatLevel ?? 90);
  const biasAlert =
    Number.isFinite(bias) && bias > Number(th.bias240OverheatLevel ?? 25);

  // ── S&P 500 ──
  let spxText = escapeHTML(usRisk?.spxChg || "N/A");
  let spxEmoji = "";
  if (spxText !== "N/A") {
    const n = parseFloat(spxText);
    if (n > 0) {
      spxText = `+${spxText}`;
      spxEmoji = "📈";
    } else if (n < 0) {
      spxEmoji = "📉";
    } else {
      spxEmoji = "➖";
    }
  }

  // ── 總經與籌碼 (Macro & Chip) ──
  const cnnScore = macroData?.rawCnn?.score;
  const cnnRating = macroData?.rawCnn?.rating || "未知";
  let cnnEmoji = "⚖️";
  if (cnnScore <= 25) cnnEmoji = "❄️";
  else if (cnnScore >= 75) cnnEmoji = "🔥";
  const cnnText = Number.isFinite(cnnScore)
    ? `${cnnScore}pt ${cnnEmoji} ${cnnRating}`
    : "N/A";

  const mmMargin = macroData?.rawMargin?.maintenanceRatio;
  const mmMarginChange = macroData?.rawMargin?.marginBalanceChange100M;
  const mmMarginDate = macroData?.rawMargin?.date;
  let marginEmoji = "✅";
  if (mmMargin < 145) marginEmoji = "🚨";
  else if (mmMargin < 155) marginEmoji = "⚠️";
  const marginText = Number.isFinite(mmMargin)
    ? `${mmMargin.toFixed(1)}% ${marginEmoji} ${mmMarginChange > 0 ? "↑" : "↓"} ${Math.abs(mmMarginChange).toFixed(1)} 億 ${mmMarginDate ? "(" + mmMarginDate + ")" : ""}`
    : "N/A";

  const fxRate =
    macroData?.rawFx?.currentRate || macroData?.rawFx?.exchangeRate;
  const fxChange = macroData?.rawFx?.changePercent;
  let fxEmoji = "➖";
  let fxTrend = "";
  if (Number.isFinite(fxChange)) {
    if (fxChange > 0.1) {
      fxEmoji = "📉";
      fxTrend = "台幣貶值";
    } else if (fxChange < -0.1) {
      fxEmoji = "📈";
      fxTrend = "台幣升值";
    }
  }
  const fxText = Number.isFinite(fxRate)
    ? `${fxRate.toFixed(2)} ${fxEmoji} ${fxTrend}`
    : "N/A";

  const ndcDate = macroData?.rawNdc?.date || "";
  const ndcScore = macroData?.rawNdc?.score;
  const ndcLight = macroData?.rawNdc?.light || "未知";
  const ndcColor = macroData?.rawNdc?.lightColor;
  const lightEmojiMap = {
    red: "🔥",
    "yellow-red": "🏜️",
    green: "🌿",
    "yellow-blue": "❄️",
    blue: "🧨",
  };
  const ndcEmoji = lightEmojiMap[ndcColor] || "⬜";
  const ndcText = Number.isFinite(ndcScore)
    ? `${ndcScore}pt ${ndcEmoji} ${ndcLight.split(" ")[0]}${ndcDate ? " (" + ndcDate + ")" : ""}`
    : "N/A";

  const rawVal = macroData?.rawValuation;
  const peVal = rawVal?.pe ?? null;
  const pbVal = rawVal?.pb ?? null;
  const valDateStr = fmtValDate(rawVal?.date);
  const peInfo = peStatus(peVal);
  const pbInfo = pbStatus(pbVal);
  const peText =
    peVal != null
      ? `${peVal} ${peInfo.emoji} ${peInfo.label}${valDateStr ? " (" + valDateStr + ")" : ""}`
      : "N/A";
  const pbText =
    pbVal != null
      ? `${pbVal} ${pbInfo.emoji} ${pbInfo.label}${valDateStr ? " (" + valDateStr + ")" : ""}`
      : "N/A";

  const priceChangePct = Number(result.priceChangePercent || 0);
  const changeIcon =
    priceChangePct > 0 ? "📈" : priceChangePct < 0 ? "📉" : "➖";

  const qty0050Str = Number(config.qty0050).toLocaleString("en-US");
  const qtyZ2Str = Number(config.qtyZ2).toLocaleString("en-US");
  const cashReserveStr = Number(config.cash || 0).toLocaleString("en-US");

  const goalPct = ((currentAsset / GOAL_ASSET) * 100).toFixed(2);

  const reversalTriggered = r.triggeredCount ?? 0;
  const reversalTotal = r.totalFactor ?? 4;
  const sellTriggered = s.signalCount ?? 0;
  const sellTotal = s.total ?? 3;

  const now = TwDate();
  const twHour = now.hour;
  const timeTag = TwDate().formatDateTime();

  let timeLabel = "📊 投資戰報";
  if (twHour === 7) {
    timeLabel = "🌅 盤前推演";
  } else if (twHour === 10) {
    timeLabel = "📈 盤中速報";
  } else if (twHour === 12) {
    timeLabel = "🕛 午盤速報";
  } else if (twHour === 14 || twHour === 15) {
    timeLabel = "🌙 盤後總結";
  } else if (twHour >= 21 && twHour <= 23) {
    timeLabel = "🦉 夜間國際觀測";
  }

  const _sVal = Number.isFinite(score) ? score : "--";
  const _mVal = Number.isFinite(minScore) ? minScore : "--";

  const scoreSection = [
    scoringCabinetTable(result),
    `<blockquote>${scoreOk ? "🟢 <b>量化共識：建議加碼</b>" : "⏸️ <b>條件未滿：中性觀望</b>"}
最終總分：<code>${result.finalScore.toFixed(1)}</code> pt (門檻 <code>${minScore}</code>)</blockquote>`,
  ].join("\n");

  const paddedPct = String(goalPct).padStart(5, " ");

  // ── entryGate 通道標示 ──
  const gateTag = entryGateTag(result);

  // ── VIX 情緒短路標示 ──
  const vixTag = vixOverrideTag(result);
  const regimeStatus = result.regimeResult
    ? `\\n${formatRegimeStatus(result.regimeResult)}`
    : "";

  // ── Gross Leverage 曝險標示 ──
  const glTag = grossLeverageTag(result);

  // ── 估值守衛標示 & 生效優先層標示 ──
  const vGuardTag = valuationGuardTag(result);
  const priorityTag = activePriorityTag(result);

  const msg1Text =
    `<blockquote><code>資料產出時間：${escapeHTML(timeTag)}</code></blockquote>\n\n` +
    `<b>${timeLabel}</b>${SEP}\n` +
    `🚦 狀態：<b>${escapeHTML(result.marketStatus || "未明")}</b>\n` +
    `📌 行動：<b>${escapeHTML(result.target || "觀望")}</b> ─ <i>${escapeHTML(result.targetSuggestionShort || "無特殊操作")}</i>` +
    `${regimeStatus}` +
    `${gateTag}` +
    `${vixTag}\n` +
    `${glTag}\n` +
    `${vGuardTag}\n` +
    `${priorityTag}\n` +
    `${trailingStopTag(result)}` +
    `${budgetControlTag(result)}` +
    `${conversionGuardTag(result)}\n` +
    `<blockquote expandable>${escapeHTML(result.suggestion || "無進階說明")}</blockquote>\n\n` +
    `🌐 <b>市場概況</b>${SEP}\n` +
    `🇺🇸 美股 VIX  <code>${escapeHTML(usRisk?.vix || "N/A")}</code>  ${escapeHTML(usRisk?.riskIcon || "")}\n` +
    `🇺🇸 貪婪指數 <code>${cnnText}</code>\n` +
    `📊 S&amp;P500   <code>${spxText}</code>  ${spxEmoji}\n` +
    `🇹🇼 台股 VIX <code>${escapeHTML(vixValue || "N/A")}</code>  ${escapeHTML(vixLabel || "")}\n` +
    `🇹🇼 景氣燈號 <code>${ndcText}</code>\n` +
    `🇹🇼 大盤維持 <code>${marginText}</code>\n` +
    `🇹🇼 大盤 PE  <code>${peText}</code>\n` +
    `🇹🇼 大盤 PB  <code>${pbText}</code>\n` +
    `💵 美元台幣 <code>${fxText}</code>\n` +
    `📍 歷史位階  <b>${escapeHTML(result.historicalLevel || "N/A")}</b>\n\n` +
    `📊 <b>進場評分</b>${SEP}\n` +
    `${scoreSection} \n\n` +
    `📡 <b>風險雷達</b>${SEP}\n` +
    `${signalIcon(reversalTriggered, reversalTotal)} 轉弱訊號 <code> ${reversalTriggered} / ${reversalTotal}</code> 個\n` +
    `${signalIcon(sellTriggered, sellTotal)} 賣出訊號 <code> ${sellTriggered} / ${sellTotal}</code> 個\n` +
    `${rsiAlert ? "🔥" : "▫️"} RSI <code> ${Number.isFinite(rsi) ? rsi.toFixed(1) : "--"}</code>\n` +
    `${dAlert ? "🔥" : "▫️"} KD(D) <code> ${Number.isFinite(kd_d) ? kd_d.toFixed(1) : "--"}</code>\n` +
    `${biasAlert ? "🔥" : "▫️"} 乖離率 <code> ${Number.isFinite(bias) ? bias.toFixed(1) + "%" : "--"}</code>\n\n` +
    `🎯 <b>目標進度</b>  ·  ${GOAL_YEARS} 年計畫${SEP}\n` +
    `<tg-spoiler> $${(currentAsset / 10000).toFixed(0)} 萬 ／ 目標 $${(GOAL_ASSET / 10000).toFixed(0)}萬</tg-spoiler>\n` +
    `<code> [${goalBar(currentAsset, GOAL_ASSET, 20)}] ${paddedPct}%   </code>`;

  const reversalSignals = [
    {
      name: "RSI 近期轉弱",
      value: Number.isFinite(rsi) ? rsi.toFixed(1) : "--",
      condition: `> ${th.rsiReversalLevel} → <${th.rsiReversalLevel}`,
      triggered: Boolean(r.rsiDrop),
    },
    {
      name: "KD(保守)近期轉弱",
      value: Number.isFinite(kdCons) ? kdCons.toFixed(1) : "--",
      condition: `> ${th.kReversalLevel} → <${th.kReversalLevel}`,
      triggered: Boolean(r.kdDrop),
    },
    {
      name: "KD 死叉",
      value: r.kdBearCross ? "死叉" : "未發生",
      condition: "K▽D",
      triggered: Boolean(r.kdBearCross),
    },
    {
      name: "MACD 死叉",
      value: r.macdBearCross ? "死叉" : "未發生",
      condition: "DIF▽DEA",
      triggered: Boolean(r.macdBearCross),
    },
  ];

  const sellSignals = [
    {
      name: "RSI",
      value: s.flags.rsiOverbought ? "已觸發" : "未觸發",
      condition: `目前 ≥ ${sellTh.rsi?.overbought}（超買狀態）`,
      triggered: Boolean(s.flags.rsiOverbought),
    },
    {
      name: "KD",
      value: s.flags.kdOverbought ? "已觸發" : "未觸發",
      condition: `K ≥ ${sellTh.kd?.overboughtK}（超買狀態）`,
      triggered: Boolean(s.flags.kdOverbought),
    },
    {
      name: "MACD",
      value: s.flags.macdDeadCross ? "已觸發" : "未觸發",
      condition: "最新 DIF 下穿 DEA（死叉）",
      triggered: Boolean(s.flags.macdDeadCross),
    },
  ];

  const msg2Text =
    `<blockquote> <code>資料產出時間：${escapeHTML(timeTag)}</code></blockquote>\n\n` +
    `🔬 <b>技術指標</b>${SEP}\n` +
    `${rsiAlert ? "🔥" : "▫️"} RSI <code> ${Number.isFinite(rsi) ? rsi.toFixed(1) : "N/A"}</code>\n` +
    `${dAlert ? "🔥" : "▫️"} KD(D) <code> ${Number.isFinite(kd_d) ? kd_d.toFixed(1) : "N/A"}</code>\n` +
    `${biasAlert ? "🔥" : "▫️"} 乖離率 <code> ${Number.isFinite(bias) ? bias.toFixed(1) + "%" : "N/A"}</code>\n` +
    `💰 現價 <code> $${Number(result.currentPrice || 0).toFixed(2)}</code> ${changeIcon} <code>${priceChangePct > 0 ? "+" : ""}${priceChangePct.toFixed(1)}%</code>\n` +
    `📌 基準價 <code> $${Number(result.basePrice || 0).toFixed(2)}</code>\n\n` +
    `📡 <b>轉弱監控</b>  <i>（${reversalTriggered}/${reversalTotal}）</i>${SEP}\n` +
    `${reversalSignals.map(signalRow).join("\n")} \n\n` +
    `🕔 <b>賣出訊號</b>  <i>（${sellTriggered}/${sellTotal}）</i>${SEP}\n` +
    `${sellSignals.map(signalRow).join("\n")} \n\n` +
    `🏦 <b>帳戶快照</b>${SEP}\n` +
    `💼 帳戶淨值    <tg-spoiler>$${Math.floor(currentAsset).toLocaleString("en-US")}</tg-spoiler>\n` +
    `🏗 總資產(含貸) <tg-spoiler>$${Math.floor(grossAsset).toLocaleString("en-US")}</tg-spoiler>\n` +
    `${levInfo.icon} 實際槓桿    <tg-spoiler>${Number.isFinite(levValue) ? levValue.toFixed(2) + " 倍" : "--"}  <b>${levInfo.label}</b></tg-spoiler>\n` +
    `📊 綜合曝險   <tg-spoiler>${Number.isFinite(result.grossLeverage) ? result.grossLeverage.toFixed(2) + "x" : "--"}  <b>${result.grossLeverageStatus === "hardcap_breach" ? "🚨危機" : result.grossLeverageStatus === "ceiling_breach" ? "⚠️上限" : "正常"}</b></tg-spoiler>\n` +
    `${mmInfo.icon} 維持率      <tg-spoiler>${hasLoan && Number.isFinite(mm) ? mm.toFixed(0) + "%" : "未借款"}  <b>${mmInfo.label}</b></tg-spoiler>\n` +
    `${z2Safe ? "✅" : "⚠️"} 00675L佔比  <tg-spoiler>${Number.isFinite(z2Ratio) ? z2Ratio.toFixed(1) + "%" : "N/A"}</tg-spoiler>  <i>上限 ${z2TargetPct.toFixed(0)}%</i>\n` +
    `💵 現金儲備    <tg-spoiler>$${cashReserveStr}</tg-spoiler>\n` +
    `💳 借款金額    <tg-spoiler>$${Number(totalLoan).toLocaleString("en-US")}</tg-spoiler>\n` +
    `🛡 0050    <tg-spoiler>${qty0050Str} 股</tg-spoiler>\n` +
    `⚔️ 0067L   <tg-spoiler>${qtyZ2Str} 股</tg-spoiler>` +
    stressTestTable(result) +
    decouplingRow(result);

  let macroAnalysisSection = "";
  if (macroAnalysis && macroAnalysis.conclusion) {
    const {
      bull_events = [],
      bear_events = [],
      neutral_events = [],
      total_bull_score = 0,
      total_bear_score = 0,
      conclusion,
    } = macroAnalysis;

    const topBull = bull_events
      .map((e) => `🟢[+${e.score}] ${escapeHTML(e.event)} `)
      .join("\n");
    const topBear = bear_events
      .map((e) => `🔴[-${e.score}] ${escapeHTML(e.event)} `)
      .join("\n");
    const topNeutral = neutral_events
      .map((e) => `⏳[觀望] ${escapeHTML(e.event)} `)
      .join("\n");

    const eventsList = [topBull, topBear, topNeutral]
      .filter(Boolean)
      .join("\n\n");

    const takeawaysText = (conclusion.key_takeaways || [])
      .map((k) => `• <i>${escapeHTML(k)}</i>`)
      .join("\n");

    macroAnalysisSection =
      `🌍 <b>AI 總經多空對決</b> ［${escapeHTML(conclusion.market_direction || "未知")}］${SEP}` +
      `🎯 <b>市場主軸：</b>\n` +
      `${escapeHTML(conclusion.short_summary || "無")} \n\n` +
      `⚖️ <b>多空積分：</b>多 <code> ${total_bull_score}</code> vs 空 <code> ${total_bear_score}</code>\n\n` +
      `<b>📌 核心驅動邏輯：</b>\n` +
      `${takeawaysText}\n` +
      `<blockquote expandable> <b>🔥 重大驅動事件：</b>\n` +
      `${eventsList || "無顯著事件"}</blockquote> `;
  }

  let aiTextHtml = "🔄 數據分析中，請稍候...";
  let internalThinking = "無";

  if (aiAdvice?.coach_internal_thinking) {
    const toList = (arr) =>
      (arr || []).map((item) => `• ${escapeHTML(item)} `).join("\n\n");

    const riskSection =
      `⚠️ <b>風險提示</b>\n` +
      `<blockquote expandable> ${toList(aiAdvice.risk_warnings)}</blockquote> `;

    const actionSection =
      `📌 <b>下一步觀察清單</b>\n` +
      `<blockquote expandable> ${toList(aiAdvice.action_items)}</blockquote> `;

    const mindsetSection =
      `💡 <b>行動微調建議</b>\n` +
      `<blockquote expandable> ${toList(aiAdvice.mindset_advice)}</blockquote> `;

    aiTextHtml = [riskSection, actionSection, mindsetSection].join("\n\n\n");
    internalThinking = aiAdvice.coach_internal_thinking;
  }

  const quoteAuthor = escapeHTML(quote?.author || "Unknown");
  const quoteBlock = `<i> ${escapeHTML(quote?.quote || "")}</i>\n\n— <b>${quoteAuthor}</b>`;

  const sheetUrl = process.env.GOOGLE_SHEET_ID
    ? `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit?usp=drivesdk`
    : null;
  const strategyUrl = process.env.STRATEGY_URL || null;

  const msg3Text =
    `<blockquote><code>資料產出時間：${escapeHTML(timeTag)}</code></blockquote>\n\n` +
    `${macroAnalysisSection}\n\n` +
    `🤖 <b>AI 教練洞察</b>${SEP}\n` +
    `${aiTextHtml}\n\n` +
    `🧠 <b>教練內心推演：</b>${SEP}\n` +
    `<blockquote expandable>${escapeHTML(internalThinking)}</blockquote>\n\n` +
    `📈 <b>每日一句</b>${SEP}\n` +
    `<blockquote>${quoteBlock}</blockquote>`;

  return [
    { text: msg1Text, pin: false },
    { text: msg2Text, disable_notification: true },
    { text: msg3Text, disable_notification: true, sheetUrl, strategyUrl },
  ];
}

// ── 精簡提醒卡（MiniApp 指向模式） ─────────────────────────────────────────────

/**
 * 建構精簡提醒卡，適用於 MiniApp 指向模式。
 * 僅發送一則訊息，附加「開啟儀表板」 WebApp 按鈕。
 * 詳細資訊全部至 Mini App 查看。
 *
 * 包含帳戶快照（淨值、槓桿、維持率、佔比、現金、借款、持股），
 * 所有金融數值使用 tg-spoiler 保護隱私。
 *
 * @param {{ result, vixData, usRisk, macroData, config, aiAdvice, quote }} data
 * @param {string} webAppUrl - TELEGRAM_WEBAPP_URL
 * @returns {Array} 單元素數組，格式相容於 sendTelegramBatch
 */
export function buildCompactMessage(data, webAppUrl) {
  const {
    vixData,
    usRisk,
    macroData: _macroData,
    socialSentiment,
    macroAnalysis,
    newsStructured,
    newsMessages,
    aiAdvice: _aiAdvice,
    config: _config,
    quote: _quote,
  } = data;
  const now = TwDate();
  const twHour = now.hour;
  const timeTag = now.formatDateTime();

  // ── 時間標籤 ──
  let timeLabel = "📊 投資日報";
  if (twHour === 7) timeLabel = "🌅 盤前推演";
  else if (twHour === 10) timeLabel = "📈 盤中速報";
  else if (twHour === 12) timeLabel = "🕛 午盤速報";
  else if (twHour === 14 || twHour === 15) timeLabel = "🌙 盤後總結";
  else if (twHour >= 21 && twHour <= 23) timeLabel = "🦉 夜間國際觀測";

  // ── 核心資訊 ──
  const baseObj = data.result || data.advice || data;
  const signals = baseObj.signals || data.signals || baseObj;
  const resObj = { ...baseObj, ...signals };
  const derivedTrend =
    signals.signalDirection === "long" &&
    signals.regimeResult?.state === "NORMAL"
      ? "正常偏多"
      : signals.signalDirection === "long"
        ? "偏多但需控風險"
        : signals.signalDirection === "short"
          ? "偏空防守"
          : "中性觀望";
  const derivedMarketStatus = derivedTrend;
  const marketStatus = escapeHTML(
    signals.marketStatus ??
      resObj.marketStatus ??
      data.marketStatus ??
      derivedMarketStatus,
  );
  const trend = escapeHTML(
    signals.macroMarketDirection ??
      macroAnalysis?.conclusion?.market_direction ??
      derivedTrend,
  );
  const target = escapeHTML(signals.target ?? resObj.target ?? "觀望");
  const targetShort = escapeHTML(
    signals.targetSuggestionShort ??
      resObj.targetSuggestionShort ??
      "無特殊操作",
  );
  const newsHeadlines = [
    ...(newsStructured?.tw || []),
    ...(newsStructured?.us || []),
    ...(newsMessages || []),
  ]
    .map((item) => item?.title || item?.text || item)
    .filter(Boolean)
    .slice(0, 2)
    .map((title) => escapeHTML(title));
  const newsSection = newsHeadlines.length
    ? `\n📰 <b>今日重大事件</b>\n${newsHeadlines.map((title) => `• ${title}`).join("\n")}\n`
    : "\n📰 <b>今日重大事件</b>\n• 今日無重大事件\n";

  // ── VIX ──
  const vixVal = vixData?.value != null ? Number(vixData.value) : null;
  const vixStr = vixVal !== null ? vixVal.toFixed(1) : "N/A";

  // ── 評分 ──
  const score = Number(resObj.weightScore);
  const minScore = Number(resObj.strategy?.buy?.minWeightScoreToBuy ?? NaN);
  const scoreStr = Number.isFinite(score) ? `${score.toFixed(1)}pt` : "--";
  const minScoreStr = Number.isFinite(minScore) ? minScore.toFixed(1) : "--";
  const biasStr = Number.isFinite(resObj.bias240)
    ? `${resObj.bias240.toFixed(1)}%`
    : "--";

  // ── 維持率與健康度 ──
  const mm = Number(resObj.maintenanceMargin || 0);
  const hasLoan = Number(resObj.totalLoan || 0) > 0;
  const mmEmoji = !hasLoan
    ? "▫️"
    : mm >= 160
      ? "✅"
      : mm >= 145
        ? "🟡"
        : mm >= 135
          ? "🟠"
          : "🔴";
  const mmStr =
    hasLoan && Number.isFinite(mm) && mm > 0 ? `${mm.toFixed(0)}%` : "未借款";

  const levValue = Number(resObj.actualLeverage);
  const levStr = Number.isFinite(levValue) ? `${levValue.toFixed(2)}` : "--";

  const dropLimit =
    resObj.dropLimit ??
    resObj.marginAnalysis?.riskAssessment?.survivalDropLimit;
  const dropLimitStr = dropLimit != null ? `${dropLimit.toFixed(1)}%` : "N/A";

  // ── 轉弱 / 賣出訊號 ──
  const reversalTriggered = resObj.reversal?.triggeredCount ?? 0;
  const reversalTotal = resObj.reversal?.totalFactor ?? 4;
  const sellTriggered = resObj.sellSignals?.signalCount ?? 0;
  const sellTotal = resObj.sellSignals?.total ?? 3;

  // ── AI 預判與市場 ──
  const aiDirection = escapeHTML(
    macroAnalysis?.conclusion?.market_direction || "未知",
  );
  const aiSummary = escapeHTML(
    macroAnalysis?.conclusion?.short_summary || "無資料",
  );
  const bullScore = macroAnalysis?.total_bull_score ?? 0;
  const bearScore = macroAnalysis?.total_bear_score ?? 0;
  const battleStr = `🟢利多 ${bullScore} vs 🔴利空 ${bearScore}`;

  // 社群輿情
  let sentimentStr = "無即時數據";
  if (socialSentiment?.sentimentSummary) {
    sentimentStr = escapeHTML(socialSentiment.sentimentSummary);
  } else if (socialSentiment?.score != null) {
    const s = Number(socialSentiment.score);
    const scoreVal = Number.isFinite(s) ? `${s.toFixed(0)}分` : "";
    const label = s >= 65 ? "偏多" : s <= 45 ? "偏空" : "中性震盪";
    sentimentStr = `${label} (${scoreVal})`;
  }

  const prVal = resObj?.valuationGuardResult?.currentPR ?? "N/A";
  const usSpx = escapeHTML(usRisk?.spxChg || "N/A");
  const usVix = escapeHTML(usRisk?.vix || "N/A");

  // ── 冷卻期提示 ──
  const cooldown = resObj.cooldownStatus;
  const cooldownHint = cooldown?.inCooldown
    ? `\n⏰ 冷卻期中 · 剩 ${cooldown.daysLeft} 交易日`
    : "";

  // ── VIX 情緒短路提示（精簡卡版） ──
  const vixOverrideHint = resObj.macroSentiment?.vixOverrideActive
    ? `\n⚡ VIX 情緒短路啟動 · AI BEARISH 抑制已解除`
    : "";

  const regimeHint = resObj.regimeResult
    ? `\n${formatRegimeStatus(resObj.regimeResult).replace(/\nundefined/g, "")}`
    : "";

  // ── Gross Leverage 提示（精簡卡版，僅警示層才顯示） ──
  const glHint =
    resObj.grossLeverageStatus === "hardcap_breach"
      ? `\n🚨 Gross Leverage ${Number.isFinite(resObj.grossLeverage) ? resObj.grossLeverage.toFixed(2) + "x" : "--"} · 超越危機紅線`
      : resObj.grossLeverageStatus === "ceiling_breach"
        ? `\n⚠️ Gross Leverage ${Number.isFinite(resObj.grossLeverage) ? resObj.grossLeverage.toFixed(2) + "x" : "--"} · 超越主動上限`
        : "";

  // ── 估值守衛精簡提示（僅警示層才顯示） ──
  const vGuardHint =
    resObj?.valuationGuardStatus === "latch_triggered"
      ? `\n🚨 估值守衛 · 清算觸發 PR${prVal}`
      : resObj?.valuationGuardStatus === "latch_active"
        ? `\n🔒 估值守衛 · 清算鎖定中 PR${prVal}`
        : resObj?.valuationGuardResult?.guardActive
          ? `\n📊 估值守衛 · PR${prVal} 壓縮 ×${resObj?.valuationGuardMultiplier ?? resObj?.valuationGuardResult?.multiplier ?? 1.0}`
          : "";

  // ── entryGate 通道標示（Compact） ──
  const gateTagCompact = entryGateTag(resObj);

  const SEP = "\n─────────────────\n";

  const text =
    `<b>${timeLabel}</b>  <code>${escapeHTML(timeTag)}</code>${SEP}` +
    `🌐 <b>大趨勢：${marketStatus}</b>\n` +
    `📌 <b>投資方向：${target}</b> ─ <i>${targetShort}</i>\n` +
    `🧭 市場方向：<b>${trend}</b>` +
    `${gateTagCompact}${cooldownHint}${vixOverrideHint}${regimeHint}${glHint}${vGuardHint}${SEP}` +
    newsSection +
    SEP +
    `🏦 <b>部位健康度</b>\n` +
    `⚖️ 實際槓桿：${levStr}x | ${mmEmoji} 維持率：${mmStr}\n` +
    `🛡 0050可跌空間：${dropLimitStr}\n\n` +
    `🌍 <b>市場與總經總結</b>\n` +
    `🇹🇼 大盤: PR ${prVal} | VIX: ${vixStr}\n` +
    `🇺🇸 輔助: S&P ${usSpx} | VIX: ${usVix}\n` +
    `💬 社群輿情：${sentimentStr}\n` +
    `⚔️ <b>多空對決：</b>[${aiDirection}] (${battleStr})\n` +
    `📝 <i>${aiSummary}</i>\n\n` +
    `📡 <b>技術指標</b>\n` +
    `評分：${scoreStr} (門檻 ${minScoreStr}) | 乖離：${biasStr}\n` +
    `轉弱：${reversalTriggered}/${reversalTotal} | 賣出：${sellTriggered}/${sellTotal}${SEP}` +
    `📲 點擊下方按鈕開啟 Mini App 查看詳細圖表`;

  return [
    {
      text,
      pin: false,
      webAppUrl,
    },
  ];
}

/**
 * 休市日市場與輿情情報卡（精簡版）
 *
 * 專為非交易日、節假日設計：
 *   - 不計算台股即時技術指標
 *   - 凸顯國際市場、美股 VIX、總經風險與社群最新情報
 *   - 提供 AI 新聞速覽與 Mini App 入口
 *
 * @param {object} data
 * @param {string} webAppUrl
 * @returns {Array} 相容於 sendTelegramBatch 的格式
 */
export function buildNonTradingDayMessage(data, webAppUrl) {
  const now = TwDate();
  const timeTag =
    typeof now?.formatDateTime === "function"
      ? now.formatDateTime()
      : `${TwDate().formatDateKey?.() || "2026-08-06"} 14:30`;

  const usRisk = data.usRisk || {};
  const macroData = data.macroData || {};
  const newsStructured = data.newsStructured || { tw: [], us: [] };
  const socialSentiment = data.socialSentiment || null;
  // Fix: unwrap nested `data` from provider's { success, data: {...} } contract
  const sentimentData = socialSentiment?.data || socialSentiment || null;

  const usSpx = escapeHTML(usRisk.spxChg || "N/A");
  const usVix = escapeHTML(usRisk.vix || "N/A");
  const fxUsdTwd =
    macroData.fx?.usdTwd != null
      ? Number(macroData.fx.usdTwd).toFixed(2)
      : "N/A";
  const riskLevel = escapeHTML(usRisk.riskLevel || "正常");

  // 社群情緒描述
  let sentimentStr = "無即時社群數據";
  if (sentimentData?.sentimentSummary) {
    sentimentStr = escapeHTML(sentimentData.sentimentSummary);
  } else if (sentimentData?.score != null) {
    const s = Number(sentimentData.score);
    // score is 0-100 scale; 50 = neutral
    const normalizedScore = s / 50 - 1; // maps 0→-1, 50→0, 100→1
    sentimentStr =
      normalizedScore > 0.2
        ? `${sentimentData.scoreLabel || "偏多"} (得分 ${s})`
        : normalizedScore < -0.2
          ? `${sentimentData.scoreLabel || "偏空"} (得分 ${s})`
          : `中性 (得分 ${s})`;
  }

  // 整理 2~3 則焦點新聞
  const articles = [
    ...(newsStructured.tw || []),
    ...(newsStructured.us || []),
  ].slice(0, 3);

  let newsSection = "";
  if (articles.length > 0) {
    const list = articles
      .map(
        (a, idx) => `  ${idx + 1}. <b>${escapeHTML(a.title || "無標題")}</b>`,
      )
      .join("\n");
    newsSection = `\n📰 <b>焦點市場情報：</b>\n${list}\n`;
  } else if (data.newsSummaryText) {
    newsSection = `\n📰 <b>情報摘要：</b>\n${escapeHTML(data.newsSummaryText.slice(0, 150))}…\n`;
  }

  const SEP = "\n─────────────────\n";

  const text =
    `😴 <b>市場情報觀測（本日休市）</b>  <code>${escapeHTML(timeTag)}</code>${SEP}` +
    `🇹🇼 <b>台股狀態：休市暫停交易</b>\n` +
    `💡 <i>投資部位與各項技術指標維持前一交易日定格。</i>${SEP}` +
    `🌐 <b>外圍市場與總經風險</b>\n` +
    `🇺🇸 美股波動：S&P ${usSpx} | VIX: ${usVix}\n` +
    `💵 美元匯率：USD/TWD ${fxUsdTwd} | 風險評級：${riskLevel}\n` +
    `💬 社群輿情：${sentimentStr}\n` +
    `${newsSection}${SEP}` +
    `📲 點擊下方按鈕開啟 Mini App 查看最新新聞池與市場雷達`;

  return [
    {
      text,
      pin: false,
      webAppUrl: webAppUrl || null,
    },
  ];
}
