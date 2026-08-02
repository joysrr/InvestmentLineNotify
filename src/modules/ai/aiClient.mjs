import { GoogleGenAI } from "@google/genai";
import { Langfuse } from "langfuse";
import { fetchWithTimeout } from "../../utils/coreUtils.mjs";
import logger from "../../utils/logger.mjs";
import {
  canMakeAIRequest,
  recordAIRequestResult,
  getCircuitBreakerStatus,
  isCircuitOpen,
  CIRCUIT_STATE,
} from "./aiCircuitBreaker.mjs";
import {
  AIServiceError,
  isAIRetryableError,
  calculateBackoffDelay,
  delay,
} from "../../utils/retryUtils.mjs";

// 參數&初始化
const GEMINI_API_KEYS = [
  process.env.GEMINI_API_KEY1,
  process.env.GEMINI_API_KEY2,
  process.env.GEMINI_API_KEY3,
].filter(Boolean);

export const PROVIDERS = {
  GEMINI: "gemini",
  GROK: "grok",
};

// 各 provider 的 base URL 與預設 model
const PROVIDER_CONFIG = {
  [PROVIDERS.GEMINI]: {
    defaultModel: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
  },
  [PROVIDERS.GROK]: {
    baseURL: "https://api.x.ai/v1",
    defaultModel: process.env.GROK_MODEL || "grok-4-1-fast-reasoning",
    apiKeys: [process.env.GROK_API_KEY1].filter(Boolean),
  },
};

// 對每個 KEY 建立對應的 GoogleGenAI 實例
const aiInstances = GEMINI_API_KEYS.map(
  (key) => new GoogleGenAI({ apiKey: key }),
);

// ── Langfuse 初始化（金鑰放 .env）────────────────────────────────────────────
// isLangfuseEnabled：僅在三個環境變數均有值時才啟用，避免 SDK 靜默失敗
const _langfuseEnabled =
  !!process.env.LANGFUSE_PUBLIC_KEY &&
  !!process.env.LANGFUSE_SECRET_KEY &&
  !!process.env.LANGFUSE_BASE_URL;

if (!_langfuseEnabled) {
  logger.warn(
    {
      missingKeys: [
        !process.env.LANGFUSE_PUBLIC_KEY && "LANGFUSE_PUBLIC_KEY",
        !process.env.LANGFUSE_SECRET_KEY && "LANGFUSE_SECRET_KEY",
        !process.env.LANGFUSE_BASE_URL && "LANGFUSE_BASE_URL",
      ].filter(Boolean),
    },
    "Langfuse 環境變數未完整設定，追蹤已停用",
  );
}

export const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
  // flushAt：累積幾筆後自動送出（預設 15）
  // flushInterval：最長等多久自動送出（預設 10000ms）
  // 短命程序中應呼叫 flushAsync() 確保送出，不依賴自動觸發
});

/**
 * 送出 Langfuse 佇列中所有待寫入的 trace / generation，並印出確認日誌。
 * 應在每次 callAI 回傳（成功或失敗）後呼叫，確保短命 Node 程序不遺漏資料。
 *
 * @param {string} traceId  - 本次 callAI 的 trace.id，僅用於 log 識別
 * @param {'success'|'error'} status - 本次呼叫結果
 */
export async function flushLangfuse(traceId, status = "success") {
  if (!_langfuseEnabled) return;
  try {
    await langfuse.flushAsync();
    logger.info(
      {
        traceId,
        status,
        url: `${process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com"}/trace/${traceId}`,
      },
      "Langfuse flush 完成",
    );
  } catch (flushErr) {
    logger.error(
      { traceId, error: flushErr.message },
      "Langfuse flushAsync 失敗",
    );
  }
}

