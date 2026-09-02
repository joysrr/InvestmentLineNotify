# Active Plans Consolidated

> **狀態**：Active — 唯一現行計畫索引
> **整理日期**：2026-08-17
> **目的**：統整 `docs/plans/active/` 原有計畫，避免重複、過期狀態與已完成工作繼續佔用 active。

## 1. 現況結論

Phase 6 已完成並封存。E2E、部署檢查、硬編碼審計、WebApp Phase 1–5 的主要決策與系統性優化 Phase 1–2 也已有實際成果或已結案。

目前不保留新的立即執行項目；active 僅保留後續需要重新分析後才決定是否執行的工作：

- WebApp Phase 3：未使用共用元件是否保留，依實際產品需求決定。
- WebApp Phase 4：`useApiRequest` 文件化與下一個新 View 的實戰驗證；不強制遷移既有 Views。
- 後續 coverage slices：大型 Views、simulator panels、chart components；不得為數字灌入低價值測試。
- E2E 延伸品質：視需求再評估 visual regression、API contract、Lighthouse、accessibility。
- 新計畫開始前，先確認是否真的有產品需求；沒有需求時遵循 YAGNI，不新增工作。

## 2. 目前品質基線

- Backend：95 files passed / 2 skipped；1514 tests passed / 6 todo。
- Frontend：47 files / 323 tests passed。
- E2E：49/49 passed，workers=1。
- Frontend Branches：41.69%。
- Backend coverage：Lines 72.99%、Statements 62.73%、Functions 75.69%、Branches 73.90%。
- Frontend lint：0 errors / 8 test warnings。
- Frontend build：passed。
- Dogfood：API 10/10、頁面 3/3、Critical/High/Medium/Low = 0/0/0/0。
- API health latency：30 samples，average 9.569ms、p95 14.589ms、max 15.010ms。
- Backend native segfault：已透過 `better-sqlite3@12.11.1`（Node 20 相容）修復。

詳細證據：`docs/performance/PHASE_6_BASELINE.md`。

## 3. 後續分析項目

### 3.1 WebApp Phase 3：共用元件死碼評估

候選元件：

- `webapp/src/components/common/SkeletonLoader.vue`
- `webapp/src/components/common/EmptyState.vue`
- `webapp/src/components/common/ErrorAlert.vue`

目前決策：保留，不強制接入；等真實 loading、empty state 或 inline error 需求出現，再以需求驅動使用。不得為了消除未使用檔案而刪除或接入。

### 3.2 WebApp Phase 4：`useApiRequest` 選用遷移

目前決策：

- 新 View 預設評估 `useApiRequest`。
- 既有 View 不強制重構。
- 下一個需要新增的 View 再實戰驗證 composable 是否足夠。
- `useApiMutation` 只有在實際 POST/PUT/DELETE 需求出現且重複模式成立時才新增。

### 3.3 Coverage 後續 slices

決策：優先處理使用頻率高且錯誤成本高的商業邏輯，不依 coverage 數字排序。新增測試時先只驗證既有行為；若測試暴露設計問題，再另開獨立重構變更。

保留大型未充分覆蓋模組作為後續候選。執行時遵守：

- 優先投資計算、模擬、資料轉換與錯誤處理等高風險行為。
- 測試與產品重構分離，避免同一變更同時改變行為與結構。

1. 先寫行為測試並取得 RED。
2. 寫最小測試讓它 GREEN。
3. 不修改產品行為迎合 coverage。
4. 不刪除失敗測試、不排除 source。
5. 每個 slice 完成後重新量測並留下證據。

### 3.4 Coverage slice 啟動決策

- 第一個候選範圍：`SimulatorView.vue` 與 simulator panels。
- 第一階段只處理 Forward／Reverse 核心流程；Batch、Pareto、Sensitivity 與 charts 依後續風險再擴展。
- 測試以 component tests 為主，沿用既有 E2E 作為跨元件整合保護，不重複建立相同流程。
- RED 階段先驗證使用者可觀察行為，不以逐 branch 或 snapshot 覆蓋為目標。
- Forward／Reverse 同時涵蓋輸入驗證、loading、API 錯誤與成功結果呈現。
- Component tests mock API response；跨整合流程沿用既有 E2E。
- 暫不建立 simulator 共用 test helper，重複模式出現後再評估抽取。
- 完成標準：行為測試通過、重新量測 coverage、確認沒有產品行為變更；不設定固定 coverage 百分比門檻。
- 目前不建立 Phase 7；等明確產品需求或使用者問題出現，再依啟動門檻建立正式計畫。
- 啟動條件：使用者回報 Simulator bug，或新增 Simulator 功能需求任一成立；單純 coverage 偏低不構成啟動理由。
- 需求成立後，先建立獨立 plan，定義 DoD、測試範圍與回滾方式，再進入 TDD。

### 3.5 E2E 延伸品質

以下不是目前阻塞項目，只有在明確需求出現時才建立新計畫：

- Visual regression / pixel diff
- API contract testing
- Lighthouse CI
- axe-playwright accessibility testing

## 4. 已完成並歸檔文件

以下文件已完成、過期或內容已由新基線取代，移至 `docs/plans/completed/`：

| 原文件                                   | 歸檔理由                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| `E2E_TEST_FIX_PLAN.md`                   | 實際 E2E 已達 49/49；原文件仍是 27 passed / 22 failed 的過期狀態。     |
| `E2E_TESTING_PLAN.md`                    | Phase 1–4 已完成；延伸測試保留於本文件後續分析項目。                   |
| `DEPLOYMENT_CHECKLIST.md`                | 部署檢查已完成；舊測試數據由 Phase 6 final baseline 取代。             |
| `HARDCODED_AUDIT.md`                     | 審計已完成，結論為 UI 設定型 hardcoded 維持原位。                      |
| `MASTER_PLAN.md`                         | 高層總綱已過期，且與系統性優化及 Phase 3–5 文件重複。                  |
| `WEBAPP_PHASE_3-5_DETAIL_PLAN.md`        | Phase 5 已結案；Phase 3/4 決策已濃縮至本文件。                         |
| `MINIAPP_UIUX_IMPROVEMENT_PLAN.md`       | Telegram Mini App UI/UX 重構計畫已全數完成結案 (Task 1–4 綠燈)。       |
| `WEBAPP_SYSTEMATIC_OPTIMIZATION_PLAN.md` | Phase 1–2 已完成，Phase 3–5 決策已結案或降為選用。                     |
| `CORE_LOGIC_VALIDATION_PLAN.md`          | Core Scoring Logic 確定性驗證 3/3 (100% MATCH) 通過，方案 A 門檻達成。 |

原文件內容完整保留；本文件是目前唯一 active 入口，不是刪除歷史紀錄。

## 5. 開始新工作的門檻

只有下列情況才從本文件建立新 phase 或新 plan：

- 有明確產品需求或使用者問題。
- 有可驗證的成功標準。
- 已確認不是現有功能可直接解決。
- 已定義測試與回滾方式。

沒有上述條件時，維持目前狀態，不開新計畫。

## 6. 來源與證據

- Phase 6 封存計畫：`docs/plans/completed/WEBAPP_PHASE_6_DETAIL_PLAN.md`
- Final baseline：`docs/performance/PHASE_6_BASELINE.md`
- Git branch：已合併至 `main`
- 最新 merge commit：`67d5067`（merge: integrate phase-6 into main）
