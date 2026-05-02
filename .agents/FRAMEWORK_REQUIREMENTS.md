# .agents/ Framework Requirements

> 依 PROPOSAL_20260423_013 建立；明文宣告框架跨專案搬運時的 runtime 要求與語言選擇規範。
> 避免 Agent 自行引入異質 runtime（Python / Go / .NET）造成框架分裂。

---

## 1. 最低 Runtime 要求

| 項目             | 最低版本                                     | 必需 / 可選                                     | 用途                                                                              |
| ---------------- | -------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| **Node.js**      | **18.0+**                                    | 必需                                            | 所有 `.mjs` generators / validators / scripts                                     |
| **Bash**         | **4.0+**（Linux/macOS）/ Git Bash（Windows） | 必需                                            | `run-all.sh` / `index-drift-validator.sh` / `hooks/*`                             |
| **git**          | 2.25+                                        | 必需                                            | 版本控制 + `git mv` / `git diff`                                                  |
| **Python**       | **3.9+**                                     | **必需**（PROPOSAL_20260502_001 + ADR-0039 後） | MemPalace memory backend                                                          |
| **pip**          | 24.0+                                        | 必需                                            | `pip install mempalace`                                                           |
| **mempalace**    | **3.3.4+**                                   | 必需                                            | Memory Palace primary backend（github.com/MemPalace/mempalace；MIT；local-first） |
| .NET / Go / Rust | —                                            | ❌ 禁止                                         | 避免 runtime 分裂                                                                 |

**檢查指令**：

```bash
node --version              # v18.x 或以上
bash --version              # 4.x 或以上
python3 --version           # 3.9.x 或以上（ADR-0039 後）
pip3 show mempalace         # version 3.3.4+ 必裝
```

---

## 2. 依賴原則（修訂自 PROPOSAL_20260502_001 / ADR-0039）

### 2.1 Node.js 依賴管理（鐵律）

- **絕對禁止** 在 `.agents/scripts/` 下引入 `package.json` / `node_modules`
- 所有 `.mjs` 只能 import `node:*` 內建模組：
  - ✅ `node:fs` / `node:path` / `node:readline` / `node:child_process` / `node:url` / `node:test` / `node:assert`
  - ❌ 任何第三方 package（如 `yaml`、`marked`、`commander`）

### 2.2 Python 依賴（PROPOSAL_20260502_001 + ADR-0039）

**允許依賴白名單**（local-first；MIT/開源；MCP-compatible）：

| 套件          | 版本                       | 用途                          | 來源                                  |
| ------------- | -------------------------- | ----------------------------- | ------------------------------------- |
| **mempalace** | **3.3.4+**                 | Memory Palace primary backend | github.com/MemPalace/mempalace（MIT） |
| ChromaDB      | embedded（mempalace 自帶） | Vector store                  | mempalace transitive dep              |

**安裝**：

```bash
pip install mempalace>=3.3.4
```

**禁止追加**：

- 雲端 API 套件（OpenAI / Anthropic API client 等）
- 付費 SaaS 整合
- 違反 local-first 精神的依賴

新增 Python 依賴需先立提案 + 評估與本鐵律衝突。

### 2.3 禁止 gem / cargo 依賴

框架不使用 Ruby / Rust；無此風險。

### 2.4 設計理由

- **跨專案搬運可行**：`cp -r .agents/ /new-project/` + `pip install mempalace` 兩步即可
- **版本衝突管理**：建議使用 venv（per project / per workspace）
- **離線可用**：MemPalace local-first；core path 無網路依賴
- **LLM Agent 可自檢**：grep `node:` 確認 Node 合規；`pip show mempalace` 確認 Python 合規

---

## 3. 腳本語言選擇規範

### 3.1 優先順序

