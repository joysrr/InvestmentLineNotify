---
type: plan
status: completed
created: 2026-11-10
last_updated: 2026-11-10
tags:
  - documentation-cleanup
  - docs-governance
  - truth-source-alignment
wiki_links:
  - docs/README.md
  - docs/meta/documentation-standards.md
  - docs/meta/maintenance-schedule.md
---

# 計畫書：docs 文件庫第二階段清理與真理源對齊

## 1. 背景與目標

第一階段清理已刪除過時報告、更新 `.gitignore` 並建立核心 SSOT。本計畫針對核實後遺留的 5 項問題（A1, A2, B1, C1, D1）進行清理、命名規範化與導航真理源同步。

## 2. 待處理項目清單

| 編號   | 優先級 | 項目                                                        | 處置方式                                               | 狀態   |
| :----- | :----- | :---------------------------------------------------------- | :----------------------------------------------------- | :----- |
| **A1** | 🔴 高  | `docs/README.md` 第 2 節仍含「P1 條件加碼」                 | 修正為「現金驅動曝險建議（手動操作參考，非自動加碼）」 | 進行中 |
| **A2** | 🟠 中  | `docs/README.md` 導航地圖列出 `useApiRequest-guide.md` 核實 | 查驗本機實際路徑，確認導航映射完整無斷鏈               | 待執行 |
| **B1** | 🟠 中  | `docs/plans/completed/` 舊計畫補齊日期前綴或移轉            | 盤點無日期計畫，規範檔名為 `YYYY-MM-DD-*`              | 待執行 |
| **C1** | 🟡 低  | `BUDGET_PRIORITY_DESIGN.md` 內容同步與真理源確認            | 核對 `budgetLimitPolicy.mjs`，確認與現況程式碼一致     | 待執行 |
| **D1** | 🟡 低  | 個人化設計文件未列入導航地圖 (隱形文件)                     | 補齊至 `docs/README.md` 導航樹                         | 待執行 |

## 3. 執行進度追蹤

- [x] Phase 1: 真理源修正 (A1, A2) - 已完成，README.md 行動建議分級修正，useApiRequest-guide.md 查驗存在 (commit e88d685)
- [x] Phase 2: plans/completed/ 盤點與規範化 (B1) - 已完成，48 個無日期前綴檔案全數重命名為 YYYY-MM-DD 前綴，消除 DEPLOYMENT_CHECKLIST.md 命名衝突
- [x] Phase 3: 設計文件與導航地圖同步 (C1, D1) - 已完成，BUDGET_PRIORITY_DESIGN.md 更新 last_verified 與架構說明，docs/README.md 補齊個人化設計盤點文件導航
- [x] Phase 4: 全面健康度與 Wiki 驗證 (收尾) - pre-commit-docs-check, generate-wiki-index, validate-wiki-index 全數零錯誤通過，915 個後端單元測試與 438 個前端測試全數通過
