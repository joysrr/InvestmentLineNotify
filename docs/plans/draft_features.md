# Draft Features: System Audit 2026.04 Remediation Plan

## 版本與狀態
- **版本號**: v1.0.0
- **產出日期**: 2026-04-20
- **來源依據**: `SYSTEM_AUDIT_202604.md`

---

## 1. 策略邏輯強化 (Strategy Logic)

### Story 1-1: 程式結構重構與參數字典化 (Policy Extraction)
- **User Story**: 身為系統維護者，我希望將算分、維持率等純函數抽離到獨立的 Policy 模組，並建立集中的參數字典，以便將業務編排與核心運算解耦，提升單元測試覆蓋率與數值可維護性。
- **Acceptance Criteria**:
  - [x] 建立 `src/modules/strategy/policies/` 目錄。
  - [x] 將維持率計算與進場算分等邏輯抽離至各獨立的 `*Policy.mjs`。
  - [x] 建立 `constants/strategyDefaults.mjs`，將 135%、145%、160% 等魔術數字集中管理。

### Story 1-2: 策略設定檔強型別防呆 (Schema Validation)
- **User Story**: 身為系統管理員，我希望引入強型別套件對 `Strategy.json` 進行即時檢驗，以便在手動配置遺漏或錯誤時啟動 Safe Default 機制，防範系統 Runtime Error。
- **Acceptance Criteria**:
  - [x] 引入 Schema 檢驗套件（如 Zod）。
  - [x] 在讀取 `Strategy.json` 後加入驗證節點，驗證失敗時發送警告通知並切換至預設的安全參數值。

### Story 1-3: 邏輯衝突消解與矩陣去相關化
- **User Story**: 身為量化研究員，我希望系統在左側下跌環境以跌幅為戰略主體，並降低高度相關指標（如 RSI/KD）的重疊給分，以解決因多因子共線性與邏輯互斥造成的訊號失真。
- **Acceptance Criteria**:
  - [x] 重構權重判斷：在左側下跌跌段，將技術面作為確認濾網，而非與跌幅分數無腦疊加。
  - [x] 在 `computeEntryScore` 中，針對 RSI 與 KD 的給分演算法，修改為「取 MAX 降權」的機制。

### Story 1-4: 引入動態停利與極端值價格防護
- **User Story**: 身為生命週期部位持有者，我希望將靜態超買的出場機制改為 Trailing Stop，並強化價格抓取防呆，防範極端市況誤觸斷頭危機或在牛市主升段提早下車。
- **Acceptance Criteria**:
  - [x] 廢除靜態 RSI/KD 觸頂即停利的機制，改為基於 MA20 軌道與 ATR (真實波動率) 的動態追蹤停利。
  - [x] 在 `marginManager.mjs` 中，當讀取到失效或不合理市價（`null`, `<= 0`）時，須強制拋出 Exception 中斷運作，嚴禁回退到 0 從而觸發錯誤的斷頭警報。

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
  - [ ] 實作確定性錯誤 (如 401 Unauthorized) 的 Fail-fast 機制，遭遇時直接終止該 Request，不再套用重試邏輯。

---

## 3. 程式碼品質與穩定性 (Code Quality)

### Story 3-1: 改善前端架構關注點分離
- **User Story**: 身為前端開發者，我希望將繁雜的 DOM 操作與大量的靜態配置抽離核心視圖元件，讓 `App.vue` 專注於 Layout 排版。
- **Acceptance Criteria**:
  - [ ] 將 iOS 邊緣的防呆手勢判斷重構為 `useIOSSwipeGuard` Composable hook 函式。
  - [ ] 將靜態視圖宣告（如 SVG 與清單項目）抽離為獨立的設定檔或 `TabBar.vue` 子元件。

### Story 3-2: 建立標準化開發基建與系統日誌
- **User Story**: 身為專案參與者，我希望引進強制風格檢查模組，並以結構化日誌取代混雜的 `console.log`，降低溝通成本與日誌追蹤負擔。
- **Acceptance Criteria**:
  - [ ] 專案中導入 Husky + lint-staged（或等效防呆機制），以控管程式碼提交。
  - [ ] 清除業務邏輯中無意義的 `console.log`，改以如 Pino 甚至專責日誌模組來紀錄 Log Level 結構差異。

### Story 3-3: 強化底層網路容錯與併發隔離
- **User Story**: 身為後端開發者，我希望確保外部網路斷線或單一 API 節點故障不會造成排程永久卡死或整批資料被廢棄，從而提高資料可用性。
- **Acceptance Criteria**:
  - [ ] 開發並導入全專案統一的 `fetchWithTimeout()` 工具函式（封裝 `AbortController`，預設逾時為 30 秒）。
  - [ ] 重試機制（如 `aiClient.mjs`）需補強捕捉 `ETIMEDOUT`、`ECONNRESET` 以及 `fetch failed` 作為合法重試條件。
  - [ ] 系統中諸如多支非依賴性的 API 併發呼叫（如擷取 PE/PB、殖利率等多維度資料），改以 `Promise.allSettled()` 取代 `Promise.all()` 以隔絕單點損毀。
