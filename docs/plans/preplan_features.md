# Pre-plan Features (待評估與實作功能池)

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

建議雙層天花板（區分主動與被動擴張）：
- **主動擴張上限（例如 2.5x）：** 只要曝險大於 2.5x，禁止任何新資金的借款與買入（一票否決加碼）。
- **被動危機紅線（例如 2.8x 或 3.0x）：** 當市場崩盤導致被動曝險極度失控，威脅到整體破產時，才啟動「強制市價賣出 00675L 降槓桿」的斷尾求生機制（避免順週期砍倉發生在不必要的時候）。

### 著陸目標 (Recovery Target)

- 為了避免「凌遲式砍倉」（每次只賣一點點讓曝險降到 2.99x，隔天稍微震盪又觸發），必須設定 **「著陸目標 `grossLeverageRecoveryTarget`」（例如 2.0x 或 2.2x）**。
- 當觸發 3.0x 強迫平倉時，系統將一次性賣出足夠的 00675L，讓整體曝險一口氣降回安全的 2.0x 水位，提供足夠的下行緩衝空間。

### 建議方向

- 新增 `src/modules/strategy/leverageMonitor.mjs`
- 在每次 `buildDecision()` 前先計算 `grossLeverage`
- 實作雙層檢查：超過 3.0x 強制砍倉降槓桿至 `grossLeverageRecoveryTarget`；超過 2.5x 則一票否決加碼
- 日報新增「綜合曝險倍數（Gross Leverage）」欄位

### 影響範圍

- `src/modules/strategy/leverageMonitor.mjs`（新增模組）
- `src/modules/strategy/strategyEngine.mjs`（整合計算）
- Telegram 通知模板（新增欄位）
- `Strategy.json`（新增 `grossLeverageCeiling` 與 `grossLeverageRecoveryTarget` 參數）

### 難度

⭐⭐⭐ 高

### 討論狀態

⚪ 待確認

---

## 📌【P1 高優先】【計畫 A】歷史 PB 時間序列快取機制（pbHistoryProvider）

### 狀態

⚪ 待實作｜難度：⭐⭐ 中

### 目標摘要

建立每日自動累積、首次可自動補齊 5 年歷史的 PB 時間序列快取，供計畫 B（valuationGuard）計算分位數使用。完全不依賴 FinMind，資料來源與現行 `fetchMarketValuation()` 相同（TWSE BWIBBU_ALL）。

### 資料來源設計

| 用途     | API                             | 粒度       | 說明                                                 |
| -------- | ------------------------------- | ---------- | ---------------------------------------------------- |
| 每日追加 | `TWSE BWIBBU_ALL`（現行）       | **日資料** | `fetchMarketValuation()` 計算完後直接 append         |
| 歷史補齊 | `TWSE BWIBBU_ALL?date=YYYYMMDD` | **日資料** | 逐**日**補齊，沿用相同市值加權計算邏輯（見下方說明） |

> ⚠️ **統計學權重說明（重要）：**
> 計畫 B 的 PR 分位數計算本質是「計數比較」，歷史資料與每日追加資料的**粒度必須完全一致**，
> 否則會產生嚴重的 Data Weight Imbalance：
>
> - ❌ 舊設計（逐月補齊）：60 個月的歷史僅 60 筆，系統上線後半年即累積 120 筆「日資料」；
>   半年的日資料權重是過去 5 年的 **2 倍**，PR 分位數將嚴重向近期高估值傾斜。
> - ✅ 修正設計（逐日補齊）：歷史補齊與每日追加皆為日資料，保持 1:1 的樣本權重，
>   統計學意義完整，1260 筆對應真實 5 年窗口。

### 快取架構

整合至現有 `archiveManager` 體系，與 `rawMarketData.json` 並排儲存：

```
data/
├── marketData.json          ← 現有（今日快取）
├── pbHistory.json           ← 新增（歷史 PB 序列）
└── valuationGuardState.json ← 新增（計畫 B 防禦鎖定狀態）
```

**`pbHistory.json` 格式：**

```json
{
  "_meta": {
    "updatedAt": "2026-04-16",
    "source": "twse_bwibbu_all",
    "granularity": "daily",
    "totalRecords": 1260
  },
  "records": [
    { "date": "2021-04-16", "pb": 1.82 },
    { "date": "2021-04-17", "pb": 1.84 }
  ]
}
```

### 兩個獨立流程

**流程一：每日自動追加（平時運作）**

```
dailyCheck 執行
→ fetchMarketValuation() 計算當日 PB
→ pbHistoryProvider.appendToday(date, pb)
→ 讀取 pbHistory.json，若當日已存在則略過，否則 push 新紀錄
→ 寫回 pbHistory.json
```

**流程二：歷史補齊（首次或缺口修復）**

```
pbHistoryProvider.checkAndBackfill(targetDays = 1260)
→ 讀取現有快取，計算目前筆數
→ 若不足 targetDays × 0.5（630 筆），計算需補齊的日期清單（以「交易日」為單位）
→ 逐日呼叫 TWSE BWIBBU_ALL（帶日期參數），跳過非交易日（無資料時自動略過）
→ 對每個交易日做市值加權 PB 計算（邏輯同 fetchMarketValuation）
→ 合併、排序、去重後寫回 pbHistory.json
→ 每次請求間 sleep(800ms)，批次間（每 20 筆）sleep(3000ms) 避免觸發 TWSE 限流
```

> **關於 backfill 效能：** 1260 筆日資料 = 約 63 個交易月。TWSE BWIBBU_ALL 每次回傳整月資料，
> 實際只需約 **63 次 API 呼叫**（非 1260 次），每月取日期範圍內所有交易日批次處理，
> 總耗時約 3–5 分鐘，為一次性工時，不影響日常運作。

