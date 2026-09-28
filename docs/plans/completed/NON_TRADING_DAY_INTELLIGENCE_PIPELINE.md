---
title: "休市日市場與輿情情報管線（雙軌分離模式）實作計畫"
type: plan
status: archived
last_updated: 2026-09-28
tags:
  - scheduler
  - dailyCheck
  - non-trading-day
  - market-intelligence
  - telegram
wiki_links: []
---

# 休市日市場與輿情情報管線實作計畫

> **目標**：實現「休市不休網，行情凍結但情報流通」。在台股休市或節假日期間，解除 `dailyCheck` 的全流程熔斷，轉入「休市情報觀測軌」，持續採集並彙整國際總經、AI 精選新聞與社群情緒，產出當日報告並推播專屬休市情報卡，使 Telegram 與 WebApp 永遠保持最新動態。

---

## 一、架構設計

### 1. 雙軌流程設計

```text
dailyCheck 啟動
      │
      ▼
檢查台股開市狀態 (openToday)
      ├───────────────────────────────┐
      │ openToday = true             │ openToday = false
      ▼                               ▼
【常態交易軌】                   【休市情報軌】
├─ 計算即時技術指標              ├─ 沿用最後交易日收盤價與指標
├─ 執行策略引擎完整評分          ├─ 標註 marketStatus = "休市觀測"
├─ 產出加碼/風控決策            ├─ 採集最新總經 (VIX/美債/匯率)
├─ 採集總經/新聞/社群            ├─ 採集最新 AI 新聞與社群情緒
├─ 產出完整每日報告              ├─ 產出休市日情報報告 (YYYY-MM-DD.json)
└─ 發送 Telegram 完整戰報        └─ 發送 Telegram「休市情報卡」
```

### 2. 資料契約保證

- 每日報告檔案維持統一命名 `data/reports/YYYY-MM-DD.json`，不增加副檔名或不同結構。
- `openToday: false` 時，`signals` 保留上一交易日狀態，`marketState.marketOpen: false`，新聞與總經欄位填入最新即時數據。

---

## 二、執行階段（Phases）

- [x] **Phase 1: Telegram 休市情報卡模板 (`src/modules/notifications/templates/telegramHtmlBuilder.mjs`)**
  - 新增 `buildNonTradingDayMessage(data, webAppUrl)`。
  - 格式包含：休市提示、總經外圍風險（VIX、美債、匯率）、社群輿情偏向、重點新聞標題條列、Mini App 按鈕。
  - TDD 契約測試通過。
- [x] **Phase 2: Scheduler 調度與報告落地 (`src/scheduler/dailyCheck.mjs`)**
  - 解除 `if (!openToday) return;` 阻斷。
  - 當 `!openToday` 時，組裝休市日報告並透過 `archiveManager.saveReport` 儲存。
  - 發送 `buildNonTradingDayMessage` 卡片。
  - 測試覆蓋：休市日正常產出報告並推送情報卡。
- [x] **Phase 3: 文件更新與 Wiki 索引同步**
  - 更新 `bot.md` 與 `schedules.md`。
  - 重新生成 `wiki-index.json`、`wiki-graph.json`、`health-report.json`。
- [x] **Phase 4: 全套驗證、Lint 與 Commit**
  - 全套單元測試通過 (133 檔 1699 測試，0 失敗，0 skipped，0 todo)。
  - WebApp 測試通過 (60 檔 396 測試)。
  - ESLint 0 errors, 0 warnings。
  - npm run verify Exit Code 0。
