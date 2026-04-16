# Pre-plan Features (待評估與實作功能池)

---

## ✅【P0 已完成】技術訊號 lookback window 統一修正

> **Commit:** `fc4897c` — fix(strategy): 修正 signalRules lookback window 與 rsiRebound requireCrossToday
> **完成日期：** 2026-04-16

### 修正摘要

`signalRules.mjs` 中所有使用 `wasBelowLevel` / `roseAboveAfterBelow` / `fellBelowAfterAbove` 的指標，lookback 原本一律 hardcode 為 10 天，且 `rsiRebound` 使用 `requireCrossToday: false`，導致過去 10 天內只要曾跌破 oversold，後續每天 RSI > 50 都會持續觸發 +3 分的虛假加分。

### 已完成修改清單

| 指標 | 修改前 lookback | 修改後 lookback | requireCrossToday 修改 |
|------|----------------|----------------|------------------------|
| `rsiRebound` | 10 | **14** | `false` → **`true`** ⚠️ 核心修正 |
| `kdBullLow` | 10 | **18** | — |
| `rsiDrop`（轉弱） | 10 | **14** | 維持 `false` |
| `kdDrop`（轉弱） | 10 | **15** | 維持 `false` |
| `rsiSell` | 10 | **15** | 維持 `true` |
| `macdSell` | 10 | **20** | 維持 `true` |
| `kdSell dropBelow80` | 10 | **20** | 維持 `true` |

### 後續建議（未強制）

- `rsiDrop` / `kdDrop` 轉弱訊號仍使用 `requireCrossToday: false`，在震盪盤中仍可能連續計數。建議未來於 `computeReversalTriggers` 加入「當日已計入則略過」的冷卻保護。
- 建議搭配回測驗證修改前後訊號觸發次數差異（可於 backtest runner 完成後驗證）。

---

## ✅【P0 已完成】維持率狀態機 4 層重構

> **Commit:** `98a6cdb` — refactor(strategy): strategyEngine 維持率 4 層狀態機重構 + telegramHtmlBuilder mmTag 同步
> **完成日期：** 2026-04-16

### 修正摘要

`buildDecision()` 維持率邏輯由 2 層重構為 4 層狀態機，確保「越危險越先被檢出」，並在追繳危機區間執行一票否決。`Strategy.json` 同步新增 `frozenZone: 145`，`telegramHtmlBuilder.mjs` 同步更新 4 層 mmTag 文案與 emoji。

### 4 層狀態機規格

| 層級 | 門檻 | 行動 | Strategy.json 對應 |
|------|------|------|-------------------|
| 🔴 斷頭危機 | < 135% | 強制市價降槓桿警示，一票否決所有加碼 | `marginCallThreshold: 135` |
| 🟠 高危凍結 | 135–145% | 禁止所有新進場，強烈通知補足保證金 | `frozenZone: 145` |
| 🟡 預備金防禦 | 145–160% | 暫停高槓桿加碼，允許 baseline DCA | `protectTrigger: 160` |
| 🟢 常態運行 | >= 160% | 允許策略引擎完整運作 | `protectTarget: 180` |

---

## ✅【P0 已完成】左側進擊矩陣：階層式進場前置過濾層

> **Commit（Strategy.json + entryGate 設計）:** `229c0be` — feat(strategy): Strategy.json 本地化 + entryGate 4 層矩陣 + minDropPercentToConsider:5 + docs/strategy-param-audit.md
> **Commit（signalRules 本地優先 + validateStrategyConfig）:** `8ca76ee` — fix(signal): fetchStrategyConfig 改為本地優先 + validateStrategyConfig 補齊 frozenZone 與 entryGate 驗證
> **Commit（strategyEngine Pre-Entry Gate 邏輯接入）:** `035541a` — feat(strategy): strategyEngine buildDecision() 插入 Pre-Entry Gate 前置過濾邏輯 + resolveEntryGate()
> **Commit（telegramHtmlBuilder entryGateLevel 標示）:** `9a268f3` — feat(notify): telegramHtmlBuilder 新增 entryGateLevel 通道標示
> **完成日期：** 2026-04-16

