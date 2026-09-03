# Dashboard + News Tab 功能盤點與設計分析 (v2)

> **狀態**：Phase 0 — 精確功能盤點 (Content Inventory)
> **建立日期**：2026-09-02
> **目的**：盤點 Dashboard + News 所有功能，確認遺漏項目，設計統一 Mini App 布局。
> **方法**：逐檔結構分析 (template sections / props / computed / refs / functions)，結合 Telegram Mini App 主流 UX。

---

## 1. 結論摘要 (Executive)

| 當前狀況                          | 問題                                | 建議                                       |
| --------------------------------- | ----------------------------------- | ------------------------------------------ |
| DashboardView 5 個 top-level tabs | tab 切換摩擦，Han 每日要來回切 5 次 | 單頁 Card Carousel，卡片可折疊             |
| Health/Analysis/Strategy 3 個 tab | 資訊分散                            | 單頁整合，Summary→Health→Analysis→Strategy |
| StrategyHealthOverview.vue (stub) | 存在未接入，props shape 錯誤        | **刪除 stub**，DashboardView 直接內建卡片  |
| News route `/news` 存在且完整     | Bottom nav 缺 News tab              | 加回 `tabsConfig.js`                       |
| StrategyConfigEditor 自包含全頁   | 做 modal 需處理 save/reset/validate | 保留 self-contained, 包裝 drawer-modal     |

---

## 2. 逐檔結構盤點 (Content Inventory)

> 資料來源: 自動化 grep `imports / defineProps / computed / ref / function / data-testid / <template sections` 自 10 個 Vue 檔案。

### 2.1 DashboardView.vue (633 lines : template 300 / script 333) — 目前 5 tabs

**數據來源 refs**: `status`, `latestReport`, `topNews`, `healthData` (4 個 API: `fetchStatus`, `fetchReports(1)`, `fetchNews`, `fetchPortfolioHealth`)

| #   | Tab               | 渲染內容                                                                                                                                                                         | Props/Data                                                                                                                                                 | Han 日常重要        |
| --- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 1   | `summary`         | `MarketSnapshot` (regime/PR/GL/light) + `DecisionHero` (AI action verdict) + DisciplineBanner (link → /reports) + `CoachingAdvice` (risk/action/mindset, 4 collapsible sections) | props: `latestReport`, `status`; computed: `regimeLevel`, `pbPrLevel`, `glLevel`, `lightEmoji`, `activePriority`, `targetClass`, `pctClass` 等 27 computed | ⭐⭐⭐⭐⭐ 每日必看 |
| 2   | `health`          | `HealthPanel` (hero score/emoji + 6 health comp cards + recommendations)                                                                                                         | prop: `healthData`                                                                                                                                         | ⭐⭐⭐⭐ 風控       |
| 3   | `analysis`        | `AnalysisPanel` (offense/defense sub-tabs, score rows, defense items, news list) + radar chart (v-chart)                                                                         | props: `latestReport`, `topNews`, `scoreRows`, `defenseItems`; emit: `open-news`                                                                           | ⭐⭐⭐ 次要資訊     |
| 4   | `strategy-status` | `StrategyStatusView` (self-loading: 策略分數/冷卻期/檔位/預算/Budget Priority/信號分類)                                                                                          | **self-loading** (`fetchPortfolioHealth` inside)                                                                                                           | ⭐⭐⭐⭐ 交易前必查 |
| 5   | `strategy-config` | `StrategyConfigEditorView` (self-contained: save/reset/validate, 5 section tabs, JSON viewer, reset-confirm dialog)                                                              | self-contained                                                                                                                                             | ⭐⭐ 不常           |

> **⚠️ 關鍵架構問題**: `StrategyStatusView` 和 `StrategyConfigEditorView` 都是**自我載入** (`onMounted` fetch 內部 API) 而非 prop-driven。而 `HealthPanel` / `AnalysisPanel` / `MarketSnapshot` / `DecisionHero` / `CoachingAdvice` 都是 prop-driven。這意味整合需要統一數據來源 (DashboardView 載入一次, prop 向下傳遞)。

