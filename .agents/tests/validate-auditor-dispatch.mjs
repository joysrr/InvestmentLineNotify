#!/usr/bin/env node
// validate-auditor-dispatch.mjs
// 驗證 @Auditor 派遣 prompt 是否含指定維度所有 Fragment + JSON schema + rationale 字數
// 依 PROPOSAL_20260422_027 建立
//
// 使用：
//   node .agents/tests/validate-auditor-dispatch.mjs --dispatch-prompt <prompt-file> --dimension <1|2|3|4|5>
//   node .agents/tests/validate-auditor-dispatch.mjs --audit                   # 稽核 AUDIT_DECISION_LOG 完整性
//
// 退出碼：
//   0 = Fragment 完整 + schema 齊 + rationale ≥ 100 字
//   1 = warning（rationale 字數不足 / 非阻斷瑕疵）
//   2 = error（Fragment 缺失 / JSON schema 不完整 / AUDIT_DECISION_LOG 記錄斷鏈）

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_ROOT = join(__dirname, "..");
const RUBRIC_PATH = join(AGENTS_ROOT, "skills/auditor-rubric-prompts.md");
const DECISION_LOG_PATH = join(
  AGENTS_ROOT,
  "docs/Reports/AUDIT_DECISION_LOG.md",
);

// CLI
const args = process.argv.slice(2);
const promptFile = args.includes("--dispatch-prompt")
  ? args[args.indexOf("--dispatch-prompt") + 1]
  : null;
const dimension = args.includes("--dimension")
  ? args[args.indexOf("--dimension") + 1]
  : null;
const auditMode = args.includes("--audit");
const verifyPathsMode = args.includes("--verify-paths"); // PROPOSAL_022

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

// -------- 讀取 rubric Fragment 清單 --------
function loadFragments() {
  if (!existsSync(RUBRIC_PATH)) {
    err(`Rubric not found: ${RUBRIC_PATH}`);
    return null;
  }
  const content = readFileSync(RUBRIC_PATH, "utf-8");
  // 解析 "### X.Y 名稱" 為 Fragment 清單
  const fragments = {};
  const regex = /^### (\d+)\.(\d+)\s+(.+)$/gm;
  let m;
  while ((m = regex.exec(content)) !== null) {
    const dim = m[1];
    const sub = m[2];
    const name = m[3].trim();
    if (!fragments[dim]) fragments[dim] = [];
    fragments[dim].push({ id: `${dim}.${sub}`, name, raw: m[0] });
  }
  return fragments;
}

// -------- Mode 1: 派遣 prompt 驗證 --------
function validateDispatchPrompt(promptFile, targetDimension) {
  if (!existsSync(promptFile)) {
    err(`Dispatch prompt file not found: ${promptFile}`);
    return;
  }
  const prompt = readFileSync(promptFile, "utf-8");
  const fragments = loadFragments();
  if (!fragments) return;

  const expected = fragments[targetDimension];
  if (!expected) {
    err(`No fragments found for dimension ${targetDimension} in rubric`);
    return;
  }

  info(`Dimension ${targetDimension} expected fragments: ${expected.length}`);

  // 1. 檢查每份 Fragment 的「### X.Y 名稱」是否完整出現於 prompt
  let missing = [];
  for (const frag of expected) {
    const needle = `### ${frag.id}`;
    if (!prompt.includes(needle)) missing.push(frag.id);
  }
  if (missing.length > 0) {
    err(`Missing fragments in dispatch: ${missing.join(", ")}`);
  } else {
    info(`All ${expected.length} fragments present`);
  }

  // 2. 檢查 JSON 輸出 schema 含必要欄位
  const schemaKeywords = [
    "dimension",
    "scores",
    "rationales",
    "baseline_comparison",
    "critical_risks",
    "optimization_suggestions",
  ];
  const missingKeys = schemaKeywords.filter((k) => !prompt.includes(k));
  if (missingKeys.length > 0) {
    err(`JSON schema missing required keys: ${missingKeys.join(", ")}`);
  } else {
    info("JSON schema keys complete");
  }

  // 3. 檢查 rationale 字數要求
  if (
    !/rationale.*≥\s*100|rationale.*>=\s*100|rationale.*100\s*字/.test(prompt)
  ) {
    warn("rationale word count requirement not found (expected: ≥ 100 chars)");
  }
}

