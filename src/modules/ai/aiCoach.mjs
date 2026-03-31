import { callGemini } from "./aiClient.mjs";
import { formatQuantDataForCoach } from "./aiDataPreprocessor.mjs";
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

const sessionId = process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_WORKFLOW}-${process.env.GITHUB_RUN_ID}`
  : `local-${Date.now()}`;

// 這個函式會根據當前的市場數據，動態產生適合搜尋引擎使用的關鍵字
export async function generateDailySearchQueries(marketData) {
  const todayStr = new Date().toISOString().split("T")[0];
  const prompt = buildNewsKeyWorkPrompt(todayStr, marketData);

  try {
    const rawJson = await callGemini("GenerateSearchQueries", prompt, {
      sessionId,
      keyIndex: 0,
      responseSchema: NEWS_KEYWORD_SCHEMA,
    });

    const result = JSON.parse(rawJson); // { twQueries: [{keyword: "...", searchType: "..."}], usQueries: [...] }

    // 📝 寫入 AI 飛行紀錄器
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

    return result;
  } catch (error) {
    console.warn("動態產生關鍵字失敗，回傳空陣列");
    return { twQueries: [], usQueries: [] };
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
    const rawJsonText = await callGemini(
      "FilterAndCategorizeNews",
      userPrompt,
      {
        sessionId,
        keyIndex: 1,
        responseSchema: FILTERED_NEWS_SCHEMA,
      },
    );

    const aiResult = JSON.parse(rawJsonText);

    // 取出思考過程（可 log 供除錯）
    const thinkContent = aiResult.think;
    console.log("📊 事件盤點數:", thinkContent.event_inventory.length);
    console.log("📐 維度覆蓋:", thinkContent.dimension_check);
    console.log("🗑️ 捨棄筆數:", thinkContent.excluded.length);

    // 從 aiResult.news 取陣列（原本是 aiResult 直接是陣列）
    const result = aiResult.news.map((aiItem) => ({
      ...allNewsArray[aiItem.id],
      summary: aiItem.summary,
    }));

    // 📝 寫入 AI 飛行紀錄器
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

    return result;
  } catch (error) {
    console.error("AI 處理新聞時發生錯誤:", error);
    return [];
  }
}

// --- 宏觀分析 Prompt ---
export async function analyzeMacroNewsWithAI(todayNewsText) {
  const todayStr = new Date().toISOString().split("T")[0];
  const userPrompt = buildMacroAnalysisUserPrompt(todayStr, todayNewsText);

  try {
    const rawJson = await callGemini("AnalyzeMacroNews", userPrompt, {
      sessionId,
      keyIndex: 2,
      responseSchema: MACRO_ANALYSIS_SCHEMA,
    });

    const result = JSON.parse(rawJson);

    // 📝 寫入 AI 飛行紀錄器
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
    const result = await callGemini("InvestmentAdvice", userPrompt, {
      sessionId,
      keyIndex: 0,
      responseSchema: INVESTMENT_COACH_SCHEMA,
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
        userPrompt,
        schema: INVESTMENT_COACH_SCHEMA,
        rawResult: adviceObj,
      })
      .catch((err) =>
        console.warn("⚠️ [Archive] 儲存 AI 決策紀錄失敗:", err.message),
      );

    // 3. 組合最終要推播給使用者的 Markdown 戰報文字 (UI 呈現層)
    const finalAdviceText = `**⚠️ 風險提示**
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
