---
title: 圖表頁 UX 規格
stage: CARD-5.3
status: done
type: reference
last_updated: 2026-11-14
---

# 圖表頁 UX 規格

## 圖表庫

- echarts 5.5.1 + vue-echarts 7.0.3
- **不啟用 DataZoom**，理由：**B** — DataZoom 在 360px 觸控環境下的縮放手勢與頁面滾動易衝突，觸控體驗不佳；改用「時間範圍按鈕重新查詢資料」避免此問題，亦避免功能重疊讓使用者困惑（理由 A 兼容）。
- 時間範圍切換採「按鈕重新查詢資料」，不啟用縮放/平移。

## 時間範圍切換

| 範圍 | 按鈕寬 | 按鈕高 | 觸控友善 (≥44px) |
| ---- | ------ | ------ | ---------------- |
| 1M   | ≥ 44px | ≥ 44px | ✅               |
| 3M   | ≥ 44px | ≥ 44px | ✅               |
| 6M   | ≥ 44px | ≥ 44px | ✅               |
| 1Y   | ≥ 44px | ≥ 44px | ✅               |
| ALL  | ≥ 44px | ≥ 44px | ✅               |

- 5 個按鈕排列在 `.time-range-bar` 容器內，使用 flex + gap，360px 下不換行、不橫向滾動。
- 切換時觸發 `watch([granularity, timeRange], load)`，重新 fetch 對應 limit 的快照資料。

## TechnicalPanel 指標卡

- 5 張 `StatCard`：RSI、KD（K）、KD（D）、乖離率 MA240、MACD
- 每張 StatCard 的 `#suffix` 插槽放置 `<Icon name="info">`，點擊後展開 `.indicator-desc` 說明區
- 接收 `timeRange` prop（預設 "ALL"），與 ChartView 的時間範圍聯動
- 狀態透過 `indicatorInfo` 映射：ok / warn / danger / neutral

## Tooltip 一致性

- 透過 echarts `tooltip.textStyle` 套用 `--iln-text` 設計令牌
- 無裸色碼（bare hex/rgba），所有顏色皆使用 `--iln-*` 令牌

## 已知限制

- DataZoom 未啟用（理由 B：360px 觸控環境縮放手勢與頁面滾動衝突）
- 若未來需啟用縮放/平移，須重新評估 360px 觸控衝突與 bundle 體積影響

## 360px 驗證

- 幾何斷言：每個時間範圍按鈕 `getBoundingClientRect().width ≥ 44` 且 `height ≥ 44`（實際測得寬 60.80px、高 44.00px）
- `document.documentElement.scrollWidth ≤ clientWidth`（實際 360 ≤ 360，無橫向滾動）
- 無截圖驗證，僅使用幾何斷言
