# Phase 5: 後續改善與優化計畫 (疊代自 Phase 1-4 審計)

**建立日期**: 2026-08-12  
**來源**: [PHASE_1_4_AUDIT_REPORT.md](./PHASE_1_4_AUDIT_REPORT.md)  
**基準版本**: UNIFIED_DEVELOPMENT_PLAN.md v1.5 (Phase 1-4 完成版)

---

## 📋 概覽

Phase 1-4 核心功能已全部交付完成。本計畫針對審計發現的**未完成項目、環境限制問題、技術債**進行分類規劃，以便後續排程開發。

---

## 🎯 Phase 5.1: 測試環境修復與穩定化 (預估 4h)

### 目標
解決 Phase 4.1 `backtestScheduler` 3 個測試的環境限制，清理 `deploy.test.mjs` 背景 unhandled rejection。

| 任務 | 優先級 | 預估工時 | 說明 |
|------|--------|----------|------|
| **5.1.1** 修復 backtestScheduler 測試資料問題 | 🟡 Medium | 2h | 建立測試專用資料庫種子資料，或 Mock `backtestRunner.run()` 回傳固定結果 |
| **5.1.2** 清理 deploy.test.mjs 背景 async 清理 | 🟢 Low | 1h | 在 `afterAll` 中等待所有部署任務完成並釋放鎖 |
| **5.1.3** 統一測試超時設定 | 🟢 Low | 1h | vitest.config.mjs 設定 `testTimeout`、`hookTimeout` 適應長跑測試 |

### 驗收標準
- [ ] `backtestScheduler.test.mjs` 10/10 tests pass
- [ ] `deploy.test.mjs` 0 unhandled rejection
- [ ] 整合測試套件無背景錯誤

---

## 🎯 Phase 5.2: 既有整合測試基礎設施修復 (預估 6h)

### 目標
修復 7 個既有整合測試檔案的基礎設施問題，恢復完整測試套件綠燈。

| 任務 | 優先級 | 預估工時 | 說明 |
|------|--------|----------|------|
| **5.2.1** 修復 `apiContract.test.mjs` - `app.close()` undefined | 🟡 Medium | 1h | 檢查 app 建立邏輯，確保正確匯出 close 方法 |
| **5.2.2** 修復 `backtestRoutes.test.mjs` / `strategyStatus.test.mjs` - Vite 解析失敗 | 🟡 Medium | 2h | 統一副檔名策略 (.mjs vs .ts)、修正 import 路徑、配置 vitest transform |
| **5.2.3** 修復 `dataIntegrity.test.mjs` - Hook timeout | 🟢 Low | 1h | 增加 hookTimeout 或優化資料載入邏輯 |
| **5.2.4** 修復 `test_import.test.mjs` / `test_scheduler_direct.test.mjs` - 舊 import 路徑 | 🟢 Low | 1h | 更新 import 路徑指向 `.ts` 檔案，或移除過時測試檔 |
| **5.2.5** 整合測試執行驗證 | 🟢 Low | 1h | 執行 `npx vitest run src/test/integration` 全綠燈 |

### 驗收標準
- [ ] 所有 `src/test/integration/*.test.mjs` 檔案通過
- [ ] 無 Vite 解析錯誤
- [ ] 無 import 路徑錯誤

---

## 🎯 Phase 5.3: dogfood 探索式 QA 報告補齊 (預估 3h)

### 目標
補齊 Phase 4.2 計畫要求但未執行的 dogfood 探索式 QA。

| 任務 | 優先級 | 預估工時 | 說明 |
|------|--------|----------|------|
| **5.3.1** 執行 dogfood 掃描 Vite dev server + API server | 🟢 Low | 1h | 使用 `dogfood` skill 掃描全流程 |
| **5.3.2** 整理 Bug 分類報告 (Critical/High/Medium/Low) | 🟢 Low | 1h | 含截圖、Console 錯誤、重現步驟 |
| **5.3.3** 輸出 `dogfood-output/report.md` | 🟢 Low | 1h | 符合 Phase 4.2 計畫格式要求 |

### 驗收標準
- [ ] `dogfood-output/report.md` 存在且格式完整
- [ ] 涵蓋 Vite dev + API server 全流程
- [ ] Bug 分類清晰、可追蹤

---

## 🎯 Phase 5.4: Coverage 門檻實際驗證與提升 (預估 4h)

### 目標
驗證並提升前端覆蓋率至 80% 門檻 (Phase 3 已設定配置但未實測)。

| 任務 | 優先級 | 預估工時 | 說明 |
|------|--------|----------|------|
| **5.4.1** 執行覆蓋率測試並生成報告 | 🟡 Medium | 1h | `npx vitest run --coverage` |
| **5.4.2** 分析覆蓋率缺口，補齊關鍵路徑測試 | 🟡 Medium | 2h | 針對 lines < 80% 的模組補測試 |
| **5.4.3** 驗證 CI 環境覆蓋率門檻生效 | 🟢 Low | 1h | 確認 vitest.config coverage thresholds 設定正確 |

