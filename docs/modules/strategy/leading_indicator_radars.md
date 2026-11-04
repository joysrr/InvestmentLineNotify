---
type: reference
status: current
last_updated: 2026-10-21
last_verified: 2026-10-21
related_code:
  - src/domain/dailyRunContext.mjs
  - src/domain/signalContext.mjs
  - src/modules/providers/twseProvider.mjs
  - src/modules/providers/historyProvider.mjs
  - src/modules/strategy/indicators.mjs
  - src/modules/strategy/radars/
  - src/modules/strategy/leadingIndicatorEvaluator.mjs
  - src/scheduler/dailyCheck.mjs
  - webapp/src/components/radar/ExtremeRadarPanel.vue
tags:
  - strategy
  - leading-indicators
  - radars
  - margin
  - risk-management
wiki_links:
  - [[Strategy Engine]]
  - [[Providers]]
---

# 領先指標四大極端雷達與動態防禦層架構

本模組提供針對台美聯動黑天鵝與市場結構性斷頭的四大極端雷達感測器，結合 4 態有限狀態機與資金防禦層，實現**常態靜默、極端發聲**與**嚴格雙軌紀律**。

## 1. 架構核心原則

1. **感測與決策分離**：雷達作為純感測器（Sensors），輸出標準化結果，不直接變更帳戶資產或維持率；防禦層（State Machine）統一決定加碼約束與額度分配。
2. **個人維持率斷路器（$< 160\%$）**：個人帳戶安全凌駕於所有市場訊號。若個人維持率跌破 160%，一票否決所有加碼指示（凍結 00675L），但 P0 信仰定期定額不受影響。P1 條件加碼已移除，改以現金驅動曝險建議取代（詳見 `docs/plans/completed/2026-10-28-p1-removal-cash-exposure-plan.md`）。
3. **P0 信仰特權最高豁免**：P0 定期定額（每月 3 萬）具有最高豁免權（`p0Exempt: true`），任何市場暴跌或雷達警報均無條件正常執行。（增貸已於 2026-11 全數投入完畢，P0 僅剩原有固定 DCA。）
4. **雙軌風控分流（0050 vs 00675L）**：
   - **0050（原型現貨）**：左側逆週期加碼，系統性恐慌時放寬 Gross Leverage 至 2.7x。
   - **00675L（2x 槓桿）**：嚴格右側進場。暴跌時全面凍結，必須在「VIX $\le 0.8 \times$ Peak」、「收盤價 $\ge$ SMA5」、「20日實現波動率 $< 35\%$」三綠燈同時亮起時才解鎖。

## 2. 四大極端雷達矩陣

| 雷達代號           | 雷達名稱             | 觸發條件                                                                 | 嚴重等級         | 防禦約束                          |
| :----------------- | :------------------- | :----------------------------------------------------------------------- | :--------------- | :-------------------------------- |
| `OVERNIGHT_SHOCK`  | 隔夜美股與夜盤暴跌   | 費半/TSM ADR/夜盤綜合 ShockScore $\ge 0.70$ 或單一極端跌幅               | CRITICAL / ALERT | 凍結 00675L，暫緩現金驅動加速     |
| `MARGIN_SETTLING`  | 融資維持率斷頭出清   | 大盤維持率 $< 140\%$ **且** 融資單日減幅 $\le -1.5\%$（雙條件確認）      | ALERT / CRITICAL | 凍結 00675L，允許 0050 逆週期低接 |
| `EXTREME_PANIC`    | 系統性恐慌極端拋售   | VIX $\ge 35$ 或單日跌幅 $\le -4.5\%$ 或 60 日乖離 $\le -12\%$            | CRITICAL         | 放寬 0050 GL 至 2.7x，凍結 00675L |
| `RETAIL_SENTIMENT` | 非三大法人淨部位比率 | TAIFEX 推估比率 $\ge +30\%$ 或高分位多殺多擠壓；屬估計值，非直接散戶分類 | ALERT / CRITICAL | 警示多殺多連鎖踩踏，凍結 00675L   |

### 2.1 `bias60` 契約

- **官方來源**：TWSE `MI_INDEX` 的「發行量加權股價指數」收盤價。
- **歷史回補**：`fetchTaiexHistoryWithAutoFillDetailed()` 往回查詢日資料，預設最多 90 個日曆日，直到取得 60 筆交易日。
- **計算公式**：`bias60 = (最新收盤價 - MA60) / MA60`。
- **共用邏輯**：MA60 使用 `src/modules/strategy/indicators.mjs` 的既有 `calcMA60()`；乖離計算使用同檔的 `calcBias()`。
- **狀態**：`VERIFIED`、`INSUFFICIENT_HISTORY`、`SOURCE_UNAVAILABLE`。後兩者的值均為 `null`。
- **前端呈現**：Mini App 顯示 `60 日乖離率＝(最新收盤價−MA60)／MA60`；非 `VERIFIED` 時顯示「目前資料不足，暫不判讀」，不顯示 `0.0%`。

## 3. 資料流與錯誤降級

```text
TWSE MI_INDEX
  → twseProvider.fetchTaiexIndexByDate
  → historyProvider.fetchTaiexHistoryWithAutoFillDetailed
  → dailyRunContext.taiexHistory
  → signalContext.bias60 / bias60DataStatus
  → dailyCheck leading-indicator input
  → leadingIndicatorEvaluator
  → extremePanicRadar
  → API / MarketRadarView / ExtremeRadarPanel
```

- 休市日沒有資料是正常情況，不列為來源失敗。
- HTTP、網路或來源格式錯誤會記錄 `failedDates`，並降級為 `SOURCE_UNAVAILABLE`。
- TAIEX 歷史資料是非致命輸入；不足時每日流程仍可完成，但 Radar 3 不做乖離判讀。
- 雷達 metrics 保留資料狀態，讓前端區分「未觸發」與「無法判讀」。

## 4. 防禦狀態機（4 態轉換）

- `IDLE（常態平穩）`：無雷達觸發，Telegram 靜默，Mini App 呈現微型平穩橫條。
- `ACTIVE_DEFENSE（主動防禦）`：任一雷達觸發當日進入，Telegram 發送高醒目獨立警報卡，Mini App 展開行動紀律。
- `CONTINUOUS_SHOCK（連續衝擊）`：防禦中又有新雷達觸發或連環暴跌。
- `COOLDOWN（冷卻回穩）`：全雷達熄滅後進入，維持謹慎觀察，連續 5 日無事件後自動回歸 `IDLE`。

## 4. 落地管道與介面

- **每日排程**：整合於 `src/scheduler/dailyCheck.mjs`（Step 4.5），無需額外排程。
- **領域狀態**：`src/domain/ilnState.mjs` 透過 `leadingIndicators` 欄位持久化至最新報告與 API Payload。
- **Telegram Mini App**：`webapp/src/views/MarketRadarView.vue` 頂部內嵌 `ExtremeRadarPanel.vue`，具備兩段式折疊響應與深色模式適配。
