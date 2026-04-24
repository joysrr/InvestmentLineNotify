# SYSTEM_AUDIT_202604 (全系統 Code Review 與架構體檢)

> ⚠️ **文件區隔說明**（依 PROPOSAL_20260422_021 T-3）：
> 本文件為 **業務系統架構 Review**（2026-04-19 時間點快照，InvestmentLineNotify 業務邏輯審計），
> **非** `docs/Reports/AUDIT_HISTORY.md`（@Auditor 產出的 AI Agent 品質評分時序）。
> 兩者範圍完全不同：
> - 本文件：檢視 src/ / webapp/ 業務程式碼與架構
> - AUDIT_HISTORY.md：檢視 .agents/ 規則框架品質（5 維度 × 15 細項）
> 請勿混淆。

**建立日期**: 2026-04-19  
**發起人**: @TechLead  
**協作者**: @Planner, @Architect, @Backend, @Frontend, @QA, @Reviewer, @Consultant  

## 📍 審查目的與範圍
本文件負責記錄 2026 年 04 月份的全系統架構健檢與 Code Review 指標。
我們將針對「策略邏輯」、「系統架構」與「程式碼品質」三個核心面向進行盤點，發現系統隱患並轉化為可執行的修正提案，做為接下來 Sprint 的開發藍圖。

---

## 1️⃣ 策略邏輯 (Strategy Logic)
> 由 `@Consultant` 與 `@Backend` 共同審查。確保量化運算、風險控管、狀態機流轉邏輯的準確度與強健性。

### 🔴 發現問題 (Findings)
- **God Object (策略引擎職責過重)**：目前 `strategyEngine.mjs` 包攬了從流程編排到具體業務規則 (如進場門檻、維持率精算) 的實作，程式碼日漸肥大，不利於撰寫單元測試。
- **缺乏強型別參數校驗 (Schema Validation)**：`Strategy.json` 的參數高度依賴手動配置，缺乏強健的欄位/型別防線。若出現少填或錯填 (例如遺漏 `frozenZone`)，非常容易導致系統 Runtime Error。
- **硬編碼與魔術數字 (Magic Numbers)**：諸多門檻檻值 (如 135%, 145%, 160% 等維持率狀態水位) 以及技術指標預設參數散落在不同檔案內，缺乏集中管理字典。

**(⬇️ 2026-04 領域顧問團隊 (Domain Consultants) 深度體檢補充 ⬇️)**
- 🚨 **領域衝突警告 (左側交易 vs 技術指標)**：[`@Consultant: Left-Side`] 目前 `computeEntryScore` 將「跌幅加分」(左側邏輯) 與「KD/RSI黃金交叉」(右側追價邏輯) 混合「相加」。這違背了左側交易的核心價值。在極端恐慌時，技術指標會持續死亡交叉，這反而會抵銷跌幅分數，導致錯失建倉良機。
- 🚨 **領域衝突警告 (生命週期 vs 技術面停利)**：[`@Consultant: Lifecycle/Technical`] `signalRules.mjs` 內的出場條件 (sell signals) 過度依賴靜態的 RSI(75) 與 KD(80) 超買刻度。這在主升段會面臨「高位鈍化」，導致過早賣出核心資產，截斷長線獲利，與生命週期法極大化複利的目標矛盾。
- ⚠️ **極端值防呆破口 (Math / Quant致命錯誤)**：[`@Consultant: Math-Quant`] 在 `marginManager.mjs` 的 `analyzeMarginRisk` 中，若外部 API 異常導致 `currentPrice0050` 為 `0` 或 `null`，程式直接將其 fallback 為 `0`。這會導致算出的 `currentMargin` 變成 `0%`，並直接觸發假的 `🔴【斷頭危機】`，此熔斷漏洞極大。
- ⚠️ **評分矩陣共線性 (Collinearity) 問題**：[`@Consultant: Math-Quant`] `computeEntryScore` 直接將 RSI、KD 與 MACD 分數加總。這三者在統計學上高度相關 (皆屬動能指標)，導致「動能權重」在評鑑中被重複放大，造成 Overfitting。

### 🟢 修正提案 (Proposals)
- [ ] **邏輯抽離 Policy 化**：將算分、算維持率等純函數 (Pure Function) 邏輯抽離至 `src/modules/strategy/policies/` 中 (例如 `marginPolicy.mjs`)，落實控制與邏輯分離。
- [ ] **建構 Strategy Schema 防線**：引入 Zod / Joi 套件建立 `Strategy.json` 即時校驗防線。若遇缺失將啟動 Safe Default 回退機制並發出異常通知。
- [ ] **統一參數字典**：建立 `constants/strategyDefaults.mjs`，集中存放所有的魔術數字。

