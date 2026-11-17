---
type: plan
status: active
last_updated: 2026-11-17
last_verified: 2026-11-17
progress: "P0 已完成 / P1 進行中 / P2 未開始 / P3 未開始"
tags:
  - uiux
  - navigation
  - icons
  - responsive
summary: "前端 UI/UX 三阶段优化：链接与 Tab 治理、图标体系多样化、宽屏布局利用率提升"
related_code:
  - webapp/src/router/index.js
  - webapp/src/components/radar/RadarSubtabs.vue
  - webapp/src/components/common/SubTabBar.vue
  - webapp/src/views/InsightsView.vue
  - webapp/src/views/ChartView.vue
  - webapp/src/views/StrategyConfigEditor.vue
  - webapp/src/components/common/icon-registry.js
  - webapp/src/components/common/Icon.vue
  - webapp/src/config/tabsConfig.js
  - webapp/src/styles/tokens.css
  - webapp/src/shared-styles.css
  - webapp/src/stores/navigationStore.js
related_docs:
  - docs/design/DESIGN_PRINCIPLES.md
  - docs/design/page-responsibility-matrix.md
  - docs/design/insights-ux.md
  - docs/design/chart-ux.md
wiki_links:
  - [[前端導航]]
  - [[圖標系統]]
  - [[響應式佈局]]
---

# UI/UX 優化計畫（2026-11-17）

> **版本**：v1.0
> **狀態**：📋 待執行
> **範圍**：`webapp/`（Vue 3 + Vite + Element Plus，Telegram Mini App）
> **不改動**：API 契約、資料模型、後端邏輯、路由的 `redirect` 語義（僅調整引用方式）

---

## 1. 背景與目標

目前前端存在三類體驗債務：

1. **導航冗餘**：同一組 `tablist` 在 3 個頁面重複渲染，且其連結指向 `redirect` 路由，點擊後整頁跳走，與「頁內切換」的直覺相反；另有單按鈕的假 Tab、死代碼 store。
2. **圖標單一**：`neutral`（通用圓圈）被使用 **32 次**，`chart` 13 次，圖標不承載語義；且存在 2 個實際 Bug（SVG path 損壞、`xs` 尺寸失效）。
3. **寬度浪費**：僅 Dashboard 有 `max-width: 600px`，其餘頁面全寬拉伸；卡片流在平板 / 折疊屏 / 桌面 Telegram 中呈單列長條，畫面空洞。

**目標**：頁面內切換一律用「頁內控件」，消除跨頁 Tab；圖標語義化；內容區在寬屏下自適應多列填充。

---

## 2. 現狀審計

### 2.1 導航與連結清單

| # | 位置 | 現況 | 判定 | 處置 |
|---|------|------|------|------|
| 1 | `components/radar/RadarSubtabs.vue` | 3 個 `router-link` → `/radar` `/macro` `/technical` | **重複 ×3 + 失效語義** | **刪除組件**，3 處引用一併移除 |
| 2 | `views/MarketRadarView.vue:19` | `<RadarSubtabs />` | 重複 | 移除 |
| 3 | `views/MacroBattleView.vue:10` | `<RadarSubtabs />` | 重複 | 移除 |
| 4 | `components/chart/TechnicalPanel.vue:12` | `<RadarSubtabs />` | 重複 | 移除 |
| 5 | `views/ChartView.vue:11-17` | `.chart-tabs` 僅 1 個按鈕「資產趨勢」 | **假 Tab** | 刪除整段 |
| 6 | `views/ChartView.vue:4-8` | `SubTabBar`（圖表 / 技術指標） | 有效但樣式為裸 Tab | **保留功能，改為 Segmented 控件** |
| 7 | `views/InsightsView.vue:3-7` | `SubTabBar`（市場雷達 / 多空對決） | 有效但同上 | **保留功能，改為 Segmented 控件** |
| 8 | `views/StrategyConfigEditor.vue:64,79` | 雙層 `role=tablist`（Primary + Secondary） | 層級過重 | **合併為單層分組 Chip + 分組標題** |
| 9 | `router/index.js:36,42,48,58,65,68` | `/technical` `/radar` `/macro` `/theory` `/strategy-status` 為 redirect | **保留**（外部深鏈兼容） | 不動路由，只改內部引用 |
| 10 | `views/DashboardView.vue:87` | `to="/radar"`（走 redirect） | 間接連結 | 改為 `to="/insights?tab=radar"` |
| 11 | `components/dashboard/MarketDetailDrawer.vue:72` | `to="/radar"` | 間接連結 | 改為 `to="/insights?tab=radar"` |
| 12 | `views/AccountView.vue:63` | `to="/strategy-config"` | 有效 | 保留 |
| 13 | `views/AccountView.vue:133`、`DecisionHero.vue:36` | `to="/chart"` | 有效 | 保留 |
| 14 | `stores/navigationStore.js` | `useNavigationStore` **0 引用** | **死代碼** | 刪除檔案 |
| 15 | `components/radar/RadarSubtabs.vue:7,15,23` | `aria-selected="false"` 寫死 | a11y 錯誤 | 隨組件刪除 |
| 16 | `config/tabsConfig.js` | 內聯 SVG 字符串（第 2 套圖標系統） | 重複體系 | **P2**：遷移至 `icon-registry` |
| 17 | `router/index.js` `viewLoaders` 導出 | 無引用 | 疑似死代碼 | 本次確認後刪除 |

