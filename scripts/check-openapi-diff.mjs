#!/usr/bin/env node
/**
 * Check OpenAPI Spec Breaking Changes
 * 比對 git HEAD 與當前 spec，偵測 breaking changes
 * 執行方式: npm run openapi:check
 * 回傳: 0 = 無 breaking changes, 1 = 有 breaking changes
 */

import { execSync } from "child_process";
import { readFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SPEC_PATH = resolve(__dirname, "../docs/api/openapi.json");

/**
 * 從 git 取得上一個 commit 的 spec
 */
function getGitHeadSpec() {
  try {
    const output = execSync("git show HEAD:docs/api/openapi.json 2>/dev/null", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    return JSON.parse(output);
  } catch {
    return null; // 第一次 commit 或無檔案
  }
}

/**
 * 比對兩個 spec 的 paths
 */
function diffPaths(oldPaths, newPaths) {
  const changes = {
    removed: [],
    added: [],
    modified: [],
  };
  
  const allPaths = new Set([...Object.keys(oldPaths || {}), ...Object.keys(newPaths || {})]);
  
  for (const path of allPaths) {
    if (!(path in (oldPaths || {}))) {
      changes.added.push(path);
    } else if (!(path in (newPaths || {}))) {
      changes.removed.push(path);
    } else {
      // 簡單比較方法層級
      const oldMethods = Object.keys(oldPaths[path] || {});
      const newMethods = Object.keys(newPaths[path] || {});
      const allMethods = new Set([...oldMethods, ...newMethods]);
      
      for (const method of allMethods) {
        if (!(method in (oldPaths[path] || {}))) {
          changes.added.push(`${method.toUpperCase()} ${path}`);
        } else if (!(method in (newPaths[path] || {}))) {
          changes.removed.push(`${method.toUpperCase()} ${path}`);
        }
      }
    }
  }
  
  return changes;
}

/**
 * 比對 schemas (components.schemas)
 */
function diffSchemas(oldSchemas, newSchemas) {
  const changes = {
    removed: [],
    added: [],
    modified: [],
  };
  
  const allSchemas = new Set([...Object.keys(oldSchemas || {}), ...Object.keys(newSchemas || {})]);
  
  for (const schema of allSchemas) {
    if (!(schema in (oldSchemas || {}))) {
      changes.added.push(schema);
    } else if (!(schema in (newSchemas || {}))) {
      changes.removed.push(schema);
    } else {
      // 深度比較 schema 結構 (簡化版)
      const oldDef = oldSchemas[schema];
      const newDef = newSchemas[schema];
      
      if (JSON.stringify(oldDef) !== JSON.stringify(newDef)) {
        changes.modified.push(schema);
      }
    }
  }
  
  return changes;
}

/**
 * 判斷是否為 breaking change
 */
function isBreakingChange(changes) {
  const breaking = [];
  
  // 移除 endpoint = breaking
  if (changes.paths.removed.length > 0) {
    breaking.push(`Removed endpoints: ${changes.paths.removed.join(", ")}`);
  }
  
  // 移除 HTTP 方法 = breaking
  const removedMethods = changes.paths.removed.filter(c => c.includes(" "));
  if (removedMethods.length > 0) {
    breaking.push(`Removed methods: ${removedMethods.join(", ")}`);
  }
  
  // 移除 schema = breaking (如果有 endpoint 使用)
  if (changes.schemas.removed.length > 0) {
    breaking.push(`Removed schemas: ${changes.schemas.removed.join(", ")}`);
  }
  
  // 修改 schema 可能 breaking (需進一步分析 required 欄位、型別)
  if (changes.schemas.modified.length > 0) {
    breaking.push(`Modified schemas (potential breaking): ${changes.schemas.modified.join(", ")}`);
  }
  
  return breaking;
}

async function main() {
  console.log("🔍 Checking OpenAPI spec for breaking changes...\n");
  
  // 讀取當前 spec
  let currentSpec;
  try {
    const content = await readFile(SPEC_PATH, "utf-8");
    currentSpec = JSON.parse(content);
  } catch {
    console.error("❌ Current spec not found at", SPEC_PATH);
    console.error("   Run 'npm run openapi:generate' first");
    process.exit(1);
  }
  
  // 讀取 git HEAD spec
  const headSpec = getGitHeadSpec();
  
  if (!headSpec) {
    console.log("ℹ️  No previous spec in git history (first commit or file not tracked)");
    console.log("✅ No breaking changes to compare against");
    process.exit(0);
  }
  
  console.log("📊 Comparing with HEAD commit...\n");
  
  // 比對 paths
  const pathsDiff = diffPaths(headSpec.paths, currentSpec.paths);
  
  // 比對 schemas
  const schemasDiff = diffSchemas(
    headSpec.components?.schemas, 
    currentSpec.components?.schemas
  );
  
  // 判斷 breaking changes
  const allChanges = { paths: pathsDiff, schemas: schemasDiff };
  const breaking = isBreakingChange(allChanges);
  
  // 輸出結果
  if (pathsDiff.added.length > 0) {
    console.log("➕ Added endpoints:");
    for (const p of pathsDiff.added) console.log(`   + ${p}`);
  }
  
  if (pathsDiff.removed.length > 0) {
    console.log("➖ Removed endpoints:");
    for (const p of pathsDiff.removed) console.log(`   - ${p}`);
  }
  
  if (schemasDiff.added.length > 0) {
    console.log("📦 Added schemas:");
    for (const s of schemasDiff.added) console.log(`   + ${s}`);
  }
  
  if (schemasDiff.removed.length > 0) {
    console.log("🗑️  Removed schemas:");
    for (const s of schemasDiff.removed) console.log(`   - ${s}`);
  }
  
  if (schemasDiff.modified.length > 0) {
    console.log("🔄 Modified schemas:");
    for (const s of schemasDiff.modified) console.log(`   ~ ${s}`);
  }
  
  console.log("");
  
  if (breaking.length > 0) {
    console.log("❌ BREAKING CHANGES DETECTED:");
    for (const b of breaking) console.log(`   - ${b}`);
    console.log("\n💡 Please consider version bump (major) or ensure backward compatibility.");
    process.exit(1);
  } else {
    console.log("✅ No breaking changes detected");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("❌ Check failed:", err.message);
  process.exit(1);
});