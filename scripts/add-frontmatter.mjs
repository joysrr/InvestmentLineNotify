#!/usr/bin/env node
/**
 * 自動為文件添加 frontmatter
 *
 * 使用方式: node scripts/add-frontmatter.mjs <file-path>
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, basename } from "path";

const TYPES = {
  guide: ["tutorial", "getting-started", "testing-guide"],
  reference: ["api", "contract", "spec", "audit", "param"],
  explanation: ["design", "architecture", "dec-", "adr-"],
  tutorial: ["e2e", "deployment", "troubleshooting"],
  report: ["report", "findings", "baseline", "review"],
  plan: ["plan", "spec"],
};

function inferType(filePath) {
  const lower = filePath.toLowerCase();

  for (const [type, keywords] of Object.entries(TYPES)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return type;
    }
  }

  return "reference";
}

function inferStatus(filePath) {
  const lower = filePath.toLowerCase();

  if (
    lower.includes("archive") ||
    lower.includes("deprecated") ||
    lower.includes("completed")
  ) {
    return "archived";
  }
  if (lower.includes("draft") || lower.includes("wip")) {
    return "in-progress";
  }
  if (lower.includes("deprecated") || lower.includes("v3")) {
    return "deprecated";
  }

  return "current";
}

function generateFrontmatter(filePath) {
  const type = inferType(filePath);
  const status = inferStatus(filePath);
  const today = new Date().toISOString().split("T")[0];

  return `---
type: ${type}
status: ${status}
last_updated: ${today}
tags:
  - auto-generated
wiki_links: []
---

`;
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("使用方式: node scripts/add-frontmatter.mjs <file-path>");
    process.exit(1);
  }

  const filePath = resolve(args[0]);

  try {
    const content = readFileSync(filePath, "utf-8");

    if (content.startsWith("---")) {
      console.log(`✅ ${basename(filePath)} 已有 frontmatter`);
      process.exit(0);
    }

    const frontmatter = generateFrontmatter(filePath);
    const newContent = frontmatter + content;

    writeFileSync(filePath, newContent, "utf-8");
    console.log(`✅ 已為 ${basename(filePath)} 添加 frontmatter`);
    console.log(
      `   type: ${inferType(filePath)}, status: ${inferStatus(filePath)}`,
    );
  } catch (error) {
    console.error(`❌ 錯誤: ${error.message}`);
    process.exit(1);
  }
}

main();
