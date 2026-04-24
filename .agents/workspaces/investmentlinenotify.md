# Workspace: investmentlinenotify

> InvestmentLineNotify 專案環境變數檔。
> 依 PROPOSAL_20260422_002 + 006 從原 rules 中硬編碼的專案特定資訊無損遷移至此。
> 依 PROPOSAL_20260422_022 新增 DEPLOYMENT_CONSTRAINTS / DEPLOYMENT_SOP / BUSINESS_DOMAINS / PATHS.source_modules 欄位。
> 意圖繼承自 PROPOSAL-011「業務脈絡錨定批次補強」。
>
> **契約**：所有欄位定義參照 `.agents/WORKSPACE_SCHEMA.yaml`（SSOT）。

---

## PROJECT_CONTEXT（專案核心資訊）

- **project_name**：investmentlinenotify
- **display_name**：InvestmentLineNotify（個人投資通知系統）
- **business_domain**：量化投資訊號推送 + Telegram Mini App 策略視覺化管理
- **core_entities**：strategyWeight / signalPool / marketData / newsPool / maintenanceRatio
- **user_role**：個人使用（User 為唯一使用者）
- **proposal_prefix**：ILN（依 PROPOSAL_20260422_023；project scope 提案編號前綴）

## TECH_STACK（技術棧）

- **language**：Node.js ESM（`import` / `export`，禁用 CommonJS）
- **frontend**：Vue 3 + Vite（`<script setup>` + Composition API）
- **backend**：Fastify HTTP API Server
- **storage**：File-based JSON / CSV（`data/` 目錄）+ Google Sheets 同步
- **external_dependency**：Telegram Bot API / Google Gemini / Grok API / Langfuse / 多市場資料源（TWSE / Yahoo / FRED / CNN / KGI / NDC）
- **deployment**：Oracle VM crontab（排程）+ PM2（長駐 Bot & API Server）+ GitHub Actions（手動觸發備用）
- **testing_framework**：Node.js 內建 `node:test` + `c8`（覆蓋率）

## PATHS（實際專案路徑）

- **project_root**：`.`
- **frontend_root**：`webapp/`
- **data_root**：`data/`
- **docs_root**：`docs/`
- **env_example**：`.env.example`
- **test_root**：`src/test/`

### PATHS.source_modules

- **storage**：`src/modules/storage.mjs`
- **concurrency**：`src/modules/bot/runnerLock.mjs`
- **archive**：`src/modules/data/archiveManager.mjs`
- **middleware**：`src/api/middleware/initDataGuard.mjs`
- **composables**：`webapp/src/composables/`

### PATHS.schedulers

- `runDailyCheck.mjs`（每日排程檢查）
- `runNewsFetch.mjs`（新聞拉取）
- `runSignalPush.mjs`（訊號推送）

## DEPLOYMENT_CONSTRAINTS（部署約束）

- **target**：Oracle VM Free Tier（Ampere A1）
- **cpu**：4 OCPU（ARM 架構，需確認 `linux/arm64` 套件相容性）
- **memory**：24 GB RAM（充裕，但仍需對歷史資料載入實作 Batching / Streaming）
- **storage_limit**：50 GB 區塊儲存（禁止無限增長 Log / 快取策略）
- **network_limit**：10 TB/月 出口流量（禁止大量 Polling 架構）
- **runtime**：Node.js 20 LTS
- **watchdog**：PM2（`max_memory_restart: 1G`，單 process 記憶體洩漏自動重啟）
- **process_naming**：`iln-<功能簡稱>`（如 `iln-api` / `iln-scheduler` / `iln-bot`）
- **nginx_config_path**：`/etc/nginx/sites-available/investmentlinenotify`

## DEPLOYMENT_SOP（部署標準作業流程）

> 取代原 `skills/deploy-oracle.md` 內容（該檔已於 PROPOSAL_022 Phase C 刪除）。

### deploy_steps

1. `cd ~/InvestmentLineNotify && git pull origin main`
2. 若 `package.json` 有變更：`npm install --production`
3. 重啟受影響的 PM2 process（優先使用特定 process 重啟，避免影響其他服務）：
   - 單一服務：`pm2 restart iln-<process名稱>`
   - 多服務：`pm2 restart iln-api iln-scheduler`
