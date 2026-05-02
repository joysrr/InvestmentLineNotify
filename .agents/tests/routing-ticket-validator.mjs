#!/usr/bin/env node
// routing-ticket-validator.mjs
// 驗證專案根層 ROUTING_TICKET.md 的 schema 完整性 + Lane/Model 對應一致性
// 依 PROPOSAL_20260424_023 Phase E
//
// 使用：node .agents/tests/routing-ticket-validator.mjs [--verbose]
//
// 退出碼：
//   0 = 通過（ticket 缺失或合法）
//   1 = warnings（schema_version 缺 / hotfix 欄位部分缺）
//   2 = errors（必填欄位缺 / Lane↔Model 不對應 / hotfix.enabled=true 但 sc_evaluation 缺）

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "./lib/frontmatter.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_ROOT = join(__dirname, "..");
const PROJECT_ROOT = join(AGENTS_ROOT, "..");
const TICKET_PATH = join(PROJECT_ROOT, "ROUTING_TICKET.md");

const verbose = process.argv.includes("--verbose");
let errors = 0,
  warnings = 0;

function err(msg) {
  console.error(`❌ [ERROR] ${msg}`);
  errors++;
}
function warn(msg) {
  console.warn(`⚠️  [WARN]  ${msg}`);
  warnings++;
}
function info(msg) {
  if (verbose) console.log(`ℹ️  ${msg}`);
}

// 必填欄位（schema v1）
const REQUIRED_TOP = [
  "schema_version",
  "ticket_id",
  "created_at",
  "created_by",
  "status",
  "original_request",
  "assigned_lane",
  "model_tier",
  "complexity_tier",
  "tier_reason",
  "target_agent",
  "sibling_agents",
  "touched_files",
  "artifact_paths",
  "tech_stacks",
];

// Lane ↔ Model 合法對應
const VALID_PAIRS = {
  fast: ["haiku"],
  standard: ["sonnet"],
  heavy: ["opus"],
};

// 檢查 hotfix block（多行；簡易判定）
function hasHotfixEnabled(text) {
  return /^hotfix:\s*\n\s+enabled:\s*true/m.test(text);
}
function hasScEvaluation(text) {
  return /sc_evaluation:/.test(text);
}

function main() {
  console.log(
    "🔍 Running routing-ticket-validator (PROPOSAL_20260424_023 Phase E)",
  );

  if (!existsSync(TICKET_PATH)) {
    info(
      `ROUTING_TICKET.md 不存在於 ${TICKET_PATH}（運行時 artifact；非派發中為合法）`,
    );
    console.log("");
    console.log("Summary: errors=0, warnings=0 (no ticket present)");
    process.exit(0);
  }

  const text = readFileSync(TICKET_PATH, "utf-8");
  const fm = parseFrontmatter(text);
  if (!fm) {
    err("ROUTING_TICKET.md 缺 YAML frontmatter（--- 包圍）");
    summary();
    return;
  }

  // 必填欄位檢查
  for (const k of REQUIRED_TOP) {
    if (!(k in fm) || fm[k] === "" || fm[k] === "[]" || fm[k] === undefined) {
      // []  在 schema 是合法（可空陣列）；只警告 missing key
      if (!(k in fm)) err(`必填欄位缺失: ${k}`);
      else if (
        [
          "original_request",
          "tier_reason",
          "target_agent",
          "ticket_id",
          "created_at",
        ].includes(k) &&
        fm[k] === ""
      ) {
        err(`必填欄位 ${k} 為空字串`);
      }
    }
  }
  info(`schema_version: ${fm.schema_version || "<missing>"}`);
  if (fm.schema_version && fm.schema_version !== "v1") {
    warn(
      `schema_version "${fm.schema_version}" 非 v1（當前 protocol 唯一支援版本）`,
    );
  }

  // Lane ↔ Model 對應
  const lane = fm.assigned_lane;
  const model = fm.model_tier;
  if (
    lane &&
    model &&
    VALID_PAIRS[lane] &&
    !VALID_PAIRS[lane].includes(model)
  ) {
    err(
      `assigned_lane=${lane} 與 model_tier=${model} 不對應；合法對應 ${lane}→${VALID_PAIRS[lane].join("|")}`,
    );
  }

  // status 合法值
  // PROPOSAL_502_014 N-3：擴展 4 status（paused / timeout / retried / failed）
  const validStatus = [
    "dispatched",
    "acknowledged",
    "completed",
    "cancelled",
    "paused",
    "timeout",
    "retried",
    "failed",
  ];
  if (fm.status && !validStatus.includes(fm.status)) {
    err(`status="${fm.status}" 不在合法值 [${validStatus.join("|")}]`);
  }

  // task_class 合法值（PROPOSAL_502_014 N-3）
  const validTaskClass = ["feature", "modify-existing", "doc-sync", "hotfix"];
  if (fm.task_class && !validTaskClass.includes(fm.task_class)) {
    err(
      `task_class="${fm.task_class}" 不在合法值 [${validTaskClass.join("|")}]；對應 lead.md §s05 任務分類例外`,
    );
  }

  // memory_mode 合法值（PROPOSAL_502_013 M-4；ADR-0039 hybrid fallback）
  const validMemoryMode = ["mcp", "filesystem_fallback"];
  if (fm.memory_mode && !validMemoryMode.includes(fm.memory_mode)) {
    err(
      `memory_mode="${fm.memory_mode}" 不在合法值 [${validMemoryMode.join("|")}]；ADR-0039 hybrid fallback 規範`,
    );
  }
  // 不存在 → 視為 'mcp'（向後相容；不報錯）

  // Hotfix 檢查（主體）
  if (hasHotfixEnabled(text) && !hasScEvaluation(text)) {
    err(`hotfix.enabled=true 但缺 sc_evaluation 區塊`);
  }

  summary();
}

function summary() {
  console.log("");
  console.log(`Summary: errors=${errors}, warnings=${warnings}`);
  if (errors > 0) process.exit(2);
  if (warnings > 0) process.exit(1);
  process.exit(0);
}

main();