### 修正摘要

`strategyEngine.mjs` 的 `buildDecision()` 常態段前新增 `resolveEntryGate()` 前置過濾，依跌幅層級與 RSI 決定是否封鎖槓桿操作，並在所有買入回傳結果中附帶 `entryGateLevel / entryGateLabel / entryGateBlocked` 欄位。`telegramHtmlBuilder.mjs` 同步在訊息中標示進場通道層級。

### entryGate 4 層矩陣

| Tier | 跌幅區間 | RSI 門檻 | 允許槓桿 | 說明 |
|------|---------|---------|---------|------|
| 0 | 0–5% | — | ❌ | 底倉 DCA only |
| 1 | 5–15% | RSI < 45 | ❌ | 淺層修正，禁 00675L |
| 2 | 15–30% | RSI < 35 | ✅ | 深度回撤，開放 00675L |
| 3 | 30%+ | RSI < 30 | ✅ | 極端恐慌，一票通行 |

---

## ✅【P1 已完成】Strategy.json 幽靈參數審計與清除

> **Commit（審計文件產出）:** `229c0be` — docs/strategy-param-audit.md 新增
> **Commit（strategy-param-changes.md 建立）:** `1302be8` — docs: 新增 strategy-param-changes.md — Strategy.json 本次異動說明
> **Commit（幽靈參數實際移除）:** `103be3d` — refactor: 移除幽靈參數 leverage.targetMultiplier + reserve.allocationRatio
> **完成日期：** 2026-04-16

### 完成摘要

- `Strategy.json`：移除 `leverage.targetMultiplier`（值 1.8）、`reserve.allocationRatio`（值 0.5）
- `signalRules.mjs`：同步移除 `validateStrategyConfig()` 中對應的 `assertNumber` 驗證行
- `docs/strategy-param-audit.md`：兩參數狀態更新為 ✅ 已移除（2026-04-16）
- `docs/strategy-param-changes.md`：新增 frozenZone、entryGate、minDropPercentToConsider 完整異動說明

---

## ✅【P1 已完成】VIX 情緒短路機制

> **Commit（節一 Strategy.json 新增參數）:** `feat(config): Strategy.json v2.5 — 新增 macroSentiment.vixOverrideTrigger / vixAbsoluteOverride`
> **Commit（節二 validateStrategyConfig 補齊驗證）:** `feat(signal): signalRules validateStrategyConfig 補齊 vixOverrideTrigger / vixAbsoluteOverride 驗證`
> **Commit（節三 resolveVixOverride 函式）:** `feat(strategy): strategyEngine 新增 resolveVixOverride() 函式`
> **Commit（節四 macroSentiment 整合）:** `feat(strategy): strategyEngine buildDecision() macroSentiment 整合 VIX Override 短路邏輯`
> **Commit（節五 Telegram 通知標示）:** `71c1ca5` — feat(notify): telegramHtmlBuilder 新增 VIX 情緒短路標示（vixOverrideActive）
> **Commit（節六 文件更新）:** `docs(plans): 更新 preplan_features.md — VIX 情緒短路機制標記為已完成`
> **完成日期：** 2026-04-16

### 完成摘要

AI 新聞情緒為落後指標，在崩盤底部必定輸出 `BEARISH`，原本 `bearishPenalty`（扣分）與 `bearishCooldownMultiplier`（冷卻延長）同時觸發，導致左側進場最佳時機反而策略癱瘓。本次實作 VIX 情緒短路機制，以 VIX 即時恐慌指數覆蓋 AI 情緒的抑制效果。

### 實作節點總覽

| 節 | 內容 | 涉及檔案 |
|----|------|---------|
| 節一 | Strategy.json 新增 `vixOverrideTrigger: 28` / `vixAbsoluteOverride: 35` | `Strategy.json`、`docs/strategy-param-changes.md` |
| 節二 | `validateStrategyConfig()` 補齊兩欄位驗證 | `signalRules.mjs` |
| 節三 | 新增 `resolveVixOverride()` 函式 | `strategyEngine.mjs` |
| 節四 | macroSentiment 段落整合 VIX Override，BEARISH 時先判斷短路 | `strategyEngine.mjs` |
| 節五 | Telegram 全版與精簡卡新增 `⚡ VIX 情緒短路` 標示 | `telegramHtmlBuilder.mjs` |
| 節六 | 文件更新，preplan_features.md 狀態更新 | `docs/plans/preplan_features.md` |

