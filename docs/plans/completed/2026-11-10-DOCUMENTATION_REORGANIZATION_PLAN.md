---
type: plan
status: completed
last_updated: 2026-11-10
tags:
  - documentation
  - modernization
  - archive
  - wiki
wiki_links:
  - [[Documentation Standards]]
---

# docs/ 文件庫過時殘留清理與架構同步計畫

> **狀態**：Completed (所有 Phase 均已落實並完成驗收)  
> **建立日期**：2026-11-10  
> **完成日期**：2026-11-10  
> **負責人**：Tech Lead (Hermes Agent)  
> **背景**：針對 `docs/` 文件庫進行全面盤點，發現大量 2026 年 4 月至 8 月專案初期的歷史殘留（巨型代碼傾印、過時草稿池、假想下單模組、非真理之源的 Swagger 引用、以及根目錄缺乏 `docs/README.md` 中樞），需進行系統性歸檔、更新與架構對齊，確保 Agent 能精準利用文件且不被過時資訊誤導。

---

## 🎯 整理核心原則

1. **品質大於效率**：文件分類均有其語意與工程意義，整理重點在於「更新現行內容確保不過時」與「將歷史檔案妥善歸檔並標記」，而非粗暴刪除歷史。
2. **單一真理源 (Single Source of Truth)**：
   - API 規格真理之源：`docs/api/openapi.json`（非根目錄 `swagger.json`）。
   - 財務資金真理：增貸 150 萬已於 2026-11 全數投入完畢（105 萬 0050、45 萬 00740B）；P0 固定 DCA 3 萬/月無條件執行；portfolio.cash 為純自有儲備；槓桿 0050=1x、00675L=2x。
   - 系統運維真理：每日排程由主機 System Cron 獨立執行；專案全面內聚（Node.js ESM `.mjs`，嚴禁混雜 Python，嚴禁硬編碼路徑）。
3. **驗證與索引同步**：每批變更後執行 `generate-wiki-index.mjs` 與 `validate-wiki-index.mjs`，確保知識圖譜 0 斷鏈、驗證通過。

---

## 📋 盤點問題與分類清單

### 類別 A：巨型傾印與重複/廢棄檔案

- [ ] `docs/Reports/archive/main_code_review_20260429.md` (1.53 MB)：2026-04 舊專案 Windows 本地路徑代碼 dump，無 frontmatter，純雜訊，應壓縮或歸檔至歷史專區並標記。
- [ ] `docs/modules/ai_news/integrations/langfuse_prompt_management_v3_deprecated.md`：停留在現行模組目錄的廢棄檔案，應移至 `docs/modules/ai_news/integrations/archive/`。
- [ ] `docs/modules/ai_news/integrations/langfuse_prompt_management.md` 與 `langfuse_prompt_management_v5.md`：合併重複內容，保留單一現行版本。

### 類別 B：Backlog 中不適用當前架構的早期草稿 (`docs/plans/backlog/`)

- [ ] `preplan_features.md`：內容混合已完成項目與早期的「自動下單/交易執行」假想模組（`executionManagement.mjs`、`portfolioManager.mjs` 等，與當前通知/Mini App 定位不符），應更新為已歸檔歷史草稿，移至 `docs/plans/archive/historical_drafts/`。
- [ ] `preplan_interface.md`、`system_optimize_suggest.md`、`ideas_features.md`：同樣歸檔至 `docs/plans/archive/historical_drafts/`，避免被 Agent 視為未執行的活躍待辦。

### 類別 C：根目錄結構整頓與建立導航中樞

- [ ] **建立 `docs/README.md`**：建立文件庫導航中樞，詳細定義目錄樹、當前架構核心真理、各模組職責與查閱指引。
- [ ] `docs/SCHEDULER_COUPLING_ANALYSIS.md`：已標記為 `status: archived`，移入 `docs/Reports/archive/`。
- [ ] `docs/API_CONTRACT.md` 與 `docs/modules/presentation/api/_index.md`：移除對舊 `swagger.json` 的指引，更新指向 `docs/api/openapi.json`。

### 類別 D：現行架構與財務真理一致性檢查

- [ ] 檢視 `docs/modules/strategy/` 與 `docs/architecture/`，確認資金分層（增貸完成投入、P0 DCA 與 P1 條件加碼區隔）與主機排程運維描述一致。

---

## 🚀 執行階段規劃 (4 階段)

### Phase 1：建立系統導航中樞與根目錄文件整頓

1. 建立 `docs/README.md`，統整文件目錄導航、當前架構原則與真理源。
2. 將已歸檔的 `docs/SCHEDULER_COUPLING_ANALYSIS.md` 移入 `docs/Reports/archive/`。
3. 修正 `docs/API_CONTRACT.md` 與 `docs/modules/presentation/api/_index.md` 中的 API 規範真理之源（改為 `docs/api/openapi.json`）。
4. 補齊 `docs/plans/active/LOCALHOST_MINI_APP_PREVIEW_PLAN.md` frontmatter。
5. 執行 Wiki 索引生成與驗證。

### Phase 2：清理過時 Backlog 草稿與模組廢棄文件

1. 建立 `docs/plans/archive/historical_drafts/`。
2. 將 `docs/plans/backlog/` 中與當前架構不符的草稿（`preplan_features.md`, `preplan_interface.md`, `system_optimize_suggest.md`, `ideas_features.md`）更新 frontmatter 狀態為 `archived` 並移入該目錄。
3. 清理 `docs/modules/ai_news/integrations/`：歸檔 v3 deprecated 文件，合併重複的 prompt management 文件。
4. 執行 Wiki 索引生成與驗證。

### Phase 3：歷史 Reports 整理與大型傾印歸檔標記

1. 處理 `docs/Reports/archive/main_code_review_20260429.md`（補上 YAML frontmatter 並清楚註記為 2026-04 歷史傾印快照）。
2. 更新 `docs/Reports/README.md`，清楚標註現行有效報告與歷史報告之分界。
3. 執行 Wiki 索引生成與驗證。

### Phase 4：全量健康度檢查與全案驗收

1. 執行 `node scripts/analyze-docs-health.mjs`，確認健康度評分提升。
2. 執行 `node scripts/validate-wiki-index.mjs`，確認 0 斷鏈且無不存在檔案。
3. Commit 並向 Han 匯報最終成果。