| 任務類型                                     | 首選                    | 次選    | 禁止                  |
| -------------------------------------------- | ----------------------- | ------- | --------------------- |
| 資料處理 / generator / validator（邏輯為主） | **Node.js `.mjs`**      | —       | Python / Go           |
| 跨平台 entry point / 簡單 orchestrator       | **Bash `.sh`**（POSIX） | Node.js | 平台專屬 shell        |
| 複雜 CLI / 互動式                            | **Node.js `.mjs`**      | —       | —                     |
| Git hooks                                    | Bash / Node.js 皆可     | —       | —                     |
| 單元 / 整合測試                              | **`node:test` + Bash**  | —       | Jest / Mocha / pytest |

### 3.2 Node.js ESM（`.mjs`）規範

- 副檔名一律 `.mjs`（純 ESM；不用 `.js` 或 `.cjs`）
- CLI 腳本頂部加 shebang：`#!/usr/bin/env node`
- CLI entry 用 `import.meta.url === \`file://${process.argv[1]}\`` 守衛，支援 test import
- export 純函式供 `.agents/tests/*.test.mjs` 單元測試

### 3.3 Bash 規範

- 頂部 `#!/bin/bash`（避免 `/bin/sh` 在 Debian/Ubuntu 下退化為 dash）
- 開頭 `set +e`（框架驗證採警告模式不中斷）
- 避免 Bash 4+ 專屬語法（如 `declare -A` 僅在確認 Bash 4+ 環境使用）
- Windows 相容：避免 `readarray` / `mapfile`（Git Bash 舊版不支援）

---

## 4. 違規處置

### 4.1 偵測機制

```bash
# 檢查 1：第三方 package 引入（排除 node:* 與相對路徑）
grep -rh "^import .* from " .agents/scripts/ --include="*.mjs" \
  | grep -v "from 'node:" | grep -v 'from "node:' | grep -v "from './"
# （應為空；非空 = 違規）

# 檢查 2：禁用語言腳本
find .agents/scripts -type f \
  \( -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.cs" -o -name "*.rb" \)
# （應為空）

# 檢查 3：package.json 汙染
find .agents/scripts -name package.json
# （應為空）

# 檢查 4：node_modules
find .agents/scripts -name node_modules -type d
# （應為空）
```

| 違規類型                                | 偵測        | 處置                               |
| --------------------------------------- | ----------- | ---------------------------------- |
| `.mjs` 引入第三方 package               | 檢查 1 非空 | 🔴 阻斷；重寫為 `node:*`           |
| 新增 `package.json`                     | 檢查 3 非空 | 🔴 阻斷；刪除                      |
| 新增 `node_modules`                     | 檢查 4 非空 | 🔴 阻斷；刪除 + `.gitignore`       |
| 新增 `.py` / `.go` / `.rs` / `.cs` 腳本 | 檢查 2 非空 | 🟡 WARN；需 Full Proposal 才可導入 |
| 缺 shebang 的 CLI `.mjs`                | 手動        | 🟡 WARN；補 `#!/usr/bin/env node`  |

### 4.2 例外申請流程

若未來有特殊場景（如 ML drift 偵測需 Python）：

1. 提 Full Proposal 說明 runtime 擴充理由 + ROI 評估
2. 限縮在單一子目錄（如 `.agents/scripts/ml/`）
3. 明文標記「此子目錄需額外 runtime」+ 更新本文件
4. 主框架仍維持 Node.js + Bash

---

## 5. 未來擴展路徑（非本提案範圍）

若跨 ≥ 10 異質專案部署導致維護成本升高，可考慮：

- **Deno**（單 binary；TS/ESM 原生；`node:*` 兼容；LLM 仍可直接改源碼）
- **Docker image**（打包完整環境）
- **編譯 binary**（Go/Rust；但破壞 LLM 自我進化迴路，謹慎評估）

當前（2026-04-24）評估：**Node.js `.mjs` + Bash 為局部最優解**；無需改動。

---

## 6. 跨專案搬運流程

### 6.1 三層職責分層（依 ADR-0017 文件分層 + ADR Pattern 導入）