// ── Human Review Metadata ────────────────────────────────────────────────────
const HUMAN_REVIEW_CONFIG = {
  FilterAndCategorizeNews: {
    human_review: true,
    scores: ["Summary_Quality", "Signal_to_Noise_Ratio"],
    review_notes:
      "抽查重點：summary 是否精準反映標題內容（Summary_Quality）；" +
      "保留新聞是否均為有效訊號、無明顯雜訊（Signal_to_Noise_Ratio）。" +
      "可對照 think.excluded 欄位檢查篩選合理性。",
  },
  AnalyzeMacroNews: {
    human_review: true,
    scores: ["Logic_Consistency", "Weighting_Rationality"],
    review_notes:
      "抽查重點：bull/bear 分析推論是否前後一致（Logic_Consistency）；" +
      "各事件的影響力評分（score 欄位）是否符合事件實際嚴重程度（Weighting_Rationality）。" +
      "可對照 bull_events / bear_events 陣列與 conclusion 進行邏輯核查。",
  },
  InvestmentAdvice: {
    human_review: true,
    scores: ["Actionability", "Tone_and_Empathy", "Context_Alignment"],
    review_notes:
      "抽查重點：action_items 是否具體可執行（Actionability）；" +
      "mindset_advice 語氣是否適切、具支持性（Tone_and_Empathy）；" +
      "建議內容是否與當日市場狀況及 news summary 脈絡一致（Context_Alignment）。",
  },
  GenerateSearchQueries: {
    human_review: false,
    scores: [],
    review_notes: "此 trace 無 Human 類評分需求，由 Rule 類自動評估即可。",
  },
};

function getHumanReviewMeta(promptName) {
  const key = promptName.split("/").pop();

  return (
    HUMAN_REVIEW_CONFIG[key] ?? {
      human_review: false,
      scores: [],
      review_notes: "未設定 Human Review 欄位。",
    }
  );
}

// ── 錯誤分類 ─────────────────────────────────────────────────────────────────

/**
 * Quota / Rate Limit 類錯誤 → 立即換下一把 key，不等待
 */
function isQuotaError(error) {
  const msg = error.message || "";
  return (
    msg.includes("429") || msg.includes("RATE_LIMIT") || msg.includes("quota")
  );
}

/**
 * 服務不穩定類錯誤 → 維持同一把 key，做 backoff 等待後重試
 */
function isServiceError(error) {
  // 使用統一的重試判斷工具
  return isAIRetryableError(error) && !isQuotaError(error);
}

// Exponential Backoff + Jitter（僅用於 ServiceError）
// 使用統一的工具函數
function getBackoffDelay(attempt, baseDelay = 2000) {
  return calculateBackoffDelay(attempt, baseDelay, 10000, 0.5);
}

// ── 各 prompt 的 hardcoded fallback（Langfuse 斷線時使用）──────────────────────────
// 僅包含最基礎的角色定義，確保 AI 不裸跑。
// 注意：fallback prompt 不含市場資料插值，AI 輸出品質會明顯降低。
// callAI() 會透過 promptSource 標記此狀態，下游可依此決定是否採用輸出。
const PROMPT_HARDCODED_FALLBACK = {
  // ── 每日決策管線 ──
  InvestmentAdvice: {
    system:
      "你是一位穩健的台股投資教練，請根據使用者提供的市場資訊，給出具體可執行的投資建議，以 JSON 格式回覆。",
    user: "{{quantText}}\n\n{{macroAndChipStr}}\n\n{{macroText}}\n\n{{newsSummaryText}}",
  },
  FilterAndCategorizeNews: {
    system: "你是一位金融新聞分析師，請篩選並分類以下新聞，以 JSON 格式回覆。",
    user: "{{newsListText}}",
  },
  AnalyzeMacroNews: {
    system:
      "你是一位總經分析師，請分析以下新聞對市場的影響，以 JSON 格式回覆。",
    user: "{{newsText}}",
  },
  GenerateSearchQueries: {
    system: "你是一位金融研究員，請根據主題生成搜尋關鍵字，以 JSON 格式回覆。",
    user: "日期：{{dateStr}}\n狀態：{{marketStatus}}\nVIX：{{vix}}\n靜態池：{{staticPoolText}}",
  },

  // ── 週期報告與治理 ──
  PeriodReportAnalysis: {
    system:
      "你是一位資深投資顧問，請針對過去一段時間的投資數據與表現進行深度總結，以 JSON 格式回覆。",
    user: "週期：{{periodLabel}}\n統計數據：{{statsText}}\n風險事件：{{riskWarnings}}",
  },
  RuleOptimizer: {
    system:
      "你是一位自動化治理專家，請根據新聞標題優化黑名單規則，以 JSON 格式回覆。",
    user: "區域：{{regionLabel}}\n標題清單：{{titlesText}}",
  },

  // ── LLM Judge 品質評估 ──
  JudgeActionability: {
    system:
      "你是一位嚴謹的投資品質查核員，請評估投資建議的可執行性，以 JSON 格式回覆。",
    user: "待評估建議：{{coachOutputJson}}",
  },
  JudgeToneAndEmpathy: {
    system:
      "你是一位品牌語氣監測員，請評估投資建議的專業度與共感力，以 JSON 格式回覆。",
    user: "待評估建議：{{coachOutputJson}}",
  },
};