**(⬇️ 2026-04 領域顧問團隊修正提案補充 ⬇️)**
- [ ] **重構 Entry Score 權重流派 (Conflict Resolution)**：引入參數決定「戰略權重」。若屬左側下跌段，應以跌幅為主體；此時技術面僅應作為「延遲建倉的右側確認濾網」而非在矩陣中無腦互加。
- [ ] **導入 ATR 動態停利與鈍化防護**：將出場邏輯從「硬性 RSI/KD 超買」優化為「結合強勢軌道（如 MA20）與真實波動率 (ATR) 的追蹤停利 (Trailing Stop)」，防範牛市提早下車。
- [ ] **強化價格熔斷機制 (Fallback/Circuit Breaker)**：在 `marginManager.mjs` 中，當讀取到不合理市價 (`null`, `<= 0`) 時，系統應發射例外錯誤 (`Throw Error`) 終止計算，而非繼續算出錯誤的 `0%` 維持率並引發誤報。
- [ ] **矩陣去相關化**：針對關聯性極高的指標群（RSI 與 KD），給分邏輯應改為取 MAX 或降權機制，避免因為高度共線性導致訊號失真。

---

## 2️⃣ 系統架構 (System Architecture)
> 由 `@Architect` 審查。專注於跨層次間的通訊效能、資料流一致性以及錯誤防護。

### 🔴 發現問題 (Findings)
- **API 讀取產生 File I/O 競爭隱患**：目前 Fastify API Layer 會直接讀取 Local JSON (如 `latest.json`)。若 WebApp 前端頻繁跳轉或發出併發請求，恐造成 I/O 效能瓶頸及檔案鎖死風險。
- **前端重試機制 (Retry) 浪費**：WebApp 的 API Fetch 若遭遇 HTTP 401 (授權逾期) 錯誤，依舊會跑滿 Retry 上限次數，消耗資源且影響使用者體驗。

**(⬇️ 2026-04 系統架構師 (Architect) 深度體檢補充 ⬇️)**
- 🚨 **API 安全性破口 (initData Replay Attack)**：[`@Architect`] 在 `src/api/middleware/initDataGuard.mjs` 中，雖然正確驗證了 Telegram HMAC-SHA256 簽章，但卻「沒有檢查 `auth_date`」。這意味著只要 initData 被攔截或外流，攻擊者就能拿著這串合法的舊 Token 永久存取我們的 API (重放攻擊)。
- ⚠️ **並發寫入衝突 (TOCTOU Race Condition)**：[`@Architect`] 在 `src/modules/bot/runnerLock.mjs` 中，程式使用了 `existsSync` 檢查鎖不存在後，再接著呼叫 `writeFileSync` 寫入。這是一個典型的「Time-of-Check to Time-of-Use」競態條件漏洞，若 Cron 排程與 Webhook 在同一個毫秒觸發，兩者都會認為沒有鎖並雙雙執行，導致 File-based 資料庫被寫壞。
- ⚠️ **記憶體與 I/O 效能隱患 (Memory Spike)**：[`@Architect`] 在 `src/api/routes/reports.mjs` 中，例如 `/reports/monthly` 會在「每次請求」時，去硬碟 `readdir` 並掃描讀取最高 300 多個 JSON 檔案進行 `JSON.parse()`。這在 Oracle VM Free Tier 資源受限的環境下，一旦前端連續 F5 更新，會瞬間吃乾 CPU 與大量記憶體引發 OOM崩潰。

### 🟢 修正提案 (Proposals)
- [ ] **實作 API In-Memory 快取機制**：於 Fastify 的唯讀 API 路由引入快取層 (如 5~10 秒的 TTL)。只有快取失效時才真正讀檔，大幅降低短時間內對檔案系統的 I/O 次數。
- [ ] **重構前端 Fetcher 狀態管理**：針對確定性錯誤 (如 401 授權錯誤) 實作提早熔斷跳出 (Fail-fast)，或評估升級引進 VueUse `useFetch` 以簡化狀態管理層。

**(⬇️ 2026-04 系統架構師修正提案補充 ⬇️)**
- [ ] **修補 initDataGuard 時效驗證**：在 `initDataGuard.mjs` 內強制取得 `auth_date` (Unix Timestamp)，並比對伺服器現在時間，若超過 24 小時則回傳 HTTP 401 拒絕請求，防範重放攻擊。
- [ ] **替換 File Lock 實作方式 (Atomic Operation)**：修改 `runnerLock.mjs`，將 `existsSync` 改為使用 Node.js 原生的 `fs.openSync(LOCK_PATH, 'wx')` (Write Exclusive 模式)。如此一來若檔案已存在會在底層直接 Atomic 報錯，徹底根絕並發競態點。
- [ ] **後端 API 彙整快取 (Aggregated In-Memory Cache)**：針對 `reports.mjs` 這種會跨檔計算的回傳路由，必須在模組內宣告 LRU Cache 或全域快取變數，並在日更 Cron 結束後直接刷入記憶體。API 只從記憶體供檔，嚴禁在 HTTP Request 階段進行大量檔案遍歷。

