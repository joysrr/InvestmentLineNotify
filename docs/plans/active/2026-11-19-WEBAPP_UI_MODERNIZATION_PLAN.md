---
type: plan
status: in-progress
last_updated: 2026-11-20
last_verified: 2026-11-20
progress: "階段一基線審計完成；P0/P1/P2 差異清單已產出"
tags:
  - webapp
  - uiux
  - telegram-mini-app
  - responsive
  - accessibility
summary: "承接已完成的 UI/UX 前置計畫，以 Dashboard、MacroBattle、MarketRadar、News 為深度範本，將共用能力與手機/寬屏體驗盤點及缺口修正擴展至 webapp 全站"
related_code:
  - webapp/src/views/DashboardView.vue
  - webapp/src/views/MacroBattleView.vue
  - webapp/src/views/MarketRadarView.vue
  - webapp/src/views/NewsView.vue
  - webapp/src/components/common/EmptyState.vue
  - webapp/src/components/common/ErrorAlert.vue
  - webapp/src/components/common/ErrorView.vue
  - webapp/src/components/common/LoadingSkeleton.vue
  - webapp/src/components/common/StatCard.vue
  - webapp/src/utils/formatDate.js
  - webapp/src/utils/formatters.js
  - webapp/src/styles/tokens.css
  - webapp/src/shared-styles.css
related_docs:
  - docs/design/DESIGN_PRINCIPLES.md
  - docs/design/page-responsibility-matrix.md
  - docs/design/dashboard-hierarchy.md
  - docs/design/news-ux.md
  - docs/design/freshness-semantics.md
  - docs/plans/active/2026-11-17-UIUX_OPTIMIZATION_PLAN.md
  - docs/plans/active/2026-11-19-UIUX_DECISION_EXPERIENCE_PLAN.md
wiki_links:
  - [[Telegram Mini App]]
  - [[前端 UI/UX]]
  - [[共用元件]]
  - [[響應式設計]]
---

# Telegram Mini App UI/UX 現代化與共用元件整合計畫

## 1. 目標與執行邊界

在不推翻既有 Vue 3 + Vite 架構、設計 Tokens、路由及資料契約的前提下，先以 Dashboard、MacroBattle、MarketRadar、News 四頁作為深度範本，將驗證出的共用標準與缺口修正擴展至 webapp **全站 6 個實際路由頁面**：Dashboard、Insights、Chart、News、Account、StrategyConfigEditor。其中 `/macro`、`/radar` 為 Insights 的 redirect，MacroBattleView 與 MarketRadarView 不作獨立頁面，而是納入 InsightsView 內嵌內容與元件審計，依同樣標準驗證。

本計畫是**全站現況驗證與剩餘缺口修正**，不是重新建置共用設施。前置計畫 `2026-11-17-UIUX_OPTIMIZATION_PLAN.md` 與 `2026-11-19-UIUX_DECISION_EXPERIENCE_PLAN.md` 已標示完成；不得重複實作其中已交付的導航治理、Design Tokens、EmptyState/ErrorAlert action、MainButton、HapticFeedback 或 Data Viz token。Redirect 路由不視為獨立頁面，但需驗證其目標頁與深連結相容性。

設計者提供的單頁互動 HTML 原型是**視覺與互動概念參考**，不是可直接併入產品的實作規格。其手機框架、預覽工具列、四頁導覽和示範資料只供理解呈現意圖；實際交付須映射至本專案全站六頁及既有 Vue 元件，保留真實資料流與 Telegram Mini App 操作。每個參考模式均先與現行設計原則及程式碼比對，再決定採用、調整或不採用，並在基線審計記錄依據。不得複製整份獨立 HTML/CSS 原型或建立第二套設計系統。

全站頁面清單以 `webapp/src/router/index.js` 中實際掛載 View component 的路由為準；新增或移除 View 時同步更新本計畫的盤點清單。四頁範本提供深入場景，其他頁面不可只抽查共用元件而略過各自資料、互動與 RWD。

### 技術基線

- Vue 3、Vite、Vue Router、Pinia、Element Plus、ECharts/vue-echarts。
- 原生 CSS Variables（`--iln-*`）與 Vue SFC `<style scoped>`。
- Vitest、Vue Test Utils、Playwright。

