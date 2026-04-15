/**
 * prompts.mjs
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * 設計原則：Langfuse 為唯一的 Prompt 真相來源
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * 所有 System Prompt、User Prompt Template 與 AI 推論參數（temperature、
 * responseMimeType、thinkingConfig 等）均透過 Langfuse Prompt Management
 * 以 **chat** 格式統一管理。
 *
 * 本檔案僅保留以下兩類無法序列化至 Langfuse 的內容：
 *   1. responseSchema — Gemini SDK 的 JS Type 物件，必須在 code 側定義
 *   2. LANGFUSE_PROMPT_CONFIGS — 將 promptName 對應到 schema + code-side config
 *      預設值，作為 Langfuse 不可用時的最低限度 fallback
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * Langfuse Prompt 對應表
 * ──────────────────────────────────────────────────────────────────────────────
 * promptName (Langfuse key)  | 說明
 * ---------------------------|--------------------------------------------------
 * GenerateSearchQueries      | 新聞動態關鍵字生成
 * FilterAndCategorizeNews    | 新聞過濾與分類
 * AnalyzeMacroNews           | 總經多空分析
 * InvestmentAdvice           | 戰報教練投資建議
 * RuleOptimizer              | 新聞黑名單規則優化
 * PeriodReport               | 週報 / 月報分析
 * JudgeActionability         | LLM Judge：可操作性評分
 * JudgeToneEmpathy           | LLM Judge：語氣與同理心評分
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * Langfuse chat prompt 格式範例（在 Langfuse UI 中設定）
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * messages:
 *   - role: system
 *     content: |
 *       你是精通 Google News 搜尋語法與總體經濟分析的避險基金量化工程師。
 *       ...
 *   - role: user
 *     content: |
 *       今天是 {{dateStr}}。目前台股市場狀態為 {{marketStatus}}，
 *       VIX 指數為 {{vix}}。
 *       {{#staticPoolText}}
 *       ⚠️ 以下為靜態關鍵字池，請勿重複產出相同字詞：
 *       {{staticPoolText}}
 *       {{/staticPoolText}}
 *
 * config:
 *   responseMimeType: application/json
 *   temperature: 0.3
 *   maxOutputTokens: 65536
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * 插值變數說明（各 prompt 的 promptVariables）
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * GenerateSearchQueries:
 *   { dateStr, marketStatus, vix, staticPoolText }
 *
 * FilterAndCategorizeNews:
 *   { newsListText }  → user: 請分析以下新聞：<News_List>{{newsListText}}</News_List>
 *
 * AnalyzeMacroNews:
 *   { dateStr, newsText }
 *
 * InvestmentAdvice:
 *   { dateStr, quantText, macroAndChipStr, macroText, newsSummaryText }
 *
 * RuleOptimizer:
 *   { regionLabel, count, titlesText }
 *
 * PeriodReport:
 *   { period, dateFrom, dateTo, statsJson }
 *
 * JudgeActionability / JudgeToneEmpathy:
 *   { coachOutputJson }
 */

import { Type } from "@google/genai";

// ─────────────────────────────────────────────────────────────────────────────
// Schemas（code-side，無法序列化至 Langfuse）
// ─────────────────────────────────────────────────────────────────────────────

/** 新聞關鍵字生成 Schema */
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
      maxItems: 8,
      minItems: 6,
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
      maxItems: 8,
      minItems: 6,
    },
  },
  required: ["reasoning_process", "twQueries", "usQueries"],
};

