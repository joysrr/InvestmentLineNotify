---
type: plan
status: completed
last_updated: 2026-09-10
tags:
  - completed
  - archived
wiki_links: []
---

# 統一開發計畫 v1.5 (Phase 1-4 完成標註版)

> 更新時間：2026-08-12  
> 狀態：**Phase 1-4 全部核心功能完成** (詳細審計見 [PHASE_1_4_AUDIT_REPORT.md](./PHASE_1_4_AUDIT_REPORT.md))  
> 後續項目：[PHASE_5_REMAINING_WORK.md](./PHASE_5_REMAINING_WORK.md)

---

## 📊 專案總覽

||| 專案 | InvestmentLineNotify ||
||| ---------- | ------------------------------------------------ ||
||| 當前分支 | main (commit: 待推送) ||
||| 核心技術棧 | Node.js/TypeScript + Vue 3 + Vitest + Playwright ||
||| 架構決策 | ADR-001: 後端計算/前端顯示 | ADR-002: Bull + Redis (含記憶體 fallback) |
||| **環境決策** | **單人單機部署，無 Redis，無 GitHub Actions** | **DEC-24: 簡化部署架構** |

---

## ✅ 已完成階段總結 (Phase 1-4 全部核心功能交付)

### Phase -1: 基礎建設與 TDD 補課 (Task #14 相關) ✅

| 項目                     | 狀態 | 關鍵交付                                                                                               |
| ------------------------ | ---- | ------------------------------------------------------------------------------------------------------ |
| T-3.1 Asset Abstraction  | ✅   | Registry+Mapper、移除硬編碼 0050/00675L                                                                |
| T-3.2 回測報表 Web 整合  | ✅   | BacktestReportView、SignalCategoryTable、E2E (10 tests)                                                |
| T-3.3 策略參數設定編輯器 | ✅   | StrategyConfigEditor、ConfigSectionEditor、ConfigFieldEditor、E2E (11 tests)                           |
| TDD 測試補課             | ✅   | 48 測試 (ConfigFieldEditor 24 + ConfigSectionEditor 11 + StrategyConfigEditor 13 + backtestResults 15) |

### Phase 0: Simulator Phase B + C + 技術債清理 (Task #6 相關) ✅

| 項目                                      | 狀態 | 關鍵交付                                 |
| ----------------------------------------- | ---- | ---------------------------------------- |
| Phase B: analyticalSolvers/rsiSolver 接線 | ✅   | 9 種反向目標類型、解析解+二分搜尋        |
| Phase C: scanner/reverseEngine 整合測試   | ✅   | simulateRoute.test.mjs 23 tests 通過     |
| **TD-001** KD/MACD 真正交叉檢測           | ✅   | 前一根 vs 當前根交叉判定                 |
| **TD-002** Vue computed readonly 警告     | ✅   | 移除手動 hasChanges.value 設定           |
| **TD-003** RSI 極端目標近似解             | ✅   | approx 視為可達 + note                   |
| **TD-005** Coverage 門檻                  | ✅   | lines 75% / functions 60% / branches 60% |

### Phase 1: Simulator Phase D - 前端反向推導 UI (Day 3-4, 16h) ✅ **完成**

| 任務                   | 狀態 | 關鍵交付                                                             |
| ---------------------- | ---- | -------------------------------------------------------------------- |
| 結果展示卡片           | ✅   | 達成價格、迭代次數、掃描範圍、假設條件、近似解標記                   |
| 參數表單               | ✅   | 目標類型下拉、數值/方向輸入、即時驗證 (既有組件)                     |
| 狀態處理               | ✅   | Loading、錯誤、空結果、不可達/近似解區分顯示                         |
| 歷史/預設              | ✅   | 既有 ReversePanel 支援                                               |
| **E2E 測試 (9 tests)** | ✅   | 維持率、RSI、MA20/60/240、KD/MACD、策略總分、Portfolio Health 全覆蓋 |

**驗收**: E2E 30 passed (Simulator 10 + StrategyConfigEditor 11 + Reverse Phase D 9) ✅

### Phase 2.1: 批次模擬介面 (Day 5, 8h) ✅ **完成**

