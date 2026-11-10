---
type: plan
status: in-progress
created: 2026-11-11
last_updated: 2026-11-11
tags:
  - documentation-cleanup
  - docs-governance
  - modules-audit
  - root-level-audit
wiki_links:
  - docs/README.md
  - docs/modules/_index.md
  - docs/meta/documentation-standards.md
---

# 計畫書：docs 文件庫第四階段整理（模組層與根目錄審查）

> **狀態**：In-Progress  
> **建立日期**：2026-11-11  
> **負責人**：Tech Lead (Hermes Agent)

---

## 1. 執行目標

- **Phase 1: docs/modules/ 全面盤點（A, E）**
  - 盤點 5 個子目錄（infrastructure, strategy, presentation, operations, ai_news）所有檔案。
  - 檢查各檔案之 last_updated、status 與程式碼對齊度。
  - 評估 `docs/modules/_index.md`（31 KB）與 `strategy/audit/` 之處置。
- **Phase 2: DEC 檔案放置一致性（C）**
  - 採方案 A：將 `DEC-005-monitoring-alerting.md` 與 `DEC-006-deployment-automation.md` 自 `docs/architecture/` 移至 `docs/decisions/`。
  - 同步更新 `docs/README.md`、`docs/architecture/README.md` 及全庫 wiki 引用。
- **Phase 3: 里程碑與根目錄（B, D）**
  - B: 處置 `docs/operations/automated-deployment-milestone.md`。
  - D: 查驗根目錄 `swagger.json` 引用狀況、`SOUL.md` 定位與根目錄 `README.md` 之分工。
- **Phase 4: 收尾驗證**
  - 執行 pre-commit、wiki-index 生成、驗證與健康度診斷。

---

## 2. 進度追蹤

- [ ] Phase 1: docs/modules/ 全面盤點
- [ ] Phase 2: DEC 檔案放置一致性
- [ ] Phase 3: 里程碑與根目錄
- [ ] Phase 4: 全量驗收與計畫歸檔
