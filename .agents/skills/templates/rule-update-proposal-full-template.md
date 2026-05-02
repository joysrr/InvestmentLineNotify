---
skill_id: rule-update-proposal-full-template
file_type: template
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_004
purpose: |
  RULE_UPDATE_PROPOSAL Full 完整模板（依 ADR-0009）
referenced_by:
  - rules/retro.md
  - skills/lead-context-mappings.md
  - skills/retro-analysis-framework.md
  - tasks/periodic-design-review-workflow.md
  - tasks/audit-retro-coordination.md
  - decisions/0009-proposal-full-lite-tier.md
---

# Skill: RULE_UPDATE_PROPOSAL (Full) — 完整提案模板

> **Note**：本檔原名 `rule-update-proposal-template.md`；為區分 Lite 版本重命名為 `-full-template.md`。
> 歷史提案（`proposals/completed/`）引用舊名不改寫（類比 git log 性質）。
> **微型變更**（typo / 設定常數 / ≤50 LOC）請改用 `rule-update-proposal-lite-template.md`；決策樹見 `RULES_DESIGN_GUIDE §二十一.B`。

> 本模板由 PROPOSAL-001 從 `retro.md` 外部化而來。
> `@Retro` 在 Workflow 第 9 步（進化階段）依本格式產出 `PROPOSAL_YYYYMMDD_NNN.md`，存放於 `.agents/proposals/`。

---

## 標準格式

````markdown
# Rule Update Proposal

**提案 ID**：`PROPOSAL_YYYYMMDD_NNN`（framework）或 `<PROJECT_PREFIX>_PROPOSAL_YYYYMMDD_NNN`（project）
**scope**：`framework` | `project:<project_name>`（**必填**；依 `.agents/RULES_DESIGN_GUIDE §十七.B` 判定，依 PROPOSAL_20260422_023）
**建立日期**：<日期>
**建立者**：`@Retro`
**生命週期狀態**：`OPEN`
**來源報告**：`<TEST_REPORT / REVIEW_REPORT 檔案名稱>`

---

<!-- 若無反覆問題，移除此區塊 -->

## 🚨 反覆問題警告

**同一問題類型已出現第 <N> 次**：`<目標 Agent>` + `<根因分類>`
**歷史相關提案**：`PROPOSAL_YYYYMMDD_NNN`、`PROPOSAL_YYYYMMDD_NNN`

> ⚠️ 此提案需要 User 明確確認後才可進入 IN_PROGRESS

---

## 問題描述

**發現位置**：`<檔案名稱>` 中的 `[BLOCKER #N]` / `Bug #N`
**問題摘要**：<一句話說明發生了什麼>
**詳細描述**：<具體說明問題的現象與影響>

## 根因分析

| 根因層級   | 代碼                            | 分析說明               |
| ---------- | ------------------------------- | ---------------------- |
| <層級名稱> | `REQ` / `ARCH` / `DEV` / `TEST` | <為什麼這個層級是根因> |

## 建議修改對象與內容

**目標 Agent**：`@<AgentName>`
**目標文件**：`.agents/<文件名稱>.md`
**修改位置**：`<章節名稱>` 章節

**建議新增/修改的規則原文**：

```markdown
<具體的 Markdown 規則內容>
```
````

## 預期效果

<說明這條規則套用後，能防止什麼情境再度發生>

## 採納狀態

- [ ] User 審查中
- **採納時間**：<待填>
- **執行者**：`@Lead`
- **ARCHIVED 時間**：<待填>

````

---

## 📌 Scope 判定 Checklist

`@Retro` 產出提案前**必須**執行本 checklist：

- [ ] 列出本提案所有修改標的檔案路徑
- [ ] 對每個路徑分類 prefix：
 - [ ] `.agents/` 範圍（排除 `workspaces/<project>.md` 實值填寫）→ **framework**
 - [ ] `src/` / `data/` / `docs/` / `scripts/` / `tests/` / `workspaces/<project>.md` 實值 → **project**
- [ ] 若 **兩類都出現** → **強制拆分為兩份獨立提案**，禁止產出混合 scope
- [ ] `scope:` 欄位已寫入提案基本資訊（`framework` 或 `project:<project_name>`）
- [ ] 儲存位置對齊 scope：
 - [ ] framework → `.agents/proposals/active/`
 - [ ] project:<name> → `.agents/workspaces/<name>/proposals/active/`
- [ ] project 提案編號含 workspace 定義的 `proposal_prefix`（例：`ILN_PROPOSAL_*`）

違反：`@Retro` workflow 阻斷；`@Auditor §2.2` 扣分；`@Assistant` 巡邏 P-18 事後偵測。

---