### 2.2 NewsView.vue (472 lines : template 144 / script 328) — self-contained

| Tab                | 內容                                                                 | API               | Han 日常重要            |
| ------------------ | -------------------------------------------------------------------- | ----------------- | ----------------------- |
| `report` (default) | 台灣市場動態 (TW) + 國際總經 (US) — 每篇: source/time/title/summary  | `fetchReportNews` | ⭐⭐⭐⭐ Han 日報首選   |
| `pool`             | 全部文章 — 帶 `age_band` (fresh/recent/old) + `_region` (TW/US) 標籤 | `fetchNews`       | ⭐⭐⭐ Han 社群情緒來源 |

Functions: `switchTab`, `loadReport`, `loadPool`, `openArticle`, `ageBandClass`, `ageBandLabel`, `regionFlag`, `formatDate`.
Refs: `activeTab`, `reportNews`, `articles`, 各 loading/error/loaded states.

> **Han 偏好對應**: NewsView 的 `report` tab 提供「時效資訊卡」(generatedAt) +「固定主題」(source) — 符合「 Gmail 郵件主題須固定 / 時效資訊卡在頂部」。`pool` tab 順序/年齡標籤方便 Han 快速篩選社群情緒。

### 2.3 子元件清單 (prop-driven, 可直接 reuse)

| Component                  | Props                                                                                         | 行數 | 備註                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------- |
| `MarketSnapshot`           | regimeLevel, pbPrValue, pbPrLevel, glLevel, glValue, lightEmoji, lightText, vixOverrideActive | 114  | DashboardView summary 頭                                                          |
| `DecisionHero`             | report, activePriority, targetClass, pctClass, pctText, routingPath                           | 135  | AI 動作總結                                                                       |
| `CoachingAdvice`           | report, risks, actions, mindset, thinking, insight, verdict                                   | 203  | 4 collapsible 區塊 (riskExpanded/actionExpanded/mindsetExpanded/thinkingExpanded) |
| `HealthPanel`              | data                                                                                          | 299  | health hero + 6 comp cards + recommendations                                      |
| `AnalysisPanel`            | report, scoreOk, scoreVal, scoreMin, scoreRows, defenseItems, news                            | 208  | offense/defense sub-tab + radar slot                                              |
| `StrategyStatusView`       | (none — self-loading)                                                                         | 862  | 策略分數/冷卻/預算/信號                                                           |
| `StrategyConfigEditorView` | (none — self-contained)                                                                       | 364  | save/reset/validate/JSON viewer                                                   |

> **StrategyStatusView** (862 lines, 最大) 是自包含的，含 `data` ref，呼叫 `fetchPortfolioHealth()`。整合時須讓 DashboardView 載入 `latestReport` 後 prop 傳遞，或讓其保持自載但隱藏 tab。

### 2.4 StrategyHealthOverview.vue (stub, 269 lines) — **dead code**

- Prop shape: `health` (score/lightStatus/summary/components), `report` (signals)
- 3 testids: `summary-banner`, `health-risk-card`, `market-tactics-card`
- **問題**: 定義 `health.score`, `health.lightStatus` 但真實 `healthData` 沒有 `score`/`lightStatus` 欄位。HealthPanel 用的 `data.status`, `data.score`, `data.lightStatus` — 實際來自 `fetchPortfolioHealth` 回應。
- **決定**: 刪除 stub。DashboardView 直接內建卡片，使用真實 `healthData` prop。

---

## 3. Mini App 設計原則 (Telegram Mini Apps)

查閱 Hermes docs: Telegram Mini Apps 使用 `window.Telegram.WebApp`，提供 `expand()`, `viewportStableHeight`, `BackButton`, `MainButton`.

| 原則              | 實作                                    | Han 對應                                      |
| ----------------- | --------------------------------------- | --------------------------------------------- |
| 窄屏 (Mobile)     | max-width 600px (DashboardView 已有)    | ✓                                             |
| Bottom Nav 佔空間 | FloatingPill height ~64px + bottom 16px | 需 padding-bottom 80px+                       |
| Tap-first         | button min-height 44px, no hover-only   | ✓ (已有)                                      |
| 快速進入          | 預設顯示最重要資訊                      | Summary 卡片頂部                              |
| 安全區域          | `env(safe-area-inset-*)`                | FloatingPill 已用 env(safe-area-inset-bottom) |

