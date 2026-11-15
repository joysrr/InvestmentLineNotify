#!/usr/bin/env node
/**
 * verify-doc-code-sync.mjs
 * 文檔與代碼一致性驗收工具
 *
 * 檢查項：
 *   1. OpenAPI paths ↔ 代碼 route 雙向一致
 *   2. wiki-index related_code 路徑存在性
 *   3. README 聲稱端點數 vs OpenAPI 實際數
 *
 * 退出碼：0 = 全通過，1 = 有 FAIL
 * 用法：node scripts/verify-doc-code-sync.mjs [--json]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = (p) => path.join(ROOT, p);
const rel = (p) => path.relative(ROOT, p);

const results = [];
const add = (level, check, detail) => results.push({ level, check, detail });

// ---------- 1. OpenAPI 解析 ----------
const openapiPath = R("docs/api/openapi.json");
const openapi = JSON.parse(fs.readFileSync(openapiPath, "utf8"));
const openapiPaths = Object.keys(openapi.paths || {});
const HTTP_METHODS = ["get", "post", "put", "patch", "delete"];
let openapiOps = 0;
for (const p of openapiPaths) {
  for (const m of Object.keys(openapi.paths[p])) {
    if (HTTP_METHODS.includes(m)) openapiOps++;
  }
}

// ---------- 2. 代碼 route 抽取 ----------
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".mjs") && !e.name.endsWith(".test.mjs")) out.push(p);
  }
  return out;
}
const apiFiles = walk(R("src/api"));
const routeRe = /\b(?:fastify|app|server|f|instance)\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/g;
const codeRoutes = [];
for (const f of apiFiles) {
  const src = fs.readFileSync(f, "utf8");
  let m;
  while ((m = routeRe.exec(src))) {
    const line = src.slice(0, m.index).split("\n").length;
    codeRoutes.push({ method: m[1].toUpperCase(), path: m[2], file: rel(f), line });
  }
}
// server.mjs 的 /health /healthz 不在 /api prefix 下，單獨處理
const codeRouteSet = new Set(codeRoutes.map((r) => `${r.method} ${r.path}`));
const openapiRouteSet = new Set();
for (const p of openapiPaths) {
  for (const m of Object.keys(openapi.paths[p])) {
    if (HTTP_METHODS.includes(m)) openapiRouteSet.add(`${m.toUpperCase()} ${p}`);
  }
}

// ---------- 3. 交叉比對 ----------
// 3a. OpenAPI 有但代碼無（扣除 /api prefix、參數名差異）
const normalize = (r) =>
  r.replace(/\/api/, "").replace(/\{[^}]+\}/g, "{param}").replace(/\/:[^/]+/g, "/{param}");
const codeNormalized = new Set([...codeRouteSet].map(normalize));
const openapiNormalized = new Set([...openapiRouteSet].map(normalize));

const onlyInOpenapi = [...openapiNormalized].filter((r) => !codeNormalized.has(r));
const onlyInCode = [...codeNormalized].filter((r) => !openapiNormalized.has(r));

if (onlyInOpenapi.length === 0) {
  add("PASS", "OpenAPI → 代碼", "所有 OpenAPI 端點都在代碼中存在");
} else {
  add("FAIL", "OpenAPI → 代碼", `${onlyInOpenapi.length} 個端點文檔有但代碼無：\n    ` + onlyInOpenapi.join("\n    "));
}
if (onlyInCode.length === 0) {
  add("PASS", "代碼 → OpenAPI", "所有代碼端點都在 OpenAPI 中記載");
} else {
  add("FAIL", "代碼 → OpenAPI", `${onlyInCode.length} 個端點代碼有但文檔無：\n    ` + onlyInCode.join("\n    "));
}

// 3b. wiki-index 路徑存活
const wikiPath = R("docs/wiki-index.json");
if (fs.existsSync(wikiPath)) {
  const idx = JSON.parse(fs.readFileSync(wikiPath, "utf8"));
  const paths = new Set();
  for (const c in idx.concepts || {}) {
    for (const p of idx.concepts[c].related_code || []) paths.add(p);
  }
  const missing = [...paths].filter((p) => !fs.existsSync(R(p)));
  // .env 和執行期生成的檔案不算斷鏈
  const EXPECTED_MISSING = new Set([".env", "data/config/blacklist.json"]);
  const realMissing = missing.filter((p) => !EXPECTED_MISSING.has(p));
  if (realMissing.length === 0) {
    add("PASS", "wiki-index 路徑", `${paths.size} 條映射，無真實斷鏈（${missing.length} 條屬預期缺失）`);
  } else {
    add("FAIL", "wiki-index 路徑", `${realMissing.length} 條真實斷鏈：\n    ` + realMissing.join("\n    "));
  }
}

// 3c. README 端點數聲明
const readme = fs.readFileSync(R("docs/README.md"), "utf8");
const m = readme.match(/共\s*(\d+)\s*個端點/);
if (m) {
  const claimed = parseInt(m[1], 10);
  if (claimed === openapiOps) {
    add("PASS", "README 端點數", `README 聲稱 ${claimed} = OpenAPI 實際 ${openapiOps}`);
  } else {
    add("FAIL", "README 端點數", `README 聲稱 ${claimed} ≠ OpenAPI 實際 ${openapiOps}`);
  }
}

// ---------- 4. 輸出 ----------
const isJson = process.argv.includes("--json");
if (isJson) {
  console.log(JSON.stringify({ summary: { openapiOps, openapiPaths: openapiPaths.length, codeRoutes: codeRoutes.length }, results }, null, 2));
} else {
  console.log("=".repeat(60));
  console.log("文檔與代碼一致性驗收");
  console.log("=".repeat(60));
  console.log(`OpenAPI paths: ${openapiPaths.length} | operations: ${openapiOps}`);
  console.log(`代碼 routes: ${codeRoutes.length}`);
  console.log("-".repeat(60));
  for (const r of results) {
    const icon = r.level === "PASS" ? "[PASS]" : r.level === "FAIL" ? "[FAIL]" : "[INFO]";
    console.log(`${icon} ${r.check}`);
    console.log(`       ${r.detail}`);
  }
  console.log("=".repeat(60));
  const fails = results.filter((r) => r.level === "FAIL").length;
  console.log(fails === 0 ? "結果：全部通過" : `結果：${fails} 項失敗`);
}
process.exit(results.some((r) => r.level === "FAIL") ? 1 : 0);
