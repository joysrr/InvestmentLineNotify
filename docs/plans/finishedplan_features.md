# Finished-plan Features (待評估與實作功能池)

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