### 主流 Mini App Info Architecture (參考: Binance/Telegram Wallet/LINE Mini App)

| 類型                                | 布局                                     | Han 匹配度                           |
| ----------------------------------- | ---------------------------------------- | ------------------------------------ |
| **Card Carousel**                   | 單頁滾動卡片 (Summary → Detail → Detail) | ⭐⭐⭐⭐⭐ 最佳 (Han 每日滾一次看完) |
| **Bottom Tab Bar + Inner sub-tabs** | 固定 4-5 tab, 每 tab 內滾動              | ⭐⭐ (目前過多 tab)                  |
| **Accordion / Expand**              | 主卡 + 折疊細項                          | ⭐⭐⭐ (輔助折疊 Analysis)           |

---

## 4. 統一設計 (Proposed Layout)

### 4.1 DashboardView — 單頁 Card Carousel

```
<GlobalErrorBoundary>
  <div class="dashboard-view" style="padding-bottom: 140px">
    <!-- Header -->
    <header class="dash-header">
      <h2>投資儀表板</h2>
      <span class="dash-date">{{ todayLabel }}</span>
      <!-- 資料更新時間 footer -->
    </header>

    <!-- Summary Card: MarketSnapshot + DecisionHero -->
    <MarketSnapshot :status :latestReport ... />
    <DecisionHero :report :verdict ... />

    <!-- Discipline Banner (link to /reports) -->
    <div class="discipline-banner" @click="goToDiscipline">
      🔬 17 年大循環...
    </div>

    <!-- Coaching Advice (collapsible, default open) -->
    <CoachingAdvice :report ... />
    <!-- 內部: risk/心態/思路 3 個可折疑段 -->

    <!-- Health Card -->
    <HealthPanel :data="healthData" />

    <!-- Strategy Status Card (collapsible, default collapsed) -->
    <section class="strategy-status-card">
      <header @click="ssExpanded = !ssExpanded">📊 策略狀態 <chevron/></header>
      <collapse v-show="ssExpanded">
        <StrategyStatusView :report="latestReport" :health="healthData"/>
      </collapse>
    </section>

    <!-- Market Analysis Card (collapsible, default collapsed) -->
    <AnalysisPanel :report :news :scoreRows :defenseItems @open-news />
    <!-- radar 內建 -->
  </div>

  <!-- FAB: Strategy Config (drawer-modal) -->
  <TelegramMainButton label="⚙️ 策略設定" @click="openConfig"/>
</TelegramMainButton>
```

**架構決策**:

- **移除** `currentTab` ref + 5 個 top-level tabs
- **提升** `HealthPanel` / `AnalysisPanel` / `StrategyStatusView` 為卡片 (StrategyStatusView 加 collapsible)
- **StrategyConfigEditor** → `<el-dialog :append-to-body>` 或 drawer, FAB (FloatingActionButton) 觸發。Han 說「設定用 Modal」。
- **單一數據載入**: DashboardView `loadAll()` 載入 4 個 API 一次，prop 向下傳遞 (取代 StrategyStatusView 自載)。
- **FloatingPill**: 保持，News tab 加進來。

> 需要修改 `StrategyStatusView.vue`：目前自載 `fetchPortfolioHealth()`，改為 prop `:health`。**這是 refactoring，需小心** (risk R1)。

### 4.2 Bottom Nav 排序

| 順序 | Route        | Label           | Han 日常   |
| ---- | ------------ | --------------- | ---------- |
| 1    | `/dashboard` | 總覽            | ⭐⭐⭐⭐⭐ |
| 2    | `/radar`     | 市場雷達        | ⭐⭐⭐     |
| 3    | `/news`      | **新聞** (新增) | ⭐⭐⭐⭐   |
| 4    | `/simulator` | 模擬器          | ⭐⭐⭐     |
| 5    | `/account`   | 設定與帳戶      | ⭐⭐       |