// ── Langfuse Chat Prompt 解析 ────────────────────────────────────────────────

//─────────────────────────────────────────────────────────────────
// 工具：將 compile() 回傳值強制轉為純字串
// Langfuse SDK 不同版本行為不一致：
//   - 舊版：compile(vars, content) → string
//   - 新版：compile(vars, content) → [{role, content}, ...] 陣列
// ─────────────────────────────────────────────────────────────────
function extractCompiledText(raw) {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    // 回傳 message 陣列時，找對應 role 的 content
    // 若找不到則把所有 content 合併（保險 fallback）
    return raw
      .map((m) => (typeof m?.content === "string" ? m.content : ""))
      .join("\n")
      .trim();
  }
  if (raw && typeof raw === "object" && typeof raw.content === "string") {
    return raw.content;
  }
  return String(raw ?? "");
}

/**
 * 從 Langfuse 取得 chat 格式 prompt，解析出 systemInstruction 與 userTemplate。
 * 若 Langfuse 無法連線，嘗試嘗試 hardcoded fallback。
 *
 * @param {string} promptName - Langfuse prompt 名稱
 * @param {Record<string,string>} variables - 插值變數（對應 {{variable}} 佔位符）
 * @returns {Promise<{
 *   systemInstruction: string,
 *   userTemplate: string,
 *   langfusePromptObj: object|null,
 *   langfuseConfig: object,
 *   promptSource: 'langfuse' | 'hardcoded-fallback' | 'missing'
 * }>}
 */
async function resolveChatPrompt(promptName, variables = {}) {
  let langfusePromptObj = null;
  let systemInstruction = "";
  let userTemplate = "";
  let langfuseConfig = {};
  let promptSource = "langfuse";

  try {
    // type: 'chat' → Langfuse 回傳 { prompt: [{role, content}], config, ... }
    langfusePromptObj = await langfuse.getPrompt(promptName, undefined, {
      type: "chat",
    });

    const messages = langfusePromptObj.prompt ?? [];

    // 分離 system / user messages，各自 compile 插值
    const systemMsg = messages.find((m) => m.role === "system");
    const userMsg = messages.find((m) => m.role === "user");

    if (systemMsg) {
      // compile() 將 {{variable}} 替換為實際值
      const raw = langfusePromptObj.compile(variables, systemMsg.content);

      if (Array.isArray(raw)) {
        const compiledSystem = raw.find((m) => m.role === "system");
        systemInstruction = compiledSystem?.content ?? extractCompiledText(raw);
      } else {
        systemInstruction = extractCompiledText(raw);
      }
    }

    if (userMsg) {
      // compile() 將 {{variable}} 替換為實際值
      const raw = langfusePromptObj.compile(variables, userMsg.content);

      if (Array.isArray(raw)) {
        const compiledUser = raw.find((m) => m.role === "user");
        userTemplate = compiledUser?.content ?? extractCompiledText(raw);
      } else {
        userTemplate = extractCompiledText(raw);
      }
    }

    // 從 Langfuse prompt.config 取出 temperature / responseMimeType / thinkingConfig 等
    langfuseConfig = langfusePromptObj.config ?? {};
  } catch (err) {
    logger.warn(
      { promptName, error: err.message },
      "Langfuse getPrompt 失敗，嘗試使用 hardcoded fallback",
    );

    const promptKey = promptName.split("/").pop();
    const fallback = PROMPT_HARDCODED_FALLBACK[promptKey];

    if (fallback) {
      systemInstruction = fallback.system;
      // 對 user template 進行簡易插值（支援最基本的 {{key}} 替換）
      userTemplate = Object.entries(variables).reduce(
        (tmpl, [k, v]) =>
          tmpl.replace(new RegExp(`{{${k}}}`, "g"), String(v ?? "")),
        fallback.user,
      );
      promptSource = "hardcoded-fallback";
      logger.warn(
        { promptKey },
        "使用 hardcoded fallback prompt（輸出品質可能降低）",
      );
    } else {
      promptSource = "missing";
      logger.error(
        { promptName },
        "Langfuse 無可用 prompt 且無硬編碼 fallback",
      );
    }
  }

  return {
    systemInstruction,
    userTemplate,
    langfusePromptObj,
    langfuseConfig,
    promptSource,
  };
}

// ── callAI ───────────────────────────────────────────────────────────────────

