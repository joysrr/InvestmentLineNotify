import { Type } from "@google/genai";

/** 生成新聞關鍵字的 System Prompt */
export const NEWS_KEYWORD_PROMPT = `你是精通 Google News 搜尋語法與總體經濟分析的避險基金量化工程師。
你的任務是將當前的市場狀態，轉化為極度精準的搜尋關鍵字，以利爬蟲分別去「台灣新聞」與「華爾街新聞」抓取最高品質的情報。

<Search_Syntax_Rules>
1. 嚴格語系隔離 (極重要)：
   - twQueries 負責抓取台灣新聞：必須完全使用「繁體中文」（如：台積電、外資、通膨）。
   - usQueries 負責抓取華爾街新聞：必須完全使用「英文」（如：Nvidia、Fed rate cut、recession）。
   - ❌ 絕對禁止中英夾雜（例如：「CPI 通膨」或「Fed 降息」），否則會導致爬蟲失效。
2. 複合關鍵字防雜訊 (Anti-Noise)：
   - 避免只給單字（例如："recession"、"降息" 會搜出與財經無關的社會新聞）。
   - 請使用「主體 + 事件」的組合，以半形空格分隔（例如："Fed rate cut"、"US economy recession"、"外資 賣超"）。
3. 搜尋類型定義：
   - "intitle"：強制新聞標題必須包含該關鍵字，用於抓取核心事件（例如："Fed"、"CPI"）。
   - "broad"：全文搜尋，用於大範圍趨勢或地緣政治（例如："Middle East conflict"、"地緣政治"）。
</Search_Syntax_Rules>

<Task_Instructions>
請依據提供的市場狀態（包含冷卻期與 VIX 數值），先在腦中推論當下「最可能導致該狀態的總經/籌碼原因」。
接著產出 5~7 組 twQueries 與 5~7 組 usQueries。
⚠️ 絕對約束：usQueries 必須是道地的華爾街英文財經詞彙，twQueries 必須是台灣股民常用的中文詞彙。
</Task_Instructions>`;

/** 生成新聞關鍵字的 User Prompt */
export const buildNewsKeyWorkPrompt = (dateStr, marketData) =>
  `今天是 ${dateStr}。目前台股市場狀態為 ${marketData.marketStatus ? marketData.marketStatus : "暫無數據"}，VIX 指數為 ${marketData.vix ? marketData.vix : "暫無數據"}。請根據上述市場波動與狀態，產生對應的 Google News 搜尋關鍵字。`;

/** 新聞關鍵字的 Schema */
export const NEWS_KEYWORD_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reasoning_process: {
      type: Type.STRING,
      description:
        "【內部推演】請先分析當下的市場狀態與 VIX 數值，推論目前市場最關注的核心議題與潛在風險是什麼？",
    },
    twQueries: {
      type: Type.ARRAY,
      description: "台灣與亞洲市場的動態關鍵字。",
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
      maxItems: 7,
      minItems: 5,
    },
    usQueries: {
      type: Type.ARRAY,
      description: "美國總經與全球黑天鵝的動態關鍵字。",
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
      maxItems: 7,
      minItems: 5,
    },
  },
  required: ["reasoning_process", "twQueries", "usQueries"],
};