> **重複保留原則**：同一功能只保留「頁內控件」一個入口；`redirect` 路由保留作為**外部/深鏈兼容層**，不再被內部組件直接引用。

### 2.2 圖標使用分布（實測）

| 圖標 | 次數 | 語義問題 |
|------|------|----------|
| `neutral` | 32 | 通用圓圈，不承載任何語義 |
| `chart` | 13 | 可接受，但被用於非圖表場景 |
| `shield` | 8 | 可接受 |
| `danger` | 8 | 可接受 |
| `info` | 7 | 部分場景應為更具體圖標 |
| `radar` | 4 | 可接受 |
| `ok` | 4 | 可接受 |
| `trigger` | 3 | 可接受 |
| `chevron-down` | 3 | 可接受 |
| `warn` | 2 | 可接受 |
| `settings` | 1 | **渲染異常（path 損壞）** |
| `clock` | 1 | 可接受 |

### 2.3 圖標 Bug

| 檔案 | 問題 |
|------|------|
| `icon-registry.js` `SETTINGS_PATH` | path 字符串損壞（`-.08-.47 0 .59-.22`），齒輪渲染異常 |
| `Icon.vue` `SIZE_MAP` | 缺 `xs`，但 `TechnicalPanel.vue:44` 使用 `size="xs"` → 輸出 `width="xs"`，SVG 尺寸失效 |
| `Icon.vue` `iconData` | 未知名稱 fallback 到 `neutral`，掩蓋了拼寫錯誤 |

### 2.4 寬度現況

| 檔案 | 規則 | 問題 |
|------|------|------|
| `views/DashboardView.vue:482` | `max-width: 600px` | 唯一有約束的頁面，且硬編碼 |
| `shared-styles.css` `.iln-page` | 無 `max-width` | 全寬拉伸 |
| `views/StrategyConfigEditor.vue:392` | `max-width: 900px` | 硬編碼，與上者不一致 |
| 其餘 6 個頁面 | 100% 拉伸 | 卡片單列，寬屏空洞 |

---

## 3. 任務一 · 連結與 Tab 治理

### 3.1 新增統一控件 `SegmentedControl.vue`

**路徑**：`webapp/src/components/common/SegmentedControl.vue`

**規格**：
- Props：`modelValue`、`options: [{value,label,icon?}]`、`size: 'sm'|'md'`
- 樣式：膠囊底 `--iln-secondary-bg`，選中項 `--iln-bg` + `--iln-brand` 文字 + `--iln-shadow-1`
- 觸控高度 ≥ `--iln-touch-min`（44px）
- `role="radiogroup"` + `role="radio"` + `aria-checked`（**不用 tablist**，因為它是篩選器不是頁籤）
- 鍵盤：左右箭頭切換、Home/End 跳首尾
- 動效：`transform: scale(.97)` 按下態，尊重 `prefers-reduced-motion`

### 3.2 替換與刪除清單

