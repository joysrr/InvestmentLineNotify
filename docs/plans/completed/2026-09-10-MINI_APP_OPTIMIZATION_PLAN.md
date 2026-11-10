---
type: plan
status: completed
last_updated: 2026-09-10
tags:
  - completed
  - archived
wiki_links: []
---

# Mini App 用戶體驗與版面優化計畫 (2026-09-10-MINI_APP_OPTIMIZATION_PLAN.md)

> **狀態**：Completed
> **建立日期**：2026-09-06
> **背景**：根據 Han 對 Mini App 的實測反饋，進行第二階段用戶體驗優化：消除資訊重複（確保資訊不消失，但同一指標不重複出現）、手機端 RWD 溢出修復、恢復日/週/月報專區，並清理無用靜態資訊。

---

## 🎯 四大優化任務詳細分析與計畫

### 1. 總覽資訊盤點與指標重複整併 (Overview Deduplication & SSOT)

- **整併原則**：**資訊不消失，但同一指標/數據在頁面中只在最適合的區塊出現一次 (Single Source of Truth)**。

- **跨區塊重複指標點對點梳理**：
  1. **維持率 & 綜合槓桿 (Maintenance Margin & Gross Leverage)**：
     - _原情況_：在 `MarketSnapshot`（曝險 GL）、`StrategyStatusView` Section 8（風險矩陣）與 Section 9（關鍵指標速覽）三處重複出現。
     - _整併_：`MarketSnapshot` 移除 GL，`StrategyStatusView` Section 9 移除重複的維持率與槓桿卡片。**統一由 `StrategyStatusView` Section 8（帶燈號風控矩陣）作為槓桿與維持率的唯一展示點**。
  2. **估值 PR (PB/PE Percentile)**：
     - _原情況_：在 `MarketSnapshot`（PB 分位數）、`StrategyStatusView` Section 9（估值 PR）與 `AnalysisPanel` 三處重複。
     - _整併_：**統一由 `MarketSnapshot` 頂層卡片作為估值 PR 的唯一即時展示點**；`StrategyStatusView` Section 9 刪除重複的 PR 欄位，專注於淨資產與 Z2 佔比。
  3. **景氣燈號 (Light Status)**：
     - _原情況_：在 `MarketSnapshot` 與 `HealthPanel` (Hero) 兩處重複。
     - _整併_：`MarketSnapshot` 展示即時燈號燈標；`HealthPanel` 專注於「帳戶健康綜合評分 (0-100)」，避免圖示與文字雙重疊加。
  4. **買賣訊號與動作建議 (Target & Suggestion)**：
     - _原情況_：在 `DecisionHero`、`CoachingAdvice`（策略定調）與 `StrategyStatusView` Section 6 散落重複。
     - _整併_：**融合成單一「🤖 AI 決策與教練戰術」 Hero 卡片**。上層顯眼標示當日標的與建議，下層折疊收納風險提示與觀察清單，刪除 `CoachingAdvice` 中的重複「策略定調」與 `HealthPanel` 中的重複「建議行動」。

### 2. 手機端 (Mobile RWD) 排版與溢出最佳化

- **能力評估與承諾**：完全具備處理能力。
- **問題分析與修復重點**：
  - 窄螢幕 (375px Viewport) 下，`ThresholdItem`, `BudgetItem`, `RiskItem`, `MetricItem` 的 Grid/Flex 欄位會擠壓溢出或出現橫向滾動條。
  - **修復措施**：
    - 全面調整數字與標籤字級（13px/12px），`padding` 從 16px 精簡至 10-12px。
    - 替金額與長字串加上 `overflow: hidden; text-overflow: ellipsis;` 及 `word-break: break-all`。
    - ECharts 雷達圖改用自適應容器與 `autoresize`，避免超出卡片邊界。
  - **自動化驗證**：新增 Playwright 375px Viewport 測試 (`01-mobile-rwd.spec.js`) 檢查 `scrollWidth <= clientWidth`。

### 3. 日報、週報、月報 (Reports) 區塊恢復

- **現狀分析**：`ReportsView.vue` 頁面與 API (`/api/reports`) 功能完整，且已支援 daily/weekly/monthly 三分頁，但因 Bottom Nav 與頁面無入口導致功能隱形。
- **最佳呈現方案**：
  - **新聞與簡報中心 (News & Reports Hub)**：
    將 `NewsView.vue` (新聞頁面) 擴充為 **新聞與簡報中心**：
    - Subtab 1: 📰 今日新聞集錦 (News Pool)
    - Subtab 2: 📅 日報 / 週報 / 月報歷史簡報 (整合 `ReportsView.vue` 的完整功能)
  - 此方案讓所有資訊性內容集中在「新聞與簡報」主分頁，保持儀表板純粹專注於當前決策與帳戶狀態。

### 4. 移除 17 年大循環歷史數據橫幅 (.discipline-banner)

- **清理內容**：
  - 移除 `DashboardView.vue` 中的 `<div class="discipline-banner">` 靜態 HTML 區塊。
  - 移除 `.discipline-banner`, `.banner-icon`, `.banner-body`, `.banner-title`, `.banner-desc` 等 CSS 樣式。
  - 刪除 `goToDiscipline()` 事件處置函式。
  - 同步修復 Unit/E2E 測試中的橫幅點擊斷言。

---

## 📅 開發階段劃分 (Phases)

| Phase       | 任務                                 | 預計產出                                                                                                 |
| ----------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| **Phase 1** | 移除 `.discipline-banner` 靜態橫幅   | ✅ 完成：刪除無用橫幅+CSS+事件，360 Unit/4 E2E 綠 (Commit)                                               |
| **Phase 2** | 新聞與簡報中心整合 (日/週/月報恢復)  | ✅ 完成：擴充 `NewsView.vue` + `ReportsView` 歷史簡報 subtab + NWS-004 E2E (Commit)                      |
| **Phase 3** | 手機端 RWD 排版溢出修復              | ✅ 完成：`BudgetItem`/`MetricItem`/`ThresholdItem` `word-break` 防護 + 375px Playwright RWD E2E (Commit) |
| **Phase 4** | 總覽指標獨立性整併 (SSOT 唯一展示點) | ✅ 完成：`MarketSnapshot`/`StrategyStatusView`/`CoachingAdvice`/`HealthPanel` 重複指標梳理剔除 (Commit)  |
| **Phase 5** | 全套單元與 E2E 驗證歸檔              | ✅ 完成：360/360 Unit + 65/65 E2E (含 375px RWD) 綠燈 + npm run build 成功 + 歸檔 active 計畫            |

---

## 🧪 驗證與品質門檻

- **TDD Enforcement**：修復/變更前先調整單元測試與 E2E 測試。
- **Mobile Viewport Check**：Playwright 在 375px (iPhone SE) 寬度無橫向滾動溢出。
- **Lint & Build**：0 ESLint errors，`npm run build` 成功。
