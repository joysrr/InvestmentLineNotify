#!/usr/bin/env node
/**
 * Pre-commit hook: 驗證新增/修改的文件是否有 frontmatter
 *
 * 使用方式: 由 husky pre-commit hook 自動呼叫
 */

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const DOCS_DIR = "docs/";
const REQUIRED_FRONTMATTER_FIELDS = ["type", "status", "last_updated"];

// 取得 staged 的 .md 文件
function getStagedMarkdownFiles() {
  try {
    const output = execSync("git diff --cached --name-only --diff-filter=ACM", {
      encoding: "utf-8",
    });
    return output
      .split("\n")
      .filter((file) => file.startsWith(DOCS_DIR) && file.endsWith(".md"))
      .filter((file) => file.length > 0);
  } catch {
    return [];
  }
}

// 檢查文件是否有有效的 frontmatter
function checkFrontmatter(filePath) {
  const fullPath = resolve(filePath);

  if (!existsSync(fullPath)) {
    return { valid: false, reason: "File does not exist" };
  }

  try {
    const content = readFileSync(fullPath, "utf-8");

    // 檢查是否以 --- 開頭
    if (!content.startsWith("---")) {
      return {
        valid: false,
        reason: "Missing frontmatter (must start with ---)",
      };
    }

    // 提取 frontmatter
    const lines = content.split("\n");
    const endIndex = lines.indexOf("---", 1);

    if (endIndex === -1) {
      return { valid: false, reason: "Frontmatter not properly closed" };
    }

    const frontmatter = lines.slice(1, endIndex).join("\n");

    // 檢查必要欄位
    const missing = REQUIRED_FRONTMATTER_FIELDS.filter(
      (field) => !frontmatter.includes(`${field}:`),
    );

    if (missing.length > 0) {
      return {
        valid: false,
        reason: `Missing required fields: ${missing.join(", ")}`,
      };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, reason: error.message };
  }
}

// 主程式
function main() {
  const stagedFiles = getStagedMarkdownFiles();

  if (stagedFiles.length === 0) {
    // 沒有文件需要檢查
    process.exit(0);
  }

  console.log(`\n📋 檢查 ${stagedFiles.length} 個文件的 frontmatter...\n`);

  const failures = [];

  for (const file of stagedFiles) {
    const result = checkFrontmatter(file);

    if (!result.valid) {
      failures.push({ file, reason: result.reason });
      console.log(`❌ ${file}`);
      console.log(`   理由: ${result.reason}`);
    } else {
      console.log(`✅ ${file}`);
    }
  }

  if (failures.length > 0) {
    console.log(`\n⚠️  發現 ${failures.length} 個文件缺少有效的 frontmatter\n`);
    console.log(`請確保所有 docs/ 下的 .md 文件都包含:\n`);
    console.log(`---`);
    console.log(`type: reference|tutorial|explanation|report|plan`);
    console.log(`status: current|archived|deprecated|in-progress`);
    console.log(`last_updated: YYYY-MM-DD`);
    console.log(`tags:`);
    console.log(`  - tag1`);
    console.log(`wiki_links: []`);
    console.log(`---\n`);
    console.log(
      `提示: 執行 'node scripts/add-frontmatter.mjs <file>' 自動添加\n`,
    );

    process.exit(1);
  }

  console.log(`\n✅ 所有文件檢查通過!\n`);
  process.exit(0);
}

main();
