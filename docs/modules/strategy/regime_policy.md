---
type: reference
status: current
last_updated: 2026-09-12
last_verified: 2026-09-12
related_code:
  - src/modules/strategy/regimePolicy.mjs
  - src/modules/strategy/macroRegimeClassifier.mjs
  - src/modules/strategy/decision/rules/RegimePolicyRule.mjs
tags:
  - regime
  - policy
  - market-state
  - macro-regime-2
wiki_links:
  - "[[Strategy Engine]]"
  - "[[Macro Regime Advanced Spec]]"
---

# Regime-aware Policy Module (Macro Regime 2.0)

**Version**: 2.0.0  
**Status**: ✅ Implemented & Verified  
**Last Updated**: 2026-09-12  
**Implementation**:

- [`src/modules/strategy/regimePolicy.mjs`](../../../src/modules/strategy/regimePolicy.mjs) (P0 硬阻斷)
- [`src/modules/strategy/macroRegimeClassifier.mjs`](../../../src/modules/strategy/macroRegimeClassifier.mjs) (四象限狀態機)
- [`src/modules/strategy/decision/rules/RegimePolicyRule.mjs`](../../../src/modules/strategy/decision/rules/RegimePolicyRule.mjs) (決策鏈規則)

---

## Overview

Regime-aware Policy 模組負責根據市場的宏觀環境（如 VIX 波動率、大盤趨勢、籌碼熱度）自動切換系統的操作模式。它是決策引擎中優先級最高的 [P0] 阻斷器，並升級為四象限動態調整系統。

### 核心功能

1. **四象限環境判定**：將市場劃分為 `BULL_TREND`, `BULL_VOLATILE`, `BEAR_PANIC`, `BEAR_CHOPPY`。
2. **動態權重與阻尼**：依象限重構因子權重（如牛市動能佔 70%），並引入散戶融資過熱阻尼器（額度減半）。
3. **實質持有成本濾網**：在低波陰跌環境（`BEAR_CHOPPY`）凍結戰術加碼，僅執行 0050 基礎 DCA。
4. **遲滯防震盪機制 (Hysteresis Filter)**：降級確認 2 天，恢復緩衝 5 天，恐慌 0 延遲。

---

## Macro Regime States (四象限定義)

| 模式              | 判定條件                        | 槓桿倍數 | 模式 (Mode)       | 權重主導 / 風控作為            |
| :---------------- | :------------------------------ | :------- | :---------------- | :----------------------------- |
| **BULL_TREND**    | 指數 > MA60, 斜率向上, VIX < 20 | 1.0x     | `trend_offensive` | 動能 70% 主導，順勢進攻        |
| **BULL_VOLATILE** | 指數 > MA60, 20 ≤ VIX < 35      | 0.8x     | `dip_buying`      | 左側超跌 60%，融資過熱阻尼     |
| **BEAR_CHOPPY**   | 指數 ≤ MA60, VIX < 20           | 0.5x     | `dca_only`        | 實質持有成本濾網，戰術加碼凍結 |
| **BEAR_PANIC**    | VIX ≥ 35 或流動性危機           | 0.0x     | `sell_only`       | 強制 Sell-only，保全擔保品安全 |

---

## API

### determineRegime

根據當前 VIX 與情緒判定模式。

```javascript
/**
 * @param {number} vix - 當前 VIX 指數
 * @param {string} sentiment - 市場情緒 (BULL / BEAR / NEUTRAL)
 * @param {Object} config - Regime 配置 (來自 Strategy.json)
 * @returns {Object} Regime result
 */
function determineRegime(vix, sentiment, config)
```

**Return Value**:

```javascript
{
  state: "CAUTIOUS",
  leverageMultiplier: 0.75,
  mode: "reduced",
  description: "謹慎模式..."
}
```

---

## Configuration

### Strategy.json

```json
"regime": {
  "vixOverrideTrigger": 28,
  "vixAbsoluteOverride": 35,
  "cautiousLeverageReductionPct": 25,
  "regimeProfiles": {
    "NORMAL": { ... },
    "CAUTIOUS": { ... },
    "CRISIS": { ... }
  }
}
```

---

## Integration

### 與 Strategy Engine 整合

在 `strategyEngine.mjs` 中作為 [P0] 檢查：

```javascript
const regimeResult = determineRegime(vix, sentiment, strategy.regime);

if (regimeResult.state === "CRISIS") {
  return {
    target: "🔴 強制賣出",
    targetSuggestion: "VIX 危機模式啟動，禁止新增部位...",
  };
}
```

---

## 債務感知雙模式（2026-11-04 升級）

**升級日期**：2026-11-04  
**相關計畫**：`docs/plans/active/2026-11-04_regime-aware-opportunity-engine.md` (v2.4)

### 核心變更

Regime Policy 現在支援**債務感知（Debt-Aware）雙模式**，根據 `portfolio.totalDebt` 自動切換行為：

#### OPPORTUNITY_MODE（機會模式）

- **觸發條件**：`totalDebt === 0`（無借款帳戶）
- **CRISIS 狀態行為**：輸出 `mode: "crisis_accumulate"`（恐慌加碼視窗），不再強制 sell_only
- **設計理念**：無負債帳戶在系統性大跌時具備安全邊際，可啟動分批加碼 00675L 以利用恐慌性錯殺
- **協作模組**：`cashExposureAdvisor` 計算具體批次金額與目標槓桿

#### DEFENSE_MODE（防禦模式）

- **觸發條件**：`totalDebt > 0`（有融資或借貸負債）
- **CRISIS 狀態行為**：保留既有 `mode: "sell_only"`，優先保護帳戶維持率
- **設計理念**：借款帳戶在暴跌時面臨斷頭風險，必須優先確保生存，暫停所有加碼

### RegimePolicyRule 整合

Decision Chain 中的 `RegimePolicyRule` 已更新為**非阻斷式（Non-blocking）**：

- **OPPORTUNITY 模式**：`crisis_accumulate` 不觸發 early return，讓後續規則（如 Cash Exposure Advisor）接手計算
- **DEFENSE 模式**：`sell_only` 維持阻斷行為，立即回傳 P0 only + 00675L 禁止
- **Type guard**：`Number(totalDebt)` 強制轉型，防範字串型態導致誤判

### formatRegimeStatus 更新

Telegram 卡片輸出針對 `crisis_accumulate` 模式調整顯示：

```javascript
// CRISIS 狀態的 emoji 根據 mode 動態切換
stateEmoji.CRISIS = mode === "crisis_accumulate" ? "⚡" : "🔴";

// mode 標籤
modeLabel.crisis_accumulate = "恐慌加碼模式";
modeLabel.sell_only = "防禦模式";
```

### P0 DCA 最高豁免

**重要**：無論 OPPORTUNITY 或 DEFENSE 模式，**P0 定期定額（每月 3 萬）始終不受任何 Regime 狀態影響**，無條件正常執行。此豁免權寫死於 `strategyEngine.mjs` 決策鏈最前端。

---

## Related Documentation

- [Strategy Engine](./strategy_engine.md)
- [Lifecycle Engine](./lifecycle_engine.md)
- [Cash Exposure Advisor](./cash_exposure_advisor.md)
- [Portfolio Health API](../presentation/api/portfolio_health_api.md)