> Han 每日: 總覽 → News (日報) → 模擬器(下單前) → 雷達(情緒) → 設定(不常)。News 第 3 易於存取。

### 4.3 NewsView — minimal change

僅確認預設子頁籤。目前 `activeTab = ref("report")` (預設精選報告)。確認 Han 是否要改預設為 `pool`。

---

## 5. Han 的決定 (2026-09-02)

| 問題                            | Han 決定                                        | 建議來源                      |
| ------------------------------- | ----------------------------------------------- | ----------------------------- |
| News tab 預設子頁籤             | `report` (精選報告)                             | Han 每日日報習慣              |
| StrategyStatusView              | **prop-driven** (refactor, 消除自載)            | 避免雙重 fetchPortfolioHealth |
| StrategyConfigEditor            | **Drawer** (sliding from bottom, gesture close) | Han 偏好手勢關閉              |
| StrategyHealthOverview.vue stub | **刪除**                                        | dead code, props shape 錯誤   |

---

## 6. 執行計畫 (TDD: RED → GREEN → REFACTOR → VERIFY)

> Han 說「依照你的建議執行」, 因此採納 Section 4 設計與 Han 7/27 的決定一併執行。

### Phase 0: 環境準備 & 盤點 (本節完成)

- [x] 盤點 DashboardView 5 tabs, NewsView 2 subtabs, 10 子元件 props
- [x] 設定計劃文件 + 結構 JSON (`docs/inventory/`)
- [ ] 驗證目前 unit 全綠 (anchor): `npx vitest run` → 323 pass (baseline)
- [ ] 驗證 E2E 全綠: `npx playwright test --workers=1` → 50 pass (baseline)

### Phase 1: News tab 加回 (最小改動, 先完成)

**TDD**: 先寫 E2E test → RED → 加 tab → GREEN

- [ ] Step 1: `01-dashboard.spec.js` 加入 `data-testid="nav-tab-news"` 驗證 (RED — tab 不存在)
- [ ] Step 2: `tabsConfig.js` 加 News tab: `📰 新聞` → `/news`，放在第 3 順位 (總覽 → 雷達 → **新聞** → 模擬器 → 設定)
- [ ] Step 3: `01-dashboard.spec.js` 驗證 News tab 顯示 (GREEN)
- [ ] Step 4: commit `feat(webapp): restore News tab in bottom nav`

### Phase 2: DashboardView 單頁 Card Carousel (TDD)

**TDD**: 先寫 DashboardView unit test → RED → refactor → GREEN → E2E

- [ ] Step 1: 建立 `webapp/src/test/views/DashboardView.test.js` — 驗證:
  - 不再有 `dashboard-tabs` top-level tab switcher (`data-testid="dashboard-tabs"` 不存在)
  - `HealthPanel`, `AnalysisPanel`, `StrategyStatusView` 同時渲染 (單頁)
  - StrategyStatus 折疼預設收起 (`aria-expanded=false` or `collapsed` class)
- [ ] Step 2: 跑 test → **RED** (目前 DashboardView 還是 5 tabs)
- [ ] Step 3: refactor `DashboardView.vue`:
  - 移除 `currentTab` ref + dash-tabs 按鈕群
  - 單頁渲染: MarketSnapshot → DecisionHero → DisciplineBanner → CoachingAdvice → HealthPanel → StrategyStatus (collapsible) → AnalysisCard (collapsible)
  - `loadAll` 同時 fetch 4 個 API, prop 向下傳
- [ ] Step 4: 跑 unit → **GREEN**
- [ ] Step 5: 更新 `01-dashboard.spec.js` E2E (tab selector → card scroll)
- [ ] Step 6: `verify-pages.sh dashboard news` health check
- [ ] Step 7: commit

### Phase 3: StrategyStatusView prop-driven refactor (TDD)

> Han 選擇 prop-driven.StrategyStatusView 目前自載 `fetchPortfolioHealth()`.

- [ ] Step 1: 建立 `StrategyStatusView` prop-driven test — 驗證收到 `:health` prop 不主動 fetch
- [ ] Step 2: RED → refactor StrategyStatusView.vue: prop `:health` 取代自載, 刪除 onMounted fetch
- [ ] Step 3: GREEN — 更新 DashboardView 傳 `healthData` prop
- [ ] Step 4: commit