/**
 * 呼叫 AI API，支援 Gemini 與 Grok。
 *
 * prompt 解析：Langfuse chat prompt（system + user messages，含 config）
 *
 * responseSchema 優先順序：
 *   1. langfuseConfig.response_schema ← Langfuse prompt.config 管理（最高）
 *   2. options.responseSchema         ← 呼叫端強制覆蓋（中）
 *
 * @param {string} promptName - Langfuse prompt 名稱（同時作為 trace name）
 * @param {object} options
 * @param {string}  [options.provider]         - PROVIDERS.GEMINI | PROVIDERS.GROK
 * @param {string}  [options.model]             - 覆蓋預設 model
 * @param {object}  [options.promptVariables]   - 插值變數 { key: value }
 * @param {number}  [options.keyIndex]          - 起始 key index
 * @param {number}  [options.maxRetries]        - 最大重試次數
 * @param {string}  [options.sessionId]         - Langfuse session ID
 * @param {string}  [options.userId]            - Langfuse user ID
 * @param {object}  [options.responseSchema]    - 強制覆蓋 responseSchema（呼叫端）
 * @param {string}  [options.responseMimeType]  - 覆蓋 Langfuse config
 * @param {number}  [options.temperature]       - 覆蓋 Langfuse config
 * @param {number}  [options.maxOutputTokens]   - 覆蓋 Langfuse config
 * @param {object}  [options.thinkingConfig]    - 覆蓋 Langfuse config
 */
