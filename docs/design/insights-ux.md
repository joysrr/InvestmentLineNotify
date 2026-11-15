---
title: Insights 頁面 UX 設計記錄
type: reference
status: current
last_updated: 2026-11-14
tags:
  - insights
  - ux
  - design
wiki_links: []
last_verified: 2026-11-15
summary: 洞察頁面 UX 規格。
related_code: []
related_docs: []
---

# Insights 頁面 UX 設計記錄

本文件記錄 Insights 頁面的設計決策、與原計畫的偏離及理由。

## 1. 子頁籤結構（不合併）

Insights 頁面保留兩個獨立子頁籤：

| 頁籤     | 內容                             | 組件            |
| -------- | -------------------------------- | --------------- |
| 市場雷達 | 9 張市場分類 StatCard + 掃描結論 | MarketRadarView |
| 多空對決 | 多頭/空頭事件雙欄積分條          | MacroBattleView |

**不合併兩個子頁籤** — 這是計畫禁止條款。兩個區塊服務不同決策層級：市場雷達偏「現狀掃描」，多空對決偏「事件駆動」。

## 2. MarketRadar 分組邏輯：保持「市場」分組

### 現有分組（已採用）

- 美股市場（section）
- 台股市場（section）
- 融資餘額（section）

### 計畫原本建議（未採用）

- 趨勢類（MA、MACD）
- 動能類（RSI、KD）
- 波動類（ATR、布林通道）
- 量能類（成交量）

### 偏離理由

單人使用者更關心「美股現在如何、台股現在如何」，而非「所有趨勢指標如何」。按指標類型分組會把同一市場的資訊打散，增加認知負擔。計畫的分組是「從指標庫視角」寫的，現有的「市場」分組是「從使用者視角」寫的，後者更好。

## 3. MacroBattle 佈局：桌面雙欄 + 360px 堆疊

### 現有佈局（已調整）

- `.score-wrap`：`display: flex; flex-direction: row`（桌面左右並排）
- `@media (max-width: 360px)`：`flex-direction: column`（360px 以下上下堆疊）

### 設計令牌遷移

- `.event-card--bull` 背景：`rgba(38, 161, 123, 0.08)` → `var(--iln-ok-bg)`
- `.event-card--bear` 背景：`rgba(232, 72, 85, 0.08)` → `var(--iln-danger-bg)`

## 4. InsightsView tab 切換行為：router.replace（刻意）

## 深層連結代價

router.replace + 無 watch 的決策代價：不支援深層連結。訪問 `/#/insights?tab=macro` 不會自動切換到多空對決 tab，E2E 需透過點擊 SubTabBar 切換，而非直接訪問 URL。若未來需要分享子頁面連結（例如「看看這個多空對決」），接收者打開會是空白，需改為 router.push + watch 才能支援。

### 實作

```js
router.replace({
  query: label === "多空對決" ? { tab: "macro" } : { tab: "radar" },
});
```

### 決策：保留 replace，不加 watch

| 項目                              | 決策           | 理由                                                                                                  |
| --------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| `router.replace` vs `router.push` | 保留 `replace` | TMA 返回鍵會離開小程式，tab 切換不應在瀏覽歷史中新增記錄，避免歷史堆積                                |
| `watch(route.query.tab)`          | 不補           | `activeTabLabel` 為 computed 已響應式讀取 `route.query.tab`；TMA 使用者不會手動改 URL，無深層連結需求 |

## 5. MarketRadar 掃描結論一行

在 9 張 StatCard 上方新增 `.scan-conclusion` 列，顯示「N 項偏多、M 項偏空、K 項中性」，使用設計令牌（`--iln-surface`, `--iln-brand`, `--iln-text`）。

## 6. 測試目錄技術債

專案存在兩套測試目錄（`src/test/` 與 `src/test/views/`），CARD-5.4 發現但未合併。建議在 CARD-5.6 或階段六處理測試目錄統一。
