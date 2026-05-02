#!/usr/bin/env node
// artifact-format-validator.mjs — 驗證產出物符合 M2M 合約（PROPOSAL_20260422_003）
// 使用：node .agents/tests/artifact-format-validator.mjs <file>

import { readFileSync, existsSync } from "node:fs";

const SYMBOLS = ["🔴", "❌", "🟡", "✅", "🟢"];

const RULES = {
  REVIEW_REPORT: {
    firstLine: /^[🔴❌🟡✅🟢]\s+.+$/,
    description: "第一行為五級符號 + 一句話摘要",
  },
  SECURITY_REPORT: {
    firstLine: /^【@Security 資安審查報告】[🔴❌🟡✅🟢]\s+.+$/,
    description: "第一行為 【@Security 資安審查報告】<符號> <摘要>",
  },
  TEST_REPORT: {
    firstLine: /^[🔴❌🟡✅🟢]\s+測試結論[：:]\s*(通過|未通過)/,
    description: "第一行為 <符號> 測試結論：通過/未通過",
  },
  TEST_SPEC: {
    firstLine: /^📋\s*TEST_SPEC[：:]\s*.+$/,
    description: "第一行為 📋 TEST_SPEC: <功能名稱>",
  },
};

const FORBIDDEN_PREAMBLES = ["好的", "我已", "經過", "讓我", "首先"];
const FORBIDDEN_CLOSINGS = ["希望", "以上是", "請參考", "如有", "謝謝"];

function detectType(filePath) {
  const name = filePath.split("/").pop();
  if (name.includes("REVIEW_REPORT")) return "REVIEW_REPORT";
  if (name.includes("SECURITY_REPORT")) return "SECURITY_REPORT";
  if (name.includes("TEST_REPORT")) return "TEST_REPORT";
  if (name.match(/TEST_SPEC_/)) return "TEST_SPEC";
  return null;
}

function validateArtifact(filePath) {
  if (!existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return 2;
  }

  const type = detectType(filePath);
  if (!type) {
    console.warn(`⚠️  Unknown artifact type: ${filePath}`);
    return 1;
  }

  const rule = RULES[type];
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const firstLine = lines[0];

  console.log(`🔍 Validating ${type}: ${filePath}\n`);

  let errors = 0;

  // 1. 首行符號錨點
  if (!rule.firstLine.test(firstLine)) {
    console.error(`❌ First line does not match: ${rule.description}`);
    console.error(`   Found: "${firstLine.slice(0, 60)}..."`);
    errors++;
  } else {
    console.log(`✅ First line format OK`);
  }

  // 2. 禁止前言
  for (const preamble of FORBIDDEN_PREAMBLES) {
    if (content.slice(0, 500).includes(preamble)) {
      console.warn(`⚠️  Possible forbidden preamble found: "${preamble}"`);
    }
  }

  // 3. 禁止結語
  const lastChunk = content.slice(-500);
  for (const closing of FORBIDDEN_CLOSINGS) {
    if (lastChunk.includes(closing)) {
      console.warn(`⚠️  Possible forbidden closing found: "${closing}"`);
    }
  }

  console.log(`\n─────────────────────────────`);
  console.log(`Summary: ${errors} errors`);
  console.log(`─────────────────────────────`);
  return errors > 0 ? 2 : 0;
}

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node artifact-format-validator.mjs <file>");
  process.exit(2);
}
process.exit(validateArtifact(filePath));
