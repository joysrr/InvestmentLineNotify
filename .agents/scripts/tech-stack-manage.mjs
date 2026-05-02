#!/usr/bin/env node
// tech-stack-manage.mjs
// Tech-Stacks Catalog 管理 CLI（PROPOSAL_20260423_017 Phase C + PROPOSAL_20260424_018 Phase C）
// 零依賴：Node.js 內建模組 + Bash（git 命令）
//
// 指令：
//   list                    列出全部 stacks（依 category 分組；顯示 installed/available 狀態）
//   info <name>             顯示單一 stack 詳細
//   install <name>          標記 installed: true；依賴自動解析提示
//   remove <name>           標記 installed: false + git rm 檔案（保留 MANIFEST entry）
//   restore <name>          從 git history 取回檔案 + 標記 installed: true
//   audit                   依引用統計初篩建議；逐個確認刪除（PROPOSAL_018 Phase C）
//
// 通用旗標：
//   --dry-run    僅預覽不寫檔
//   --force      跳過確認
//   --help       顯示說明
//   --deep       audit 指令深度掃描（grep workspace project_root；較耗時）

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
  readSync,
  readdirSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_ROOT = resolve(join(__dirname, ".."));
const TECH_STACKS_DIR = join(AGENTS_ROOT, "tech-stacks");
const MANIFEST_PATH = join(TECH_STACKS_DIR, "MANIFEST.yaml");

// ───────── CLI 解析 ─────────
const argv = process.argv.slice(2);
const flags = {
  dryRun: argv.includes("--dry-run"),
  force: argv.includes("--force"),
  help: argv.includes("--help") || argv.includes("-h"),
  deep: argv.includes("--deep"),
};
const positional = argv.filter((a) => !a.startsWith("--") && a !== "-h");
const [cmd, name] = positional;

function printHelp() {
  console.log(`
tech-stack-manage.mjs — Tech-Stacks Catalog 管理 CLI

USAGE:
  node .agents/scripts/tech-stack-manage.mjs <command> [args] [flags]

COMMANDS:
  list                     列出全部 stacks（依 category 分組）
  info <name>              顯示指定 stack 詳細資訊
  install <name>           將 stack 標記為 installed: true（依賴自動檢查）
  remove <name>            標記 installed: false 並 git rm 檔案
  restore <name>           從 git history 取回檔案並標記 installed: true
  audit                    依引用統計初篩使用狀況；逐個確認移除（PROPOSAL_018 Phase C）

FLAGS:
  --dry-run                僅預覽不寫檔
  --force                  跳過互動確認
  --deep                   audit 指令深度掃描（grep workspace project_root）
  --help, -h               顯示本說明

REFERENCE:
  PROPOSAL_20260423_017 + PROPOSAL_20260424_018 / ADR-0031 + ADR-0032 /
  tech-stacks/MANIFEST.yaml
`);
}

