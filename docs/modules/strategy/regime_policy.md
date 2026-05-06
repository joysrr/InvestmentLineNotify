# Regime-aware Policy Module

**Version**: 1.0.0  
**Status**: ✅ Implemented  
**Last Updated**: 2026-05-06  
**Implementation**: [`src/modules/strategy/regimePolicy.mjs`](../../../src/modules/strategy/regimePolicy.mjs)

---

## Overview

Regime-aware Policy 模組負責根據市場的宏觀環境（如 VIX 波動率、市場情緒）自動切換系統的操作模式。它是決策引擎中優先級最高的 [P0] 阻斷器。

### 核心功能

1. **環境判定**：將市場劃分為 NORMAL, CAUTIOUS, CRISIS 三種模式。
2. **槓桿倍率調整**：根據環境自動下修 maxLeverage 上限。
3. **操作限制**：在極端環境下強制 Sell-only。

---

## Regime States

| 模式         | 判定條件                      | 槓桿倍數 (Multiplier) | 描述                       |
| ------------ | ----------------------------- | --------------------- | -------------------------- | ----- | ------------------------------ |
| **NORMAL**   | VIX < 28 && Sentiment != BEAR | 1.0x                  | 正常模式，允許全槓桿操作   |
| **CAUTIOUS** | 28 ≤ VIX < 35                 |                       | Sentiment == BEAR          | 0.75x | 謹慎模式，maxLeverage 下修 25% |
| **CRISIS**   | VIX ≥ 35                      | 0x (Sell-only)        | 危機模式，強制禁止新增部位 |

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
