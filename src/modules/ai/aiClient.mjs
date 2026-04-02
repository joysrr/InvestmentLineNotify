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
    apiKeys: [
      process.env.GROK_API_KEY1,
    ].filter(Boolean),
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

// 可重試的錯誤判斷
function isRetryableError(error) {
  const msg = error.message || "";
  // 503 UNAVAILABLE 或 429 RATE_LIMIT
  return (
    msg.includes("503") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("429") ||
    msg.includes("RATE_LIMIT") ||
    msg.includes("quota")
  );
}

// Exponential Backoff + Jitter
function getBackoffDelay(attempt, baseDelay = 2000) {
  const exponential = baseDelay * Math.pow(2, attempt); // 2s, 4s, 8s ...
  const jitter = Math.random() * 1000; // 0~1000ms 隨機
  return exponential + jitter;
}

export async function callAI(promptName, userPrompt, options = {}) {
  const provider = options.provider ?? PROVIDERS.GEMINI;
  const cfg = PROVIDER_CONFIG[provider];
  if (!cfg) throw new Error(`[callAI] 未知的 provider: ${provider}`);

  const resolvedModel = options.model ?? cfg.defaultModel;
  const isCI = !!process.env.GITHUB_RUN_ID;

  let promptObj;
  try {
    promptObj = await langfuse.getPrompt(promptName);
  } catch (err) {
    console.warn(`⚠️ [Langfuse] getPrompt 失敗，使用空白 systemInstruction：${err.message}`);
    // fallback：跳過 Langfuse prompt，直接用空 instruction 繼續
    promptObj = { compile: () => "", config: {}, name: promptName, version: null };
  }

  const systemInstruction = promptObj.compile(options.promptVariables ?? {});
  // 將 promptObj 中的 config 參數合併到 options 中，讓每個 prompt 可以自訂化 Gemini 呼叫行為
  // langfuse 的 config 優先權高於傳入的 options
  const resolvedOptions = { ...options, ...promptObj.config };

  const keyIndex = options.keyIndex ?? 0;
  const resolvedIndex = provider === PROVIDERS.GEMINI
    ? (keyIndex < aiInstances.length ? keyIndex : 0)
    : 0;
  const maxRetries = options.maxRetries ?? 5; // 預設最多重試 5 次

  // ── Langfuse Trace ──────────────────────────────────────────────────────────
  const trace = langfuse.trace({
    name: promptName,
    sessionId: options.sessionId,
    userId: options.userId ?? (isCI ? "github-actions" : "local-dev"),
    input: { userPrompt },
    metadata: {
      provider,
      model: resolvedModel,
      resolvedKeyIndex: resolvedIndex,
      requestedKeyIndex: keyIndex,
      ...(isCI && {
        githubRunId: process.env.GITHUB_RUN_ID,
        githubWorkflow: process.env.GITHUB_WORKFLOW,
        githubSha: process.env.GITHUB_SHA,
      }),
    },
    tags: [
      `provider:${provider}`,
      `model:${resolvedModel}`,
      `key-slot-${resolvedIndex}`,
      `feature:${promptName}`,
      isCI ? "env:ci" : "env:local",
    ],
  });

  // ── Retry Loop ──────────────────────────────────────────────────────────────
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // 2️⃣ 建立 Generation span（代表這一次的實際 API 呼叫）
    const generation = trace.generation({
      name: `${promptName}-attempt-${attempt}`,
      prompt: promptObj,
      model: resolvedModel,
      input: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt },
      ],
      modelParameters: {
        temperature: options.temperature,
        maxOutputTokens: options.maxOutputTokens,
      },
      metadata: {
        provider,
        ...(resolvedOptions.responseMimeType && {
          responseMimeType: resolvedOptions.responseMimeType,
        }),
      },
    });

    try {
      let rawText, inputTokens, outputTokens, totalTokens, thoughtsTokenCount;

      if (provider === PROVIDERS.GEMINI) {
        // ── Gemini ─────────────────────────────────────────────────
        const ai = aiInstances[resolvedIndex];
        const response = await ai.models.generateContent({
          model: resolvedModel,
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
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
        // ── Grok ────────────────────────────────────────────────────────────
        const result = await callGrokAPI({
          model: resolvedModel, systemInstruction, userPrompt, options: resolvedOptions,
        });
        rawText = result.text;
        inputTokens = result.inputTokens;
        outputTokens = result.outputTokens;
        totalTokens = result.totalTokens;
        thoughtsTokenCount = 0;
      }


      // ── 清理 markdown code block ────────────────────────────────────────────
      let text = rawText;
      if (resolvedOptions.responseMimeType === "application/json") {
        text = text.replace(/^```json\n?/, "").replace(/```$/, "").trim();
      } else {
        text = text.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
      }

      // ── Generation 成功 ─────────────────────────────────────────────────────
      generation.end({
        output: text,
        usage: {
          input: inputTokens, output: outputTokens, total: totalTokens, unit: "TOKENS",
        },
        metadata: { thoughtsTokenCount },
      });

      trace.update({ output: text });

      return { text, traceId: trace.id };
    } catch (error) {
      const isLast = attempt === maxRetries;
      const canRetry = isRetryableError(error);

      if (canRetry && !isLast) {
        const delay = getBackoffDelay(attempt);
        console.warn(
          `⚠️ Gemini 第 ${attempt + 1} 次失敗 (key: ${resolvedIndex})，` +
          `${(delay / 1000).toFixed(1)}s 後重試... 原因: ${error.message}`,
        );
        generation.end({ level: "WARNING", statusMessage: `Retry ${attempt + 1}: ${error.message}`, });
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(`❌ Gemini API 呼叫失敗 (key: ${resolvedIndex}):`, error.message,);
        generation.end({ level: "ERROR", statusMessage: error.message, });
        trace.update({ output: { error: error.message }, statusMessage: error.message });
        throw error;
      }
    }
  }
}

/**
 * 獲取指定 provider 的可用模型清單
 * @param {"gemini"|"grok"} provider
 */
export async function listAllModels(provider = PROVIDERS.GEMINI) {
  if (provider === PROVIDERS.GROK) {
    return listGrokModels();
  }

  // 原本的 Gemini 邏輯保持不變
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
    // 若需要 JSON 輸出
    ...(options.responseMimeType === "application/json" && {
      response_format: { type: "json_object" },
    }),
  };

  const res = await fetch(`${cfg.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${cfg.apiKeys[0]}`,
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
        "Authorization": `Bearer ${cfg.apiKeys[0]}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`HTTP ${res.status}: ${err}`);
    }

    const data = await res.json();
    // Grok 回傳格式：{ data: [ { id, object, created, owned_by }, ... ] }
    const models = data.data ?? [];

    models.forEach((model, i) => {
      console.log(`${i + 1}. ${model.id}  (owned_by: ${model.owned_by})`);
    });

    console.log(`\n✅ 共 ${models.length} 個模型，請從上方挑選 id 放入 GROK_MODEL 中。`);
  } catch (error) {
    console.error("❌ 獲取 Grok 模型失敗:", error.message);
  }
}