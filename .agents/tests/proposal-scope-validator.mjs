#!/usr/bin/env node
// proposal-scope-validator.mjs
// 驗證提案檔案儲存位置與 frontmatter scope 一致性
// 依 PROPOSAL_20260423_015 Phase A 建立
//
// 規則：
//   .agents/proposals/{active,completed,archived}/     → scope 必須為 framework
//   .agents/workspaces/*/proposals/{active,completed,archived}/ → scope 必須為 project
//   混合 scope / 位置錯誤 → exit 1

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractFrontmatterScope } from "./lib/frontmatter.mjs";

export { extractFrontmatterScope };

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_ROOT = resolve(join(__dirname, ".."));
const FRAMEWORK_PROPOSALS = join(AGENTS_ROOT, "proposals");
const WORKSPACES_DIR = join(AGENTS_ROOT, "workspaces");

function scanDir(dir) {
  if (!existsSync(dir)) return [];
  const results = [];
  for (const f of readdirSync(dir)) {
    if (
      !f.endsWith(".md") ||
      f === "PROPOSAL_INDEX.md" ||
      f === "README.md" ||
      f.startsWith("SUMMARY_")
    )
      continue;
    results.push(join(dir, f));
  }
  return results;
}

function walkWorkspaceProposals(workspacesDir) {
  if (!existsSync(workspacesDir)) return [];
  const results = [];
  for (const ws of readdirSync(workspacesDir)) {
    const wsPath = join(workspacesDir, ws);
    if (!statSync(wsPath).isDirectory()) continue;
    const proposalsDir = join(wsPath, "proposals");
    if (!existsSync(proposalsDir)) continue;
    for (const sub of ["active", "completed", "archived"]) {
      const subDir = join(proposalsDir, sub);
      results.push(
        ...scanDir(subDir).map((f) => ({
          file: f,
          workspace: ws,
          subdir: sub,
        })),
      );
    }
  }
  return results;
}

export function validateFrameworkArea(baseDir) {
  const errors = [];
  for (const sub of ["active", "completed", "archived"]) {
    const subDir = join(baseDir, sub);
    for (const file of scanDir(subDir)) {
      const content = readFileSync(file, "utf-8");
      const scope = extractFrontmatterScope(content);
      if (scope === null) {
        errors.push({ file, issue: "NO_SCOPE_FIELD", expected: "framework" });
      } else if (scope !== "framework") {
        errors.push({
          file,
          issue: "WRONG_SCOPE",
          actual: scope,
          expected: "framework",
        });
      }
    }
  }
  return errors;
}

export function validateWorkspaceArea(workspacesDir) {
  const errors = [];
  for (const { file, workspace } of walkWorkspaceProposals(workspacesDir)) {
    const content = readFileSync(file, "utf-8");
    const scope = extractFrontmatterScope(content);
    if (scope === null) {
      errors.push({
        file,
        issue: "NO_SCOPE_FIELD",
        expected: "project",
        workspace,
      });
    } else if (scope !== "project") {
      errors.push({
        file,
        issue: "WRONG_SCOPE",
        actual: scope,
        expected: "project",
        workspace,
      });
    }
  }
  return errors;
}

// -------- CLI entry --------

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  console.log("🔍 Proposal Scope Validator (PROPOSAL_20260423_015)");

  const fwErrors = validateFrameworkArea(FRAMEWORK_PROPOSALS);
  const projErrors = validateWorkspaceArea(WORKSPACES_DIR);

  let totalErrors = 0;

  console.log(`\n→ Framework area (.agents/proposals/)`);
  if (fwErrors.length === 0) {
    const count = ["active", "completed", "archived"].reduce(
      (sum, s) => sum + scanDir(join(FRAMEWORK_PROPOSALS, s)).length,
      0,
    );
    console.log(`  ✅ ${count} proposals IN_SYNC (all scope: framework)`);
  } else {
    for (const e of fwErrors) {
      console.error(
        `  ❌ ${e.file.replace(AGENTS_ROOT + "/", "")}: ${e.issue} (actual=${e.actual || "missing"}, expected=${e.expected})`,
      );
      totalErrors++;
    }
  }

  console.log(`\n→ Workspace area (.agents/workspaces/*/proposals/)`);
  const workspaceCount = walkWorkspaceProposals(WORKSPACES_DIR).length;
  if (projErrors.length === 0) {
    console.log(
      `  ✅ ${workspaceCount} proposals IN_SYNC (all scope: project)`,
    );
  } else {
    for (const e of projErrors) {
      console.error(
        `  ❌ [${e.workspace}] ${e.file.replace(AGENTS_ROOT + "/", "")}: ${e.issue} (actual=${e.actual || "missing"}, expected=${e.expected})`,
      );
      totalErrors++;
    }
  }

  console.log("");
  if (totalErrors === 0) {
    console.log(
      "✅ Proposal Scope Validator: all proposals correctly classified",
    );
    process.exit(0);
  }
  console.log(`❌ Proposal Scope Validator: ${totalErrors} violations`);
  console.log("   修復：移動檔案至正確目錄，或更新 frontmatter scope 欄位");
  console.log("   詳見：RULES_DESIGN_GUIDE.SCOPE.md §十七");
  process.exit(1);
}