| 動作 | 檔案 | 說明 |
|------|------|------|
| 刪除 | `components/radar/RadarSubtabs.vue` | 整個檔案（重複 ×3） |
| 刪除 | `components/common/SubTabBar.vue` + `.test.js` | 由 SegmentedControl 取代 |
| 刪除 | `stores/navigationStore.js` | 死代碼，0 引用 |
| 刪除 | `ChartView.vue` `.chart-tabs` 區塊（L11-17）及對應 CSS | 單按鈕假 Tab |
| 修改 | `MarketRadarView.vue` | 移除 `<RadarSubtabs />` 與 import，加返回膠囊 |
| 修改 | `MacroBattleView.vue` | 同上 |
| 修改 | `components/chart/TechnicalPanel.vue` | 移除 `<RadarSubtabs />` 與 import |
| 修改 | `InsightsView.vue` | `SubTabBar` → `SegmentedControl` |
| 修改 | `ChartView.vue` | `SubTabBar` → `SegmentedControl` |
| 修改 | `StrategyConfigEditor.vue` | 雙層 tablist → 單層分組 Chip |
| 修改 | `DashboardView.vue:87` | `to="/radar"` → `to="/insights?tab=radar"` |
| 修改 | `MarketDetailDrawer.vue:72` | 同上 |
| 保留 | `router/index.js` 全部 redirect | 外部深鏈兼容層，不動 |

### 3.3 頁內導航補充（替代被刪的跨頁 Tab）

在 3 個子頁面標題列右側放「返回膠囊」：

| 頁面 | 按鈕文字 | 目標 |
|------|----------|------|
| `MarketRadarView` | `洞察 · 市場雷達` | `/insights?tab=radar` |
| `MacroBattleView` | `洞察 · 多空對決` | `/insights?tab=macro` |
| `TechnicalPanel` | `圖表 · 技術指標` | `/chart?tab=technical` |

樣式：`Icon name="arrow-left"`（size `sm`）+ 文字，`--iln-radius-full`，`min-height: 36px`，`--iln-surface-alt` 底。

### 3.4 驗收

- [ ] `grep -rn "RadarSubtabs\|SubTabBar\|useNavigationStore" webapp/src` 為 0 結果
- [ ] 全站 `role="tablist"` 僅剩 0 處（全改為 `radiogroup`）
- [ ] 頁內切換只用 `router.replace`，不新增歷史記錄
- [ ] 瀏覽器返回鍵回到上一頁而非上一個 tab

---

## 4. 任務二 · 圖標多樣化


### 4.1 先修 Bug

**Bug 1 · `icon-registry.js` 的 `SETTINGS_PATH`**
現值中間有一段 `-.08-.47 0 .59-.22`，路徑指令非法，齒輪渲染成殘缺圖形。
處置：整條 path 換成標準 Material Symbols `settings` 幾何（24×24 viewBox），
新 path 先在 `Icon.test.js` 加一個「path 以 M 開頭且不含連續非法指令」的守護斷言。

**Bug 2 · `Icon.vue` 的 `SIZE_MAP` 缺 `xs`**
現值只有 sm/md/lg/xl，而 `TechnicalPanel.vue` 使用 `size="xs"`，
導致 `resolvedSize` 回傳字串 "xs"，SVG 輸出 `width="xs"` → 尺寸失效。

處置：
- `SIZE_MAP` 補 `xs: "12"`
- `resolvedSize` 的 fallback 由 `String(props.size)` 改為 `"20"`，
  未知尺寸不再直出到 DOM
- 新增 `IconSize.test.js`：斷言 xs→12、sm→16、md→20、lg→24、xl→32、未知→20

### 4.2 新增圖標集（30 個，實測去重後）

全部採 24×24 viewBox、`fill="currentColor"`，在 `ICON_MAP` 註冊，`ICON_NAMES` 自動導出。

| 分類 | 圖標名 |
|------|--------|
| 方向 / 趨勢 | `trending-up`、`trending-down`、`arrow-left`、`arrow-right`、`chevron-right`、`chevron-up` |
| 市場語義 | `bull`、`bear`、`candlestick`、`percent`、`coins`、`bank`、`wallet-outline` |
| 狀態 / 操作 | `refresh`、`download`、`upload`、`copy`、`external-link`、`filter`、`close`、`plus`、`edit`、`trash` |
| 資訊 / 分析 | `gauge`、`target`、`flame`、`layers`、`activity`、`calendar`、`pie-chart`、`bar-chart` |

> 數量說明：上表 **30 個全部納入 P2 執行**，不再標「選做」。分兩批落地便於中途驗證 ——
> 首批 13 個（方向 + 市場語義）用於替換 `neutral`；次批 17 個（操作 + 分析）用於按鈕與卡片標題語義化。
> 兩批皆為 P2 必做項，完成後 P2 才算結案。

