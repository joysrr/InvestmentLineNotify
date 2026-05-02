#!/usr/bin/env node
// ref-validator.mjs
// 驗證 rules / skills frontmatter 內 `!ref <file>#<anchor>` 標記的：
//   1. 目標檔案存在
//   2. anchor 實際可定位（標題 / 參數名 / YAML key）
//   3. 循環引用偵測（DFS）
// 依 PROPOSAL_20260422_029 建立
//
// 使用：node .agents/tests/ref-validator.mjs
//
// 退出碼：
//   0 = 全部 !ref 有效
//   1 = warning（anchor 模糊可能對應）
//   2 = error（檔案不存在 / anchor 無法定位 / 循環引用）

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_ROOT = join(__dirname, "..");
// PROPOSAL_502_018 R-2 擴展：加 tasks/（5 個壞 ADR 連結來源）
const SCAN_DIRS = [
  join(AGENTS_ROOT, "rules"),
  join(AGENTS_ROOT, "skills"),
  join(AGENTS_ROOT, "tasks"),
];

let errors = 0;
let warnings = 0;

function err(msg) {
  console.error(`❌ [ERROR] ${msg}`);
  errors++;
}
function warn(msg) {
  console.warn(`⚠️  [WARN]  ${msg}`);
  warnings++;
}
function info(msg) {
  console.log(`ℹ️  ${msg}`);
}
function vlog(msg) {
  if (process.argv.includes("--verbose")) console.log(`   ${msg}`);
}

// 遞迴掃 .md 檔（PROPOSAL_502_012 L-1；skills/ 加 templates/examples/checklists 子目錄後需要）
function walkMd(dir, results = []) {
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walkMd(p, results);
    else if (entry.name.endsWith(".md"))
      results.push({ path: p, name: entry.name });
  }
  return results;
}

// -------- 1. 掃描所有 !ref 引用 --------
function scanRefs() {
  const refs = [];
  for (const dir of SCAN_DIRS) {
    if (!existsSync(dir)) continue;
    for (const { path, name: f } of walkMd(dir)) {
      const content = readFileSync(path, "utf-8");

      // 只掃描 frontmatter 區塊
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!fmMatch) continue;
      const fm = fmMatch[1];

      // PROPOSAL_502_018 R-2 擴展：掃 body markdown ADR/file links
      // 形式：[ADR-NNNN](../decisions/<filename>.md) or (skills/foo.md) etc.
      const bodyLinkRegex =
        /\[(?:ADR-\d+|[^\]]+?)\]\(\.\.\/decisions\/(\d{4}-[a-z0-9-]+\.md)\)/g;
      let bm;
      while ((bm = bodyLinkRegex.exec(content)) !== null) {
        // 推導完整路徑：相對 .agents/ 從 task / rule / skill 出發
        const targetFile = `decisions/${bm[1]}`;
        refs.push({
          source: f,
          sourcePath: path,
          key: "_body_link",
          targetFile,
          anchor: "__body_link__",
          isBodyLink: true,
        });
      }

      // 解析 !ref <file>#<anchor>
      const regex = /^\s*([A-Za-z_][\w]*)\s*:\s*!ref\s+([^\s#]+)#(\S+)\s*$/gm;
      let m;
      while ((m = regex.exec(fm)) !== null) {
        refs.push({
          source: f,
          sourcePath: path,
          key: m[1],
          targetFile: m[2],
          anchor: m[3],
        });
      }
    }
  }
  return refs;
}

// -------- 2. 驗證目標檔案存在 --------
function validateFileExists(ref) {
  const targetPath = resolve(AGENTS_ROOT, ref.targetFile);
  if (!existsSync(targetPath)) {
    err(
      `${ref.source}: target file not found: ${ref.targetFile} (resolved: ${targetPath})`,
    );
    return null;
  }
  return targetPath;
}

