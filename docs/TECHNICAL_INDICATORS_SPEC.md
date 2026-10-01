---
type: reference
status: current
last_updated: 2026-10-01
last_verified: 2026-10-01
tags:
  - technical-analysis
  - rsi
  - kd
  - macd
  - signal-contract
  - investment-risk
wiki_links:
  - [[Strategy Engine]]
  - [[Telegram Notification]]
  - [[TechnicalView]]
related_code:
  - src/modules/strategy/indicators.mjs
  - src/modules/strategy/signalRules.mjs
  - src/modules/strategy/policies/sellScoringPolicy.mjs
  - src/modules/notifications/templates/telegramHtmlBuilder.mjs
  - webapp/src/views/TechnicalView.vue
related_docs:
  - docs/E2E_TESTING_GUIDE.md
---

# 技術指標與訊號判讀規格

> **摘要**：定義 InvestmentLineNotify 的技術指標計算、目前狀態、近期轉弱狀態與賣出訊號契約。WebApp 技術頁與 Telegram 通知必須依照同一份後端訊號資料解讀，不得自行建立另一套欄位名稱或判定邏輯。

## 1. 設計原則

1. **資料先於文案**：技術指標由後端計算，前端與通知層只負責呈現。
2. **狀態與事件分離**：目前指標值是狀態；近期轉弱是 lookback 狀態；死叉是最新交叉事件。
3. **訊號不是單獨交易指令**：技術訊號是風險與趨勢證據，必須與資金配置、維持率、估值守衛及既定 DCA 政策一起判讀。
4. **保守判定不得冒充標準判定**：使用 `min(K,D)` 的 KD 監控必須標示為「KD(保守)」。
5. **缺資料採中性**：缺少數值或訊號欄位時，畫面顯示中性／未發生，不得推導為買入或賣出。

## 2. 指標計算設定

| 指標         | 設定                  | 用途                   |
| ------------ | --------------------- | ---------------------- |
| RSI          | RSI(14)               | 動能與超買／超賣背景   |
| KD           | Slow KD(9,3,3)        | K/D 相對位置與交叉     |
| MACD         | EMA(12,26,9)          | DIF／DEA 趨勢與交叉    |
| MA240 乖離率 | 收盤價相對 240 日均線 | 長期趨勢位置與偏離風險 |

RSI(14)、Slow KD(9,3,3) 與 MACD(12,26,9) 是常見技術分析設定；門檻仍屬本專案策略參數，不應宣稱為保證性預測。

## 3. WebApp 核心指標卡片

`webapp/src/views/TechnicalView.vue` 的核心卡片顯示最新報告中的目前值：

- `signals.RSI`：目前 RSI，卡片以 30／70／80 等區間標示超賣、偏熱或過熱。
- `signals.KD_K`、`signals.KD_D`：目前 K、D 值，卡片分別呈現，不等同於保守 KD 訊號。
- `signals.bias240`：目前 MA240 乖離率，屬長期背景，不單獨觸發賣出。
- `signals.macdSignal`：目前 MACD 多頭／空頭／中性狀態。

因此，例如 RSI 目前為 59.6 且卡片顯示正常，並不排除下方「近期轉弱」成立；兩者觀察的是不同時間尺度。

## 4. 訊號雷達判定

### 4.1 近期轉弱狀態

後端 `computeReversalTriggers()` 使用以下語意：

- RSI：最近 14 根資料曾經高於或等於 `rsiReversalLevel`，目前跌回門檻以下。
- KD(保守)：以每根 `min(K,D)` 建立序列，最近 15 根資料曾經高於或等於 `kReversalLevel`，目前跌回門檻以下。
- `requireCrossToday: false`：不要求今天才剛跌破，因此訊號可能持續數日。

UI 與通知統一稱為：

- `近期轉弱`
- `RSI 近期轉弱`
- `KD(保守)近期轉弱`

不得將這些名稱解讀為「今天剛發生」或「立即賣出」。

### 4.2 交叉事件

- `KD 死叉`：最新一根 K 下穿 D。
- `MACD 死叉`：最新一根 DIF 下穿 DEA。

這些是最新事件；即使目前卡片仍顯示其他指標處於多頭狀態，也可能因資料更新時點不同而同時存在，應以報告中的訊號欄位為準。

## 5. 賣出訊號資料契約

後端 `sellScoringPolicy.mjs` 產生的正式欄位如下：

```js
sellSignals.flags = {
  rsiOverbought: boolean,
  kdOverbought: boolean,
  macdDeadCross: boolean,
};
```

語意：

- `rsiOverbought`：目前 RSI 達到賣出策略的超買門檻。
- `kdOverbought`：目前 KD K 達到賣出策略的超買門檻。
- `macdDeadCross`：最新發生 MACD 死叉。

WebApp 與 Telegram 必須讀取上述正式欄位。以下舊欄位已淘汰，不得重新使用：

```text
rsiSell
kdSell
macdSell
```

`signalCount` 只是三個旗標的觸發數量，不能單獨解讀為強制賣出指令。實際投資行動仍由完整策略引擎與資金風控層決定。

## 6. 判讀順序

使用者閱讀技術頁時，依下列順序判讀：

1. 先看目前狀態：RSI、KD、MACD、MA240 乖離。
2. 再看近期轉弱：確認近期是否由強勢區回落。
3. 再看交叉事件：確認 KD／MACD 是否在最新資料發生死叉。
4. 最後看賣出訊號數量與詳細旗標。
5. 將技術訊號與維持率、槓桿、估值及固定 DCA 政策合併判斷；技術訊號不得自動覆蓋既定 P0 基礎投入政策。

## 7. Telegram 速報卡的方向摘要契約

Telegram Mini App 模式的速報卡不是完整報告，而是讓使用者快速判斷「市場往哪裡走」與「目前採取哪一種投資方向」。顯示順序固定為：

- `大趨勢`：使用 `signals.marketStatus`；缺少時依 `signals.signalDirection` 與 `signals.regimeResult.state` 推導。
- `投資方向`：使用 `signals.target` 與 `signals.targetSuggestionShort`。這是策略引擎已產生的方向，不是通知層重新計算的買賣建議。
- `市場方向`：依序使用 `signals.macroMarketDirection`、`macroAnalysis.conclusion.market_direction`，最後才使用正式訊號推導值。
- `今日重大事件`：使用 `newsStructured.tw`、`newsStructured.us` 與執行期 `newsMessages` 的標題，最多 2 筆；完整摘要、來源與細節留在 Mini App。

當正式報告缺少上述選用欄位時，通知層只能使用已存在的正式訊號推導中性結果，不得虛構新聞、分數或宏觀結論。這確保 Telegram、WebApp 與後端報告對同一份資料契約負責。

## 8. 同步與驗證要求

修改以下任一技術訊號欄位或判定時，必須同步檢查：

- `src/modules/strategy/`
- `webapp/src/views/TechnicalView.vue`
- `webapp/src/test/TechnicalView.test.js`
- `src/modules/notifications/templates/telegramHtmlBuilder.mjs`
- `src/modules/notifications/templates/telegramHtmlBuilder.contract.test.mjs`
- 本規格文件與 `docs/wiki-index.json`

最低驗證：

```bash
npm test -- --run src/test/TechnicalView.test.js
npx vitest run src/modules/notifications/templates/telegramHtmlBuilder.contract.test.mjs
node scripts/generate-wiki-index.mjs
npm run verify
```