### 4.3 `neutral` 替換映射（32 處）

| 使用場景 | 檔案 | 改為 |
|----------|------|------|
| 看多 / 上漲 | `MacroBattleView`、`MarketRadarView` | `trending-up` |
| 看空 / 下跌 | 同上 | `trending-down` |
| 中性觀望 / 無方向 | `MacroBattleView` | `minus` |
| 市場總覽入口 | `DashboardView:87` | `radar` |
| 總經卡片標題 | `MacroBattleView:4` | `gauge` |
| 情緒 / 熱度 | `SocialSentimentCard` | `flame` |
| 資金 / 曝險 | `CashExposureWidget` | `coins` |
| 其餘無法歸類 | — | 暫用 `info`，再逐個語義化 |

**執行方式**：先 `grep -rn 'name="neutral"' webapp/src` 產出完整 32 行清單，
逐檔改；每改 5 處跑一次 `npm --prefix webapp run test -- IconUsage`。

### 4.4 驗收

- [ ] `grep -rc 'name="neutral"' webapp/src` 總數 ≤ 5，且僅限真正中性語義
- [ ] `IconUsage.test.js` 通過（所有 name 存在於 registry）
- [ ] 新增 `IconSize.test.js` 通過（xs→12，未知→20）
- [ ] `SETTINGS_PATH` 渲染為完整齒輪（截圖目視）
- [ ] 抽查 8 個頁面，無「通用圓圈」殘留

---

## 5. 任務三 · 寬度利用與佈局

### 5.1 容器規範（改 `tokens.css`）

在 `:root` 新增三個變數：

| 變數 | 值 | 用途 |
|------|-----|------|
| `--iln-content-max` | `720px` | 手機 / 平板內容上限 |
| `--iln-content-max-wide` | `1080px` | 寬屏（≥1024px）上限 |
| `--iln-grid-gap` | `var(--iln-space-4)` | 柵格間距 |

`shared-styles.css` 的 `.iln-page` 改為：寬度 100%、`max-width: var(--iln-content-max)`、
`margin-inline: auto`、`padding-inline: var(--iln-space-4)`；
在 `@media (min-width: 1024px)` 下把 `max-width` 提升為 `--iln-content-max-wide`。

### 5.2 響應式卡片柵格（新增工具類）

在 `shared-styles.css` 追加 `.iln-grid` 系列：

- `.iln-grid`：`display: grid`、`gap: var(--iln-grid-gap)`、預設 `grid-template-columns: 1fr`
- `@media (min-width: 768px)` 下 `.iln-grid--2` 為 `repeat(2, minmax(0, 1fr))`
- `@media (min-width: 1024px)` 下 `.iln-grid--3` 為 `repeat(3, minmax(0, 1fr))`
- `.iln-grid__full`：`grid-column: 1 / -1`，供 Hero 區跨列使用

**關鍵**：所有列寬必須用 `minmax(0, 1fr)`，避免長文字把柵格撐破。

### 5.3 逐頁應用

| 頁面 | 改動 |
|------|------|
| `DashboardView` | 刪硬編碼 `max-width:600px`，改用 token；卡片流套 `.iln-grid.iln-grid--2`；`DecisionHero` 加 `.iln-grid__full` |
| `InsightsView` | 兩個子面板各用 `.iln-grid--2` |
| `MarketRadarView` | `ExtremeRadarPanel` + `CashExposureWidget` 在 ≥768px 並排 |
| `MacroBattleView` | 多空左右條改為兩張卡片，≥768px 並排 |
| `NewsView` | 列表 ≥1024px 轉 2 列 |
| `AccountView` | 設定分組 ≥768px 轉 2 列 |
| `ChartView` | 圖表容器 `min-height: 360px`；摘要卡片 `.iln-grid--2` |
| `TechnicalPanel` | 指標卡片 `.iln-grid--3`（≥1024px） |
| `StrategyConfigEditor` | `max-width:900px` 改為 `var(--iln-content-max)` |

### 5.4 消除「空洞」的四個手段

1. **不再全寬拉伸**：內容居中於 720 / 1080px，避免超寬屏一行文字橫跨 1600px。
2. **多列填充**：小卡片（指標、摘要、設定項）在寬屏自動多列，縮短頁面總長。
3. **Hero 跨列**：`DecisionHero`、`page-header` 用 `grid-column: 1 / -1` 保持視覺錨點。
4. **最小高度**：圖表 / 雷達可視化設 `min-height`，避免寬屏下扁平成線。

