---
type: matrix
status: in-progress
last_updated: 2026-11-14
owner: 開發者
reviewer: 規劃者
tags:
  - design
  - architecture
  - information-architecture
  - phase-3
  - phase-4
---

# 頁面職責矩陣（Page Responsibility Matrix）

> 本文件為 CARD-04（一級入口收斂）的驗收對照表。CARD-04 完成後，每個一級入口的實際內容應與本矩陣一致。
>
> 目標：一級入口從 9 個獨立視圖收斂為 5 個，舊路由設 redirect 至新入口。

## 一、5 個一級入口職責邊界

| 入口       | 路徑         | 承載頁面 / 子元件                                                                         | 職責範圍                                      | 狀態                            |
| ---------- | ------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------- |
| 總覽       | `/dashboard` | `DashboardView.vue`                                                                       | 策略狀態 drawer（HealthPanel 觸發）、摘要概覽 | ✅ CARD-01 已完成，CARD-04 不動 |
| 市場洞察   | `/insights`  | 新增 `InsightsView.vue`<br>子元件：`MarketRadarView.vue`、`MacroBattleView.vue`           | 市場雷達 + 宏觀戰盤，兩視圖並列               | ⏳ CARD-04 新增                 |
| 圖表       | `/chart`     | `ChartView.vue`<br>SubTabBar 承載 chart / technical 兩 tab<br>子元件：`TechnicalView.vue` | 價格與指標視覺化 + 技術指標詳細面板           | ⏳ CARD-04 合併                 |
| 新聞與報告 | `/news`      | `NewsView.vue`（CARD-02 已重構）                                                          | 新聞池 + 精選報告                             | ⏳ CARD-04 僅更新路由           |
| 帳戶與設定 | `/account`   | `AccountView.vue`<br>子區段：「關於」（承載 `TheoryView.vue` 內容）                       | 帳戶設定、關於／理論內容                      | ⏳ CARD-04 Theory 併入          |

## 二、舊路由 redirect 對照表

| 舊路徑       | redirect 目標          | 說明                            |
| ------------ | ---------------------- | ------------------------------- |
| `/radar`     | `/insights?tab=radar`  | MarketRadar 收斂入 Insights     |
| `/macro`     | `/insights?tab=macro`  | MacroBattle 收斂入 Insights     |
| `/technical` | `/chart?tab=technical` | Technical 收斂入 Chart          |
| `/theory`    | `/account?panel=about` | Theory 併入 Account「關於」區段 |

> `/strategy` → `/strategy-config`（既有，CARD-04 不動）
> `/strategy-status` → `/dashboard?panel=strategy-status`（CARD-01 已完成，CARD-04 不動）

## 三、FloatingPill 導航項（新結構，5 項）

| 項次 | 標籤       | 路徑         |
| ---- | ---------- | ------------ |
| 1    | 總覽       | `/dashboard` |
| 2    | 市場洞察   | `/insights`  |
| 3    | 圖表       | `/chart`     |
| 4    | 新聞與報告 | `/news`      |
| 5    | 帳戶與設定 | `/account`   |

> 舊結構：總覽、市場雷達、新聞、理論、設定與帳戶（5 項，舊語義）
> 新結構：總覽、市場洞察、圖表、新聞與報告、帳戶與設定（5 項，新語義）

## 四、子視圖路徑決策（裁定記錄）

1. **Insights 子視圖**：保留原檔路徑 `views/MarketRadarView.vue`、`views/MacroBattleView.vue`，`InsightsView.vue` 以相對 import 引入。目錄重組留待階段五。
2. **Chart + Technical**：使用 `SubTabBar` 併入，`ChartView.vue` 承載 chart/technical 兩 tab，`TechnicalView.vue` 作為子元件；若單檔 > 15 KB 再拆為 `components/chart/TechnicalPanel.vue`，決策記錄於 commit message。
3. **keep-alive**：`<keep-alive :max="5">` 無 include 屬性。5 個一級入口 + 子視圖快取壓力可能超過 5，CARD-04 步驟 E 第 3 點需評估是否調高 `:max`。

## 五、驗收檢查清單（與程式碼一致性驗證）

| #   | 驗收項                                        | 驗證指令                                                                                   | 預期結果                                                                 |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 1   | `views/` 僅保留 5 個一級入口頁面              | `ls webapp/src/views/`                                                                     | DashboardView、InsightsView、ChartView、NewsView、AccountView 及其子元件 |
| 2   | 舊路由 redirect 已設定                        | `grep -n "/radar\|/macro\|/technical\|/theory" webapp/src/router/index.js`                 | 各舊路徑對應 redirect 至新入口                                           |
| 3   | InsightsView 引入 MarketRadar 與 MacroBattle  | `grep -n "MarketRadarView\|MacroBattleView" webapp/src/views/InsightsView.vue`             | 兩 child component 被 import                                             |
| 4   | ChartView 使用 SubTabBar 承載 chart/technical | `grep -n "SubTabBar\|technical" webapp/src/views/ChartView.vue`                            | SubTabBar 出現，technical tab 存在                                       |
| 5   | AccountView 包含「關於」區段承載 Theory 內容  | `grep -n "關於\|Theory" webapp/src/views/AccountView.vue`                                  | 關於區段存在                                                             |
| 6   | FloatingPill 為新 5 項結構                    | `grep -n "label\|to=" webapp/src/config/tabsConfig.js`                                     | 5 項為 /dashboard, /insights, /chart, /news, /account                    |
| 7   | 無殘留舊路由直接渲染                          | `grep -rn "MarketRadarView\|MacroBattleView\|TechnicalView\|TheoryView" webapp/src/views/` | 僅在對應子元件/父頁面中出現，無獨立路由渲染                              |

---

## 附錄：CARD-04 步驟對應

- 步驟 A：路由重構（新增 /insights、/chart；移除 /radar、/macro、/technical、/theory；設 redirect）
- 步驟 B：InsightsView 新增（MarketRadar + MacroBattle 子元件）
- 步驟 C：ChartView 與 TechnicalView 合併（SubTabBar）
- 步驟 D：TheoryView 併入 Account「關於」區段
- 步驟 E：FloatingPill 更新為新 5 項；keep-alive 評估
- 步驟 F：全面測試與 build 預算驗證（Initial ≤156 KB，Total ≤380 KB）