### Phase 4: StrategyConfigEditor Drawer modal (TDD)

- [ ] Step 1: DashboardView.test.js 驗證 FAB `data-testid="fab-strategy-config"` + Drawer
- [ ] Step 2: RED → 實作 FAB trigger + `<el-drawer>` wrapping StrategyConfigEditorView
- [ ] Step 3: GREEN
- [ ] Step 4: commit

### Phase 5: 清理 stub

- [ ] 刪除 `webapp/src/components/dashboard/StrategyHealthOverview.vue` + 其 test
- [ ] 確認不再 import 任何地方
- [ ] commit

### Phase 6: 驗證 & E2E findings 記錄

- [ ] 更新 `D1/D2/D3` 發現記錄到 `docs/knowledge/e2e_findings.md`
- [ ] `verify-pages.sh` dashboard news simulator — FULL Green
- [ ] 全部 unit 100% pass + E2E workers=1 100% pass
- [ ] push, archive 計劃

---

## 7. 風險

| Risk                                                  | Impact            | Mitigation                         |
| ----------------------------------------------------- | ----------------- | ---------------------------------- |
| R1: StrategyStatusView refactor 862 lines, 耦合 fetch | 可能破 dashboard  | 先寫 prop-driven test 擷取行為     |
| R2: DashboardView 卡片過長 (滾動)                     | Han 使用 friction | Card collapsible 預設收起          |
| R3: News tab 加了新進口 (NewsView 472 lines, 2 API)   | 頁面載入          | News 已 self-loading, 無須共享數據 |

---

## 7. 盤點結果 — 無遺漏確認清單

- [x] DashboardView 5 tab 全部功能盤點 (Summary/Health/Analysis/Strategy/StrategyConfig)
- [x] NewsView 2 sub-tab 盤點 (report/pool) + 8 個 function
- [x] 10 個子元件 props/數據來源盤點
- [x] StrategyHealthOverview.vue stub 識別為 dead code
- [x] StrategyStatusView / StrategyConfigEditor 自載特性確認
- [x] FloatingPill nav 結構確認 (4 tab, 缺 News)
- [x] Router: `/news` route 存在, `/strategy-config` redirect存在
- [ ] **Han 問題 1/2/3 回答後** → 細化實作

## 6. Phase 執行結果 (2026-09-02, Han: "依照你的建議執行")

| Phase | 目標                                         | 結果                               | Commit   |
| ----- | -------------------------------------------- | ---------------------------------- | -------- |
| 0     | 環境盤點 + anchor commit                     | Unit 353/353, E2E 50/50            | (anchor) |
| 1     | News tab 加回 bottom nav                     | DSH-004 E2E pass; DSH-002/003 修正 | 32784d0  |
| 2     | DashboardView 單頁 Card Carousel             | Unit 357/357, E2E 4/4              | c8e633a  |
| 3     | StrategyStatusView prop-driven + schema 修正 | Unit 359/359, E2E 4/4              | 2240a22  |
| 4     | News tab E2E 驗證                            | NWS-001/002/003 pass               | 7c9df03  |

- TDD: RED → GREEN, tests-first
- 0 個 fabricate; 0 個未驗證 commit
- ESLint/Prettier hooks auto-pass (lint-staged)

### Schema mismatch 發現 (Phase 3 關鍵)

DashboardView `healthData` (from `/api/portfolio/health`, NEW summary schema) 餵给 StrategyStatusView 但後者需 `/api/strategy-status` detail schema → vue warn "Cannot read 'total' of undefined".

**解法**: 加 `fetchStrategyStatus` API fn, DashboardView parallel 抓兩者:

- `healthData` (portfolio/health) → HealthPanel card (summary)
- `strategyStatus` (/api/strategy-status) → StrategyStatusView prop (detail)

兩 endpoint 互補 (summary vs detail), 皆保留。

### 完成

設計盤點 + 實作 + 測試全驗通過。歸檔於此。
