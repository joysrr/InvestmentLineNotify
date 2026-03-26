import { Type } from "@google/genai";

/** 生成新聞關鍵字的 System Prompt */
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

/** 新聞過濾 Prompt */
/** 新聞過濾 User Prompt */
export const buildNewsUserPrompt = (newsListText) =>
  `請分析以下新聞，並依重要性排序輸出最具影響力的新聞：<News_List>${newsListText}</News_List>`;
/** 新聞過濾 Schema（含思考過程） */
export const FILTERED_NEWS_SCHEMA = {
  type: Type.OBJECT,
  description: "AI 思考過程與挑選結果",
  properties: {
    // 第二層思考空間
    think: {
      type: Type.OBJECT,
      description: "輸出 news 之前的結構化思考過程",
      properties: {
        event_inventory: {
          type: Type.ARRAY,
          description: "Step 1：識別到的所有獨立事件（已合併重複報導）",
          items: {
            type: Type.OBJECT,
            properties: {
              event: { type: Type.STRING, description: "事件名稱" },
              count: { type: Type.INTEGER, description: "相關報導數量" },
              best_title: { type: Type.STRING, description: "資訊量最豐富的代表性標題" },
            },
            required: ["event", "count", "best_title"],
          },
        },
        dimension_check: {
          type: Type.OBJECT,
          description: "Step 2：多維度覆蓋自我審查",
          properties: {
            macro_economy: { type: Type.BOOLEAN, description: "是否涵蓋總體經濟（Fed / 通膨 / GDP）" },
            tw_market: { type: Type.BOOLEAN, description: "是否涵蓋台股大盤走勢" },
            semiconductor: { type: Type.BOOLEAN, description: "是否涵蓋半導體 / 科技產業" },
            geopolitics: { type: Type.BOOLEAN, description: "是否涵蓋地緣政治" },
            capital_flow: { type: Type.BOOLEAN, description: "是否涵蓋資金流向（外資 / 匯率）" },
          },
          required: ["macro_economy", "tw_market", "semiconductor", "geopolitics", "capital_flow"],
        },
        excluded: {
          type: Type.ARRAY,
          description: "Step 3：決定捨棄的新聞及原因",
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER, description: "被捨棄新聞的原始 ID" },
              reason: { type: Type.STRING, description: "捨棄原因（15字以內）" },
            },
            required: ["id", "reason"],
          },
        },
      },
      required: ["event_inventory", "dimension_check", "excluded"],
    },
    news: {
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
    },

  },
  required: ["think", "news"],
};

/** 總經多空分析師 Prompt */
/** 總經多空分析師 User Prompt */
export const buildMacroAnalysisUserPrompt = (dateStr, newsText) =>
  `今天是 ${dateStr}，請分析市場新聞，並輸出多空對決報告：<News_Context>${newsText}</News_Context>`;
/** 總經多空分析師 Schema */
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

/** 戰報教練 Prompt */
/** 戰報教練 User Prompt */
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
/** 戰報教練 Schema */
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