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

## 📌【P0 緊急】維持率狀態機 4 層重構

### 狀態與目標摘要

- `buildDecision()` 目前維持率邏輯僅有 2 層：`protectTrigger(160)` → 預備金防禦，`mmDanger(140)` → 追繳風險。
- 追繳分支在邏輯上被前一層防禦遮蔽，且缺乏真正的「強制降槓桿」機制。
- `marginCallThreshold(135)` 已設定於 Strategy.json，但程式端尚未對應任何強制行動。

### 動機

維持率風控的原則應為「越危險越先被檢出」，在接近斷頭區間時系統應執行一票否決，而非給出偏溫和的預備金建議。現有設計在維持率 135–160 的危險走廊中行為未被正確分層。

### 建議方向（4 層狀態機規格）

| 層級 | 門檻 | 行動 | Strategy.json 對應 |
|------|------|------|-------------------|
| 🔴 斷頭危機 | < 135% | 強制市價降槓桿警示，一票否決所有加碼，優先指示補足保證金 | `marginCallThreshold: 135` |
| 🟠 高危凍結 | 135–145% | 禁止所有新進場，強烈通知補足保證金 | 新增 `frozenZone: 145` |
| 🟡 預備金防禦 | 145–160% | 暫停高槓桿加碼，優先充實擔保品，允許 baseline DCA | `protectTrigger: 160` |
| 🟢 常態運行 | >= 160% | 允許策略引擎完整運作 | `protectTarget: 180` |

### 建議 Strategy.json 新增欄位

```json
"maintenance": {
  "protectTrigger": 160,
  "protectTarget": 180,
  "marginCallThreshold": 135,
  "frozenZone": 145
}
```

### 影響範圍

- `src/modules/strategy/strategyEngine.mjs`（`buildDecision()` 4 層判斷重構）
- `Strategy.json`（新增 `frozenZone` 欄位）
- `src/modules/notifications/templates/telegramHtmlBuilder.mjs`（4 層對應文案與 emoji）
- 建議補充單元測試（模擬維持率 120、135、145、155、165 等情境）

### 難度

⭐⭐ 中（邏輯結構清晰，但需完整測試所有分支）

### 討論狀態

🟡 待實作（已有完整規格，等待排程）

---

## 📌【P0 緊急】左側進擊矩陣：階層式進場前置過濾層

### 狀態與目標摘要

- `buy.rsi.oversold = 50` 並非技術分析意義上的「超賣」定義（RSI 50 為多空分水嶺，30 才是標準超賣），當前設計在評分系統中作為加分條件（+3 分）而非觸發門檻，但在盤整期仍可能配合小幅跌幅就達到最低進場門檻。
- `buy.minDropPercentToConsider = 0` 等同無左側過濾縱深，任何微小跌幅加上技術分數達標即可觸發評估。
- `rsiRebound requireCrossToday: true` 已修正震盪期虛假加分問題，但上述兩個根本設計缺口仍存在，需以獨立前置過濾層解決。

### 設計決策說明

> **不建議直接下調 `rsi.oversold: 50 → 30`**，原因如下：
> - RSI 50 在現有評分中是「加分條件」而非「觸發條件」，單獨觸發 +3 分不夠達到門檻（需疊加跌幅分數 +4 以上）。
> - 若直接改 oversold 至 30，等同完全廢除震盪加分，會破壞現有評分平衡，且無法區分「淺層修正」與「深度恐慌」場景。
> - 更精準的設計是：保留 RSI 加分機制，另外在 `strategyEngine.mjs` 的進場評估前增加一層「前置過濾」，依跌幅層級決定哪些操作被允許。

### 建議設計：進場前置過濾層（Pre-Entry Gate）

在 `strategyEngine.mjs` 的 `buildDecision()` 最前段，依跌幅條件決定本次評估允許的操作上限：

| 跌幅區間 | RSI 輔助條件 | 允許操作 | 說明 |
|---------|------------|---------|------|
| < 5% | — | 僅允許底倉 baseline DCA，禁止加碼 | 過濾日常波動，避免微小跌幅誤觸 |
| 5–15% | RSI ≤ 45 | 允許小幅加碼（底倉 + 輕度加碼） | 淺層修正，觀察確認後分批 |
| 15–30% | RSI ≤ 35 | 允許積極加碼（底倉 + 中高檔位） | 深度回撤，逢跌分批 |
| ≥ 30% | RSI ≤ 30 | 開放全力左側，覆蓋情緒抑制訊號 | 極端恐慌，一票通行 |

> **00675L 加碼限制**：跌幅 ≥ 15% 且 RSI < 35 時才開放 00675L 加碼，跌幅 < 15% 場景僅允許 0050 標的操作。

### Strategy.json 調整

