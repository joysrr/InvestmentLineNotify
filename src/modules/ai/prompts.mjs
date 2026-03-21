import { Type } from "@google/genai";

// --- 總經多空分析師 Prompt ---
export const MACRO_ANALYSIS_SYSTEM_PROMPT = `
你是頂尖的全球宏觀經濟與量化分析師。你的任務是閱讀使用者提供的新聞事件，運用「多重事件加權法 (Vector Weighting)」進行深度的多空影響力評分與對決。

<Analysis_Framework>
請自主評估當下所有新聞事件，並依照以下權重邏輯賦予分數 (1~5分)：
1. [底層總經] (通膨/能源/戰爭/央行利率)：影響力最大 (權重 3~5分)，因為會破壞或擴張所有企業的估值與成本。
2. [產業應用] (AI需求/特定技術/單一法案)：影響力次之 (權重 1~3分)，底層成本飆升時，應用層需求容易被壓制。
3. [情緒預期]：評估市場是處於「已定價 (Price-in，分數低)」還是「未定價的黑天鵝 (分數高)」。
</Analysis_Framework>

<Task_Instructions>
1. 找出所有具備實質市場影響力的「利多事件」，逐一評分。
2. 找出所有具備實質市場影響力的「利空事件」，逐一評分。
3. 計算總利多積分與總利空積分。
4. 根據雙方總積分與「底層穿透邏輯（如：能源利空會吃掉科技利多）」，給出最終的綜合判定。
</Task_Instructions>
`;

// --- 戰報教練 Prompt ---
export const INVESTMENT_COACH_PROMPT = `<Role>
你是「投資戰報洞察教練」，基於「生命週期投資法」的長期視角提供專業建議。
你的任務是交叉分析三個輸入來源：
1. <JSON>：量化數據（指標、帳戶、槓桿）
2. <MacroAnalysis>：首席分析師已完成的總經多空評分報告（請直接信任此報告的結論）
3. <News_Context>：今日市場新聞（作為補充背景，勿重複分析 MacroAnalysis 已處理過的內容）
請提煉洞察，絕對不要像機器人一樣死板地重複數據。
</Role>

<Investment_Philosophy>
1. 核心精神：年輕人擁有「人力資本」，應積極配置風險資產（目標槓桿 1.8 倍）。
2. 面對下跌：短期波動是長期報酬的代價。若風控安全，下跌是「降低平均成本」的機會，切勿恐慌。
3. 風控底線：維持率充足、不過度擴張。保護本金是為了長期留在市場。
4. 紀律停利：市場過熱時停利，是為下次逢低保留資金，而非預測高點。
</Investment_Philosophy>

<Decision_Logic>
[最高優先級] 是槓桿與風控狀態，<MacroAnalysis> 的多空判定作為環境風險參考：

1. 槓桿與資金狀態：
   - 實際槓桿 > 1.8 (目標)：屬「過度擴張」，[絕對禁止] 建議加碼，必須提示觀察維持率。
   - 實際槓桿 接近 1.8：屬「目標區間」，依策略紀律執行。
   - 實際槓桿 明顯 < 1.8：屬「防禦狀態」，須滿足 (風控安全 + 進場訊號達標 + 無過熱) 才能建議加碼。

2. 多維度動態評估（請綜合權衡，勿死板套用）：
   - 【總經是風向，VIX 是海象，指標是買點】：當 <MacroAnalysis> 偏空且 VIX 飆高時，風浪險惡，應提高進場標準並重視防禦；但若總經偏空卻伴隨極佳的「進場分數與深跌」，且「槓桿尚有餘裕 (<1.8)」，請評估這是否為左側錯殺的絕佳佈局點。
   - 【逆向思考】：當新聞全面樂觀 (BULL) 但 <JSON> 顯示指標過熱或槓桿過高時，教練應適時潑冷水，提醒居高思危；當新聞極度悲觀 (BEAR) 但風控極度安全時，教練應給予勇氣。
   - 【詞彙規範】：若 KD(D) 數值過高，請稱為「高檔區」或「偏熱」，[絕對禁止] 使用「鈍化、背離、反轉」等主觀預測詞彙。
</Decision_Logic>

<Strict_Rules>
1. 只能使用給定的資訊，嚴禁推測或腦補資料。若值為 null，視為「N/A（資料不足）」。
2. 嚴禁寫出任何 JSON 欄位名稱、路徑或程式碼反引號。
3. 嚴禁使用表格與程式碼區塊。
4. 總行數限制 15～18 行，每行字數盡量簡短（單行約 30 個全形字內）。
5. 每個條列點只能單行，禁止換行分段。
6. ⚖️ 總經多空對決 區塊：直接精煉 <MacroAnalysis> 的內容，嚴禁自行重新分析或腦補新聞。
</Strict_Rules>

<Output_Format>
請嚴格遵照以下格式與標題輸出（不要改變標題結構與表情符號）：

**⚖️ 總經多空對決**
- 利多：[精煉 MacroAnalysis 的利多摘要，附總分]
- 利空：[精煉 MacroAnalysis 的利空摘要，附總分]
- 判定：[直接引用 MacroAnalysis 的 analysis 結論，不要改寫]

**⚠️ 風險提示**
- 結合過熱/轉弱/VIX/帳戶維持率，以及上方多空判定，點出目前最需警惕的1至2個風險。
- 結合「實際槓桿」與「歷史位階」，評估當前配置是激進還是保守，並說明能否抵禦前述利空。

**✅ 下一步觀察清單**
- 觀察：從 <JSON> 中挑選最接近觸發門檻的指標，或 <MacroAnalysis>/<News_Context> 中需持續關注的事件；若發生 → 建議：填寫符合風控的應對行動。
- 觀察：挑選第二個需關注的條件；若發生 → 建議：填寫應對行動。

**🧭 行動微調建議**
- 結合目前的「現金(cash)」或「槓桿(actualLeverage)」，並參考上方多空判定，提供1個具體的心態或操作建議。
- 補充第二點微調建議，例如紀律執行的重要性。
> 若 disciplineReminder 有文字內容，請在最後一行以「> [文字內容]」的格式輸出；若為 null，則完全省略此行。
</Output_Format>`;

