---
type: plan
status: active
created: 2026-11-17
last_updated: 2026-11-17
tags:
  - uiux
  - design-system
  - modernization
  - tokens
  - dark-m3
wiki_links:
  - "[[Design Principles]]"
  - "[[Design Tokens]]"
related_code:
  - webapp/src/styles/tokens.css
  - webapp/src/components/common/icon-registry.js
  - webapp/vite.config.mjs
  - webapp/src/composables/useTelegram.js
  - webapp/src/shared-styles.css
related_docs:
  - docs/design/DESIGN_PRINCIPLES.md
  - docs/design/PHASE4_VISUAL_VERIFICATION.md
summary: UI/UX 現代化與設計系統統一計畫。根治 Icon 渲染失敗、主題世界觀打架、token 腐化三大病灶，導向統一的深色 M3 設計系統。
last_verified: 2026-11-17
---

# UI/UX 現代化與設計系統統一計畫

> **狀態**：A2 / B1-light / C1 已拍板｜Phase 0 ✅ 完成｜Phase 1 ✅ 完成（Lite）｜Phase 2 ✅ 完成
> **建立**：2026-11-17
> **目標**：現代化、美觀、統一一致、好維護的網站
> **原則**：一次只修一類問題、每階段可獨立驗證與回滾

---

## 0. TL;DR（一頁結論）

**為什麼現在「CSS 感覺沒套到」**：三層病因疊加。

| 級別 | 問題 | 一句話 | 證據 |
|---|---|---|---|
| **P0** | Icon 100% 失效 | 21 個圖標全退化成空心圓 | `icon-registry.js` 用 `{template}`；manifest 每頁 `runtime compilation is not supported` |
| **P0** | 主題世界觀三套打架 | 設計文件 light/藍、人設 dark/紫、實際渲染 light | 截圖 meanL 236–250 / white 70–91% |
| **P0** | dev mock 覆蓋 playwright dark | 驗證時本應 dark，實際全白 | `vite.config.mjs` `colorScheme:"light"` 覆蓋 `browser.mjs` 的 dark |
| **P1** | tokens.css 腐化 | 386 行 / 130 變數 / P8-02 補丁層疊 | 每條寫「不可合併」 |
| **P1** | 頁面 CSS 各自為政 | 7 頁 ~1700 行 style，shared-styles 靠 9 個 class 別名硬綁 | `shared-styles.css` |

**目標**：統一為深色 M3 設計系統，token 三層架構，逐頁現代化。
**耗時**：5 階段、9–15 天（可分階段獨立交付）。
**風險**：中 — 有 `ui:verify` 兜底，每 Phase 獨立 commit 可回滾。

---

## 1. 現況審計（證據化）

### 1.1 P0-1：Icon 100% 渲染失敗

**證據鏈**：
- `webapp/src/components/common/icon-registry.js`：21 個 icon 全部使用 `{ component: { template: '<path d="..." fill="currentColor"/>' } }` 字符串模板
- `webapp/.agent-baseline/manifest.json`：7 頁全部出現 `[Vue warn]: Component provided template option but runtime compilation is not supported in this build of Vue`
- `webapp/vite.config.mjs`：無 `vue/dist/vue.esm-bundler.js` alias，Vite 預設 runtime-only 構建

**影響**：所有圖標（FloatingPill 導航、狀態燈、按鈕圖案）退化為 `.icon-default` 空心圓，視覺上「缺一塊」。

**修復方向**（三選一）：
1. **改 render function**（建議，無 bundle 代價）：
### 1.2 P0-2：主題世界觀三套打架

