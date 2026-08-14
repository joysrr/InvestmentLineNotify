# WebApp 各頁面操作功能 E2E 測試驗證計畫 v1.0

> **建立時間**: 2026-08-15  
> **專案版本**: InvestmentLineNotify WebApp (Vue 3 + Vite + Playwright)  
> **目標**: 針對全站 12 個 Vue 頁面建立 100% 覆蓋的操作功能驗證與 Playwright E2E 測試矩陣。每次版版更新後可自動執行，確保無功能迴歸 (Regression-Free)。

---

## 1. 現有測試資產盤點與交叉比對 (Baseline Audit)

### 1.1 現有測試檔案盤點
經過全專案掃描，目前 `webapp/src/test/e2e/` 與 `src/test/` 目錄下共有以下測試資產：

| 測試類型 | 檔案路徑 | 涵蓋目標 | 現狀評估 |
|:---|:---|:---|:---|
| **E2E Spec** | `webapp/src/test/e2e/strategyConfig.spec.js` | 策略參數編輯器與驗證 | 🟢 已具備基本測試，需補全 Toast 斷言 |
| **E2E Spec** | `webapp/src/test/e2e/simulator.spec.js` | 雙向模擬器單次算與切換 | 🟢 基本流暢，需補齊分頁切換與敏感度 |
| **E2E Spec** | `webapp/src/test/e2e/simulatorReversePhaseD.spec.js` | 反向模擬 Phase D 計算 | 🟢 核心功能覆蓋 |
| **E2E Spec** | `webapp/src/test/e2e/sensitivity.spec.js` | 敏感度矩陣分析 | 🟡 測試穩定度待強化 |
| **E2E Mock** | `webapp/src/test/e2e/telegram-mock.js` | Telegram SDK 全域 Mock | 🟢 可運作 |
| **Unit/Component** | `webapp/src/components/common/*.test.js` (4 檔) | Phase 1 共用 UI 元件 | 🟢 43 個測試全數通過 |
| **Backend Route** | `src/api/routes/backtestRoutes.test.mjs` | 後端回測 API | 🟢 正常運作 |

### 1.2 缺口分析 (Gap Analysis)
- ❌ **缺口 1**：8 個視圖頁面（DashboardView, BacktestReportView, TechnicalView, MarketRadarView, MacroBattleView, ChartView, ReportsView, NewsView, AccountView, StrategyView, StrategyStatusView）**完全缺乏專屬 E2E 測試**。
- ❌ **缺口 2**： lacked 統一的 E2E 執行指令腳本（現僅有單獨執行指令，缺乏一鍵連同 API Server + Web Server 啟動的整體驗證腳本）。
- ❌ **缺口 3**：缺少以 `data-testid` 驅動的選擇器標準，部分舊測試倚賴 CSS 選擇器容易因樣式變更而斷裂。

---

## 2. 12 頁面全功能矩陣與測試情境規劃 (Test Matrix)

### P0 級：核心互動與計算頁面 (Core Interactive & Compute Views)

#### 1. SimulatorView (0050 雙向模擬器)
* **UI 互動與功能清單**：
  1. 正向 / 反向 / 批次模擬 Mode 切換按鈕 (`data-testid="mode-selector"`)
  2. 正向模擬參數輸入（股數、現值、維持率目標）與「開始計算」按鈕
  3. 反向模擬參數輸入（目標跌幅、加碼步幅）與「開始模擬」按鈕
  4. 模擬結果表格顯示與圖表切換
* **E2E 測試案例 (`simulator.spec.js`)**：
  - `[SIM-001]` 預設載入 Mode 選擇器並顯示正向面板
  - `[SIM-002]` 正向模擬輸入參數後點擊計算，驗證結果卡片正確顯示
  - `[SIM-003]` 切換至反向模擬面板，執行試算並斷言結果表格列數 > 0
  - `[SIM-004]` 切換至批次敏感度分析，驗證矩陣正確繪製

#### 2. StrategyConfigEditor.vue (策略參數編輯器)
* **UI 互動與功能清單**：
  1. 分籤 Tab 切換 (`data-testid="strategy-config-editor"`)
  2. 參數表單編輯（硬額度、Baseline 優先、signalType 分配）
  3. 「僅驗證」按鈕 (`data-testid="btn-validate"`)
  4. 「儲存」按鈕 (`data-testid="btn-save"`)
  5. 「重置為預設」按鈕 (`data-testid="btn-reset"`) 與 Confirm Modal