### 對外介面（供計畫 B 使用）

```javascript
export async function getPbHistoryRecords()           // 回傳完整 records 陣列
export async function appendToday(date, pb)           // 每日追加
export async function checkAndBackfill(targetDays = 1260) // 啟動時自動補齊
```

### 工作節次

| 節   | 工作內容                                                                  | 涉及檔案                                              |
| ---- | ------------------------------------------------------------------------- | ----------------------------------------------------- |
| 節一 | `archiveManager.mjs` 新增 `getPbHistory()` / `savePbHistory()` 方法       | `src/modules/data/archiveManager.mjs`                 |
| 節二 | 新增 `pbHistoryProvider.mjs`，實作 `appendToday()` / `checkAndBackfill()` | `src/modules/providers/pbHistoryProvider.mjs`（新增） |
| 節三 | `marketData.mjs` 判斷邏輯 E（rawValuation）成功後呼叫 `appendToday()`     | `src/modules/providers/marketData.mjs`                |
| 節四 | `dailyCheck.mjs` 啟動時呼叫 `checkAndBackfill()`                          | `src/dailyCheck.mjs`                                  |
| 節五 | `pbHistory.json` 加入 `.gitignore`                                        | `.gitignore`                                          |

### 影響範圍

- `src/modules/data/archiveManager.mjs`（新增 2 個方法）
- `src/modules/providers/pbHistoryProvider.mjs`（新增）
- `src/modules/providers/marketData.mjs`（新增追加呼叫）
- `src/dailyCheck.mjs`（啟動時觸發補齊）
- `.gitignore`

---

## 📌【P1 高優先】【計畫 B】PB 歷史分位數動態防護層（valuationGuard）

### 狀態

⚪ 待實作｜難度：⭐⭐⭐ 高

### 目標摘要

依賴計畫 A 提供的歷史 PB 序列，計算當前 PB 所在的歷史百分位數（Percentile Rank），以「相對估值」取代「絕對 PB 門檻」作為槓桿壓縮依據，解決固定門檻在不同市場環境下靈活性不足的問題。

### 核心概念

| 問題                                               | 解法                                   |
| -------------------------------------------------- | -------------------------------------- |
| 固定絕對 PB 門檻無法適應不同市場周期的估值中樞漂移 | 5 年滾動窗口 PR 分位數自動適應市場環境 |
| 硬切斷點造成邊界條件策略突變（估值懸崖效應）       | PR 為連續值，可線性內插實現平滑壓縮    |

**分位數計算（5 年滾動窗口）：**

```
PR = (歷史 5 年內低於當前 PB 的天數) / (總樣本天數) × 100
```

### 防護層規格（4 段）

| PR 區間      | 行為                                        | 槓桿乘數 |
| ------------ | ------------------------------------------- | -------- |
| PR < 70      | 常態運行                                    | ×1.0     |
| 70 ≤ PR < 80 | 輕度壓縮                                    | ×0.85    |
| 80 ≤ PR < 90 | 中度壓縮，禁止 00675L 新增，進入防禦狀態    | ×0.65    |
| PR ≥ 90      | 極度壓縮，啟動強制移動停利（Trailing Stop） | ×0.3     |

> ⚠️ **PR ≥ 90 不再直接硬停機（×0.0）**，改為「極度壓縮 + 趨勢雙重確認」機制（見下方）。
> 高估值代表市場脆弱，但不代表立刻崩盤；在 AI 驅動的歷史級牛市中，PR 可能長時間維持 90+，
> 直接歸零將導致系統在主升段過早出場。

### 趨勢雙重確認機制（PR ≥ 90 適用）

當 PR 進入 90 以上的「極度壓縮」狀態時，系統不直接歸零，而是啟動移動停利守備，
並在以下條件同時成立時才執行 ×0.0 強制清算：

**觸發條件（兩者擇一，任一成立即清算）：**

| 條件           | 說明                                                                 |
| -------------- | -------------------------------------------------------------------- |
| 跌破 MA20 確認 | 連續 **2 個交易日** 收盤價跌破 MA20 月線（代表趨勢實質破壞）         |
| ATR 支撐破位   | 股價跌破「前波高點 − ATR × `trailingStopAtrMultiplier`」（預設 2.0） |

**PR ≥ 90 狀態下的行為摘要：**

```
槓桿乘數：×0.3（極度壓縮，禁止所有新增槓桿）
移動停利：啟動（追蹤 MA20 或 ATR 支撐）
00675L：禁止新增，現有部位保留等待趨勢確認
清算觸發：跌破 MA20 連續 2 日 OR ATR 支撐破位 → 執行 ×0.0
```

### 狀態鎖定機制（State Latching，防死貓反彈重入）

> ⚠️ **雙重確認只是「入場」，缺少鎖定就會產生反覆橫跳（Whipsaw）**：
> 清算當天的隔日若出現死貓反彈（股價單日回站 MA20），而 PR 依然 ≥ 90，
> 系統無法判斷趨勢是否真正恢復，若直接解除防禦並重新建倉，
> 將在高波動期反覆觸發 ×0.0 ↔ ×0.3 切換，產生嚴重的交易摩擦損耗。

**觸發 ×0.0 清算後，系統進入「防禦鎖定（DefenseLatch）」狀態，直到以下任一解鎖條件成立：**

| #   | 解鎖條件            | 說明                                                                                                                                                                           |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 📉 估值降溫解鎖     | PR 實質回落至 < `latchReleasePR`（預設 85），代表市場估值壓力已釋放                                                                                                            |
| 2   | 💥 極端恐慌破冰     | 跌幅 > `panicDropPct`（預設 15%）且 RSI < `panicRsiThreshold`（預設 30），觸發左側恐慌加碼通道                                                                                 |
| 3   | 📈 趨勢強勢反轉解鎖 | 收盤價連續 `trendUnlockDays`（預設 **5**）交易日站上 MA`trendUnlockMaPeriod`（預設 **60**），且 MACD 柱狀圖 > 0。防止 EPS 下修導致估值長期高位、市場卻已重回多頭時陷入永久死結 |