/** 新聞過濾 Schema（含思考過程） */
export const FILTERED_NEWS_SCHEMA = {
  type: Type.OBJECT,
  description: "AI 思考過程與挑選結果",
  properties: {
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
              best_title: {
                type: Type.STRING,
                description: "資訊量最豐富的代表性標題",
              },
              has_conflict: {
                type: Type.BOOLEAN,
                description: "此事件是否有方向相反的矛盾報導",
                nullable: true,
              },
              conflict_note: {
                type: Type.STRING,
                description: "若 has_conflict=true，說明矛盾點及哪則代表最新立場（50字內）",
                nullable: true,
              },
              conflict_winner_id: {
                type: Type.STRING,
                description: "若 has_conflict=true，代表最新立場的新聞編號",
                nullable: true,
              },
            },
            required: ["event", "count", "best_title"],
          },
        },
        dimension_check: {
          type: Type.OBJECT,
          description: "Step 2：多維度覆蓋自我審查",
          properties: {
            macro_economy: { type: Type.BOOLEAN, description: "是否涵蓋總體經濟" },
            tw_market: { type: Type.BOOLEAN, description: "是否涵蓋台股大盤走勢" },
            semiconductor: { type: Type.BOOLEAN, description: "是否涵蓋半導體/科技產業" },
            geopolitics: { type: Type.BOOLEAN, description: "是否涵蓋地緣政治" },
            capital_flow: { type: Type.BOOLEAN, description: "是否涵蓋資金流向" },
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
          id: { type: Type.INTEGER, description: "新聞原始的 ID 數字" },
          summary: {
            type: Type.STRING,
            description: "以繁體中文撰寫具備深度的摘要(約80-120字)，需包含具體數據或對市場的實質影響",
          },
        },
        required: ["id", "summary"],
      },
    },
  },
  required: ["think", "news"],
};

/** 總經多空分析師 Schema */
export const MACRO_ANALYSIS_SCHEMA = {
  type: "OBJECT",
  properties: {
    reasoning_process: {
      type: Type.STRING,
      description: "【全局宏觀推演】在開始打分前，請先綜合分析今日所有新聞的關聯性。目前市場的核心矛盾是什麼？資金流向如何？",
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
          reason: { type: "STRING" },
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
          description: "一句話總結市場當下主軸（80字內）",
        },
        key_takeaways: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "條列式分析底層原因，最多 5 筆（每筆不超過 30 字）",
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

/** 戰報教練 Schema */
export const INVESTMENT_COACH_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    coach_internal_thinking: {
      type: Type.STRING,
      description:
        "【隱藏思考區】教練的內部推演過程。請在此交叉分析槓桿、總經、籌碼面(維持率/融資/外資匯率/PB估值)、VIX 與新聞，並思考應對策略。（此欄位不限字數，請完整推演）",
    },
    risk_warnings: {
      type: Type.ARRAY,
      description: "⚠️ 結合當下數據，用教練口吻指出具體風險。每點約 30-50 字。",
      items: { type: Type.STRING },
      minItems: 1,
      maxItems: 3,
    },
    action_items: {
      type: Type.ARRAY,
      description: "✅ 下一步應對行動（If-Then 格式）。每點約 30-50 字。",
      items: { type: Type.STRING },
      minItems: 1,
      maxItems: 4,
    },
    mindset_advice: {
      type: Type.STRING,
      description: "🧭 針對客戶當前帳戶槓桿狀態，給予一句溫暖但嚴格的紀律提醒（30-50 字）。",
    },
  },
  required: ["coach_internal_thinking", "risk_warnings", "action_items", "mindset_advice"],
};

/** 新聞黑名單優化 Schema */
export const RULE_OPTIMIZER_SCHEMA = {
  type: Type.OBJECT,
  description: "AI 建議新增的黑名單規則",
  properties: {
    rules: {
      type: Type.ARRAY,
      description: "建議新增的 regex 黑名單規則列表，無建議時輸出空陣列",
      items: {
        type: Type.OBJECT,
        properties: {
          pattern: {
            type: Type.STRING,
            description: "Regex pattern 字串（不含前後的 /）",
          },
          flags: {
            type: Type.STRING,
            description: "Regex flags，通常為 'i' 或空字串",
          },
          reason: {
            type: Type.STRING,
            description: "規則說明（繁體中文）",
          },
        },
        required: ["pattern", "flags", "reason"],
      },
      maxItems: 5,
    },
  },
  required: ["rules"],
};