### 範圍

- **深度範本四頁（優先實作與驗證）：** `DashboardView.vue`、`MacroBattleView.vue`、`MarketRadarView.vue`、`NewsView.vue`。
- **全站推廣：以四頁驗證出的共用標準擴展至所有實際路由頁面：** `AccountView.vue`、`ChartView.vue`、`InsightsView.vue`、`StrategyConfigEditor.vue`；除各自業務邏輯外，均需套用日期/數值格式化、空/錯誤/載入降級、`.iln-page` 底部 safe-area、Element Plus 元件語意化覆寫、手機 390×844 與桌機 ≥1024px RWD。
- 共用格式化、狀態呈現、頁面容器與 Telegram WebView safe-area 行為的**使用與驗證**。
- 手機視窗基準 390×844；桌機寬屏基準至少 1024px。

### 不在範圍

- 後端 API、資料模型或投資計算邏輯變更。
- 重建已存在的 `formatDate.js`、`formatters.js`、`EmptyState.vue`、`ErrorAlert.vue`、`ErrorView.vue`、`LoadingSkeleton.vue`、`StatCard.vue`。
- 無實證問題時的純視覺重構、建立新頁面、改寫路由語義或引入新依賴。

## 2. 已有能力與整合原則

初始盤點確認下列模組已存在，執行時先檢查其實際介面、測試和呼叫點：

- 日期格式工具：`webapp/src/utils/formatDate.js`，已有 `formatDate.test.js`。
- 數值格式工具：`webapp/src/utils/formatters.js`。
- 共用狀態/版面元件：`EmptyState.vue`、`ErrorAlert.vue`、`ErrorView.vue`、`LoadingSkeleton.vue`、`StatCard.vue`。
- 設計 Tokens 與共用樣式：`styles/tokens.css`、`shared-styles.css`。

實作規則：

1. 先核對實際資料契約與現有 props/exports，再判斷是否缺功能；禁止依初版草案推定元件必須新增。
2. 優先重用現有 API。若現有工具不符合本計畫需求，先以測試證明缺口，再最小擴充並保留相容性。
3. 不在頁面重複建立日期或數值轉換；空值、無效數值統一顯示 `—`，不得露出 `NaN`、`Infinity` 或原始 ISO 時間。
4. 樣式沿用 `--iln-*` tokens；互動需保留 `:focus-visible` 與 `prefers-reduced-motion: reduce`。
5. `.iln-page` 底部 padding/safe-area 先查明 `shared-styles.css`、App 導覽列與 Telegram MainButton 實際高度，再移除重複頁面補償；不得盲目套用單一固定像素值。

## 3. 四階段交付

### 階段一：共用基線與容器審計

**目的：** 建立可驗證現況，識別已完成與真正缺口；不先改碼。

- 逐頁審查全站六個實際路由頁面的資料來源、loading/error/empty 分支與 refresh/retry 行為；四個深度範本完整追蹤狀態流，其餘頁面逐一建立同等覆蓋的基線記錄。InsightsView 內嵌的 MacroBattle、MarketRadar 內容也納入同等基線記錄。
- 審查 `formatDate.js`、`formatters.js` API 及六頁實際使用情形，盤點原始 ISO、NaN/Infinity 顯示風險。
- 審查 `.iln-page`、`shared-styles.css`、`tokens.css` 與 `DESIGN_PRINCIPLES.md` 的底部留白/間距/圓角/陰影/字級與 MainButton 的 safe-area/遮擋關係，記錄每頁各自重複留白及未對照現行設計原則的 token。同時盤點全站是否已有底部導覽列，以及缺少統一 bottom-nav 時需新增的位置與互動契約。
- 將設計者互動 HTML 原型中的版面模式（固定頁首、分段控制、分頁 Tab、卡片網格、抽屜、進度條、空狀態）逐一與現行設計原則、現有元件與 tokens 比對；記錄可採用模式、須調整模式、不得採用模式（如預覽控制列、獨立手機框架、固定紫色品牌色），不建立第二套設計系統。
- 檢查 `LoadingSkeleton`、`ErrorView` 等共用元件在六頁的使用適切性；只記錄缺口，不重建元件。
- 核對 `AccountView` 的入口/返回與帳戶操作、`ChartView` 的圖表載入/空資料/時間軸、`InsightsView` 的摘要/導覽及資訊密度（含內嵌 MacroBattle、MarketRadar 內容）、`StrategyConfigEditor` 的表單驗證/保存/取消/載入與窄屏操作。
- 產出覆蓋六頁的 P0/P1/P2 實證差異清單，標明頁面、狀態、尺寸及修正/測試範圍；確認本階段的精確改動範圍後才進入實作。

