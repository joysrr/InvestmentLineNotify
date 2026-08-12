# Phase 5: 後續改善與優化計畫 (疊代自 Phase 1-4 審計)

**建立日期**: 2026-08-12  
**來源**: [PHASE_1_4_AUDIT_REPORT.md](./PHASE_1_4_AUDIT_REPORT.md)  
**基準版本**: UNIFIED_DEVELOPMENT_PLAN.md v1.5 (Phase 1-4 完成版)

---

## 📋 概覽

Phase 1-4 核心功能已全部交付完成。本計畫針對審計發現的**未完成項目、環境限制問題、技術債**進行分類規劃，以便後續排程開發。

---

## 🎯 Phase 5.1: 測試環境修復與穩定化 (預估 3h) ⬅️ 從 4h 調整

### 目標
解決 Phase 4.1 `backtestScheduler` 3 個測試的環境限制，清理 `deploy.test.mjs` 背景 unhandled rejection。

| 任務 | 優先級 | 預估工時 | 說明 |
|------|--------|----------|------|
| **5.1.1** 修復 backtestScheduler 測試資料問題 | 🟡 Medium | **1h** ⬅️ 從 2h 調整 | **Mock `backtestRunner.run()` 回傳固定結果** (DEC-28)，不建立測試資料庫種子，**最小集合**：只 Mock `metrics: { totalReturn, winRate, maxDrawdown }`，其他依測試需求擴充 (DEC-35) | ✅ 完成 |
| **5.1.2** 清理 deploy.test.mjs 背景 async 清理 | 🟢 Low | 1h | 在 `afterAll` 中等待所有部署任務完成並釋放鎖 | ✅ 完成 |
| **5.1.3** 統一測試超時設定 | 🟢 Low | 1h | vitest.config.mjs 設定 `testTimeout`、`hookTimeout` 適應長跑測試 | ✅ 完成 |

### 驗收標準
- [x] `backtestScheduler.test.mjs` 10/10 tests pass
- [x] `deploy.test.mjs` 0 unhandled rejection
- [x] 整合測試套件無背景錯誤

**Phase 5.1 完成時間**: 2026-08-12 05:14 UTC
**實際工時**: ~2.5h (預估 3h)

---

## 🎯 Phase 5.2: 既有整合測試基礎設施修復 (預估 5h) ⬅️ 從 6h 調整

### 目標
修復 7 個既有整合測試檔案的基礎設施問題，恢復完整測試套件綠燈。

| 任務 | 優先級 | 預估工時 | 說明 |
|------|--------|----------|------|
| **5.2.1** 修復 `apiContract.test.mjs` - `app.close()` undefined | 🟡 Medium | 1h | 檢查 app 建立邏輯，確保正確匯出 close 方法 |
| **5.2.2** 修復 `backtestRoutes.test.mjs` / `strategyStatus.test.mjs` - Vite 解析失敗 | 🟡 Medium | **1.5h** ⬅️ 從 2h 調整 | **專案全面統一 .mjs 副檔名** (DEC-29)，包含源檔與測試檔，修正所有 import 路徑，配合 vitest/esbuild transform 處理，**先在 feature branch 實驗單一模組驗證** (DEC-38)，確認 Vite/TypeScript/Vitest 全通後再全專案推廣 |
| **5.2.3** 修復 `dataIntegrity.test.mjs` - Hook timeout | 🟢 Low | 1h | 增加 hookTimeout 或優化資料載入邏輯 |
| **5.2.4** 修復 `test_import.test.mjs` / `test_scheduler_direct.test.mjs` - 舊 import 路徑 | 🟢 Low | **0.5h** ⬅️ 從 1h 調整 | 更新 import 路徑指向 `.mjs` 檔案，移除過時測試檔 |
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
| **5.3.1** 執行 dogfood 掃描 Vite dev server + API server | 🟢 Low | 1h | 使用 **Playwright 自訂腳本** (DEC-30) 掃描核心 API + 關鍵頁面 3 個 (Dashboard/Simulator/Account)，檢測 Console 錯誤/網路失敗/JS 例外 |
| **5.3.2** 整理 Bug 分類報告 (Critical/High/Medium/Low) | 🟢 Low | 1h | 含截圖、Console 錯誤、重現步驟 |
| **5.3.3** 輸出 `dogfood-output/report.md` | 🟢 Low | 1h | 符合 Phase 4.2 計畫格式要求 |

