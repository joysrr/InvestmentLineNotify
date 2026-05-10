# .agents/ Framework Requirements

> 依 PROPOSAL_20260423_013 建立；PROPOSAL_502_027 v7.0 後**Python primary**（Node.js / Bash 已 deprecated）。
> 明文宣告框架跨專案搬運時的 runtime 要求與語言選擇規範；避免 runtime 分裂。

---

## 1. 最低 Runtime 要求（v7.0 Node-free milestone 後）

| 項目             | 最低版本   | 必需 / 可選                                     | 用途                                                                              |
| ---------------- | ---------- | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| **Python**       | **3.9+**   | **必需**                                        | 所有 framework scripts / validators / generators（v7.0 後唯一 runtime）           |
| **pip**          | 24.0+      | 必需                                            | `pip install mempalace`                                                           |
| **mempalace**    | **3.3.4+** | 必需                                            | Memory Palace primary backend（github.com/MemPalace/mempalace；MIT；local-first） |
| **pyyaml**       | latest     | 必需（mempalace 已要求）                        | YAML parsing for init-workspace --config                                          |
| **git**          | 2.25+      | 必需                                            | 版本控制                                                                          |
| ~~Node.js~~      | ~~18.0+~~  | **deprecated**（v7.0 archived；無 active .mjs） | 舊 .mjs.archive 保留作 fallback；不需安裝                                         |
| ~~Bash~~         | ~~4.0+~~   | **deprecated**（v7.0 archived；無 active .sh）  | 同上                                                                              |
| .NET / Go / Rust | —          | ❌ 禁止                                         | 避免 runtime 分裂                                                                 |

**檢查指令**（v7.0 後）：

```bash
python3 --version           # 3.9+ 必需
pip3 show mempalace         # 3.3.4+ 必裝
git --version               # 2.25+ 必需
```

> **跨平台 100%**（v7.0 milestone）：Windows native cmd / minimal Docker image 無需裝 Node + Bash 即可跑全 framework。Python 是 mempalace 已要求的 runtime；無新增依賴。

---

## 2. 依賴原則（v7.0 後）

### 2.1 ~~Node.js~~ 依賴管理 — **DEPRECATED**

PROPOSAL_502_027 後所有 .mjs → .archive；不再為 active runtime。歷史紀錄：

- ~~所有 `.mjs` 只能 import `node:*` 內建模組~~（已不適用；v7.0 後 archived）
- 若需查看 .mjs.archive 可參考歷史；不影響現行 framework

### 2.2 Python 依賴（PROPOSAL_20260502_001 + ADR-0039 + ADR-0040）

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
- **LLM Agent 可自檢**：`pip show mempalace` 確認；`python3 .agents/tests/run-all.py` 18/18 全綠 = 部署完整

---

## 3. 腳本語言規範（v7.0 後；對齊 ADR-0040）

### 3.1 優先順序

| 任務類型                                      | 首選                                       | 禁止                |
| --------------------------------------------- | ------------------------------------------ | ------------------- |
| 任何 framework script / validator / generator | **Python 3.9+**                            | Node / Bash / 其他  |
| Git hooks                                     | **Python**（git pre-commit / post-commit） | Bash（已 archived） |
| 單元 / 整合測試                               | **`unittest` / 純 Python**                 | `node:test`         |

### 3.2 Python 規範

- 副檔名 `.py`
- shebang `#!/usr/bin/env python3` + chmod +x
- 純 stdlib 為主（`subprocess` / `pathlib` / `re` / `json` / `argparse`）
- pyyaml 唯一允許第三方依賴（mempalace 已要求）
- 不允許新增 pip 依賴（如需新依賴必先立提案）
- 完整撰寫規範：`.agents/skills/script-language-policy.md`

### 3.3 ~~Bash~~ — DEPRECATED

v7.0 後不新增；既有 .sh.archive 保留作歷史。

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
python3 .agents/tests/run-all.py --fast

# 5. 初始化新 workspace（自動建 project proposals/ 空殼）
python3 .agents/scripts/init-workspace.py --name <newproject>

# 6. 確認新專案 workspace 就位
python3 .agents/tests/index-drift-validator.py
```

### 6.4 搬運後驗收

```bash
# 檢查 framework 提案均為 scope: framework
python3 .agents/tests/proposal-scope-validator.py
# 預期：framework area 全 IN_SYNC；workspace area 若已初始化應為空

# 檢查索引同步
python3 .agents/scripts/generators/gen-proposal-index.py --check
python3 .agents/scripts/generators/gen-proposal-index.py --workspace <newproject> --check
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