**單日站回 MA20 不構成任何解鎖條件。**

> ⚠️ **解鎖後行為說明：**
>
> - 條件 1、2 解鎖：`defenseLatch` 重設為 `false`，`valuationGuard` 依當日 PR 重新計算槓桿乘數，正常進入估值防禦各 tier。
> - 條件 3 解鎖：`defenseLatch` 重設為 `false`，但**不完全解除防護**——若當前 PR ≥ 90，仍套用 ×0.3 槓桿壓縮（valuationGuard 持續生效）。設計哲學：「讓市場用強勢資金流證明多頭已修復，但高估值壓縮機制不因此失效」。

**`valuationGuardState.json` — 防禦狀態快取（新增）：**

```json
{
  "latchActive": true,
  "latchTriggeredAt": "2026-04-16",
  "latchTriggerReason": "ma20_break_confirmed",
  "latchReleasedAt": null,
  "latchReleaseReason": null
}
```

> 此快取與 `pbHistory.json` 並排儲存於 `data/`（見計畫 A「快取架構」目錄樹），納入 `.gitignore`，
> 並在 `dailyCheck` 啟動時讀取。
> 解鎖時補寫 `latchReleasedAt`（解鎖日期）與 `latchReleaseReason`
> （`"pr_cooldown"` / `"panic_break_in"` / `"trend_strong_unlock"`），供日後回測追蹤使用。

### 決策模組覆蓋層級（Override Hierarchy）

本系統的多個決策模組存在訊號對撞可能性（尤其在高估值 + 極端崩跌並存時）。
必須在 `buildDecision()` 中明確定義執行優先序，確保極端情境下不產生邏輯衝突。

**典型衝突場景：**

> PR = 95（計畫 B：極度壓縮 + 清算守備）× VIX = 45 + 跌幅 20%（系統原有恐慌加碼）
> 兩個模組訊號對撞 → 如果無優先級，系統行為不可預測。

**`buildDecision()` 模組執行順序（由高至低覆蓋）：**

> ⚠️ **風控鐵律說明（Priority 0）：**
> 維持率狀態機（critical / frozen / protect）是凌駕於所有策略邏輯的「熔斷層」，
> 在 `buildDecision()` 最頂端執行並立即 return，任何維持率危機下
> 「極端恐慌破冰」均無法觸發。此設計已在現有程式碼中實作完畢（見 `getMarginLayer()`）。
> 計畫 B 的各節任務在進入常態邏輯（`marginLayer === 'normal'`）後才生效。

| 優先序        | 層級名稱                    | 觸發條件                                                                                          | 行為                                                                                                   | 說明                                                                                                                              |
| ------------- | --------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **1（最高）** | 維持率危機                  | 維持率 < 危險門檻（現有 P0 狀態機）                                                               | 強制降槓，一票否決所有加碼                                                                             | 保命優先，一票否決                                                                                                                |
| **1.5**       | 生命週期後期保守期          | 距退休 < 5 年（`lifecyclePhase === 'conservative'`）                                              | 禁止所有新增槓桿與借款；MA20/ATR 停利 Activation Cushion 無條件強制生效                                | 全局旗標，僅禁止新增、不干預現有部位停利執行；Priority 2 Gross Leverage 天花板仍正常運作                                          |
| **2**         | Gross Leverage 天花板       | grossLeverage > 2.5x                                                                              | 強制壓縮至下一檔位，**恐慌破冰時亦不得新增借款與 00675L**；僅允許買入 0050 現貨                        | 避免死亡螺旋；此層不可被 Priority 3 覆蓋                                                                                          |
| **3**         | 極端恐慌破冰                | 跌幅 > 20% 且 VIX > `panicVixThreshold`（預設 35）                                                | **Bypass 計畫 B/C**，直接進入左側恐慌加碼通道；若同時觸發 Priority 2，則**限縮為僅允許買入 0050 現貨** | 受制於維持率；若 Gross Leverage 超限，加碼行為受限，並於 Telegram 標示「⚠️ 恐慌破冰但 Gross Leverage 超限，加碼限縮為 0050 現貨」 |
| **4**         | 估值防禦鎖定（Latch）       | `isLatched() === true`                                                                            | 等待解鎖條件，禁止重建倉                                                                               | 防死貓反彈重入                                                                                                                    |
| **5**         | 計畫 B（valuationGuard）    | PR 分位數防護                                                                                     | 套用 guardMultiplier                                                                                   | 相對估值壓縮                                                                                                                      |
| **5.5**       | MA20/ATR 動態停利           | 停利 Active 且跌破 MA20 連續 2 日 OR ATR 支撐破位（PR < 90 適用；PR ≥ 90 已由計畫 B 節三-A 處理） | 清空 Tactical 部位至 Baseline 水位                                                                     | 停利執行層，不影響是否允許加碼；PR ≥ 90 時直接走計畫 B 路徑，不重複觸發本層                                                       |
| **6**         | 計畫 C（valuationMomentum） | PR 動量感知                                                                                       | 疊加 momentumAdjustment                                                                                | 趨勢方向補正                                                                                                                      |
| **7（最低）** | 常態策略邏輯                | weightScore 評分                                                                                  | 正常 allocation 表查詢                                                                                 | 日常 DCA + 戰術加碼                                                                                                               |

**極端恐慌破冰的 Bypass 條件說明：**

