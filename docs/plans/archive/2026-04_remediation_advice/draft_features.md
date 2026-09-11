---
type: plan
status: archived
last_updated: 2026-09-11
tags:
  - archived
  - historical
wiki_links: []
---

# Draft Features: System Audit 2026.04 Remediation Plan

## 版本與狀態

- **版本號**: v1.0.0
- **產出日期**: 2026-04-20
- **來源依據**: `SYSTEM_AUDIT_202604.md`

---

## 1. 策略邏輯強化 (Strategy Logic)

### Story 1-1: 修正 PR 分位數計算邏輯

- **User Story**: 身為投資策略使用者，我希望 PR 分位數能正確反映當前 PB 在歷史中的位置（由小到大排序），以避免錯誤的高估/低估判斷。
- **Acceptance Criteria**:
  - [x] 修正 `resolveValuationGuard`，將 `(rank / total) * 100` 改為正確的百分位算法（確保 PR 100 代表歷史最高，PR 0 代表歷史最低）。
  - [x] 確保 `pbRecords` 在計算前已正確排序。

### Story 1-2: 統一 Z2 槓桿狀態機與維持率警告

- **User Story**: 身為風險管理者，我希望維持率警告（紅色/橘色/黃色）能直接整合入 `buildDecision` 的狀態機，並具備最高優先權，以確保在風險發生時優先處置部位。
- **Acceptance Criteria**:
  - [x] 在 `strategyEngine.mjs` 中，將維持率判斷（Layer 0/1/2）置於 `buildDecision` 的最頂端。
  - [x] 整合 `marginManager.mjs` 的警告邏輯，確保決策訊息（市場狀態、執行建議）一致。

### Story 1-3: 實現策略引擎 Orchestrator 模式 (Clean Architecture)

- **User Story**: 身為系統維護者，我希望將 `strategyEngine.mjs` 從 1500 行的單體檔案拆分為多個職責明確的子模組，以提昇可測試性與代碼閱讀性。
- **Acceptance Criteria**:
  - [x] 抽離 `core/marginStateMachine.mjs`：負責維持率狀態機邏輯。
  - [x] 抽離 `core/leverageCapManager.mjs`：負責槓桿上限與極端恐慌破冰邏輯。
  - [x] 抽離 `core/valuationGuard.mjs`：負責 PB 分位數計算、latch 鎖定與解鎖邏輯。
  - [x] 抽離 `policies/entryGatePolicy.mjs`：負責跌幅與 RSI 的前置進場門檻。
  - [x] 抽離 `policies/rebalancePolicy.mjs`：負責 z2Ratio 過高時的再平衡邏輯。
  - [x] 抽離 `policies/macroSentimentPolicy.mjs`：負責 VIX 與總經情緒對計分矩陣的調整。
  - [x] 抽離 `core/cooldownManager.mjs`：負責交易冷卻期判斷。

### Story 1-4: 引入動態停利與極端值價格防護

- **User Story**: 身為生命週期部位持有者，我希望將靜態超買的出場機制改為 Trailing Stop，並強化價格抓取防呆，防範極端市況誤觸斷頭危機或在牛市主升段提早下車。
- **Acceptance Criteria**:
  - [x] 廢除靜態 RSI/KD 觸頂即停利的機制，改為基於 MA20 軌道與 ATR (真實波動率) 的動態追蹤停利。
  - [x] 在 `marginManager.mjs` 中，當讀取到失效或不合理市價（`null`, `<= 0`）時，須強制拋出 Exception 中斷運作，嚴禁回退到 0 從而觸發錯誤的斷頭警報。

### Story 1-5: 策略引擎模組化深度優化 (Orchestrator Polish)

- **User Story**: 身為系統架構師，我希望在 `strategyEngine.mjs` 完成初步重構後，進一步強化其健壯性與接口規範，以確保多模組協作下的資料安全性與代碼整潔度。
- **Acceptance Criteria**:
  - [x] 建立 `policies/index.mjs` 與 `core/index.mjs` 作為統一匯出點 (Export Aggregators)。
  - [x] 在 `buildDecision` 實作 `ctx` 的防禦性處理（使用 `Object.freeze` 淺拷貝），防止子模組意外修改全域上下文。
  - [x] 增加 Guard Clauses：在主引擎調用各外部模組後，加入返回值的完整性驗證。
  - [x] 清理 `strategyEngine.mjs` 中的殘留註釋 (` */`) 與不再使用的中間變數。
  - [x] 完成完整邏輯回歸驗證（使用 `full_verification.mjs` 腳本）。

---

## 2. 系統架構優化 (System Architecture)

### Story 2-1: 全網域 API In-Memory 快取防護

- **User Story**: 身為系統架構師，我希望在 Fastify 路由層建置唯讀 API 的快取，以大幅降低短時間連續訪問造成的 File I/O 負擔及 OOM 當機風險。
- **Acceptance Criteria**:
  - [x] 針對一般唯讀 API 實作 5~10 秒的 TTL 記憶體快取。
  - [x] 針對需要跨檔掃描計算的 API（如 `/reports/monthly`），改由 Cron 排程結束時直接刷入全域變數快取，API Request 階段嚴禁操作檔案遍歷。

