import { GoogleGenAI } from "@google/genai";
import { Langfuse } from "langfuse";

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

// Langfuse 初始化（金鑰放 .env）
export const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
});

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
  const msg = error.message || "";
  return msg.includes("503") || msg.includes("UNAVAILABLE");
}

/** 向下相容：任一可重試錯誤 */
function isRetryableError(error) {
  return isQuotaError(error) || isServiceError(error);
}

// Exponential Backoff + Jitter（僅用於 ServiceError）
function getBackoffDelay(attempt, baseDelay = 2000) {
  const exponential = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 1000;
  return exponential + jitter;
}

// ── Langfuse Chat Prompt 解析 ────────────────────────────────────────────────

/**
 * 從 Langfuse 取得 chat 格式 prompt，解析出 systemInstruction 與 userTemplate。
 * 若 Langfuse 無法連線，回傳 code-side fallback（空字串）。
 *
 * @param {string} promptName - Langfuse prompt 名稱
 * @param {Record<string,string>} variables - 插值變數（對應 {{variable}} 佔位符）
 * @returns {Promise<{
 *   systemInstruction: string,
 *   userTemplate: string,
 *   langfusePromptObj: object|null,
 *   langfuseConfig: object
 * }>}
 */
async function resolveChatPrompt(promptName, variables = {}) {
  let langfusePromptObj = null;
  let systemInstruction = "";
  let userTemplate = "";
  let langfuseConfig = {};

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
      systemInstruction = langfusePromptObj.compile(
        variables,
        systemMsg.content,
      );
    }

    if (userMsg) {
      userTemplate = langfusePromptObj.compile(variables, userMsg.content);
    }

    // 從 Langfuse prompt.config 取出 temperature / responseMimeType / thinkingConfig 等
    langfuseConfig = langfusePromptObj.config ?? {};
  } catch (err) {
    console.warn(
      `⚠️ [Langfuse] getPrompt(${promptName}, chat) 失敗，使用 code-side fallback：${err.message}`,
    );
  }

  return { systemInstruction, userTemplate, langfusePromptObj, langfuseConfig };
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
  const provider = options.provider ?? PROVIDERS.GEMINI;
  const cfg = PROVIDER_CONFIG[provider];
  if (!cfg) throw new Error(`[callAI] 未知的 provider: ${provider}`);

  const resolvedModel = options.model ?? cfg.defaultModel;
  const isCI = !!process.env.GITHUB_RUN_ID;

  // ── Step 1: 從 Langfuse 取得 chat prompt ─────────────────────────────────
  const { systemInstruction, userTemplate, langfusePromptObj, langfuseConfig } =
    await resolveChatPrompt(promptName, options.promptVariables ?? {});

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
      promptSource: langfusePromptObj ? "langfuse" : "code-fallback",
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
          console.warn(
            `⚠️ [callAI] Quota 耗盡 (key: ${prevKey})，` +
              `立即切換至 key: ${currentKeyIndex}（attempt ${attempt + 1}/${maxRetries}）`,
          );
          generation.end({
            level: "WARNING",
            statusMessage: `Quota exceeded key:${prevKey}, switching to key:${currentKeyIndex}`,
          });
        } else {
          const delay = getBackoffDelay(attempt);
          console.warn(
            `⚠️ [callAI] 服務錯誤 (key: ${currentKeyIndex})，` +
              `${(delay / 1000).toFixed(1)}s 後重試（attempt ${attempt + 1}/${maxRetries}）原因: ${error.message}`,
          );
          generation.end({
            level: "WARNING",
            statusMessage: `Service error retry ${attempt + 1}: ${error.message}`,
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      } else {
        console.error(
          `❌ [callAI] API 呼叫失敗 (key: ${currentKeyIndex}, attempt: ${attempt}):`,
          error.message,
        );
        generation.end({ level: "ERROR", statusMessage: error.message });
        trace.update({
          output: { error: error.message },
          statusMessage: error.message,
        });
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

  console.log("正在獲取 Gemini 可用模型清單...\n");
  try {
    const ai = aiInstances[0];
    const models = await ai.models.list();
    let count = 1;
    for await (const model of models) {
      if (model.supportedActions?.includes("generateContent")) {
        console.log(`${count}. ${model.name}`);
        count++;
      }
    }
    console.log("\n✅ 查詢完畢！請從上方挑選模型名稱放入 GEMINI_MODEL 中。");
  } catch (error) {
    console.error("獲取 Gemini 模型失敗:", error);
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

  const res = await fetch(`${cfg.baseURL}/chat/completions`, {
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
    console.error("❌ 缺少 GROK_API_KEY1");
    return;
  }

  console.log("正在獲取 Grok 可用模型清單...\n");

  try {
    const res = await fetch(`${cfg.baseURL}/models`, {
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

    models.forEach((model, i) => {
      console.log(`${i + 1}. ${model.id}  (owned_by: ${model.owned_by})`);
    });

    console.log(
      `\n✅ 共 ${models.length} 個模型，請從上方挑選 id 放入 GROK_MODEL 中。`,
    );
  } catch (error) {
    console.error("❌ 獲取 Grok 模型失敗:", error.message);
  }
}