### 5.5 驗收

- [ ] 375 / 768 / 1024 / 1440 四斷點截圖，內容區無「單列細長 + 大片留白」
- [ ] 內容寬度不超過 token 定義值（用 DevTools 量 `.iln-page` 的 computed width）
- [ ] 橫向無滾動條：`document.documentElement.scrollWidth <= window.innerWidth`
- [ ] `npm --prefix webapp run ui:verify:pixel` 差異在閾值內

---

## 6. 執行順序與估時

| 階段 | 內容 | 預估 | 依賴 |
|------|------|------|------|
| P0 | 修 2 個 Icon Bug（SETTINGS_PATH、xs 尺寸） | 0.5h | — |
| P1 | 刪 RadarSubtabs / SubTabBar / navigationStore / 假 Tab | 2h | — |
| P1 | 新增 SegmentedControl 並接入 Insights / Chart | 2h | P1 刪除 |
| P1 | StrategyConfigEditor 雙層 Tab 收斂 | 1.5h | SegmentedControl |
| P1 | 修正 2 處 `to="/radar"` | 0.2h | — |
| P2 | 新增 13 個方向/市場圖標 + `neutral` 替換 | 3h | P0 |
| P2 | 剩餘 17 個操作/分析圖標 | 1.5h | P2 首批 |
| P2 | `tabsConfig` 內聯 SVG 遷移 | 1h | P2 圖標 |
| P3 | 容器 token + `.iln-grid` 工具類 | 1h | — |
| P3 | 9 個頁面逐一套用柵格 | 4h | P3 工具類 |
| P4 | 全量驗證 + 截圖比對 + 文件回寫 | 2h | 全部 |

**合計約 18.7h**。建議先交付 P0 + P1（約 6.2h），體驗改善最明顯。

---

## 7. 驗證清單


### 7.1 靜態與單元

依序執行：webapp 目錄下 `npm run lint`、`npm run lint:colors`、`npm run test`。

### 7.2 E2E 與像素

依序執行：`npm run test:e2e`、`npm run ui:verify:pixel`、`npm run build`。

### 7.3 人工檢查

- [ ] Telegram 內開啟，5 個底部導航切換正常，返回鍵正確
- [ ] 洞察頁切換「市場雷達 / 多空對決」不刷新頁面
- [ ] 圖表頁切換「圖表 / 技術指標」不刷新頁面
- [ ] 策略設定分組切換不需兩層點擊
- [ ] 深色模式下所有新圖標對比度 ≥ 3:1
- [ ] 折疊屏展開（≥768px）卡片為 2 列

---

## 8. 風險與回滾

| 風險 | 影響 | 緩解 |
|------|------|------|
| 刪 RadarSubtabs 後子頁無返回入口 | 用戶迷路 | P1 同步加「返回膠囊」按鈕 |
| 外部深鏈依賴 /radar 等 redirect | 404 | 保留全部 redirect 路由，只改內部引用 |
| E2E 選擇器依賴 role=tablist | 測試失敗 | 12-strategyConfig.spec.js 改抓 data-testid="section-groups" |
| 柵格改動導致卡片溢出 | 佈局破損 | 所有 grid 用 minmax(0, 1fr) |
| 圖標 path 手寫出錯 | 顯示異常 | 統一從 Material Symbols 複製，逐個目視驗證 |

**回滾**：每階段獨立 commit，訊息前綴 `uiux(p0):` `uiux(p1):` 等，可單獨 revert。

---

## 9. 邊界（本次不做）

- 不改後端 API / 資料結構
- 不引入新 UI 框架或圖標庫（保持零新增依賴）
- 不改 Telegram SDK 集成邏輯
- 不重構頁面業務邏輯（僅模板結構與樣式）
- 不動 router 的 redirect 路由表本身

---

## 10. 交付物

1. 本計畫文件（docs/plans/active/）
2. 代碼變更（按 P0–P3 分階段 commit）
3. 四斷點截圖（375 / 768 / 1024 / 1440）存 webapp/.agent-report/latest/screenshots/
4. 完成後將本文件移至 docs/plans/completed/ 並更新 status 為 completed

---

## 11. 跨 Session 協作規範（接手開發必讀）