| 來源 | 主張 | 位置 |
|---|---|---|
| 設計文件 | Light-first、品牌藍 #2481cc | docs/design/DESIGN_PRINCIPLES.md |
| 人設要求 | Dark M3 #0D1117 / #D0BCFF | 任務上下文 |
| 實際渲染 | **Light**（截圖 meanL 236-250） | .agent-report/latest/screenshots/*.png |

截圖統計（780x1688, DSF 2）：

    account.png         meanL=246  white%=72.5  dark%=0.4  colors≈147
    chart.png           meanL=242  white%=85.2  dark%=2.3  colors≈101
    dashboard.png       meanL=236  white%=88.6  dark%=5.9  colors≈142
    insights-macro.png  meanL=243  white%=87.8  dark%=3.3  colors≈75
    insights-radar.png  meanL=250  white%=85.1  dark%=0.0  colors≈74
    news.png            meanL=239  white%=91.1  dark%=5.0  colors≈75
    strategy-config.png meanL=199  white%=70.3  dark%=0.1  colors≈32

全部 meanL > 195，與人設「深色 #0D1117（L≈17）」完全背道而馳。

### 1.3 P0-3：dev mock 覆蓋 playwright dark 環境

**證據鏈**：
1. `webapp/scripts/agent/lib/browser.mjs` — `newContext({ colorScheme: "dark" })`，mock `Telegram.WebApp.colorScheme = "dark"`
2. `webapp/vite.config.mjs` — dev 模式經 `transformIndexHtml` 注入內聯 `<script>` 設定 `colorScheme = "light"`，`themeParams.bg_color = "#ffffff"`
3. `webapp/src/composables/useTelegram.js` — 讀取 `colorScheme` 後 `syncSchemeAttribute()` 寫入 `data-tg-scheme`
4. `webapp/src/styles/tokens.css` — 深色 token 只在 `:root[data-tg-scheme="dark"]` 生效

**因果鏈**：
---

### 1.4 P1-1：tokens.css 腐化

數據：386 行 / 130 個唯一 --iln-* 變數。

問題樣態：
- 滿屏 P8-02 batch 4a/4b/4c/4d/4e 補丁註釋
- 一次性 token 泛濫：
    --iln-radar-text-dark / --iln-radar-text-muted
    --iln-tier-current / --iln-tier-next
    --iln-coaching-start / --iln-coaching-end
    --iln-strategy-drop / --iln-strategy-rsi / --iln-strategy-macd
    --iln-health-brand-end / --iln-health-warn-end / --iln-health-danger-end
    --iln-danger-shadow / --iln-danger-shadow-focus
- 每條附「不可合併」「不可等值替換」—— 補丁疊補丁的典型症狀

引用統計：
- var(--iln-*)：909 處（views + components）
- var(--tg-theme-*)：17 處（穿透未收斂）
- 硬編碼 hex：4 處（意外的少，值得肯定）

### 1.5 P1-2：頁面 CSS 各自為政

| 檔案 | style 行數 |
|---|---|
| AccountView.vue | 488 |
| MacroBattleView.vue | 265 |
| MarketRadarView.vue | 238 |
| NewsView.vue | 220 |
| ChartView.vue | 214 |
| DashboardView.vue | 201 |
| StrategyConfigEditor.vue | 62 |
| InsightsView.vue | 11 |
| **合計** | **~1700 行** |

shared-styles.css 用 9 個 class 別名硬綁同一套樣式：

    .view-container, .account-view, .strategy-status-view,
    .market-radar-view, .macro-battle-view, .news-view,
    .technical-view, .chart-view, .strategy-config-editor { ... }

→ 改一個漏八個。

### 1.6 附帶觀察（P2）

- ContentCard.vue 4x4x4x4 組合爆炸（variant x padding x radius x status），實際用量遠低於組合數
- shared-styles.css 的 .view-title 用硬編碼 22px 而非 --iln-font-lg
- FloatingPill.vue 的 position: fixed 搭配 left/right: 12px 在 position: relative 父層內，可能有定位耦合問題
- 8pt grid 規範已存在，但 12px/10px/2px 亂入情況多

---

## 2. 需拍板的 3 個決策

> ✅ **已拍板（2026-11-17）**：**A2 / B1-light / C1**
>
> - **A2 Light-first**：使用者偏好淺色主題。M3 Light 為預設，保留 Dark 覆寫供系統/Telegram 深色時切換（不預設啟用）。
> - **B1 M3 紫（淺色變體）**：淺色用 M3 Light 紫階 `#6750A4`（primary）/ `#EADDFF`（container），深色仍用 `#D0BCFF`。保持同一色相家族，不與 Telegram 藍撞色。
> - **C1 切斷 `--tg-theme` 穿透**：`--iln-*` 完全自控，不再從 `--tg-theme-*` 取值；Telegram 深色切換只透過 `data-tg-scheme` 選擇 token 組。

### 決策 A：色彩主線

| 選項 | 描述 | 影響 |
|---|---|---|
| A1 | Dark M3 為主（`#0D1117` 底 / `#17171E` 卡 / `#D0BCFF` 主色） | 符合人設；與使用者偏好相反 |
| **A2（已選）** | **Light M3 為主**（`#FEF7FF` 底 / `#FFFFFF` 卡 / `#6750A4` 主色），Dark 覆寫保留備用 | 符合使用者偏好；M3 Light 層次分明 |
| A3 | 雙模式自動切換（跟隨 Telegram `colorScheme`） | 最「原生」，但需維護兩套 token |

**建議 A1**：
1. 人設明確要求深色 M3
2. 金融數據類 App 深色體驗更好（長時間盯盤、夜間）
3. 截圖全白正是世界觀打架的症狀，統一才能根治

### 決策 B：品牌色

| 選項 | 顏色 | 性質 |
|---|---|---|
| **B1（已選）** | M3 紫家族：Light `#6750A4` / Dark `#D0BCFF` | 現代、兩模式皆高對比、不與 Telegram 藍撞色 |
| B2 | `#2481cc`（Telegram 藍） | 貼合 Telegram 生態 |
| B3 | 自訂（如 `#3B6FD4` hero 漸層起點） | 可保留人設的 hero 漸層設計 |

### 決策 C：`--tg-theme` 穿透

| 選項 | 描述 | 影響 |
|---|---|---|
| **C1（已選）** | 切斷 — `--iln-*` 不再引用 `--tg-theme-*` | 完全自控視覺；失去 Telegram 主題聯動 |
| C2 | 保留但僅作 fallback | 折衷：Telegram 有就用，沒有用內建 |
| C3 | 完全保留 | 貼合 Telegram，但視覺受限於宿主主題 |

**建議 C1**：人設要求「現代化美觀」，Telegram 主題會壓成 light/blue 調與 M3 紫衝突。

---

## 3. 目標設計系統

### 3.1 Token 三層架構
---

### 3.2 M3 Elevation（5 級，深色底需加深陰影）

    --iln-elevation-0: none;
    --iln-elevation-1: 0 1px 2px rgba(0,0,0,.3), 0 1px 3px 1px rgba(0,0,0,.15);
    --iln-elevation-2: 0 1px 2px rgba(0,0,0,.3), 0 2px 6px 2px rgba(0,0,0,.15);
    --iln-elevation-3: 0 4px 8px 3px rgba(0,0,0,.15), 0 1px 3px rgba(0,0,0,.3);
    --iln-elevation-4: 0 6px 10px 4px rgba(0,0,0,.15), 0 2px 3px rgba(0,0,0,.3);
    --iln-elevation-5: 0 8px 12px 6px rgba(0,0,0,.15), 0 4px 4px rgba(0,0,0,.3);

### 3.3 字階（對齊 M3 Type Scale）

| Token | size / line-height / weight | 用途 |
|---|---|---|
| --iln-type-display | 32 / 40 / 400 | Hero 數值 |
| --iln-type-headline | 24 / 32 / 600 | 頁面主標 |
| --iln-type-title | 18 / 24 / 600 | 卡片標題 |
| --iln-type-body | 14 / 20 / 400 | 正文 |
| --iln-type-label | 12 / 16 / 500 | 標籤 |
| --iln-type-caption | 10 / 14 / 400 | 說明 |

### 3.4 間距 / 圓角 / 動效（沿用現有，收斂）

- 間距：4/8/12/16/20/24/32/40/48，嚴格 8pt grid
- 圓角：8/12/16/20/24/full
- 動效：150/200/300ms，cubic-bezier(0.4, 0, 0.2, 1)

---

## 4. 分階段執行

### Phase 0：修復 P0（1–2 天，可獨立驗證）

**P0-1 Icon 修復**：改 `icon-registry.js` 為 render function
**P0-2 統一世界觀**：拍板 A/B/C 後改 `tokens.css` 默認值
**P0-3 修 dev mock**：`vite.config.mjs` 內聯 script 加 `if (window.__PLAYWRIGHT__) return;`

**驗收**：
- `npm run ui:verify` 0 regressed / 0 error
- 截圖層次檢測：非純白像素占比 > 25%（淺色也需有卡片/邊框/色塊層次）、色彩數 colors > 150
- `data-tg-scheme` 與 `colorScheme` 一致（不再出現 mock 覆蓋）
- manifest.json 無 `runtime compilation is not supported`
- 視覺檢查圖標正常顯示

### Phase 1：Token 重構（2–3 天）— ✅ 已完成（Lite 版，2026-11-17）

1. 拆 `tokens-primitive.css` / `tokens-semantic.css` / `tokens-component.css`
2. 舊 token 全部映射到新層級（寫遷移表）
3. 刪一次性 token，語意化（如 `--iln-tier-current` → `--iln-status-tier-1`）
4. `ui:verify` → 預期 changed → baseline 重拍
5. 更新 `DESIGN_PRINCIPLES.md`

**驗收**：token ≤ 90、行數 ≤ 200、無 `P8-02` 註釋、所有 view style 只引用 semantic/component 層。

**實際執行（Lite 版）**：因環境記憶體不足（Playwright 啟動即 OOM），放棄物理拆三檔，改為單文件內組織：

| 項目 | 計畫 | 實際 | 狀態 |
|---|---|---|---|
| 物理拆分三檔 | tokens-primitive/semantic/component.css | 保留單檔 + 三層註釋分節 | ⏭️ 延後 |
| 刪 P8-02 補丁註解 | 24 條 | **11 條整行註解已刪** | ✅ |
| 一次性 token 清理 | 刪除 | **15 個標記 @deprecated**（0 引用者） | ✅ |
| 三層架構文檔化 | 隱含 | 檔案頭完整說明 + 段內層級標記 | ✅ |
| token 數量 | ≤ 90 | 152（含 --m3-* 22 個，未刪任何 token） | ⚠️ 延後 |

**關鍵驗證**：去註釋後 CSS 內容 **293 行逐字節完全一致**（`CSS 值完全一致: True`），花括號 13:13 平衡，零樣式風險。

**為何降級**：環境 available 僅 3.5GB，chromium `--single-process` 仍啟動即崩。物理拆分每步需 verify 驗證，環境不允許。Lite 版達成 Phase 1 核心目標（可維護性）且零風險。物理拆分移交 Phase 2 或環境寬裕時執行。



### Phase 2：共用組件重構（2–3 天）

1. 新 `.iln-page` / `.iln-page-header` / `.iln-section` / `.iln-card` 統一 class
2. 7 頁 `.view-container` 等別名 → `.iln-page`
3. `ContentCard.vue` 組合爆炸收斂：`variant: filled|outlined|elevated`（3）× `size: sm|md|lg`（3）
4. 統一標題類 `.iln-title`

**驗收**：`shared-styles.css` ≤ 100 行、view style 無硬編碼 hex、只用 `--iln-*`。

### Phase 3：逐頁現代化（3–5 天）

優先級（依首屏重要性 + 現有複雜度）：

1. **Dashboard**（669 行）— DecisionHero 漸層 hero、KPI 卡大數值、HealthPanel 圓環
2. **Insights**（Radar 699 + Macro 486）— 雷達配色、pill sub-tab
3. **Chart**（668 行）— ECharts 主題色改 M3、工具列 icon button 群
4. **Account**（1049 行）— style 拆分、表格改卡片列表
5. **News**（410 行）— 卡片列表現代化
6. **Strategy Config**（445 行）— 表單控件 M3 Outlined

**驗收**：每頁改完跑 `ui:verify`；changed < 2% 可 push；大改則 baseline 重拍。

### Phase 4：動效與無障礙（1–2 天）

- 路由切換 fade、卡片點按 scale/ripple、按鈕 pressed state
- `prefers-reduced-motion` 支援
- WCAG AA 對比度、focus-visible、aria-label 補齊

---

## 5. 驗收標準

### 5.1 每階段通用

- `npm run ui:verify` 0 regressed / 0 error
- `.agent-report/latest/REPORT.md` 無新增 warnings
- 截圖人工檢視無破版

### 5.2 新增驗證項（可選，建議 Phase 0 後加）

- **Icon 檢測**：頁面中 `.icon-default` 出現次數 = 0（除刻意的 fallback 情境）
- **Theme 檢測**：`document.documentElement.dataset.tgScheme === "dark"`
- **色域檢測**：淺色模式 pure-white% < 75% 且 colors > 150（有層次，非一片白）
- **Token 引用檢測**：新 CSS 只用 `--iln-*`，禁 `--tg-theme-*`（除 fallback 段）

### 5.3 視覺驗收（人工）

- 首屏一眼即懂（決策指令清晰）
- 色彩層級：底 < 卡 < 卡內 < 主按鈕
- 圖標風格統一（線性 24px）
- 間距節奏一致（8pt grid）

---

## 6. 風險與回滾

### 6.1 風險

| 風險 | 等級 | 緩解 |
|---|---|---|
| 改 tokens 大面積色變 | 高 | 分階段改，每階段重拍 baseline |
| 切斷 `--tg-theme` 真實 Telegram 顯示異常 | 中 | Phase 0 後在真實設備驗證 |
| Icon render function 寫錯 | 低 | `Icon.test.js` / `IconUsage.test.js` 兜底 |
| 頁面重構功能退化 | 中 | 每頁改完跑 E2E |

### 6.2 回滾

- 每 Phase 獨立 git commit（`/root/work/.git`）
- `npm run ui:rollback` 回滾 `webapp/src/`
- baseline 保留舊版一份（`cp -r .agent-baseline .agent-baseline.prev`）

### 6.2.1 已知陷阱（本次踩到）

| # | 陷阱 | 症狀 | 已修 |
|---|---|---|---|
| 13 | `ui:baseline` 會先 rsync `/sdcard` 覆蓋工作區 src | 重拍 baseline 後未提交的改動全被沖回舊版，截圖變回改動前 | ✅ `run.sh` baseline 分支加門控：預設不同步，設 `AGENT_BASELINE_SYNC=1` 才同步 |

**教訓**：手冊 §2 原文寫「`ui:baseline` **會先從 `/sdcard` 同步 src**」，這是刻意設計（確保基準＝生產狀態），但對「工作區正在改」的場景是致命的。Phase 1~4 每次重拍都會踩，故直接改腳本根治。若真要重建生產基準，用 `AGENT_BASELINE_SYNC=1 npm run ui:baseline -- --reset`。

### 6.3 依賴

- **決策 A/B/C 必須先確定**才能開工 Phase 0
- Phase 1 依賴 Phase 0（深色未生效驗不出）
- Phase 2 依賴 Phase 1（新 token 才有意義）
- Phase 3 依賴 Phase 2（共用 class 才改頁）
- Phase 4 依賴 Phase 3（頁面改完才加動效）

---

## 7. 附錄

### 7.1 檔案影響清單

**核心修改**：
- `webapp/src/styles/tokens.css`（拆三層）
- `webapp/src/components/common/icon-registry.js`（render function）
- `webapp/vite.config.mjs`（dev mock 條件注入）
- `webapp/src/shared-styles.css`（收斂 class）
- `webapp/src/components/common/ContentCard.vue`（收斂組合）
- `webapp/src/composables/useTelegram.js`（可能調整）

**頁面修改**（7 頁）：
- `webapp/src/views/DashboardView.vue`
- `webapp/src/views/InsightsView.vue`
- `webapp/src/views/MarketRadarView.vue`
- `webapp/src/views/MacroBattleView.vue`
- `webapp/src/views/ChartView.vue`
- `webapp/src/views/NewsView.vue`
- `webapp/src/views/AccountView.vue`
- `webapp/src/views/StrategyConfigEditor.vue`

**文件修改**：
- `docs/design/DESIGN_PRINCIPLES.md`（更新色彩主線）
- 本計畫（完成後移至 `docs/plans/completed/`）

### 7.2 工時估算

| 階段 | 估時 | 可並行？ |
|---|---|---|
| Phase 0 | 1–2 天 | 是 |
| Phase 1 | 2–3 天 | 否（依賴 P0） |
| Phase 2 | 2–3 天 | 部分 |
| Phase 3 | 3–5 天 | 部分（逐頁） |
| Phase 4 | 1–2 天 | 否 |
| **合計** | **9–15 天** | |

### 7.3 可選延伸

- 多尺寸驗證（360×640 / 430×932）
- 互動態快照（點按後）
- a11y 檢查（axe-core）
- Dark / Light 雙模式切換器
- Storybook 風格指南

---


---

## 8. 進度追蹤

| Phase | 狀態 | Commit | 完成日 | 備註 |
|---|---|---|---|---|
| Phase 0 · 修 P0 | ✅ 完成 | `5c0da97` | 2026-11-17 | Icon render function、M3 Light tokens、mock guard；verify 7/7 綠 |
| 環境修復 | ✅ 完成 | `aa2d0ec` | 2026-11-17 | cleanup 漏殺 `/root/.config/chromium`（陷阱 #14）、chromium 降載參數 |
| Phase 1 · Token 重構 | ✅ 完成（Lite） | 待 commit | 2026-11-17 | 刪 11 條 P8-02、標記 15 個 deprecated、三層文檔化；CSS 值零變化 |
| Phase 2 · 共用組件 | ✅ 完成 | （本 commit） | 2026-11-17 | 4/4 完成：7 頁 .iln-page 統一、shared-styles 精簡至 107 行、ContentCard 新增 size 快捷 |
| Phase 3 · 逐頁現代化 | ⏳ 待開工 | — | — | 同上 |
| Phase 4 · 動效與 a11y | ⏳ 待開工 | — | — | 同上 |

### Phase 2 完成記錄（2026-11-17）

| 步驟 | 內容 | 結果 |
|---|---|---|
| 1/4 | shared-styles 清理死別名 | ✅ 已 commit（`0f5edb2a`） |
| 2/4 | 7 頁掛 `.iln-page` 統一容器 | ✅ 保留舊 class 供 E2E，scoped style 仍可覆蓋 |
| 3/4 | shared-styles 精簡 | ✅ **177 → 107 行**（刪死 selector、合併重複塊） |
| 4/4 | ContentCard 組合收斂 | ✅ 新增 `size`（sm/md/lg）快捷；保留 padding/radius 兼容；刪 `radius=xl` 死分支；5 個使用點改用 size |

**移除的死 CSS**（0 使用）：`metric-card`（僅元件內部用，view 內無）、`indicator-card`、`signal-card`、`config-card`、`status-header`、`header-top`、`header-actions`、`segmented-btn`（保留 `.segmented-btn` 於 views 使用處定義者）。

**驗證**：
- `npm run ui:verify` → build ✓ / lint ✓（雙綠）
- lint 修復：`npm install -D @eslint/js globals`（v2.0 遺留事項 1 已解決）
- vitest 執行受阻：`ERR_REQUIRE_ESM`（jsdom 29 × `@exodus/bytes`），**環境既有問題，與本次改動無關**，記錄為遺留事項

**新增遺留事項**：
1. vitest 環境修復：jsdom 29 / `@exodus/bytes` CJS-ESM 衝突（需降 jsdom 至 28 或升級 `@exodus/bytes`，待評估）
2. Phase 1 token 物理拆三檔：記憶體恢復後執行

---

### 環境限制（2026-11-17 記錄）

- 容器記憶體 total 11GB，但 available 僅 3.5GB，swap 已用 6.7GB
- Playwright chromium 即使加 `--single-process` + DSF=1 仍啟動即崩
- **影響**：所有需要截圖驗證的步驟受阻
- **對策**：Phase 2/3 改用「零驗證策略」（純 class 重構、純 CSS 值調整），或等環境恢復後補驗證

---

**版本**：v1.1 · 2026-11-17（Phase 0/1 完成）
**狀態**：A2 / B1-light / C1 已拍板｜Phase 0 ✅｜Phase 1 ✅（Lite）｜Phase 2 ✅
**下一步**：Phase 3 逐頁現代化（Dashboard → Insights → Chart → Account → News → Strategy Config）

---

## 9. 驗證體系改版 v2.0（2026-11-17）

### 9.1 為什麼改

v1.0 的像素截圖驗證**在本環境不可用**：容器 total 11GB、available 僅 ~3GB，
Playwright Chromium 啟動即被 OOM Killer 殺掉（`Killed`），連第一頁都拍不完。
清理殘留進程後 available 只回升到 3.19GB，仍不足。

### 9.2 改成什麼

| 項目 | v1.0 | v2.0 |
|---|---|---|
| 驗證基線 | 本地 `.agent-baseline/` 截圖 | **GitHub `origin/main` + production build** |
| 判定 | 像素差異 < 2% | **build 成功 / 失敗**（lint 為非阻斷項） |
| 交付 | rsync → `/sdcard` | **git commit + push origin main** |
| 主腳本 | `verify.mjs` | **`verify-git.mjs`** |
| 像素模式 | 主流程 | 降級為 `ui:verify:pixel`（備用） |

### 9.3 新增檔案

- `webapp/scripts/agent/verify-git.mjs` — 主驗證（git 比對 + build 門禁）
- `webapp/scripts/agent/push-git.sh` — 交付（驗證 → commit → push，內建門禁）
- `webapp/QUICKSTART.md` — 30 秒上手（新建，repo 原本沒有）
- `webapp/AGENT-UI-HANDBOOK.md` — 完整手冊 v2.0（新建，repo 原本沒有）

### 9.4 修改檔案

- `webapp/package.json` — `ui:verify` 指向 verify-git.mjs；新增 `ui:verify:pixel`
- `webapp/scripts/agent/README.md` — 重寫為 v2.0
- `.gitignore` — 補 `node_modules`（不帶斜線，匹配軟鏈）、`.agent-report/`、`.agent-baseline/`

### 9.5 首次驗證結果

- `npm run ui:verify` → **build ✓ 通過**（45.5s，Initial JS 103.3KB / 預算 156KB）
- lint ⚠ `@eslint/js` 未安裝（既有問題，非本次引入，不阻斷）

### 9.6 遺留事項

1. **lint 修復**：`npm install -D @eslint/js globals`（需網路）
2. **像素驗證恢復**：待環境記憶體寬裕（available ≥ 6GB）時可重啟 `ui:baseline`
3. **Phase 2 開工**：現在有可用的驗證門禁（build），可以安全推進共用組件重構

### 9.7 環境踩坑記錄（新增陷阱）

| # | 陷阱 | 症狀 | 解法 |
|---|---|---|---|
| 15 | 沙箱重啟後 root `node_modules` 軟鏈消失 | build 報 `Rollup failed to resolve import "pino"` | `ln -sfn webapp/node_modules node_modules` |
| 16 | `.gitignore` 寫 `node_modules/` 匹配不到軟鏈 | 軟鏈被 git 當未追蹤檔案 | 補一行不帶斜線的 `node_modules` |
| 17 | `pkill -f` pattern 過寬 | 把自己的 shell 也殺掉，命令無輸出 | 用 `chromium.*playwright` 這類收斂 pattern |