**完成門檻：** 每項候選修改均連結到具體檔案、狀態或可重現視窗問題；單純命名差異不列為 Bug。

### 階段二：P0 正確性與窄螢幕修正

#### DashboardView

- 驗證 `latestReport`、`healthData`、`status` 缺漏、載入失敗、資料逾時時，各區塊能獨立降級，重試確實呼叫既有 `loadAll`（依實際實作核對）。
- 統一時間輸出使用既有日期 formatter；缺值和非法數值顯示 `—`。

#### MacroBattleView

- 在 390px 視窗驗證 `.score-wrap`、`.score-bar-row`、多/空側標、進度條和分數不互相擠壓、不裁切；如可重現溢位，最小修正 flex/min-width 或斷點換行。

#### MarketRadarView

- 核對 `.defense-mode-badge` 與外層容器水平 padding，只有在實測邊距疊加時修正。
- 追蹤更新時間欄位來源（包含 `statusMeta` 實際契約），確保缺欄位時安全降級，不以猜測欄位名增加 fallback。
- 統一可見數值的缺值與單位呈現，避免 NaN/Infinity。

#### NewsView

- `reportNews.generatedAt` 等可見時間採既有 formatter；空值顯示 `—`。
- 檢查 `.subtab-bar` 的 `position: sticky; top: 0; z-index: 10` 在 Telegram Mini App 的捲動容器、頁首及原生 Header 下方是否正確定位；用瀏覽器實測確認遮擋後才調整 sticky 祖先、top 或層級。

#### 其餘全站頁面 P0 共通檢核

- `AccountView`、`ChartView`、`InsightsView`、`StrategyConfigEditor` 逐頁檢查日期/數值空值、載入、錯誤、無資料及窄螢幕遮擋；按頁面實際功能選取測試情境，不強加不適用的狀態。`InsightsView` 同步檢查內嵌 MacroBattle 與 MarketRadar 內容的同等狀態覆蓋。
- `ChartView` 檢查圖表容器尺寸、圖表/時間標籤缺值及載入失敗降級；`StrategyConfigEditor` 檢查表單欄位在窄屏可讀、可操作，驗證錯誤訊息不被遮擋。

### 階段三：P1/P2 體驗與版面

#### DashboardView

- 實測 freshness 過期警示與 FreshnessBadge 的首屏可見性；依既有 freshness 語義調整顯示順序，不更改資料判定。
- 收斂 `.tab-content-area`、`.cockpit-section`、`.freshness-expired-alert`、`.strategy-status-link` 間距，避免容器 gap 與子項 margin 重複。
- 驗證 MarketDetailDrawer、RiskDetailDrawer、StrategyConfigEditorView、StrategyStatusPanel 的窄螢幕開啟、關閉、捲動、焦點及與 MainButton 的互動；只修復可重現問題。

#### MacroBattleView

- 檢視 `.event-score` 對比及 BULLISH/BEARISH/NEUTRAL 圖示語義，沿用現有 Icon 與 viz tokens。
- 檢視長事件文字閱讀節奏及 ≥768px 雙欄排列；避免不必要的長文裁切。

#### MarketRadarView

- 檢查 3 欄 `.radar-grid` 在實際最小寬度的標籤換行、數值對齊與溢位；依既有斷點/元件模式調整。
- 驗證美股/台股指標的空值、單位及小數精度一致性。
- 驗證 ExtremeRadarPanel、CashExposureWidget 手機單欄及 ≥768px 雙欄間距；檢查融資餘額變化明細沿用既有卡片元件。

#### NewsView