本計畫預期會跨多個 Session / 多個開發者執行。為避免「進度靠記憶、狀態靠猜測」，
以下規則為強制項，任何接手者都必須遵守。

### 11.1 唯一真實來源（Single Source of Truth）

**本文件就是進度看板。** 不要在別處另開進度記錄。

- 每個階段（P0–P3）開始前：把 frontmatter 的 `progress` 改為對應階段的 `進行中`
- 每完成一個可驗證項（含子項）：立即更新 §11.3 進度賬本，勾選對應 checkbox
- 每階段全部完成且驗證通過：把 `progress` 該階段改為 `已完成`，並填 `last_verified` 為當天日期
- 全部 P0–P3 完成後：本文件移入 `docs/plans/completed/`，`status` 改 `completed`

### 11.2 每個 Session 的標準起手式

接手時按順序做這四件事，不要跳過：

1. 讀本文件 §6（執行順序）與 §11.3（進度賬本），確認目前停在哪
2. 執行 §11.4 的狀態自檢命令，確認程式碼實際狀態與賬本一致
3. 若不一致：以**程式碼實際狀態**為準，先修正賬本，再動工
4. 動工前在 §11.5 的 Session 日誌新增一行（日期 + 本次目標）

### 11.3 進度賬本

> 規則：完成一項就改 `[ ]` → `[x]`，並在該行末尾補 `（YYYY-MM-DD 完成）`。
> 部分完成用 `[~]` 並註明已做/未做。

**P0 · 修 2 個 Icon Bug**

- [x] P0-1 重寫 `SETTINGS_PATH` 為標準 Material gear 幾何（2026-11-17 完成）
- [x] P0-2 `Icon.vue` 的 `SIZE_MAP` 補 `xs: "12"`，fallback 改 `"20"`（2026-11-17 完成）
- [x] P0-3 新增 `IconSize.test.js`（xs/sm/md/lg/xl/未知 六個斷言）（2026-11-17 完成）
- [x] P0-4 `Icon.test.js` 加 path 合法性守護斷言（2026-11-17 完成）

**P1 · 連結與 Tab 治理**

- [x] P1-1 刪 `components/radar/RadarSubtabs.vue`
- [ ] P1-2 刪 `components/common/SubTabBar.vue` + `.test.js`
- [ ] P1-3 刪 `stores/navigationStore.js`
- [x] P1-4 刪 `ChartView.vue` 的 `.chart-tabs` 區塊與對應 CSS
- [x] P1-5 新增 `components/common/SegmentedControl.vue` + 測試
- [x] P1-6 `InsightsView.vue` 接入 SegmentedControl
- [x] P1-7 `ChartView.vue` 接入 SegmentedControl
- [x] P1-8 `MarketRadarView.vue` 移除 RadarSubtabs，加返回膠囊
- [x] P1-9 `MacroBattleView.vue` 同上
- [x] P1-10 `TechnicalPanel.vue` 移除 RadarSubtabs，加返回膠囊
- [ ] P1-11 `StrategyConfigEditor.vue` 雙層 tablist 收斂為單層 Chip
- [ ] P1-12 `DashboardView.vue:87` 改 `/insights?tab=radar`
- [ ] P1-13 `MarketDetailDrawer.vue:72` 改 `/insights?tab=radar`
- [ ] P1-14 `12-strategyConfig.spec.js` 選擇器改 `data-testid`

**P2 · 圖標多樣化（30 個全做）**

- [ ] P2-1 首批 13 個圖標（方向 6 + 市場 7）寫入 `icon-registry.js`
- [ ] P2-2 執行 `grep -rn 'name="neutral"' webapp/src` 產出 32 處完整清單
- [ ] P2-3 按 §4.3 映射表替換 `neutral`（每 5 處跑一次 IconUsage 測試）
- [ ] P2-4 次批 17 個圖標（操作 10 + 分析 8）寫入 registry
- [ ] P2-5 按鈕與卡片標題改用次批圖標
- [ ] P2-6 `tabsConfig.js` 內聯 SVG 遷移至 `icon-registry`

**P3 · 寬度與佈局**