### Story 2-2: 修復 Webhook 並發寫入與身分認證漏洞

- **User Story**: 身為資安工程師，我希望防範舊版 Token 重放攻擊，並解決 File Lock 帶來的競態條件 (Race Condition) 漏洞，以確保資料庫安全與執行續的獨立性。
- **Acceptance Criteria**:
  - [x] 修補 `initDataGuard.mjs`，強制驗證 `auth_date` 是否超過 24 小時（若超過則拒絕並拋出 401）。
  - [x] 將 `runnerLock.mjs` 寫碼鎖機制中的 `existsSync` 改為直接使用 `fs.openSync(LOCK_PATH, 'wx')`（Atomic Write Exclusive 模式），藉由系統底層攔阻並發衝突。

### Story 2-3: 前端 Fetcher 防護機制升級

- **User Story**: 身為前端開發者，我希望改良現有 WebApp 內的 API Fetch 邏輯，避免無謂的嘗試消耗，提昇網路效率。
- **Acceptance Criteria**:
  - [x] 實作確定性錯誤 (如 401 Unauthorized) 的 Fail-fast 機制，遭遇時直接終止該 Request，不再套用重試邏輯。

---

## 3. 程式碼品質與穩定性 (Code Quality)

### Story 3-1: 改善前端架構關注點分離

- **User Story**: 身為前端開發者，我希望將繁雜的 DOM 操作與大量的靜態配置抽離核心視圖元件，讓 `App.vue` 專注於 Layout 排版。
- **Acceptance Criteria**:
  - [x] 將 iOS 邊緣的防呆手勢判斷重構為 `useIOSSwipeGuard` Composable hook 函式。
  - [x] 將靜態視圖宣告（如 SVG 與清單項目）抽離為獨立的設定檔或 `TabBar.vue` 子元件。

### Story 3-2: 建立標準化開發基建與系統日誌

- **User Story**: 身為專案參與者，我希望引進強制風格檢查模組，並以結構化日誌取代混雜的 `console.log`，降低溝通成本與日誌追蹤負擔。
- **Acceptance Criteria**:
  - [x] 專案中導入 Husky + lint-staged（或等效防呆機制），以控管程式碼提交。
  - [x] 清除業務邏輯中無意義的 `console.log`，改以如 Pino 甚至專責日誌模組來紀錄 Log Level 結構差異。

### Story 3-3: 強化底層網路容錯與併發隔離

- **User Story**: 身為後端開發者，我希望確保外部網路斷線或單一 API 節點故障不會造成排程永久卡死或整批資料被廢棄，從而提高資料可用性。
- **Acceptance Criteria**:
  - [x] 開發並導入全專案統一的 `fetchWithTimeout()` 工具函式（封裝 `AbortController`，預設逾時為 30 秒）。
  - [x] 重試機制（如 `aiClient.mjs`）需補強捕捉 `ETIMEDOUT`、`ECONNRESET` 以及 `fetch failed` 作為合法重試條件。
  - [x] 系統中諸如多支非依賴性的 API 併發呼叫（如擷取 PE/PB、殖利率等多維度資料），改以 `Promise.allSettled()` 取代 `Promise.all()` 以隔絕單點損毀。

---

## 4. 策略模組化與 Mini App 優化 (Modular Config & UI)

### Story 4-1: 策略設定模組化與 Mini App 參數顯示

- **User Story**: 身為投資者，我希望將臃腫的策略設定檔拆分，並能在 Mini App 上清晰查看各類別參數（含區塊說明），以便隨時掌握策略核心邏輯。
- **Acceptance Criteria**:
  - [x] 策略設定模組化：拆分為 Asset, Indicator, Guard, System 四大子模組 (2026-04-24)。
  - [/] Mini App 投資參數顯示優化：
    - [ ] 介面需區分四個核心區塊 (Asset, Indicator, Guard, System)。
    - [ ] 每個區塊需包含功能說明 (Label/Description)。
    - [ ] 維持極簡懸浮膠囊設計語彙。
    - [ ] [AC] 使用者能在 Account 頁面清楚閱讀當前運作參數。

### Story 4-2: 策略參數視覺化維護系統

- **User Story**: 身為策略維護者，我希望能在 Mini App 上透過條列式表單（含中文說明）直接修改投資參數，而非編輯原始 JSON 檔案，以降低誤觸風險並提昇調整效率。
- **Acceptance Criteria**:
  - [ ] **元數據字典 (Schema)**：建立 `ConfigMeta.json`，為每個參數鍵值定義中文標籤、詳細描述與數值限制（如 Min/Max）。
  - [ ] **寫入接口 (Write API)**：實作 `POST /api/strategy-config`，支援原子性寫入與基本校驗。
  - [ ] **導覽擴充**：在 `FloatingPill.vue` 中新增「策略」入口，獨立於 Account 頁面。
  - [ ] **視覺化編輯器**：實作表單 UI，將 JSON 轉換為具備說明的條列式 Input/Slider 組件。
  - [ ] **持久化與生效**：修改後檔案需持久化至 `data/config/parts/`，且次輪排程需自動抓取最新參數。