---

## 3️⃣ 程式碼品質 (Code Quality)
> 由 `@Reviewer` 與 `@Frontend` / `@Backend` 共同把關。專注於程式碼風格 (Clean Code)、元件複用率與關注點分離 (SoC)。

### 🔴 發現問題 (Findings)
- **視圖層混合業務運算 (Vue 3)**：`App.vue` 等核心元件中塞入了大量如「阻擋 iOS 邊緣滑動手勢」的純原生計算，污染了元件的響應式語意。
- **臃腫的靜態宣告配置**：冗長的靜態資料 (例如 Navigation Tabs 的陣列宣告與龐大的 Inline SVG Icon) 全擠入單一元件，干擾對主體架構的閱讀。
- **缺乏強制 Lint / Format 檢查**：目前無法確保開發團隊提交的程式碼風格一致 (如 Prettier/ESLint未配置自動化)。
- **Console.log 殘留污染**：正式環境的日誌容易變得極度混亂，且增加雲端 Watchdog 的負擔。

**(⬇️ 2026-04 資深審查員 (Reviewer) 深度體檢補充 ⬇️)**
- 🚨 **Node.js Native Fetch 缺少 Timeout 設定 (Memory Leak Risk)**：[`@Reviewer`] 發現 `src/modules/ai/aiClient.mjs` 中的 `callGrokAPI` 使用了原生的 `fetch()` 呼叫外部 API，卻沒有封裝 `AbortController` 或傳入 Timeout！若遠端 AI 伺服器掛起，該 Request Promise 會永久卡死，導致排程鎖死與 OOM。
- ⚠️ **重試機制 (Retry) 漏接底層網路錯誤**：[`@Reviewer`] 發現 `aiClient.mjs` 的 `isServiceError()` 只檢查了文字 `503` 或 `UNAVAILABLE`。若發生 DNS 解析失敗 (`fetch failed`) 或網路斷線 (`ECONNRESET`)，系統會立刻報錯中斷，拒絕任何重試，降低了 AI 呼叫的強健度。
- ⚠️ **Promise.all 未隔離錯誤骨牌效應**：[`@Reviewer`] 在 `twseProvider.mjs` 等 API 組合函式中，發現過度使用 `Promise.all`。若當中一支次要 API Timeout，會連帶讓其他已經成功拉回的資料全數拋棄。

### 🟢 修正提案 (Proposals)
- [ ] **重構手勢計算為 Composable**：將 iOS 防呆等 DOM 計算邏輯提取為純 `hook` 功能 (例如封裝為 `useIOSSwipeGuard`)。
- [ ] **剝離靜態視圖配置**：將佈景與版面靜態宣告獨立為 Config (如 `src/config/navigation.js`) 或 `TabBar.vue` 子元件，維持 `App.vue` 僅作為 Layout 進入點。
- [ ] **導入 Husky + lint-staged**：強制在 Git Commit 前阻擋不符合風格或有嚴重語法錯誤的程式碼。
- [ ] **全域日誌系統替換**：移除隨意的 `console.log`，改以 Pino 或 Winston 進行不同 Log Level 等級與結構的輸出 (Log Management)。
- [ ] **替換並收斂所有原生 Fetch**：盤點所有 Provider 與 AI 客戶端，強制將 `await fetch()` 收斂為專案統一開發的 `fetchWithTimeout()` 工具函式，並預設至少 30 秒的逾期拋錯限制。
- [ ] **補強 網路底層的 Error Retry 判斷**：在 API 的 Retry Config 中，將 Node HTTP 底層噴出的連線相關 Error message (`ETIMEDOUT`, `ECONNRESET`, `fetch failed`) 皆納入自動重試白名單。
- [ ] **採用 Promise.allSettled() 重構**：將非強依賴的多路資料拉取（例如同時拉取 PE/PB 與 殖利率），改用 `Promise.allSettled()`，保留成功的部份並填入預設值，避免單點故障。

---
**📝 Memos & Next Steps:**
請 `@Planner` 將上方的【修正提案】轉換為詳細的 User Story 寫入 `draft_features.md` 以進行後續開發。
