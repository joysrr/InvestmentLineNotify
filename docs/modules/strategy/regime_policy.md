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

## Related Documentation

- [Strategy Engine](./strategy_engine.md)
- [Lifecycle Engine](./lifecycle_engine.md)
- [Portfolio Health API](../presentation/api/portfolio_health_api.md)