// ───────── 極簡 MANIFEST YAML parser（僅支援本 MANIFEST 結構）─────────
// 不使用 init-workspace 的 parseYaml（該版不支援 list-of-objects）
export function parseManifest(text) {
  const lines = text.split("\n");
  const result = {
    version: null,
    schema_version: null,
    categories: {},
    stacks: [],
  };
  let mode = null; // null | 'categories' | 'stacks'
  let currentCat = null;
  let currentStack = null;

  for (let raw of lines) {
    const line = raw.replace(/\r$/, "");
    if (!line.trim() || /^\s*#/.test(line)) continue;

    const indent = line.match(/^(\s*)/)[1].length;
    const stripped = line.trim();

    // 頂層 key
    if (indent === 0) {
      const m = stripped.match(/^([A-Za-z_][\w]*)\s*:\s*(.*)$/);
      if (!m) continue;
      const [, key, rest] = m;
      if (key === "version") result.version = parseScalar(rest);
      else if (key === "schema_version")
        result.schema_version = parseScalar(rest);
      else if (key === "categories") {
        mode = "categories";
        currentCat = null;
        currentStack = null;
      } else if (key === "stacks") {
        mode = "stacks";
        currentCat = null;
        currentStack = null;
      }
      continue;
    }

    if (mode === "categories") {
      // indent 2: 類別名稱
      if (indent === 2) {
        const m = stripped.match(/^([A-Za-z_][\w-]*)\s*:\s*$/);
        if (m) {
          currentCat = m[1];
          result.categories[currentCat] = {};
        }
      } else if (indent === 4 && currentCat) {
        const m = stripped.match(/^([A-Za-z_][\w]*)\s*:\s*(.+)$/);
        if (m) result.categories[currentCat][m[1]] = parseScalar(m[2]);
      }
    } else if (mode === "stacks") {
      // indent 2: 新 stack entry（以 `- name:` 開頭）
      if (indent === 2 && stripped.startsWith("- name:")) {
        currentStack = {
          name: parseScalar(stripped.slice("- name:".length).trim()),
        };
        result.stacks.push(currentStack);
      } else if (indent === 4 && currentStack) {
        const m = stripped.match(/^([A-Za-z_][\w]*)\s*:\s*(.*)$/);
        if (m) currentStack[m[1]] = parseScalar(m[2]);
      }
    }
  }
  return result;
}

export function parseScalar(s) {
  s = (s ?? "")
    .trim()
    .replace(/\s*#.*$/, "")
    .trim();
  if (s === "") return null;
  if (s === "null" || s === "~") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
  if (s.startsWith("[") && s.endsWith("]")) {
    return s
      .slice(1, -1)
      .split(",")
      .map((x) => parseScalar(x))
      .filter((v) => v !== null);
  }
  return s;
}

// ───────── MANIFEST 寫入（行導向；僅更新 installed: 欄位） ─────────
// 不重寫 YAML，避免破壞註解與排版；用精確比對定位 stack entry 後改其 installed 行
export function updateInstalledField(manifestText, stackName, installed) {
  const lines = manifestText.split("\n");
  let inTargetStack = false;
  let baseIndent = null;
  let modified = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const indent = line.match(/^(\s*)/)[1].length;

    // 偵測 `- name: <stackName>` 的 entry 開頭
    const nameMatch = trimmed.match(/^- name:\s*(.+?)\s*(?:#.*)?$/);
    if (nameMatch) {
      const thisName = nameMatch[1].replace(/^["']|["']$/g, "");
      inTargetStack = thisName === stackName;
      baseIndent = indent;
      continue;
    }

    // 同層或更外層的新 key/entry → 結束 target 範圍
    if (inTargetStack && trimmed.startsWith("- ") && indent <= baseIndent) {
      inTargetStack = false;
      continue;
    }

    if (inTargetStack) {
      const m = line.match(/^(\s*)installed:\s*(true|false)(.*)$/);
      if (m) {
        lines[i] = `${m[1]}installed: ${installed}${m[3]}`;
        modified = true;
        inTargetStack = false; // 已改完當前 entry
      }
    }
  }

  return { text: lines.join("\n"), modified };
}

// ───────── 工具：Stack 路徑與 git 操作 ─────────
export function stackPath(stack) {
  if (stack.file) return join(TECH_STACKS_DIR, stack.file);
  if (stack.folder) return join(TECH_STACKS_DIR, stack.folder);
  return null;
}

export function stackRelativePath(stack) {
  return stack.file || stack.folder || null;
}

function runGit(args, { quiet = false } = {}) {
  const res = spawnSync("git", args, { cwd: AGENTS_ROOT, encoding: "utf-8" });
  if (res.status !== 0 && !quiet) {
    console.error(`git ${args.join(" ")} 失敗：${res.stderr || res.stdout}`);
  }
  return res;
}

// ───────── 依賴解析 ─────────
export function resolveDependencies(stacks, targetName) {
  const byName = Object.fromEntries(stacks.map((s) => [s.name, s]));
  const resolved = [];
  const seen = new Set();
  const visiting = new Set();

  function dfs(n) {
    if (seen.has(n)) return;
    if (visiting.has(n)) throw new Error(`循環依賴：${n}`);
    visiting.add(n);
    const s = byName[n];
    if (!s) throw new Error(`未知 stack：${n}`);
    for (const dep of s.depends_on || []) dfs(dep);
    visiting.delete(n);
    seen.add(n);
    resolved.push(s);
  }

  dfs(targetName);
  return resolved;
}

// ───────── 指令實作 ─────────
function cmdList(manifest) {
  const byCat = {};
  for (const s of manifest.stacks) {
    (byCat[s.category] ||= []).push(s);
  }
  const cats = Object.keys(manifest.categories).sort(
    (a, b) =>
      (manifest.categories[a].priority || 99) -
      (manifest.categories[b].priority || 99),
  );

  console.log(`\n📦 Tech-Stacks Catalog（MANIFEST v${manifest.version}）\n`);
  for (const cat of cats) {
    const desc = manifest.categories[cat].description || "";
    const entries = byCat[cat] || [];
    console.log(`── ${cat} ── ${desc}`);
    if (entries.length === 0) {
      console.log("   （無 stack）\n");
      continue;
    }
    for (const s of entries) {
      const mark = s.installed ? "✅" : "⬜";
      const mode = s.folder ? "[folder]" : "[file]";
      const deps =
        s.depends_on && s.depends_on.length
          ? ` ← ${s.depends_on.join(", ")}`
          : "";
      console.log(
        `   ${mark} ${s.name.padEnd(28)} ${mode.padEnd(9)} ${s.class || ""}${deps}`,
      );
    }
    console.log("");
  }

  const total = manifest.stacks.length;
  const installed = manifest.stacks.filter((s) => s.installed).length;
  console.log(
    `合計：${total}（installed: ${installed} / available: ${total - installed}）`,
  );
}

function cmdInfo(manifest, stackName) {
  const s = manifest.stacks.find((x) => x.name === stackName);
  if (!s) {
    console.error(`❌ 找不到 stack：${stackName}`);
    process.exit(2);
  }

  console.log(`\n📦 ${s.name}\n`);
  console.log(`  category       ${s.category}`);
  console.log(`  class          ${s.class || "(unset)"}`);
  console.log(`  mode           ${s.folder ? "folder" : "file"}`);
  console.log(`  path           ${stackRelativePath(s)}`);
  console.log(`  installed      ${s.installed ? "✅ true" : "⬜ false"}`);
  console.log(
    `  depends_on     ${(s.depends_on || []).join(", ") || "(none)"}`,
  );
  console.log(`  platforms      ${(s.platforms || []).join(", ") || "(any)"}`);
  if (s.extends_base) console.log(`  extends_base   true`);
  if (s.vendor_source) console.log(`  vendor_source  ${s.vendor_source}`);
  if (s.vendor_last_vetted)
    console.log(`  vendor_vetted  ${s.vendor_last_vetted}`);

  const fp = stackPath(s);
  if (fp && existsSync(fp)) {
    console.log(`  file_exists    ✅ ${fp}`);
  } else if (fp) {
    console.log(`  file_exists    ⚠️  missing (${fp})`);
  }
}

function cmdInstall(manifest, stackName) {
  const s = manifest.stacks.find((x) => x.name === stackName);
  if (!s) {
    console.error(`❌ 找不到 stack：${stackName}`);
    process.exit(2);
  }

  const chain = resolveDependencies(manifest.stacks, stackName);
  const toInstall = chain.filter((x) => !x.installed);

  if (toInstall.length === 0) {
    console.log(`ℹ️  ${stackName} 及其依賴皆已 installed。`);
    return;
  }

  console.log(`📦 將標記為 installed（含依賴）：`);
  for (const x of toInstall) {
    const fp = stackPath(x);
    const exists = fp && existsSync(fp);
    console.log(`   - ${x.name}${exists ? "" : "  ⚠️ 檔案缺失"}`);
  }

  if (flags.dryRun) {
    console.log("\n[DRY-RUN] 不寫檔");
    return;
  }
  if (!flags.force && !confirmSync("確認執行？[y/N] ")) {
    console.log("取消。");
    return;
  }

  let text = readFileSync(MANIFEST_PATH, "utf-8");
  for (const x of toInstall) {
    const r = updateInstalledField(text, x.name, true);
    if (!r.modified) console.warn(`⚠️  未能更新 ${x.name} 的 installed 欄位`);
    text = r.text;
  }
  writeFileSync(MANIFEST_PATH, text);
  console.log("✅ MANIFEST 已更新");

  // 檔案缺失提示
  const missing = toInstall.filter((x) => {
    const fp = stackPath(x);
    return !fp || !existsSync(fp);
  });
  if (missing.length > 0) {
    console.log("\n⚠️  下列 stack 檔案不存在，請考慮：");
    for (const x of missing) {
      console.log(
        `   - ${x.name}：執行 \`node .agents/scripts/tech-stack-manage.mjs restore ${x.name}\` 從 git history 取回`,
      );
    }
  }
}

function cmdRemove(manifest, stackName) {
  const s = manifest.stacks.find((x) => x.name === stackName);
  if (!s) {
    console.error(`❌ 找不到 stack：${stackName}`);
    process.exit(2);
  }

  // 檢查有沒有其他 installed stack 依賴此 stack
  const dependents = manifest.stacks.filter(
    (x) => x.installed && (x.depends_on || []).includes(stackName),
  );
  if (dependents.length > 0) {
    console.error(`❌ 無法 remove：以下 installed stacks 依賴此 stack：`);
    for (const d of dependents) console.error(`   - ${d.name}`);
    console.error("請先 remove 依賴方，或使用 --force 強制執行（不建議）");
    if (!flags.force) process.exit(2);
  }

  const fp = stackPath(s);
  const relPath = stackRelativePath(s);
  console.log(`📦 remove ${stackName}:`);
  console.log(`   - MANIFEST: installed: true → false`);
  if (fp && existsSync(fp)) {
    console.log(`   - git rm ${relPath}`);
  } else {
    console.log(`   - 檔案已不存在（僅更新 MANIFEST）`);
  }

  if (flags.dryRun) {
    console.log("\n[DRY-RUN] 不執行");
    return;
  }
  if (!flags.force && !confirmSync("確認執行？[y/N] ")) {
    console.log("取消。");
    return;
  }

  // git rm
  if (fp && existsSync(fp)) {
    const isDir = statSync(fp).isDirectory();
    const res = runGit(["rm", isDir ? "-r" : "-f", `tech-stacks/${relPath}`]);
    if (res.status !== 0) {
      console.warn("⚠️  git rm 失敗；改用直接刪除");
      rmSync(fp, { recursive: true, force: true });
    }
  }

  const text = readFileSync(MANIFEST_PATH, "utf-8");
  const r = updateInstalledField(text, stackName, false);
  if (!r.modified) console.warn(`⚠️  未能更新 ${stackName} 的 installed 欄位`);
  writeFileSync(MANIFEST_PATH, r.text);
  console.log("✅ 完成（MANIFEST 保留 entry 以便未來 restore）");
}

function cmdRestore(manifest, stackName) {
  const s = manifest.stacks.find((x) => x.name === stackName);
  if (!s) {
    console.error(`❌ 找不到 stack：${stackName}`);
    process.exit(2);
  }

  const relPath = stackRelativePath(s);
  const targetPath = `tech-stacks/${relPath}`;
  const fp = stackPath(s);

  if (fp && existsSync(fp)) {
    console.log(`ℹ️  檔案已存在：${relPath}；僅更新 MANIFEST 狀態`);
  } else {
    // 從 git history 找最近含此檔的 commit
    console.log(`🔍 搜尋 git history 中的 ${targetPath} ...`);
    const logRes = runGit(
      ["log", "--all", "--pretty=format:%H", "--", targetPath],
      { quiet: true },
    );
    const commits = (logRes.stdout || "")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
    if (commits.length === 0) {
      console.error(`❌ git history 無此檔案記錄：${targetPath}`);
      console.error("   若為 vendor folder 類，請手動從 upstream 取回。");
      process.exit(2);
    }
    const sourceCommit = commits[0];
    console.log(`   找到最近 commit：${sourceCommit.slice(0, 10)}`);

    if (flags.dryRun) {
      console.log("[DRY-RUN] 不取回檔案");
      return;
    }
    if (
      !flags.force &&
      !confirmSync(`從 ${sourceCommit.slice(0, 10)} 取回？[y/N] `)
    ) {
      console.log("取消。");
      return;
    }

    const dir = dirname(fp);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const checkoutRes = runGit(["checkout", sourceCommit, "--", targetPath]);
    if (checkoutRes.status !== 0) {
      console.error("❌ git checkout 失敗");
      process.exit(2);
    }
    console.log(`✅ 已從 git history 取回 ${relPath}`);
  }

  // 標記 installed
  const text = readFileSync(MANIFEST_PATH, "utf-8");
  const r = updateInstalledField(text, stackName, true);
  if (r.modified) writeFileSync(MANIFEST_PATH, r.text);
  console.log("✅ MANIFEST 已標記 installed: true");
}

// ───────── Audit 指令實作（PROPOSAL_20260424_018 Phase C）─────────
// 核心原則（User 2026-04-24 明確要求）：
//   - Agent / 腳本**只做初步篩選**，不自動刪除
//   - User 必須逐個確認才執行刪除
//   - 無 --yes-all 類旗標（避免誤刪）

// 遞迴掃指定目錄下所有 .md / .mjs / .sh 檔案
function walkTextFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (f === "node_modules" || f === ".git") continue;
    const p = join(dir, f);
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) walkTextFiles(p, out);
    else if (/\.(md|mjs|sh|yaml|ts|tsx|js|jsx|cs|axaml|xaml|vue)$/.test(f))
      out.push(p);
  }
  return out;
}

// 計算單個 stack 的引用統計
export function computeStackReferences(
  stack,
  { agentsRoot, workspaceFile, projectRoot = null },
) {
  const rel = stack.file || stack.folder || "";
  const stackPathSubstr = `tech-stacks/${rel}`.replace(/\/$/, "");
  const refs = { refs_in_rules: 0, refs_in_workspace: 0, refs_in_code: 0 };

  // rules / skills / tasks
  const scanDirs = ["rules", "skills", "tasks", "docs"].map((d) =>
    join(agentsRoot, d),
  );
  for (const dir of scanDirs) {
    for (const fp of walkTextFiles(dir)) {
      try {
        const content = readFileSync(fp, "utf-8");
        const occurrences = content.split(stackPathSubstr).length - 1;
        refs.refs_in_rules += occurrences;
      } catch {
        /* ignore */
      }
    }
  }

  // workspace file
  if (workspaceFile && existsSync(workspaceFile)) {
    try {
      const content = readFileSync(workspaceFile, "utf-8");
      refs.refs_in_workspace = content.split(stackPathSubstr).length - 1;
      // 另外用 stack.name 作為關鍵字（寬鬆）
      const nameMatches = (
        content.match(new RegExp(`\\b${stack.name}\\b`, "g")) || []
      ).length;
      refs.refs_in_workspace = Math.max(refs.refs_in_workspace, nameMatches);
    } catch {
      /* ignore */
    }
  }

  // project code（--deep 模式；由呼叫端決定是否傳 projectRoot）
  if (projectRoot && existsSync(projectRoot)) {
    // 每個 stack 有一組關鍵字（從 MACHINE_READABLE / category 推導）
    const keywords = stackKeywordsFor(stack);
    let total = 0;
    for (const fp of walkTextFiles(projectRoot)) {
      try {
        const content = readFileSync(fp, "utf-8");
        for (const kw of keywords) {
          if (content.includes(kw)) {
            total++;
            break;
          }
        }
      } catch {
        /* ignore */
      }
    }
    refs.refs_in_code = total;
  }

  return refs;
}

// 粗略的 stack → code 關鍵字映射（用於 --deep）
function stackKeywordsFor(stack) {
  const kws = [stack.name];
  // 從 name 衍生常見關鍵字
  if (stack.name.includes("avalonia")) kws.push("using Avalonia", "xmlns:semi");
  if (stack.name.includes("vue3"))
    kws.push("<script setup>", "from 'vue'", "import { ref }");
  if (stack.name.includes("nodejs"))
    kws.push("import.*from ['\"]node:", '"type": "module"');
  if (stack.name.includes("telegram")) kws.push("telegram", "Telegram");
  if (stack.name.includes("file-based"))
    kws.push("fs.readFileSync", "JSON.parse");
  return kws;
}

// 依引用總數分級
export function categorizeUsage(refs) {
  const total = refs.refs_in_rules + refs.refs_in_workspace + refs.refs_in_code;
  if (total === 0)
    return { level: "zero-usage", total, suggestion: "remove-candidate" };
  if (total <= 3)
    return { level: "low-usage", total, suggestion: "audit-candidate" };
  return { level: "high-usage", total, suggestion: "keep" };
}

// 讀取 workspace 檔的 last_audit_date / audit_interval_days（用於 CURRENT_WORKSPACE 自檢）
function readCurrentWorkspaceAuditFields() {
  const cwPath = join(AGENTS_ROOT, "CURRENT_WORKSPACE");
  if (!existsSync(cwPath)) return null;
  const wsName = readFileSync(cwPath, "utf-8").trim();
  if (!wsName) return null;
  const wsPath = join(AGENTS_ROOT, "workspaces", `${wsName}.md`);
  if (!existsSync(wsPath)) return { wsName, path: null };
  const content = readFileSync(wsPath, "utf-8");
  const dateMatch = content.match(
    /\*\*last_audit_date\*\*\s*[:：]\s*(\d{4}-\d{2}-\d{2})/,
  );
  const intervalMatch = content.match(
    /\*\*audit_interval_days\*\*\s*[:：]\s*(\d+)/,
  );
  return {
    wsName,
    path: wsPath,
    last_audit_date: dateMatch ? dateMatch[1] : null,
    audit_interval_days: intervalMatch ? Number(intervalMatch[1]) : 30,
  };
}

// 更新 workspace md 檔中的 last_audit_date 欄位（行導向）
function updateWorkspaceAuditDate(wsPath, newDate) {
  if (!existsSync(wsPath)) return false;
  let content = readFileSync(wsPath, "utf-8");
  const re =
    /(\*\*last_audit_date\*\*\s*[:：]\s*)(\d{4}-\d{2}-\d{2}|<not_applicable>|\S*)/;
  if (re.test(content)) {
    content = content.replace(re, `$1${newDate}`);
  } else {
    // 若不存在該欄位 → 附加於 TECH_STACK section 末
    content = content.replace(
      /(## TECH_STACK[\s\S]*?)(\n##|\n---|$)/,
      (m, body, tail) => {
        return `${body}- **last_audit_date**：${newDate}\n${tail}`;
      },
    );
  }
  writeFileSync(wsPath, content);
  return true;
}

function cmdAudit(manifest) {
  const installedStacks = manifest.stacks.filter((s) => s.installed);
  if (installedStacks.length === 0) {
    console.log("ℹ️  沒有 installed stacks；無需 audit。");
    return;
  }

  const wsInfo = readCurrentWorkspaceAuditFields();
  const workspaceFile = wsInfo?.path || null;
  const projectRoot = null; // Phase C 簡化：--deep 不讀 workspace PATHS；改為未來擴充

  console.log(`\n🔍 Tech-Stack Audit（PROPOSAL_20260424_018）`);
  if (wsInfo) {
    console.log(
      `   Workspace: ${wsInfo.wsName}（last audit: ${wsInfo.last_audit_date || "(never)"}）`,
    );
  } else {
    console.log(
      "   ⚠️  無 CURRENT_WORKSPACE；僅依 rules/skills/tasks 計算引用`",
    );
  }
  if (flags.deep)
    console.log("   [--deep] 深度掃描已啟用（未實作；等同 shallow）");
  console.log(`   Installed stacks: ${installedStacks.length}\n`);

  // 計算每個 stack 的引用
  const analysis = installedStacks.map((s) => {
    const refs = computeStackReferences(s, {
      agentsRoot: AGENTS_ROOT,
      workspaceFile,
      projectRoot,
    });
    const cat = categorizeUsage(refs);
    return { stack: s, refs, cat };
  });

  // 依 suggestion 排序：remove-candidate > audit-candidate > keep
  const sortOrder = { "remove-candidate": 0, "audit-candidate": 1, keep: 2 };
  analysis.sort(
    (a, b) => sortOrder[a.cat.suggestion] - sortOrder[b.cat.suggestion],
  );

  // 顯示總覽
  console.log("─────────────────────────────────────");
  console.log("  初步篩選（agent 只出建議；刪除需您確認）");
  console.log("─────────────────────────────────────");
  for (const { stack, refs, cat } of analysis) {
    const icon =
      cat.suggestion === "remove-candidate"
        ? "🔴"
        : cat.suggestion === "audit-candidate"
          ? "🟡"
          : "🟢";
    console.log(
      `  ${icon} ${stack.name.padEnd(28)} [${cat.level}]  refs: rules=${refs.refs_in_rules} ws=${refs.refs_in_workspace}${flags.deep ? " code=" + refs.refs_in_code : ""}`,
    );
  }
  console.log("");

  if (flags.dryRun) {
    console.log("[DRY-RUN] 不進入互動模式；不執行移除。");
    return;
  }

  // 逐個確認
  const toRemove = [];
  let text = readFileSync(MANIFEST_PATH, "utf-8");
  let kept = 0,
    removed = 0,
    skipped = 0;

  for (const { stack, refs, cat } of analysis) {
    const icon =
      cat.suggestion === "remove-candidate"
        ? "🔴"
        : cat.suggestion === "audit-candidate"
          ? "🟡"
          : "🟢";
    console.log(`┌─ ${icon} [${cat.level}] ${stack.name}`);
    console.log(
      `│  rules: ${refs.refs_in_rules} | workspace: ${refs.refs_in_workspace}${flags.deep ? " | code: " + refs.refs_in_code : ""}`,
    );
    console.log(
      `│  建議：${cat.suggestion === "remove-candidate" ? "考慮移除" : cat.suggestion === "audit-candidate" ? "請您審視" : "保留"}`,
    );
    const ans = promptSync(`│  [k]eep / [r]emove / [s]kip ? `);
    console.log("└─");
    if (ans === "r" || ans === "remove") {
      // 檢查反向依賴（避免拆到被依賴的 stack）
      const dependents = manifest.stacks.filter(
        (x) =>
          x.installed &&
          x.name !== stack.name &&
          (x.depends_on || []).includes(stack.name),
      );
      if (dependents.length > 0) {
        console.log(
          `   ⚠️  跳過：${stack.name} 被以下 installed stacks 依賴：${dependents.map((d) => d.name).join(", ")}`,
        );
        console.log(`       需先 remove 這些 dependents 才能移除本 stack。`);
        skipped++;
        continue;
      }
      toRemove.push(stack);
      removed++;
    } else if (ans === "s" || ans === "skip") {
      skipped++;
    } else {
      kept++;
    }
  }

  // 執行移除
  if (toRemove.length > 0) {
    console.log(`\n準備移除 ${toRemove.length} 個 stacks...`);
    const confirm = promptSync(`最終確認 [y/N] ? `);
    if (confirm !== "y" && confirm !== "yes") {
      console.log("使用者取消；不執行任何移除。");
      removed = 0;
    } else {
      for (const s of toRemove) {
        const rel = s.file || s.folder;
        const full = rel ? join(TECH_STACKS_DIR, rel) : null;
        if (full && existsSync(full)) {
          const rmRes = spawnSync(
            "git",
            [
              "rm",
              statSync(full).isDirectory() ? "-r" : "-f",
              `tech-stacks/${rel}`,
            ],
            { cwd: AGENTS_ROOT, encoding: "utf-8" },
          );
          if (rmRes.status !== 0) {
            try {
              rmSync(full, { recursive: true, force: true });
            } catch {}
          }
        }
        const r = updateInstalledField(text, s.name, false);
        if (r.modified) text = r.text;
      }
      writeFileSync(MANIFEST_PATH, text);
      console.log(
        `✅ MANIFEST 已更新；${toRemove.length} 個 stacks 標記 installed: false + 檔案 git rm`,
      );
    }
  }

  // 更新 workspace last_audit_date
  const today = new Date().toISOString().split("T")[0];
  if (wsInfo?.path) {
    if (updateWorkspaceAuditDate(wsInfo.path, today)) {
      console.log(`✅ ${wsInfo.wsName}.md last_audit_date → ${today}`);
    }
  }

  // 摘要
  console.log(`\n─────────────────────────────────────`);
  console.log(`Audit 摘要（${today}）`);
  console.log(`─────────────────────────────────────`);
  console.log(`  保留：${kept}`);
  console.log(`  移除：${removed}`);
  console.log(`  跳過：${skipped}`);
  console.log(`─────────────────────────────────────`);
}

// 同步 prompt（阻塞讀 stdin 一行；簡化版）
function promptSync(text) {
  process.stdout.write(text);
  const buf = Buffer.alloc(1024);
  let read = 0;
  try {
    read = readSync(0, buf, 0, buf.length, null);
  } catch {
    return "";
  }
  return buf.slice(0, read).toString("utf-8").trim().toLowerCase();
}

// ───────── 互動式確認（同步；僅用於 install/remove/restore）─────────
function confirmSync(prompt) {
  process.stdout.write(prompt);
  const buf = Buffer.alloc(1024);
  let read = 0;
  try {
    // 嘗試同步讀取一行（從 stdin fd 0）
    read = readSync(0, buf, 0, buf.length, null);
  } catch {
    // non-TTY 環境：預設為 'n'
    return false;
  }
  const ans = buf.slice(0, read).toString("utf-8").trim();
  return ans.toLowerCase().startsWith("y");
}

// ───────── Entry ─────────
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  if (flags.help || !cmd) {
    printHelp();
    process.exit(cmd ? 0 : 1);
  }
  if (!existsSync(MANIFEST_PATH)) {
    console.error(`❌ MANIFEST 不存在：${MANIFEST_PATH}`);
    process.exit(2);
  }
  const manifest = parseManifest(readFileSync(MANIFEST_PATH, "utf-8"));

  switch (cmd) {
    case "list":
      cmdList(manifest);
      break;
    case "info":
      if (!name) {
        console.error("❌ info 需指定 <name>");
        process.exit(1);
      }
      cmdInfo(manifest, name);
      break;
    case "install":
      if (!name) {
        console.error("❌ install 需指定 <name>");
        process.exit(1);
      }
      cmdInstall(manifest, name);
      break;
    case "remove":
      if (!name) {
        console.error("❌ remove 需指定 <name>");
        process.exit(1);
      }
      cmdRemove(manifest, name);
      break;
    case "restore":
      if (!name) {
        console.error("❌ restore 需指定 <name>");
        process.exit(1);
      }
      cmdRestore(manifest, name);
      break;
    case "audit":
      cmdAudit(manifest);
      break;
    default:
      console.error(`❌ 未知指令：${cmd}`);
      printHelp();
      process.exit(1);
  }
}
