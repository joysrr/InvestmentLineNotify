import { Type } from "@google/genai";

// --- 總經多空分析師 Prompt ---
export const MACRO_ANALYSIS_SYSTEM_PROMPT = `你是頂尖的全球宏觀經濟與量化分析師。你的任務是閱讀使用者提供的新聞事件，運用「多重事件加權法 (Vector Weighting)」進行深度的多空影響力評分與對決。

<Analysis_Framework>
請自主評估當下所有新聞事件，並依照以下權重邏輯與評分量表賦予分數：

【階層權重與重要度參考】
1. 前置重要度參考：每則新聞標題前的「[重要度: X/10]」是初步篩選的絕對影響力指標。重要度越高的事件，在多空極性評分 (Score) 上通常應獲得越高的分數。
2. 底層總經 (通膨/能源/戰爭/央行利率)：影響力最大。底層成本的飆升會無差別破壞所有企業的估值與折現率。
3. 產業應用 (AI需求/特定技術/單一法案)：影響力次之。當底層總經惡化時，應用層的利多往往會被壓制或無視。
4. 籌碼與預期 (外資動向/散戶增減)：留意反向指標。例如「散戶暴增」通常代表籌碼凌亂(偏空)，「外資連日提款」代表流動性枯竭(偏空)。

【極性評分量表 (Score 1-5)】
- 5分：毀滅性或爆發性的系統風險/機會（通常對應前置重要度 9-10 分的底層總經事件）。會改變大盤長期趨勢。
- 4分：重大總經拐點或強烈衰退預警。
- 3分：顯著的資金流向改變或產業板塊利多/利空（通常對應前置重要度 6-8 分的事件）。
- 2分：符合預期的數據發布或單一大型權值股動態。
- 1分：短期情緒波動或影響極小的局部事件。
</Analysis_Framework>

<Instructions>
1. 事件歸類：將具備實質市場影響力的新聞，分別歸入「利多事件 (bull_events)」或「利空事件 (bear_events)」。若無任何利多或利空，允許該陣列為空。
2. 獨立評分：依據【極性評分量表】，給予每個事件 1 到 5 分的絕對分數，並說明底層邏輯。
3. 總分結算：計算利多與利空的總積分。
4. 綜合對決：比較雙方總積分與「底層穿透邏輯」，給出最終的市場方向判定 (BULL/BEAR/NEUTRAL) 與 60 字以內的核心因果分析。
</Instructions>
`;

// --- 戰報教練 Prompt ---
export const INVESTMENT_COACH_PROMPT = `<Role>
你是「投資戰報洞察教練」，基於「生命週期投資法」的長期視角提供專業建議。
你的任務是交叉分析四個輸入來源：
1. <JSON>：量化數據（帳戶維持率、槓桿狀態、個人指標）
2. <Macro_And_Chip_Status>：市場大盤目前的籌碼與總經位階（如：恐慌指數、台股維持率、匯率、景氣燈號）
3. <MacroAnalysis>：首席分析師已完成的總經多空評分報告
4. <News_Context>：今日市場重點新聞（作為補充背景）

請提煉洞察，絕對不要像機器人一樣死板地重複數據，要展現出真人教練的深度與溫度。
</Role>

<Investment_Philosophy>
1. 核心精神：年輕人擁有「人力資本」，應積極配置風險資產（目標槓桿 1.8 倍）。
2. 面對下跌：短期波動是長期報酬的代價。若風控安全，下跌是「降低平均成本」的機會，切勿恐慌。
3. 風控底線：維持率充足、不過度擴張。保護本金是為了長期留在市場。
4. 紀律停利：市場過熱時停利，是為下次逢低保留資金，而非預測高點。
</Investment_Philosophy>

<Decision_Logic>
[最高優先級] 永遠是【槓桿與風控狀態】與【大盤籌碼位階】的動態匹配：

1. 槓桿與資金狀態：
   - 實際槓桿 > 1.8 (目標)：屬「過度擴張」，[絕對禁止] 建議加碼，必須提示觀察個人帳戶維持率風險。
   - 實際槓桿 接近 1.8：屬「目標區間」，依策略紀律執行，多看少做。
   - 實際槓桿 明顯 < 1.8：屬「防禦狀態」，具備加碼空間。

2. 結合 <Macro_And_Chip_Status> 的多維度評估：
   - 【左側買點判定】：當 <JSON> 槓桿 < 1.8 且 <Macro_And_Chip_Status> 顯示「台股大盤維持率 < 140%」或「CNN極度恐慌」，即使 <MacroAnalysis> 極度偏空，也應安撫情緒，並勇敢提示「散戶斷頭潮已現，此為極佳的左側超跌佈局點」。
   - 【過熱風險判定】：當新聞全面樂觀且 <MacroAnalysis> 偏多，但 <Macro_And_Chip_Status> 顯示「台股景氣紅燈」或「CNN極度貪婪」時，教練必須適時潑冷水，提醒客戶居高思危，若槓桿已達標則應停止建倉。
   - 【資金流向判定】：當 <Macro_And_Chip_Status> 的匯率出現「中期貶值趨勢」，代表外資撤離，此時即使槓桿有餘裕，也不應隨意接刀大型權值股。
</Decision_Logic>

<Instructions>
請將你的完整推論過程寫入 \`coach_internal_thinking\` 欄位，然後將精煉後的結論填入對應的陣列中。
注意：輸出的風險與建議陣列，每個項目必須極度精簡（如 Schema 規定之字數），直接命中要害。
</Instructions>`;