### 驗收標準
- [ ] `dogfood-output/report.md` 存在且格式完整
- [ ] 涵蓋 Vite dev + API server 全流程
- [ ] Bug 分類清晰、可追蹤

---

## 🎯 Phase 5.4: Coverage 門檻實際驗證與提升 (預估 4h) ⬅️ 工時待基準測確認

### 目標
驗證並提升前端覆蓋率至 80% 門檻 (Phase 3 已設定配置但未實測)。

| 任務 | 優先級 | 預估工時 | 說明 |
|------|--------|----------|------|
| **5.4.1** 執行覆蓋率測試並生成報告 | 🟡 Medium | **0.5h** ⬅️ 從 1h 調整 | `npx vitest run --coverage`，**先檢查並補上 thresholds 配置 (lines:80, functions:80, branches:80)** (DEC-31)，再跑基準測確認現況 |
| **5.4.2** 分析覆蓋率缺口，補齊關鍵路徑測試 | 🟡 Medium | **待基準測確認，上限 6h** ⬅️ 從 2h 調整 | 針對 lines < 80% 的模組補測試，**工時視基準測結果調整**；若基準測 < 65% 採**分階段門檻**：Phase 5 達 70%，Phase 6 達 80% (DEC-39) |
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
| **5.5.1** 整理 Phase 4 相關架構決策 | 🟢 Low | 1h | **記錄為 DEC-28/29/30** (DEC-32)，輕量格式，不建立正式 ADR |
| **5.5.2** 更新 OpenAPI 規範包含新增端點 | 🟢 Low | 1h | `npm run openapi:generate` 驗證 |

### 驗收標準
- [ ] DEC 文件完整記錄 Phase 4 架構決策 (排程、監控、部署)
- [ ] OpenAPI 規範包含所有新增端點

---

## 🎯 Phase 5.6: 既有程式碼品質問題修復 (預估 5h) ⬅️ 從 6h 調整

### 目標
修復 commit 過程中 husky pre-commit hook 檢出的既有程式碼品質問題 (eslint errors、prettier 格式、重複 key 等)，這些為 Phase 1-4 開發過程中累積的技術債，非 Phase 4 新增代碼導致。

| 任務 | 優先級 | 預估工時 | 說明 |
|------|--------|----------|------|
| **5.6.1** 修復 ESLint Errors (9 errors) | 🟡 Medium | **2h** ⬅️ 從 3h 調整 | - `backtestRoutes.mjs` 解析錯誤 (多餘大括號)\n- `metricsCollector.mjs` Duplicate reset()\n- `assetRegistry.test.mjs` Duplicate key 'macroData'\n- `strategyEngine.test.mjs` Duplicate keys (indicators, marketStatus, trailingActive)\n- `test_import.test.mjs` **先 grep 檢查現有 vitest import 情況，再決定是否啟用 globals 配置** (DEC-33)，避免重複宣告衝突 |
| **5.6.2** 清理 ESLint Warnings (61 warnings) | 🟢 Low | **2h** | **分類處理** (DEC-36)：1) `_` 前綴參數自動修復 (`eslint --fix`)；2) 真正未使用的 import/變數手動刪除；3) 測試檔 `vi`/`beforeAll`/測試框架需要的保留 |
| **5.6.3** Prettier 格式化全專案 | 🟢 Low | **1h** | 執行 `npx prettier --write . --ignore-path .prettierignore`，**排除 `archive/`、`docs/plans/archive/` 歷史文件** (DEC-37)，只格式化 `src/`、`webapp/`、`scripts/`、`*.config.*` 等作用中代碼 |
| **5.6.4** Husky pre-commit hook 調整 | 🟢 Low | **0.5h** | **暫時關閉 `--max-warnings=0`** (DEC-34)，Phase 5.6 完成後再啟用 |

