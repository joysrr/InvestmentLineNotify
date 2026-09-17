import { describe, it, expect, beforeAll } from "vitest";
import { LangfuseClient } from "@langfuse/client";
import "dotenv/config";

// --- Prompt Specs (Simplified for brevity in the walkthrough, but full in code) ---
const PROMPT_SPECS = [
  {
    name: "News/FilterAndCategorizeNews",
    requiredVars: ["newsListText"],
    expectedConfig: ["temperature", "responseMimeType", "maxOutputTokens"],
  },
  {
    name: "News/AnalyzeMacroNews",
    requiredVars: ["dateStr", "newsText"],
    expectedConfig: ["temperature", "responseMimeType", "maxOutputTokens"],
  },
  {
    name: "News/GenerateSearchQueries",
    requiredVars: ["dateStr", "marketStatus", "vix", "staticPoolText"],
    expectedConfig: ["temperature", "responseMimeType", "maxOutputTokens"],
  },
  {
    name: "Report/InvestmentAdvice",
    requiredVars: [
      "dateStr",
      "quantText",
      "macroAndChipStr",
      "macroText",
      "newsSummaryText",
    ],
    expectedConfig: ["temperature", "responseMimeType", "maxOutputTokens"],
  },
  // ... can add more as needed, but let's start with core ones
];

describe("Langfuse AI Prompt Validation", () => {
  let langfuseClient;

  beforeAll(() => {
    const missing = ["LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY"].filter(
      (k) => !process.env[k],
    );

    if (missing.length > 0) {
      console.warn(`⚠️ 跳過 Langfuse 測試：缺少環境變數 ${missing.join(", ")}`);
      return;
    }

    langfuseClient = new LangfuseClient({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
    });
  });

  PROMPT_SPECS.forEach((spec) => {
    it(`Prompt: ${spec.name} 應符合規範`, async () => {
      if (!langfuseClient) return; // Skip if no config

      const promptObj = await langfuseClient.prompt.get(spec.name, {
        label: "production",
      });
      expect(promptObj).toBeDefined();

      const messages = promptObj.prompt ?? [];
      const config = promptObj.config ?? {};

      // 1. Check User Prompt
      const userMsg = messages.find((m) => m.role === "user");
      expect(userMsg?.content).toBeDefined();

      // 2. Check Required Vars
      const detectedVars = (userMsg.content.match(/\{\{(\w+)\}\}/g) ?? []).map(
        (m) => m.replace(/\{\{|\}\}/g, ""),
      );
      spec.requiredVars.forEach((v) => {
        expect(detectedVars).toContain(v);
      });

      // 3. Check Config
      spec.expectedConfig.forEach((field) => {
        expect(config[field]).toBeDefined();
      });
    });
  });
});