* **E2E 測試案例 (`strategyConfig.spec.js`)**：
  - `[CFG-001]` 載入當前策略設定並正確填入各區塊欄位
  - `[CFG-002]` 修改維持率欄位後點擊「僅驗證」，斷言驗證成功 Toast 出現
  - `[CFG-003]` 輸入無效數值（如負數維持率）點擊驗證，斷言錯誤警告列 (`data-testid="validation-bar"`) 出現
  - `[CFG-004]` 點擊「重置為預設」，彈出對話框點擊「確定重置」，驗證表單還原

#### 3. BacktestReportView.vue (回測報表分析)
* **UI 互動與功能清單**：
  1. 回測任務下拉選單 (`el-select`) 切換任務
  2. 「匯出 CSV」與「匯出 JSON」按鈕點擊
  3. 基準 0050 Buy & Hold 勾選框切換
  4. 訊號分類統計表格過濾與排序
* **E2E 測試案例 (`backtestReport.spec.js`)**：
  - `[BKT-001]` 預設載入第一個回測任務報表並渲染 ECharts 圖表
  - `[BKT-002]` 切換任務下拉選單，確認報表內容與摘要數據重新載入
  - `[BKT-003]` 點擊「匯出 CSV」，驗證觸發檔案下載流程
  - `[BKT-004]` 勾選/取消對比 0050，驗證圖表 datasets 隨之更新

---

### P1 級：資訊展示與圖表分析頁面 (Information & Chart Views)

#### 4. DashboardView.vue (投資儀表板)
* **UI 互動與功能卡片**：
  1. 概覽卡片（總資產、槓桿比率、維持率、未實現損益）
  2. 快速導航入口（雙向模擬器、策略設定、回測報表）
* **E2E 測試案例 (`dashboard.spec.js`)**：
  - `[DSH-001]` 載入儀表板，斷言 4 大指標卡片數值非空且格式正確
  - `[DSH-002]` 點擊「雙向模擬器」快捷卡片，驗證成功導航至 `/#/simulator`

#### 5. TechnicalView.vue (技術指標詳情)
* **UI 互動與功能**：
  1. 指標展延/摺疊（買入訊號區塊、賣出訊號區塊、轉折預警區塊）
  2. 指標卡片細節顯示（MA240、RSI、KD、MACD）
* **E2E 測試案例 (`technical.spec.js`)**：
  - `[TEC-001]` 載入技術指標頁，確認各指標現值與燈號正確顯示
  - `[TEC-002]` 點擊買入訊號摺疊區，驗證細節展開/收合狀態切換

#### 6. MarketRadarView.vue (市場雷達)
* **UI 互動與功能**：
  1. 台股市場概況、信用交易（融資融券）、三大法人買賣超
  2. 美股指標（VIX、SPX 變動率、美債殖利率）
* **E2E 測試案例 (`marketRadar.spec.js`)**：
  - `[RAD-001]` 載入市場雷達，驗證台股與美股區塊資料皆完成加載
  - `[RAD-002]` 斷言融資維持率與 VIX 風險燈號正常顯示

#### 7. MacroBattleView.vue (總經多空對決)
* **UI 互動與功能**：
  1. 景氣對策訊號（紅燈/綠燈/藍燈）燈號與分數
  2. 多頭因子 vs 空頭因子比對清單
* **E2E 測試案例 (`macroBattle.spec.js`)**：
  - `[MAC-001]` 載入總經頁面，驗證景氣燈號與當前分數顯示
  - `[MAC-002]` 檢查多空對決清單包含至少一項評估因子

#### 8. ChartView.vue (資產趨勢圖表)
* **UI 互動與功能**：
  1. 時間跨度切換（1M / 3M / 6M / 1Y / ALL）
  2. 指標切換（淨值 / 槓桿 / 維持率）
* **E2E 測試案例 (`chartView.spec.js`)**：
  - `[CRT-001]` 載入趨勢圖表，驗證 Canvas 圖表元素正常渲染
  - `[CRT-002]` 切換時間跨度按鈕（如 3M -> 1Y），確認圖表觸發重繪

---