- 對齊頁首與 safe-area 留白，核對 `.featured-note`、`.view-subtitle` 水平內距。
- 新聞池新增輕量篩選：全部、精選、台灣市場、國際總經。實作前必須驗證新聞項目現有欄位可穩定區分「精選/市場類別」；若契約不足，採可用分類且在計劃執行紀錄標明限制，不新增或推測後端欄位。
- 驗證 NewsCard 點擊觸發 `useTelegram().openLink` 的實際 URL 與互動回饋；≥1024px 檢查雙欄列表，不改變新聞排序/內容契約。

#### 其餘全站頁面 P1/P2 檢核

- `AccountView`：檢查帳戶資訊層級、圖表入口/返回操作、長內容與窄屏按鈕可用性；≥1024px 不產生不必要的空白或卡片拉伸。
- `ChartView`：檢查圖表在容器 resize、窄屏旋轉及無資料時的可讀尺寸、圖例/時間軸標籤溢位與互動提示；寬屏資訊密度和圖表比例適當。
- `InsightsView`：檢查洞察摘要層級、卡片間距、指標/日期格式與長內容閱讀；驗證導覽至詳情時狀態與返回路徑清楚。內嵌 MacroBattle、MarketRadar 內容的雙欄／單欄切換與間距需同時驗證。
- `StrategyConfigEditor`：檢查表單欄位分組、錯誤提示、保存/取消回饋與 focus 順序；窄屏可操作且不被鍵盤、底部導覽或 MainButton 遮擋。
- 上述頁面以及四個範本一律納入同一套全站頁面矩陣，依各自功能選用實際適用的驗收場景，不要求不適用的新聞篩選或抽屜行為。

### 階段四：自動化、裝置尺寸與整體回歸

- 先補/更新 Vitest：共用 formatter 邊界值、全站各頁實際適用的空/錯誤/載入狀態、新聞篩選邏輯、圖表容器狀態、表單驗證等；採 TDD RED→GREEN→REFACTOR。
- Playwright `--workers=1`：以 390×844 驗證六頁主要流程、水平溢位、底部導覽/MainButton 遮擋、頁面特有互動（drawer、sticky bar、圖表、表單）；以 ≥1024px 驗證網格、雙欄及寬屏閱讀。
- 檢查所有六頁 Console 無未處理例外，適用數值/時間欄位無 NaN/原始 ISO；驗證新聞外連與頁面特有操作。
- 執行 targeted Vitest、全站相關 E2E、完整 `npm test`（依專案測試時間與環境）、lint、`npm run build`，確認既有 bundle budget 通過。
- 實體 Telegram WebView 若無可用測試環境，只能標示為未驗證；不得以一般 Chromium 結果宣稱實機驗收。

## 4. PR / Merge 驗收 Checklist

- [ ] 設計者原型僅作概念參考；實作沿用現行 `--iln-*` tokens、品牌色與 Vue 元件，不帶入預覽工具列/手機框架/獨立 token 系統，也不照搬固定 `96px` 底部留白。
- 六個實際路由頁面均有逐頁基線與測試紀錄；適用的無資料、載入中、API 錯誤、資料逾時情境無 `NaN`、`Infinity`、原始 ISO 時間或破損圖示。InsightsView 內嵌的 MacroBattle、MarketRadar 內容同等檢核。
- [ ] 共用 formatter 與 Empty/Error/Loading 元件優先重用；無重複的日期/數值格式化實作。
- [ ] 所有新增/修改樣式使用 `--iln-*` tokens 與 Vue SFC scoped CSS；保留 `:focus-visible`、`prefers-reduced-motion`。
- 六頁在 390×844 與桌機 ≥1024px 無水平溢位、重疊或底部導覽/MainButton 遮擋；串入統一底部導覽列後各頁內容區不被遮擋；sticky bar、drawer、圖表、表單的適用行為有瀏覽器證據。
- [ ] 新聞池篩選只使用已驗證的現有資料欄位；外連透過既有 `openLink`。
- [ ] Vitest、Playwright（workers=1）、lint、production build 與 bundle budget 全數通過。
- [ ] `git diff` 僅包含核准範圍；文件/Wiki 索引驗證通過；每個可獨立驗證交付階段 commit。

## 5. 預期變更檔案（依基線審計結果調整）

