# Strategy.json 參數異動說明

> **最後更新：** 2026-04-16
> **版本：** Strategy.json v2.4
> **關聯計劃：** P0 維持率 4 層狀態機、P0 左側進擊矩陣

---

## 1. `maintenance.frozenZone` — 新增欄位

### 基本資訊

| 項目 | 內容 |
|------|------|
| **路徑** | `maintenance.frozenZone` |
| **類型** | `number`（維持率 %） |
| **修改前** | 欄位不存在 |
| **修改後** | `145` |
| **生效 Commit** | `98a6cdb` |

### 設計理由

原有 `buildDecision()` 僅有 2 層維持率分岐：`protectTrigger(160)` 和 `mmDanger(140)`。在 140–160% 的危險走廊中，追繳分支被防禦層過濾遠覆蓋，導致㌀強制降槓桿、㌁機制實際失效。

新增 `frozenZone: 145` 作為第 2 層「高危凍結」區間上界，將維持率風控分為 4 層：

| 層級 | 門溻 | 行為 |
|------|------|------|
| 🔴 斷頭危機 | < 135% | 強制市價降槓桿警示，一票否決所有加碼 |
| 🟠 高危凍結 | 135–145% | 禁止所有新進場，強烈通知補足保證金 |
| 🟡 預備金防禦 | 145–160% | 暫停高槓桿加碼，允許 baseline DCA |
| 🟢 常態運行 | >= 160% | 允許策略引擎完整運作 |

### 相關欄位對照

```json
"maintenance": {
  "protectTrigger": 160,   // 預備金防禦門溻（原有）
  "protectTarget":  180,   // 回覆目標（原有）
  "marginCallThreshold": 135,  // 斷頭危機門溻（原有）
  "frozenZone": 145        // 高危凍結區間上界（新增 ★）
}
```

### 影響範圍

- `src/modules/strategy/strategyEngine.mjs` — `buildDecision()` 4 層分岐邏輯
- `src/modules/notifications/templates/telegramHtmlBuilder.mjs` — mmTag 層級文案
- `src/modules/strategy/signalRules.mjs` — `validateStrategyConfig()` 已补齊驗證

---

## 2. `buy.entryGate` — 新增區段

### 基本資訊

| 項目 | 內容 |
|------|------|
| **路徑** | `buy.entryGate` |
| **類型** | `object` |
| **修改前** | 欄位不存在 |
| **修改後** | 具備 `enabled: true` 與 4 層 tiers 陣列 |
| **生效 Commit** | `229c0be`（設計）/ `8ca76ee`（驗證）/ `strategyEngine Pre-Entry Gate commit`（邏輯接入） |

### 設計理由

`buy.rsi.oversold = 50` 並非標準超賣定義（RSI 50 為多空分水嶺），其動作為兩加分條件而非觸發門溻。同時，原 `minDropPercentToConsider: 0` 等同無左側過濾縱深，任何微小跌幅加上技術分數達標即可觸發評估。

`entryGate` 設計為「保留 RSI 加分機制」，另外在 `buildDecision()` 常態段前新增一層前置過濾，依跌幅層級與 RSI 決定允許操作範圍。

### 現行設定內容

```json
"entryGate": {
  "enabled": true,
  "tiers": [
    {
      "minDrop": 0,  "maxDrop": 5,
      "rsiThreshold": null,
      "allowLeverage": false,
      "note": "底倉 DCA only，禁止加碼"
    },
    {
      "minDrop": 5,  "maxDrop": 15,
      "rsiThreshold": 45,
      "allowLeverage": false,
      "note": "淺層修正，觀察確認後分批，禁 00675L"
    },
    {
      "minDrop": 15, "maxDrop": 30,
      "rsiThreshold": 35,
      "allowLeverage": true,
      "note": "深度回撤，逢跌分批，開放 00675L"
    },
    {
      "minDrop": 30, "maxDrop": 999,
      "rsiThreshold": 30,
      "allowLeverage": true,
      "note": "極端恐慌，一票通行，覆蓋情緒抑制"
    }
  ]
}
```

### Tier 運作規則

| Tier | 跌幅區間 | RSI 門溻 | 允許 00675L | 封鎖审查 |
|------|---------|---------|-----------|----------|
| 0 | 0–5% | 無 | ❌ | `allowLeverage: false` 直接封鎖 |
| 1 | 5–15% | RSI < 45 | ❌ | `allowLeverage: false` 直接封鎖 |
| 2 | 15–30% | RSI < 35 | ✅ | RSI 門溻未達標則封鎖 |
| 3 | 30%+ | RSI < 30 | ✅ | RSI 門溻未達標則封鎖 |

> **注意：** Tier 0 與 Tier 1 的 `allowLeverage: false` 不論 RSI 為何均不允許 00675L 加碼。封鎖時仅允許 0050 底倉 DCA 照常執行。

### 影響範圍

- `src/modules/strategy/strategyEngine.mjs` — `resolveEntryGate()` + `buildDecision()` 前置過濾邏輯
- `src/modules/strategy/signalRules.mjs` — `validateStrategyConfig()` 已補齊 `entryGate` 驗證
- `src/modules/notifications/templates/telegramHtmlBuilder.mjs` — 訊息中顯示 `entryGateLevel` 通道標示

---

## 3. `buy.minDropPercentToConsider` — 修改數值

### 基本資訊

| 項目 | 內容 |
|------|------|
| **路徑** | `buy.minDropPercentToConsider` |
| **類型** | `number`（跌幅 %） |
| **修改前** | `0` |
| **修改後** | `5` |
| **生效 Commit** | `229c0be` |

### 設計理由

原值 `0` 等同於無左側門溻，任何跌幅（包括日常微小波動）加上技術分數達標即可進入策略評估。這導致在震盪盤中系統對常態波動产生誎論性販買訊號。

調整為 `5` 後，跌幅未達 5% 的日子將被直接跳過評估，小於 `entryGate Tier 0`（0–5%）的跌幅則封鎖所有加碼操作，只允許底倉 DCA。

### 調整徍入水山

```
跌幅 0–5%：
  ✔ minDropPercentToConsider = 5 過濾（若 signalRules 层先評估， entryGate Tier 0 會封鎖加碼）

跌幅 5–15%：
  ✔ 過濾門溻達標 → entryGate Tier 1 審查（需 RSI < 45，禁 00675L）

跌幅 >= 15%：
  ✔ entryGate Tier 2/3 審查（需 RSI < 35/30，允許 00675L）
```

### 影響範圍

- `src/modules/strategy/signalRules.mjs` — `fetchStrategyConfig()` 讀取此門溻並在早期進行跌幅篩濾

---

## 4. 幽靈參數警示（待處理）

下列欄位目前**仍存在於 Strategy.json**，但已確認為幽靈參數或語意不明欄位，待審計後移除：

| 參數路徑 | 當前值 | 問題類型 | 建議行動 |
|---------|-------|---------|----------|
| `leverage.targetMultiplier` | `1.8` | 未被直接引用 | 移除，或在 `getTargetLeverageByScore()` 正式引入 |
| `reserve.allocationRatio` | `0.5` | 語意衝突／可能已廢棄 | 確認後移除，標注為 legacy |

> 相關審計結果請參閱 `docs/strategy-param-audit.md`。

---

## 版本變更摘要

| 日期 | 版本 | 變更項目 |
|------|------|----------|
| 2026-04-16 | v2.4 | 新增 `maintenance.frozenZone`、`buy.entryGate`，修改 `buy.minDropPercentToConsider: 0→5`，新增 `description` 字段 |
