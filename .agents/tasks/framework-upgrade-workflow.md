---
task_id: framework-upgrade-workflow
file_type: workflow
owner: @Lead + @Retro
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_005
purpose: |
  框架 (.agents) 版本升級 8 步 SOP（FRAMEWORK_VERSION bump + CHANGELOG）
referenced_by:
  - tasks/audit-retro-coordination.md
  - decisions/0023-framework-version-management.md
  - docs/agents-overview.md
---

# Task: Framework Upgrade Workflow (.agents 框架升級流程)

> 對齊 `tasks/project-onboarding-workflow.md` 格式；搭配 `scripts/framework-diff.mjs` 使用。

---

## 觸發條件

任一情況觸發本流程：

1. 上游 `.agents/` 框架發布新版本（`FRAMEWORK_VERSION` 遞增）
2. User 指令「升級 .agents 框架」
3. 新專案建立時，選擇採納最新框架版本
4. `@Auditor` 評審發現多專案間框架 drift（未來 N+1 次評審擴充項；當前為手動觸發）

---

## 8 步驟流程

### Step 1：取得新版 `.agents/` 副本

**由 User 手動執行**（framework 工具不主動呼叫 git，對齊「專注 .agents 自身改善」原則）：

```bash
# 範例 A：從上游 git repo clone 至臨時目錄
git clone <framework_repo_url> /tmp/latest-framework
# 確認 .agents/ 路徑
ls /tmp/latest-framework/.agents/FRAMEWORK_VERSION

# 範例 B：從另一專案的 .agents/ 副本複製
cp -r ~/other-project/.agents /tmp/latest-framework
```

### Step 2：執行框架層 diff

```bash
cd <本專案根目錄>
node .agents/scripts/framework-diff.mjs --target /tmp/latest-framework/.agents
```

**預期輸出**：

- `✨ New Files`：target 有、local 沒有（新功能 / 新 skill / 新 validator）
- `✏️ Modified Files`：兩邊都有但內容不同（既有規則更新）
- `🗑️ Deleted Files`：local 有、target 沒有（已廢棄；評估是否同步刪除）
- `🔒 Protected Layer`：project_layer；**工具不觸及**（絕對安全）
- `📋 Recommended Merge Commands`：User 審視後選擇性執行

### Step 3：審視 diff 報告

依類型逐項判斷：

| 類型                          | 建議決策      | 注意事項                                              |
| ----------------------------- | ------------- | ----------------------------------------------------- |
| 新增 `rules/*.md`             | 通常全採納    | 必然涉及 Agent 行為變化；評估對現有流程影響           |
| 新增 `skills/*.md`            | 通常全採納    | F2 類需補 workspace 欄位才能完整運作                  |
| 新增 `tasks/*.md`             | 通常全採納    | F2 類同上                                             |
| 新增 `tech-stacks/*.md`       | 按需採納      | 僅當本專案使用該技術棧才需要                          |
| 新增 `tests/*.mjs`            | 全採納        | validator 擴充無副作用                                |
| 新增 `scripts/*.mjs`          | 全採納        | 工具類通常安全                                        |
| 修改 `RULES_DESIGN_GUIDE.md`  | 逐段審視      | 可能影響所有後續提案評審                              |
| 修改 `SYSTEM_THRESHOLDS.yaml` | 🔴 謹慎       | 系統參數異動；比對本專案是否相容                      |
| 修改 `WORKSPACE_SCHEMA.yaml`  | 🔴 謹慎       | 可能新增 required 欄位；需先補齊 workspace 實值再合併 |
| 刪除檔案                      | 🟡 確認無引用 | `grep -r "<path>" .agents/` 確認本專案無殘留引用      |

### Step 4：workspace schema 相容性檢查

若新版 `WORKSPACE_SCHEMA.yaml` 有新欄位：

```bash
# 先 cp schema（但不 cp 其他 framework 檔）
cp /tmp/latest-framework/.agents/WORKSPACE_SCHEMA.yaml .agents/WORKSPACE_SCHEMA.yaml

# 驗證本專案 workspace 是否符合新 schema
node .agents/tests/workspace-schema-validator.mjs --workspace <本專案>
```

若缺新 required 欄位 → exit 2；**必須先補填 workspace 實值再繼續**。

### Step 5：執行當前 `.agents/` 驗證（升級前基線）

```bash
bash .agents/tests/run-all.sh 2>&1 | tee /tmp/pre-upgrade-validation.log
```

記錄當前狀態：

- `drift_score`（對齊 PROPOSAL_025）
- 各 validator 警告 / 錯誤數
- 通過 / 失敗比例

### Step 6：選擇性合併框架層檔案

依 Step 3 決策，執行 Step 2 輸出的 `Recommended Merge Commands`（可選擇性複製）：