export async function callAI(promptName, options = {}) {
  // ── Circuit Breaker 檢查 ────────────────────────────────────────────────
  if (!canMakeAIRequest()) {
    const status = getCircuitBreakerStatus();
    const circuitErr = new Error(
      `[CircuitBreaker] AI API 處於 ${status.state} 狀態，拒絕請求（失敗率 ${status.failureRate}）`,
    );
    circuitErr.code = "CIRCUIT_OPEN";
    circuitErr.circuitStatus = status;
    throw circuitErr;
  }

  const provider = options.provider ?? PROVIDERS.GEMINI;
  const cfg = PROVIDER_CONFIG[provider];
  if (!cfg) throw new Error(`[callAI] 未知的 provider: ${provider}`);

  const resolvedModel = options.model ?? cfg.defaultModel;
  const isCI = !!process.env.GITHUB_RUN_ID;
  const startTime = Date.now(); // 記錄開始時間，用於 Circuit Breaker 回應時間監控

  // ── Step 1: 從 Langfuse 取得 chat prompt ─────────────────────────────────
  const {
    systemInstruction,
    userTemplate,
    langfusePromptObj,
    langfuseConfig,
    promptSource,
  } = await resolveChatPrompt(promptName, options.promptVariables ?? {});

  // ── Step 1.5: Degradation Policy 防衛檢查 ────────────────────────────────
  // promptSource = "missing" 表示 Langfuse 斷線且無 hardcoded fallback
  // 此情況下 AI 會裸跑，直接拋錯阻斷，避免產出無意義通知
  if (promptSource === "missing") {
    const degradationErr = new Error(
      `[callAI] Prompt 不可用（Langfuse 斷線且無 hardcoded fallback）：${promptName}。` +
        `本次 AI 呼叫已阻斷，請檢查 Langfuse 連線或補充 PROMPT_HARDCODED_FALLBACK。`,
    );
    logger.error({ promptName }, degradationErr.message);
    throw degradationErr;
  }

  // ── Step 2: 合併 config（Langfuse config > options）──
  const resolvedOptions = {
    // 呼叫端 options（中優先）
    // Langfuse prompt.config（最高優先，可覆蓋 option）
    ...options,
    ...langfuseConfig,
    // ── responseSchema 三層優先順序 ──────────────────────────────────────────
    // 1. langfuseConfig.response_schema → Langfuse prompt.config 管理（推薦路徑）
    // 2. options.responseSchema         → 呼叫端強制覆蓋
    responseSchema:
      langfuseConfig.response_schema ?? options.responseSchema ?? undefined,
  };

  const startKeyIndex = options.keyIndex ?? 0;
  const keyCount = provider === PROVIDERS.GEMINI ? aiInstances.length : 1;
  const maxRetries = options.maxRetries ?? keyCount * 2;

  // ── Human Review Metadata ────────────────────────────────────────────────
  const humanReviewMeta = getHumanReviewMeta(promptName);

  // ── Langfuse Trace ──────────────────────────────────────────────────────────
  const trace = langfuse.trace({
    name: promptName,
    sessionId: options.sessionId,
    userId: options.userId ?? (isCI ? "github-actions" : "local-dev"),
    input: { userTemplate },
    metadata: {
      provider,
      model: resolvedModel,
      startKeyIndex,
      human_review: humanReviewMeta,
      promptSource,
      schemaSource: options.responseSchema
        ? "options"
        : langfuseConfig.response_schema
          ? "langfuse-config"
          : "none",
      ...(isCI && {
        githubRunId: process.env.GITHUB_RUN_ID,
        githubWorkflow: process.env.GITHUB_WORKFLOW,
        githubSha: process.env.GITHUB_SHA,
      }),
    },
    tags: [
      `provider:${provider}`,
      `model:${resolvedModel}`,
      `key-slot-${startKeyIndex}`,
      `feature:${promptName}`,
      isCI ? "env:ci" : "env:local",
      ...(humanReviewMeta.human_review ? ["needs-human-review"] : []),
    ],
  });

  // ── 診斷日誌：trace 建立確認 ──────────────────────────────────────────────
  logger.debug(
    { promptName, traceId: trace.id, enabled: _langfuseEnabled },
    "Langfuse trace 建立",
  );

  // ── Retry Loop（含 key 輪換）──────────────────────────────────────────────
  let currentKeyIndex = startKeyIndex % (keyCount || 1);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const generation = trace.generation({
      name: `${promptName}-attempt-${attempt}`,
      prompt: langfusePromptObj,
      model: resolvedModel,
      input: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userTemplate },
      ],
      modelParameters: {
        temperature: resolvedOptions.temperature,
        maxOutputTokens: resolvedOptions.maxOutputTokens,
      },
      metadata: {
        provider,
        keyIndex: currentKeyIndex,
        ...(resolvedOptions.responseMimeType && {
          responseMimeType: resolvedOptions.responseMimeType,
        }),
      },
    });

    try {
      let rawText, inputTokens, outputTokens, totalTokens, thoughtsTokenCount;

      if (provider === PROVIDERS.GEMINI) {
        const ai = aiInstances[currentKeyIndex];
        const response = await ai.models.generateContent({
          model: resolvedModel,
          contents: [{ role: "user", parts: [{ text: userTemplate }] }],
          config: {
            systemInstruction,
            temperature: resolvedOptions.temperature,
            maxOutputTokens: resolvedOptions.maxOutputTokens,
            responseMimeType: resolvedOptions.responseMimeType,
            responseSchema: resolvedOptions.responseSchema,
            thinkingConfig: resolvedOptions.thinkingConfig,
          },
        });
        rawText = response.text?.trim?.() ?? "";
        inputTokens = response.usageMetadata?.promptTokenCount;
        outputTokens = response.usageMetadata?.candidatesTokenCount;
        totalTokens = response.usageMetadata?.totalTokenCount;
        thoughtsTokenCount = response.usageMetadata?.thoughtsTokenCount ?? 0;
      } else if (provider === PROVIDERS.GROK) {
        const result = await callGrokAPI({
          model: resolvedModel,
          systemInstruction,
          userPrompt: userTemplate,
          options: resolvedOptions,
        });
        rawText = result.text;
        inputTokens = result.inputTokens;
        outputTokens = result.outputTokens;
        totalTokens = result.totalTokens;
        thoughtsTokenCount = 0;
      }

      // ── 清理 markdown code block ───────────────────────────────────────────
      let text = rawText;
      if (resolvedOptions.responseMimeType === "application/json") {
        text = text
          .replace(/^```json\n?/, "")
          .replace(/```$/, "")
          .trim();
      } else {
        text = text
          .replace(/^```[a-zA-Z]*\n?/, "")
          .replace(/```$/, "")
          .trim();
      }

      // ── Generation 成功 ────────────────────────────────────────────────────
      generation.end({
        output: text,
        usage: {
          input: inputTokens,
          output: outputTokens,
          total: totalTokens,
          unit: "TOKENS",
        },
        metadata: { thoughtsTokenCount, resolvedKeyIndex: currentKeyIndex },
      });

      trace.update({ output: text });

      // ── 診斷日誌 & flush：確認寫入 Langfuse ──────────────────────────────
      logger.info(
        {
          attempt,
          inputTokens,
          outputTokens,
          totalTokens,
          thoughtsTokenCount,
          duration: Date.now() - startTime,
        },
        "Langfuse generation 完成",
      );

      // 記錄 Circuit Breaker 成功
      recordAIRequestResult(Date.now() - startTime, true);

      await flushLangfuse(trace.id, "success");

      return { text, traceId: trace.id };
    } catch (error) {
      const isLast = attempt === maxRetries;
      const quotaErr = isQuotaError(error);
      const serviceErr = isServiceError(error);
      const canRetry = (quotaErr || serviceErr) && !isLast;

      if (canRetry) {
        if (quotaErr && keyCount > 1) {
          const prevKey = currentKeyIndex;
          currentKeyIndex = (currentKeyIndex + 1) % keyCount;
          logger.warn(
            { prevKey, currentKeyIndex, attempt: attempt + 1, maxRetries },
            "Quota 耗盡，切換至下一個 key",
          );
          generation.end({
            level: "WARNING",
            statusMessage: `Quota exceeded key:${prevKey}, switching to key:${currentKeyIndex}`,
          });
        } else {
          const backoffDelay = getBackoffDelay(attempt);
          logger.warn(
            {
              keyIndex: currentKeyIndex,
              attempt: attempt + 1,
              maxRetries,
              delaySeconds: (backoffDelay / 1000).toFixed(1),
              error: error.message,
            },
            "服務錯誤，等待後重試",
          );
          generation.end({
            level: "WARNING",
            statusMessage: `Service error retry ${attempt + 1}: ${error.message}`,
          });
          await delay(backoffDelay);
        }
      } else {
        // 記錄 Circuit Breaker 失敗
        recordAIRequestResult(Date.now() - startTime, false);

        logger.error(
          { keyIndex: currentKeyIndex, attempt, error: error.message },
          "API 呼叫失敗",
        );
        generation.end({ level: "ERROR", statusMessage: error.message });
        trace.update({
          output: { error: error.message },
          statusMessage: error.message,
        });
        // ── 診斷日誌 & flush：失敗時同樣確保 trace 送出 ──────────────────
        await flushLangfuse(trace.id, "error");
        throw error;
      }
    }
  }
}