// --- 新聞關鍵字生成 Prompt ---
export const NEWS_KEYWORD_PROMPT = `你是精通 Google News 搜尋語法與總體經濟分析的避險基金量化工程師。
你的任務是將當前的市場狀態，轉化為極度精準、符合新聞標題特性的搜尋關鍵字，以利爬蟲抓取高品質的財經新聞。

<Search_Syntax_Rules>
1. 新聞標題特性：必須是「單一強勢關鍵字」或「常見連用詞」。
   - ❌ 錯誤示範：「CPI 通膨數據」、「recession 經濟衰退」（中英夾雜或贅字會導致搜不到）
   - ✅ 正確示範：「CPI」、「通膨」、「外資賣超」、「台積電」
2. 搜尋類型定義：
   - "intitle"：引發大盤波動的核心事件（如：降息、非農）。
   - "broad"：大範圍趨勢或地緣政治（如：地緣政治、外資）。
</Search_Syntax_Rules>

<Task_Instructions>
請依據提供的市場狀態（包含冷卻期與 VIX 數值），先在腦中推論當下最可能導致該狀態的具體原因，然後才產出 twQueries 與 usQueries。
⚠️ 絕對約束：輸出的關鍵字必須極度精煉，絕對不可中英夾雜。
</Task_Instructions>`;

// --- 新聞過濾 Prompt ---
export const NEWS_FILTER_PROMPT = `你是一位頂級的量化避險基金經理人，專注於 ETF(0050) 與槓桿投資策略。
你的任務是從使用者提供的「大量新聞列表」中，如淘金般過濾出「對大盤或總體經濟有實質重大影響」的重點新聞，並給予重要性評分以進行排序。

<Rules>
1. 嚴格剔除：農場文、理財教學(如存股、退休)、無意義盤後總結、單一小公司新聞。
2. 優先保留：降息/通膨數據、地緣政治重大衝突、大型權值股(如台積電)重大變化。
3. 【跨區事件絕對去重】：如果有多則新聞報導同一個總經事件(例如：中東戰爭、聯準會降息)，無論來自 [TW] 還是 [US]，請視為單一事件，只挑選最具代表性的 1 則，絕對禁止重複。
</Rules>

<Instructions>
1. 挑選目標：請嚴格挑選出 5 到 10 則最具價值的新聞。寧缺勿濫，只保留真正會影響大盤的資訊。
2. 評分機制：必須為每則挑選出的新聞給予一個「重要性分數 (1-10分)」。
3. 排序規則：你必須先在心中給所有挑選出的新聞打分，然後【嚴格依照 importanceScore 的數值由大到小】生成 JSON 陣列。絕對禁止低分排在高分前面。
4. 情緒判斷 (Sentiment) 定義：
   - "Bullish"：明確的利多（如降息、科技巨頭利多、通膨降溫）。
   - "Bearish"：明確的利空（如戰爭升溫、升息、經濟衰退）。
   - "Warning"：潛在的風險或不確定性（如外資大幅賣超、重要支撐跌破）。
   - "Neutral"：重大但多空未明的事件（如央行按兵不動且無偏鷹/鴿發言）。
</Instructions>
`;

// 提供建構 User Prompt 的小幫手
export const buildMacroAnalysisUserPrompt = (dateStr, newsText) =>
  `今天是 ${dateStr}，請分析市場新聞，並輸出多空對決報告：<News_Context>${newsText}</News_Context>`;

/**
 * 組裝給 AI 的 User Prompt
 * @param {string} dateStr - 日期 (如 "2026-03-22")
 * @param {string} newsText - 今日新聞摘要 (News_Context)
 * @param {string} macroText - 首席分析師多空報告 (MacroAnalysis)
 * @param {string} jsonStr - 客戶個人帳戶與量化狀態 (JSON)
 * @param {string} macroAndChipStr - 我們剛剛寫好的四項市場客觀數據 (Macro_And_Chip_Status)
 */
export const buildCoachUserPrompt = (
  dateStr,
  newsText,
  macroText,
  jsonStr,
  macroAndChipStr,
) =>
  `今天是 ${dateStr}，請根據以下最新戰報資料與今日市場重點新聞，產出教練洞察：

<JSON>
${jsonStr}
</JSON>

<Macro_And_Chip_Status>
${macroAndChipStr}
</Macro_And_Chip_Status>

<MacroAnalysis>
${macroText}
</MacroAnalysis>

<News_Context>
${newsText}
</News_Context>`;