### P2 級：內容閱覽與系統設定頁面 (Content & System Views)

#### 9. ReportsView.vue (AI 分析報告摘要)
* **UI 互動與功能**：
  1. 報告類型 Tab 切換（日報 / 週報 / 月報）
  2. 報告展開與內文預覽
* **E2E 測試案例 (`reports.spec.js`)**：
  - `[RPT-001]` 預設載入最新日報，驗證摘要內文顯示
  - `[RPT-002]` 切換至「週報」Tab，驗證週報列表重新加載

#### 10. NewsView.vue (即時新聞與情意素分析)
* **UI 互動與功能**：
  1. 新聞分頁 Tab 切換（重點新聞 / 聚焦池）
  2. 外部新聞連結開啓
* **E2E 測試案例 (`news.spec.js`)**：
  - `[NWS-001]` 載入新聞頁面，確認新聞卡片列表數 > 0
  - `[NWS-002]` 點擊「聚焦池」Tab，驗證聚焦個股新聞列出

#### 11. AccountView.vue (系統狀態與帳戶)
* **UI 互動與功能**：
  1. 系統健康度檢查狀態顯示
  2. API Data Sources 詳細狀態展開/摺疊
* **E2E 測試案例 (`account.spec.js`)**：
  - `[ACC-001]` 載入系統狀態頁，確認系統服務狀態為健康
  - `[ACC-002]` 點擊「展開資料源細節」，驗證各大 Provider 狀態載入

#### 12. StrategyView.vue & StrategyStatusView.vue (策略總覽與狀態)
* **UI 互動與功能**：
  1. 核心策略邏輯文字與規則簡介
  2. 當前觸發狀態燈號
* **E2E 測試案例 (`strategy.spec.js`)**：
  - `[STR-001]` 載入策略頁面，確認策略說明與規則文字呈現
  - `[STR-002]` 驗證風險控制與位階規則說明區塊完整

---

## 3. 落地執行路線圖與時程規劃 (Implementation Roadmap)

### Phase 1: E2E 測試基礎建設與自動化 CLI (1-2 天)
- [ ] 建立一鍵執行腳本 `webapp/scripts/run-e2e-all.mjs`：
  - 自動在背景啟動 API Server (`BYPASS_INIT_DATA=true`) 及 Vite Dev Server
  - 使用 Playwright 批次平行跑全套 `.spec.js`
  - 執行完畢後**自動 100% 清理背景進程** (防 Thread 耗盡)
- [ ] 在 `webapp/package.json` 加入快捷指令 `npm run test:e2e:all`

### Phase 2: 核心頁面 (P0) E2E 測試編寫 (2-3 天)
- [ ] 撰寫/補全 `simulator.spec.js`
- [ ] 撰寫/補全 `strategyConfig.spec.js`
- [ ] 新增並撰寫 `backtestReport.spec.js`
- [ ] **驗收**：執行 `npm run test:e2e:all` 確保 P0 測試全過

### Phase 3: 資訊與內容頁面 (P1 + P2) E2E 測試編寫 (2-3 天)
- [ ] 新增 `dashboard.spec.js`, `technical.spec.js`, `marketRadar.spec.js`, `macroBattle.spec.js`, `chartView.spec.js`
- [ ] 新增 `reports.spec.js`, `news.spec.js`, `account.spec.js`, `strategy.spec.js`
- [ ] **驗收**：達成全站 12 頁面 100% 測試案例覆蓋

### Phase 4: CI/CD 與 Git Hook 整合 (1 天)
- [ ] 整合至改版 SOP 文件與 Deployment Checklist
- [ ] 每次版本 release / 改版前執行 `npm run test:e2e:all` 作為 Mandatory Quality Gate
- [ ] 產出最終 E2E 測試覆蓋率與驗證報告

---

## 4. 驗收標準 (Definition of Done)

1. 📄 **計畫落地**：`docs/plans/active/E2E_TESTING_PLAN.md` 完成建立並納入 Git 版本控管。
2. 🚀 **一鍵自動化**：執行 `npm run test:e2e:all` 即可自動完成前後端啟動、全頁面 E2E 掃描測試、並自動清理背景進程。
3. 💯 **100% 通過率**：12 頁面共 28+ 個 E2E 測試案例在無頭瀏覽器環境下達到 100% PASS。