### VIX 情緒短路規格

| VIX 狀態 | 行為 |
|---------|------|
| VIX < 28 | 正常融合，AI BEARISH 正常扣分與冷卻延長 |
| VIX >= 28 且 VIX 開始回落（`trend = falling`） | 情緒短路：忽略 bearishPenalty，解除冷卻期延長 |
| VIX >= 35（絕對值） | 強制情緒短路，無論 VIX 趨勢 |

### 人工驗收測試清單

| 情境 | 預期結果 |
|------|---------|
| `vix=40`（絕對值短路） | `overrideActive: true`，bearishPenalty = 0，冷卻延長不觸發，Telegram 出現 `⚡ VIX 情緒短路` |
| `vix=30, trend=falling`（趨勢短路） | `overrideActive: true`，同上 |
| `vix=30, trend=rising`（趨勢不符） | `overrideActive: false`，bearishPenalty 正常扣，冷卻延長正常觸發 |
| `vix=20`（無觸發） | `overrideActive: false`，行為與修改前完全一致 |
| 舊版資料（缺 `vixOverrideActive` 欄位） | Telegram 靜默略過，不拋錯 |

---

## 📋 P0 完成狀態總覽

| Commit | 內容 | 狀態 |
|--------|------|------|
| `fc4897c` | signalRules lookback window 統一修正 + rsiRebound requireCrossToday | ✅ 已完成 |
| `98a6cdb` | strategyEngine 維持率 4 層狀態機重構 + telegramHtmlBuilder mmTag | ✅ 已完成 |
| `229c0be` | Strategy.json 本地化 + entryGate 4 層矩陣 + strategy-param-audit.md | ✅ 已完成 |
| `8ca76ee` | signalRules fetchStrategyConfig 本地優先 + validateStrategyConfig 補齊 | ✅ 已完成 |
| `035541a` | strategyEngine buildDecision() Pre-Entry Gate resolveEntryGate() | ✅ 已完成 |
| `9a268f3` | telegramHtmlBuilder entryGateLevel 通道標示 | ✅ 已完成 |
| `1302be8` | docs/strategy-param-changes.md 建立（異動說明） | ✅ 已完成 |
| `103be3d` | 幽靈參數移除：leverage.targetMultiplier + reserve.allocationRatio | ✅ 已完成 |

---

## 📌【P1 高優先】Gross Leverage Ratio 總體曝險倍數監控

### 狀態與目標摘要

- 目前系統只監控 `z2Ratio`（00675L 佔比），未計算包含質押負債與 00675L 內含 2x 期貨槓桿的「真實綜合曝險倍數」。
- 在極端行情下，0050 質押借款買入 00675L，實際上是對台股指數三重槓桿曝險（質押 × 期貨 × ETF），但系統對此無感知。

### 動機

雙重槓桿在極端行情下可能造成淨值快速歸零的「死亡螺旋」。監控真實曝險倍數是槓桿策略最基本的風控前置條件。

### 計算公式

```
grossLeverage = (0050 市值 + 00675L 市值 × 2) / 帳戶淨值
```

建議天花板：**2.5x**（超過則強制降至下一 allocation 檔位）

### 建議方向

- 新增 `src/modules/strategy/leverageMonitor.mjs`
- 在每次 `buildDecision()` 前先計算 `grossLeverage`
- 超過天花板時強制壓縮 allocation 檔位（一票否決加碼）
- 日報新增「綜合曝險倍數」欄位

### 影響範圍

- `src/modules/strategy/leverageMonitor.mjs`（新增模組）
- `src/modules/strategy/strategyEngine.mjs`（整合計算）
- Telegram 通知模板（新增欄位）
- `Strategy.json`（新增 `grossLeverageCeiling` 參數）

### 難度

⭐⭐⭐ 高

### 討論狀態