// -------- Mode 2: AUDIT_DECISION_LOG 稽核 --------
function auditDecisionLog() {
  if (!existsSync(DECISION_LOG_PATH)) {
    warn(`AUDIT_DECISION_LOG not found: ${DECISION_LOG_PATH}`);
    warn(
      "  依 PROPOSAL_027 Phase C 應存在；首次執行可忽略（待 @Auditor 首次派遣後填入）",
    );
    return;
  }
  const content = readFileSync(DECISION_LOG_PATH, "utf-8");
  // 檢查是否含記錄表頭
  if (!/派遣日期.*評審次數.*維度.*Fragment 清單/s.test(content)) {
    err("AUDIT_DECISION_LOG format invalid (missing required columns)");
    return;
  }

  // 計數記錄行（|-----| 分隔線後）
  const lines = content.split("\n");
  let recordCount = 0;
  let inTable = false;
  let afterSeparator = false;
  for (const line of lines) {
    if (line.includes("派遣日期")) inTable = true;
    if (inTable && line.startsWith("|---")) afterSeparator = true;
    if (
      inTable &&
      afterSeparator &&
      line.trim().startsWith("|") &&
      !line.startsWith("|---")
    ) {
      const cells = line
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      if (cells.length >= 4 && !cells[0].startsWith("---")) recordCount++;
    }
    if (line.trim() === "" && afterSeparator) inTable = false;
  }

  info(`AUDIT_DECISION_LOG records: ${recordCount}`);
  if (recordCount === 0) {
    warn(
      "AUDIT_DECISION_LOG has no records yet (expected after first @Auditor dispatch)",
    );
  }
}

// -------- Mode 3: --verify-paths 偵測裸檔名（PROPOSAL_022）--------
// 已知產物名稱清單；若 dispatch prompt 含這些裸檔名（無 .agents/ 或 docs/ 前綴）→ 🟡 warn
const KNOWN_BARE_NAMES = [
  "AUDIT_HISTORY.md",
  "AUDIT_DECISION_LOG.md",
  "PENDING_ACTIONS.md",
  "GLOBAL_STATUS_SUMMARY.md",
  "ROUTING_TICKET.md",
  "PROPOSAL_INDEX.md",
  "RULES_VERSION_INDEX.md",
  "FRAMEWORK_VERSION",
  "CHANGELOG.md",
  "WORKSPACE_SCHEMA.yaml",
  "SYSTEM_THRESHOLDS.yaml",
  "patrol-notification-catalog.md",
  "lead-orchestration-guide.md",
  "retro-analysis-framework.md",
  "assistant-summary-protocol.md",
  "routing-ticket-protocol.md",
  "orchestrator-pattern.md",
  "auditor-rubric-prompts.md",
  "lane-routing-task-classification.md",
  "emergency-shutdown-playbook.md",
  "hotfix-checklist.md",
];

function verifyPaths(promptFile) {
  if (!existsSync(promptFile)) {
    err(`Dispatch prompt file not found: ${promptFile}`);
    return;
  }
  const prompt = readFileSync(promptFile, "utf-8");
  let bareCount = 0;
  for (const name of KNOWN_BARE_NAMES) {
    // 偵測「未含 .agents/ 或 docs/ 前綴」的裸檔名引用
    // 簡化判定：若檔名出現 + 不在 `.agents/` 或 `docs/` 形式的路徑中
    const escName = name.replace(/[.+\\]/g, (c) => "\\" + c);
    const bareRegex = new RegExp(`(?<![./\\w-])${escName}(?![./\\w-])`, "g");
    const fullRegex = new RegExp(
      `\\.agents/[\\w/.-]*${escName}|docs/[\\w/.-]*${escName}`,
      "g",
    );
    const bareMatches = (prompt.match(bareRegex) || []).length;
    const fullMatches = (prompt.match(fullRegex) || []).length;
    const trulyBare = Math.max(0, bareMatches - fullMatches);
    if (trulyBare > 0) {
      warn(
        `裸檔名 "${name}" 出現 ${trulyBare} 次未帶 repo-root 前綴；建議補絕對路徑（依 PROPOSAL_022）`,
      );
      bareCount += trulyBare;
    }
  }
  if (bareCount === 0) {
    info("所有已知產物均使用絕對路徑（無裸檔名）");
  } else {
    info(
      `共偵測 ${bareCount} 處裸檔名；建議派遣前補完整路徑以避免 sub-agent 路徑誤解`,
    );
  }
}

// -------- Main --------
function main() {
  if (auditMode) {
    info("Mode: AUDIT_DECISION_LOG 稽核");
    auditDecisionLog();
  } else if (verifyPathsMode && promptFile) {
    info(`Mode: --verify-paths 裸檔名偵測 (file=${promptFile}; PROPOSAL_022)`);
    verifyPaths(promptFile);
  } else if (promptFile && dimension) {
    info(`Mode: 派遣 prompt 驗證 (file=${promptFile}, dimension=${dimension})`);
    validateDispatchPrompt(promptFile, dimension);
  } else {
    // 預設：僅盤點 rubric 完整性
    info("Mode: rubric Fragment 盤點");
    const fragments = loadFragments();
    if (!fragments) return;
    let total = 0;
    for (const [dim, list] of Object.entries(fragments)) {
      info(
        `  Dimension ${dim}: ${list.length} fragments (${list.map((f) => f.id).join(", ")})`,
      );
      total += list.length;
    }
    info(`Total: ${total} fragments`);
    if (total < 18) warn(`Expected 18 fragments, found ${total}`);
  }

  console.log("");
  console.log(`Summary: errors=${errors}, warnings=${warnings}`);
  if (errors > 0) process.exit(2);
  if (warnings > 0) process.exit(1);
  process.exit(0);
}

main();