- [ ] P3-1 `tokens.css` 新增 3 個容器變數
- [ ] P3-2 `shared-styles.css` 的 `.iln-page` 改 token 寬度
- [ ] P3-3 新增 `.iln-grid` 系列工具類
- [ ] P3-4 `DashboardView` 套柵格
- [ ] P3-5 `InsightsView` 套柵格
- [ ] P3-6 `MarketRadarView` 套柵格
- [ ] P3-7 `MacroBattleView` 套柵格
- [ ] P3-8 `NewsView` 套柵格
- [ ] P3-9 `AccountView` 套柵格
- [ ] P3-10 `ChartView` 套柵格
- [ ] P3-11 `TechnicalPanel` 套柵格
- [ ] P3-12 `StrategyConfigEditor` 改用 token

### 11.4 狀態自檢命令（每個 Session 起手跑一次）

以下命令用於確認程式碼實際狀態。**輸出為 0 結果才代表該項已完成。**

- 檢查是否還有舊組件殘留：在 webapp 目錄下
  `grep -rn "RadarSubtabs\|SubTabBar\|useNavigationStore" src`
- 檢查是否還有 tablist：`grep -rn 'role="tablist"' src`
- 檢查 neutral 剩餘數量：`grep -rc 'name="neutral"' src`
- 檢查 Icon Bug 是否已修：`grep -n "xs:" src/components/common/Icon.vue`
- 檢查容器 token：`grep -n "iln-content-max" src/styles/tokens.css`
- 檢查柵格類：`grep -n "iln-grid" src/shared-styles.css`


### 11.4.1 已知環境阻塞（2026-11-17 發現）

**vitest 無法啟動任何測試**，錯誤訊息：

    Error: require() of ES Module node_modules/@exodus/bytes/encoding-lite.js
    from node_modules/html-encoding-sniffer/lib/html-encoding-sniffer.js not supported.

**成因**：`jsdom@29` → `html-encoding-sniffer@6`（CJS）→ `@exodus/bytes@1.15`（純 ESM）。
CJS 用 `require()` 載入純 ESM 套件，Node 20 直接拋 `ERR_REQUIRE_ESM`。
已試無效的方案：`--pool=forks`、`--pool=threads`、`--no-isolate`
（崩在環境初始化階段，換 pool 無濟於事）。

**與本計畫的關係**：無關。此問題在本計畫動工前就存在，任何測試檔都跑不起來。

**影響**：P0–P3 的單元測試無法用 `npm run test` 驗證。

**暫行驗證方式**：用 `node -e` 直接讀檔做結構化斷言（P0 已用此法驗證全部通過）。

**根治建議（不在本計畫範圍，需另開 issue）**：
1. 在 `package.json` 加 `overrides` 釘住 `@exodus/bytes` 至 CJS 相容版本，或
2. 升級 `jsdom` 至已修復版本，或
3. 改用 `happy-dom` 取代 `jsdom`

**接手者注意**：若測試突然能跑了，代表有人修了上述依賴，請把本節標記為「已解決」並補上修復方式。

### 11.5 Session 日誌

> 每次動工前新增一行；收工時補上結果。格式：日期 | 階段 | 本次做了什麼 | 結果

| 日期 | 階段 | 內容 | 結果 |
|------|------|------|------|
| 2026-11-17 | — | 撰寫本計畫、審計現狀、修正 4.2 數量與 P2 標記 | 完成 |
| 2026-11-17 | P0 | 修 SETTINGS_PATH、SIZE_MAP 補 xs、新增 IconSize.test.js、Icon.test.js 加 path 守護 | 完成（測試環境阻塞，改用 node 腳本驗證） |

### 11.6 交接時的必填項

若本次 Session 未做完就結束，必須在 §11.5 最後一行寫清楚：

1. **做到哪**：對應 §11.3 的哪個 checkbox
2. **卡在哪**：具體錯誤訊息或未決問題
3. **下一步**：接手者應該從哪個動作開始
4. **有無未提交變更**：`git status` 的摘要

不寫這四項就結束 Session，視為交接失敗。

### 11.7 Commit 規範

每階段獨立 commit，訊息格式：

`uiux(p0): 修 SETTINGS_PATH 與 xs 尺寸` / `uiux(p1): 刪 RadarSubtabs 與假 Tab`

好處：任一階段出問題可單獨 `git revert`，不影響其他階段。

### 11.8 不確定時的處理

- 程式碼與本文件描述不符 → 以程式碼為準，並更新文件
- 某項改動會影響 §9 邊界外的內容 → 停手，在 §11.5 記錄，等確認
- 測試失敗且原因不明 → 不要跳過，記錄錯誤訊息後停在该項
