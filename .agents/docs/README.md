# `.agents/docs/` — Framework Documentation

> 由 PROPOSAL_20260423_004 建立。本目錄儲存 `.agents/` 框架層的**說明文件**（非 rule / skill / task）。
> 對齊 `RULES_DESIGN_GUIDE §二十 文件分層三原則`。

## 目錄性質

本目錄為 **framework 層**（跨專案通用），與 `docs/`（專案特有）嚴格分離。

## 當前檔案清單

| 檔案                                 | 性質               | 用途                                                                                                       |
| ------------------------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| `agents-overview.md`                 | framework 總覽     | 13 Agent + 巡邏 + 工作流完整說明（含歷史範例引用如 InvestmentLineNotify workspace 範例；通用化待後續提案） |
| `quality-audit-checklist.md`         | 通用評鑒表         | AI Agent 品質 5 維度 × 15 細項標準                                                                         |
| `quality-audit-automation-manual.md` | 自動化評審手冊     | `@Auditor` Judge LLM Prompt Fragments 基礎                                                                 |
| `Reports/AUDIT_HISTORY.md`           | framework 運作紀錄 | `@Auditor` 5 維度評分時序歷史（12 個月滾動；跨專案搬運）                                                   |
| `Reports/AUDIT_DECISION_LOG.md`      | framework 運作紀錄 | `@Auditor` 派遣決策 + Fragment 清單軌跡                                                                    |
| `Reports/RETRO_*.md`                 | framework 運作紀錄 | `@Retro` 批次 retro 報告                                                                                   |

## 文件分層規則

依 `RULES_DESIGN_GUIDE §二十`：

| 層級                                 | 位置                    | 判定                                                   | 範例                                                        |
| ------------------------------------ | ----------------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| **Framework 說明**                   | `.agents/docs/`         | 通用 AI Agent 規範，跨專案適用                         | `agents-overview.md` / `quality-audit-*.md`                 |
| **Framework 運作紀錄（跨專案通用）** | `.agents/docs/Reports/` | `@Auditor` / `@Retro` 產出的稽核與評分歷史；隨框架搬運 | `AUDIT_HISTORY.md` / `AUDIT_DECISION_LOG.md` / `RETRO_*.md` |
| **Framework 運作紀錄（專案實例化）** | `docs/Reports/`         | 本專案特有的運作歷史；不隨 `.agents/` 搬運             | `GLOBAL_STATUS_SUMMARY.md` / `DoD_AUDIT_LOG.md`             |
| **專案業務文件**                     | `docs/`（其他所有位置） | 專案業務邏輯 / API / 架構                              | `architecture.md` / `api/` / `modules/`                     |

## 新增檔案流程

1. 判定性質：通用 framework 說明？ → 本目錄
2. 命名風格：kebab-case；禁用版本標記（如 `(2026 旗艦版)`）或專案名稱
3. 文首加標示區塊：
   ```markdown
   > **文件分層**：framework（跨專案通用）
   > **類別**：framework-docs（`.agents/docs/` 層）
   > **維護者**：`@Retro`（透過 RULE_UPDATE_PROPOSAL）
   > **對齊**：`RULES_DESIGN_GUIDE §二十 文件分層三原則`
   ```
4. 新增後由 `docs-location-validator.mjs`（Phase D 新建）驗證

## 禁止行為

- **絕對禁止** 本目錄存放含專案業務邏輯的文件
- **絕對禁止** 本目錄存放含專案特定命名（如 `InvestmentLineNotify`）的文件
- **絕對禁止** Agents 在此專案的運作紀錄（類別 B）放入本目錄

## 維護規範

- 新增 / 移動本目錄檔案須透過 `RULE_UPDATE_PROPOSAL`
- 檔案變更觸發 `agents-overview-sync-validator` + `docs-location-validator` 雙檢
- 本 README 為目錄說明，隨新增檔案時同步更新「當前檔案清單」表格

## 溯源

- 建立提案：PROPOSAL_20260423_004
- 對齊：`RULES_DESIGN_GUIDE §二十`
- 搭配 validator：`.agents/tests/docs-location-validator.py`（Phase D 新建）
- 框架層白名單：`.agents/scripts/framework-diff.py` `FRAMEWORK_LAYER_PATTERNS` 含 `/^docs\/[^/]+\.md$/`（Phase F 擴充）