```json
"buy": {
  "minDropPercentToConsider": 5,
  "entryGate": {
    "enabled": true,
    "tiers": [
      { "minDrop": 0,  "maxDrop": 5,  "rsiThreshold": null, "allowLeverage": false, "note": "底倉 DCA only" },
      { "minDrop": 5,  "maxDrop": 15, "rsiThreshold": 45,   "allowLeverage": false, "note": "淺層修正，禁 00675L" },
      { "minDrop": 15, "maxDrop": 30, "rsiThreshold": 35,   "allowLeverage": true,  "note": "深度回撤，開放 00675L" },
      { "minDrop": 30, "maxDrop": 999,"rsiThreshold": 30,   "allowLeverage": true,  "note": "極端恐慌，覆蓋情緒" }
    ]
  }
}
```

### 影響範圍

- `Strategy.json`（調整 `buy.minDropPercentToConsider`，新增 `buy.entryGate`）
- `src/modules/strategy/strategyEngine.mjs`（`buildDecision()` 前段新增 pre-entry gate 邏輯）
- `src/modules/strategy/signalRules.mjs`（RSI 加分機制保留，不調整 `oversold` 門檻）
- `src/test/backtest.mjs`（回測驗證各層觸發次數差異）
- Telegram 通知（標示當前進入的前置過濾層級）

### 難度

⭐⭐⭐ 高（需回測驗證各層行為，並確認與現有分數機制不衝突）

### 討論狀態

⚪ 待確認

---

## 📌【P1 高優先】VIX 情緒短路機制

### 狀態與目標摘要

- AI 新聞情緒為落後指標，在崩盤底部必定輸出 BEARISH。
- BEARISH 同時觸發 `bearishPenalty`（扣分）與 `bearishCooldownMultiplier`（冷卻期延長），在恰好是左側加碼最佳時機的底部造成策略癱瘓。
- 目前無任何機制可在 VIX 極端高位時覆蓋 AI 情緒的抑制效果。

### 動機

生命週期投資法的核心精神是「極端恐慌時應積極進場」，VIX 作為即時恐慌指數是比 AI 新聞情緒更快速、更可靠的極端行情訊號，應賦予其優先覆蓋權。

### 設計規格

| VIX 狀態 | 行為 |
|---------|------|
| VIX < 25 | 正常融合，AI BEARISH 正常扣分與冷卻延長 |
| VIX >= 28 且 VIX 開始回落 | 觸發「情緒短路」：忽略 BEARISH 扣分，解除冷卻期延長 |
| VIX >= 35（絕對值） | 強制情緒短路，無論 VIX 趨勢 |

### 建議 Strategy.json 新增欄位

```json
"macroSentiment": {
  "enabled": true,
  "bullishBonus": 3,
  "bearishPenalty": 5,
  "bearishCooldownMultiplier": 1.5,
  "vixOverrideTrigger": 28,
  "vixAbsoluteOverride": 35
}
```

### 影響範圍

- `src/modules/strategy/strategyEngine.mjs`（macroSentiment 段落新增 VIX override 邏輯）
- `Strategy.json`（新增 `vixOverrideTrigger`、`vixAbsoluteOverride`）
- 日報新增「情緒短路狀態」欄位（若觸發需明確標示）

### 難度

⭐⭐ 中

### 討論狀態

⚪ 待確認

---

## 📌【P1 高優先】Strategy.json 幽靈參數審計與清除

### 狀態與目標摘要

- `Strategy.json` 中存在若干欄位從未被 `strategyEngine.mjs` 或其他模組實際引用，維護者可能誤以為修改這些欄位有效，形成「幽靈參數」風險。
- 目前已確認的疑似幽靈參數與問題欄位如下表，完整引用狀況需進一步追蹤程式碼確認。

### 幽靈參數現況清單

| 參數路徑 | 問題類型 | 風險說明 |
|---------|---------|---------|
| `leverage.targetMultiplier` | 未被直接引用 | `strategyEngine.mjs` 的 allocation 陣列自行管理，維護者誤改此值不會產生任何效果 |
| `reserve.allocationRatio` | 語意衝突 / 可能已廢棄 | 預備金邏輯已由 `reserve.tiers` 控制，此欄位角色不明 |
| `reserve.tiers` | 待確認引用 | 實際引用位置與生效邏輯需追蹤確認 |
| `buy.minDropPercentToConsider` | 值為 0 等同無效 | 已在左側進擊矩陣計劃中調整為 5%，同時新增 entryGate 取代其角色 |
| `buy.dropScoreRules[*].label` | 文案與邏輯不一致 | 部分 label 與 minDrop 數值不符（如 `minDrop: 25` 但 label 為「大跌 >= 20%」） |

### 執行計劃

1. **全面追蹤**：針對 `Strategy.json` 中每個 key，以 `grep -r` 或 IDE 全域搜尋確認實際引用位置。
2. **產出審計文件**：新增 `docs/strategy-param-audit.md`，記錄每個參數的：
   - 實際引用模組與行號
   - 當前值與設計意圖
   - 是否為幽靈參數（建議保留 / 移除 / 重構）