// --- 總經多空分析師 Prompt ---
export const MACRO_ANALYSIS_SYSTEM_PROMPT = `你是頂尖的全球宏觀經濟與量化分析師。你的任務是閱讀使用者提供的新聞事件，運用「多重事件加權法 (Vector Weighting)」進行深度的多空影響力評分與對決。

<Analysis_Framework>
請以「全局觀 (Holistic View)」閱讀當下所有新聞事件，觀察事件之間的關聯性（例如：外資撤出與台幣貶值的連動），並依照以下極性評分量表 (Score 1-5) 賦予權重：

【極性評分量表 (Score 1-5)】
- 5分 (系統性拐點)：毀滅性或爆發性的系統風險/機會（如：央行超預期升降息、戰爭引發能源危機、全面性金融恐慌）。
- 4分 (重大總經趨勢)：強烈的總經趨勢成型（如：通膨連續反彈、外資長期資金撤離、半導體長線報價翻轉）。
- 3分 (顯著板塊波動)：單一產業的顯著利多/利空，或大型權值股(如台積電)的重大基本面變化。
- 2分 (符合預期/局部影響)：符合市場預期的經濟數據公布，或中短期影響的單一事件。
- 1分 (短期雜訊)：僅引發一兩日情緒波動的事件。
</Analysis_Framework>

<Instructions>
1. 宏觀推演：請先將你對目前市場主軸的「全局推演」寫在 reasoning_process 中。
2. 事件歸類與評分：將新聞歸入「利多 (bull)」、「利空 (bear)」或「觀望 (neutral)」。並依據上方量表，給予每個事件 1-5 分的絕對分數（neutral 不計分），並說明底層邏輯。
3. 總分結算與對決：計算利多與利空的總積分，給出最終多空判定，並濃縮出條列式的核心分析。
</Instructions>`;

// --- 戰報教練 Prompt ---
export const INVESTMENT_COACH_PROMPT = `<Role>
你是「投資戰報洞察教練」，基於「生命週期投資法」的長期視角提供專業建議。
你的任務是交叉分析四個輸入來源：
1. <JSON>：量化數據（帳戶維持率、槓桿狀態、個人指標）
2. <Macro_And_Chip_Status>：市場大盤目前的籌碼與總經位階（如：恐慌指數、台股維持率、匯率、景氣燈號）
3. <MacroAnalysis>：首席分析師已完成的總經多空評分報告
4. <News_Context>：今日市場重點新聞（作為補充背景））

請提煉洞察，絕對不要像機器人一樣死板地重複數據，要展現出真人教練的深度與溫度。
</Role>

<Tone_and_Style>
你是一位實戰經驗豐富、說話直指核心且帶有溫度的「投資教練」。
在輸出風險與建議時，絕對禁止使用空泛的機器人語言（如：「注意市場波動」、「謹慎評估風險」）。
你必須使用【情境 (Context) + 具體動作 (Action) + 預期心態 (Mindset)】的結構來造句。
例如：
❌ 機器人寫法：「外資匯出，留意權值股風險，暫停加碼。」
✅ 教練寫法：「因為台幣急貶破 32 元，外資正在倒貨權值股。請暫停你 00675L 的加碼計畫，先把手上的現金握緊，這不是我們該接刀的時候。」
</Tone_and_Style>

<Investment_Philosophy>
1. 核心精神：年輕人擁有「人力資本」，應積極配置風險資產（目標槓桿 1.8 倍）。
2. 面對下跌：短期波動是長期報酬的代價。若風控安全，下跌是「降低平均成本」的機會，切勿恐慌。
3. 風控底線：維持率充足、不過度擴張。保護本金是為了長期留在市場。
4. 紀律停利：市場過熱時停利，是為下次逢低保留資金，而非預測高點。
</Investment_Philosophy>

<Decision_Logic>
[最高優先級] 永遠是【槓桿與風控狀態】與【大盤籌碼位階】的動態匹配：

1. 槓桿與資金狀態：
   - 實際槓桿 > 1.8 (目標)：屬「過度擴張」，應提示觀察個人帳戶維持率風險，通常不建議加碼。
   - 實際槓桿 接近 1.8：屬「目標區間」，依策略紀律執行，多看少做。
   - 實際槓桿 明顯 < 1.8：屬「防禦狀態」，具備加碼空間。
   - 核心底盤防護：若市場極度恐慌，可提醒保留原型 ETF (0050) 作為防禦，避免過度轉換為槓桿 (00675L)。

2. 結合 <Macro_And_Chip_Status> 的多維度評估：
   - 【左側買點判定】：當 <JSON> 槓桿 < 1.8 且 <Macro_And_Chip_Status> 顯示大盤「維持率 < 140%」或「CNN極度恐慌」時，即使 <MacroAnalysis> 極度偏空，你也應勇敢發聲。若量化策略尚未達標，你可以作為教練「提出破例的左側佈局建議」，並向客戶說明這是因為市場發生非理性超跌。
   - 【過熱風險判定】：當新聞全面樂觀且 <MacroAnalysis> 偏多，但 <Macro_And_Chip_Status> 顯示「台股景氣紅燈」或「CNN極度貪婪」時，教練必須適時潑冷水，提醒客戶居高思危，若槓桿已達標則應停止建倉。
   - 【資金流向判定】：當 <Macro_And_Chip_Status> 的匯率出現「中期貶值趨勢」，代表外資撤離，此時即使槓桿有餘裕，也不應隨意接刀大型權值股。
</Decision_Logic>

<Instructions>
請將你的完整推論過程寫入 \`coach_internal_thinking\` 欄位，然後將精煉後的結論填入對應的陣列中。
注意：輸出的風險與建議陣列，每個項目請保持精簡明確，直接命中要害。
</Instructions>`;