### 驗收標準
- [ ] `npx eslint src/` 零 error (warnings 可接受)
- [ ] `npx prettier --check .` 通過
- [ ] Husky pre-commit hook 正常通過

---

## ✅ Phase 5 完成定義 (Definition of Done)

完成所有 Phase 5 任務後，必須同時滿足以下 5 條門檻：

| # | 驗收項目 | 指令驗證 |
|---|----------|----------|
| 1 | **所有測試綠燈** (含整合測試) | `npx vitest run` → 0 failed |
| 2 | **ESLint zero errors** | `npx eslint src/` → 0 errors |
| 3 | **Prettier 格式通過** | `npx prettier --check .` → pass |
| 4 | **前端 Coverage ≥ 80%** | `npx vitest run --coverage` → lines/functions/branches ≥ 80% |
| 5 | **Dogfood 報告產出** | `dogfood-output/report.md` 存在且格式完整 |

> **註**: 以上 5 條為 Phase 5 整體交付門檻 (DoD)，缺一不可。

---

## 📋 各階段驗收指令與中止條件

| 階段 | 驗收指令 | 成功標準 | 時間盒上限 | 中止條件與替代方案 |
|------|----------|----------|------------|-------------------|
| **5.1** | `npx vitest run src/test/integration/backtestScheduler.test.mjs` | 10/10 pass, 0 unhandled rejection | 4h | 超時 → 檢查 Mock 策略、調整超時設定 |
| **5.2** | `npx vitest run src/test/integration` | 全綠燈，0 Vite 解析錯誤 | **8h** | 超時 → **啟用替代方案**：配置 vitest esbuild transform 處理 .ts，不強制統一副檔名 (DEC-41) |
| **5.3** | `ls dogfood-output/report.md && head -20 dogfood-output/report.md` | 報告存在、格式完整、含 3 頁面掃描結果 | 4h | 超時 → 縮減範圍至核心 API + 1 頁面 |
| **5.4** | `npx vitest run --coverage` | lines/functions/branches ≥ 70% (Phase 5 門檻) | **10h** (含 5.4.2 上限 6h) | 基準測 < 65% → 分階段門檻 (DEC-39)；超時 → 鎖定 70% 交付 |
| **5.5** | `ls docs/architecture/DEC-*.md && npm run openapi:generate` | DEC 文件存在、OpenAPI 含新端點 | 3h | 無中止風險，僅文件產出 |
| **5.6** | `npx eslint src/ && npx prettier --check .` | 0 errors、Prettier pass | 6h | Warnings 清理超時 → 僅清 errors，warnings 留 Phase 6 |

> **註**: 每階段結束需執行對應驗收指令並記錄實際工時，更新文件狀態 ⏳→✅。

---

## 🔄 文件同步機制

| 觸發時機 | 動作 | 負責 |
|----------|------|------|
| **每完成一子任務** | 更新 `PHASE_5_REMAINING_WORK.md`：狀態 ⏳→✅、記錄實際工時、新發現決策 (DEC-XX) | 執行者 |
| **每階段驗收通過** | 更新階段狀態、同步 `MASTER_PLAN.md` 概覽表 | 執行者 |
| **發現新風險/決策變更** | 即時新增 DEC 記錄、調整相依/工時估算 | 執行者 |
| **每日結束** | 檢查文件完整性、確認無遺漏決策 | 執行者 |

> **原則**: 邊做邊記，拒絕事後補記。決策即時入文件。

---

## 📅 總時程彙總 (Phase 5)

| 階段 | 預估工時 | 優先級 |
|------|----------|--------|
| **5.1** 測試環境修復與穩定化 | 3h | 🟡 High |
| **5.2** 既有整合測試基礎設施修復 | 5h | 🟡 High |
| **5.3** dogfood 探索式 QA 報告補齊 | 3h | 🟢 Low |
| **5.4** Coverage 門檻實際驗證與提升 | **4h+** | 🟡 Medium |
| **5.5** 文件完善與架構決策補充 | 2h | 🟢 Low |
| **5.6** 既有程式碼品質問題修復 | 5h | 🟡 Medium |
| **總計** | **22h+** | |