3. **清除幽靈參數**：
   - 若 `leverage.targetMultiplier` 確認無引用 → 移除，或在 `getTargetLeverageByScore` 中正式納入計算邏輯。
   - 若 `reserve.allocationRatio` 已被 `reserve.tiers` 完全取代 → 移除，並在審計文件標注為 legacy。
4. **修正 label 一致性**：將所有 `dropScoreRules` 的 label 與 minDrop 對齊。
5. **建立參數命名規範**：審計完成後訂定 Strategy.json 欄位命名與棄用流程，防止未來再度出現幽靈參數。

### 審計文件格式（`docs/strategy-param-audit.md`）

```markdown
## leverage.targetMultiplier
- **當前值**：1.8
- **設計意圖**：目標槓桿倍數
- **實際引用**：❌ 未在程式碼中找到直接引用
- **建議**：移除 或 在 getTargetLeverageByScore() 正式引入

## reserve.allocationRatio
- **當前值**：0.5
- **設計意圖**：預備金配置比例
- **實際引用**：❌ 疑似已被 reserve.tiers 取代
- **建議**：確認後移除，標注為 legacy
```

### 影響範圍

- `Strategy.json`（移除或重構幽靈參數、修正 label）
- `docs/strategy-param-audit.md`（新增審計文件）
- `docs/modules/market_strategy.md`（同步更新參數說明）
- `src/modules/strategy/strategyEngine.mjs`（若正式引入 `leverage.targetMultiplier` 計算邏輯）

### 難度

⭐ 低（追蹤與清除本身工作量不大，產出文件為主要成本）

### 討論狀態

⚪ 待確認

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

> ⚠️ 此項目已升級為【P0 緊急】維持率狀態機 4 層重構，請參閱上方對應條目。
> 原 2 層邏輯調換順序的方案已整合進 4 層設計中。

---

## 📌【策略門檻】RSI / 跌幅與估值多階門檻優化（已升級為上方 P0 左側進擊矩陣）

> ⚠️ 此項目已升級為【P0 緊急】左側進擊矩陣：階層式進場前置過濾層，請參閱上方對應條目。
> 原建議方向中的三層架構（淺層修正 / 深度回撤 / 極端恐慌）已整合進 entryGate 設計中。
> `buy.rsi.oversold` 維持現有評分邏輯不直接下調，改以前置過濾層區分操作允許範圍。

---

## 📌【停利機制】BasePrice 管理與動態停利邏輯（已升級為上方 P1 廢除 BasePrice 計劃）

> ⚠️ 此項目已升級為【P1 高優先】廢除 BasePrice，改採 ATR/MA20 動態移動停利，請參閱上方對應條目。
> 原 BasePrice 管理策略（更新規則、scripts）保留為 Phase 1 過渡方案。

---

## 📌【冷卻期與情緒】MacroSentiment 交互與回測驗證（已升級整合 VIX 情緒短路）

### 狀態與目標摘要

- BEARISH 環境下同時存在分數扣分（`bearishPenalty`）與冷卻期延長（`bearishCooldownMultiplier`）。
- VIX 極端高位時覆蓋 AI 情緒的「情緒短路」機制已另立為【P1 高優先】VIX 情緒短路機制計劃。

### 建議方向（補充回測維度）

- 在 `backtest.mjs` 內加入 macroSentiment 維度回測：
  - 比較「有 sentimentScore + 冷卻延長」與「僅 sentimentScore 或僅冷卻延長」三種模式的績效。
  - 觀察 BEARISH 區間內的平均進場次數、勝率與最大回撤。
- 考慮增加上限：
  - 例如在估值低於某 PB 或 PE 閾值時，關閉冷卻延長效果但保留分數扣分。
  - 或在連續 N 天 BEARISH 卻持續大跌時，強制允許恐慌加碼通道。

### 影響範圍

- `Strategy.json`（調整 `macroSentiment.bearishPenalty`、`bearishCooldownMultiplier` 或新增估值例外參數）
- `src/modules/strategy/strategyEngine.mjs`
- `src/test/backtest.mjs`

### 難度

⭐⭐⭐ 高

### 討論狀態

⚪ 待確認

---

## 📌【資料完整性】lastBuyDate 與策略欄位一致性檢查（已升級為上方 P1 本地 fallback 快取）

> ⚠️ 此項目已升級為【P1 高優先】lastBuyDate 本地 fallback 快取，請參閱上方對應條目。

---

## 📌【策略欄位清理】未使用欄位與 label 一致性（已整合為上方 P1 幽靈參數審計）

> ⚠️ 此項目已整合升級為【P1 高優先】Strategy.json 幽靈參數審計與清除，請參閱上方對應條目。
> 原 label 一致性修正（`dropScoreRules` 文案對齊）保留為審計作業的一部分。

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