/**
 * 獲取指定 provider 的可用模型清單
 */
export async function listAllModels(provider = PROVIDERS.GEMINI) {
  if (provider === PROVIDERS.GROK) {
    return listGrokModels();
  }

  logger.info("正在獲取 Gemini 可用模型清單");
  try {
    const ai = aiInstances[0];
    const models = await ai.models.list();
    let count = 1;
    const modelList = [];
    for await (const model of models) {
      if (model.supportedActions?.includes("generateContent")) {
        modelList.push(model.name);
        count++;
      }
    }
    logger.info(
      { models: modelList, count: modelList.length },
      "Gemini 模型查詢完畢",
    );
  } catch (error) {
    logger.error({ error }, "獲取 Gemini 模型失敗");
  }
}

// ─── Grok Caller（OpenAI-compatible REST）────────────────────────────────────
async function callGrokAPI({ model, systemInstruction, userPrompt, options }) {
  const cfg = PROVIDER_CONFIG[PROVIDERS.GROK];
  if (!cfg.apiKeys.length) throw new Error("[callAI] 缺少 GROK_API_KEY1");

  const body = {
    model,
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: userPrompt },
    ],
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxOutputTokens ?? 4096,
    ...(options.responseMimeType === "application/json" && {
      response_format: { type: "json_object" },
    }),
  };

  const res = await fetchWithTimeout(`${cfg.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKeys[0]}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[Grok] HTTP ${res.status}: ${err}`);
  }

  const data = await res.json();
  return {
    text: data.choices[0].message.content ?? "",
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
    totalTokens: data.usage?.total_tokens,
  };
}

/**
 * 列出 Grok 可用模型清單
 */
export async function listGrokModels() {
  const cfg = PROVIDER_CONFIG[PROVIDERS.GROK];
  if (!cfg.apiKeys.length) {
    logger.error("缺少 GROK_API_KEY1");
    return;
  }

  logger.info("正在獲取 Grok 可用模型清單");

  try {
    const res = await fetchWithTimeout(`${cfg.baseURL}/models`, {
      headers: {
        Authorization: `Bearer ${cfg.apiKeys[0]}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`HTTP ${res.status}: ${err}`);
    }

    const data = await res.json();
    const models = data.data ?? [];

    const modelList = models.map((model, i) => ({
      id: model.id,
      ownedBy: model.owned_by,
    }));

    logger.info(
      { models: modelList, count: models.length },
      "Grok 模型查詢完畢",
    );
  } catch (error) {
    logger.error({ error: error.message }, "獲取 Grok 模型失敗");
  }
}