⚪ 待確認

---

## 📌【P1 高優先】PB 估值動態衰減機制（valuationPenaltyFactor）

### 狀態與目標摘要

- 現行系統 PB >= 2.2 才觸發硬停機，PB 1.8–2.2 的危險過渡區內系統仍可全力加碼。
- 存在「估值懸崖效應」：PB 2.19 與 2.20 的行為天壤之別，但風險實質相近。

### 動機

高估值環境下應漸進式壓縮槓桿上限，而非在臨界值突然斷崖。線性衰減更符合風險管理直覺，且能避免邊界條件的策略突變。

### 設計規格（4 段線性衰減）

| PB 區間 | 最大允許槓桿 | 行為 |
|--------|------------|------|
| PB < 1.8 | 1.8x（完整） | 無限制 |
| 1.8 ≤ PB < 2.0 | 壓縮至 1.5x | 降低高分檔位上限 |
| 2.0 ≤ PB < 2.2 | 鎖定 1.1–1.2x | 禁止 00675L 新增 |
| PB ≥ 2.2 | 強制清空 00675L | 現行硬停機維持 |

### 建議 Strategy.json 新增欄位

```json
"valuationTiers": [
  { "maxPB": 1.8, "maxLeverageMultiplier": 1.0, "note": "正常操作" },
  { "maxPB": 2.0, "maxLeverageMultiplier": 0.85, "note": "輕度壓縮" },
  { "maxPB": 2.2, "maxLeverageMultiplier": 0.65, "note": "強制降速，禁止00675L新增" },
  { "maxPB": 999, "maxLeverageMultiplier": 0.0, "note": "泡沫停機" }
]
```

### 影響範圍

- `Strategy.json`（新增 `valuationTiers` 區段）
- `src/modules/strategy/strategyEngine.mjs`
- `src/modules/strategy/riskManagement.mjs`

### 難度

⭐⭐⭐ 高

### 討論狀態

⚪ 待確認

---

## 📌【P1 高優先】廢除 BasePrice，改採 ATR/MA20 動態移動停利

### 狀態與目標摘要

- 停利條件建立在 `priceUpPercent >= sell.minUpPercentToSell(80%)`，錨點為外部 `BasePrice.txt`，尚未有明文的更新規則。
- BasePrice 長期不更新將導致停利條件數年無法被觸發；過於頻繁更新則停利過度敏感。
- BasePrice 是靜態人工設定，無法自動對應技術結構。

### 動機

以 MA20 月線（約 20 個交易日均價）或前一波低點 + ATR 倍數作為動態停利錨點，能自動追蹤趨勢結構，比靜態 BasePrice 更符合「跟隨強勢、在弱勢時離場」的動態停利精神。

### 設計規格

```
動態停利錨點 = MA20 × (1 - stopLossBuffer)
              OR 前波低點 + ATR × multiplier
```

- 新增 `sell.anchorType = basePrice | ma20 | atr`（Strategy.json 可設定）
- 新增 `sell.atrMultiplier`（預設 2.0）
- `ma20` 模式：連續 2 日收盤跌破 MA20 × 緩衝係數時觸發停利訊號
- 過渡期保留 BasePrice 作為 fallback（`anchorType = basePrice` 時行為與現在相同）

### 建議方向（分階段）

1. **Phase 1（過渡）**：在 `sell` 中新增 `anchorType` 欄位，預設 `basePrice` 維持現狀。
2. **Phase 2（切換）**：切換至 `ma20` 模式，移除 `BasePrice.txt` 依賴，改從 TWSE API 即時計算。
3. **Phase 3（驗證）**：回測不同 anchor 模式的停利時機與後續回撤，調整參數。

### 影響範圍

- `src/modules/providers/basePriceProvider.mjs`（保留作 fallback）
- `src/modules/strategy/strategyEngine.mjs`（停利 anchor 邏輯分支）
- `Strategy.json`（新增 `sell.anchorType`、`sell.atrMultiplier`）
- 日報顯示「當前停利錨點來源與數值」

### 難度

⭐⭐⭐ 高（需回測與長期觀察）

### 討論狀態

