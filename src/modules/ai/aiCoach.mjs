import { ThinkingLevel } from "@google/genai";
import { callGemini } from "./aiClient.mjs";
import { minifyExplainInput } from "./aiDataPreprocessor.mjs";
import {
  MACRO_ANALYSIS_SYSTEM_PROMPT,
  INVESTMENT_COACH_PROMPT,
  NEWS_KEYWORD_PROMPT,
  NEWS_FILTER_PROMPT,
  buildMacroAnalysisUserPrompt,
  buildCoachUserPrompt,
  buildNewsUserPrompt,
  buildNewsKeyWorkPrompt,
  FILTERED_NEWS_SCHEMA,
  MACRO_ANALYSIS_SCHEMA,
  NEWS_KEYWORD_SCHEMA,
} from "./prompts.mjs";
import { SaveTmpFile } from "../../utils/debugUtils.mjs";

// 這個函式會根據當前的市場數據、新聞摘要，以及既定的投資策略，產出具體的操作建議與風險提示
export async function getAiInvestmentAdvice(
  marketData,
  portfolio,
  vixData,
  newsSummaryText,
  macroTextForCoach,
  onlyPrompt,
) {
  if (onlyPrompt) return "AI 決策引擎停止運作中。";

  const cleanData = minifyExplainInput(marketData, portfolio, vixData);
  const jsonStr = JSON.stringify(cleanData);
  const todayStr = new Date().toISOString().split("T")[0];

  const userPrompt = buildCoachUserPrompt(
    todayStr,
    newsSummaryText,
    macroTextForCoach,
    jsonStr,
  );

  try {
    const result = await callGemini(userPrompt, INVESTMENT_COACH_PROMPT, {
      temperature: 0.1,
      maxOutputTokens: 65536,
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
    });

    SaveTmpFile(
      { systemPrompt: INVESTMENT_COACH_PROMPT, userPrompt, rawResult: result },
      "AiInvestmentAdvice",
      "AiInvestmentAdvice_debug",
    );

    return result;
  } catch (error) {
    return "AI 決策引擎暫時無法運作，請依原始數據判斷。";
  }
}

// --- 新聞過濾與分類 Prompt ---
export async function filterAndCategorizeAllNewsWithAI(allNewsArray) {
  if (allNewsArray.length === 0) return [];

  const newsListText = allNewsArray
    .map((n, i) => `[ID: ${i}] [${n._region}] 標題: ${n.title}`)
    .join("\n");
  const userPrompt = buildNewsUserPrompt(newsListText);

  try {
    const rawJsonText = await callGemini(userPrompt, NEWS_FILTER_PROMPT, {
      maxOutputTokens: 16384,
      responseMimeType: "application/json",
      responseSchema: FILTERED_NEWS_SCHEMA,
    });

    const aiResult = JSON.parse(rawJsonText);
    const result = aiResult.map((aiItem) => ({
      ...allNewsArray[aiItem.id],
      sentiment: aiItem.sentiment,
      aiSummary: aiItem.summary,
      importanceScore: aiItem.importanceScore,
    }));
    SaveTmpFile(
      {
        systemPrompt: NEWS_FILTER_PROMPT,
        userPrompt,
        schema: FILTERED_NEWS_SCHEMA,
        rawResult: aiResult,
      },
      "NewsFilter",
      `NewsFilter_${new Date().toISOString().split("T")[0]}`,
    );
    return result;
  } catch (error) {
    console.error("AI 處理新聞時發生錯誤:", error);
    return [];
  }
}

// 這個函式會根據當前的市場數據，動態產生適合搜尋引擎使用的關鍵字
export async function generateDailySearchQueries(marketData) {
  const todayStr = new Date().toISOString().split("T")[0];

  const prompt = buildNewsKeyWorkPrompt(todayStr, marketData);

  try {
    const rawJson = await callGemini(prompt, NEWS_KEYWORD_PROMPT, {
      responseMimeType: "application/json",
      responseSchema: NEWS_KEYWORD_SCHEMA,
    });

    const result = JSON.parse(rawJson); // { twQueries: [{keyword: "...", searchType: "..."}], usQueries: [...] }

    SaveTmpFile(
      {
        systemPrompt: NEWS_KEYWORD_PROMPT,
        userPrompt: prompt,
        schema: NEWS_KEYWORD_SCHEMA,
        rawResult: result,
      },
      "DailySearchQueries",
      `DailySearchQueries_${todayStr}`,
    );

    return result;
  } catch (error) {
    console.warn("動態產生關鍵字失敗，回傳空陣列");
    return { twQueries: [], usQueries: [] };
  }
}

// --- 宏觀分析 Prompt ---
export async function analyzeMacroNewsWithAI(todayNewsText) {
  const todayStr = new Date().toISOString().split("T")[0];

  const userPrompt = buildMacroAnalysisUserPrompt(todayStr, todayNewsText);

  try {
    const rawJson = await callGemini(userPrompt, MACRO_ANALYSIS_SYSTEM_PROMPT, {
      responseMimeType: "application/json",
      responseSchema: MACRO_ANALYSIS_SCHEMA,
      temperature: 0.2, // 降低隨機性，讓評分更客觀
    });

    const result = JSON.parse(rawJson);
    SaveTmpFile(
      {
        systemPrompt: MACRO_ANALYSIS_SYSTEM_PROMPT,
        userPrompt,
        schema: MACRO_ANALYSIS_SCHEMA,
        rawResult: result,
      },
      "MacroAnalysis",
      `MacroAnalysis_${todayStr}`,
    );
    return result;
  } catch (error) {
    console.warn("宏觀新聞分析失敗，回傳空陣列");
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