// -------- 3. 驗證 anchor 可定位 --------
// 支援三種 anchor 格式：
//   A. 章節名（如 #十四）→ 匹配 "^## 十四、" 標題
//   B. 參數名（如 #REVIEW_CYCLE_LIMIT）→ 匹配表格第一欄 `` `REVIEW_CYCLE_LIMIT` ``
//   C. YAML key（如 SYSTEM_THRESHOLDS.yaml#review_cycle_limit）→ YAML 頂層或巢狀 key
function validateAnchor(ref, targetPath) {
  const content = readFileSync(targetPath, "utf-8");
  const anchor = ref.anchor;

  // 模式 A：章節標題（中文數字如 十四）
  // 匹配 "## <anchor>、" 或 "## <anchor>" 開頭的 H2
  const chapterRegex = new RegExp(`^##\\s+${escapeRegExp(anchor)}[、\\s]`, "m");
  if (chapterRegex.test(content)) {
    vlog(`${ref.source}: anchor '${anchor}' matched as chapter heading`);
    return true;
  }

  // 模式 B：表格參數名 `` `<anchor>` ``（對齐 RULES_DESIGN_GUIDE §十四 表格）
  const paramRegex = new RegExp(`\\|\\s*\`${escapeRegExp(anchor)}\`\\s*\\|`);
  if (paramRegex.test(content)) {
    vlog(`${ref.source}: anchor '${anchor}' matched as table parameter`);
    return true;
  }

  // 模式 C：YAML 頂層 key（for .yaml files）
  if (ref.targetFile.endsWith(".yaml") || ref.targetFile.endsWith(".yml")) {
    const yamlKeyRegex = new RegExp(`^${escapeRegExp(anchor)}\\s*:`, "m");
    if (yamlKeyRegex.test(content)) {
      vlog(`${ref.source}: anchor '${anchor}' matched as YAML key`);
      return true;
    }
    // 巢狀 key（如 review_cycle.review_cycle_limit）
    const nestedKeyRegex = new RegExp(
      `^\\s{2,}${escapeRegExp(anchor)}\\s*:`,
      "m",
    );
    if (nestedKeyRegex.test(content)) {
      vlog(`${ref.source}: anchor '${anchor}' matched as nested YAML key`);
      return true;
    }
  }

  // 模式 D：模糊匹配（warn but not error）
  // 若 anchor 以反引號、粗體等形式出現於內文
  const fuzzyRegex = new RegExp(
    `\`${escapeRegExp(anchor)}\`|\\*\\*${escapeRegExp(anchor)}\\*\\*`,
  );
  if (fuzzyRegex.test(content)) {
    warn(
      `${ref.source}: anchor '${anchor}' matched only in body text (not as heading/param/key); verify intent`,
    );
    return true;
  }

  return false;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// -------- 4. 循環引用 DFS --------
// 建立 refs 圖：source → targetFile
// DFS 偵測 cycle（若 targetFile 又引用 sourceFile，即為循環）
function detectCycles(refs) {
  const graph = {};
  for (const r of refs) {
    const src = r.source;
    const tgt = r.targetFile
      .replace(/^\.\.\//, "")
      .split("/")
      .pop();
    if (!graph[src]) graph[src] = new Set();
    graph[src].add(tgt);
  }

  const cycles = [];

  function dfs(node, path, visited) {
    if (path.includes(node)) {
      const cycleStart = path.indexOf(node);
      cycles.push([...path.slice(cycleStart), node]);
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    path.push(node);
    const neighbors = graph[node] || new Set();
    for (const n of neighbors) dfs(n, [...path], visited);
  }

  for (const node of Object.keys(graph)) {
    dfs(node, [], new Set());
  }

  return cycles;
}

// -------- Main --------
function main() {
  info("Scanning !ref references in frontmatter...");
  const refs = scanRefs();
  info(`Total !ref entries: ${refs.length}`);

  if (refs.length === 0) {
    info("No !ref found; nothing to validate");
    process.exit(0);
  }

  // 按來源檔案分組輸出
  const byFile = {};
  for (const r of refs) {
    if (!byFile[r.source]) byFile[r.source] = [];
    byFile[r.source].push(r);
  }
  for (const [file, list] of Object.entries(byFile)) {
    vlog(`\n${file} (${list.length} refs):`);
    for (const r of list) vlog(`  ${r.key} → ${r.targetFile}#${r.anchor}`);
  }

  // 驗證每個 !ref
  console.log("");
  info("Validating...");
  let validCount = 0;
  for (const r of refs) {
    const targetPath = validateFileExists(r);
    if (!targetPath) continue;
    if (r.isBodyLink) {
      // PROPOSAL_502_018 R-2：body markdown link 只檢驗檔案存在；不驗 anchor
      validCount++;
      continue;
    }
    if (validateAnchor(r, targetPath)) validCount++;
    else err(`${r.source}: anchor '${r.anchor}' not found in ${r.targetFile}`);
  }
  info(`Valid refs: ${validCount}/${refs.length}`);

  // 循環引用偵測
  console.log("");
  info("Cycle detection (DFS)...");
  const cycles = detectCycles(refs);
  if (cycles.length > 0) {
    err(`Detected ${cycles.length} cycle(s):`);
    for (const c of cycles) err(`  ${c.join(" → ")}`);
  } else {
    info("No cycles detected");
  }

  console.log("");
  console.log(`Summary: errors=${errors}, warnings=${warnings}`);
  if (errors > 0) process.exit(2);
  if (warnings > 0) process.exit(1);
  process.exit(0);
}

main();
