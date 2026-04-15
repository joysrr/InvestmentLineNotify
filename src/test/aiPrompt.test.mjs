// tests/aiPrompt.test.mjs
// 用途：驗證 8 個 Langfuse prompt 的 System Prompt、User Prompt、Config、Schema
// 執行：node tests/aiPrompt.test.mjs
// 可選：node tests/aiPrompt.test.mjs --prompt FilterAndCategorizeNews  ← 只測單一 prompt
// 可選：node tests/aiPrompt.test.mjs --verbose                         ← 印出完整 prompt 內容

import { Langfuse } from "langfuse";
import "dotenv/config";

// ─────────────────────────────────────────────────────────────────────────────
// CLI 參數解析
// ─────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const VERBOSE = args.includes("--verbose");
const FILTER_PROMPT = (() => {
  const idx = args.indexOf("--prompt");
  return idx !== -1 ? args[idx + 1] : null;
})();

// ─────────────────────────────────────────────────────────────────────────────
// 顏色工具
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
};

const ok = (msg) => `${C.green}✅ ${msg}${C.reset}`;
const fail = (msg) => `${C.red}❌ ${msg}${C.reset}`;
const warn = (msg) => `${C.yellow}⚠️  ${msg}${C.reset}`;
const info = (msg) => `${C.cyan}ℹ  ${msg}${C.reset}`;
const dim = (msg) => `${C.gray}${msg}${C.reset}`;
const section = (msg) => `\n${C.bold}${C.blue}── ${msg} ──${C.reset}`;

