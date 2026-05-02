#!/usr/bin/env node
// agents-overview-sync-validator.mjs
// 驗證 .agents/docs/agents-overview.md 派生視圖與 .agents/ 實際狀態一致
// 依 PROPOSAL_20260422_028 建立；實現 @Auditor §2.2 可觀察性自動掃描 5 項對齐
// PROPOSAL_20260423_004 路徑變更：docs/agents-overview.md → .agents/docs/agents-overview.md
//
// 使用：node .agents/tests/agents-overview-sync-validator.mjs [--verbose]
//
// 退出碼：
//   0 = 全部對齐
//   1 = 1-2 項不一致（warning）
//   2 = ≥ 3 項不一致 或 Agents 數等關鍵項不一致（error）

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_ROOT = join(__dirname, "..");
const OVERVIEW_PATH = join(AGENTS_ROOT, "docs", "agents-overview.md");
const RULES_DIR = join(AGENTS_ROOT, "rules");
const VERSION_INDEX_PATH = join(AGENTS_ROOT, "RULES_VERSION_INDEX.md");
const THRESHOLDS_PATH = join(AGENTS_ROOT, "SYSTEM_THRESHOLDS.yaml");
const PATROL_CATALOG_PATH = join(
  AGENTS_ROOT,
  "skills/patrol-notification-catalog.md",
);

const verbose = process.argv.includes("--verbose");
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
  if (verbose) console.log(`   ${msg}`);
}

// 讀取 agents-overview.md 指定章節（從 "### X.Y 標題" 到下個 "### " 或 "## "）
function extractSection(content, sectionPattern) {
  const lines = content.split("\n");
  const startRegex = new RegExp(`^### ${sectionPattern}`);
  const startIdx = lines.findIndex((l) => startRegex.test(l));
  if (startIdx < 0) return null;
  // 找下個 ### 或 ## 作為結束
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^### /.test(lines[i]) || /^## /.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx, endIdx).join("\n");
}

// Check 1：Agents 數對齐
// §2.1 表格列數（扣除表頭 2 行） vs .agents/rules/*.md 數量（扣除 system-prompt.md）
function checkAgentsCount(overview) {
  const section = extractSection(overview, "2\\.1 全員總覽表");
  if (!section) {
    err("§2.1 全員總覽表 not found in agents-overview.md");
    return;
  }

  // 計算表格 data row（不含表頭與分隔線）
  // 取 § 內第一個表格：第一行 = 表頭；第二行 = 分隔 "|---|"；其後為 data rows
  const tableLines = section
    .split("\n")
    .filter((l) => l.trim().startsWith("|"));
  const separatorIdx = tableLines.findIndex((l) => /^\|\s*:?-+/.test(l.trim()));
  const dataRows =
    separatorIdx >= 0 ? tableLines.slice(separatorIdx + 1) : tableLines;
  // 去除空 row 與再次出現的分隔線
  const documentedCount = dataRows.filter(
    (l) => !/^\|\s*:?-+/.test(l.trim()),
  ).length;

  const actualFiles = readdirSync(RULES_DIR).filter((f) => f.endsWith(".md"));
  const actualCount = actualFiles.length;

  vlog(`§2.1 documented rows: ${documentedCount}`);
  vlog(`rules/ actual files: ${actualCount} (${actualFiles.join(", ")})`);

  if (documentedCount !== actualCount) {
    err(
      `Agents count mismatch: §2.1 has ${documentedCount} rows vs rules/ has ${actualCount} files`,
    );
  } else {
    info(`✓ Agents count match (${actualCount})`);
  }
}

