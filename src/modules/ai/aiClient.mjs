import { GoogleGenAI } from "@google/genai";
import { Langfuse } from "langfuse";

// 參數&初始化
const GEMINI_API_KEYS = [
  process.env.GEMINI_API_KEY1,
  process.env.GEMINI_API_KEY2,
  process.env.GEMINI_API_KEY3,
].filter(Boolean);
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";

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

export async function callGemini(promptName, userPrompt, options = {}) {
  if (GEMINI_API_KEYS.length === 0) {
    console.warn("⚠️ 缺少 GEMINI_API_KEYS，跳過 AI 決策");
    return null;
  }
  const promptObj = await langfuse.getPrompt(promptName);
  const systemInstruction = promptObj.compile(options.promptVariables ?? {});
  // 將 promptObj 中的 config 參數合併到 options 中，讓每個 prompt 可以自訂化 Gemini 呼叫行為
  Object.assign(options, promptObj.config);

  const keyIndex = options.keyIndex ?? 0;
  const resolvedIndex = keyIndex < aiInstances.length ? keyIndex : 0;
  const ai = aiInstances[resolvedIndex];
  const maxRetries = options.maxRetries ?? 3; // 預設最多重試 3 次

  // 1️⃣ 建立 Trace（代表一次完整的 AI 決策事件，如 MacroAnalysis）
  const trace = langfuse.trace({
    name: promptName,
    sessionId: options.sessionId,
    userId: options.userId,
    input: { userPrompt, systemInstruction },
    metadata: {
      keyIndex: resolvedIndex, model: options.model ?? GEMINI_MODEL,
      githubRunId: process.env.GITHUB_RUN_ID,
      githubWorkflow: process.env.GITHUB_WORKFLOW,
      githubSha: process.env.GITHUB_SHA,
    },
  });

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // 2️⃣ 建立 Generation span（代表這一次的實際 API 呼叫）
    const generation = trace.generation({
      name: `${promptName}-attempt-${attempt}`,
      model: options.model ?? GEMINI_MODEL,
      input: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt },
      ],
      modelParameters: {
        temperature: options.temperature,
        maxOutputTokens: options.maxOutputTokens,
        responseMimeType: options.responseMimeType,
      },
      promptName: promptObj.name,
      promptVersion: promptObj.version,
    });

    try {
      const response = await ai.models.generateContent({
        model: options.model ?? GEMINI_MODEL,
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction,
          temperature: options.temperature,
          maxOutputTokens: options.maxOutputTokens,
          responseMimeType: options.responseMimeType,
          responseSchema: options.responseSchema,
          thinkingConfig: options.thinkingConfig,
        },
      });

      let text = response.text?.trim?.() ?? "";

      if (options.responseMimeType === "application/json") {
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

      // 3️⃣ 成功：回傳 token 用量與輸出
      generation.end({
        output: text,
        usage: {
          input: response.usageMetadata?.promptTokenCount,
          output: response.usageMetadata?.candidatesTokenCount,
          total: response.usageMetadata?.totalTokenCount,
          unit: "TOKENS",
        },
        metadata: {
          // thinking token 單獨記錄，方便日後分析思考成本
          thoughtsTokenCount: response.usageMetadata?.thoughtsTokenCount ?? 0,
        },
      });
      trace.update({ output: text });

      return text;
    } catch (error) {
      const isLast = attempt === maxRetries;
      const canRetry = isRetryableError(error);

      if (canRetry && !isLast) {
        const delay = getBackoffDelay(attempt);
        console.warn(
          `⚠️ Gemini 第 ${attempt + 1} 次失敗 (key: ${resolvedIndex})，` +
          `${(delay / 1000).toFixed(1)}s 後重試... 原因: ${error.message}`,
        );
        generation.end({
          level: "WARNING",
          statusMessage: `Retry ${attempt + 1}: ${error.message}`,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(
          `❌ Gemini API 呼叫失敗 (key: ${resolvedIndex}):`,
          error.message,
        );

        // 4️⃣ 失敗：記錄錯誤
        generation.end({
          level: "ERROR",
          statusMessage: error.message,
        });

        trace.update({ level: "ERROR", statusMessage: error.message });

        throw error;
      }
    }
  }
}

/**
 * 獲取AI可用模型清單
 */
export async function listAllModels() {
  console.log("正在獲取可用模型清單...\n");

  try {
    // 呼叫 ai.models.list()
    const ai = aiInstances[0]; // 使用第一組 KEY 查詢模型清單
    const models = await ai.models.list();

    let count = 1;
    // 由於 models 是一個異步的 Pager (迭代器)，我們使用 for await 迴圈
    for await (const model of models) {
      // 過濾出支援 "generateContent" (文字/JSON 生成) 的模型
      if (
        model.supportedActions &&
        model.supportedActions.includes("generateContent")
      ) {
        console.log(`${count}. 模型名稱: ${model.name}`);
        count++;
      }
    }

    console.log(
      "\n✅ 查詢完畢！請從上方挑選一個模型名稱放入 GEMINI_MODEL 中。",
    );
  } catch (error) {
    console.error("獲取模型失敗:", error);
  }
}