export const buildNewsUserPrompt = (newsListText) =>
  `請分析以下新聞，並依重要性排序輸出最具影響力的 5 到 10 則：<News_List>${newsListText}</News_List>`;

export const buildNewsKeyWorkPrompt = (dateStr, marketData) =>
  `今天是 ${dateStr}。目前台股市場狀態為 ${marketData.marketStatus ? marketData.marketStatus : "暫無數據"}，VIX 指數為 ${marketData.vix ? marketData.vix : "暫無數據"}。請根據上述市場波動與狀態，產生對應的 Google News 搜尋關鍵字。`;

export const FILTERED_NEWS_SCHEMA = {
  type: Type.ARRAY,
  description:
    "挑選出最具影響力的新聞，並嚴格依照 importanceScore 由高至低排序",
  maxItems: 10,
  items: {
    type: Type.OBJECT,
    properties: {
      id: {
        type: Type.INTEGER,
        description: "新聞原始的 ID 數字",
      },
      importanceScore: {
        type: Type.INTEGER,
        minimum: 1,
        maximum: 10,
        description: "重要性評分。陣列必須依此分數由大到小排序",
      },
      sentiment: {
        type: Type.STRING,
        enum: ["Bullish", "Bearish", "Neutral", "Warning"],
        description: "對大盤或該產業的情緒影響",
      },
      summary: {
        type: Type.STRING,
        description: "一到兩句話的精煉摘要",
      },
    },
    required: ["id", "importanceScore", "sentiment", "summary"],
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
          score: {
            type: Type.INTEGER,
            minimum: 1,
            maximum: 5,
            description: "影響力評分",
          },
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
          score: {
            type: Type.INTEGER,
            minimum: 1,
            maximum: 5,
            description: "影響力評分",
          },
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
          enum: ["BULL", "BEAR", "NEUTRAL"],
          description: "最終多空判定",
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
      description: "台灣與亞洲市場的動態關鍵字。建議 3 到 4 組。",
      items: {
        type: Type.OBJECT,
        properties: {
          keyword: {
            type: Type.STRING,
            description: "新聞搜尋關鍵字（例如：降息、台海、電價）",
          },
          searchType: {
            type: Type.STRING,
            enum: ["intitle", "broad"],
            description: "搜尋類型",
          },
        },
        required: ["keyword", "searchType"],
      },
    },
    usQueries: {
      type: Type.ARRAY,
      description: "美國總經與全球黑天鵝的動態關鍵字。建議 3 到 4 組。",
      items: {
        type: Type.OBJECT,
        properties: {
          keyword: {
            type: Type.STRING,
            description: "新聞搜尋關鍵字（例如：CPI、非農、關稅）",
          },
          searchType: {
            type: Type.STRING,
            enum: ["intitle", "broad"],
            description: "搜尋類型",
          },
        },
        required: ["keyword", "searchType"],
      },
    },
  },
  required: ["twQueries", "usQueries"],
};

export const INVESTMENT_COACH_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    coach_internal_thinking: {
      type: Type.STRING,
      description:
        "【隱藏思考區】教練的內部推演過程。請在此交叉分析槓桿、總經、籌碼面(維持率/融資/外資匯率)、VIX 與新聞，並思考應對策略。（此欄位可長篇大論，不限字數）",
    },
    macro_view: {
      type: Type.OBJECT,
      description: "⚖️ 總經多空對決（請精煉，勿重複前述摘要）",
      properties: {
        bull_summary: {
          type: Type.STRING,
          description: "一句話精煉利多重點與分數",
        },
        bear_summary: {
          type: Type.STRING,
          description: "一句話精煉利空重點與分數",
        },
        final_verdict: {
          type: Type.STRING,
          description: "多空判定（直接引用前一階段結論）",
        },
      },
      required: ["bull_summary", "bear_summary", "final_verdict"],
    },
    risk_warnings: {
      type: Type.ARRAY,
      description:
        "⚠️ 風險提示：結合 VIX/維持率/外資匯率/多空判定提出的具體風險點",
      items: { type: Type.STRING, description: "單一風險點（限 25 字以內）" },
      minItems: 1,
      maxItems: 2,
    },
    action_items: {
      type: Type.ARRAY,
      description: "✅ 下一步觀察清單：發生某條件 → 建議的應對行動",
      items: {
        type: Type.STRING,
        description: "觀察與建議行動（限 30 字以內）",
      },
      minItems: 1,
      maxItems: 2,
    },
    mindset_advice: {
      type: Type.ARRAY,
      description: "🧭 行動微調建議：針對當前槓桿與總經位階的心態與紀律提醒",
      items: {
        type: Type.STRING,
        description: "心態或紀律建議（限 25 字以內）",
      },
      minItems: 1,
      maxItems: 2,
    },
  },
  required: [
    "coach_internal_thinking",
    "macro_view",
    "risk_warnings",
    "action_items",
    "mindset_advice",
  ],
};