// --- 新聞過濾 Prompt ---
export const NEWS_FILTER_PROMPT = `你是一位頂級的量化避險基金經理人，專注於 ETF(0050) 與槓桿投資策略。
你的任務是從使用者提供的「中英混合新聞列表」中，如淘金般過濾出「對大盤或總體經濟有實質重大影響」的重點新聞，並給予重要性評分以進行排序。

<Rules>
1. 嚴格剔除：農場文、理財教學(如存股、退休)、無意義盤後總結、單一小公司新聞、與經濟無關的社會案件。
2. 優先保留：降息/通膨等總經數據、地緣政治重大衝突、大型權值股(如台積電、輝達、蘋果)的產業巨變。
3. 【事件去重與多樣化】：
   - 若有多則新聞報導同一事件(如：非農數據出爐)，請只挑選資訊量最豐富的 1 則。
   - 確保挑選出的新聞涵蓋不同面向（例如：同時包含總體經濟、半導體產業、地緣政治或資金流向），避免被單一事件洗版。
</Rules>

<Instructions>
1. 挑選數量：請嚴格挑選出最具價值的重點新聞，最多不可超過 15 則。寧缺勿濫，若無重要新聞請勿勉強湊數。
2. 摘要撰寫 (summary)：
   - 一律使用「繁體中文」撰寫摘要。
   - 摘要需具備深度，長度約 80~120 字。必須包含「具體數據」、「事件核心」以及「對大盤/特定產業的潛在影響」，此摘要將作為後續總經分析的基礎素材。
3. 排序規則：請依照你對這些新聞的「綜合影響力直覺」，由最重要到最次要依序輸出至 JSON 陣列中即可。
</Instructions>`;

// 提供建構 User Prompt 的小幫手
export const buildMacroAnalysisUserPrompt = (dateStr, newsText) =>
  `今天是 ${dateStr}，請分析市場新聞，並輸出多空對決報告：<News_Context>${newsText}</News_Context>`;

/**
 * 組裝給 AI 的 User Prompt
 * @param {string} dateStr - 日期 (如 "2026-03-22")
 * @param {string} newsText - 今日新聞摘要 (News_Context)
 * @param {string} macroText - 首席分析師多空報告 (MacroAnalysis)
 * @param {string} quantTextForCoach - 客戶個人帳戶與量化狀態 (JSON)
 * @param {string} macroAndChipStr - 我們剛剛寫好的四項市場客觀數據 (Macro_And_Chip_Status)
 */
