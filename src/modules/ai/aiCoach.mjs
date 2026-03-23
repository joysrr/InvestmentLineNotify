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
  INVESTMENT_COACH_SCHEMA,
} from "./prompts.mjs";

import { archiveManager } from "../data/archiveManager.mjs";

// 這個函式會根據當前的市場數據、新聞摘要，以及既定的投資策略，產出具體的操作建議與風險提示
export async function getAiInvestmentAdvice(
  marketData,
  portfolio,
  vixData,
  newsSummaryText,
  macroTextForCoach,
  macroAndChipStr,
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
    macroAndChipStr,
  );

  try {
    const result = await callGemini(userPrompt, INVESTMENT_COACH_PROMPT, {
      responseMimeType: "application/json",
      responseSchema: INVESTMENT_COACH_SCHEMA,
      temperature: 0.5, // 適度增加隨機性，讓建議更具多樣性與啟發性
      maxOutputTokens: 65536,
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
    });

    // 1. 確保 result 是可操作的 JSON 物件 (防呆)
    let adviceObj;
    if (typeof result === "string") {
      adviceObj = JSON.parse(result);
    } else {
      adviceObj = result;
    }

    // 2. 📝 寫入 AI 飛行紀錄器 (不阻擋主程式)
    archiveManager
      .saveAiLog({
        type: "InvestmentAdvice",
        systemPrompt: INVESTMENT_COACH_PROMPT,
        userPrompt,
        schema: INVESTMENT_COACH_SCHEMA,
        rawResult: adviceObj,
      })
      .catch((err) =>
        console.warn("⚠️ [Archive] 儲存 AI 決策紀錄失敗:", err.message),
      );

    // 3. 組合最終要推播給使用者的 Markdown 戰報文字 (UI 呈現層)
    const finalAdviceText = `**⚖️ 總經多空對決**
- 利多：${adviceObj.macro_view?.bull_summary || "無"}
- 利空：${adviceObj.macro_view?.bear_summary || "無"}
- 判定：${adviceObj.macro_view?.final_verdict || "NEUTRAL"}

**⚠️ 風險提示**
${(adviceObj.risk_warnings || []).map((w) => `- ${w}`).join("\n")}

**✅ 下一步觀察清單**
${(adviceObj.action_items || []).map((a) => `- ${a}`).join("\n")}

**🧭 行動微調建議**
${(adviceObj.mindset_advice || []).map((m) => `- ${m}`).join("\n")}`;

    // 4. 回傳乾淨、排版絕對受控的字串
    return {
      finalAdviceText: finalAdviceText.trim(),
      internalThinking: adviceObj.coach_internal_thinking || "",
    };
  } catch (error) {
    console.error("AI 決策引擎處理失敗:", error.message);
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
      temperature: 0.1, // 降低隨機性，讓分類更穩定
    });

    const aiResult = JSON.parse(rawJsonText);
    const result = aiResult.map((aiItem) => ({
      ...allNewsArray[aiItem.id],
      sentiment: aiItem.sentiment,
      summary: aiItem.summary,
      importanceScore: aiItem.importanceScore,
    }));

    // 📝 寫入 AI 飛行紀錄器
    archiveManager
      .saveAiLog({
        type: "NewsFilter",
        systemPrompt: NEWS_FILTER_PROMPT,
        userPrompt,
        schema: FILTERED_NEWS_SCHEMA,
        rawResult: aiResult,
      })
      .catch((err) =>
        console.warn("⚠️ [Archive] 儲存新聞過濾紀錄失敗:", err.message),
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
      temperature: 0.3, // 適度增加隨機性，讓關鍵字更具多樣性
    });

    const result = JSON.parse(rawJson); // { twQueries: [{keyword: "...", searchType: "..."}], usQueries: [...] }

    // 📝 寫入 AI 飛行紀錄器
    archiveManager
      .saveAiLog({
        type: "SearchQueries",
        systemPrompt: NEWS_KEYWORD_PROMPT,
        userPrompt: prompt,
        schema: NEWS_KEYWORD_SCHEMA,
        rawResult: result,
      })
      .catch((err) =>
        console.warn("⚠️ [Archive] 儲存關鍵字生成紀錄失敗:", err.message),
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

    // 📝 寫入 AI 飛行紀錄器
    archiveManager
      .saveAiLog({
        type: "MacroAnalysis",
        systemPrompt: MACRO_ANALYSIS_SYSTEM_PROMPT,
        userPrompt,
        schema: MACRO_ANALYSIS_SCHEMA,
        rawResult: result,
      })
      .catch((err) =>
        console.warn("⚠️ [Archive] 儲存總經分析紀錄失敗:", err.message),
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
