---
task_id: existing-project-import-workflow
file_type: workflow
owner: "@Lead"
version: v1.0
last_modified: 2026-05-02
last_proposal: PROPOSAL_20260502_017
purpose: |
  既有專案（已存在 src/ + package.json）導入此 multi-agent 框架的 5 步 SOP。
  解 Sim-A S2「project-onboarding-workflow.md 全 254 行皆假設綠地新專案」缺口。
referenced_by:
  - workspaces/README.md
  - tasks/project-onboarding-workflow.md
related_decisions:
  - ADR-0002 # Workspace 注入
---

# Task: Existing Project Import Workflow

> PROPOSAL_502_017 Q-1 補建；解 Sim-A S2 既有專案 onboarding SOP 缺。
> 對偶：`tasks/project-onboarding-workflow.md`（綠地新專案）。

---

## 觸發條件

User 句含：

- 「我有一個現成的 `<framework>` 專案在 `<path>` 想用此框架管理」
- 「導入既有專案」/「import existing project」
- 「設定 `<existing project>` 至此框架」

**非觸發**（走 project-onboarding-workflow）：

- 「開新專案 / init workspace / 建 Avalonia 專案」（綠地）

---

## 5 步 SOP

### Step 1：掃描既有 codebase（READ-ONLY）

```bash
TARGET=/opt/myapp   # User 指定的專案根
# 1. 讀 package.json 推導 tech-stack
cat $TARGET/package.json | jq '.dependencies, .devDependencies'
# 2. 掃 src/ 結構推導 PATHS
find $TARGET/src -type d -maxdepth 2
# 3. 偵測既有 docs/
ls $TARGET/docs/ 2>/dev/null
# 4. git history 取最後活動時間
git -C $TARGET log -1 --format=%cd
```

**禁止**：寫入既有 src/ / docs/ / .git/。Step 1 完全 read-only。

### Step 2：tech-stack 對照 + 缺失分析

依 `tech-stacks/MANIFEST.yaml` 比對掃描結果：

- ✅ 完全命中（如 vue3-vite + nodejs-esm-backend）→ 直接 install
- 🟡 部分命中（如 vue3 但 framework 缺 vite-plugin-X）→ 補 stub
- 🔴 完全缺（如 Redis）→ 觸發熔斷；需先補 tech-stacks/<新>.md（先走 PROPOSAL_502_017 Q-10 stub 機制）

### Step 3：workspace 建立（注入欄位 ≠ 修專案）

```bash
node .agents/scripts/init-workspace.mjs --name <ws_name> --import-path $TARGET
# --import-path 旗標（PROPOSAL_502_017 待補；當前手動執行）：
#   - PROJECT_CONTEXT.project_root = $TARGET
#   - PATHS.frontend_root = $TARGET/webapp 或自動偵測
#   - PATHS.backend_root = $TARGET/src
#   - TECH_STACK = Step 2 結果
```

**注意**：workspace 檔在 `.agents/workspaces/<ws>.md`；**不修** `$TARGET/` 任何檔案。

### Step 4：Audit baseline 建立（首次掃描報告）

派 @Architect 出 `EXISTING_CODEBASE_REPORT.md`：

- 模組地圖（既有 src/ → 對應 architecture room）
- 已知 anti-pattern（從 git log + 程式碼掃出）寫入 debug_graveyard
- @QA 可執行的既有 test suite list

寫入位置：

- `.agents/workspaces/<ws>/memory/architecture/EXISTING_BASELINE.md`
- `.agents/workspaces/<ws>/memory/debug_graveyard/<obs>.md`（如有）

### Step 5：onboarding 完成

- 寫 `.agents/CURRENT_WORKSPACE`
- `mempalace mine .agents/workspaces/<ws>/memory/`
- 通知 User：「既有專案 `<ws>` 導入完成；已建 architecture baseline；下一步可派 @Lead 執行任務（注意：首次 audit 後 framework 才有完整脈絡）」

---

## 與 project-onboarding-workflow 對比

| 特徵       | existing-project-import  | project-onboarding |
| ---------- | ------------------------ | ------------------ |
| 觸發       | 既有 src/ + package.json | 綠地（無 src/）    |
| Step 1     | 掃描既有 codebase        | User 互動填欄位    |
| PATHS      | 從 src/ 結構推導         | User 填            |
| tech-stack | 從 package.json 推導     | User 選            |
| 首次 audit | EXISTING_CODEBASE_REPORT | （非必）           |
| 工時       | 30-60 min                | 10-20 min          |

---

## 禁止行為

- **絕對禁止** Step 1 寫入既有 src/（必 read-only）
- **絕對禁止** 跳 Step 4 audit baseline（首次 audit 後 framework 才有完整脈絡；`@Reviewer §s06` Memory Palace anti-pattern check 失效）
- **絕對禁止** workspace 直接 hardcode 既有專案路徑（必依 `PROJECT_CONTEXT.project_root` 注入）

---

## Related Decisions

- [ADR-0002](../decisions/0002-workspace-context-injection.md) — Workspace 注入機制