- 全站頁面候選：`webapp/src/views/AccountView.vue`、`ChartView.vue`、`DashboardView.vue`、`InsightsView.vue`、`NewsView.vue`、`StrategyConfigEditor.vue`。`webapp/src/views/MacroBattleView.vue`、`webapp/src/views/MarketRadarView.vue` 僅作為 InsightsView 內嵌內容審計對象，不作獨立頁面。
- 既有共用樣式：`webapp/src/shared-styles.css`、`webapp/src/styles/tokens.css`（僅在證實共用 token/容器缺口時）。
- 既有格式工具：`webapp/src/utils/formatDate.js`、`formatters.js`（只有測試證明工具本身缺少必要邊界處理時）。
- 相關測試：`webapp/src/test/**`、`webapp/src/utils/*.test.js` 及既有 Playwright E2E 測試位置；先查既有 spec，避免重複新增。
- 文件索引：`docs/wiki-index.json`、`docs/wiki-graph.json`（依文件維護腳本實際輸出與版控規範更新）。

以上清單是候選範圍，不代表所有檔案都必須修改；不得超出本計畫所列六個實際路由頁面及其共用能力缺口範圍。

## 6. 執行與風險

- **資料契約風險：** API 欄位可能與草案命名不同。先讀真實 fixture、adapter 與測試，再指定 formatter/分類欄位。
- **Telegram WebView 差異：** sticky、safe-area、原生 Header/MainButton 行為未必可由一般瀏覽器完整代表；分開標示 Chromium 與真機證據。
- **CSS 作用域風險：** Element Plus drawer 內部樣式需透過受控 wrapper 與 `:deep()`，避免全域污染；沿用現有元件模式。
- **回歸風險：** 每個改動先寫失敗測試，再做最小修正；每階段執行 targeted 驗證並提交，完成最後整體回歸。
- **部署邊界：** 本計畫只涵蓋 repo 程式碼與測試；不宣稱或執行正式主機部署。

## 7. 進度追蹤（Todo 基準）

以下以 `- [ ]` 表示未完成、`- [x]` 表示已完成。每個階段全部勾選後，立即在本計畫更新狀態並 commit，作為進度基準；不得在階段未完成前標記下一階段。

### 階段一：共用基線與容器審計（不先改碼）

- [x] 逐頁審查六頁資料來源、loading/error/empty 分支與 refresh/retry 行為；InsightsView 內嵌 MacroBattle、MarketRadar 內容納入同等基線
- [x] 審查 formatDate.js、formatters.js API 及六頁實際使用情形；盤點原始 ISO、NaN/Infinity 顯示風險
- [x] 審查 .iln-page、shared-styles.css、tokens.css 與 Design Principles 的底部留白/間距/圓角/陰影/字級與 MainButton safe-area 關係
- [x] 盤點全站是否已有底部導覽列，以及缺少統一 bottom-nav 時需新增的位置與互動契約
- [x] 將設計者原型版面模式與現行設計原則、現有元件、tokens 比對；記錄可採用/須調整/不得採用
- [x] 檢查 LoadingSkeleton、ErrorView 等共用元件在六頁的使用適切性；只記錄缺口，不重建元件
- [x] 核對 AccountView、ChartView、InsightsView（含內嵌 MacroBattle、MarketRadar）、StrategyConfigEditor 的各項操作與窄屏行為
- [x] 產出覆蓋六頁的 P0/P1/P2 實證差異清單；確認精確改動範圍後方進入階段二

#### 階段一實證差異清單（2026-11-20）

盤點範圍：六個 router component（Dashboard、Insights、Chart、News、Account、StrategyConfigEditor）及 Insights 內嵌 MacroBattle、MarketRadar；已核對 `router/index.js`、`App.vue`、`FloatingPill.vue`、tokens/shared styles、formatter utilities 與各 View。