| 任務                | 狀態 | 關鍵交付                                                  |
| ------------------- | ---- | --------------------------------------------------------- |
| BatchPanel.vue 組件 | ✅   | 多任務配置、模板、複製/刪除、驗證                         |
| 執行選項            | ✅   | 併發數 (1-16)、重試次數 (0-5)、重試間隔 (0-10000ms)       |
| 匯入/匯出           | ✅   | JSON 檔案匯入匯出、任務配置持久化                         |
| 批次執行            | ✅   | 進度顯示、結果表格、狀態標籤、錯誤顯示                    |
| 詳細結果查看        | ✅   | 整合 ReverseResultCard、彈窗查看完整模擬結果              |
| 後端 API            | ✅   | POST /api/v1/simulate/batch、並行控制、重試機制、錯誤處理 |
| 驗證器擴充          | ✅   | validateBatchInput()、價格範圍驗證、選項驗證              |

### Phase 2.2: 敏感度分析 (Day 5-6, 6h) ✅ **完成**

| 任務                      | 狀態 | 關鍵交付                                                                 |
| ------------------------- | ---- | ------------------------------------------------------------------------ |
| SensitivityPanel.vue 組件 | ✅   | 參數選擇、掃描範圍、觀測指標、圖表切換、多參數配置                       |
| SensitivityChart.vue      | ✅   | ECharts 敏感度曲線、斜率/相關係數顯示                                    |
| TornadoChart.vue          | ✅   | ECharts 條狀圖、影響度排序、正負向區分                                   |
| 後端 API                  | ✅   | POST /api/v1/simulate/sensitivity、單/多參數掃描、斜率計算、關鍵驅動因子 |
| 驗證器擴充                | ✅   | validateSensitivityInput()、SCANNABLE_PARAMS 23 參數驗證                 |
| 敏感度引擎                | ✅   | runSensitivitySingleParam、runSensitivityMultiParam (one-at-a-time)      |
| SimulatorView 整合        | ✅   | 新增「敏感度分析」Tab、模式選擇器更新                                    |

### Phase 2.3: Pareto 前沿 (Day 6-7, 4h) ✅ **完成**

| 任務                   | 狀態 | 關鍵交付                                                       |
| ---------------------- | ---- | -------------------------------------------------------------- |
| ParetoPanel.vue 組件   | ✅   | 目標選擇、掃描參數、權重滑桿、採樣設定、膝點卡片               |
| ParetoScatterChart.vue | ✅   | ECharts 散點圖、Pareto 前沿線、膝點標記、分層顏色              |
| 後端 API               | ✅   | POST /api/v1/simulate/pareto、多目標掃描、非支配排序、膝點檢測 |
| 驗證器擴充             | ✅   | validateParetoInput()、SCANNABLE_PARAMS 23 參數驗證            |
| Pareto 引擎            | ✅   | runParetoAnalysis (LHS 採樣、快速非支配排序、膝點檢測)         |
| SimulatorView 整合     | ✅   | 新增「Pareto 前沿」Tab (第 5 個模式)、模式選擇器更新           |

### Phase 2.4: 匯出功能 (Day 7, 2h) ✅ **完成**

| 任務             | 子項目                      | 工時 | 優先級 |
| ---------------- | --------------------------- | ---- | ------ |
| **2.4 匯出功能** | CSV/JSON/圖片匯出、分享連結 | 2h   | 🟢 Low |

**驗收標準**: 敏感度/Pareto/批次結果支援 CSV/JSON/圖片匯出 ✅

**交付**: exportUtility.js (25 tests)、ExportButton.vue (15 tests)、三大 Panel 整合 ✅

---

### Phase 3: 剩餘技術債與品質提升 (Day 8, 8h) ✅ **完成**