```
極端恐慌 = (跌幅 > panicBypassDropPct) AND (VIX > panicVixThreshold)

若成立：
→ 忽略計畫 B 的 guardMultiplier（不論 PR 多高）
→ 忽略計畫 C 的 momentumAdjustment
→ 解除 DefenseLatch（同步清除鎖定狀態）
→ 進入恐慌加碼通道，依原有恐慌加碼邏輯執行
→ Telegram 通知標示「⚠️ 極端恐慌破冰：估值防禦已 Bypass」

⚠️ Gross Leverage 超限時的限縮行為（Priority 2 不可被覆蓋）：
→ 若同時 grossLeverage > 2.5x：
   - 禁止新增 00675L 買進與任何新增質押借款
   - 僅允許買入 0050 現貨（不增加借款槓桿）
   - Telegram 額外標示「⚠️ 恐慌破冰但 Gross Leverage 超限，加碼限縮為 0050 現貨」
→ 若同時 grossLeverage > 3.0x（被動危機紅線）：
   - 強制執行降槓桿（賣出 00675L 至 grossLeverageRecoveryTarget）
   - 恐慌加碼通道完全封閉，Priority 1 邏輯優先接管
```

**Strategy.json 補充 `overrideHierarchy` 參數：**

```json
"overrideHierarchy": {
  "panicBypassEnabled": true,
  "panicBypassDropPct": 0.20,
  "panicVixThreshold": 35
}
```

> **注意**：`panicBypassDropPct`（Bypass 條件，20%）高於 `latch.panicDropPct`（Latch 解鎖條件，15%）。
> 兩者分開命名以避免混淆：`latch.panicDropPct` 是「解除防禦鎖定」，
> `panicBypassDropPct` 是「完全跳過估值防禦機制」，語意不同。

### 波動率感知補正（高位尾部效應修正）

> ⚠️ **線性絕對值門檻在極端分位數區域會失去敏感度**：
> 當 PR 已高達 85 時，頂部空間僅剩 15，PR 在 20 天內幾乎不可能再上升 10；
> 使用固定 +10 門檻會導致計畫 C 在最需要防禦的高位反而靜默失效。

**補正機制：在 PR ≥ 85 的高位區，加入 VIX 急升作為替代觸發條件**

| 條件                                                      | 說明                                   | 行為                     |
| --------------------------------------------------------- | -------------------------------------- | ------------------------ |
| PR ≥ 85 且 `prMomentum > +5`（放寬門檻）                  | 高位微幅動量即視為警示                 | 額外 ×0.85（同原設計）   |
| PR ≥ 85 且 VIX 單日上升 > `vixSpikeThreshold`（預設 20%） | 不論 prMomentum 大小，高位急跌風險優先 | 額外 ×0.85，強制觸發壓縮 |
| PR ≥ 85 且 VIX 絕對值 > `vixAbsoluteHigh`（預設 30）      | 高位 + 恐慌並存                        | 額外 ×0.7（加重壓縮）    |

**注意：** 計畫 B 的 PR ≥ 90 已啟動雙重確認機制，計畫 C 的波動率補正主要覆蓋 **PR 85–90 的過渡敏感區域**，兩者不重疊。此補正參數定義於計畫 C 的 `valuationMomentum.highPRZone`（見計畫 C「Strategy.json 新增欄位」段落）。

### Strategy.json 新增欄位

```json
"valuationGuard": {
  "enabled": true,
  "lookbackDays": 1260,
  "tiers": [
    { "maxPR": 70,  "leverageMultiplier": 1.0,  "note": "常態" },
    { "maxPR": 80,  "leverageMultiplier": 0.85, "note": "輕度壓縮" },
    { "maxPR": 90,  "leverageMultiplier": 0.65, "note": "中度壓縮，禁 00675L" },
    { "maxPR": 100, "leverageMultiplier": 0.3,  "note": "極度壓縮，啟動移動停利" }
  ],
  "trailingStop": {
    "hhvWindow": 20,
    "atrPeriod": 14,
    "trailingStopAtrMultiplier": 2.0
  },
  "latch": {
    "enabled": true,
    "latchReleasePR": 85,
    "panicDropPct": 0.15,
    "panicRsiThreshold": 30,
    "trendUnlockDays": 5,
    "trendUnlockMaPeriod": 60
  }
}
```

> **`trailingStop` 子物件說明：**
>
> - `hhvWindow`：前波高點定義為過去 N 個交易日的滾動最高收盤價 `HHV(N)`（預設 20）
> - `atrPeriod`：ATR 計算週期（預設 14）
> - `trailingStopAtrMultiplier`：停利觸發條件為 `收盤價 < HHV(hhvWindow) − ATR(atrPeriod) × multiplier`
>
> **實作提醒（節三-B）：** 需在 `indicators.mjs` 新增 `calcHHV(closePrices, window)` 函式，
> 回傳滾動視窗內的最大值陣列，供 `computeSellSignals()` 調用。

### Fallback 機制（資料不足時）

當 `pbHistory.json` 筆數低於 `valuationGuard.lookbackDays × 0.1`（即少於 126 筆）時，
`resolveValuationGuard()` 應回傳 `{ multiplier: 1.0, fallback: true, reason: "insufficient_history" }`，
並在 Telegram 通知中靜默標示「⚠️ 估值防護資料不足，暫以常態運行」，不拋錯、不阻斷流程。

### 工作節次

