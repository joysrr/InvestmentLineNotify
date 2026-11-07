/**
 * 驗證前後端 API 端點映射一致性
 * TDD: RED -> GREEN -> REFACTOR -> VERIFY
 *
 * 退出碼：0 = 全部一致，1 = 發現差異
 */

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const ROUTES_DIR = path.join(ROOT, "src", "api", "routes");
const CONFIG_FILE = path.join(ROOT, "webapp", "src", "api", "config.js");

let failures = 0;

// ── 1. 從後端路由文件提取路由 ──
function extractBackendRoutes() {
  const routes = [];
  const files = fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith(".mjs"));

  for (const file of files) {
    const content = fs.readFileSync(path.join(ROUTES_DIR, file), "utf8");
    const methodRegex =
      /fastify\.(get|post|put|delete|patch)\(\s*["']([^"']+)["']/g;
    let match;
    while ((match = methodRegex.exec(content)) !== null) {
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2],
        file,
      });
    }
  }
  return routes;
}

// ── 2. 從前端 config.js 提取 ENDPOINTS ──
function extractFrontendEndpoints() {
  const content = fs.readFileSync(CONFIG_FILE, "utf8");
  const endpoints = {};

  // 匹配 key: "/path" (單引號或雙引號)
  const simpleRegex = /(\w+):\s*["']([^"']+)["']/g;
  let match;
  while ((match = simpleRegex.exec(content)) !== null) {
    endpoints[match[1]] = match[2];
  }

  // 匹配 nested: snapshots: { list: "/snapshots", ... }
  const nestedRegex = /(\w+)\s*:\s*\{([^}]+)\}/gs;
  while ((match = nestedRegex.exec(content)) !== null) {
    const group = match[1];
    const inner = match[2];
    const innerRegex = /(\w+):\s*["']([^"']+)["']/g;
    let innerMatch;
    while ((innerMatch = innerRegex.exec(inner)) !== null) {
      endpoints[`${group}.${innerMatch[1]}`] = innerMatch[2];
    }
  }

  return endpoints;
}

// ── 3. 檢查前端 ENDPOINTS 是否被元件調用 ──
function checkUnusedEndpoints(endpoints) {
  const srcDir = path.join(ROOT, "webapp", "src");
  const files = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".vue") || entry.name.endsWith(".js"))
        files.push(full);
    }
  }
  walk(srcDir);

  const allCode = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");

  const unused = [];
  for (const [key] of Object.entries(endpoints)) {
    const usageRegex = new RegExp(`ENDPOINTS\\.${key.replace(".", "\\.")}`);
    if (!usageRegex.test(allCode)) {
      unused.push(key);
    }
  }
  return unused;
}

// ── 主驗證 ──
const backendRoutes = extractBackendRoutes();
const frontendEndpoints = extractFrontendEndpoints();
const unusedEndpoints = checkUnusedEndpoints(frontendEndpoints);

const backendPathSet = new Set();
for (const r of backendRoutes) {
  backendPathSet.add(`/api${r.path}`);
}

console.log("=== 前後端 API 端點映射驗證 ===\n");
console.log(`後端路由總數: ${backendRoutes.length}`);
console.log(`前端 ENDPOINTS 總數: ${Object.keys(frontendEndpoints).length}\n`);

// 檢查每個前端 ENDPOINTS 是否有後端對應
console.log("--- 前端 ENDPOINTS -> 後端路由比對 ---");
for (const [key, endpointPath] of Object.entries(frontendEndpoints)) {
  const fullPath = `/api${endpointPath}`;
  const normalizedPath = fullPath.replace(/\$\{[^}]+\}/g, ":param");
  const exists = backendPathSet.has(normalizedPath);
  const status = exists ? "✓" : "✗";
  if (!exists) {
    failures++;
  }
  console.log(
    `  ${status} ${key}: ${endpointPath}${exists ? "" : " → 無後端對應"}`,
  );
}

console.log("\n--- 前端 ENDPOINTS 未被調用（僅報告）---");
if (unusedEndpoints.length === 0) {
  console.log("  無");
} else {
  for (const u of unusedEndpoints) {
    console.log(`  ⚠ ${u}: ${frontendEndpoints[u]} 未被任何元件調用`);
  }
}

console.log("\n--- 後端路由前端 ENDPOINTS 未定義（僅報告）---");
const frontendPathSet = new Set();
for (const endpointPath of Object.values(frontendEndpoints)) {
  frontendPathSet.add(`/api${endpointPath}`);
}
for (const r of backendRoutes) {
  const fullPath = `/api${r.path}`;
  if (!frontendPathSet.has(fullPath)) {
    console.log(
      `  ℹ ${r.method} ${fullPath} (${r.file}) - 前端未定義 ENDPOINTS`,
    );
  }
}

console.log(`\n=== 結果：${failures} 個失敗 ===`);
process.exit(failures > 0 ? 1 : 0);
