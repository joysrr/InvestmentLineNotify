# Phase 6: 品質硬化與技術債清理計畫

> **來源**: Phase 5 完整疊代計畫 (方案 B) 產出的技術債務清單  
> **前置**: Phase 5 已全數完成 (DoD 5 條門檻達成)  
> **建立**: 2026-08-13

---

## 目標

將 Phase 5 遺留的技術債務系統性清理，達到生產級品質標準:
- Branches 覆蓋率 60% -> 70%
- ESLint Warnings 292 -> 0 (或可接受水準)
- Dogfood Bug 修復 (15 bugs)
- vitest Worker 穩定性修復

---

## 階段規劃

### 6.1 ESLint Warnings 系統性清理 (預估 3h)

**目標**: 292 warnings -> 0 (或 < 20 可接受水準)

| 任務 | 分類 | 數量 | 預估工時 | 策略 |
|------|------|------|----------|------|
| **6.1.1** underscore args 自動修復 | 自動 | 20 | 0.5h | eslint --fix (request/reply -> _request/_reply) |
| **6.1.2** catch clause 自動修復 | 自動 | 2 | 0.1h | catch(e) -> catch(_) |
| **6.1.3** test imports 手動刪除 | 手動 | 89 | 1h | 逐檔刪除未使用 import (vi, beforeAll 等) |
| **6.1.4** source real unused 手動刪除 | 手動 | 121 | 1h | 驗證後刪除，避免誤刪反射用途 |
| **6.1.5** vue component 修復 | 手動 | 7 | 0.3h | vue/one-component-per-file 拆分或豁免 |
| **6.1.6** 驗證 + 重啟 max-warnings=0 | 驗證 | -- | 0.1h | eslint src/ 0 warnings, 重啟 husky |

**優先檔案** (Top warnings):
1. src/test/unit/decisionRules.test.mjs (22)
2. src/api/routes/monitoringRoutes.mjs (17)
3. src/test/integration/decisionChain.test.mjs (14)
4. src/modules/notifications/templates/telegramHtmlBuilder.mjs (13)
5. src/modules/strategy/strategyEngine.mjs (12)
6. src/test/providers.test.mjs (12)

**驗收**: `npx eslint src/` 0 errors, 0 warnings (或 < 20 並記錄 DEC)

---

### 6.2 Branches 覆蓋率提升至 70% (預估 4h)

**目標**: Branches 60.14% -> 70%

**主要缺口模組** (依影響排序):

| 模組 | Branches | Lines | 測試數 | 策略 |
|------|----------|-------|--------|------|
| aiClient.mjs | 27.02% | 37.83% | 68 tests | 補測 Provider fallback chain、retry loop 分支 |
| simulate.mjs (v1) | 26.82% | 31.35% | -- | 補測批次/敏感度/Pareto 端點分支 |
| errorStore.mjs | 0% | 7.81% | -- | 補測 SQLite CRUD 分支 |
| alertEngine.mjs | 12% | 16.39% | -- | 補測規則評估/通知分發 |
| executor.mjs (deploy) | 15.15% | 29.83% | -- | 補測部署步驟/回滾/健康檢查 |
| newsFetcher.mjs | 16.66% | 13.3% | -- | 大模組，補測核心路徑 |
| storage.mjs | 11.47% | 15.55% | -- | 補測讀寫/備份/遷移 |
| ilnState.mjs | 33.58% | 38.96% | -- | 補測狀態轉換分支 |

| 任務 | 預估工時 | 說明 |
|------|----------|------|
| **6.2.1** aiClient.mjs 分支補測 | 1h | Provider fallback、retry backoff、circuit breaker 狀態 |
| **6.2.2** simulate.mjs (v1) 分支補測 | 1h | 批次/敏感度/Pareto 端點 |
| **6.2.3** monitoring 模組補測 | 0.5h | errorStore + alertEngine 核心路徑 |
| **6.2.4** deployment executor 補測 | 0.5h | 部署步驟/回滾/健康檢查 |
| **6.2.5** 其餘缺口評估 | 1h | newsFetcher/storage/ilnState 視影響決定是否補測 |

**驗收**: `npx vitest run --coverage` Branches >= 70%

---

### 6.3 Dogfood Bug 修復 (預估 2h)

**目標**: 修復 9 High + 6 Medium bugs

| 類別 | 數量 | 根因 | 修復策略 |
|------|------|------|----------|
| API 403 (High) | 9 | initData guard 要求 Telegram hash | 6.3.1: 測試環境 bypass 機制 |
| Frontend 500 (Medium) | 6 | API 403 連鎖反應 | 6.3.2: 修復 API 後自動解決 |

| 任務 | 預估工時 | 說明 |
|------|----------|------|
| **6.3.1** initData guard 測試環境 bypass | 1h | 環境變數控制: NODE_ENV=dev 或 TEST_MODE=1 时跳過 hash 驗證 |
| **6.3.2** 重新執行 Dogfood 驗證 | 0.5h | npm run dogfood 確認 0 bugs |
| **6.3.3** Dogfood 腳本改善 | 0.5h | 支援帶 initData 的測試模式 |

**驗收**: `dogfood-output/report.md` 0 High bugs, 0 Medium bugs

---

### 6.4 vitest Worker 穩定性修復 (預估 0.5h)

**目標**: 消除 "Worker exited unexpectedly" 間歇性錯誤

| 任務 | 預估工時 | 說明 |
|------|----------|------|
| **6.4.1** 診斷 Worker fork 崩潰根因 | 0.3h | 檢查 OOM、長時間測試、未清理資源 |
| **6.4.2** 修復或調整 vitest 配置 | 0.2h | pool forks -> threads 或調整 maxWorkers |

**驗收**: `npx vitest run` 0 errors, 0 unhandled errors

---

## 總時程彙總

| 階段 | 預估工時 | 優先級 |
|------|----------|--------|
| **6.1** ESLint Warnings 清理 | 3h | High |
| **6.2** Branches 覆蓋率 70% | 4h | High |
| **6.3** Dogfood Bug 修復 | 2h | Medium |
| **6.4** vitest 穩定性 | 0.5h | Low |
| **總計** | **9.5h** | |

---

## 執行順序

```
6.1 (ESLint Warnings) [3h]  -- 獨立，先清噪
  |
  v
6.2 (Branches 覆蓋率) [4h]  -- 需穩定測試環境
  |
  v
6.3 (Dogfood Bug 修復) [2h]  -- 需 API 測試環境
  |
  v
6.4 (vitest 穩定性) [0.5h]   -- 最後收尾
```

---

## 驗收標準 (Phase 6 DoD)

- [ ] `npx eslint src/` 0 errors, 0 warnings (或 < 20 並記錄 DEC)
- [ ] `npx vitest run --coverage` Branches >= 70%
- [ ] `dogfood-output/report.md` 0 High bugs
- [ ] `npx vitest run` 0 unhandled errors
- [ ] husky pre-commit hook 重啟 max-warnings=0

---

## 決策記錄 (Phase 6 執行時補充)

| DEC | 決策 | 狀態 | 日期 |
|-----|------|------|------|
| -- | (執行時記錄) | -- | -- |