/**
 * 週報 / 月報 Schema
 * 對應 Langfuse prompt: PeriodReport
 */
export const PERIOD_REPORT_SCHEMA = {
  type: "object",
  properties: {
    topRiskEvents: {
      type: "array",
      items: { type: "string" },
      description: "本週期最重要風險事件，每項 30 字以內，最多 2 項",
    },
    consistencyComment: {
      type: "string",
      description: "策略一致性評語，50 字以內",
    },
    periodOutlook: {
      type: "string",
      description: "下週/下月展望，50 字以內",
    },
  },
  required: ["topRiskEvents", "consistencyComment", "periodOutlook"],
};

/**
 * LLM Judge 共用 Schema
 * 對應 Langfuse prompts: JudgeActionability, JudgeToneEmpathy
 */
export const JUDGE_RESULT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    score: {
      type: Type.NUMBER,
      description: "評分結果，範圍 0.0（最差）至 1.0（最佳），精確到小數點後兩位",
    },
    reason: {
      type: Type.STRING,
      description: "評分依據，以繁體中文說明（50 字以內）",
    },
  },
  required: ["score", "reason"],
};

// ─────────────────────────────────────────────────────────────────────────────
// LANGFUSE_PROMPT_CONFIGS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * 將 promptName 對應到：
 *   - schema: code-side responseSchema（傳給 Gemini API）
 *   - config: code-side 預設推論參數（Langfuse config 不可用時的 fallback）
 *
 * ⚠️ config 這層僅作為 Langfuse 無法連線時的最低限度 fallback。
 *   正常情況下，所有推論參數均以 Langfuse prompt.config 為準。
 */
export const LANGFUSE_PROMPT_CONFIGS = {
  GenerateSearchQueries: {
    schema: NEWS_KEYWORD_SCHEMA,
    config: {
      responseMimeType: "application/json",
      temperature: 0.3,
      maxOutputTokens: 65536,
    },
  },
  FilterAndCategorizeNews: {
    schema: FILTERED_NEWS_SCHEMA,
    config: {
      responseMimeType: "application/json",
      temperature: 0.1,
      thinkingConfig: { thinkingLevel: "HIGH" },
      maxOutputTokens: 65536,
    },
  },
  AnalyzeMacroNews: {
    schema: MACRO_ANALYSIS_SCHEMA,
    config: {
      responseMimeType: "application/json",
      temperature: 0.2,
      thinkingConfig: { thinkingLevel: "HIGH" },
      maxOutputTokens: 65536,
    },
  },
  InvestmentAdvice: {
    schema: INVESTMENT_COACH_SCHEMA,
    config: {
      responseMimeType: "application/json",
      temperature: 0.5,
      thinkingConfig: { thinkingLevel: "HIGH" },
      maxOutputTokens: 65536,
    },
  },
  RuleOptimizer: {
    schema: RULE_OPTIMIZER_SCHEMA,
    config: {
      responseMimeType: "application/json",
      temperature: 0.2,
      maxOutputTokens: 1024,
    },
  },
  PeriodReport: {
    schema: PERIOD_REPORT_SCHEMA,
    config: {
      responseMimeType: "application/json",
      temperature: 0.3,
      thinkingConfig: { thinkingLevel: "MEDIUM" },
      maxOutputTokens: 8192,
    },
  },
  JudgeActionability: {
    schema: JUDGE_RESULT_SCHEMA,
    config: {
      responseMimeType: "application/json",
      temperature: 0.1,
      maxOutputTokens: 512,
    },
  },
  JudgeToneEmpathy: {
    schema: JUDGE_RESULT_SCHEMA,
    config: {
      responseMimeType: "application/json",
      temperature: 0.1,
      maxOutputTokens: 512,
    },
  },
};