### 驗收標準
- [ ] 前端覆蓋率 ≥ 80% (lines/functions/branches)
- [ ] Coverage 報告可生成並查看
- [ ] 門檻在 CI 中生效

---

## 🎯 Phase 5.5: 文件完善與架構決策補充 (預估 2h)

### 目標
補充 Phase 1-4 過程中產生的架構決策、API 文件更新。

| 任務 | 優先級 | 預估工時 | 說明 |
|------|--------|----------|------|
| **5.5.1** 整理 Phase 4 相關 ADR (排程、監控、部署架構) | 🟢 Low | 1h | 新增 ADR-003~005 或 DEC-25+ |
| **5.5.2** 更新 OpenAPI 規範包含新增端點 | 🟢 Low | 1h | `npm run openapi:generate` 驗證 |

### 驗收標準
- [ ] ADR 文件完整記錄 Phase 4 架構決策
- [ ] OpenAPI 規範包含所有新增端點

---

## 🎯 Phase 5.6: 既有程式碼品質問題修復 (預估 6h)

### 目標
修復 commit 過程中 husky pre-commit hook 檢出的既有程式碼品質問題 (eslint errors、prettier 格式、重複 key 等)，這些為 Phase 1-4 開發過程中累積的技術債，非 Phase 4 新增代碼導致。

| 任務 | 優先級 | 預估工時 | 說明 |
|------|--------|----------|------|
| **5.6.1** 修復 ESLint Errors (9 errors) | 🟡 Medium | 3h | - `src/api/routes/backtestRoutes.mjs` 解析錯誤<br>- `src/modules/monitoring/metricsCollector.mjs` Duplicate reset()<br>- `src/test/unit/assetRegistry.test.mjs` Duplicate key 'macroData'<br>- `src/test/unit/strategyEngine.test.mjs` Duplicate keys (indicators, marketStatus, trailingActive)<br>- `src/test/integration/test_import.test.mjs` Undefined vitest globals (describe/it/expect) |
| **5.6.2** 清理 ESLint Warnings (61 warnings) | 🟢 Low | 2h | 未使用變數、未使用 import、參數前綴 _ 規範 |
| **5.6.3** Prettier 格式化全專案 | 🟢 Low | 1h | 執行 `npx prettier --write .` 統一格式 |

### 驗收標準
- [ ] `npx eslint src/` 零 error (warnings 可接受)
- [ ] `npx prettier --check .` 通過
- [ ] Husky pre-commit hook 正常通過

---

## 📅 總時程彙總 (Phase 5)

| 階段 | 預估工時 | 優先級 |
|------|----------|--------|
| **5.1** 測試環境修復與穩定化 | 4h | 🟡 High |
| **5.2** 既有整合測試基礎設施修復 | 6h | 🟡 High |
| **5.3** dogfood 探索式 QA 報告補齊 | 3h | 🟢 Low |
| **5.4** Coverage 門檻實際驗證與提升 | 4h | 🟡 Medium |
| **5.5** 文件完善與架構決策補充 | 2h | 🟢 Low |
| **5.6** 既有程式碼品質問題修復 | 6h | 🟡 Medium |
| **總計** | **25h** | |

---

## 🔗 相依關係

```
5.1 (測試環境修復) 
    └─> 5.2 (整合測試基礎設施) 可並行

5.3 (dogfood QA) 獨立

5.4 (Coverage) 需 5.1/5.2 完成後執行 (測試需穩定)

5.5 (文件) 獨立，可隨時執行

5.6 (程式碼品質) 獨立，建議在 5.1/5.2 後執行 (需穩定測試環境)
```

---

## 📋 決策記錄 (本計畫新增)

| 編號 | 決策 | 狀態 | 日期 |
|------|------|------|------|
| DEC-25 | Phase 5 為疊代改善計畫，不阻擋 Phase 1-4 核心功能上線 | ✅ | 2026-08-12 |
| DEC-26 | 整合測試基礎設施修復優先於新功能開發 | ✅ | 2026-08-12 |
| DEC-27 | 既有程式碼品質問題 (ESLint/Prettier) 納入 Phase 5.6 統一修復 | ✅ | 2026-08-12 |

---

## 🚀 執行建議

### 方案 A: 專注核心穩定 (推薦，約 10h)
優先完成 **5.1 + 5.2**，確保測試套件完全綠燈，為後續開發奠定基礎。

### 方案 B: 完整疊代 (約 19h)
依序完成所有 Phase 5 任務，達到生產級品質標準。

### 方案 C: 最小可行 (約 4h)
僅完成 **5.1**，解決 Phase 4 自身的測試問題，其餘留待後續 Sprint。

---

## 📌 追蹤與更新

- **主要追蹤文件**: 本文件 (`PHASE_5_REMAINING_WORK.md`)
- **進度同步**: 每完成一子任務更新狀態
- **關聯文件**: 
  - `UNIFIED_DEVELOPMENT_PLAN.md` (Phase 1-4 完成版)
  - `PHASE_1_4_AUDIT_REPORT.md` (詳細審計報告)
  - `MASTER_PLAN.md` (高層概覽)

---

_此文件為 Phase 5 後續改善計畫單一真實來源。_