4. 確認服務狀態：`pm2 status && pm2 logs iln-<process名稱> --lines 20`
5. 若 Nginx 設定有變更：`sudo nginx -t && sudo systemctl reload nginx`

### 部署前身份權限檢核（依 PROPOSAL_20260422_010）

1. 執行身份為 `node` / 專案 user，**絕對禁止**以 root 啟動業務進程
2. 執行 `whoami && pm2 ping` 確認身份與 PM2 daemon 對應
3. `data/` 目錄權限為 `755`，owner 為 node user
4. 禁用系統級 `systemd pm2-root`；僅使用 user-space pm2

**違反判定**：
- 以 root 啟動 → 🔴 `[BLOCKER]`（對齊 `security.md §s02` SC-02）
- `data/` 權限 777 → 🟡 警告（建議修正）

### 部署驗證清單

- [ ] `pm2 status` 顯示所有 process 為 `online`
- [ ] 最新 log 無 ERROR 級別訊息
- [ ] 核心功能手動測試通過（例如：發送一則測試通知）

### env_sync（環境變數同步）

1. 編輯 Oracle VM 上的 `.env`：`nano ~/InvestmentLineNotify/.env`
2. 新增/修改變數後儲存
3. 重啟對應 process：`pm2 restart iln-<process名稱>`
4. `.env` 不納入版控（`.gitignore` 已包含）；變更須於 `.env.example` 留樣

### rollback（回滾 SOP）

1. 確認回滾目標 commit：`git log --oneline -5`
2. 建立回滾 commit：`git revert HEAD`
3. 重啟受影響 process：`pm2 restart iln-<process名稱>`
4. 若無法 revert（例：涉及 migration）→ 聯絡 User 手動介入

### PM2 常用指令參考

| 指令 | 用途 |
|------|------|
| `pm2 status` | 查看所有 process 狀態 |
| `pm2 logs <name>` | 即時查看 log |
| `pm2 restart <name>` | 重啟特定 process |
| `pm2 save` | 儲存當前 process 列表（開機自啟用）|
| `pm2 startup` | 設定開機自動啟動 |

## BUSINESS_DOMAINS（業務域分類）

### core（核心業務功能）

- 訊號計算（量化投資訊號 RSI / KD / MACD / MA20 / ATR / 乖離率）
- 推送管理（Telegram Bot 訊息推送：全版 + 精簡卡）
- 策略管理（`strategyWeight` 讀寫與管理、維持率 4 層狀態機）

### realtime（即時或排程業務功能）

- Mini App UI（Telegram Mini App 7-tab：總覽/雷達/多空/圖表/報告/新聞/設定）
- 系統維運（部署、監控、日誌：Oracle VM + PM2 + Nginx）
- Rules 維護（Agent Rules 審計與更新）

## FUNCTIONAL_DOMAINS（功能域）

Sprint 規劃時，任務必須落在以下功能域之一：

| 功能域 | 描述 | 主要執行 Agent |
|-------|------|--------------|
| 訊號計算 | 量化投資訊號的計算邏輯（RSI / KD / MACD / MA20 / ATR / 乖離率）| `@Backend` |
| 推送管理 | Telegram Bot 訊息推送流程（全版 + 精簡卡）| `@Backend` |
| 策略管理 | `strategyWeight` 讀寫與管理（與維持率 4 層狀態機）| `@Backend` |
| Mini App UI | Telegram Mini App 介面功能（7-tab：總覽/雷達/多空/圖表/報告/新聞/設定）| `@Frontend` |
| 系統維運 | 部署、監控、日誌管理（Oracle VM + PM2 + Nginx）| `@Backend` |
| Rules 維護 | Agent Rules 審計與更新 | `@Retro` / `@Lead` |

## CRITICAL_PATHS（關鍵路徑）

### Telegram 推送路徑
- Telegram Bot API 呼叫有 `try/catch`
- API 失敗有重試機制（≤ 3 次）
- 不得因推送失敗導致程序崩潰

### 投資訊號計算路徑
- 計算輸入值有型別驗證
- 除零 / NaN / Infinity 情況有防護
- 計算異常不得影響其他訊號的正常推送（單點失敗隔離）

### 資料寫入路徑（File-based）
- File 寫入有 `try/catch`
- 批次寫入 ≥ 50 筆或資料刪除必須有 HITL 授權
- TOCTOU 原子性鐵律：使用 `fs.openSync(path, 'wx')` 獨佔模式