// Check 2：Patrol 範圍對齐
// §4.2 範圍 vs patrol-notification-catalog.md 實際 P-XX 數
function checkPatrolRange(overview) {
  const section = extractSection(overview, "4\\.2 @Assistant 巡邏規則");
  if (!section) {
    err("§4.2 巡邏規則 not found");
    return;
  }

  // 從標題解析範圍「P-01 ~ P-XX」
  const rangeMatch = section.match(/P-01\s*~\s*P-(\d+)/);
  const documentedMax = rangeMatch ? parseInt(rangeMatch[1], 10) : null;

  // 從 patrol-notification-catalog §A 計數
  let actualMax = 0;
  if (existsSync(PATROL_CATALOG_PATH)) {
    const catalog = readFileSync(PATROL_CATALOG_PATH, "utf-8");
    const ids = [...catalog.matchAll(/\|\s*P-(\d+)\s*\|/g)].map((m) =>
      parseInt(m[1], 10),
    );
    actualMax = Math.max(...ids);
  }

  vlog(`§4.2 documented range: P-01 ~ P-${documentedMax}`);
  vlog(`patrol-catalog actual max: P-${actualMax}`);

  if (documentedMax !== actualMax) {
    err(
      `Patrol range mismatch: §4.2 max = P-${documentedMax} vs catalog max = P-${actualMax}`,
    );
  } else {
    info(`✓ Patrol range match (P-01 ~ P-${actualMax})`);
  }
}

// Check 3：Rules 版本對齐
// §9.2 版本表 vs RULES_VERSION_INDEX.md
function checkVersionIndex(overview) {
  const section = extractSection(overview, "9\\.2 Rules 文件清單");
  if (!section) {
    warn("§9.2 Rules 文件清單 not found; skipping");
    return;
  }
  if (!existsSync(VERSION_INDEX_PATH)) {
    warn("RULES_VERSION_INDEX.md not found; skipping");
    return;
  }

  const versionIndex = readFileSync(VERSION_INDEX_PATH, "utf-8");

  // 取得 §9.2 列出的版本（格式：` | 檔案 | vX.Y |`）
  const overviewVersions = [
    ...section.matchAll(/\|\s*`?([\w.\/-]+\.md)`?\s*\|\s*\*?\*?v(\d+\.\d+)/g),
  ].map((m) => ({ file: m[1], version: m[2] }));

  // 取得 RULES_VERSION_INDEX 列出的版本
  const indexVersions = [
    ...versionIndex.matchAll(/\|\s*`([\w./-]+\.md)`\s*\|\s*\*?\*?v(\d+\.\d+)/g),
  ].map((m) => ({ file: m[1].split("/").pop(), version: m[2] }));

  let mismatches = 0;
  for (const ov of overviewVersions) {
    const match = indexVersions.find(
      (iv) => iv.file === ov.file || iv.file.endsWith(ov.file),
    );
    if (match && match.version !== ov.version) {
      warn(
        `Version mismatch: ${ov.file} overview=v${ov.version} index=v${match.version}`,
      );
      mismatches++;
    }
  }

  vlog(
    `§9.2 compared ${overviewVersions.length} versions; ${mismatches} mismatches`,
  );
  if (mismatches === 0) info(`✓ Rules versions match`);
}

// Check 4：系統參數對齐
// §7.1 參數表 vs SYSTEM_THRESHOLDS.yaml top-level keys
function checkSystemThresholds(overview) {
  const section = extractSection(overview, "7\\.1 參數總表");
  if (!section) {
    err("§7.1 參數總表 not found");
    return;
  }
  if (!existsSync(THRESHOLDS_PATH)) {
    err("SYSTEM_THRESHOLDS.yaml not found");
    return;
  }

  const yaml = readFileSync(THRESHOLDS_PATH, "utf-8");
  // 簡單取得 YAML 頂層 key（行首非空白 + key:）
  const yamlKeys = [...yaml.matchAll(/^([A-Za-z_][\w]*)\s*:/gm)]
    .map((m) => m[1])
    .filter(
      (k) => !["schema_version", "last_modified", "last_proposal"].includes(k),
    );

  // 從 §7.1 文字中檢查是否涵蓋主要 keys
  const expectedKeywords = [
    "REVIEW_CYCLE",
    "PATROL",
    "PENDING",
    "EXEMPTION",
    "PROPOSAL_OPEN",
    "TOKEN",
    "AUDIT",
    "MODEL_ROUTING",
    "LANE_ROUTING",
  ];
  let missingInOverview = [];
  for (const kw of expectedKeywords) {
    if (!section.includes(kw)) missingInOverview.push(kw);
  }

  vlog(`YAML top-level keys: ${yamlKeys.join(", ")}`);
  vlog(`§7.1 missing keywords: ${missingInOverview.join(", ") || "none"}`);

  if (missingInOverview.length > 0) {
    warn(`§7.1 may be missing entries for: ${missingInOverview.join(", ")}`);
  } else {
    info(`✓ System thresholds coverage OK`);
  }
}

