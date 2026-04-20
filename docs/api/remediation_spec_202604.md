# Technical Specification: System Audit Remediation (2026-04)

## 📍 總覽
本規格文件由 `@Architect` 針對 `draft_features.md` 產出，定義了實作階段的 API 變更、類別結構及防呆機制。

---

## 1. 策略邏輯強化 (Strategy Logic)
### 1.1 Policy 化重構
- 新增路徑：`src/modules/strategy/policies/`
- **marginPolicy.mjs**:
  - `calculateMarginRatio(totalAssets, loanAmount)`: 純函數計算維持率。
- **entryScoringPolicy.mjs**:
  - `computeEntryScore(indicators, criteria, isLeftSideRegime)`
  - **去相關化實作**：`const momentumScore = Math.max(rsiScore, kdScore);`
  - **左側濾網實作**：當 `isLeftSideRegime === true`（定義為負乖離達標），技術分數作為 `confirmation` 旗標，不直接計入總分。

### 1.2 設定檔 Schema 驗證
- 新增路徑：`src/modules/strategy/strategySchema.mjs`
- 依賴套件：`zod`
- 實作細節：
  - 定義 `StrategyConfigSchema`。
  - 在 `src/modules/strategy/strategyConfig.mjs` 讀取時執行 `.safeParse()`。若失敗，套用 `const SAFE_DEFAULT = { ... }` 並記錄 `logger.error`。

### 1.3 極端價格防呆
- 目標檔案：`src/modules/strategy/marginManager.mjs`
- 變更：
  ```javascript
  if (currentPrice === null || currentPrice <= 0) {
     throw new Error('[MarginRisk] Invalid currentPrice. Evaluation aborted to prevent false liquidation.');
  }
  ```
  **(外層調用處需加上 `try/catch`，避免中斷 Cron 排程)**

---

## 2. 系統架構優化 (System Architecture)
### 2.1 Fastify In-Memory Cache
- 目標檔案：`src/api/routes/reports.mjs` 及其他 GET 路由。
- 實作：
  - 引入 TTL (Time To Live) Map 快取。例如 `const cache = new Map();`。
  - 獨立 Cron 去呼叫更新快取，GET Request 只從記憶體取得 `JSON.stringify` 後的字串回傳，嚴禁在 HTTP handler 內進行大量檔案讀寫。

### 2.2 防範重放攻擊與平行競態
- **initDataGuard.mjs**:
  - 從 Telegram URL Params 中萃取 `auth_date`。
  - `const now = Math.floor(Date.now() / 1000);`
  - `if (now - auth_date > 86400) return reply.code(401).send('Token expired');`
- **runnerLock.mjs**:
  - 改用 Atomic 操作防併發：
  - ```javascript
    try {
      const fd = fs.openSync(LOCK_PATH, 'wx');
      fs.closeSync(fd);
      // Lock acquired successfully
    } catch (e) {
      if (e.code === 'EEXIST') return false; // Lock already exists
      throw e;
    }
    ```

---

## 3. 程式碼品質與防護 (Code Quality)
### 3.1 Fetcher 與網路底層異常防護
- 新增工具：`src/utils/fetchWithTimeout.mjs`
  - 封裝 Node 原生 `fetch` 與 `AbortController`，設定 `timeout = 30000` 毫秒。
- **aiClient.mjs 重試邏輯補強**:
  - `isRetryableError(err)` 中加入 `['ECONNRESET', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'fetch failed'].includes(err.code || err.cause?.code)`。

### 3.2 Promise.allSettled 重構
- 目標檔案：`src/modules/providers/twseProvider.mjs`
- 變更：
  將取得法說會、籌碼、融資券等互相獨立的 Data Feed 呼叫從 `Promise.all` 改為 `Promise.allSettled`。若其中一項 `status === 'rejected'`，則填入對應的空值或 fallback，不阻礙其他資料儲存。

### 3.3 WebApp 關注點分離
- 新增目錄：`webapp/src/composables/` -> `useIOSSwipeGuard.js`
- 靜態配置抽離：將 Navigation Data 移動至 `webapp/src/config/navigation.js`。
