import { callAI, PROVIDERS, langfuse } from "./aiClient.mjs";
import { formatQuantDataForCoach } from "./aiDataPreprocessor.mjs";
import { baseTwQueries, baseUsQueries } from "../keywordConfig.mjs";
import { archiveManager } from "../data/archiveManager.mjs";
import { saveFilteredPool } from "../data/newsPoolManager.mjs";
import { assignConflictGroups } from "../news/newsConflictGrouper.mjs";

const sessionId = process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_WORKFLOW}-${process.env.GITHUB_RUN_ID}`
  : `local-${Date.now()}`;

const dateStr = new Date().toLocaleDateString("zh-TW", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// ── 觀測工具 ─────────────────────────────────────────────────────────────────

/** 白名單維度，用於計算 Diversity_Score */
const VALID_DIMENSIONS = [
  "macro_economy",
  "tw_market",
  "semiconductor",
  "geopolitics",
  "capital_flow",
];

/** Langfuse score 回寫，失敗不阻斷主流程 */
async function safeLangfuseScore(payload) {
  try {
    await langfuse.score(payload);
  } catch (err) {
    console.warn(
      `⚠️ [Langfuse] score 寫入失敗 (${payload.name}):`,
      err.message,
    );
  }
}

/** 依白名單計算維度覆蓋率 0~1 */
function calcDiversityScore(dimensionCheck = {}) {
  const covered = VALID_DIMENSIONS.filter(
    (key) => dimensionCheck[key] === true,
  ).length;
  return covered / VALID_DIMENSIONS.length;
}

/** 計算分數陣列的標準差，正規化至 0~1（除以 2） */
function calcSpreadScore(scores = []) {
  if (!scores.length) return 0;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance =
    scores.reduce((sum, x) => sum + (x - mean) ** 2, 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  return Math.max(0, Math.min(1, stdDev / 2));
}

/** 確認值為非空字串 */
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/** 確認值為非空字串陣列 */
function isNonEmptyStringArray(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((v) => typeof v === "string" && v.trim().length > 0)
  );
}

// ── 新聞選取工具 ──────────────────────────────────────────────────────────────

/** age_band 優先序：fresh > recent > stale */
const AGE_BAND_PRIORITY = { fresh: 0, recent: 1, stale: 2 };

/** 取得文章時間戳（ms），供同 age_band 內的新舊排序使用 */
function toTimestamp(article) {
  const raw = article?.pubDate || article?.fetched_at;
  const ts = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(ts) ? ts : 0;
}

/** 排序規則：age_band 優先，同 band 內依時間由新到舊 */
function sortNewsForAi(a, b) {
  const ageDiff =
    (AGE_BAND_PRIORITY[a?.age_band] ?? 99) -
    (AGE_BAND_PRIORITY[b?.age_band] ?? 99);
  if (ageDiff !== 0) return ageDiff;
  return toTimestamp(b) - toTimestamp(a);
}

/**
 * 從 pool 中選出送入 AI 的新聞子集
 * @param {Array}  allNewsArray    - 完整 pool 文章陣列
 * @param {number} perRegionLimit  - 每個 region 最多幾篇（預設 30）
 * @param {number} totalLimit      - 最終總上限（預設 60）
 * @returns {Array} 選出的文章陣列，順序為 age_band 優先 + 由新到舊
 */
function selectNewsForAi(allNewsArray, perRegionLimit = 30, totalLimit = 60) {
  const sorted = [...allNewsArray].sort(sortNewsForAi);
  const byRegion = new Map();
  const selected = [];
  const leftovers = [];

  for (const article of sorted) {
    const region = article?._region || "TW";
    const count = byRegion.get(region) || 0;
    if (count < perRegionLimit) {
      selected.push(article);
      byRegion.set(region, count + 1);
    } else {
      leftovers.push(article);
    }
  }

  // 先按 per-region 上限填滿，再用 leftovers 補到 totalLimit
  const capped = selected.slice(0, totalLimit);
  if (capped.length < totalLimit) {
    for (const article of leftovers) {
      if (capped.length >= totalLimit) break;
      capped.push(article);
    }
  }

  return capped;
}

// ── AI 函式 ──────────────────────────────────────────────────────────────────

/** 根據當前市場數據，動態產生適合搜尋引擎使用的關鍵字 */
export async function generateDailySearchQueries(marketData) {
  const staticPoolText =
    `TW 靜態池：${baseTwQueries.map((q) => q.keyword).join("、")}\n` +
    `US 靜態池：${baseUsQueries.map((q) => q.keyword).join("、")}`;

  const { marketStatus, vix } = marketData;
  const promptVariables = { dateStr, marketStatus, vix, staticPoolText };

  try {
    const { text, traceId } = await callAI("News/GenerateSearchQueries", {
      sessionId,
      provider: PROVIDERS.GEMINI,
      keyIndex: 0,
      promptVariables,
    });

    const result = JSON.parse(text);

    await safeLangfuseScore({
      traceId,
      name: "Schema_Validation",
      value: 1,
      comment: "GenerateSearchQueries JSON parse success",
    });

    archiveManager
      .saveAiLog({
        type: "SearchQueries",
        promptVariables,
        rawResult: result,
      })
      .catch((err) =>
        console.warn("⚠️ [Archive] 儲存關鍵字生成紀錄失敗:", err.message),
      );

    return {
      twQueries: result.twQueries ?? [],
      usQueries: result.usQueries ?? [],
      traceId,
    };
  } catch (error) {
    console.warn("動態產生關鍵字失敗，回傳空陣列");
    return { twQueries: [], usQueries: [], traceId: null };
  }
}

// --- 新聞過濾與分類 ---
/**
 * 將原始新聞陣列經 AI 過濾後回傳 { news, conflictSummary }
 * 過濾完成後同時非阻塞地將結果寫入 pool_filtered_active.json
 *
 * 送入 AI 前先以 selectNewsForAi() 做 age-band 優先篩選：
 *   - 每 region 上限 30 篇，總量上限 60 篇
 *   - pool 本身仍保留完整 24h 資料，不受此限制影響
 *
 * 送入 AI 前以 assignConflictGroups() 標記衝突群組，
 *   newsListText 格式改為：[i][tag] [region] [age_band] pubDate | title
 *
 * @returns {{ news: Array, conflictSummary: string }}
 */
export async function filterAndCategorizeAllNewsWithAI(
  allNewsArray,
  sourcePoolUpdatedAt,
) {
  if (allNewsArray.length === 0) return { news: [], conflictSummary: "" };

  // ── 選取送入 AI 的子集 ──────────────────────────────────────────────────────
  const selectedNews = selectNewsForAi(allNewsArray);
  console.log(
    `🧺 [NewsAI] 本次送入 AI ${selectedNews.length}/${allNewsArray.length} 篇（perRegionLimit=30, totalLimit=60）`,
  );

  // ── 3-A：矛盾分群標記 ────────────────────────────────────────────────────────
  const taggedNews = assignConflictGroups(selectedNews);

  const newsListText = taggedNews
    .map((n, i) => {
      const tag = n._conflictGroup ?? "--";
      const pubDate = n.pubDate
        ? new Date(n.pubDate).toISOString().slice(0, 16).replace("T", " ")
        : "unknown";
      return `[${i}][${tag}] [${n._region}] [age_band: ${n.age_band || "unknown"}] ${pubDate} | ${n.title}`;
    })
    .join("\n");

  const promptVariables = { newsListText };

  try {
    const { text, traceId } = await callAI("News/FilterAndCategorizeNews", {
      sessionId,
      provider: PROVIDERS.GEMINI,
      keyIndex: 1,
      promptVariables,
    });

    const aiResult = JSON.parse(text);

    await safeLangfuseScore({
      traceId,
      name: "Schema_Validation",
      value: 1,
      comment: "FilterAndCategorizeNews JSON parse success",
    });

    const diversityScore = calcDiversityScore(
      aiResult?.think?.dimension_check ?? {},
    );
    await safeLangfuseScore({
      traceId,
      name: "Diversity_Score",
      value: diversityScore,
      comment: JSON.stringify(aiResult?.think?.dimension_check ?? {}),
    });

    // ── 3-B：矛盾偵測 + Langfuse score ──────────────────────────────────────
    const eventInventory = aiResult?.think?.event_inventory ?? [];
    const conflictedEvents = eventInventory.filter(
      (e) => e?.has_conflict === true,
    );

    let conflictSummary = "";
    if (conflictedEvents.length > 0) {
      const lines = conflictedEvents.map(
        (e) =>
          `- ${e.event ?? "（未命名事件）"}：${e.conflict_note ?? "（無描述）"}`,
      );
      conflictSummary =
        `[⚠️ 矛盾新聞偵測]\n以下事件在本次新聞池中存在矛盾報導，請納入分析時特別留意：\n` +
        lines.join("\n");
    }

    console.log(
      `⚔️ [ConflictDetect] 矛盾事件偵測數：${conflictedEvents.length}`,
    );

    await safeLangfuseScore({
      traceId,
      name: "Contradiction_Count",
      value: conflictedEvents.length,
      comment: conflictSummary || "無矛盾事件",
    });

    const thinkContent = aiResult.think;
    console.log("📊 事件盤點數:", thinkContent.event_inventory.length);
    console.log("📐 維度覆蓋:", thinkContent.dimension_check);
    console.log("🗑️ 捨棄筆數:", thinkContent.excluded.length);

    // AI 回傳的 id 對應的是 taggedNews 的索引
    const news = aiResult.news.map((aiItem) => ({
      ...taggedNews[aiItem.id],
      summary: aiItem.summary,
    }));

    archiveManager
      .saveAiLog({
        type: "NewsFilter",
        promptVariables,
        rawResult: aiResult,
      })
      .catch((err) =>
        console.warn("⚠️ [Archive] 儲存新聞過濾紀錄失敗:", err.message),
      );

    saveFilteredPool(news, sourcePoolUpdatedAt).catch((err) =>
      console.warn("⚠️ [NewsPool] Filter 結果回存失敗:", err.message),
    );

    // ── 3-C：return { news, conflictSummary } ──────────────────────────────
    return { news, conflictSummary };
  } catch (error) {
    console.error("AI 處理新聞時發生錯誤:", error);
    return { news: [], conflictSummary: "" };
  }
}

// --- 宏觀分析 ---
/**
 * 根據今日新聞文字與矛盾摘要，產出多空對決報告
 * @param {string} todayNewsText      - 新聞摘要文字
 * @param {string} [conflictSummary]  - 矛盾事件前置注解（可選）
 */
export async function analyzeMacroNewsWithAI(
  todayNewsText,
  conflictSummary = "",
) {
  const promptVariables = {
    dateStr,
    newsText: conflictSummary
      ? `${conflictSummary}\n\n---\n\n${todayNewsText}`
      : todayNewsText,
  };

  try {
    const { text, traceId } = await callAI("News/AnalyzeMacroNews", {
      sessionId,
      provider: PROVIDERS.GEMINI,
      keyIndex: 2,
      promptVariables,
    });

    const result = JSON.parse(text);

    await safeLangfuseScore({
      traceId,
      name: "Schema_Validation",
      value: 1,
      comment: "AnalyzeMacroNews JSON parse success",
    });

    const allScores = [
      ...(result.bull_events ?? []).map((e) => e.score),
      ...(result.bear_events ?? []).map((e) => e.score),
    ].filter((n) => Number.isFinite(n));

    const spread = calcSpreadScore(allScores);
    await safeLangfuseScore({
      traceId,
      name: "Score_Distribution_Spread",
      value: spread,
      comment: JSON.stringify(allScores),
    });

    archiveManager
      .saveAiLog({
        type: "MacroAnalysis",
        promptVariables,
        rawResult: result,
      })
      .catch((err) =>
        console.warn("⚠️ [Archive] 儲存總經分析紀錄失敗:", err.message),
      );

    return result;
  } catch (error) {
    console.warn("宏觀新聞分析失敗，回傳空物件");
    return {
      bull_events: [],
      bear_events: [],
      total_bull_score: 0,
      total_bear_score: 0,
      conclusion: {
        market_direction: "NEUTRAL",
        analysis: "AI 無法分析今日新聞，請依原始新聞自行判斷。",
      },
    };
  }
}

// --- 投資建議 ---
/**
 * 根據市場數據、新聞摘要、既定投資策略，產出操作建議與風險提示
 *
 *   quantTextForCoach  ← formatQuantDataForCoach(marketData, portfolio, vixData)
 *   newsSummaryText    ← 今日新聞摘要
 *   macroTextForCoach  ← MacroAnalysis 報告
 *   macroAndChipStr    ← 大盤籌碼位階字串
 *
 * @returns {{ advice: object|string, traceId: string|null }}
 */
export async function getAiInvestmentAdvice(
  marketData,
  portfolio,
  vixData,
  newsSummaryText,
  macroTextForCoach,
  macroAndChipStr,
  onlyPrompt,
) {
  if (onlyPrompt) return { advice: "AI 決策引擎停止運作中。", traceId: null };

  const quantTextForCoach = formatQuantDataForCoach(
    marketData,
    portfolio,
    vixData,
  );

  // 參數順序：(quantTextForCoach, newsSummaryText, macroTextForCoach, macroAndChipStr)
  const promptVariables = {
    dateStr,
    quantText: quantTextForCoach,
    macroAndChipStr,
    macroText: macroTextForCoach,
    newsSummaryText,
  };

  try {
    const { text, traceId } = await callAI("Report/InvestmentAdvice", {
      sessionId,
      provider: PROVIDERS.GEMINI,
      keyIndex: 3,
      promptVariables,
    });

    const result = JSON.parse(text);

    await safeLangfuseScore({
      traceId,
      name: "Schema_Validation",
      value: 1,
      comment: "GetInvestmentAdvice JSON parse success",
    });

    // ── Format_Compliance ────────────────────────────────────────────────────
    const hasSummary = isNonEmptyString(result?.coach_internal_thinking);
    const hasActions = isNonEmptyStringArray(result?.action_items);
    const hasMindset = isNonEmptyString(result?.mindset_advice);
    const formatOk = hasSummary && hasActions && hasMindset;

    await safeLangfuseScore({
      traceId,
      name: "Format_Compliance",
      value: formatOk ? 1 : 0,
      comment: JSON.stringify({ hasSummary, hasActions, hasMindset }),
    });

    // ── Risk_Coverage ────────────────────────────────────────────────────────
    if (isNonEmptyStringArray(result?.risk_warnings)) {
      await safeLangfuseScore({
        traceId,
        name: "Risk_Coverage",
        value: Math.min(1, result.risk_warnings.length / 3),
        comment: result.risk_warnings.join(" | "),
      });
    }

    archiveManager
      .saveAiLog({
        type: "InvestmentAdvice",
        promptVariables,
        rawResult: result,
      })
      .catch((err) =>
        console.warn("⚠️ [Archive] 儲存投資建議紀錄失敗:", err.message),
      );

    return { advice: result, traceId };
  } catch (error) {
    console.error("AI 投資建議生成失敗:", error);
    return {
      advice: "AI 決策引擎暫時無法運作，請依技術指標自行判斷。",
      traceId: null,
    };
  }
}
