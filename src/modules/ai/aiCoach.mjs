import { callAI, PROVIDERS, langfuse } from "./aiClient.mjs";
import { formatQuantDataForCoach } from "./aiDataPreprocessor.mjs";
import { baseTwQueries, baseUsQueries } from "../keywordConfig.mjs";
import {
  buildMacroAnalysisUserPrompt,
  buildCoachUserPrompt,
  buildNewsUserPrompt,
  buildNewsKeyWorkPrompt,
  FILTERED_NEWS_SCHEMA,
  MACRO_ANALYSIS_SCHEMA,
  NEWS_KEYWORD_SCHEMA,
  INVESTMENT_COACH_SCHEMA,
} from "./prompts.mjs";

import { archiveManager } from "../data/archiveManager.mjs";
import { saveFilteredPool } from "../data/newsPoolManager.mjs";

const sessionId = process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_WORKFLOW}-${process.env.GITHUB_RUN_ID}`
  : `local-${Date.now()}`;

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
    console.warn(`⚠️ [Langfuse] score 寫入失敗 (${payload.name}):`, err.message);
  }
}

/** 依白名單計算維度覆蓋率 0~1 */
function calcDiversityScore(dimensionCheck = {}) {
  const covered = VALID_DIMENSIONS.filter(
    (key) => dimensionCheck[key] === true
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

/** 確認值為非空字串陣列 */
function isNonEmptyStringArray(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((v) => typeof v === "string" && v.trim().length > 0)
  );
}

// ── AI 函式 ──────────────────────────────────────────────────────────────────

/** 根據當前市場數據，動態產生適合搜尋引擎使用的關鍵字 */
export async function generateDailySearchQueries(marketData) {
  const staticPoolText =
    `TW 靜態池：${baseTwQueries.map((q) => q.keyword).join("、")}\n` +
    `US 靜態池：${baseUsQueries.map((q) => q.keyword).join("、")}`;

  const todayStr = new Date().toISOString().split("T")[0];
  const prompt = buildNewsKeyWorkPrompt(todayStr, marketData, staticPoolText);

  try {
    const { text, traceId } = await callAI("GenerateSearchQueries", prompt, {
      sessionId,
      provider: PROVIDERS.GEMINI,
      keyIndex: 0,
      responseSchema: NEWS_KEYWORD_SCHEMA,
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
        userPrompt: prompt,
        schema: NEWS_KEYWORD_SCHEMA,
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
 * 將原始新聞陣列經 AI 過濾後回傳含 summary 的文章陣列
 * 過濾完成後同時非阻塞地將結果寫入 pool_filtered_active.json
 */
export async function filterAndCategorizeAllNewsWithAI(allNewsArray, sourcePoolUpdatedAt) {
  if (allNewsArray.length === 0) return [];

  const newsListText = allNewsArray
    .map(
      (n, i) =>
        `[ID: ${i}] [${n._region}] [age_band: ${n.age_band || "unknown"}] 標題: ${n.title}`,
    )
    .join("\n");
  const userPrompt = buildNewsUserPrompt(newsListText);

  try {
    const { text, traceId } = await callAI(
      "FilterAndCategorizeNews",
      userPrompt,
      {
        sessionId,
        provider: PROVIDERS.GEMINI,
        keyIndex: 1,
        responseSchema: FILTERED_NEWS_SCHEMA,
      },
    );

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

    const thinkContent = aiResult.think;
    console.log("📊 事件盤點數:", thinkContent.event_inventory.length);
    console.log("📐 維度覆蓋:", thinkContent.dimension_check);
    console.log("🗑️ 捨棄筆數:", thinkContent.excluded.length);

    const result = aiResult.news.map((aiItem) => ({
      ...allNewsArray[aiItem.id],
      summary: aiItem.summary,
    }));

    archiveManager
      .saveAiLog({
        type: "NewsFilter",
        userPrompt,
        schema: FILTERED_NEWS_SCHEMA,
        rawResult: aiResult,
      })
      .catch((err) =>
        console.warn("⚠️ [Archive] 儲存新聞過濾紀錄失敗:", err.message),
      );

    saveFilteredPool(result, sourcePoolUpdatedAt).catch((err) =>
      console.warn("⚠️ [NewsPool] Filter 結果回存失敗:", err.message),
    );

    return result;
  } catch (error) {
    console.error("AI 處理新聞時發生錯誤:", error);
    return [];
  }
}

// --- 宏觀分析 ---
export async function analyzeMacroNewsWithAI(todayNewsText) {
  const todayStr = new Date().toISOString().split("T")[0];
  const userPrompt = buildMacroAnalysisUserPrompt(todayStr, todayNewsText);

  try {
    const { text, traceId } = await callAI("AnalyzeMacroNews", userPrompt, {
      sessionId,
      provider: PROVIDERS.GEMINI,
      keyIndex: 2,
      responseSchema: MACRO_ANALYSIS_SCHEMA,
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
        userPrompt,
        schema: MACRO_ANALYSIS_SCHEMA,
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
  const todayStr = new Date().toISOString().split("T")[0];

  const userPrompt = buildCoachUserPrompt(
    todayStr,
    newsSummaryText,
    macroTextForCoach,
    quantTextForCoach,
    macroAndChipStr,
  );

  try {
    const { text, traceId } = await callAI("InvestmentAdvice", userPrompt, {
      sessionId,
      provider: PROVIDERS.GEMINI,
      keyIndex: 0,
      responseSchema: INVESTMENT_COACH_SCHEMA,
    });

    const adviceObj = JSON.parse(text);

    // Schema_Validation
    await safeLangfuseScore({
      traceId,
      name: "Schema_Validation",
      value: 1,
      comment: "InvestmentAdvice JSON parse success",
    });

    // Format_Compliance — 確認 JSON 必要欄位為非空字串陣列
    const formatOk =
      isNonEmptyStringArray(adviceObj.risk_warnings) &&
      isNonEmptyStringArray(adviceObj.action_items) &&
      isNonEmptyStringArray(adviceObj.mindset_advice);

    await safeLangfuseScore({
      traceId,
      name: "Format_Compliance",
      value: formatOk ? 1 : 0,
      comment: JSON.stringify({
        risk_warnings: Array.isArray(adviceObj.risk_warnings)
          ? adviceObj.risk_warnings.length
          : 0,
        action_items: Array.isArray(adviceObj.action_items)
          ? adviceObj.action_items.length
          : 0,
        mindset_advice: Array.isArray(adviceObj.mindset_advice)
          ? adviceObj.mindset_advice.length
          : 0,
      }),
    });

    archiveManager
      .saveAiLog({
        type: "InvestmentAdvice",
        userPrompt,
        schema: INVESTMENT_COACH_SCHEMA,
        rawResult: adviceObj,
      })
      .catch((err) =>
        console.warn("⚠️ [Archive] 儲存 AI 決策紀錄失敗:", err.message),
      );

    return { advice: adviceObj, traceId };
  } catch (error) {
    console.error("AI 決策引擎處理失敗:", error.message);
    return {
      advice: "AI 決策引擎暫時無法運作，請依原始數據判斷。",
      traceId: null,
    };
  }
}
