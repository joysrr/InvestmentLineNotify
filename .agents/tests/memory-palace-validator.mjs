#!/usr/bin/env node
// memory-palace-validator.mjs
// 驗證 MemPalace memory backend 健康度（PROPOSAL_20260502_001 + ADR-0039）
//
// 檢查項：
//   1. mempalace 套件已安裝（pip show mempalace ≥ 3.3.4）
//   2. mempalace-mcp 命令可達
//   3. mempalace status 可成功（palace 已 init）
//   4. 至少 1 drawer 已採礦（避免空 palace）
//   5. .mcp.json 含 mempalace server 註冊
//   6. markdown SoT 結構完整（.agents/memory/debug_graveyard/INDEX.md 存在）
//
// 退出碼：
//   0 = 全 PASS（MemPalace 健康 + markdown SoT 完整）
//   1 = warning（部分 stub；可降級為 markdown fallback mode）
//   2 = error（MemPalace 完全不可用且 markdown 也缺；阻斷）

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_ROOT = join(__dirname, "..");
const REPO_ROOT = join(AGENTS_ROOT, "..");
const MEMORY_DIR = join(AGENTS_ROOT, "memory");
const MCP_JSON = join(REPO_ROOT, ".mcp.json");

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
function ok(msg) {
  console.log(`✅ ${msg}`);
}

console.log("🔍 Memory Palace Validator (PROPOSAL_20260502_001 + ADR-0039)\n");

// 1. mempalace 套件版本
let mempalaceVersion = null;
try {
  mempalaceVersion = execSync("mempalace --version 2>&1", {
    encoding: "utf8",
  }).trim();
  if (
    mempalaceVersion.includes("3.3.4") ||
    /3\.[3-9]\./.test(mempalaceVersion)
  ) {
    ok(`mempalace 安裝：${mempalaceVersion}`);
  } else {
    warn(`mempalace 版本可能過舊：${mempalaceVersion}（要求 ≥ 3.3.4）`);
  }
} catch (e) {
  err(`mempalace 命令不可達；安裝：pip install mempalace>=3.3.4`);
}

// 2. mempalace-mcp 命令
try {
  execSync("which mempalace-mcp", { encoding: "utf8", stdio: "pipe" });
  ok("mempalace-mcp 命令可達");
} catch {
  err("mempalace-mcp 命令缺；MCP server 無法啟動");
}

// 3. mempalace status + drawer count thresholds（PROPOSAL_502_003 C-2）
let drawerCount = 0;
const COMPRESS_WARN_THRESHOLD = 1000; // 🟡 建議 mempalace compress
const COMPRESS_ERROR_THRESHOLD = 5000; // 🔴 必 compress（影響 retrieval 速度）
if (mempalaceVersion) {
  try {
    const status = execSync("mempalace status 2>&1", { encoding: "utf8" });
    const m = status.match(/(\d+)\s+drawers/);
    if (m) drawerCount = parseInt(m[1], 10);
    if (drawerCount > 0) {
      ok(`palace 已 init；${drawerCount} drawers indexed`);
    } else {
      warn(
        `palace 已 init 但 0 drawers；建議跑 mempalace mine .agents/memory/`,
      );
    }
    // Compress 健康度檢查
    if (drawerCount > COMPRESS_ERROR_THRESHOLD) {
      err(
        `drawer count ${drawerCount} > ${COMPRESS_ERROR_THRESHOLD}；必跑 mempalace compress（影響 retrieval 速度；AAAK Dialect 30x 壓縮）`,
      );
    } else if (drawerCount > COMPRESS_WARN_THRESHOLD) {
      warn(
        `drawer count ${drawerCount} > ${COMPRESS_WARN_THRESHOLD}；建議 mempalace compress（skills/memory-operations.md §6）`,
      );
    }
  } catch (e) {
    warn(`mempalace status 失敗：${e.message.split("\n")[0]}（可能未 init）`);
  }
}

// 4. .mcp.json 註冊
if (existsSync(MCP_JSON)) {
  try {
    const mcp = JSON.parse(readFileSync(MCP_JSON, "utf8"));
    if (mcp.mcpServers && mcp.mcpServers.mempalace) {
      ok(".mcp.json 含 mempalace server 註冊");
    } else {
      warn(".mcp.json 缺 mempalace server block");
    }
  } catch (e) {
    err(`.mcp.json parse 失敗：${e.message}`);
  }
} else {
  warn(`.mcp.json 不存在；MCP server 無法被 Claude Code 載入`);
}

