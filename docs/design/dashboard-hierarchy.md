---
title: Dashboard 頁面層級結構
stage: CARD-5.1
status: done
type: explanation
last_updated: 2026-11-15
tags:
  - dashboard
  - hierarchy
  - ux
  - design
wiki_links: []
---

# Dashboard 頁面層級結構

本文件記錄 Dashboard 頁面的三層金字塔 UX 架構（L1 核心決策 / L2 雙核心駕駛艙 / L3 漸進折疊抽屜），以及各層所用組件與資料來源。

## L1：核心決策區（health-hero-v2）

位於 `.dashboard-card.health-card` 頂部，即時呈現最關鍵資訊，供使用者一眼掌握帳戶狀態。

| 欄位           | 組件                       | 資料來源                    | 說明                                                                 |
| -------------- | -------------------------- | --------------------------- | -------------------------------------------------------------------- |
| score          | StatCard                   | `status.score`              | 帳戶健康分數（/100），透過 `statusClass` 映射 ok/warn/danger/neutral |
| summary        | 文字                       | `status.summary`            | 一句話摘要                                                           |
| status         | 狀態徽章                   | `status.status`             | 狀態標籤                                                             |
| lightStatus    | emoji + label              | `status.lightStatus`        | 情境燈號（情緒/趨勢）                                                |
| freshness      | FreshnessBadge             | `status._meta.lastRun`      | 資料新鮮度（fresh/stale/expired）                                    |
| expired banner | `.freshness-expired-alert` | FreshnessBadge level-change | 資料過期時的 L1 頂部警示條                                           |

### 設計決策

- FreshnessBadge 放在 L1 區塊（HealthPanel 之前），資料過期時顯示 `.freshness-expired-alert` 於 health-card 頂部。
- Footer 保留純文字時間戳，不重複 FreshnessBadge。

## L2：雙核心駕駛艙（health-grid-v2）

兩個象限並排（桌面）/ 上下堆疊（360px），呈現六個核心維度：

| 維度       | 組件 | 資料來源                | 說明         |
| ---------- | ---- | ----------------------- | ------------ |
| margin     | 卡片 | `components.margin`     | 保證金維持率 |
| survival   | 卡片 | `components.survival`   | 生存空間     |
| decoupling | 卡片 | `components.decoupling` | 脫鉚指標     |
| leverage   | 卡片 | `components.leverage`   | 槓桿比率     |
| lifecycle  | 卡片 | `components.lifecycle`  | 週期階段     |
| regime     | 卡片 | `components.regime`     | 市場體制     |

### 設計決策

- L2 六個 component 使用現有 card grid，不使用 CollapsibleSection（避免過度折疊隱藏關鍵資訊）。
- 每張 card 顯示數值 + 狀態色碼，點擊可進入 L3 抽屜看明細。

## L3：漸進折疊抽屜

點擊 L2 卡片後展開，呈現該維度的詳細明細：

| 抽屜                 | 觸發方式                              | 內容                   |
| -------------------- | ------------------------------------- | ---------------------- |
| 市場總經環境明細     | 點擊 L2 相關 card                     | 總經事件、多空對決詳情 |
| 資產風控與維持率明細 | 點擊 L2 相關 card                     | 風險指標、維持率趨勢   |
| 策略狀態 Drawer      | HealthPanel / 摘要卡 / redirect query | 策略狀態詳情           |

## 與原計畫的偏離

| 項目                | 原計畫             | 實際實作              | 理由                                |
| ------------------- | ------------------ | --------------------- | ----------------------------------- |
| FreshnessBadge 位置 | Footer             | L1 health-card        | L1 可見度更高，資料過期時需即時警示 |
| L2 card 展開方式    | CollapsibleSection | 現有 card grid + 抽屜 | 避免過度折疊隱藏關鍵風險資訊        |

## 360px 驗證

- L1 health-card：無橫向滾動，FreshnessBadge 與 expired banner 在 360px 下不換行、不溢出（見 16-freshness-alert-360px.spec.js、19-account-360px.spec.js）。
- L2 health-grid-v2：桌面並排、360px 上下堆疊（見 MacroBattle 類似媒體查詢模式）。
- L3 抽屜：360px 下彈出式覆蓋，不破壞頁面佈局。

## 參考

- state-presentation.md：StateBlock 決策記錄（EmptyState / ErrorAlert / LoadingSkeleton 三態）
- freshness-semantics.md：新鮮度門檻（fresh < 3600s / stale 3600-21600s / expired > 21600s）