- **P0 — 共用底部留白衝突：** `App.vue` 已按實測 `--bottom-nav-height` 與 `--tg-safe-bottom` 預留 `.app-main` 底部空間；`FloatingPill.vue` 透過 ResizeObserver 量測導覽 pill 高度。另一方面 `InsightsView.vue`、`NewsView.vue`、`MacroBattleView.vue`、`MarketRadarView.vue` 各自仍有 `112px` 固定底部 padding（MarketRadar 使用 `.view-container`），與 App shell 補償重複；其餘頁面使用 `.iln-page` / scoped padding 不一致。階段二/三先逐頁實測後最小移除重複值，必須保留動態 Telegram safe-area 與 App shell 導覽預留。
- **P0 — 目前導覽已存在，非新增導覽：** `FloatingPill` 是全域浮動底部導覽，採 `tabsConfig.js` 路由契約、Telegram safe-area/viewport 定位和動態高度量測。故原計畫「缺少統一 bottom-nav 時需新增」不適用；後續範圍改為驗證既有導覽與 MainButton 共存、尺寸遮擋，不再新增第二套導覽元件。
- **P1 — Formatter 使用不一致：** `formatDate.js` 已提供 `formatRelative`、`resolveLastRun` 等日期工具；`formatters.js` 提供數值處理工具。Dashboard、Radar 部分欄位已使用日期工具，但多個 View 仍可見直接 `toFixed`、`toLocaleString`、`new Date().toLocaleDateString`、ISO substring/直出路徑，存在無效數值或日期格式不一致風險；階段二按可見輸出逐項驗證，非全檔機械替換。
- **P1 — 狀態降級差異：** Radar 有 loading skeleton、ErrorView retry，Insights 依 tab 顯示嵌入內容；StrategyConfigEditor 以 ElMessage 呈現載入失敗但未見頁面級重試狀態；Chart/Account/Dashboard/News 需針對各 API 區塊再以測試/瀏覽器核對錯誤與空資料可見性。不得臆造無意義的 empty state。
- **P1 — 行動版與窄屏待實測：** 已有 375px RWD E2E 覆蓋 Dashboard 橫向溢位與 `.floating-pill` 可見性，但未覆蓋計畫規定的 390×844 六頁、底部導覽/MainButton 交疊與 ≥1024px 寬屏；Account/Chart/Config 的複合操作、圖表標籤及表單鍵盤仍須瀏覽器驗證。
- **P1 — 內嵌雷達佈局：** `MarketRadarView.vue` 的 `.radar-grid` 預設三欄、768px 起總覽雙欄；需在 390px 驗證卡片文字與數值可讀，不因僅有宣告便視為適配完成。MacroBattle 的分數列也待 390px 實測。
- **P2 — 原型映射：** 可採用固定頁首（需服從 Telegram scroll container）、分段控制/Tab（沿用現有 Insights tabs）、卡片網格、輕量進度指示及共用空狀態；需調整 sticky 頁首/News 篩選的 top 與 z-index、抽屜關閉/焦點與 Telegram BackButton、卡片網格斷點；不採用預覽工具列、獨立手機框架、示範假資料、獨立紫色 token 或固定 `96px` 導覽補償。
- **P1 — 元件重用：** `LoadingSkeleton`、`ErrorView`、`StatCard` 等既有共用元件已被部分頁面重用，階段二沿用；不重建同功能元件。其餘頁面是否需要空狀態依資料契約與頁面實際狀態再決定。

**範圍決議：** News 篩選候選欄位尚未與 `newsMatch.js`/API fixture 完成契約核實，階段三開始前先讀契約和現有測試；不先決定分類欄位或新增後端欄位。現有 BottomNav 已全域提供，計畫中階段一新增導覽的建議不適用，後續只做遮擋/安全區驗證。階段二先針對可重現問題做 TDD；在受限檔案是否可修改未釐清前，不修改 Vue 業務邏輯、`tokens.css`、lint guard 或 workflow。階段一為唯讀審計，未執行 CSS/瀏覽器尺寸驗收，故本清單將待實測項目明確列為未驗證而非已通過。

**驗收證據：** 已讀取 `src/router/index.js`、`App.vue`、`FloatingPill.vue`、`styles/tokens.css`、`shared-styles.css`、`formatDate.js`、`formatters.js`、六頁路由 View 與 MacroBattle/MarketRadar 內嵌 View；確認 `01-mobile-rwd.spec.js` 現有 viewport 為 375×667，只覆蓋 Dashboard overflow 及 FloatingPill 顯示。此階段不改產品程式碼、不宣稱完成 390×844 / ≥1024px 瀏覽器驗收。

#### 階段一驗收狀態

- 基線審計完成；待實測候選項明確保留至階段二、三、四相應驗收，不冒稱已通過。
- 無需使用者確認的資料契約或範圍決策；繼續階段二。

