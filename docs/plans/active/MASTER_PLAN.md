# InvestmentLineNotify Master Plan (v4.0)

本文件為專案的唯一真實來源 (Single Source of Truth)，整合了過往 Phase 1 至未來 Phase 4 的所有計畫。
**更新**: 2026-08-09 對齊實際程式碼狀態，修正文件與實作落差 (詳見 UNIFIED_DEVELOPMENT_PLAN.md)

---

## 🟢 Phase 1: 系統審計與架構硬化 (已完成)

_聚焦於穩定性、安全性與核心邏輯模組化。_

- [x] **模組化重構**：將 `strategyEngine.mjs` 拆分為 Core/Policies 子模組。
- [x] **安全性修補**：Webhook Auth Date 驗證 (24h)、Atomic File Locking。
- [x] **動態停利**：實作基於 MA20 與 ATR 的 Trailing Stop。
- [x] **基礎設施**：API In-memory Cache、全域 `Promise.allSettled` 容錯。
- [x] **前端基建**：iOS Swipe Guard Composable、TabBar 元件化。
- [x] **儀表板重構 (v2)**：Tabbed UI、元件化拆分、PB/PR 數據路徑修正。

---

## 🟡 Phase 2: 策略進化與環境感知 (進行中)

_聚焦於讓策略更聰明地應對不同市場環境。_

### T-2.1: VIX Regime 環境偵測邏輯

- [x] **邏輯實作**：正式啟用 `regimePolicy.mjs` 中的 `CRISIS` 與 `CAUTIOUS` 模式。
- [x] **UI 整合**：在 Dashboard 頂部標示當前市場環境狀態 (e.g. "正常", "高壓警戒", "極端恐慌")。

### T-2.2: 估值與動能 (Valuation Momentum) 整合

- [x] **策略聯動**：將 PB PR 與 MACD 動能結合，實作「估值安全且動能向上」的加碼權重分配。
- [x] **回測驗證**：驗證在不同 PB 區間下的動能表現。

### T-2.3: 策略參數視覺化編輯系統 (核心功能)

- [x] **Metadata Dictionary**：建立 `ConfigMeta.json`，定義參數的中文名稱、描述與 Min/Max 限制。
- [x] **Write API**：實作 `POST /api/strategy-config` 支援原子性參數修改。
- [x] **UI 編輯器**：在 WebApp 建立條列式表單，允許直接在手機上修改策略參數（如 `vixThreshold`, `leverageCap`）。
- [ ] **策略狀態專頁**：Dashboard/Account 頁新增專區顯示 weightScore 構成、冷卻期剩餘天數、分數檔位、Lifecycle Stage (文件標記完成但實際缺失專頁)。

### ⚠️ Phase 2 已知落差 (對齊程式碼後更新)

| 項目              | 文件原狀態 | 實際狀態 | 缺口說明                                                    |
| ----------------- | ---------- | -------- | ----------------------------------------------------------- |
| 資金管控          | ✅ 已完成  | 🟡 部分  | 僅有預算攔截，缺 signalType、Budget Priority、每日/滾動上限 |
| 總經/市場狀態辨識 | ✅ 已完成  | 🟡 部分  | VIX/估值 Regime 完成，缺利息成本濾網、融資券餘額資料流      |

---

## 🔴 Phase 3: 資產解耦與多標的支援 (未來規劃)

_聚焦於系統的通用性與擴充性。_

### T-3.1: 資產抽象化重構 (Storage decoupling)

- [ ] **移除硬編碼**：將 `storage.mjs` 中對 `0050` 與 `00675L` 的欄位依賴移除。
- [ ] **Schema Mapping**：改由策略設定檔定義資產清單。

### T-3.2: 多標的回測系統整合 (進行中)

- [x] **回測框架**：建立基於歷史 JSON 數據的快進回測引擎 (`BacktestRunner` 與 `AccountSimulator`)。
- [x] **策略對比**：支援同時跑多組參數，對比 CAGR 與 Max Drawdown。
- [ ] **Web 整合**：將回測結果匯出成報表、圖表，或部署到 WebApp 上。

### 🟡 Phase 4: 回測與驗證體系 (新增 Phase，40% 完成)

> 來源: preplan_features.md 第六批 P2、finished_features.md 回測框架

| 階段                         | 文件規格                                                                                                    | 實際程式碼                                                                               | 狀態          | 缺口                                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Phase 1: 基礎架構            | `archiveManager.getArchiveRecords()`<br>`backtestEngine.mjs`<br>`runBacktest.mjs`<br>`storage.mjs` 歷史價格 | `backtestRunner.mjs` ✅<br>`accountSimulator.mjs` ✅<br>讀 `data/backtest/timeline.json` | 🟡 核心跑得動 | ❌ `archiveManager` 缺 `getArchiveRecords(dateRange)`<br>❌ 無 `runBacktest.mjs` runner<br>❌ 無 Google Sheet 歷史價格讀取 |
| Phase 2: signalCategory 維度 | `signalCategory` 欄位<br>月報分類統計<br>Telegram 分類表格                                                  | **完全未實作**                                                                           | ⬜ 未開始     | 需先完成 Phase 1 + signalType                                                                                              |
| Phase 3: MacroSentiment 回測 | 三模式比較<br>`--mode sentiment`                                                                            | **未實作**                                                                               | ⬜ 未開始     | 依賴 Phase 1                                                                                                               |

### 關鍵前置依賴

1. **archiveManager.getArchiveRecords(dateRange)** — 回測 Phase 1 封鎖項
2. **strategyEngine 新增 signalCategory / signalType** — 回測 Phase 2 + 資金管控 Phase 1 封鎖項
3. **runBacktest.mjs runner** — 串接 archiveManager、CSV 輸出

### T-3.2: 多標的回測系統整合

- [ ] **回測框架**：建立基於歷史 JSON 數據的快進回測引擎。
- [ ] **策略對比**：支援同時跑多組參數，對比 CAGR 與 Max Drawdown。

---

## 🛠️ 技術債與優化 Backlog

- [ ] **Pino Logging**：全面替換殘留的 `console.log`。
- [ ] **Vite Build 最佳化**：縮減 Vendor bundle 大小。
- [ ] **GitHub Actions**：實作自動化 Lint 檢查。