// ─────────────────────────────────────────────────────────────────────────────
// 8 個 Prompt 定義
// 格式：{
//   name:             Langfuse prompt 名稱（也是 callAI 第一參數）
//   description:      人類可讀說明
//   type:             'chat' | 'text'
//   requiredVars:     User Prompt 中預期存在的插值變數
//   expectedConfig:   config 欄位白名單（必須存在）
//   schemaRequired:   是否必須有 responseSchema / response_schema
//   schemaFields:     schema 頂層欄位（或 properties 鍵）應包含的欄位
// }
// ─────────────────────────────────────────────────────────────────────────────
const PROMPT_SPECS = [
  {
    name: "News/FilterAndCategorizeNews",
    description: "新聞篩選與分類",
    type: "chat",
    requiredVars: ["newsListText"],
    expectedConfig: ["temperature", "responseMimeType", "maxOutputTokens"],
    schemaRequired: true,
    schemaFields: ["think", "news"],
  },
  {
    name: "News/AnalyzeMacroNews",
    description: "總經新聞宏觀分析",
    type: "chat",
    requiredVars: ["dateStr", "newsText"],
    expectedConfig: ["temperature", "responseMimeType", "maxOutputTokens"],
    schemaRequired: true,
    schemaFields: [
      "reasoning_process",
      "bull_events",
      "bear_events",
      "neutral_events",
      "total_bull_score",
      "total_bear_score",
      "conclusion",
    ],
  },
  {
    name: "News/GenerateSearchQueries",
    description: "AI 動態新聞搜尋 Query 生成",
    type: "chat",
    requiredVars: ["dateStr", "marketStatus", "vix", "staticPoolText"],
    expectedConfig: ["temperature", "responseMimeType", "maxOutputTokens"],
    schemaRequired: true,
    schemaFields: ["reasoning_process", "twQueries", "usQueries"],
  },
  {
    name: "News/RuleOptimizer",
    description: "黑名單規則優化器",
    type: "chat",
    requiredVars: ["regionLabel", "count", "titlesText"],
    expectedConfig: ["temperature", "responseMimeType", "maxOutputTokens"],
    schemaRequired: true,
    schemaFields: ["rules"],
  },
  {
    name: "Report/InvestmentAdvice",
    description: "每日投資建議（AI Coach）",
    type: "chat",
    requiredVars: [
      "dateStr",
      "quantText",
      "macroAndChipStr",
      "macroText",
      "newsSummaryText",
    ],
    expectedConfig: ["temperature", "responseMimeType", "maxOutputTokens"],
    schemaRequired: true,
    schemaFields: [
      "coach_internal_thinking",
      "risk_warnings",
      "action_items",
      "mindset_advice",
    ],
  },
  {
    name: "Report/PeriodReportAnalysis",
    description: "週/月報 AI 分析",
    type: "chat",
    requiredVars: ["period_label", "risk_warnings_text", "stats_summary"],
    expectedConfig: ["temperature", "responseMimeType", "maxOutputTokens"],
    schemaRequired: true,
    schemaFields: ["topRiskEvents", "consistencyComment", "periodOutlook"],
  },
  {
    name: "LLMJudge/JudgeToneAndEmpathy",
    description:
      "自動評估 InvestmentAdvice 輸出中 mindset_advice 的語氣與同理心品質（LLM Judge）",
    type: "chat",
    requiredVars: ["coachOutputJson"],
    expectedConfig: ["temperature", "responseMimeType", "maxOutputTokens"],
    schemaRequired: true,
    schemaFields: ["score", "reason"],
  },
  {
    name: "LLMJudge/JudgeActionability",
    description:
      "自動評估 InvestmentAdvice 輸出中 action_items 的可操作性品質（LLM Judge）",
    type: "chat",
    requiredVars: ["coachOutputJson"],
    expectedConfig: ["temperature", "responseMimeType", "maxOutputTokens"],
    schemaRequired: true,
    schemaFields: ["score", "reason"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Langfuse 初始化
// ─────────────────────────────────────────────────────────────────────────────
function initLangfuse() {
  const missing = [
    "LANGFUSE_PUBLIC_KEY",
    "LANGFUSE_SECRET_KEY",
    "LANGFUSE_BASE_URL",
  ].filter((k) => !process.env[k]);

  if (missing.length > 0) {
    console.error(fail(`缺少環境變數：${missing.join(", ")}`));
    console.error(dim("請確認 .env 已設定 Langfuse 相關金鑰"));
    process.exit(1);
  }

  return new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema 欄位解析（支援 Gemini-style responseSchema 與 JSON Schema 兩種）
// ─────────────────────────────────────────────────────────────────────────────
function extractSchemaTopLevelFields(schema) {
  if (!schema || typeof schema !== "object") return [];

  // Gemini-style：{ type: 'object', properties: { ... } }
  if (schema.properties) return Object.keys(schema.properties);

  // JSON Schema array items：{ type: 'array', items: { properties: { ... } } }
  if (schema.items?.properties) return Object.keys(schema.items.properties);

  // 直接頂層鍵（fallback）
  return Object.keys(schema).filter((k) => !["type", "required"].includes(k));
}

// ─────────────────────────────────────────────────────────────────────────────
// 插值變數偵測（從 prompt 內容找 {{variable}} 佔位符）
// ─────────────────────────────────────────────────────────────────────────────
function detectTemplateVars(text) {
  const matches = text.match(/\{\{(\w+)\}\}/g) ?? [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "")))];
}

// ─────────────────────────────────────────────────────────────────────────────
// 單一 Prompt 驗證
// ─────────────────────────────────────────────────────────────────────────────
async function testPrompt(langfuse, spec) {
  const results = {
    name: spec.name,
    description: spec.description,
    passed: [],
    warnings: [],
    errors: [],
    details: {},
  };

  let promptObj;
  try {
    promptObj = await langfuse.getPrompt(spec.name, undefined, {
      type: spec.type,
    });
  } catch (err) {
    results.errors.push(`Langfuse 無法取得 prompt：${err.message}`);
    return results;
  }

  const messages = promptObj.prompt ?? [];
  const config = promptObj.config ?? {};
  results.details.config = config;
  results.details.promptVersion = promptObj.version ?? "unknown";

  // ── 1. System Prompt 存在 ──────────────────────────────────────────────────
  const systemMsg = messages.find((m) => m.role === "system");
  if (systemMsg?.content) {
    results.passed.push("System Prompt 存在且非空");
    results.details.systemLength = systemMsg.content.length;
    if (VERBOSE)
      results.details.systemSnippet = systemMsg.content.slice(0, 300);
  } else {
    results.errors.push("System Prompt 不存在或為空");
  }

  // ── 2. User Prompt 存在 ───────────────────────────────────────────────────
  const userMsg = messages.find((m) => m.role === "user");
  if (userMsg?.content) {
    results.passed.push("User Prompt 存在且非空");
    results.details.userLength = userMsg.content.length;
    if (VERBOSE) results.details.userSnippet = userMsg.content.slice(0, 400);
  } else {
    results.errors.push("User Prompt 不存在或為空");
  }

  // ── 3. 插值變數偵測（requiredVars） ───────────────────────────────────────
  if (userMsg?.content) {
    const detectedVars = detectTemplateVars(userMsg.content);
    results.details.detectedVars = detectedVars;

    // 檢查 spec 預期的變數是否存在
    for (const v of spec.requiredVars) {
      if (detectedVars.includes(v)) {
        results.passed.push(`User Prompt 包含插值變數 {{${v}}}`);
      } else {
        results.warnings.push(
          `User Prompt 未找到預期插值變數 {{${v}}}（可能已改名或移除）`,
        );
      }
    }

    // 反向：提示有哪些未在 spec 中登記的變數
    const unregistered = detectedVars.filter(
      (v) => !spec.requiredVars.includes(v),
    );
    if (unregistered.length > 0) {
      results.warnings.push(
        `發現未登記的插值變數：{{${unregistered.join("}}, {{")}}}（spec 未列出，請確認是否需要加入 requiredVars）`,
      );
    }
  }

  // ── 4. Config 欄位驗證 ────────────────────────────────────────────────────
  for (const field of spec.expectedConfig) {
    if (config[field] !== undefined) {
      results.passed.push(`Config.${field} = ${JSON.stringify(config[field])}`);
    } else {
      results.warnings.push(`Config 缺少欄位：${field}`);
    }
  }

  // 額外標示 config 裡有哪些「非預期」欄位（幫助發現多餘設定）
  const extraConfigKeys = Object.keys(config).filter(
    (k) => !spec.expectedConfig.includes(k) && k !== "response_schema",
  );
  if (extraConfigKeys.length > 0) {
    results.details.extraConfigKeys = extraConfigKeys;
  }

  // ── 5. Schema 驗證 ────────────────────────────────────────────────────────
  const schema = config.response_schema ?? null;
  results.details.schemaSource = schema ? "langfuse-config" : "none";

  if (spec.schemaRequired) {
    if (!schema) {
      results.errors.push(
        "Config 缺少 response_schema（此 prompt 需要 structured output）",
      );
    } else {
      results.passed.push("response_schema 存在於 Config");

      const topFields = extractSchemaTopLevelFields(schema);
      results.details.schemaTopFields = topFields;

      for (const field of spec.schemaFields) {
        if (topFields.includes(field)) {
          results.passed.push(`Schema 包含預期欄位：${field}`);
        } else {
          results.warnings.push(
            `Schema 未找到預期欄位：${field}（可能已改名或移到巢狀層）`,
          );
        }
      }

      // 印出實際 schema 頂層欄位（供比對）
      const unexpected = topFields.filter(
        (f) => !spec.schemaFields.includes(f),
      );
      if (unexpected.length > 0) {
        results.details.schemaExtraFields = unexpected;
      }
    }
  } else {
    results.passed.push(
      "此 prompt 無需 Schema（spec 標示 schemaRequired: false）",
    );
  }

  // ── 6. responseMimeType 一致性 ────────────────────────────────────────────
  if (spec.schemaRequired && config.response_schema) {
    if (config.responseMimeType === "application/json") {
      results.passed.push(
        "responseMimeType = application/json（與 schema 一致）",
      );
    } else {
      results.warnings.push(
        `有 response_schema 但 responseMimeType = "${config.responseMimeType}"（建議設為 application/json）`,
      );
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// 報表輸出
// ─────────────────────────────────────────────────────────────────────────────
function printResult(result) {
  const total =
    result.passed.length + result.warnings.length + result.errors.length;
  const statusIcon =
    result.errors.length > 0 ? "❌" : result.warnings.length > 0 ? "⚠️ " : "✅";

  console.log(
    `\n${C.bold}${statusIcon} [${result.name}]${C.reset} ${C.dim}${result.description}${C.reset}`,
  );
  console.log(
    dim(
      `   版本: v${result.details.promptVersion}  │  ` +
        `System: ${result.details.systemLength ?? 0} 字元  │  ` +
        `User: ${result.details.userLength ?? 0} 字元  │  ` +
        `SchemaSource: ${result.details.schemaSource ?? "none"}`,
    ),
  );

  if (result.details.detectedVars?.length > 0) {
    console.log(
      dim(
        `   偵測到插值變數: {{${result.details.detectedVars.join("}}, {{")}}}`,
      ),
    );
  }

  if (result.details.schemaTopFields?.length > 0) {
    console.log(
      dim(`   Schema 頂層欄位: ${result.details.schemaTopFields.join(", ")}`),
    );
  }

  if (result.details.extraConfigKeys?.length > 0) {
    console.log(
      dim(`   Config 額外欄位: ${result.details.extraConfigKeys.join(", ")}`),
    );
  }

  if (result.details.schemaExtraFields?.length > 0) {
    console.log(
      dim(
        `   Schema 未登記欄位: ${result.details.schemaExtraFields.join(", ")}`,
      ),
    );
  }

  // Verbose: 顯示 prompt 內容片段
  if (VERBOSE) {
    if (result.details.systemSnippet) {
      console.log(`\n   ${C.magenta}System Prompt (前 300 字元):${C.reset}`);
      console.log(
        result.details.systemSnippet
          .split("\n")
          .map((l) => `   ${dim(l)}`)
          .join("\n"),
      );
    }
    if (result.details.userSnippet) {
      console.log(`\n   ${C.magenta}User Prompt (前 400 字元):${C.reset}`);
      console.log(
        result.details.userSnippet
          .split("\n")
          .map((l) => `   ${dim(l)}`)
          .join("\n"),
      );
    }
    if (Object.keys(result.details.config ?? {}).length > 0) {
      console.log(`\n   ${C.magenta}Config:${C.reset}`);
      const configDisplay = { ...result.details.config };
      if (configDisplay.response_schema) {
        configDisplay.response_schema = `[Schema object, ${
          JSON.stringify(configDisplay.response_schema).length
        } chars]`;
      }
      console.log(
        JSON.stringify(configDisplay, null, 2)
          .split("\n")
          .map((l) => `   ${dim(l)}`)
          .join("\n"),
      );
    }
  }

  // 結果條目
  for (const p of result.passed) console.log(`   ${ok(p)}`);
  for (const w of result.warnings) console.log(`   ${warn(w)}`);
  for (const e of result.errors) console.log(`   ${fail(e)}`);

  console.log(
    dim(
      `   → 通過 ${result.passed.length}／警告 ${result.warnings.length}／錯誤 ${result.errors.length}（共 ${total} 項檢查）`,
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 最終統計
// ─────────────────────────────────────────────────────────────────────────────
function printSummary(allResults, durationMs) {
  const totalPrompts = allResults.length;
  const promptsWithError = allResults.filter((r) => r.errors.length > 0).length;
  const promptsWithWarn = allResults.filter(
    (r) => r.errors.length === 0 && r.warnings.length > 0,
  ).length;
  const promptsOk = totalPrompts - promptsWithError - promptsWithWarn;

  const totalPassed = allResults.reduce((s, r) => s + r.passed.length, 0);
  const totalWarn = allResults.reduce((s, r) => s + r.warnings.length, 0);
  const totalErr = allResults.reduce((s, r) => s + r.errors.length, 0);

  console.log(section("測試結果總覽"));
  console.log(
    `   Prompt 總數：${totalPrompts}  ` +
      `${C.green}全通過：${promptsOk}${C.reset}  ` +
      `${C.yellow}有警告：${promptsWithWarn}${C.reset}  ` +
      `${C.red}有錯誤：${promptsWithError}${C.reset}`,
  );
  console.log(
    `   檢查項目：${C.green}通過 ${totalPassed}${C.reset}  ` +
      `${C.yellow}警告 ${totalWarn}${C.reset}  ` +
      `${C.red}錯誤 ${totalErr}${C.reset}`,
  );
  console.log(dim(`   耗時：${(durationMs / 1000).toFixed(2)}s`));

  if (promptsWithError === 0 && promptsWithWarn === 0) {
    console.log(`\n${C.green}${C.bold}🎉 所有 Prompt 驗證通過！${C.reset}`);
  } else {
    if (promptsWithError > 0) {
      console.log(
        `\n${C.red}${C.bold}🚨 有 ${promptsWithError} 個 Prompt 驗證失敗，請優先修正 ❌ 項目${C.reset}`,
      );
    }
    if (promptsWithWarn > 0) {
      console.log(
        `${C.yellow}⚠️  有 ${promptsWithWarn} 個 Prompt 有警告，請確認 ⚠️ 項目是否需要更新 spec${C.reset}`,
      );
    }
  }

  console.log("");

  // 只在有錯誤時以非 0 exit code 退出，警告不影響 CI
  if (promptsWithError > 0) process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(
    `${C.bold}${C.blue}╔══════════════════════════════════════════╗${C.reset}`,
  );
  console.log(
    `${C.bold}${C.blue}║   AI Prompt 驗證測試                    ║${C.reset}`,
  );
  console.log(
    `${C.bold}${C.blue}╚══════════════════════════════════════════╝${C.reset}`,
  );

  if (FILTER_PROMPT) {
    console.log(info(`過濾模式：只測試 "${FILTER_PROMPT}"`));
  }
  if (VERBOSE) {
    console.log(info("Verbose 模式：顯示 Prompt 內容片段與完整 Config"));
  }

  const langfuse = initLangfuse();
  const startTime = Date.now();

  const specs = FILTER_PROMPT
    ? PROMPT_SPECS.filter(
        (s) =>
          s.name === FILTER_PROMPT ||
          s.name.endsWith(`/${FILTER_PROMPT}`) ||
          s.description.includes(FILTER_PROMPT),
      )
    : PROMPT_SPECS;

  if (specs.length === 0) {
    console.error(
      fail(`找不到符合 "${FILTER_PROMPT}" 的 prompt，請確認名稱是否正確`),
    );
    console.log(
      info(
        `可用 prompt 名稱：\n${PROMPT_SPECS.map((s) => `  - ${s.name}`).join("\n")}`,
      ),
    );
    process.exit(1);
  }

  console.log(
    info(
      `開始測試 ${specs.length} 個 prompt（Langfuse: ${process.env.LANGFUSE_BASE_URL}）`,
    ),
  );

  const allResults = [];

  for (const spec of specs) {
    const result = await testPrompt(langfuse, spec);
    printResult(result);
    allResults.push(result);
  }

  await langfuse.flushAsync().catch(() => {});

  printSummary(allResults, Date.now() - startTime);
}

main().catch((err) => {
  console.error(fail(`測試執行失敗：${err.message}`));
  console.error(err.stack);
  process.exit(1);
});
