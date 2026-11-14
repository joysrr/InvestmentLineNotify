---
type: plan
status: in-progress
last_updated: 2026-11-14
owner: 開發者
reviewer: 規劃者
tags:
  - webapp
  - refactor
  - phase-4
---

# 階段四 · 內容去重（CARD-01 子計畫詳細細節）

## 概覽

階段四聚焦「同一資訊多處呈現」的去重，由 CARD-01～CARD-03 執行。去重原則（D0）：同一資訊僅有一個權威來源，其他入口透過引用、drawer 或 redirect 連接，避免複製貼上導致資訊不同步。

## 範圍（取自母計畫 §階段四）

- Dashboard ↔ StrategyStatus：StrategyStatusView 31.6 KB 拆分為摘要（Dashboard 內嵌）與完整面板（drawer），原獨立路由廢止。
- News 精選報告 vs 新聞池：資料源不同（fetchReportNews vs fetchNews），採「標記＋說明」而非「置頂或合併」。
- 指標卡：MarketRadar / Technical 未遷移部分統一遷移至 StatCard，四種 status（ok/warn/danger/neutral）跨頁統一映射。

## 子卡對應

| 子卡    | 去重焦點            | 主要產出                                                            | 狀態   |
| ------- | ------------------- | ------------------------------------------------------------------- | ------ |
| CARD-01 | StrategyStatus 去重 | StrategyStatusSummary.vue、StrategyStatusPanel.vue、router redirect | 已完成 |
| CARD-02 | News 資料源釐清     | NewsCard.vue、utils/newsMatch.js、NewsView.vue 改寫                 | 待驗收 |
| CARD-03 | 指標卡跨頁統一      | MarketRadarView.vue、TechnicalView.vue 遷移 StatCard                | 待驗收 |

### CARD-03 覆蓋率差異說明

CARD-00 基準：`grep -c 'radar-card'` 得 10（含 CSS 類定義 1 行，實際卡片 9）；`grep -c 'indicator-card'` 得 6（含 CSS 類定義 1 行，實際卡片 5）。

本次遷移：MarketRadarView.vue 9 張 radar-card → StatCard，TechnicalView.vue 5 張 indicator-card → StatCard，9 + 5 已全覆蓋。

重新執行 grep 證據（已遷移，僅剩 CSS 類定義）：

- `radar-card`：1 行（MarketRadarView.vue）
- `indicator-card`：1 行（TechnicalView.vue）
- `StatCard` 引用：MarketRadarView.vue 19 行、TechnicalView.vue 11 行

## 驗收（階段四）

- [x] CARD-01：StrategyStatusView 拆分為摘要＋drawer，原路由保留 redirect

### 測試數變化說明（CARD-01）

| 項目                   | 數量 | 說明                                                                              |
| ---------------------- | ---- | --------------------------------------------------------------------------------- |
| CARD-01 初次提交後總數 | 627  | 含 StrategyStatusSummary (4) + StrategyStatusPanel (5)                            |
| 新增測試               | +2   | HealthPanel `detail-link` 改 emit (1) + StrategyStatusSummary 點擊交互 (1)        |
| 刪除孤兒測試           | −20  | `StrategyStatusView.test.js`、`StrategyStatusView.errorBoundary.test.js` 共 20 個 |
| 淨變化                 | −18  | +2 − 20 = −18                                                                     |
| 最終總數               | 609  | 609/609 全綠（96 檔案）                                                           |

- [ ] CARD-02：News 精選報告與新聞池分離，資料源關係說明完整
- [ ] CARD-03：MarketRadar / Technical 指標卡 100% 使用 StatCard
- [ ] `npm --prefix webapp run lint` 0 errors / 0 warnings
- [ ] `npm --prefix webapp run test` 全綠
- [ ] 體積預算：Initial ≤ 156.0 KB、Total ≤ 380.0 KB

## §欄位對照表（CARD-01）

原 `StrategyStatusView` 單一頁面承載全部欄位，CARD-01 拆分為 `StrategyStatusSummary.vue`（摘要，供 Dashboard 內嵌）與 `StrategyStatusPanel.vue`（完整面板，後續以 drawer 呈現）。兩者共用 `health` prop 契約：

| 欄位                         | 來源                         | StrategyStatusSummary              | StrategyStatusPanel            |
| ---------------------------- | ---------------------------- | ---------------------------------- | ------------------------------ |
| `health.weightScore.total`   | `health.weightScore.total`   | 顯示策略總分（pt）                 | 分數構成標籤頁顯示總分與明細   |
| `health.cooldown.inCooldown` | `health.cooldown.inCooldown` | 冷卻期文字（剩餘 X 天 / 無冷卻期） | 風控與機制標籤頁顯示冷卻期狀態 |
| `health.cooldown.daysLeft`   | `health.cooldown.daysLeft`   | 顯示剩餘天數                       | 同上                           |
| `health.timestamp`           | `health.timestamp`           | 顯示更新時間                       | 顯示更新時間                   |
| `loading`                    | 外部傳入                     | 顯示 skeleton-list                 | 顯示 skeleton-list             |
| `error`                      | 外部傳入                     | 顯示 inline-error 並隱藏內容       | 顯示 inline-error              |

