#!/usr/bin/env node
// gen-adr-index.mjs
// 自動維護 decisions/README.md 索引表（依 PROPOSAL_20260423_016 Batch 1 建立）
//
// 使用：
//   node .agents/scripts/generators/gen-adr-index.mjs           # dry-run
//   node .agents/scripts/generators/gen-adr-index.mjs --write   # 實寫 AUTO-GENERATED 區塊
//   node .agents/scripts/generators/gen-adr-index.mjs --check   # 比對 drift
//
// 退出碼：
//   0 = 成功
//   1 = drift（--check 模式）
//   2 = 結構錯誤

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  replaceBlock,
  checkDrift,
  hasBlock,
} from "./lib/auto-generated-block.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_ROOT = resolve(join(__dirname, "..", ".."));
const DECISIONS_DIR = join(AGENTS_ROOT, "decisions");
const INDEX_PATH = join(DECISIONS_DIR, "README.md");

// -------- Pure helpers --------

export function parseAdrFrontmatter(content) {
  const fm = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return null;
  const body = fm[1];

  const get = (key) => {
    const m = body.match(new RegExp(`^${key}:\\s*(.+?)$`, "m"));
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
  };

  const parseList = (key) => {
    const m = body.match(new RegExp(`^${key}:\\s*\\[(.*?)\\]`, "m"));
    if (m && m[1].trim())
      return m[1]
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    // yaml block form (multiline)
    const blockMatch = body.match(
      new RegExp(`^${key}:\\s*\\n((?:\\s+-\\s+.+\\n?)+)`, "m"),
    );
    if (blockMatch) {
      return blockMatch[1]
        .split("\n")
        .map((l) => l.replace(/^\s+-\s+/, "").trim())
        .filter(Boolean);
    }
    return [];
  };

  return {
    adr_id: get("adr_id"),
    title: get("title"),
    status: get("status"),
    date: get("date"),
    supersedes: parseList("supersedes"),
    superseded_by: parseList("superseded_by"),
    related_proposals: parseList("related_proposals"),
    referenced_by: parseList("referenced_by"),
  };
}

export function scanAdrs(decisionsDir) {
  if (!existsSync(decisionsDir)) return [];
  const results = [];
  for (const f of readdirSync(decisionsDir)) {
    if (!f.match(/^\d{4}-.+\.md$/)) continue; // ADR files: NNNN-slug.md
    const content = readFileSync(join(decisionsDir, f), "utf-8");
    const fm = parseAdrFrontmatter(content);
    if (fm && fm.adr_id) {
      results.push({ file: f, ...fm });
    }
  }
  return results.sort((a, b) => a.adr_id.localeCompare(b.adr_id));
}

export function buildAdrTable(adrs) {
  if (adrs.length === 0) {
    return "| ADR | Title | Status | Date | Supersedes |\n|-----|-------|--------|------|-----------|\n| — | （尚無 ADRs；PROPOSAL_20260423_016 Batch 3 起填入）| — | — | — |";
  }
  const lines = [
    "| ADR | Title | Status | Date | Supersedes |",
    "|-----|-------|--------|------|-----------|",
  ];
  for (const a of adrs) {
    const link = `[${a.adr_id}](${a.file})`;
    const supersedes =
      a.supersedes && a.supersedes.length > 0 ? a.supersedes.join(", ") : "—";
    lines.push(
      `| ${link} | ${a.title || "<unknown>"} | ${a.status || "Proposed"} | ${a.date || "?"} | ${supersedes} |`,
    );
  }
  return lines.join("\n");
}

// -------- CLI entry --------

const BLOCK_NAME = "adr_list";

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const writeMode = process.argv.includes("--write");
  const checkMode = process.argv.includes("--check");

  if (!existsSync(INDEX_PATH)) {
    console.error(`❌ ${INDEX_PATH} not found`);
    process.exit(2);
  }

  const adrs = scanAdrs(DECISIONS_DIR);
  const table = buildAdrTable(adrs);

  if (!writeMode && !checkMode) {
    console.log(
      `📋 Found ${adrs.length} ADRs in ${DECISIONS_DIR.replace(AGENTS_ROOT + "/", "")}\n`,
    );
    console.log(table);
    console.log(`\n（dry-run；--write 實寫 / --check 比對 drift）`);
    process.exit(0);
  }

  const indexContent = readFileSync(INDEX_PATH, "utf-8");

  if (checkMode) {
    if (!hasBlock(indexContent, BLOCK_NAME)) {
      console.error(`❌ AUTO-GENERATED marker missing: "${BLOCK_NAME}"`);
      process.exit(1);
    }
    const res = checkDrift(indexContent, BLOCK_NAME, table);
    if (res.drift) {
      console.error(`❌ DRIFT [${BLOCK_NAME}]: ${res.reason}`);
      process.exit(1);
    }
    console.log(`✅ IN_SYNC [${BLOCK_NAME}] (${adrs.length} ADRs)`);
    process.exit(0);
  }

  if (writeMode) {
    if (!hasBlock(indexContent, BLOCK_NAME)) {
      console.error(
        `❌ AUTO-GENERATED marker "${BLOCK_NAME}" missing in ${INDEX_PATH}`,
      );
      process.exit(2);
    }
    const updated = replaceBlock(indexContent, BLOCK_NAME, table);
    writeFileSync(INDEX_PATH, updated, "utf-8");
    console.log(`✅ decisions/README.md 已更新（${adrs.length} ADRs）`);
    process.exit(0);
  }
}