### 階段二：P0 正確性與窄螢幕修正

- [x] DashboardView：latestReport、healthData、status 缺漏/載入失敗/資料逾時降級與重試；時間輸出統一使用日期 formatter；缺值顯示 `—`（已提交，formatters/formatDate 單測通過）
- [x] MacroBattleView：390px 視窗 .score-wrap、.score-bar-row 不擠壓/裁切；如重現溢位，最小修正 flex/min-width 或斷點換行（E2E 2/2，390×844 已驗）
- [x] MarketRadarView：.defense-mode-badge 與外層容器水平 padding 僅在實測邊距疊加時修正；追蹤更新時間欄位來源並安全降級；可見數值缺值與單位（NaN/Infinity 安全兜底，專屬測試通過）
- [x] NewsView：reportNews.generatedAt 等可見時間採既有 formatter；檢查 .subtab-bar sticky 定位與 Telegram Mini App 遮擋（10/10 單測，E2E NWS-004 sticky 實測通過）
- [x] 其餘頁面 P0：AccountView、ChartView、InsightsView、StrategyConfigEditor 逐頁空值/載入/錯誤/無資料/窄螢幕遮擋；InsightsView 同步檢查內嵌內容（Account E2E ACC-003 窄屏無溢位，StrategyConfigEditor 載入錯誤可重試 14/14）

### 階段三：P1/P2 體驗與版面

- [ ] DashboardView：freshness 過期警示與 FreshnessBadge 首屏可見性；收斂 `.tab-content-area`、`.cockpit-section` 等間距；抽屜窄螢幕開啟/關閉/焦點
- [ ] MacroBattleView：event-score 對比與 BULLISH/BEARISH/NEUTRAL 圖示語義；長事件文字閱讀節奏與 ≥768px 雙欄
- [ ] MarketRadarView：3 欄 .radar-grid 標籤換行/數值對齊；空值/單位/小數精度；ExtremeRadarPanel、CashExposureWidget 單欄/雙欄間距
- [ ] NewsView：頁首與 safe-area 留白；新聞池輕量篩選（先驗證現有欄位）；NewsCard openLink；≥1024px 雙欄
- [ ] 其餘頁面 P1/P2：AccountView、ChartView、InsightsView 內嵌 MacroBattle/MarketRadar 雙欄/單欄切換、StrategyConfigEditor

### 階段四：自動化、裝置尺寸與整體回歸

- [ ] Vitest：formatter 邊界值、各頁空/錯誤/載入狀態、新聞篩選邏輯、圖表容器狀態、表單驗證（TDD RED→GREEN→REFACTOR）
- [ ] Playwright --workers=1：390×844 六頁主要流程、水平溢位、底部導覽/MainButton 遮擋；≥1024px 網格、雙欄與寬屏閱讀
- [ ] Console 無未處理例外；數值/時間欄位無 NaN/原始 ISO；驗證新聞外連與頁面特有操作
- [ ] 執行 targeted Vitest、E2E、完整 npm test、lint、npm run build；確認 bundle budget
- [ ] 實體 Telegram WebView 若無環境，標示為未驗證；不以一般 Chromium 結果宣稱實機驗收

### PR / Merge 驗收 Checklist

- [ ] 設計者原型僅作概念參考；不帶入預覽工具列/手機框架/獨立 token 系統，不照搬固定 96px 底部留白
- [ ] 六個實際路由頁面均有逐頁基線與測試紀錄；InsightsView 內嵌內容同等檢核；無 NaN/Infinity/原始 ISO/破損圖示
- [ ] 共用 formatter 與 Empty/Error/Loading 元件優先重用；無重複日期/數值格式化實作
- [ ] 新增/修改樣式使用 --iln-* tokens 與 Vue SFC scoped CSS；保留 :focus-visible、prefers-reduced-motion
- [ ] 六頁在 390×844 與 ≥1024px 無溢位/重疊/遮擋；串入統一底部導覽後內容區不被遮擋
- [ ] 新聞池篩選只使用已驗證現有資料欄位；外連透過既有 openLink
- [ ] Vitest、Playwright (workers=1)、lint、production build 與 bundle budget 全數通過
- [ ] git diff 僅包含核准範圍；文件/Wiki 索引驗證通過；每階段 commit
