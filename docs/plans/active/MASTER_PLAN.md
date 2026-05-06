# InvestmentLineNotify Master Plan (v3.0)

本文件為專案的唯一真實來源 (Single Source of Truth)，整合了過往 Phase 1 至未來 Phase 3 的所有計畫。

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

- [ ] **邏輯實作**：正式啟用 `regimePolicy.mjs` 中的 `CRISIS` 與 `CAUTIOUS` 模式。
- [ ] **UI 整合**：在 Dashboard 頂部標示當前市場環境狀態 (e.g. "正常", "高壓警戒", "極端恐慌")。

### T-2.2: 估值與動能 (Valuation Momentum) 整合

- [ ] **策略聯動**：將 PB PR 與 MACD 動能結合，實作「估值安全且動能向上」的加碼權重分配。
- [ ] **回測驗證**：驗證在不同 PB 區間下的動能表現。

### T-2.3: 策略參數視覺化編輯系統 (核心功能)

- [ ] **Metadata Dictionary**：建立 `ConfigMeta.json`，定義參數的中文名稱、描述與 Min/Max 限制。
- [ ] **Write API**：實作 `POST /api/strategy-config` 支援原子性參數修改。
- [ ] **UI 編輯器**：在 WebApp 建立條列式表單，允許直接在手機上修改策略參數（如 `vixThreshold`, `leverageCap`）。

---

## 🔴 Phase 3: 資產解耦與多標的支援 (未來規劃)

_聚焦於系統的通用性與擴充性。_

### T-3.1: 資產抽象化重構 (Storage decoupling)

- [ ] **移除硬編碼**：將 `storage.mjs` 中對 `0050` 與 `00675L` 的欄位依賴移除。
- [ ] **Schema Mapping**：改由策略設定檔定義資產清單。

### T-3.2: 多標的回測系統整合

- [ ] **回測框架**：建立基於歷史 JSON 數據的快進回測引擎。
- [ ] **策略對比**：支援同時跑多組參數，對比 CAGR 與 Max Drawdown。

---

## 🛠️ 技術債與優化 Backlog

- [ ] **Pino Logging**：全面替換殘留的 `console.log`。
- [ ] **Vite Build 最佳化**：縮減 Vendor bundle 大小。
- [ ] **GitHub Actions**：實作自動化 Lint 檢查。