| 節                 | 工作內容                                                                                                                                                                                                                                                                                                                                                              | 涉及檔案                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 節〇（前置）       | archiveManager.mjs 新增 getValuationGuardState() / saveValuationGuardState()                                                                                                                                                                                                                                                                                          | src/modules/data/archiveManager.mjs                                     |
| 節一               | `Strategy.json` 新增 `valuationGuard` 區段（含 `tiers`、`trailingStop`、`latch` 完整結構）                                                                                                                                                                                                                                                                            | `Strategy.json`                                                         |
| 節二               | `validateStrategyConfig()` 補齊 `valuationGuard` 驗證                                                                                                                                                                                                                                                                                                                 | `signalRules.mjs`                                                       |
| 節三               | 新增 `resolveValuationGuard(currentPB, records, config)` 純函式，計算 PR 與命中 tier                                                                                                                                                                                                                                                                                  | `strategyEngine.mjs`                                                    |
| 節三‑A             | 新增 `resolveTrendConfirmation(priceData, config)` 函式，計算 MA20 跌破天數與 ATR 支撐位，供節四整合使用                                                                                                                                                                                                                                                              | `strategyEngine.mjs`                                                    |
| 節三‑B（指標擴充） | 擴充 `indicators.mjs`：新增 MA20（20 日簡單移動平均）與 ATR(14)（14 日真實波動幅度）計算，回傳 `ma20Arr` 與 `atrArr`；確認 `calculateIndicators(history)` 輸入的 `history` 長度至少 **60 筆**（現有最短為 26 筆 MACD 需求，MA20 + ATR 需求不變，但 `resolveTrendConfirmation` 需要足夠的緩衝期）。同步更新 `dailyCheck.mjs` 歷史 K 線抓取長度從現有值提升至 **60 根** | `src/modules/strategy/indicators.mjs`、`src/dailyCheck.mjs`             |
| 節三‑C             | `buildDecision()` 在 PR ≥ 90 清算後設定 latch；每日啟動時先檢查 latch 狀態，若 latch 已啟動則略過正常評估流程，直接套用解鎖條件判斷                                                                                                                                                                                                                                   | `strategyEngine.mjs`、`dailyCheck.mjs`                                  |
| 節三‑D             | `buildDecision()` 最前端加入優先序判斷路由（isPanicBypass → isLatched → guardMultiplier → momentumAdjustment → normalLogic），並在 Telegram 通知中標示當前生效的優先層級                                                                                                                                                                                              | `strategyEngine.mjs`、`telegramHtmlBuilder.mjs`                         |
| 節四               | `buildDecision()` 整合，套用 `resolveValuationGuard()` 回傳的槓桿乘數                                                                                                                                                                                                                                                                                                 | `strategyEngine.mjs`                                                    |
| 節五               | Telegram 通知新增 PR 分位數標示（例如 `📊 PB PR84 → 中度壓縮 ×0.65`）                                                                                                                                                                                                                                                                                                 | `telegramHtmlBuilder.mjs`                                               |
| 節六               | 文件更新：`preplan_features.md` 狀態標記為已完成，條目搬移至 `finishedplan_features.md`                                                                                                                                                                                                                                                                               | `docs/plans/preplan_features.md`、`docs/plans/finishedplan_features.md` |

### 影響範圍

- `Strategy.json`
- `src/modules/strategy/signalRules.mjs`
- `src/modules/strategy/strategyEngine.mjs`
- `src/modules/notifications/templates/telegramHtmlBuilder.mjs`
- `docs/plans/preplan_features.md`
- `docs/plans/finishedplan_features.md`
- `src/modules/strategy/indicators.mjs`（新增 MA20 / ATR 計算）
- `data/valuationGuardState.json`（新增，納入 `.gitignore`）

---

## 📌【P1 高優先】【計畫 C】PB 分位數趨勢感知層（valuationMomentum）

### 狀態

⚪ 待實作｜難度：⭐⭐ 中

### 目標摘要

依賴計畫 A 的歷史序列與計畫 B 的 PR 分位數，在計畫 B 防護層之上額外感知「估值正在往哪個方向走」，對快速惡化（PR 短期內快速上升）的情境給予額外壓縮，對估值從高位回落時提前解除壓縮。

### 核心概念

只看當前 PR 絕對值有盲點：PR 83 穩定橫盤 vs PR 從 60 快速竄升至 83，風險程度截然不同。計畫 C 透過計算 PR 的**短期動量**（N 日變化量）作為輔助調整因子。

### 動量計算

```
prMomentum = PR_today − PR_N日前（預設 N=20）
```

| prMomentum | 含義         | 額外調整                                |
| ---------- | ------------ | --------------------------------------- |
| > +10      | 估值快速惡化 | 在計畫 B 基礎上額外再 ×0.85（疊加壓縮） |
| −10 ~ +10  | 橫盤穩定     | 無調整                                  |
| < −10      | 估值明顯回落 | 解除計畫 B 的一個壓縮段（PR 降一 tier） |

### Strategy.json 新增欄位

```json
"valuationMomentum": {
  "enabled": true,
  "lookbackDays": 20,
  "risingThreshold": 10,
  "fallingThreshold": -10,
  "risingPenaltyMultiplier": 0.85,
  "fallingRelief": true,
  "highPRZone": {
    "triggerPR": 85,
    "relaxedMomentumThreshold": 5,
    "vixSpikeThreshold": 0.2,
    "vixSpikeMultiplier": 0.85,
    "vixAbsoluteHigh": 30,
    "vixAbsoluteMultiplier": 0.7
  }
}
```

> **`highPRZone` 子物件說明（高位尾部效應補正）：**
> 當 PR ≥ `triggerPR`（預設 85）時，線性絕對值門檻在頂部空間不足的情況下會靜默失效，
> 因此補入以下兩個替代觸發條件：
>
> - `relaxedMomentumThreshold`：高位動量門檻放寬至 +5（原為 +10）
> - `vixSpikeThreshold`（20%）+ `vixSpikeMultiplier`（×0.85）：VIX 單日急升時強制壓縮
> - `vixAbsoluteHigh`（30）+ `vixAbsoluteMultiplier`（×0.7）：高位 + VIX 恐慌並存時加重壓縮
>
> 此補正僅覆蓋 **PR 85–90 的過渡敏感區域**，PR ≥ 90 已由計畫 B 雙重確認機制處理，不重疊。