### strategyWeight 異動路徑
- 異動行為必須經 `@Consultant` → `@Lead` → `@Backend` 流程
- 數值變更前有現有值讀取與記錄
- 異動記錄寫入審計日誌

### Token 時效驗證路徑
- initData 24 小時時效驗證（HMAC-SHA256 簽章 + `auth_date` 檢查）
- 驗證失敗回 HTTP 401，不執行業務邏輯

## SECURITY_SCOPE_EXTENSIONS

- SC-03（`strategyWeight` 異動路徑）為本專案**專屬零容忍**範疇（對齊 `consultant.md §核心禁止條款`）
- 其他 SC 依 `.agents/skills/security-audit.md §1` 通用定義

## QA_MANDATORY_TESTS

### P0 必測（任何變更後均需驗證）
- [ ] Telegram Bot 推送訊號正常送達
- [ ] `strategyWeight` 讀取值與預期一致
- [ ] File-based 讀寫無資料損毀

### P1 必測（涉及相關功能變更時）
- [ ] 投資訊號計算結果數值合理性驗證
- [ ] `strategyWeight` 異動後推送訊號反映正確
- [ ] Mini App 開啟與基本互動無報錯

### P2 必測（完整 Sprint 驗收時）
- [ ] 錯誤路徑：Telegram API 失敗的降級處理
- [ ] 錯誤路徑：File 讀取失敗的錯誤訊息
- [ ] 效能：單次推送延遲 ≤ 3 秒

## BUSINESS_RULES（業務規則摘要）

### 策略 2.3-best 架構核心
- **維持率 4 層狀態機**：斷頭危機 (<135%) / 高危凍結 (145%) / 預備金防禦 (160%) / 常態運行 (≥160%)
- **Gross Leverage 監控**：主動禁止 (2.5x) / 被動強制砍倉 (3.0x) / 恢復目標 (2.2x)
- **VIX 情緒短路**：絕對值 > 35 或趨勢回落時 Bypass 負面情緒扣分
- **動態停利（MA20/ATR）**：取代靜態 RSI/KD 超買；啟動門檻 = 10% 獲利或首次站穩 MA20
- **PB 估值防護**：分位數壓縮乘數 + DefenseLatch 鎖定 + 恐慌破冰 Bypass

### 質押槓桿策略
- 以 0050 質押借款買進 00675L（期貨反向 ETF）
- 結合生命週期投資法進行長期複利累積

### 戰略審查 Bypass 規則（允許 Bypass 項）
- 純 UI 視覺調整（顏色、排版、間距）
- 純文案修改
- 基礎設施操作（Nginx / PM2 / SSL 憑證）
- 純開發工具調整

### 戰略審查 Bypass 禁止反例（即使看似簡單）
- 通知觸發條件（如 RSI 閾值）
- 通知格式或內容計算（如漲跌幅 %）
- 排程頻率或執行時間
- 資料來源（API Provider）新增移除
- 使用者資產配置參數

---

## EVALUATED_PACKAGES

> Prior Art Scan 快取（對齐 `RULES_DESIGN_GUIDE §十八.F` + `WORKSPACE_SCHEMA.yaml v1.2`）。
> 由 `@Architect` 於每次完成 Prior Art Scan 後 append 條目；避免重複評估同一套件。

- **evaluated_packages**：（尚無評估紀錄；首次執行 Prior Art Scan 時由 @Architect 建立）

---

**維護紀錄**：
- 2026-04-22 建立（PROPOSAL_20260422_002 + 006，意圖繼承自 PROPOSAL-011）
- 2026-04-22 擴充（PROPOSAL_20260422_022 Phase D）：新增 DEPLOYMENT_CONSTRAINTS / DEPLOYMENT_SOP / BUSINESS_DOMAINS / PATHS.source_modules 4 區塊；DEPLOYMENT_SOP 內容由原 `skills/deploy-oracle.md` 遷移
- 2026-04-22 擴充（PROPOSAL_20260422_023 Phase B）：新增 PROJECT_CONTEXT.proposal_prefix = ILN
- 2026-04-23 擴充（PROPOSAL_20260423_002 Phase F）：新增 EVALUATED_PACKAGES 欄位（空清單；待首次 Prior Art Scan 時填充）
