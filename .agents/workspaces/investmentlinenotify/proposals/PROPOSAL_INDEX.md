# PROPOSAL_INDEX — InvestmentLineNotify (project scope)

> 提案總索引（由 `@Lead` 每次提案狀態變更時更新）。
> **本索引僅收錄 project scope 提案**（專案原始碼 / 業務資料 / workspace 實值調整）。
> 依 PROPOSAL_20260422_023 §十七.C 建立；scope 判定規則見 `.agents/RULES_DESIGN_GUIDE §十七.B`。

- **專案**：InvestmentLineNotify（`investmentlinenotify`）
- **proposal_prefix**：`ILN`
- **framework 索引**：見 `.agents/proposals/PROPOSAL_INDEX.md`（跨專案資產演進史）
- **最後更新**：2026-04-22（PROPOSAL_20260422_023 Phase C 建立）
- **維護者**：`@Lead`

---

## 統計摘要

<!-- ⚠️ 下方區塊由 gen-proposal-index.mjs --workspace investmentlinenotify --write 管理；手動編輯會在下次執行時被覆蓋 -->
<!-- AUTO-GENERATED:BEGIN stats -->

| 狀態        | 數量  | 目錄位置     |
| ----------- | ----- | ------------ |
| OPEN        | 0     | `active/`    |
| IN_PROGRESS | 0     | `active/`    |
| DONE        | 1     | `completed/` |
| CANCELLED   | 0     | `completed/` |
| ARCHIVED    | 0     | `archived/`  |
| **合計**    | **1** | —            |

<!-- AUTO-GENERATED:END stats -->

---

## 🟡 OPEN（待執行）

<!-- ⚠️ 下方區塊由 gen-proposal-index.mjs --workspace investmentlinenotify --write 管理；手動編輯會在下次執行時被覆蓋 -->
<!-- AUTO-GENERATED:BEGIN open_list -->

| 編號 | 標題                 | 優先級 | 提案日期 | 前置依賴 |
| ---- | -------------------- | ------ | -------- | -------- |
| —    | （目前無待執行項目） | —      | —        | —        |

<!-- AUTO-GENERATED:END open_list -->

## 🔵 IN_PROGRESS（執行中）

<!-- ⚠️ 下方區塊由 gen-proposal-index.mjs --workspace investmentlinenotify --write 管理；手動編輯會在下次執行時被覆蓋 -->
<!-- AUTO-GENERATED:BEGIN in_progress_list -->

| 編號 | 標題                 | 優先級 | 開始日期 | 預計完成 |
| ---- | -------------------- | ------ | -------- | -------- |
| —    | （目前無執行中項目） | —      | —        | —        |

<!-- AUTO-GENERATED:END in_progress_list -->

## ✅ DONE（已完成，尚未歸檔）

| 編號 | 標題                 | 優先級 | 完成日期 | 執行者 |
| ---- | -------------------- | ------ | -------- | ------ |
| —    | （目前無已完成項目） | —      | —        | —      |

## 🚫 CANCELLED / ❌ REJECTED

| 編號 | 標題   | 狀態 | 日期 | 原因 |
| ---- | ------ | ---- | ---- | ---- |
| —    | （無） | —    | —    | —    |

## 🗄️ ARCHIVED（已歸檔，超過 2 個審計週期）

| 編號 | 標題   | 完成日期 | 歸檔日期 |
| ---- | ------ | -------- | -------- |
| —    | （無） | —        | —        |

---

## 🔗 提案意圖繼承關係

當專案內新提案推翻歷史提案意圖時記錄繼承關係（對齊 PROPOSAL_20260422_006 機制；本表僅收錄 project scope 內部繼承）。

| 歷史提案 | 原意圖 | 繼承提案 | 繼承方式 |
| -------- | ------ | -------- | -------- |
| —        | （無） | —        | —        |

---

## 編號規則（依 PROPOSAL_20260422_023）

- 格式：`ILN_PROPOSAL_YYYYMMDD_NNN`
- `YYYYMMDD`：提案建立日期
- `NNN`：當日序號，三位數（001 起算）
- 本 workspace 編號空間**獨立**於 `.agents/proposals/`（framework）及其他 workspace 的 project 編號空間

## 維護規則

- **新增提案**：`@Retro` 產出後預設 `OPEN`，置於 `active/`，並在本索引 OPEN 區塊新增條目
- **狀態變更**：每次狀態變更（OPEN → IN_PROGRESS / DONE / CANCELLED / ARCHIVED）由 `@Lead` 同步更新本索引
- **目錄移動**：檔案隨狀態變更移動至對應目錄（`active/` / `completed/` / `archived/`）
- **歸檔條件**：DONE 提案超過 2 個審計週期後移至 `archived/`，狀態改為 ARCHIVED
- **索引更新**：`@Lead` 5 分鐘內更新本索引（不等下次收斂）

## Scope 邊界

- ✅ **應入此索引**：修改 `src/` / `data/` / `docs/` / `scripts/` / `tests/` / `workspaces/investmentlinenotify.md` 實值調整
- ❌ **不入此索引**（應入 `.agents/proposals/`）：修改 `.agents/rules/` / `.agents/skills/` / `.agents/tech-stacks/` / `.agents/domains/` / `.agents/tasks/` / `.agents/tests/` / `.agents/WORKSPACE_SCHEMA.yaml` / `.agents/SYSTEM_THRESHOLDS.yaml`
- 🚫 **混合提案**禁止產出；`@Retro` 必須拆分（依 `RULES_DESIGN_GUIDE §十七.B`）
