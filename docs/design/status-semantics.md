---
type: reference
status: current
last_updated: 2026-11-14
tags:
  - design
  - status-semantics
wiki_links: []
---

# 狀態語義規範 (Status Semantics)

本文定義專案中四種狀態 (ok / warn / danger / neutral) 的語義、對應的設計トクン，以及各視圖 `cardClassToStatus` 的映射關係。

## 四態定義與適用場景

| 狀態      | 語義                   | 適用場景                                 |
| --------- | ---------------------- | ---------------------------------------- |
| `ok`      | 正常、健康、可安心持有 | 指標在安全區間、市場無異常、信號偏多頭   |
| `warn`    | 注意、觀望、需關注     | 指標接近臨界區間、市場波動加劇、信號混雜 |
| `danger`  | 風險高、避險、減碼     | 指標進入危險區間、市場崩跌、信號強烈偏空 |
| `neutral` | 中性、無明確方向       | 數據缺失、指標未觸發任何閾值、處於觀察期 |

## 顏色令牌 (--iln-*)

所有色碼皆引用 `webapp/src/styles/tokens.css` 的 CSS 變數：

| 狀態      | 變數名          | 色碼      | 用途                |
| --------- | --------------- | --------- | ------------------- |
| `ok`      | `--iln-ok`      | `#10b981` | 正常狀態文字/邊框色 |
| `warn`    | `--iln-warn`    | `#f59e0b` | 注意狀態文字/邊框色 |
| `danger`  | `--iln-danger`  | `#ef4444` | 風險狀態文字/邊框色 |
| `neutral` | `--iln-neutral` | `#94a3b8` | 中性狀態文字/邊框色 |

相關輔助變數（同 `tokens.css`）：

- `--iln-ok-bg` / `--iln-warn-bg` / `--iln-danger-bg`：狀態背景填充 (淺色)
- `--iln-ok-text` / `--iln-warn-text` / `--iln-danger-text`：狀態文字色
- `--iln-neutral-fill-faint` / `--iln-neutral-fill-border-faint`：中性填充與邊框

## 各視圖 cardClassToStatus 映射表

### MarketRadarView (Radar 卡片)

來源：`webapp/src/views/MarketRadarView.vue` `cardClassToStatus(cls)`

| Radar 卡片類別 (cardClass) | 對應 status | 說明                   |
| -------------------------- | ----------- | ---------------------- |
| `card-danger`              | `danger`    | 風險高                 |
| `card-warn`                | `warn`      | 需注意                 |
| `card-ok`                  | `ok`        | 正常                   |
| `card-blue`                | `null`      | 中性資訊，不帶狀態顏色 |

### TechnicalView (技術指標卡片)

來源：`webapp/src/views/TechnicalView.vue` `cardClassToStatus(cls)`

| 技術指標類別 (cardClass) | 對應 status | 說明          |
| ------------------------ | ----------- | ------------- |
| `ind-danger`             | `danger`    | 指標危險      |
| `ind-warn`               | `warn`      | 指標警告      |
| `ind-ok`                 | `ok`        | 指標正常      |
| `ind-buy`                | `ok`        | 買訊號，同 ok |

## StatCard 行為：status 為 null 時

`StatCard.vue` 的 `status` prop 預設為 `null`，可接受值：`null \| 'ok' \| 'warn' \| 'danger' \| 'info' \| 'neutral'`。

當 `status` 為 `null` 時（例如 Radar 的 `card-blue` 映射結果）：

- StatCard **不會**添加 `stat-card--status-*` 與 `stat-card__value--status-*` 的類別名
- 卡片呈現預設中性外觀，不帶任何狀態顏色標記
- 僅顯示數值與標籤，不顯示狀態指示色

這表示 `card-blue` 在 Radar 中代表「純資訊類卡片」（如 VIX、SPX 等中性指標），不應被解讀為 ok/warn/danger 任何一種風險狀態。