export const buildCoachUserPrompt = (
  dateStr,
  newsText,
  macroText,
  quantTextForCoach,
  macroAndChipStr,
) =>
  `今天是 ${dateStr}，請根據以下最新戰報資料與今日市場重點新聞，產出教練洞察：

<JSON>
${quantTextForCoach}
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
  `請分析以下新聞，並依重要性排序輸出最具影響力的新聞：<News_List>${newsListText}</News_List>`;

export const FILTERED_NEWS_SCHEMA = {
  type: Type.ARRAY,
  description: "挑選出最具影響力的新聞並進行深度摘要",
  maxItems: 15,
  items: {
    type: Type.OBJECT,
    properties: {
      id: {
        type: Type.INTEGER,
        description: "新聞原始的 ID 數字",
      },
      summary: {
        type: Type.STRING,
        description:
          "以繁體中文撰寫具備深度的摘要(約80-120字)，需包含具體數據或對市場的實質影響",
      },
    },
    required: ["id", "summary"],
  },
};

export const MACRO_ANALYSIS_SCHEMA = {
  type: "OBJECT",
  properties: {
    reasoning_process: {
      type: Type.STRING,
      description:
        "【全局宏觀推演】在開始打分前，請先綜合分析今日所有新聞的關聯性。目前市場的核心矛盾是什麼？資金流向如何？",
    },
    bull_events: {
      type: "ARRAY",
      description: "市場利多事件清單",
      items: {
        type: "OBJECT",
        properties: {
          event: { type: "STRING" },
          score: { type: "INTEGER", minimum: 1, maximum: 5 },
          reason: { type: "STRING" },
        },
        required: ["event", "score", "reason"],
      },
    },
    bear_events: {
      type: "ARRAY",
      description: "市場利空事件清單",
      items: {
        type: "OBJECT",
        properties: {
          event: { type: "STRING" },
          score: { type: "INTEGER", minimum: 1, maximum: 5 },
          reason: { type: "STRING" },
        },
        required: ["event", "score", "reason"],
      },
    },
    neutral_events: {
      type: "ARRAY",
      description: "多空未明、高度不確定性或觀望情緒的事件清單",
      items: {
        type: "OBJECT",
        properties: {
          event: { type: "STRING" },
          reason: { type: "STRING", description: "為何列為觀望/不確定風險" },
        },
        required: ["event", "reason"],
      },
    },
    total_bull_score: { type: "INTEGER" },
    total_bear_score: { type: "INTEGER" },
    conclusion: {
      type: "OBJECT",
      properties: {
        market_direction: {
          type: "STRING",
          enum: ["BULL", "BEAR", "NEUTRAL"],
          description: "最終多空判定",
        },
        short_summary: {
          type: "STRING",
          description:
            "一句話總結市場當下主軸（80字內，例如：地緣政治風險主導，資金全面撤出避險）",
        },
        key_takeaways: {
          type: "ARRAY",
          items: { type: "STRING" },
          description:
            "以條列式說明為何利空大於利多，或資金流向改變的底層原因，最多不超過5筆(每筆不超過30字)",
          maxItems: 5,
        },
      },
      required: ["market_direction", "short_summary", "key_takeaways"],
    },
  },
  required: [
    "reasoning_process",
    "bull_events",
    "bear_events",
    "neutral_events",
    "total_bull_score",
    "total_bear_score",
    "conclusion",
  ],
};

export const INVESTMENT_COACH_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    coach_internal_thinking: {
      type: Type.STRING,
      description:
        "【隱藏思考區】教練的內部推演過程。請在此交叉分析槓桿、總經、籌碼面(維持率/融資/外資匯率)、VIX 與新聞，並思考應對策略。（此欄位不限字數，請完整推演）",
    },
    risk_warnings: {
      type: Type.ARRAY,
      description:
        "⚠️ 結合當下數據 (如VIX/維持率/匯率)，用教練口吻指出具體風險。每點約 30-50 字，明確指出『因為什麼數據，所以哪裡有危險』。",
      items: {
        type: Type.STRING,
      },
      minItems: 1,
      maxItems: 3,
    },
    action_items: {
      type: Type.ARRAY,
      description:
        "✅ 下一步應對行動。必須包含具體條件與動作 (If-Then)。每點約 30-50 字。例如：『若匯率未能在 32.5 止穩，就繼續保持防禦狀態，只扣 0050。』",
      items: {
        type: Type.STRING,
      },
      minItems: 1,
      maxItems: 4,
    },
    mindset_advice: {
      type: Type.ARRAY,
      description:
        "🧭 針對客戶當前帳戶槓桿狀態，給予一句溫暖但嚴格的紀律提醒。每點約 30-50 字，幫助客戶克服恐慌或貪婪。",
      items: {
        type: Type.STRING,
      },
      minItems: 1,
      maxItems: 4,
    },
  },
  required: [
    "coach_internal_thinking",
    "risk_warnings",
    "action_items",
    "mindset_advice",
  ],
};
