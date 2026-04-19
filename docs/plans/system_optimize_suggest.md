身為系統架構師，針對 InvestmentLineNotify 這個專案（包含 Node.js 後端核心與 Vue 3 建立的 Telegram Mini App 前端），我已經進行了系統架構、程式碼邏輯與風格的綜合分析。  
這是一個具備高度領域知識的系統，將量化交易策略（0050/00675L）、AI 摘要與 Telegram 通知進行了良好的整合。架構上採用「無傳統資料庫（File-based / Google Sheets）」輕量化設計，適合個人或小團隊的自動化投資監控。  
以下是為您整理的 **Code Review 與架構優化分析報告**：

### ---

**一、 系統架構總評 (Overall Architecture Assessment)**

1. **優點**：  
   * **清晰的層級劃分**：系統明確區分了 Entry Layer (Cron/Bot)、API Layer (Fastify)、Decision Layer (Strategy Engine) 與 Frontend Layer，符合關注點分離 (SoC)。  
   * **安全性防護到位**：Telegram Bot 有 adminGuard，Fastify API 有 initDataGuard，確保系統只有白名單授權者可操作與存取資料。  
   * **非同步設計與鎖定機制**：考慮到 File-based 的特性，使用了 runnerLock 來防止排程 (Cron) 與指令 (Bot) 同時執行造成的 IO 競爭，這點設計非常周到。  
2. **潛在隱憂**：  
   * **檔案系統與狀態一致性**：高度依賴檔案（如 latest.json, Strategy.json）作為資料交換與儲存的媒介。當 API Server 面對前端的頻繁請求時，File I/O 可能成為效能瓶頸或產生資料不一致的問題。  
   * **神控物件 (God Object) 傾向**：strategyEngine.mjs 承載了過多職責，既要負責狀態機判斷，又要算分數、過濾進場門檻，擴充性會隨業務複雜度下降。

### ---

**二、 具體優化建議與實作方向 (Actionable Recommendations)**

#### **1\. 後端與策略引擎層 (Backend & Strategy Engine)**

* **優化項目：拆解 strategyEngine.mjs 中的純邏輯判斷**  
  * **原因**：目前 strategyEngine.mjs 混合了「流程編排 (Orchestration)」與「業務規則 (Business Rules)」。例如 getMarginLayer（四層維持率判斷）、resolveEntryGate（進場門檻邏輯）這些屬於純函數 (Pure Function)，放在主引擎中會讓檔案過於肥大，不利於單元測試 (Unit Test)。  
  * **建議作法**：將這些決策邏輯抽取至 src/modules/strategy/policies/（例如 marginPolicy.mjs, entryPolicy.mjs）。strategyEngine 只負責呼叫 Policy 拿結果並往下傳遞，達成真正的「控制與邏輯分離」。  
* **優化項目：引入強型別配置校驗 (Schema Validation)**  
  * **原因**：根據 maintenance-state-machine.md，很多策略參數需要「手動修改」Strategy.json。目前依賴 fetchStrategyLocal 讀取並只用簡單的 validateStrategyConfig。一旦使用者 JSON 格式寫錯或漏填欄位（例如漏了 frozenZone），可能導致系統在 Runtime 報錯斷頭。  
  * **建議作法**：引入 Zod 或 Joi 套件。建立嚴格的 Strategy Schema，當讀取到無效或缺失欄位時，系統自動套用安全預設值 (Safe Defaults) 並發送 TG 警告，而非讓系統崩潰。  
* **優化項目：魔術數字 (Magic Numbers) 集中管理**  
  * **原因**：在 strategyEngine.mjs 與 marginManager.mjs 中，可以看到許多預設值硬編碼（如 135, 145, 160, 35, 28 等）。  
  * **建議作法**：建立一個統一的 constants/strategyDefaults.mjs，將預設值作為常數匯出，提升程式碼可讀性，未來調整預設值時也只需修改一處。

#### **2\. 前端架構與程式碼風格 (Frontend / WebApp)**

* **優化項目：重構 API Retry 與非同步狀態管理**  
  * **原因**：在 webapp/src/api/index.js 中，您手刻了 apiFetch 搭配 for 迴圈的 Retry 延遲機制。其中有一段邏輯判斷 if (res.status \=== 401 && attempt \< maxRetries) 進行 Retry。但若是 401（Telegram 授權過期或無效），Retry 多次通常也是失敗，徒增等待時間。  
  * **建議作法**：  
    1. 針對 401 應直接 throw Error 並跳出迴圈，或引導使用者關閉重開 Mini App。  
    2. 建議引入 @tanstack/vue-query 或 @vueuse/core (useFetch)。它們內建完美的快取、Retry、防抖 (Debounce) 機制，能大幅簡化 apiFetch 的實作，也能輕易綁定到 Vue 3 組件的 Loading 狀態中。  
* **優化項目：UI 手勢邏輯與視圖層分離 (Custom Composables)**  
  * **原因**：在 App.vue 的 onMounted 內寫了一大堆計算觸控座標 (onTouchStart, onTouchMove) 來阻擋 iOS 邊緣手勢。這違反了 Vue 3 Composition API 的精神，將 DOM 操作與元件層混合在一起。  
  * **建議作法**：抽離成獨立的 Composable 函數，如 useIOSSwipeGuard.js：  
    JavaScript  
    // 在 useIOSSwipeGuard.js 中封裝  
    export function useIOSSwipeGuard(targetRef) {  
       // 將 touchStart / touchMove 邏輯放此  
    }  
    // App.vue 只需要：  
    useIOSSwipeGuard(tabBarRef)

* **優化項目：靜態配置分離**  
  * **原因**：App.vue 底部有一大包 tabs 陣列（包含又長又複雜的 SVG 程式碼），佔據了組件的大部分版面。  
  * **建議作法**：將 tabs 配置移至獨立的 src/config/navigation.js 或是封裝成獨立的 TabBar.vue 組件傳入 props，讓 App.vue 保持單純的 Layout 進入點角色。

#### **3\. 基礎設施與效能 (Infrastructure & Performance)**

* **優化項目：讀取效能與 API Layer 的快取機制**  
  * **原因**：Fastify Server 目前作為唯讀 API 提供前端資料，底層疑似是讀取 data/ 下的 JSON 檔案。如果前端在短時間內切換多個 Tabs 觸發多個 /api/...，會造成頻繁的檔案 I/O 操作。  
  * **建議作法**：在 Fastify 中實作簡單的 In-Memory Cache（記憶體快取），針對 latest.json 或報告資料，設定 5\~10 秒的 TTL (Time-To-Live)。如果檔案未被 Runner 更新，API 請求就直接返回記憶體中的舊資料，完全避免讀檔損耗。

### **總結**

這是一套邏輯嚴謹且完成度極高的專案，在設計上非常有「防禦性思維」（如各種 fallback 數值、防併發 Lock）。接下來的優化重點不在於增加新功能，而在於\*\*「模組邊界的清晰化」**與**「狀態、配置的解耦」\*\*，這將大幅提升未來您引進更多投資策略或指標時的系統擴充性。