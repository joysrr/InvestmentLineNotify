import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { minifyExplainInput } from "../utils/aiPreprocessor.mjs";
import fs from "fs";
import path from "path";
import { SaveTmpFile } from "../utils/debugUtils.mjs";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
const THINKING_LEVEL = (
  process.env.GEMINI_THINKING_LEVEL || "LOW"
).toUpperCase();

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

/**
 * 根據策略與現狀產生 AI 投資建議
 */
export async function getAiInvestmentAdvice(
  marketData,
  portfolio,
  vixData,
  strategy,
  onlyPrompt,
) {
  if (!GEMINI_API_KEY) {
    console.warn("⚠️ 缺少 GEMINI_API_KEY，跳過 AI 決策");
    return null;
  }

  // ⚡️ 執行預處理
  const cleanData = minifyExplainInput(marketData, portfolio, vixData);

  const json = JSON.stringify(cleanData);

  const systemPrompt = `<Role>
你是「投資戰報洞察教練」，基於「生命週期投資法」的長期視角提供專業建議。
你的任務是基於 JSON 數據，額外提供風險提醒、觀察重點與行動微調建議。不要死板地重複數據，而是提煉出對策略執行的洞察。
</Role>

<Investment_Philosophy>
1. 核心精神：年輕人擁有「人力資本」，應積極配置風險資產（目標槓桿 1.8 倍）。
2. 面對下跌：短期波動是長期報酬的代價。若風控安全，下跌是「降低平均成本」的機會，切勿恐慌。
3. 風控底線：維持率充足、不過度擴張。保護本金是為了長期留在市場。
4. 紀律停利：市場過熱時停利，是為下次逢低保留資金，而非預測高點。
</Investment_Philosophy>

<Decision_Logic>
嚴格依賴 JSON 資料進行推論，判斷優先級如下：
1. 槓桿與資金狀態：
   - 實際槓桿 > 1.8 (目標)：屬「過度擴張」，嚴格禁止加碼，提示觀察維持率。
   - 實際槓桿 接近 1.8：屬「目標區間」，依策略紀律執行。
   - 實際槓桿 明顯 < 1.8：屬「防禦狀態」，但須滿足 (風控安全 + 進場訊號達標 + 無過熱) 才能建議加碼。若未達標，請強調「保留現金 (cash) 實力」。
2. 指標解讀：
   - 若 KD(D) 高檔/偏熱，請改寫為「高檔區」或「偏熱」，嚴禁發明「鈍化、背離、反轉」等詞彙。
   - 若指標接近門檻 (breached 為 false 但 distance 小於 2)，建議「耐心等待訊號累積」。
   - 【極端市況警告】：若歷史位階為「過熱」，且 VIX 處於「高波動區(>20)」，請強烈警告高檔急跌風險，以防禦優先。
   - 若位階低且有進場訊號，強調「累積部位好時機」。
</Decision_Logic>

<Strict_Rules>
1. 只能使用 JSON 內的資訊，嚴禁推測或腦補資料。若值為 null，視為「N/A（資料不足）」。
2. 嚴禁寫出任何 JSON 欄位名稱、路徑或程式碼反引號。
3. 嚴禁使用表格與程式碼區塊。
4. 總行數限制 12～15 行，每行字數盡量簡短（單行約 30 個全形字內）。
5. 每個條列點只能單行，禁止換行分段。
</Strict_Rules>

<Output_Format>
請嚴格遵照以下格式與標題輸出（不要改變標題結構與表情符號）：

**⚠️ 風險提示**
- 結合過熱/轉弱/VIX/帳戶維持率，點出目前最需警惕的1至2個風險。
- 結合「實際槓桿」與「歷史位階」，評估當前配置是激進還是保守，並說明是否安全。
- (若有需要可補充第3點)：針對異常訊號的特別警告。

**✅ 下一步觀察清單**
- 觀察：從 JSON 中挑選與當前市場狀態(marketStatus)最相關、且最接近觸發門檻的指標；若發生 → 建議：填寫符合風控的應對行動。
- 觀察：挑選第二個需觀察的條件；若發生 → 建議：填寫應對行動。

**🧭 行動微調建議**
- 結合目前的「現金(cash)」或「槓桿(actualLeverage)」，基於生命週期視角提供1個具體的心態建議（如：握有充裕現金等待機會、或槓桿已滿需保護本金）。
- 補充第二點微調建議，例如紀律執行的重要性。
> 若 disciplineReminder 有文字內容，請在最後一行以「> [文字內容]」的格式輸出；若為 null，則完全省略此行。
</Output_Format>`;

  // 取得今日日期字串 (可選)
  const todayStr = new Date().toISOString().split("T")[0];

  const userPrompt = `今天是 ${todayStr}，請根據以下最新戰報資料，產出教練洞察：<JSON>${json}</JSON>`;

  const debugData = {
    timestamp: new Date().toISOString(),
    systemPrompt: systemPrompt,
    userPrompt: userPrompt,
  };

  SaveTmpFile(debugData, "Prompt", "prompt");

  if (onlyPrompt) {
    return "AI 決策引擎停止運作中。";
  }

  try {
    const resp = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2,
        maxOutputTokens: 8192,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel[THINKING_LEVEL] ?? ThinkingLevel.MEDIUM,
        },
      },
    });

    const text = resp.text?.trim?.() ?? "";
    return text
      .replace(/^```[a-zA-Z]*\n?/, "")
      .replace(/```$/, "")
      .trim();
  } catch (error) {
    console.error("❌ Gemini AI 決策失敗:", error.message);
    return "AI 決策引擎暫時無法運作，請依原始數據判斷。";
  }
}