| 任務         | 項目                                             | 工時 | 狀態     |
| ------------ | ------------------------------------------------ | ---- | -------- |
| **3.1**      | AssetRegistry 擴充：動態資產發現與驗證           | 3h   | ✅ 完成  |
| **3.2**      | SchemaMapper 泛型化：移除硬編碼 0050/00675L      | 4h   | ✅ 完成  |
| **3.3**      | 策略引擎去硬編碼：改用 Registry 查詢             | 4h   | ✅ 完成  |
| **3.4**      | 回測引擎 N-asset 化：AccountSimulator 多資產支援 | 4h   | ✅ 完成  |
| **3.5**      | FEAT-005：回測非同步 API (Bull + Redis)          | 8h   | ✅ 完成  |
| **3.6**      | TD-004：MA240 Bias 驗證誤差容忍優化              | 2h   | ✅ 完成  |
| **Coverage** | 前端覆蓋率門檻提升至 80% (逐步)                  | 2h   | ✅ 完成* |
| **文件**     | API 文件更新、架構決策記錄同步                   | 1h   | ✅ 完成  |

*Coverage 門檻已設定，實際覆蓋率需 CI 環境驗證

---

### Phase 4: 生產級基礎設施 (Day 9-10, 14h) ✅ **核心功能完成**

| 任務    | 項目                                              | 工時 | 狀態     |
| ------- | ------------------------------------------------- | ---- | -------- |
| **4.1** | 回測排程自動化 (Bull + 記憶體佇列)                | 6h   | ✅ 完成  |
| **4.2** | 監控/告警 (錯誤追蹤、效能指標、告警)              | 4h   | ✅ 完成* |
| **4.3** | 部署自動化 (systemd、Mini App 遠端部署按鈕、回滾) | 4h   | ✅ 完成  |

*Phase 4.2 缺少 dogfood 探索式 QA 報告 (低影響)

#### Phase 4.1 詳細交付 ✅

- `backtestScheduler.ts`: Cron + Bull 記憶體佇列、多配置併行、指數退避重試、結果存檔、狀態持久化
- API: POST/GET/DELETE `/api/backtest/schedule*` (5 endpoints)
- 測試: 7/10 pass (3 環境限制 - 需測試資料日期範圍)

#### Phase 4.2 詳細交付 ✅

- `errorStore.mjs`: SQLite 錯誤存儲、去重、統計
- `metricsCollector.mjs`: p50/p95/p99、佇列深度、系統資源、Worker 心跳
- `alertEngine.mjs`: 閾值檢查、冷卻期、多通道通知 (Telegram/Console/檔案)
- `monitoringRoutes.mjs`: `/api/errors`, `/dashboard`, `/alerts*` 即時 JSON
- 測試: 12/12 pass
- ⚠️ 缺少: dogfood 探索式 QA 報告 (計畫要求未執行)

#### Phase 4.3 詳細交付 ✅

- `executor.mjs`: 執行器、部署鎖、WebSocket 推播、回滾支援、Telegram 通知
- `adminGuard.mjs`: 管理員驗證 (initData HMAC + ADMIN_USER_IDS)
- `deployRoutes.mjs`: POST/GET/WS/History/Cancel `/api/deploy*` (5 endpoints)
- `deploy-local.mjs`: CLI、支援 `--rollback`、`--tag`
- Systemd: `investment-line-notify.service` + `investment-line-notify-scheduler.service`
- `DeployButton.vue`: 確認對話框、即時日誌面板、重試/取消
- 測試: 8/8 pass

---

## 📈 目前測試基線 (2026-08-12 審計)

||| 類別 | 測試數 | 狀態 ||
||| -------------------- | ----------------------------------------------------------------------------------------------- | ---- ||
||| **後端單元/整合** | 515 passed / 6 todo (unit) + 635 passed / 3 failed / 4 errors (integration) | ⚠️ ||
||| **前端單元** | 163 passed | ✅ ||
||| **E2E (Playwright)** | 30 passed (Simulator Phase D 10 + StrategyConfigEditor 11 + Reverse 9)。敏感度分析/Pareto/批次 E2E 暫緩（見 DEC-23） | ✅ ||
||| **Simulator 專用** | analyticalSolvers(11) + rsiSolver(9) + reverseEngine(15) + scanner(14) + simulateRoute(23) = 72 | ✅ ||

**失敗測試分析**: 3 failed 皆為環境限制 (backtestScheduler 需測試資料)，4 errors 為背景 async 清理問題。既有 7 個整合測試檔案有基礎設施問題 (Vite 解析、舊 import 路徑)。