// 5. markdown SoT 結構
const sotPaths = [
  {
    path: join(MEMORY_DIR, "debug_graveyard", "INDEX.md"),
    required: true,
    label: "framework debug_graveyard INDEX",
  },
  {
    path: join(MEMORY_DIR, "debug_graveyard"),
    required: true,
    label: "framework debug_graveyard 目錄",
  },
];
for (const { path, required, label } of sotPaths) {
  if (existsSync(path)) {
    ok(`SoT: ${label}`);
  } else if (required) {
    err(`SoT 缺：${label}（${path}）`);
  } else {
    warn(`SoT 選用缺：${label}`);
  }
}

// 6. workspace memory（若 active workspace）
const currentWsPath = join(AGENTS_ROOT, "CURRENT_WORKSPACE");
if (existsSync(currentWsPath)) {
  const wsName = readFileSync(currentWsPath, "utf8")
    .trim()
    .replace(/^['"]|['"]$/g, "");
  if (wsName && wsName !== "default_env") {
    const wsMemPath = join(AGENTS_ROOT, "workspaces", wsName, "memory");
    if (existsSync(wsMemPath)) {
      const rooms = readdirSync(wsMemPath).filter((f) => {
        try {
          return readdirSync(join(wsMemPath, f));
        } catch {
          return false;
        }
      });
      info(
        `Active workspace ${wsName}：${rooms.length} memory rooms（${rooms.join(", ")}）`,
      );
      // 檢查至少 architecture INDEX 存在
      const archIdx = join(wsMemPath, "architecture", "INDEX.md");
      if (!existsSync(archIdx)) {
        warn(
          `workspace ${wsName} 缺 architecture/INDEX.md（lead.md §s_memory_palace 派發鐵律）`,
        );
      }
    } else {
      warn(
        `Active workspace ${wsName} 無 memory/ 目錄；建議跑 init-workspace 補建`,
      );
    }
  }
}

// 7. SoT vs vector store drift 偵測（PROPOSAL_502_015 O-3；解 Sim-D S16）
// 目的：mempalace status 報的 drawer count vs filesystem markdown 數差異 >100 → drift WARN
if (mempalaceVersion && drawerCount > 0) {
  let mdCount = 0;
  const dgDir = join(MEMORY_DIR, "debug_graveyard");
  if (existsSync(dgDir)) {
    try {
      mdCount = readdirSync(dgDir).filter(
        (f) => f.endsWith(".md") && f !== "INDEX.md",
      ).length;
    } catch {
      /* ignore */
    }
  }
  // workspace memory 也計入
  if (existsSync(currentWsPath)) {
    const wsName = readFileSync(currentWsPath, "utf8")
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (wsName && wsName !== "default_env") {
      const wsMemPath = join(AGENTS_ROOT, "workspaces", wsName, "memory");
      if (existsSync(wsMemPath)) {
        for (const room of [
          "architecture",
          "strategy_context",
          "debug_graveyard",
        ]) {
          const roomPath = join(wsMemPath, room);
          if (existsSync(roomPath)) {
            try {
              mdCount += readdirSync(roomPath).filter(
                (f) => f.endsWith(".md") && f !== "INDEX.md",
              ).length;
            } catch {
              /* ignore */
            }
          }
        }
      }
    }
  }
  // drawer count 含 mempalace 自動 chunk 切分；markdown 1 file 可能切多 drawer。
  // 「drift」判定：drawer count >> markdown × 5（過度 mining）OR markdown >> drawer count（漏 mine）。
  if (mdCount > 0) {
    const ratio = drawerCount / mdCount;
    if (ratio > 10) {
      warn(
        `SoT drift 警示：drawer count (${drawerCount}) / markdown (${mdCount}) = ${ratio.toFixed(1)}x；過度 mining 或 markdown SoT 流失`,
      );
    } else if (ratio < 0.5 && mdCount > 5) {
      warn(
        `SoT drift 警示：markdown (${mdCount}) >> drawer count (${drawerCount})；可能漏 mine（建議 mempalace mine .agents/memory/）`,
      );
    } else {
      info(
        `SoT vs vector store drift OK：drawer ${drawerCount} / markdown ${mdCount} (ratio ${ratio.toFixed(1)})`,
      );
    }
  }
}

// 摘要
console.log("\n─────────────────────────────");
console.log(`Summary: ${errors} errors, ${warnings} warnings`);
if (errors === 0 && warnings === 0) {
  console.log("✅ Memory Palace Validator: 全 PASS");
} else if (errors === 0) {
  console.log("🟡 部分功能 stub；hybrid fallback 可運作");
} else {
  console.log("🔴 MemPalace 不可用；請依錯誤訊息修復");
}
console.log("─────────────────────────────");
process.exit(errors > 0 ? 2 : warnings > 0 ? 1 : 0);
