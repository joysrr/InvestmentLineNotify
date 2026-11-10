---
type: plan
status: completed
created: 2026-11-10
last_updated: 2026-11-10
tags:
  - documentation-cleanup
  - docs-governance
  - navigation-map
wiki_links:
  - docs/README.md
  - docs/meta/documentation-standards.md
---

# 計畫書：docs 文件庫第三階段整理

> **狀態**：Completed (所有 Phase 均已落實並完成驗收)  
> **建立日期**：2026-11-10  
> **完成日期**：2026-11-10  
> **負責人**：Tech Lead (Hermes Agent)

---

## 1. 執行目標

- **Phase 1: 導航地圖補齊（A）**
  - 在 `docs/README.md` 補上 4 個遺漏檔案：
    - `docs/api/decision-chain_api.md`
    - `docs/operations/automated-deployment-milestone.md`
    - `docs/modules/_index.md`
    - `docs/design/README.md`
  - 驗證 Wiki Index 零斷鏈。

- **Phase 2: plans/ 命名與重複清理（B, C, D）**
  - B: `docs/plans/active/` 盤點與標準化：
    - `DOCUMENTATION_REORGANIZATION_PLAN.md` 已全數落實，改為 `status: completed` 並移入 `docs/plans/completed/2026-11-10-DOCUMENTATION_REORGANIZATION_PLAN.md`。
    - `LOCALHOST_MINI_APP_PREVIEW_PLAN.md` 改名為 `2026-11-10-LOCALHOST_MINI_APP_PREVIEW_PLAN.md`（維持 active）。
  - C: `docs/plans/completed/` 4 個殘留檔案查核：確認已於 commit `23d9fab` 徹底刪除，無殘留。
  - D: 刪除重複之 `docs/plans/completed/2026-09-10-E2E_TESTING_PLAN.md`（保留 `2026-08-15-E2E_TESTING_PLAN_v2.0.md`），同步更新引用。

- **Phase 3: 版本記錄同步（E）**
  - 更新 `docs/design/BUDGET_PRIORITY_DESIGN.md` 第 8 節版本記錄表，v1.1 標記為 2026-11-10 及 P1 移除架構說明，未實作項目標記為「規劃中」。

- **Phase 4: 全量驗收**
  - 執行 pre-commit、wiki-index 生成、驗證與健康度診斷。

---

## 2. 進度追蹤

- [x] Phase 1: 導航地圖補齊（decision-chain_api.md、automated-deployment-milestone.md、_index.md、design/README.md）
- [x] Phase 2: plans/ 命名與重複清理（DOCUMENTATION_REORGANIZATION_PLAN 歸檔 completed、LOCALHOST_MINI_APP_PREVIEW_PLAN 改名前綴、刪除重複之 2026-09-10-E2E_TESTING_PLAN.md、確認 4 個殘留檔案已於 23d9fab 刪除）
- [x] Phase 3: 版本記錄同步（BUDGET_PRIORITY_DESIGN.md 第 8 節更新為 2026-11-10 與 P1 移除架構說明）
- [x] Phase 4: 全量驗收與計畫歸檔