⚪ 待確認

---

## 📌【P1 高優先】lastBuyDate 本地 fallback 快取（SQLite/JSON）

### 狀態與目標摘要

- 冷卻期依賴 `portfolio.lastBuyDate`，來源為 Google Sheet 持股紀錄。
- 若 Google Sheet API 失敗、欄位缺失或格式錯誤，冷卻期會被視為「無歷史買入紀錄」，等同關閉冷卻保護。
- 此問題在網路不穩或 Sheets API 限流時具有實際發生風險。

### 動機

冷卻期是防止短期內頻繁加碼與槓桿快速堆疊的關鍵機制。資料來源單點故障不應導致風控靜默失效。

### 建議方向

- 在每次成功讀取 `lastBuyDate` 後，同步寫入本地 JSON 檔（`data/cache/lastBuyDate.json`）或 SQLite。
- `fetchLastPortfolioState()` 失敗時，優先讀取本地快取作為 fallback，並在日報中標示「使用快取資料」。
- 每次實際觸發買入後，立即更新本地快取（不依賴下次 Sheets 讀取）。
- 在 `fetchLastPortfolioState()` 中增加 `lastBuyDate` 格式驗證，無法解析時顯示警告並 log。

### 建議 cache 格式

```json
{
  "lastBuyDate": "2026-03-15",
  "updatedAt": "2026-04-16T01:07:04Z",
  "source": "google_sheet"
}
```

### 影響範圍

- `src/modules/storage.mjs`（lastBuyDate 讀寫、驗證與本地快取雙寫）
- `src/dailyCheck.mjs`（買入觸發後立即更新快取）
- `data/cache/`（新增快取目錄，需加入 `.gitignore`）
- `webapp/src/views/AccountView.vue`（可選：顯示快取來源標示）

### 難度

⭐⭐ 中

### 討論狀態

⚪ 待確認

---

## 📌【策略與績效】策略訊號回測與績效統計

### 狀態與目標摘要

- 目前僅有回測概念與資料來源分析，尚未實作 runner。
- 計劃新增獨立 runner（例如 `src/runBacktest.mjs`）並與週/月報的統計結果整合。

### 動機

`strategyEngine.mjs` 目前依據 RSI、KD、MACD、VIX、MA240、`macroMarketDirection` 計算買賣訊號，但系統內無法驗證：

- 歷史上當「訊號 = 買進」時，後續 N 天的實際報酬率如何？
- 哪個指標對最終决策貢獻最大？

目前 `archiveManager` 已存 `signals` 快照，資料基礎存在，缺的是分析邏輯。

### 建議方向

新增一個 `runBacktest.mjs` runner，讀取 `data/archives/` 歷史快照 + Google Sheet 歷史價格，計算每次訊號後的 5/10/20 日報酬率，輸出 CSV 或 Telegram 月報附件。

此功能可與現有 `runMonthlyReport.mjs` 整合（月報時一併輸出回測摘要）。

### 影響範圍

- 新增 `src/runBacktest.mjs`（新 runner）
- `src/modules/data/archiveManager.mjs`（新增讀取歷史快照 API）
- `src/modules/storage.mjs`（讀取 Google Sheet 歷史收盤價）
- 可能新增 `src/modules/strategy/backtestEngine.mjs`

### 難度

⭐⭐⭐ 高（需設計回測邏輯與資料對齊）

### 討論狀態

⚪ 待確認

---

## 📌【AI 管線強化類】每日摘要語音化推播（Gemini TTS × Telegram Audio）

### 狀態與目標摘要

- 已有較完整的技術草案（Gemini TTS + ffmpeg + Telegram sendAudio），尚未落實為實際模組。
- 實作時需確認 AI pipeline、Langfuse 追蹤與每日推播流程的整合方式。

### 🎯 功能目標

將每日由 LLM 產生的市場摘要文字（AI 教練洞察、總經多空分析等），透過 Gemini TTS API（`gemini-2.5-flash-preview-tts`）轉換為語音音訊檔，再經由 Telegram Bot API 的 `sendAudio` 方法推播至指定頻道。