### 兩層疊加順序

```
① 計畫 B（PR 分位數） → guardMultiplier
② 計畫 C（PR 動量） → momentumAdjustment

finalMultiplier = guardMultiplier × momentumAdjustment
```

### 工作節次

| 節   | 工作內容                                                                                | 涉及檔案                                                                |
| ---- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 節一 | `Strategy.json` 新增 `valuationMomentum` 區段（含 `highPRZone` 完整結構）               | `Strategy.json`                                                         |
| 節二 | `validateStrategyConfig()` 補齊 `valuationMomentum` 驗證                                | `signalRules.mjs`                                                       |
| 節三 | 新增 `resolveValuationMomentum(records, config)` 函式，計算 prMomentum 與調整因子       | `strategyEngine.mjs`                                                    |
| 節四 | `buildDecision()` 整合，在計畫 B 乘數基礎上疊加動量調整                                 | `strategyEngine.mjs`                                                    |
| 節五 | Telegram 通知新增動量標示（例如 `📈 估值動量 +13 → 額外壓縮`，穩定時靜默略過）          | `telegramHtmlBuilder.mjs`                                               |
| 節六 | 文件更新：`preplan_features.md` 狀態標記為已完成，條目搬移至 `finishedplan_features.md` | `docs/plans/preplan_features.md`、`docs/plans/finishedplan_features.md` |

### 影響範圍

- `Strategy.json`
- `src/modules/strategy/signalRules.mjs`
- `src/modules/strategy/strategyEngine.mjs`
- `src/modules/notifications/templates/telegramHtmlBuilder.mjs`
- `docs/plans/preplan_features.md`
- `docs/plans/finishedplan_features.md`

### 前置依賴

- **計畫 A**（pbHistoryProvider）必須先完成
- **計畫 B**（valuationGuard）必須先完成

## 📋 估值動態防護計畫總覽（A / B / C）

| 計畫   | 名稱                                      | 前置依賴   | 狀態      |
| ------ | ----------------------------------------- | ---------- | --------- |
| 計畫 A | 歷史 PB 時間序列快取（pbHistoryProvider） | 無         | ⚪ 待實作 |
| 計畫 B | PB 歷史分位數動態防護層（valuationGuard） | 計畫 A     | ⚪ 待實作 |
| 計畫 C | PB 分位數趨勢感知層（valuationMomentum）  | 計畫 A + B | ⚪ 待實作 |

---

## ~~📌【P1 高優先】PB 估值動態衰減機制（valuationPenaltyFactor）~~

> ⚠️ 此計畫已由【計畫 B】PB 歷史分位數動態防護層（valuationGuard）全面取代，不再實作。
> 原設計的硬切斷門檻（PB 1.8 / 2.0 / 2.2）已由 PR 分位數（PR70/80/90）動態取代。

---

## 📌【P1 高優先】廢除 BasePrice，改採 ATR/MA20 動態移動停利

### ⚠️ 前置依賴說明

- MA20 與 ATR(14) 指標計算已由**計畫 B 節三-B**（`indicators.mjs` 擴充）統一實作，本計畫**不另行建立**。
- 本計畫的 Phase 2 實作（切換至 `ma20` 模式）需在**計畫 B 節三-B 完成**後才可進行，以確保 `calcMA20()`、`calcATR()` 已存在於 `indicators.mjs`。
- 前置依賴順序：**計畫 A → 計畫 B（含節三-B）→ 本計畫 Phase 2**

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
- **停利啟動條件：** 該批買入的部位，必須滿足 **「帳面未實現獲利 > X%（例如 10%）」** 或 **「股價在買入後，首次向上突破站穩 MA20」** 之後，移動停利（Trailing Stop）的監控機制才會正式被 `Active`（啟動）。
  - 在此條件滿足前，系統處於「左側建倉熬過陣痛期」，不應被右側的短均線破位給洗出場。
- 當一般移動停利（MA20/ATR）觸發時，系統應『完全清空』當前的戰術加碼部位（Tactical Allocation），將 00675L 的曝險降回常態底倉（Baseline DCA）水位

### 建議方向（分階段）

~~1. **Phase 1（過渡）**：在 `sell` 中新增 `anchorType` 欄位，預設 `basePrice` 維持現狀。~~ 2. **Phase 2（切換）**：切換至 `ma20` 模式，移除 `BasePrice.txt` 依賴，改從 TWSE API 即時計算。3. **Phase 3（驗證）**：回測不同 anchor 模式的停利時機與後續回撤，調整參數。

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

### 與其他計畫的關聯

> 📋 **本計畫為「績效分析與回測」整合計畫的 Phase 1，建議依以下三階段實作：**
>
> | Phase                 | 內容                                                                   | 前置依賴                                                                        |
> | --------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
> | **Phase 1（本計畫）** | `backtest runner` 基礎架構 + `archiveManager` 歷史快照讀取 API         | 無                                                                              |
> | **Phase 2**           | 加入 `signalCategory` 維度分析（見「訊號類型分類與月報統計」計畫）     | Phase 1 完成 + 「Baseline DCA 與戰術加碼雙層架構」完成（`signalType` 欄位存在） |
> | **Phase 3**           | MacroSentiment 回測維度補充（見「MacroSentiment 交互與回測驗證」計畫） | Phase 1 完成                                                                    |
>
> `archiveManager` 的歷史快照讀取 API 應在本計畫（Phase 1）中統一建立，
> Phase 2 與 Phase 3 直接沿用，**不另行擴充**，避免同一模組被多個計畫重複修改。

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