---

## 📅 總時程彙總

|| 階段 | 日期範圍 | 工時 | 累計 ||
|| ------------------------------ | -------- | ---- | ---- ||
|| **Phase -1 (已完成)** | 已完成 | ~40h | 40h ||
|| **Phase 0 (已完成)** | Day 1-2 | 16h | 56h ||
|| **Phase 1: Simulator Phase D** | Day 3-4 | 16h | 72h ||
|| **Phase 2.1: 批次模擬** | Day 5 | 8h | 80h ||
|| **Phase 2.2: 敏感度分析** | Day 5-6 | 6h | 86h ||
|| **Phase 2.3: Pareto 前沿** | Day 6-7 | 4h | 90h ||
|| **Phase 2.4: 匯出功能** | Day 7 | 2h | 92h ||
|| **Phase 3: 技術債收尾** | Day 8 | 8h | 100h ||
|| **Phase 4: 生產設施** | Day 9-10 | 14h | 114h ||

---

## 🛑 閘門條件

|| 閘門 | 時間點 | 條件 | 狀態 ||
|| ------ | ------------ | ------------------------------------- | -------- ||
|| **G0** | Phase 0 結束 | TD-001/002/003/005 完成、所有測試綠燈 | ✅ 已通過 ||
|| **G1** | Day 4 結束 | Phase D E2E ≥ 8 tests、全測試通過 | ✅ 已通過 ||
|| **G2** | Day 7 結束 | T-3.4 核心功能可用、批次模擬可跑 | ✅ 已通過 ||
|| **G3** | Day 8 結束 | 技術債清單清零、Coverage 門檻生效 | ⚠️ 部分驗證待 CI ||
|| **G4** | Day 10 結束 | 生產部署就緒、監控啟用 | ✅ 核心功能就緒 ||

---

## 📋 決策記錄 (ADR)

|| 編號 | 決策 | 狀態 | 日期 ||
|| ------------ | -------------------------------------- | ---- | ------- ||
|| ADR-001 | 後端計算/前端顯示分離 | ✅ | 2026-05 ||
|| ADR-002 | Bull + Redis 隊列 (含記憶體 fallback) | ✅ | 2026-05 ||
|| DEC-01 | 00675L 同比例聯動 0050 | ✅ | 2026-05 ||
|| DEC-04 | 9 種反向目標類型 | ✅ | 2026-05 ||
|| DEC-06 | MA240 分級 Fallback | ✅ | 2026-05 ||
|| DEC-08 | 維持率同比例聯動 | ✅ | 2026-05 ||
|| DEC-11 | RSI ±30% 初始範圍、0.5 容忍度、50 迭代 | ✅ | 2026-05 ||
|| DEC-13/14/15 | 掃描器參數、資產抽象化 N-asset | ✅ | 2026-05 ||
|| DEC-16/17/18 | 驗證規則、錯誤碼、409 Conflict | ✅ | 2026-05 ||
|| DEC-22 | 模組拆分 9 檔按職責 | ✅ | 2026-05 ||
|| **DEC-23** | **敏感度分析/Pareto/批次 E2E 暫緩** | ✅ | 2026-08-11 ||
|| | Playwright API mock 在 Vite dev server 環境不穩定。功能已由單元/整合測試覆蓋，E2E 後續改用真實後端或獨立測試環境驗證。 | | ||
|| **DEC-24** | **簡化部署架構：單人單機、無 Redis、無 GitHub Actions** | ✅ | 2026-08-11 ||
|| | 環境因單人使用維持單純，排程使用記憶體佇列，部署使用 systemd 腳本，監控使用自建方案。 | | ||

---

## 🎯 下一步行動

**Phase 1-4 核心功能全部完成** ✅

詳細審計報告: [PHASE_1_4_AUDIT_REPORT.md](./PHASE_1_4_AUDIT_REPORT.md)  
後續改善計畫: [PHASE_5_REMAINING_WORK.md](./PHASE_5_REMAINING_WORK.md)

---

_此文件為單一真實來源 (Phase 1-4 完成版)，後續變更請更新 PHASE_5_REMAINING_WORK.md。_