路由變更：`/strategy-status` 獨立路由廢止，改為 redirect 到 `/dashboard?panel=strategy-status`。Dashboard `HealthPanel.detail-link="/strategy-status"` 將在後續卡片重新導向（目前 redirect 保底）。

## 未決事項

- CARD-00 第 2 項（StatCard 在 Radar / Technical 的覆蓋率）結果將直接影響 CARD-03 遷移範圍。

---

## §現狀盤點附錄（CARD-00 步驟 B）

以下六項核實結果皆來自 main @ 0c8f1d7 的實際檔案與工作流程檔，並附指令與原始輸出。六項全部有結論，無空項。

### 1. FloatingPill.vue 導航項數與目標

指令：

```
grep -n "router-link\|to=" webapp/src/components/FloatingPill.vue
grep -c "<router-link" webapp/src/components/FloatingPill.vue
sed -n '1,60p' webapp/src/config/tabsConfig.js
```

原始輸出：

```
4:      <router-link
7:        :to="tab.to"
17:      </router-link>
1
/** 5 大 Bottom Nav 靜態設定檔 */
export const tabs = [
  { to: "/dashboard", label: "總覽", ... },
  { to: "/radar", label: "市場雷達", ... },
  { to: "/news", label: "新聞", ... },
  { to: "/theory", label: "理論", ... },
  { to: "/account", label: "設定與帳戶", ... },
]
```

結論：**5 項**，分別為 總覽(/dashboard)、市場雷達(/radar)、新聞(/news)、理論(/theory)、設定與帳戶(/account)。數量為 5，但當前仍為舊路由結構（/radar、/theory 尚未收斂），語義上與 D4 目標結構（/dashboard、/insights、/chart、/news、/account）不同；CARD-04 將負責收斂。

### 2. StatCard 在 Radar / Technical 的覆蓋率

指令：

```
grep -c "<StatCard" webapp/src/views/MarketRadarView.vue webapp/src/views/TechnicalView.vue
grep -c 'radar-card' webapp/src/views/MarketRadarView.vue
grep -c 'indicator-card' webapp/src/views/TechnicalView.vue
```

原始輸出：

```
webapp/src/views/MarketRadarView.vue:9
webapp/src/views/TechnicalView.vue:5
10
6
```

結論：**Radar 9/9（100%）、Technical 5/5（100%）**。「指標卡」相關 CSS 類定義各 1 行（radar-card 10 行、indicator-card 6 行含定義），實際卡片數為 9 與 5，CARD-00/CARD-03 已全遷移至 StatCard。

### 3. App.vue 的 <keep-alive> include

指令：

```
grep -n "keep-alive\|include" webapp/src/App.vue
```

原始輸出：

```
11:        <keep-alive :max="5">
18:        </keep-alive>
70:    if (rootPaths.includes(path)) {
```

結論：**無 include 屬性**。實際寫法為 `<keep-alive :max="5">` 僅限定快取數量，未限定 include 元件白名單。

### 4. CI 是否含 bundle 體積檢查

指令：

```
grep -rn "check-bundle-size\|bundle" .github/workflows/
```

原始輸出：

```
（無輸出）
```

結論：**無**。.github/workflows/ 內未出現 check-bundle-size 或 bundle，CI 目前不含 bundle 體積檢查步驟。

### 5. TheoryView 是否承載模擬器／推演（決策 D5 依據）

指令：

```
grep -n "simulator\|模擬\|推演" webapp/src/views/TheoryView.vue
```

原始輸出：

```
（無輸出）
```

結論：**不承載**。TheoryView.vue 內無 simulator、模擬、推演任何關鍵字，不承載模擬器/推演功能。依此，D5 判定為「不存在模擬器頁」，Theory 併入方式依 D1 移入「帳戶與設定」的「關於」區段。

### 6. 全站 window.open 殘留

指令：

```
grep -rn "window.open" webapp/src/
```

原始輸出：

```
webapp/src/composables/useTelegram.test.js:343:  it("falls back to window.open outside Telegram", () => {
webapp/src/composables/useTelegram.js:146:      window.open(url, "_blank");
```

結論：**2 處**。1 處實作（useTelegram.js:146）、1 處測試斷言（useTelegram.test.js:343）。屬 Telegram 外部開啟邏輯之預期實作，非遺留廢棄碼。

驗收：六項核實全部有結論與證據，無空項。
