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
 * @param {number} days - 7 (週報) 或 30 (月報)
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

/**
 * 組合送入 AI 的 user prompt
 */
function buildPeriodReportPrompt(stats, riskWarningsText, periodLabel) {
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

  return `period_label: ${periodLabel}

【每日 AI 風險警告原文】
${riskWarningsText}

【統計摘要 JSON】
${statsSummary}`;
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

  const userPrompt = buildPeriodReportPrompt(stats, riskWarningsText || "本週期無風險警告記錄。", periodLabel);

  try {
    const { text, traceId } = await callAI("PeriodReportAnalysis", userPrompt, {
      sessionId,
      provider: PROVIDERS.GEMINI,
      keyIndex: 1,
      responseSchema: PERIOD_REPORT_SCHEMA,
    });

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