此功能定位為現有文字報告的「語音附件」，與三則文字訊息並列發送，不取代原有推播邏輯。

---

### 📁 影響範圍

| 模組 / 職責          | 預計異動                                                   | 路徑                                                          |
| -------------------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| 語音合成服務（新增） | 新增 `ttsService.mjs`，封裝 Gemini TTS 呼叫與 PCM→MP3 轉換 | `src/modules/ai/`                                             |
| 摘要文字組裝邏輯     | 需擷取純文字版本（去除 HTML tag）供 TTS 使用               | `src/modules/notifications/templates/telegramHtmlBuilder.mjs` |
| Telegram 推播模組    | 新增 `sendAudio` 呼叫，於三則文字訊息後附加語音            | `src/modules/notifications/transports/telegramClient.mjs`     |
| 暫存音訊目錄         | 需於執行期間建立 `/tmp/tts/` 暫存目錄，流程結束後清除      | 專案根目錄下的 `/tmp/`                                        |

### 待確認清單

- 確認 aiAdvice / macroAnalysis 的實際資料結構與來源模組。
- 確認 TTS service 檔案最佳放置路徑。
- 確認每日推播流程中負責三則訊息發送的函式名稱與插入點。
- 確認 Gemini API key 分配策略與 Langfuse span wrapper 的使用方式。

---

## 📌【穩定性強化】Providers 統一 retry / timeout 機制

### 狀態與目標摘要

- 各 Provider 目前錯誤處理策略不一，網路抖動時可能導致整條 daily pipeline 中斷。
- 計劃統一透過 helper（例如 `fetchWithRetry`）包裝 `fetchWithTimeout`，逐步於 Providers 層導入。

### 動機

目前各 provider（`twseProvider`, `yahooProvider`, `cnnProvider` 等）各自處理錯誤，有些有 try/catch，有些直接拋出。`coreUtils.mjs` 已有 `fetchWithTimeout`，但未被所有 provider 統一使用。

### 建議方向

在 `src/utils/coreUtils.mjs` 或新增 `src/utils/fetchUtils.mjs` 中實作 `fetchWithRetry(url, options, retries=2)`，並在各 provider 統一引用。

### 影響範圍

- `src/utils/coreUtils.mjs`（新增 helper）
- `src/modules/providers/*.mjs`（逐步替換 fetch 呼叫）

### 難度

⭐⭐ 中（工具本身簡單，但需逐一審查各 provider 的 fetch 呼叫）

### 討論狀態

⚪ 待確認

---

## 📌【風控邏輯】維持率與追繳風險判斷重構（已升級為上方 P0 4層狀態機）

> ⚠️ 此項目已升級為【P0 已完成】維持率狀態機 4 層重構，請參閱上方對應條目。commit: `98a6cdb`

---

## 📌【策略門檻】RSI / 跌幅與估值多階門檻優化（已升級為上方 P0 左側進擊矩陣）

> ⚠️ 此項目已升級為【P0 已完成】左側進擊矩陣：階層式進場前置過濾層，請參閱上方對應條目。commit: `229c0be` / `8ca76ee` / `035541a` / `9a268f3`

---

## 📌【停利機制】BasePrice 管理與動態停利邏輯（已升級為上方 P1 廢除 BasePrice 計劃）

> ⚠️ 此項目已升級為【P1 高優先】廢除 BasePrice，改採 ATR/MA20 動態移動停利，請參閱上方對應條目。
> 原 BasePrice 管理策略（更新規則、scripts）保留為 Phase 1 過渡方案。

---

## 📌【冷卻期與情緒】MacroSentiment 交互與回測驗證（已整合 VIX 情緒短路 ✅ 已完成）

> ⚠️ VIX 情緒短路機制已完成，請參閱上方【P1 已完成】VIX 情緒短路機制條目。
> 剩餘回測維度（macroSentiment 多模式績效比較）保留為未來 backtest runner 完成後的擴充項目。

### 建議方向（補充回測維度，未強制）

- 在 `backtest.mjs` 內加入 macroSentiment 維度回測：
  - 比較「有 sentimentScore + 冷卻延長」與「僅 sentimentScore 或僅冷卻延長」三種模式的績效。
  - 觀察 BEARISH 區間內的平均進場次數、勝率與最大回撤。