> **註**: 5.4 總工時待基準測 (5.4.1) 確認後調整；若現況 ≥75%，5.4.2 約 1-2h，總計約 18-20h；若現況 <70%，可能需 4h+，總計約 22-24h。

---

## 🔗 相依關係與執行順序 (單人單機循序執行，不並行以確保品質)

```
5.1 (測試環境修復, 3h)
    └─> 5.2 (整合測試基礎設施, 5h)  [需 5.1 完成，測試環境穩定]

5.6 (程式碼品質, 5h)  [獨立，建議在 5.2 後執行，需穩定測試環境驗證]
    └─> 5.4 (Coverage, 4h+) [需 5.1/5.2/5.6 完成，測試穩定且 lint 乾淨]

5.3 (dogfood QA, 3h)  [獨立，不並行執行，確保品質 (DEC-40)，在 5.4 後執行]

5.5 (文件/DEC, 2h)   [獨立，可隨時執行，建議最後彙整]
```

**建議循序執行順序**: 5.1 → 5.2 → 5.6 → 5.4 → 5.3 → 5.5
**預估總曆天**: 3-4 個工作天 (含緩衝)

---

## 📋 決策記錄 (本計畫新增)

| 編號 | 決策 | 狀態 | 日期 |
|------|------|------|------|
| DEC-25 | Phase 5 為疊代改善計畫，不阻擋 Phase 1-4 核心功能上線 | ✅ | 2026-08-12 |
| DEC-26 | 整合測試基礎設施修復優先於新功能開發 | ✅ | 2026-08-12 |
| DEC-27 | 既有程式碼品質問題 (ESLint/Prettier) 納入 Phase 5.6 統一修復 | ✅ | 2026-08-12 |
| DEC-28 | 5.1.1 採 Mock 方案：Mock `backtestRunner.run()` 回傳固定結果，不建立測試資料庫種子 | ✅ | 2026-08-12 |
| DEC-29 | 5.2.2 專案全面統一 .mjs 副檔名，包含源檔與測試檔 | ✅ | 2026-08-12 |
| DEC-30 | 5.3.1 dogfood 掃描用 Playwright 自訂腳本，範圍：核心 API + 3 頁面 | ✅ | 2026-08-12 |
| DEC-31 | 5.4.1 先檢查並補上 coverage thresholds 配置 (80/80/80)，再跑基準測 | ✅ | 2026-08-12 |
| DEC-32 | 5.5.1 Phase 4 架構決策記錄為 DEC 輕量格式，不建立正式 ADR | ✅ | 2026-08-12 |
| DEC-33 | 5.6.1 先 grep 檢查現有 vitest import 情況，再決定是否啟用 globals 配置 | ✅ | 2026-08-12 |
| DEC-34 | 5.6.4 暫時關閉 husky `--max-warnings=0`，Phase 5.6 完成後再啟用 | ✅ | 2026-08-12 |
| DEC-35 | 5.1.1 Mock 最小集合：只 Mock `metrics` 關鍵指標，依測試需求擴充 | ✅ | 2026-08-12 |
| DEC-36 | 5.6.2 Warnings 分類處理：自動修復 `_` 前綴、手動清理未使用、保留測試框架需要 | ✅ | 2026-08-12 |
| DEC-37 | 5.6.3 Prettier 排除 archive/ 歷史文件，只格式化作用中代碼 | ✅ | 2026-08-12 |
| DEC-38 | 5.2.2 先在 feature branch 實驗單一模組驗證 .mjs 統一，再全專案推廣 | ✅ | 2026-08-12 |
| DEC-39 | 5.4.2 Coverage 上限 6h，若基準測 < 65% 採分階段門檻 (Phase 5: 70%、Phase 6: 80%) | ✅ | 2026-08-12 |
| DEC-40 | 5.3 dogfood 不並行執行，確保品質，循序在 5.4 後執行 | ✅ | 2026-08-12 |
| DEC-41 | 5.2 時間盒 8h，超時啟用替代方案：配置 esbuild transform 處理 .ts，不強制統一副檔名 | ✅ | 2026-08-12 |

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