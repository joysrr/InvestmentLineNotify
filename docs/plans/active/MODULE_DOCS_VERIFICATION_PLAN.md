---
type: plan
status: in-progress
last_updated: 2026-09-11
progress: 5%
tags:
  - verification
  - modules
  - documentation
wiki_links:
  - [[Documentation]]
---

# 模組文件完整性驗證計畫

> **目標**: 逐一驗證所有模組文件的 `related_code` 路徑正確性，修正錯誤路徑  
> **範圍**: docs/modules/ 下全部 .md 文件（45 個）  
> **預估時間**: 3-4h

---

## 📊 驗證發現摘要

### 錯誤路徑統計

| 模組           | 文件數 | ❌ 錯誤路徑 | 狀態          |
| -------------- | ------ | ----------- | ------------- |
| infrastructure | 3      | 3           | 🔴 待修正     |
| strategy       | 6      | 3           | 🔴 待修正     |
| presentation   | 5      | 2           | 🔴 待修正     |
| operations     | 1      | 3           | 🔴 待修正     |
| ai_news        | 11     | 2           | 🔴 待修正     |
| **總計**       | **45** | **13**      | **🔴 進行中** |

---

## 🔍 發現的錯誤路徑清單

### 1. Infrastructure 模組（3 個錯誤）

| 文件            | 錯誤路徑                                     | 真實路徑                                |
| --------------- | -------------------------------------------- | --------------------------------------- |
| data_manager.md | `src/modules/infrastructure/`                | ❌ 目錄不存在                           |
| data_manager.md | `src/modules/infrastructure/dataManager.mjs` | → `src/modules/data/`                   |
| data_manager.md | `src/modules/infrastructure/storage.mjs`     | → `src/modules/data/archiveManager.mjs` |

**修正方案**:

- `infrastructure/` → `data/`
- `dataManager.mjs` 已重命名為多個檔案（`archiveManager.mjs`, `newsPoolManager.mjs`）

---

### 2. Strategy 模組（3 個錯誤）

| 文件                         | 錯誤路徑                            | 真實路徑      |
| ---------------------------- | ----------------------------------- | ------------- |
| lifecycle_engine.md          | `src/modules/strategy/lifecycle/`   | ❌ 目錄不存在 |
| maintenance_state_machine.md | `src/modules/strategy/maintenance/` | ❌ 目錄不存在 |
| providers.md                 | `src/modules/strategy/providers/`   | ❌ 目錄不存在 |

**核查結果**: 這些目錄在代碼中確實不存在，可能是：

- 設計意圖，尚未實作
- 已整合進其他模組
- 需進一步確認

---

### 3. Presentation 模組（2 個錯誤）

| 文件                    | 錯誤路徑                         | 真實路徑                         |
| ----------------------- | -------------------------------- | -------------------------------- |
| presentation/_index.md  | `src/modules/presentation/`      | ❌ 目錄不存在                    |
| portfolio_health_api.md | `src/api/portfolioHealthApi.mjs` | → `src/api/routes/portfolio.mjs` |

**修正方案**:

- `presentation/` 已重命名為 `bot/` + `notifications/`
- `portfolioHealthApi.mjs` → `routes/portfolio.mjs`

---

### 4. Operations 模組（3 個錯誤）

| 文件                    | 錯誤路徑                  | 真實路徑           |
| ----------------------- | ------------------------- | ------------------ |
| env_vars.md             | `src/modules/operations/` | ❌ 目錄不存在      |
| deployment_oracle_vm.md | `config/crontab.json`     | → `cron/` 或不存在 |
| deployment_oracle_vm.md | `.env.example`            | ✅ 存在            |

**修正方案**:

- `operations/` 不是代碼目錄，是運維概念
- `crontab.json` → 檢查 Hermes cron 配置

---

### 5. AI News 模組（2 個錯誤）

| 文件              | 錯誤路徑                               | 真實路徑                                 |
| ----------------- | -------------------------------------- | ---------------------------------------- |
| keyword_config.md | `src/modules/ai/keywordConfig.mjs`     | → `src/modules/news/` 或不存在           |
| news_fetcher.md   | `src/modules/news/newsPoolManager.mjs` | → `src/modules/data/newsPoolManager.mjs` |

**修正方案**:

- `keywordConfig.mjs` → 可能在 data/config/ 或整合進其他模組
- `newsPoolManager.mjs` → `src/modules/data/`

---

## 📋 驗證計畫

### 階段 1: 自動化路徑掃描（已完成）

- ✅ 掃描全部 45 個模組文件
- ✅ 提取 `related_code` 路徑
- ✅ 驗證檔案存在性
- ✅ 識別 13 個錯誤路徑

### 階段 2: 逐模組深度驗證（進行中）

對每個模組：

1. 讀取文件描述的功能
2. 在代碼中尋找對應實作
3. 確認路徑正確性
4. 修正錯誤路徑

### 階段 3: 批量修正

- 使用 patch 工具批量更新 related_code
- 確保每次修改通過 pre-commit hook

### 階段 4: 驗證報告

- 建立修正記錄
- 更新驗證報告

---

## 🎯 執行順序

1. ✅ **Infrastructure** - 優先級 HIGH（基礎模組）
2. ⬜ **Strategy** - 優先級 HIGH（核心邏輯）
3. ⬜ **Presentation** - 優先級 MEDIUM
4. ⬜ **Operations** - 優先級 MEDIUM
5. ⬜ **AI News** - 優先級 MEDIUM
6. ⬜ 其他模組 - 優先級 LOW

---

## ⏱️ 時間分配

- 階段 1: 0.5h（已完成）
- 階段 2: 2h（進行中）
- 階段 3: 0.5h
- 階段 4: 0.5h

**當前狀態**: 階段 2 - Infrastructure 模組驗證中