- 考慮增加上限：
  - 例如在估值低於某 PB 或 PE 閾值時，關閉冷卻延長效果但保留分數扣分。
  - 或在連續 N 天 BEARISH 卻持續大跌時，強制允許恐慌加碼通道。

### 難度

⭐⭐⭐ 高

### 討論狀態

⚪ 待確認（回測維度部分）

---

## 📌【資料完整性】lastBuyDate 與策略欄位一致性檢查（已升級為上方 P1 本地 fallback 快取）

> ⚠️ 此項目已升級為【P1 高優先】lastBuyDate 本地 fallback 快取，請參閱上方對應條目。

---

## 📌【策略欄位清理】未使用欄位與 label 一致性（已整合為上方 P1 幽靈參數審計）

> ⚠️ 此項目已整合升級為【P1 高優先】Strategy.json 幽靈參數審計與清除，✅ 已完成（commit `103be3d`）。
> 原 label 一致性修正（`dropScoreRules` 文案對齊）已於 commit `229c0be` 一併完成。

---

## 📌【策略演化】生命週期風險預算與槓桿曲線

### 狀態與目標摘要

- 目前策略 implicitly 假設使用者風險承受度固定，未顯式納入「年齡 / 投資年限 / 距離目標年」等生命週期參數。
- allocation 槓桿檔位主要依 weightScore 決定，與投資年齡無關。

### 動機

生命週期投資法通常會在投資早期容忍較高風險與槓桿，接近目標年份時逐步降低風險曝險。現有設計在工程上已具備彈性，但缺少這個 explicit 維度。

### 建議方向

- 定義生命週期 Profile：
  - 例如「早期累積期」「中期平衡期」「後期保守期」，每個 profile 各自對應 allocation 表（不同最大 leverage 與底倉槓桿）。
- 生命週期參數來源：
  - 初期可先在 `.env` 或 Google Sheet 設定「目標年份」「出生年份」等，後續再考慮在 Mini App 做 UI 調整。
- 策略引擎整合：
  - 在 `fetchStrategyConfig()` 或 `evaluateInvestmentSignal()` 中讀取當前 profile，動態選用對應的 allocation 陣列或調整分數檔位。

### 影響範圍

- `Strategy.json`（新增 lifecycleProfiles 區段）
- `src/modules/strategy/riskManagement.mjs`
- `webapp` Mini App 未來可新增生命週期設定頁面

### 難度

⭐⭐⭐ 高（牽涉策略設計與 UX）

### 討論狀態

⚪ 待確認

---

## 📌【策略拆分】Baseline DCA 與戰術加碼雙層架構

### 狀態與目標摘要

- 目前「底倉 DCA」與「顯著修正或恐慌時的戰術加碼」共同由同一分數機制與 allocation 表驅動。
- 使用者在閱讀報告時較難分辨當日建議是屬於「持續佈局」還是「特殊戰術」。

### 動機

將日常 DCA（例如穩定買入 0050 + 少量質押）與戰術性大幅加碼（例如恐慌加碼、左側大跌加碼）拆成兩條明確路徑，有助於解釋策略行為，也方便分別調整其風控參數。

### 建議方向

- 策略層拆分：
  - 新增一個 `baselineAllocation` 與 `tacticalAllocation` 概念，baseline 只受輕度技術與估值因素影響；tactical 則要求更嚴格的大跌／恐慌條件。
  - 在 `evaluateInvestmentSignal` 結果中明確標示 `signalType = baseline | tactical_drop | tactical_panic`。
- 報告與回測：
  - 周/月報在統計訊號準確率時分開統計 baseline 與 tactical 的勝率與平均報酬。
  - 在 Telegram 報告文案中以標題或 emoji 區分兩者（例如「🌱 常態布局」vs「⚡ 戰術加碼」）。

### 影響範圍

- `Strategy.json`（新增 baseline / tactical 配置）
- `src/modules/strategy/strategyEngine.mjs`
- `src/modules/ai/periodReportAgent.mjs`
- Notifications 模板