## 📌【停利機制】BasePrice 管理與動態停利邏輯（已升級為上方 P1 廢除 BasePrice 計劃）

> ⚠️ 此項目已升級為【P1 高優先】廢除 BasePrice，改採 ATR/MA20 動態移動停利，請參閱上方對應條目。
> 原 BasePrice 管理策略（更新規則、scripts）保留為 Phase 1 過渡方案。

---

## 📌【冷卻期與情緒】MacroSentiment 交互與回測驗證（已整合 VIX 情緒短路 ✅ 已完成）

> ⚠️ VIX 情緒短路機制已完成，請參閱`finishedplan_features.md`【P1 已完成】VIX 情緒短路機制條目。
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

### 前置依賴

> ⚠️ **本計畫為「績效分析與回測」整合計畫的 Phase 3，需以下項目先行完成：**
>
> 1. **「策略訊號回測與績效統計」（Phase 1）**：`backtest runner` 基礎架構與 `archiveManager` 歷史快照讀取 API 必須已建立，本計畫的 MacroSentiment 維度分析才可直接掛載，**不另行建立新的快照讀取路徑**。
>
> Phase 3 與 Phase 2（訊號類型分類）彼此無依賴，可在 Phase 1 完成後平行進行。

### 討論狀態

⚪ 待確認（回測維度部分）

---

## 📌【資料完整性】lastBuyDate 與策略欄位一致性檢查（已升級為上方 P1 本地 fallback 快取）

> ⚠️ 此項目已升級為【P1 高優先】lastBuyDate 本地 fallback 快取，請參閱上方對應條目。

---

## 📌【策略演化】生命週期風險預算與槓桿曲線

### 狀態與目標摘要

- 目前策略 implicitly 假設使用者風險承受度固定，未顯式納入「年齡 / 投資年限 / 距離目標年」等生命週期參數。
- allocation 槓桿檔位主要依 weightScore 決定，與投資年齡無關。

### 動機

生命週期投資法通常會在投資早期容忍較高風險與槓桿，接近目標年份時逐步降低風險曝險。現有設計在工程上已具備彈性，但缺少這個 explicit 維度。

### 建議方向

- 引入「生命週期投資法（Lifecycle Investing）」的數學模型參數，定義生命週期 Profile：
  - **距退休 > 15 年（早期累積期）：** 解鎖最高 2.0x 槓桿權限（允許策略在低點全開）。
  - **距退休 5 ~ 15 年（中期平衡期）：** 槓桿天花板隨時間線性遞減，上限壓縮至 1.2x ~ 1.5x。
  - **距退休 < 5 年（後期保守期）：** 進入「只出不進 (Sell-only Mode)」。禁止任何「新增」的 00675L 買進與質押撥款，但既有帳上部位不強制認賠（避免熊市谷底硬著陸）。既有部位將套用更緊縮的「ATR / MA20 移動停利線」，在右側反彈波段逐步獲利了結，實現平滑去槓桿化 (Smooth Deleveraging)。
  當投資人進入『後期保守期（Sell-only Mode）』時，系統將『強制 Bypass（略過）』移動停利的啟動門檻（Activation Cushion）。無論當下部位是否獲利，MA20/ATR 停利防線皆無條件立即生效。
- 生命週期參數來源：
  - 初期可先在 `.env` 或 Google Sheet 設定「目標年份」「出生年份」等，後續再考慮在 Mini App 做 UI 調整。
- 策略引擎整合：
  - 在 `fetchStrategyConfig()` 或 `evaluateInvestmentSignal()` 中讀取當前 profile，動態選用上述對應的 leverage 上限與參數。

### 影響範圍

- `Strategy.json`（新增 lifecycleProfiles 區段）
- `src/modules/strategy/riskManagement.mjs`
- `webapp` Mini App 未來可新增生命週期設定頁面

### 難度

⭐⭐⭐ 高（牽涉策略設計與 UX）

### 與 Override Hierarchy 的整合規範

> 📋 **生命週期 Phase 在 `buildDecision()` 中的定位為 Priority 1.5（介於維持率危機與 Gross Leverage 天花板之間）。**
>
> **作用範圍說明：**
>
> - 生命週期後期保守期（`lifecyclePhase === 'conservative'`）是一個**全局旗標**，作用於以下兩個層面：
>   1. **禁止新增**：禁止所有新增 00675L 買進與新增質押借款（等同永久套用 Gross Leverage 主動擴張上限邏輯，但不以 grossLeverage 數值為觸發條件）。
>   2. **Activation Cushion 強制 Bypass**：MA20/ATR 移動停利的「啟動門檻（Activation Cushion）」無條件略過，停利防線立即生效（詳見下方說明）。
> - **不干預現有部位的停利執行**：後期保守期不強制清算，現有部位依 MA20/ATR 停利線自然出場（平滑去槓桿化）。
> - **Priority 2 Gross Leverage 天花板仍正常運作**：後期保守期不取代 Gross Leverage 監控，兩者並行。
>
> **與其他優先層的交互：**
>
> | 情境                                           | 行為                                                                                                     |
> | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
> | 後期保守期 + 維持率危機（Priority 1）          | Priority 1 優先，強制降槓邏輯接管                                                                        |
> | 後期保守期 + Gross Leverage 超限（Priority 2） | 兩者並行，均禁止新增，Gross Leverage 強制砍倉邏輯仍可觸發                                                |
> | 後期保守期 + 極端恐慌破冰（Priority 3）        | **後期保守期不被恐慌破冰 Bypass**：恐慌破冰僅 Bypass 計畫 B/C 估值防禦，不解除生命週期禁止新增槓桿的限制 |

### Activation Cushion 覆蓋行為規範

