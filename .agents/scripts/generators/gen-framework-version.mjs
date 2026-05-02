#!/usr/bin/env node
// gen-framework-version.mjs
// 自動 bump FRAMEWORK_VERSION minor/major + 更新 proposals_included + last_included_proposal
// 依 PROPOSAL_20260423_007 Part 4 建立；純 Node.js 內建模組
//
// 使用：
//   node .agents/scripts/generators/gen-framework-version.mjs --bump minor --proposal <id>          # dry-run
//   node .agents/scripts/generators/gen-framework-version.mjs --bump minor --proposal <id> --write  # 實際更新
//
// 退出碼：
//   0 = 成功
//   2 = 錯誤

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_ROOT = resolve(join(__dirname, "..", ".."));
const FRAMEWORK_VERSION_PATH = join(AGENTS_ROOT, "FRAMEWORK_VERSION");
const COMPLETED_DIR = join(AGENTS_ROOT, "proposals", "completed");

// -------- Pure functions（export for unit test）--------

export function bumpVersion(current, type = "minor") {
  const m = current.match(/^v(\d+)\.(\d+)$/);
  if (!m)
    throw new Error(`Invalid version format: "${current}" (expected vX.Y)`);
  const major = parseInt(m[1], 10);
  const minor = parseInt(m[2], 10);
  if (type === "minor") return `v${major}.${minor + 1}`;
  if (type === "major") return `v${major + 1}.0`;
  throw new Error(`Unknown bump type: ${type} (expected minor|major)`);
}

export function readCurrentVersion(content) {
  const m = content.match(/framework_version[:：]\s*(v\d+\.\d+)/);
  return m ? m[1] : null;
}

export function countCompletedProposals(completedDir) {
  if (!existsSync(completedDir)) return 0;
  return readdirSync(completedDir).filter(
    (f) => f.endsWith(".md") && f !== ".gitkeep",
  ).length;
}

export function updateFrameworkVersionFields(
  content,
  { newVersion, newDate, baselineProposal, lastProposal, proposalsTotal },
) {
  let updated = content;

  // framework_version: vX.Y → newVersion
  updated = updated.replace(
    /^framework_version[:：]\s*v\d+\.\d+/m,
    `framework_version: ${newVersion}`,
  );

  // release_date: YYYY-MM-DD → newDate
  updated = updated.replace(
    /^release_date[:：]\s*\d{4}-\d{2}-\d{2}/m,
    `release_date: ${newDate}`,
  );

  // baseline_proposal: PROPOSAL_xxx → baselineProposal
  updated = updated.replace(
    /^baseline_proposal[:：]\s*\S+/m,
    `baseline_proposal: ${baselineProposal}`,
  );

  // last_included_proposal: PROPOSAL_xxx → lastProposal
  updated = updated.replace(
    /^last_included_proposal[:：]\s*\S+/m,
    `last_included_proposal: ${lastProposal}`,
  );

  // proposals_included.total: N → proposalsTotal
  updated = updated.replace(
    /(proposals_included[\s\S]*?total[:：]\s*)\d+/m,
    `$1${proposalsTotal}`,
  );
  // proposals_included.framework: N → proposalsTotal（同步；目前皆 framework）
  updated = updated.replace(
    /(proposals_included[\s\S]*?framework[:：]\s*)\d+/m,
    `$1${proposalsTotal}`,
  );

  return updated;
}

// -------- CLI entry guard --------

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const args = process.argv.slice(2);
  let bumpType = "minor";
  let proposalId = null;
  let writeMode = false;
  let checkMode = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--bump" && args[i + 1]) bumpType = args[++i];
    else if (args[i] === "--proposal" && args[i + 1]) proposalId = args[++i];
    else if (args[i] === "--write") writeMode = true;
    else if (args[i] === "--check") checkMode = true;
    else if (args[i] === "--help" || args[i] === "-h") {
      console.log(
        "Usage: node gen-framework-version.mjs --bump <minor|major> --proposal <id> [--write | --check]",
      );
      process.exit(0);
    }
  }

  if (!proposalId) {
    console.error(
      "❌ --proposal <id> 為必填（例：--proposal PROPOSAL_20260423_007）",
    );
    process.exit(2);
  }

  if (!existsSync(FRAMEWORK_VERSION_PATH)) {
    console.error(`❌ ${FRAMEWORK_VERSION_PATH} 不存在`);
    process.exit(2);
  }

  const content = readFileSync(FRAMEWORK_VERSION_PATH, "utf-8");
  const currentVersion = readCurrentVersion(content);
  if (!currentVersion) {
    console.error("❌ 無法解析當前 framework_version");
    process.exit(2);
  }

  const newVersion = bumpVersion(currentVersion, bumpType);
  const proposalsTotal = countCompletedProposals(COMPLETED_DIR);
  const newDate = new Date().toISOString().split("T")[0];

  const updated = updateFrameworkVersionFields(content, {
    newVersion,
    newDate,
    baselineProposal: proposalId,
    lastProposal: proposalId,
    proposalsTotal,
  });

  if (checkMode) {
    const hasVersion =
      content.includes(newVersion) || content.includes(currentVersion);
    const hasProposal = content.includes(proposalId);
    const totalMatch = new RegExp(
      `proposals_included[\\s\\S]*?total[:：]\\s*${proposalsTotal}`,
    ).test(content);
    if (hasVersion && hasProposal && totalMatch) {
      console.log(
        `✅ IN_SYNC: FRAMEWORK_VERSION 已含 ${proposalId} + total=${proposalsTotal}`,
      );
      process.exit(0);
    }
    console.error(
      `❌ DRIFT: FRAMEWORK_VERSION 缺 ${proposalId} 引用或 proposals_total≠${proposalsTotal}`,
    );
    process.exit(1);
  }

  if (writeMode) {
    writeFileSync(FRAMEWORK_VERSION_PATH, updated);
    console.log(
      `✅ FRAMEWORK_VERSION 已更新：${currentVersion} → ${newVersion}（proposals: ${proposalsTotal}；baseline: ${proposalId}）`,
    );
    process.exit(0);
  }

  console.log("--- FRAMEWORK_VERSION (dry-run preview)---\n");
  console.log(updated.split("\n").slice(0, 15).join("\n"));
  console.log("\n...（後續 notes 段落不變）");
  console.log(
    `\n（${currentVersion} → ${newVersion}; proposals_total ${proposalsTotal}; --write 實寫 / --check 驗證）`,
  );
}