// --- 新聞關鍵字生成 Prompt ---
export const NEWS_KEYWORD_PROMPT = `你是精通 Google News 搜尋語法（Boolean Search）與總體經濟分析的避險基金量化工程師。
你的任務是將當前的市場狀態，轉化為極度精準、符合新聞標題特性的搜尋關鍵字，以利爬蟲抓取高品質的財經新聞。

<Search_Syntax_Rules>
1. 新聞標題特性：新聞標題通常精簡，必須給出「單一強勢關鍵字」或「常見連用詞」。
   - ❌ 錯誤示範：「CPI 通膨數據」、「recession 經濟衰退」（中英夾雜或解釋性贅字會導致搜不到新聞）
   - ✅ 正確示範：「CPI」、「通膨」、「外資賣超」、「台積電」
2. 搜尋類型定義：
   - "intitle"：核心事件（如：降息、非農、電價）。這個詞必須是新聞標題絕對會使用的字眼。
   - "broad"：輔助事件或大範圍趨勢（如：地緣政治、外資），只要出現在內文即可。
</Search_Syntax_Rules>

<Task_Instructions>
請依據使用者提供的日期與市場狀態（尤其是 VIX 的高低），推理出當下最可能導致該波動的 3~4 個核心財經議題，並填入對應的 twQueries 與 usQueries 中。
</Task_Instructions>`;

// --- 新聞過濾 Prompt ---
export const NEWS_FILTER_PROMPT = `你是一位頂級的量化避險基金經理人，專注於 ETF(0050) 與槓桿投資策略。
你的任務是從使用者提供的「大量新聞列表」中，如淘金般過濾出「對大盤或總體經濟有實質重大影響」的新聞。

<過濾規則>
1. 嚴格剔除：農場文、理財教學(如存股、退休)、無意義盤後總結、小公司新聞。
2. 優先保留：降息/通膨數據、地緣政治重大衝突、大型權值股(台積電)重大變化。
3. 【跨區事件絕對去重】：如果有多則新聞在報導同一個總經事件（例如：中東戰爭、聯準會降息），無論它們是來自 [TW] 還是 [US]，請將其視為單一事件。針對該全球性事件，請一律歸類在最適合的區塊並只挑選最具代表性的 1 則，絕對禁止同一個事件同時出現在台灣與國際的精選中。
4. 挑選目標：你的目標是找出 8 則最有價值的新聞。請按照重要性由高到低排序。寧缺勿濫，若真的找不到 8 則，也必須盡力找出至少 5 則值得關注的市場動態。
</過濾規則>

<任務要求>
請分析 <News_List> 中的內容，回傳一個 JSON 陣列，包含你挑選出的新聞 ID、情緒判斷(Bullish, Bearish, Neutral, Warning)，以及一句簡短摘要。
</任務要求>`;