```bash
# 範例（依 diff 報告建議指令）
cp /tmp/latest-framework/.agents/RULES_DESIGN_GUIDE.md .agents/
cp /tmp/latest-framework/.agents/skills/concurrency-guard-pattern.md .agents/skills/
cp /tmp/latest-framework/.agents/CHANGELOG.md .agents/
cp /tmp/latest-framework/.agents/FRAMEWORK_VERSION .agents/
# ...
```

**🔴 絕對禁止合併**（project_layer）：

- ❌ `CURRENT_WORKSPACE`
- ❌ `workspaces/<本專案>.md`
- ❌ `workspaces/<本專案>/proposals/`（專案 scope 提案歷史）
- ❌ `proposals/active/*.md`（當前進行中提案）
- ❌ `proposals/PROPOSAL_INDEX.md`（**需合併而非覆寫**；各專案累積狀態不同）

> `framework-diff.mjs` 工具會主動將上述檔案列於 `🔒 Protected Layer` 區塊；即使 User 誤將其加入 target path，工具不會建議 cp 指令。

### Step 7：執行升級後驗證

```bash
bash .agents/tests/run-all.sh 2>&1 | tee /tmp/post-upgrade-validation.log

# 比對升級前後
diff /tmp/pre-upgrade-validation.log /tmp/post-upgrade-validation.log
```

**預期**：

- `drift_score` 不下降超過 **0.05**（對齊 `RULES_DESIGN_GUIDE §十二` Phase E.1）
- 無新增 **error** 類驗證失敗
- 若新增 warning 可接受，但需於 workspace `BUSINESS_RULES` 或 `GLOBAL_STATUS_SUMMARY.md` 記錄說明

### Step 8：更新本專案記錄

1. **FRAMEWORK_VERSION 已於 Step 6 複製**（自動隨 CHANGELOG 更新）
2. **workspace 記錄升級事件**（於 `workspaces/<本專案>.md` 底部或 `GLOBAL_STATUS_SUMMARY.md`）：

```markdown
## 框架升級記錄

- 2026-04-23：v3.5 → v4.0（採納 PROPOSAL_20260423_001）
- 新增 skills/tasks 三態分類 + framework-diff 工具
- drift_score 維持 0.957（無退化）
```

3. **Git commit**：

```bash
git add .agents/
git commit -m "framework 升級: vX.Y → vZ.W（參照 CHANGELOG）"
```

---

## 禁止行為

- **絕對禁止** 覆寫 `CURRENT_WORKSPACE` / `workspaces/<本專案>.md`
- **絕對禁止** 覆寫 `proposals/active/*.md`（當前進行中提案）
- **絕對禁止** 直接覆寫 `proposals/PROPOSAL_INDEX.md`（需人工合併；各專案累積狀態不同）
- **絕對禁止** 跳過 Step 5 或 Step 7 驗證（升級無驗證 = 引入未測試變更）
- **絕對禁止** 自動化 Step 6（framework-diff.mjs 僅輸出報告；merge 為 User 決策）

---

## 升級失敗回滾

若 Step 7 驗證失敗（drift_score 下降 > 0.05 或新增 error）：

### 回滾方式 A：全量 git restore（推薦）

```bash
git status # 檢視變更清單
git restore .agents/ # 回滾所有 .agents/ 變更至升級前
bash .agents/tests/run-all.sh # 確認回滾成功
```

### 回滾方式 B：針對特定檔案

```bash
# 若僅部分檔案引起問題
git restore .agents/RULES_DESIGN_GUIDE.md
git restore .agents/SYSTEM_THRESHOLDS.yaml
# 再次驗證
bash .agents/tests/run-all.sh
```

### 回滾方式 C：回到特定 commit

```bash
git log --oneline -10 .agents/ # 找到升級前 commit
git checkout <commit-sha> -- .agents/
bash .agents/tests/run-all.sh
```

---

## 與其他 Task 的關係

- **`tasks/project-onboarding-workflow.md`**：新專案首次部署 `.agents/`；本 task 為後續升級
- **`tasks/audit-retro-coordination.md`**：`@Auditor` 評審後的根因 / 提案流程；本 task 獨立於評審流程
- **`tasks/hotfix-checklist.md`**：緊急修復（單檔）流程；本 task 為計畫性升級
- **`tasks/emergency-shutdown-playbook.md`**：系統異常停機；本 task 不涉及生產中斷

---

## 溯源

- 建立提案：PROPOSAL_20260423_001 Part 6
- 搭配工具：`.agents/scripts/framework-diff.mjs`
- 版本識別：`.agents/FRAMEWORK_VERSION` + `.agents/CHANGELOG.md`
- 對齊原則：User 2026-04-23「專注 .agents 自身改善」（無外部 CI/CD / runtime monitor / 第三方評測依賴）

**修訂方式**：透過 `RULE_UPDATE_PROPOSAL`。

---

## Related Decisions

- [ADR-0023](../decisions/0023-framework-version-management.md) — Framework Version 管理
- [ADR-0024](../decisions/0024-framework-runtime-requirements.md) — Framework Runtime 規範
