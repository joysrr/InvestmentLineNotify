import { Type, ThinkingLevel } from "@google/genai";
import { callGemini } from "./aiClient.mjs";
import { minifyExplainInput } from "./aiDataPreprocessor.mjs";
import {
  INVESTMENT_COACH_PROMPT,
  NEWS_FILTER_PROMPT,
  buildCoachUserPrompt,
  buildNewsUserPrompt,
  buildNewsKeyWorkPrompt,
} from "./prompts.mjs";
import { SaveTmpFile } from "../../utils/debugUtils.mjs";

export async function getAiInvestmentAdvice(
  marketData,
  portfolio,
  vixData,
  newsSummaryText,
  onlyPrompt,
) {
  if (onlyPrompt) return "AI 決策引擎停止運作中。";

  const cleanData = minifyExplainInput(marketData, portfolio, vixData);
  const jsonStr = JSON.stringify(cleanData);
  const todayStr = new Date().toISOString().split("T")[0];

  const userPrompt = buildCoachUserPrompt(todayStr, newsSummaryText, jsonStr);

  SaveTmpFile(
    { systemPrompt: INVESTMENT_COACH_PROMPT, userPrompt },
    "Prompt",
    "prompt",
  );

  try {
    return await callGemini(userPrompt, INVESTMENT_COACH_PROMPT, {
      temperature: 0.1,
      maxOutputTokens: 65536,
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
    });
  } catch (error) {
    return "AI 決策引擎暫時無法運作，請依原始數據判斷。";
  }
}

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
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.INTEGER },
            sentiment: { type: Type.STRING },
            summary: { type: Type.STRING },
          },
          required: ["id", "sentiment", "summary"],
        },
      },
    });

    const aiResult = JSON.parse(rawJsonText);
    return aiResult.map((aiItem) => ({
      ...allNewsArray[aiItem.id],
      sentiment: aiItem.sentiment,
      aiSummary: aiItem.summary,
    }));
  } catch (error) {
    console.error("AI 處理新聞時發生錯誤:", error);
    return [];
  }
}

export async function generateDailySearchQueries(marketData) {
  const todayStr = new Date().toISOString().split("T")[0];

  const prompt = buildNewsKeyWorkPrompt(todayStr, marketData);

  const schema = {
    type: Type.OBJECT,
    properties: {
      twQueries: {
        type: Type.ARRAY,
        description: "台灣與亞洲市場的動態關鍵字",
        items: {
          type: Type.OBJECT,
          properties: {
            keyword: {
              type: Type.STRING,
              description: "例如: 降息、台海、電價",
            },
            searchType: { type: Type.STRING, enum: ["intitle", "broad"] },
          },
          required: ["keyword", "searchType"],
        },
      },
      usQueries: {
        type: Type.ARRAY,
        description: "美國總經與全球黑天鵝的動態關鍵字",
        items: {
          type: Type.OBJECT,
          properties: {
            keyword: {
              type: Type.STRING,
              description: "例如: CPI、tariffs、recession",
            },
            searchType: { type: Type.STRING, enum: ["intitle", "broad"] },
          },
          required: ["keyword", "searchType"],
        },
      },
    },
    required: ["twQueries", "usQueries"],
  };

  try {
    const rawJson = await callGemini(prompt, "你是一個搜尋引擎專家", {
      responseMimeType: "application/json",
      responseSchema: schema,
    });

    return JSON.parse(rawJson); // { twQueries: [{keyword: "...", searchType: "..."}], usQueries: [...] }
  } catch (error) {
    console.warn("動態產生關鍵字失敗，回傳空陣列");
    return { twQueries: [], usQueries: [] };
  }
}
