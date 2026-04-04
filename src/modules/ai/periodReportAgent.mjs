// periodReportAgent.mjs
// 週報 / 月報核心：資料彙整（純運算）+ AI 分析（一次呼叫）
import { callAI, PROVIDERS, langfuse } from "./aiClient.mjs";

const PERIOD_REPORT_SCHEMA = {
  type: "object",
  properties: {
    topRiskEvents: {
      type: "array",
      items: { type: "string" },
      description: "本週期最重要風險事件，每項 30 字以內，最多 2 項",
    },
    consistencyComment: {
      type: "string",
      description: "策略一致性評語，50 字以內",
    },
    periodOutlook: {
      type: "string",
      description: "下週/下月展望，50 字以內",
    },
  },
  required: ["topRiskEvents", "consistencyComment", "periodOutlook"],
};

/**
 * 從 data/reports/ 讀取指定天數內的 report 檔案
 * @param {number} days - 7 (週報) 或 30/50 (月報)
 * @returns {Array<Object>} 依日期升序排列的 report 陣列
 */
export async function loadRecentReports(days) {
  const fs = (await import("fs/promises")).default;
  const path = (await import("path")).default;
  const reportsDir = path.join(process.cwd(), "data", "reports");

  let files;
  try {
    files = await fs.readdir(reportsDir);
  } catch {
    return [];
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const reports = [];
  for (const file of files) {
    if (!file.endsWith(".json") || file === ".gitkeep") continue;
    const dateStr = file.replace(".json", ""); // YYYY-MM-DD
    const fileDate = new Date(dateStr);
    if (isNaN(fileDate.getTime()) || fileDate < cutoff) continue;
    try {
      const content = await fs.readFile(path.join(reportsDir, file), "utf-8");
      reports.push(JSON.parse(content));
    } catch {
      // 單檔損壞不影響整體
    }
  }

  return reports.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 根據 reports 陣列計算純統計摘要（不呼叫 AI）
 * @param {Array<Object>} reports
 * @param {"weekly"|"monthly"} period
 * @returns {Object} stats
 */
export function buildPeriodStats(reports, period) {
  if (!reports.length) return null;

  const first = reports[0];
  const last = reports[reports.length - 1];

  // ① 每日訊號
  const dailySignals = reports.map((r) => ({
    date: r.date,
    target: r.signals?.target ?? "N/A",
    weightScore: r.signals?.weightScore ?? 0,
    marketStatus: r.signals?.marketStatus ?? "N/A",
    macroDirection: r.signals?.macroMarketDirection ?? null,
  }));

  // ② 技術指標
  function calcIndicatorStats(values) {
    const valid = values.filter((v) => v != null && Number.isFinite(v));
    if (!valid.length) return { avg: null, min: null, max: null, trend: "flat" };
    const avg = parseFloat((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2));
    const min = parseFloat(Math.min(...valid).toFixed(2));
    const max = parseFloat(Math.max(...valid).toFixed(2));
    const half = Math.floor(valid.length / 2);
    const firstHalfAvg = valid.slice(0, half || 1).reduce((a, b) => a + b, 0) / (half || 1);
    const secondHalfAvg = valid.slice(half).reduce((a, b) => a + b, 0) / (valid.length - half || 1);
    const diff = secondHalfAvg - firstHalfAvg;
    const trend = diff > 1 ? "up" : diff < -1 ? "down" : "flat";
    return { avg, min, max, trend };
  }

  const indicators = {
    rsi: calcIndicatorStats(reports.map((r) => r.signals?.RSI)),
    kdK: calcIndicatorStats(reports.map((r) => r.signals?.KD_K)),
    bias240: calcIndicatorStats(reports.map((r) => r.signals?.bias240)),
  };

  // ③ 過熱持續天數
  const overheatDays = reports.filter(
    (r) => (r.signals?.overheat?.factorCount ?? 0) >= 1
  ).length;
  const half = Math.floor(reports.length / 2);
  const firstHalfOverheat = reports.slice(0, half || 1).filter((r) => (r.signals?.overheat?.factorCount ?? 0) >= 1).length;
  const secondHalfOverheat = reports.slice(half).filter((r) => (r.signals?.overheat?.factorCount ?? 0) >= 1).length;
  const isEscalating = secondHalfOverheat > firstHalfOverheat;

  const overheat = {
    overheatDays,
    totalDays: reports.length,
    isEscalating,
  };

  // ⑤ AI 策略一致性
  const targets = dailySignals.map((d) => d.target);
  const uniqueTargets = [...new Set(targets)];
  let flipCount = 0;
  for (let i = 1; i < targets.length; i++) {
    if (targets[i] !== targets[i - 1]) flipCount++;
  }
  const consistency = {
    targets,
    isConsistent: uniqueTargets.length === 1,
    flipCount,
  };

  // ⑥ 冷卻期追蹤
  const blockedDetails = [];
  for (const r of reports) {
    const ws = r.signals?.weightScore ?? 0;
    const threshold = r.signals?.strategy?.buy?.minWeightScoreToBuy ?? 4;
    const inCooldown = r.signals?.cooldownStatus?.inCooldown ?? false;
    if (ws >= threshold && inCooldown) {
      blockedDetails.push({
        date: r.date,
        weightScore: ws,
        daysLeft: r.signals?.cooldownStatus?.daysLeft ?? 0,
      });
    }
  }
  const cooldown = {
    blockedDays: blockedDetails.length,
    blockedDetails,
  };

  // ⑦ 總經方向
  const macroDir = dailySignals.map((d) => d.macroDirection);
  const bullishDays = macroDir.filter((d) => d === "BULLISH").length;
  const bearishDays = macroDir.filter((d) => d === "BEARISH").length;
  const neutralDays = reports.length - bullishDays - bearishDays;
  let dominantDirection = "NEUTRAL";
  if (bullishDays > bearishDays && bullishDays > neutralDays) dominantDirection = "BULLISH";
  else if (bearishDays > bullishDays && bearishDays > neutralDays) dominantDirection = "BEARISH";

  const macro = { bullishDays, bearishDays, neutralDays, dominantDirection };

  // ⑧ 月報：訊號品質
  let signalQuality = null;
  if (period === "monthly") {
    const buyThreshold = reports[0]?.signals?.strategy?.buy?.minWeightScoreToBuy ?? 4;
    const buyTriggeredDays = reports.filter((r) => (r.signals?.weightScore ?? 0) >= buyThreshold).length;
    const overheatBlockedDays = reports.filter(
      (r) => {
        const ws = r.signals?.weightScore ?? 0;
        const oh = r.signals?.overheat?.highCount ?? 0;
        const ohThreshold = r.signals?.strategy?.threshold?.overheatCount ?? 2;
        return ws < buyThreshold && oh >= ohThreshold;
      }
    ).length;
    signalQuality = {
      buyTriggeredDays,
      overheatBlockedDays,
      cooldownBlockedDays: blockedDetails.length,
      totalTradingDays: reports.length,
    };
  }

  return {
    period,
    dateRange: { from: first.date, to: last.date },
    tradingDays: reports.length,
    dailySignals,
    indicators,
    overheat,
    consistency,
    cooldown,
    macro,
    ...(signalQuality && { signalQuality }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 訊號準確率統計
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 判斷某日 report 是否為「觸發買進訊號」
 * 以結構化欄位為主判斷依據，字串匹配為備用
 * @param {Object} signals - report.signals
 * @returns {boolean}
 */
export function isBuySignal(signals) {
  if (!signals) return false;
  // 主判斷：結構化槓桿欄位存在且 > 0
  if (Number.isFinite(signals.suggestedLeverage) && signals.suggestedLeverage > 0) return true;
  if (Number.isFinite(signals.targetAllocation?.leverage) && signals.targetAllocation.leverage > 0) return true;
  // 備用：target 字串匹配
  return /破冰加碼|買進訊號/.test(signals.target ?? "");
}

/**
 * 判斷某日 report 是否為「冷卻期封鎖」（分數達標但未進場）
 * @param {Object} signals - report.signals
 * @returns {boolean}
 */
export function isCooldownBlocked(signals) {
  if (!signals) return false;
  const inCooldown = signals.cooldownStatus?.inCooldown === true;
  if (!inCooldown) return false;
  const ws = signals.weightScore ?? 0;
  const threshold = signals.strategy?.buy?.minWeightScoreToBuy ?? 4;
  return ws >= threshold;
}

/**
 * 計算訊號準確率統計
 *
 * @param {Array<Object>} targetReports      - 欲評估的期間 reports（週報 7 天 / 月報 30 天）
 * @param {Array<Object>} priceSeriesReports - 包含未來日期的完整 reports（月報傳 50 天）
 * @param {"weekly"|"monthly"} period
 * @returns {Object} accuracyStats
 */
export function buildSignalAccuracyStats(targetReports, priceSeriesReports, period) {
  if (!targetReports?.length) return null;

  // 建立日期 → 價格的查詢 map（用 priceSeriesReports）
  const priceMap = {};
  for (const r of priceSeriesReports) {
    if (r.date && Number.isFinite(r.signals?.currentPrice)) {
      priceMap[r.date] = r.signals.currentPrice;
    }
  }

  // 取得所有有效日期（升序），用於查找第 N 個交易日
  const allDates = Object.keys(priceMap).sort();

  /**
   * 查找 signalDate 之後第 n 個交易日的價格
   * @returns {{ price: number|null, available: boolean }}
   */
  function lookupReturnPrice(signalDate, n) {
    const idx = allDates.indexOf(signalDate);
    if (idx === -1) return { price: null, available: false };
    const targetIdx = idx + n;
    if (targetIdx >= allDates.length) return { price: null, available: false };
    const targetDate = allDates[targetIdx];
    const price = priceMap[targetDate] ?? null;
    return { price, available: price !== null };
  }

  // 逐日分類
  let buySignalCount = 0;
  let cooldownBlockedCount = 0;
  const signalDetails = [];

  for (const r of targetReports) {
    const sig = r.signals;
    if (!sig) continue;

    const isBuy = isBuySignal(sig);
    const isBlocked = !isBuy && isCooldownBlocked(sig);

    if (isBlocked) cooldownBlockedCount++;
    if (!isBuy) continue;

    buySignalCount++;

    const priceAtSignal = sig.currentPrice;
    const leveragePct = Number.isFinite(sig.suggestedLeverage)
      ? Math.round(sig.suggestedLeverage * 100)
      : Number.isFinite(sig.targetAllocation?.leverage)
        ? Math.round(sig.targetAllocation.leverage * 100)
        : null;

    const detail = {
      date: r.date,
      weightScore: sig.weightScore ?? 0,
      leveragePct,
      priceAtSignal,
      returns: {},
    };

    // 月報才計算報酬率
    if (period === "monthly" && Number.isFinite(priceAtSignal) && priceAtSignal > 0) {
      for (const [key, offset] of [["d5", 5], ["d10", 10], ["d20", 20]]) {
        const { price, available } = lookupReturnPrice(r.date, offset);
        if (available && Number.isFinite(price)) {
          detail.returns[key] = {
            price: parseFloat(price.toFixed(2)),
            pct: parseFloat(((price - priceAtSignal) / priceAtSignal * 100).toFixed(2)),
            available: true,
          };
        } else {
          detail.returns[key] = { price: null, pct: null, available: false };
        }
      }
    }

    signalDetails.push(detail);
  }

  const totalEligibleDays = buySignalCount + cooldownBlockedCount;
  const cooldownBlockRate = totalEligibleDays > 0
    ? parseFloat((cooldownBlockedCount / totalEligibleDays).toFixed(3))
    : 0;

  // 報酬率統計（月報才有）
  let avgReturn = null;
  let winRate = null;

  if (period === "monthly" && signalDetails.length > 0) {
    avgReturn = {};
    winRate = {};
    let dataNote = null;

    for (const key of ["d5", "d10", "d20"]) {
      const available = signalDetails.filter((d) => d.returns[key]?.available);
      if (available.length === 0) {
        avgReturn[key] = null;
        winRate[key] = null;
      } else {
        const pcts = available.map((d) => d.returns[key].pct);
        avgReturn[key] = parseFloat((pcts.reduce((a, b) => a + b, 0) / pcts.length).toFixed(2));
        winRate[key] = parseFloat((pcts.filter((p) => p > 0).length / pcts.length).toFixed(3));
        // 部分資料不足時附加說明
        if (available.length < signalDetails.length) {
          dataNote = dataNote || `部分訊號的後續資料尚不完整（+${key.slice(1)} 日僅 ${available.length}/${signalDetails.length} 筆）`;
        }
      }
    }

    return {
      buySignalCount,
      cooldownBlockedCount,
      totalEligibleDays,
      cooldownBlockRate,
      signalDetails,
      avgReturn,
      winRate,
      dataNote,
    };
  }

  return {
    buySignalCount,
    cooldownBlockedCount,
    totalEligibleDays,
    cooldownBlockRate,
    signalDetails,
    avgReturn: null,
    winRate: null,
    dataNote: null,
  };
}

/**
 * 組合送入 callAI 的 promptVariables
 * systemInstruction 由 Langfuse template compile() 完成替換
 */
function buildPeriodReportVariables(stats, riskWarningsText, periodLabel) {
  const statsSummary = JSON.stringify(
    {
      dateRange: stats.dateRange,
      tradingDays: stats.tradingDays,
      indicators: stats.indicators,
      overheat: stats.overheat,
      consistency: stats.consistency,
      cooldown: stats.cooldown,
      macro: stats.macro,
      ...(stats.signalQuality && { signalQuality: stats.signalQuality }),
    },
    null,
    2,
  );

  return {
    period_label: periodLabel,
    risk_warnings_text: riskWarningsText,
    stats_summary: statsSummary,
  };
}

/**
 * 呼叫 AI 產生週期分析
 * @param {Object} stats - buildPeriodStats 的結果
 * @param {Array<Object>} reports - 原始 report 陣列（用於提取 risk_warnings）
 * @param {string} periodLabel - "過去 5" 或 "過去 30"
 * @param {string} sessionId
 * @returns {{ aiSummary: Object|null, traceId: string|null }}
 */
export async function generatePeriodAiSummary(stats, reports, periodLabel, sessionId) {
  // 彙整每日 risk_warnings
  const riskWarningsText = reports
    .map((r) => {
      const warnings = r.ai?.risk_warnings ?? [];
      if (!warnings.length) return null;
      return `[${r.date}]\n${warnings.map((w) => `  • ${w}`).join("\n")}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const promptVariables = buildPeriodReportVariables(
    stats,
    riskWarningsText || "本週期無風險警告記錄。",
    periodLabel,
  );

  try {
    const { text, traceId } = await callAI(
      "PeriodReportAnalysis",
      "請開始分析，依據 system 指令輸出 JSON。",
      {
        sessionId,
        provider: PROVIDERS.GEMINI,
        keyIndex: 1,
        responseSchema: PERIOD_REPORT_SCHEMA,
        promptVariables,
      },
    );

    const aiSummary = JSON.parse(text);

    try {
      await langfuse.score({
        traceId,
        name: "Schema_Validation",
        value: 1,
        comment: "PeriodReportAnalysis JSON parse success",
      });
    } catch { /* score 失敗不阻斷 */ }

    return { aiSummary, traceId };
  } catch (err) {
    console.warn("⚠️ [PeriodReport] AI 分析失敗:", err.message);
    return { aiSummary: null, traceId: null };
  }
}