> 📋 **「廢除 BasePrice」計畫的停利啟動條件（Activation Cushion）在生命週期後期保守期下的覆蓋規則：**
>
> **一般情況（非後期保守期）：**
>
> ```
> 移動停利啟動條件（擇一滿足）：
> → 帳面未實現獲利 > sell.activationProfitPct（例如 10%）
> → 股價在買入後首次向上突破站穩 MA20
> 條件未滿足前：系統處於「左側建倉陣痛期」，MA20/ATR 停利不監控
> ```
>
> **後期保守期（`lifecyclePhase === 'conservative'`）：**
>
> ```
> 強制 Bypass Activation Cushion：
> → 無論當下部位是否獲利，MA20/ATR 停利防線無條件立即生效
> → 不等待 10% 獲利門檻，不等待首次站穩 MA20
> → Telegram 通知標示「🔒 生命週期保守期：停利啟動門檻已略過，MA20/ATR 防線即時生效」
> ```
>
> **設計哲學：** 後期保守期的目標是「平滑去槓桿化」而非「立即清倉」。
> Bypass Activation Cushion 確保任何反彈波段都能被停利機制捕捉，
> 而非等待獲利門檻才開始守備，避免在熊市中永遠等不到啟動條件而錯失出場時機。

### Strategy.json 新增欄位（補充）

```json
"lifecycle": {
  "enabled": true,
  "targetRetirementYear": 2045,
  "birthYear": 1990,
  "phases": [
    {
      "name": "accumulation",
      "yearsToRetirement": 15,
      "maxLeverageMultiplier": 2.0,
      "note": "早期累積期，解鎖最高槓桿"
    },
    {
      "name": "balanced",
      "yearsToRetirement": 5,
      "maxLeverageMultiplier": 1.5,
      "note": "中期平衡期，槓桿線性遞減"
    },
    {
      "name": "conservative",
      "yearsToRetirement": 0,
      "maxLeverageMultiplier": 0.0,
      "note": "後期保守期，禁止新增槓桿，Activation Cushion 強制 Bypass",
      "forceBypassActivationCushion": true
    }
  ]
}
```

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

### 與其他計畫的關聯

> ⚠️ **本計畫是「單日/區間撥款上限控制」計畫的前置依賴。**
> `signalType`（`baseline | tactical_drop | tactical_panic`）欄位必須在本計畫完成後才存在，
> 「撥款上限控制」計畫中的「額度排擠防護（Budget Priority）」邏輯才有依據識別 Baseline 與 Tactical 各自的資金需求。
> **建議兩計畫合併為同一 PR 分節實作，避免中間狀態（有分層但無上限、或有上限但無分層）短暫上線。**

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

### 前置依賴

> ⚠️ **本計畫為「績效分析與回測」整合計畫的 Phase 2，需以下兩項先行完成：**
>
> 1. **「策略訊號回測與績效統計」（Phase 1）**：`archiveManager` 歷史快照讀取 API 與 `backtest runner` 基礎架構必須已建立，本計畫的 `signalCategory` 統計邏輯才有資料來源可讀取。
> 2. **「Baseline DCA 與戰術加碼雙層架構」**：`signalType` 欄位（`baseline | tactical_drop | tactical_panic`）必須存在於每日快照中，本計畫的「各類訊號績效概覽」才有意義。
>
> **建議實作順序：Phase 1 → Baseline/Tactical 拆分 → 本計畫（Phase 2）**

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

- 新增風控參數（依整體帳戶淨值連動，規模化擴張）：
  - `trading.maxDailyLoanIncreasePct`：單日最大新增借款佔**當前帳戶淨值**的百分比（例如 5% 或 10%）。
  - `trading.maxRollingLoanIncreasePct`：淨新增借款（Net Loan Increase），計算公式為：近 10 日的總借款金額 - 近 10 日的總還款金額，淨新增借款的計算結果必須透過 Math.max(0, NetLoan) 進行底部截斷（Floor at Zero）。
    - 系統在區間內有執行「停利/再平衡還款」，戰術彈藥庫的額度就會被自動釋放（重置），確保資金使用效率最大化，不會發生無謂的額度死鎖。
- 在 daily pipeline 中：
  - 根據當前 totalLoan 與建議 targetLeverage，計算預期新增借款額比例。
  - **額度排擠防護 (Budget Priority)：** 必須賦予 Baseline DCA 最高的撥款優先權。系統應先從每日上限中扣除 Baseline DCA 所需預算，剩餘的額度才分配給 Tactical (戰術加碼) 模組去執行，避免極端恐慌時的大額加碼中斷長期的紀律定時定額。
  - 若雙層需求加總超出上限，先滿足 Baseline，再由 Tactical 將剩餘額度打滿。
- 可於月報中簡單列出「本月加碼資金節奏」摘要，幫助調整參數。

### 影響範圍

- `Strategy.json`（新增資金上限相關參數）
- `src/modules/strategy/strategyEngine.mjs`
- `src/modules/storage.mjs`

### 難度

⭐⭐⭐ 高

### 前置依賴

> ⚠️ **本計畫依賴「Baseline DCA 與戰術加碼雙層架構」計畫先行完成。**
> `signalType` 欄位（`baseline | tactical_drop | tactical_panic`）必須已存在於 `strategyEngine.mjs` 的決策輸出中，
> 「額度排擠防護（Budget Priority）」中「先扣除 Baseline 預算、剩餘分配 Tactical」的邏輯才可正確實作。
>
> **建議實作順序：**
>
> 1. 完成「Baseline DCA 與戰術加碼雙層架構」（`signalType` 拆分）
> 2. 接續實作本計畫的撥款上限與 Budget Priority 邏輯
> 3. 兩計畫建議合入同一 PR，分節執行，確保不出現中間不完整狀態上線

### 討論狀態

⚪ 待確認