## 📌 Phase E 強制項 — 派生視圖同步檢查

所有提案執行計畫的 **Phase E 索引同步**，必須包含以下強制檢查：

```markdown
Phase E（X 分）：索引同步 + 派生視圖同步檢查
 · RULES_VERSION_INDEX.md 更新（若涉及版本遞增）
 · PROPOSAL_INDEX.md 狀態更新
 · **.agents/docs/agents-overview.md 派生視圖檢查**：
 - 若本提案新增 Agent / 巡邏 P-XX / 產出物 / §十四 參數 / Workflow 階段
 → 同步更新 agents-overview 對應章節（§1.2 / §2.1 / §4.2 / §7.1 / §9.2 / §9.3 / §10）
 - 若本提案僅內部結構調整（不影響派生視圖）
 → 於 §六 驗收標準明文「agents-overview 無需同步，理由：<具體說明>」
 · 移至 completed/
````

### 檢查觸發條件（任一）

- Agent 新增 / 移除 / 重命名
- 巡邏規則 `P-XX` 增減
- 通知分級符號變動
- `RULES_DESIGN_GUIDE §十四` 參數新增
- Workflow 階段增減
- 產出物新增（寫入 agents-overview §9.3 交叉引用表）
- 新建 rules / skills / tasks / domains 導致結構層變化

### 違反判定

提案執行後 `.agents/docs/agents-overview.md` 未同步且未於 §六 明文「無需同步」→ 由 `@Retro` 審計時標注提案執行缺失；`@Auditor` 維度 2.2 自動掃描偵測（詳見 `skills/auditor-rubric-prompts.md §2.2`）。

---

## 生命週期狀態（節錄自 `retro.md` §「提案生命週期」）

| 狀態          | 說明                                        | 下一步                      |
| ------------- | ------------------------------------------- | --------------------------- |
| `OPEN`        | 提案已產出，等待 User 審查                  | User 採納或拒絕             |
| `IN_PROGRESS` | User 已採納，`@Lead` 正在執行規則更新       | `@Lead` 完成後改為 ARCHIVED |
| `ARCHIVED`    | 規則更新已完成，提案永久保留供歷史參考      | 無，終態                    |
| `REJECTED`    | User 拒絕採納，附原因永久保留，納入再發計數 | 無，終態                    |

---

## User 指令格式

```
採納提案 PROPOSAL_YYYYMMDD_NNN
```

或拒絕：

```
拒絕提案 PROPOSAL_YYYYMMDD_NNN，原因：<一句話說明>
```

---

## 🔧 立案 / 採納後必跑腳本（SOP；依 PROPOSAL_20260423_012）

> 違反 SOP 會被 pre-commit hook (`run-all.sh` 含 `index_drift` validator) 攔截。

### 立案時（新增 active/\*.md 後，commit 前）

```bash
node .agents/scripts/generators/gen-proposal-index.mjs --write
bash .agents/tests/index-drift-validator.sh
```

### 採納 Phase G 完成時（移 completed/ 後，commit 前）

```bash
# 1. 移動檔案（若尚未移）
git mv .agents/proposals/active/PROPOSAL_YYYYMMDD_NNN.md \
 .agents/proposals/completed/

# 2. 更新版本索引（若動了 rules/* frontmatter version）
node .agents/scripts/generators/gen-rules-version-index.mjs --write

# 3. 若動了 framework 版本
node .agents/scripts/generators/gen-framework-version.mjs \
 --bump minor --proposal PROPOSAL_YYYYMMDD_NNN --write
node .agents/scripts/generators/gen-changelog.mjs \
 --proposal .agents/proposals/completed/PROPOSAL_YYYYMMDD_NNN.md --write

# 4. 更新提案索引（DONE 計數變動）
node .agents/scripts/generators/gen-proposal-index.mjs --write

# 5. 自檢全通過再 commit
bash .agents/tests/run-all.sh
```

### 快速自檢（任何時刻）

```bash
bash .agents/tests/index-drift-validator.sh
```

### 緊急豁免

- `git commit --no-verify` 仍可旁路；但 `periodic-design-review §7.#9 SCRIPT_UNDERUSE` 會計入警示
- 反覆豁免（近 30 天 ≥2 次）→ WARN；≥5 次 → ALERT

---

## Related Decisions

- [ADR-0009](../decisions/0009-proposal-full-lite-tier.md) — Full/Lite Proposal 分級
- [ADR-0019](../decisions/0019-proposal-scope-tiering.md) — Proposal Scope 分層
- [ADR-0020](../decisions/0020-proposal-intent-inheritance.md) — 提案意圖繼承機制
- [ADR-0021](../decisions/0021-proposal-lifecycle.md) — 提案生命週期