### 難度

⭐⭐⭐ 高（涉及策略定義與報表）

### 討論狀態

⚪ 待確認

---

## 📌【報告強化】訊號類型分類與月報統計

### 狀態與目標摘要

- 現有週報、月報已統計買進訊號次數、冷卻封鎖比例與 +5/+10/+20 日報酬，但尚未標示訊號類型。
- 使用者只能看到 aggregate 的績效，無法得知哪一種訊號（恐慌、一般大跌、常態進場）效果最好。

### 動機

以「訊號類型」為維度分析績效，可以用來調整各檔位權重與門檻，例如：若恐慌加碼勝率高但樣本少，可考慮略放寬條件；若某種一般加碼長期績效不佳，可適度調高分數門檻。

### 建議方向

- 在每日 `signals` 中加入 `signalCategory` 欄位：
  - 例如 `baseline`, `deep_drop`, `panic`, `take_profit`, `rebalance` 等。
- 在 `periodReportAgent.mjs` 的統計邏輯中：
  - 針對每一類訊號計算觸發次數、平均報酬率與勝率。
  - 月報中新增一節「各類訊號績效概覽」。

### 影響範圍

- `src/modules/strategy/strategyEngine.mjs`
- `src/modules/ai/periodReportAgent.mjs`
- Telegram 月報模板

### 難度

⭐⭐ 中

### 討論狀態

⚪ 待確認

---

## 📌【前端體驗】Mini App 策略狀態與解釋視覺化

### 狀態與目標摘要

- 現有 Mini App 已提供市場雷達、資產淨值曲線、報告列表與新聞池。
- 尚未有專門頁面集中展示「當前策略評分構成」、「所在分數檔位」與「冷卻期狀態」。

### 動機

在手機上快速理解「今天為何建議加碼／觀望／停利」，對實際使用體驗非常重要，也方便 debug 策略行為。

### 建議方向

- 新增「策略狀態」區塊（可放在 Dashboard 或 Account 頁）：
  - 顯示 weightScore 以及構成（跌幅分數、RSI 分數、MACD 分數、KD 分數、情緒分數）。
  - 顯示目前對應的 allocation 檔位與目標槓桿比例。
  - 顯示冷卻期剩餘交易日與 lastBuyDate 摘要。
- UI / UX：
  - 可以用簡單的條形圖或小型雷達圖呈現各因子分數。
  - 點擊後顯示詳細文案，對應 daily report 的文字說明。

### 影響範圍

- `webapp/src/views/DashboardView.vue` 或 `AccountView.vue`
- `/api/status` 或 `/api/reports` 若尚未回傳 weightDetails，需後端擴充。

### 難度

⭐⭐ 中

### 討論狀態

⚪ 待確認

---

## 📌【資金管控】單日 / 區間撥款上限控制

### 狀態與目標摘要

- 現有設計已透過冷卻期與再平衡控制槓桿節奏，但尚未顯式限制「單日最大新增撥款金額」與「區間累積加碼上限」。
- 在極端行情下，多個訊號同時達標時仍有可能短期內大額放大槓桿。

### 動機

即使策略在邏輯上判斷「值得加碼」，仍有必要從資金管理角度限制一次性槓桿拉升的幅度，以降低人為執行失誤或黑天鵝的衝擊。

### 建議方向

- 新增風控參數：
  - `trading.maxDailyNetLoanIncrease`：單日最大淨新增借款金額。
  - `trading.maxRollingLoanIncreaseDays` / `trading.maxRollingLoanIncreaseAmount`：N 日內累計最大新增借款上限。
- 在 daily pipeline 中：
  - 根據當前 totalLoan 與建議 targetLeverage，計算預期新增借款額，若超出上限，將建議降檔或僅執行 baseline DCA。
- 可於月報中簡單列出「本月加碼資金節奏」摘要，幫助調整參數。

### 影響範圍

- `Strategy.json`（新增資金上限相關參數）
- `src/modules/strategy/strategyEngine.mjs`
- `src/modules/storage.mjs`

### 難度

⭐⭐⭐ 高

### 討論狀態

⚪ 待確認