| 層                | 位置                                                            | 用途              | 新專案搬運時               |
| ----------------- | --------------------------------------------------------------- | ----------------- | -------------------------- |
| **規則層**        | `rules/*.md` + `RULES_DESIGN_GUIDE.*.md` + `skills/` + `tasks/` | 當前行為（WHAT）  | **必帶**                   |
| **決策層**        | `decisions/ADR-*.md`                                            | 設計理由（WHY）   | **必帶**（跨專案知識資產） |
| **歷史層**        | `proposals/completed/` + `proposals/summaries/`                 | 官方決議（AUDIT） | 部分帶（見 6.2）           |
| **Project scope** | `workspaces/<project>/proposals/`                               | 專案特定歷史      | **清除全部**               |

### 6.2 三種搬運模式

| 模式                    | 保留內容                                              | 適用情境                               |
| ----------------------- | ----------------------------------------------------- | -------------------------------------- |
| **A. 完整模式**（預設） | 規則 + ADR + proposals/\* 全帶；清 workspaces/        | 想要完整審計軌跡                       |
| **B. 精簡模式**         | 規則 + ADR + summaries/ + 最近 1 個月 completed/      | 想降低搬運體積                         |
| **C. 極簡模式**         | 規則 + ADR + summaries/；清 completed/ 與 workspaces/ | 新專案只需規則與決策理由，不需歷史細節 |

**關鍵原則**（依 ADR Pattern；PROPOSAL_20260423_016）：

- `rules/` + `decisions/` 為**互補對**：規則描述 WHAT、ADR 描述 WHY
- 新 LLM 只讀 `rules/` 即可執行任務；需理解歷史決策才讀 `decisions/`
- `proposals/completed/` 為審計軌跡，可選帶（A/B 模式）
- `summaries/` 為歷史快速索引，**三種模式皆帶**

### 6.3 檢核清單（新專案搬運時）

```bash
# 在目標專案執行
cd /new-project/

# 1. 確認 runtime
node --version    # >= 18.0
bash --version    # >= 4.0

# 2. 複製框架（完整模式示範）
cp -r /path/to/source/.agents/ .

# 3. Scope 清理（A 模式：清 project，保 framework）
rm -rf .agents/workspaces/*   # 清除所有專案特定 workspaces
mkdir -p .agents/workspaces/

# 或 B 模式（精簡）：只保留近 1 個月 framework proposals
# find .agents/proposals/completed/ -name "*.md" -mtime +30 -delete

# 或 C 模式（極簡）：只保留 summaries
# rm -rf .agents/proposals/completed/* .agents/proposals/archived/*

# 4. 驗證框架（含 proposal_scope validator 會自動攔截 scope 誤放）
bash .agents/tests/run-all.sh --fast

# 5. 初始化新 workspace（自動建 project proposals/ 空殼）
node .agents/scripts/init-workspace.mjs --name <newproject>

# 6. 確認新專案 workspace 就位
bash .agents/tests/index-drift-validator.sh
```

### 6.4 搬運後驗收

```bash
# 檢查 framework 提案均為 scope: framework
node .agents/tests/proposal-scope-validator.mjs
# 預期：framework area 全 IN_SYNC；workspace area 若已初始化應為空

# 檢查索引同步
node .agents/scripts/generators/gen-proposal-index.mjs --check
node .agents/scripts/generators/gen-proposal-index.mjs --workspace <newproject> --check
```

若上述任一步驟失敗，檢查：

- Node.js 版本是否達 18+
- Bash 版本是否達 4+（Windows 可用 Git Bash）
- `.agents/scripts/` 是否意外帶了 `node_modules/`（應為零）
- `.agents/workspaces/` 是否殘留舊專案資料夾（A 模式清理步驟 3 是否執行）

---

## 7. 溯源

- **提案**：PROPOSAL_20260423_013（Lite）
- **觸發事件**：2026-04-24 User 跨專案 runtime 討論
- **關聯**：
  - PROPOSAL_20260423_001（framework-upgrade-workflow；多專案升級機制）
  - PROPOSAL_20260423_006（scripts/ 測試框架；node:test + Bash 零依賴範式）
  - PROPOSAL_20260423_011（RULES_DESIGN_GUIDE 拆檔；SCOPE §十六.F.5 引用本文件）