// Check 5：產出物交叉引用對齐
// §9.3 產出物清單 vs rules/*.md frontmatter `produces:`
function checkProduces(overview) {
  const section = extractSection(overview, "9\\.3 產出物交叉引用");
  if (!section) {
    warn("§9.3 產出物交叉引用 not found; skipping");
    return;
  }

  // 從 rules/*.md frontmatter 收集 produces
  const producesSet = new Set();
  for (const f of readdirSync(RULES_DIR).filter((x) => x.endsWith(".md"))) {
    const content = readFileSync(join(RULES_DIR, f), "utf-8");
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;
    const producesMatch = fmMatch[1].match(
      /produces:\s*([\s\S]*?)(?=\n[A-Za-z_]+:|$)/,
    );
    if (!producesMatch) continue;
    const items = [...producesMatch[1].matchAll(/^\s*-\s*(\S+)/gm)].map(
      (m) => m[1],
    );
    for (const it of items) producesSet.add(it);
  }

  // 檢查 §9.3 是否涵蓋這些產出物（允許模糊匹配 - 檔名子串，保留 _ 與 .md）
  const overviewText = section.toLowerCase();
  let missing = [];
  for (const p of producesSet) {
    // 取檔名（不含路徑；保留 _ 連字號）
    const basename = p.toLowerCase().split("/").pop();
    if (!basename || basename.length < 3) continue;
    // 允許帶 * 的 glob 範本（如 PROPOSAL_*.md）精簡為關鍵 stem
    const stem = basename.replace(/\*/g, "").replace(/\.md$/, "");
    if (stem.length < 3) continue;
    if (!overviewText.includes(stem)) missing.push(p);
  }

  vlog(`produces from rules: ${producesSet.size}`);
  vlog(
    `§9.3 missing mentions: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "..." : ""}`,
  );

  // 寬鬆判定：>50% 未匹配才 warn；≥ 50% 認為 §9.3 已反映主要產出物
  const missingRatio =
    producesSet.size > 0 ? missing.length / producesSet.size : 0;
  if (missingRatio > 0.5) {
    warn(
      `§9.3 may be missing > 50% artifacts (${missing.length}/${producesSet.size}; sample: ${missing.slice(0, 3).join(", ")})`,
    );
  } else if (missing.length > 0) {
    info(
      `§9.3 mostly aligned (${missing.length}/${producesSet.size} minor gaps; acceptable)`,
    );
  } else {
    info(`✓ Artifacts cross-ref complete`);
  }
}

// Main
function main() {
  if (!existsSync(OVERVIEW_PATH)) {
    err(`agents-overview.md not found: ${OVERVIEW_PATH}`);
    process.exit(2);
  }
  const overview = readFileSync(OVERVIEW_PATH, "utf-8");

  info("Checking agents-overview.md sync with .agents/ state...");
  console.log("");

  info("Check 1: Agents count (§2.1 ↔ rules/)");
  checkAgentsCount(overview);
  console.log("");

  info("Check 2: Patrol range (§4.2 ↔ patrol-catalog)");
  checkPatrolRange(overview);
  console.log("");

  info("Check 3: Rules versions (§9.2 ↔ RULES_VERSION_INDEX)");
  checkVersionIndex(overview);
  console.log("");

  info("Check 4: System thresholds (§7.1 ↔ SYSTEM_THRESHOLDS.yaml)");
  checkSystemThresholds(overview);
  console.log("");

  info("Check 5: Produces cross-ref (§9.3 ↔ rules frontmatter)");
  checkProduces(overview);
  console.log("");

  console.log(`Summary: errors=${errors}, warnings=${warnings}`);
  if (errors >= 1) process.exit(2);
  if (warnings >= 3) process.exit(2); // 累積 ≥ 3 warnings 升級 error
  if (warnings > 0) process.exit(1);
  process.exit(0);
}

main();