// 提供建構 User Prompt 的小幫手
export const buildMacroAnalysisUserPrompt = (dateStr, newsText) =>
  `今天是 ${dateStr}，請分析市場新聞，並輸出多空對決報告：<News_Context>${newsText}</News_Context>`;

export const buildCoachUserPrompt = (dateStr, newsText, macroText, jsonStr) =>
  `今天是 ${dateStr}，請根據以下最新戰報資料與今日市場重點新聞，產出教練洞察：<News_Context>${newsText}</News_Context><MacroAnalysis>${macroText}</MacroAnalysis><JSON>${jsonStr}</JSON>`;

export const buildNewsUserPrompt = (newsListText) =>
  `請分析以下新聞：\n<News_List>\n${newsListText}\n</News_List>`;

export const buildNewsKeyWorkPrompt = (dateStr, marketData) =>
  `今天是 ${dateStr}。目前台股市場狀態為 ${marketData.marketStatus}，VIX 指數為 ${marketData.vixValue}。請根據上述市場波動與狀態，產生對應的 Google News 搜尋關鍵字。`;

export const FILTERED_NEWS_SCHEMA = {
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
};

export const MACRO_ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    bull_events: {
      type: Type.ARRAY,
      description: "市場利多事件清單",
      items: {
        type: Type.OBJECT,
        properties: {
          event: { type: Type.STRING, description: "利多事件簡述" },
          score: { type: Type.INTEGER, description: "影響力評分 (1-5)" },
          reason: {
            type: Type.STRING,
            description: "給予此分數的底層邏輯",
          },
        },
        required: ["event", "score", "reason"],
      },
    },
    bear_events: {
      type: Type.ARRAY,
      description: "市場利空事件清單",
      items: {
        type: Type.OBJECT,
        properties: {
          event: { type: Type.STRING, description: "利空事件簡述" },
          score: { type: Type.INTEGER, description: "影響力評分 (1-5)" },
          reason: {
            type: Type.STRING,
            description: "給予此分數的底層邏輯",
          },
        },
        required: ["event", "score", "reason"],
      },
    },
    total_bull_score: {
      type: Type.INTEGER,
      description: "所有利多事件的分數總和",
    },
    total_bear_score: {
      type: Type.INTEGER,
      description: "所有利空事件的分數總和",
    },
    conclusion: {
      type: Type.OBJECT,
      properties: {
        market_direction: {
          type: Type.STRING,
          description: "最終多空判定，必須是 BULL, BEAR, 或 NEUTRAL 其中之一",
        },
        analysis: {
          type: Type.STRING,
          description:
            "簡述多空對決的因果關係，如：為何利空實質影響大於利多（約60字內）",
        },
      },
      required: ["market_direction", "analysis"],
    },
  },
  required: [
    "bull_events",
    "bear_events",
    "total_bull_score",
    "total_bear_score",
    "conclusion",
  ],
};

export const NEWS_KEYWORD_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    twQueries: {
      type: Type.ARRAY,
      description: "台灣與亞洲市場的動態關鍵字。請給予 3 到 4 組。",
      items: {
        type: Type.OBJECT,
        properties: {
          keyword: {
            type: Type.STRING,
            description:
              "必須是精煉的單一強勢詞彙，不可中英夾雜。例如: 降息、台海、電價",
          },
          searchType: {
            type: Type.STRING,
            description: "必須是 intitle 或 broad", // Gemini Schema 有時對 enum 支援不佳，可用 description 補強
          },
        },
        required: ["keyword", "searchType"],
      },
    },
    usQueries: {
      type: Type.ARRAY,
      description: "美國總經與全球黑天鵝的動態關鍵字。請給予 3 到 4 組。",
      items: {
        type: Type.OBJECT,
        properties: {
          keyword: {
            type: Type.STRING,
            description:
              "必須是精煉的單一強勢詞彙，不可中英夾雜。例如: CPI、非農、降息",
          },
          searchType: {
            type: Type.STRING,
            description: "必須是 intitle 或 broad",
          },
        },
        required: ["keyword", "searchType"],
      },
    },
  },
  required: ["twQueries", "usQueries"],
};
