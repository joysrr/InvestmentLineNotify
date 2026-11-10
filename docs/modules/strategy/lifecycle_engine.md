---
type: reference
status: current
last_updated: 2026-11-11
related_code:
  - src/modules/strategy/lifecycleEngine.mjs
  - src/modules/strategy/decision/rules/LifecycleLeverageRule.mjs
tags:
  - lifecycle
  - strategy
  - state-machine
wiki_links:
  - [[Strategy Engine]]
---

# Lifecycle Engine Module

**Version**: 1.0.0 (Phase 1)  
**Status**: ✅ Implemented  
**Last Updated**: 2026-05-06  
**Implementation**: [`src/modules/strategy/lifecycleEngine.mjs`](../../../src/modules/strategy/lifecycleEngine.mjs)

---

## Overview

Lifecycle Engine 根據投資者的年齡與退休年齡，自動判定生命週期階段，並提供對應的槓桿限制與風險管理參數。

### 核心功能

1. **階段判定**：根據距離退休年數，自動判定 4 個生命週期階段
2. **槓桿限制**：每個階段有對應的 maxLeverage 限制
3. **風險參數**：每個階段有對應的 minSurvivalDropLimit
4. **模式切換**：aggressive / balanced / conservative / defensive

---

## Lifecycle Stages

| 階段       | Years to Retirement | maxLeverage | maxLeverageForNewZ2 | minSurvivalDropLimit | Mode         |
| ---------- | ------------------- | ----------- | ------------------- | -------------------- | ------------ |
| EARLY      | > 15                | 2.0         | 1.5                 | 140%                 | aggressive   |
| MID        | 10-15 (含 15 年)    | 2.0         | 1.5                 | 145%                 | balanced     |
| LATE       | 5-10 (含 10 年)     | 1.5         | 1.0                 | 150%                 | conservative |
| PRE_RETIRE | ≤ 5 (含 5 年)       | 1.0         | 0.5                 | 160%                 | defensive    |

### 邊界值判定規則

```javascript
if (yearsToRetirement > 15) return "EARLY";
if (yearsToRetirement >= 10) return "MID";
if (yearsToRetirement >= 5) return "LATE";
return "PRE_RETIRE";
```

---

## API

### computeLifecycleContext

計算生命週期上下文。

```javascript
/**
 * @param {number} currentAge - 當前年齡
 * @param {number} retirementAge - 退休年齡（預設 65）
 * @param {Object} profiles - 生命週期配置（來自 Strategy.json）
 * @returns {Object} Lifecycle context
 */
function computeLifecycleContext(currentAge, retirementAge = 65, profiles)
```

**Return Value**:

```javascript
{
  stage: "MID",
  yearsToRetirement: 12,
  profile: {
    maxLeverage: 2.0,
    maxLeverageForNewZ2: 1.5,
    minSurvivalDropLimit: 145,
    mode: "balanced"
  }
}
```

---

## Configuration

### Strategy.json v2.6+

```json
{
  "lifecycle": {
    "retirementAge": 65,
    "profiles": {
      "EARLY": {
        "maxLeverage": 2.0,
        "maxLeverageForNewZ2": 1.5,
        "minSurvivalDropLimit": 140,
        "mode": "aggressive"
      },
      "MID": {
        "maxLeverage": 2.0,
        "maxLeverageForNewZ2": 1.5,
        "minSurvivalDropLimit": 145,
        "mode": "balanced"
      },
      "LATE": {
        "maxLeverage": 1.5,
        "maxLeverageForNewZ2": 1.0,
        "minSurvivalDropLimit": 150,
        "mode": "conservative"
      },
      "PRE_RETIRE": {
        "maxLeverage": 1.0,
        "maxLeverageForNewZ2": 0.5,
        "minSurvivalDropLimit": 160,
        "mode": "defensive"
      }
    }
  }
}
```

---

## Integration

### 與 Strategy Engine 整合

在 `strategyEngine.mjs` 的 `buildDecision()` 函式中：

```javascript
const lifecycleContext = computeLifecycleContext(
  currentAge,
  config.lifecycle.retirementAge,
  config.lifecycle.profiles,
);

// 檢查槓桿是否符合生命週期限制
if (currentGrossLeverage > lifecycleContext.profile.maxLeverage) {
  healthComponents.lifecycle = {
    status: "RED",
    score: 0,
    details: {
      message: "超過生命週期槓桿限制",
      current: currentGrossLeverage,
      limit: lifecycleContext.profile.maxLeverage,
    },
  };
}
```

---

## Testing

詳細測試規範請參考：[lifecycle_health_test_spec.md](./lifecycle_health_test_spec.md)

### 測試覆蓋率

- ✅ Unit Tests: 100%
- ✅ Edge Cases: 邊界值測試完整
- ✅ Integration Tests: API 整合測試通過

---

## Related Documentation

- [Portfolio Health API](../presentation/api/portfolio_health_api.md)
- [Test Specification](./lifecycle_health_test_spec.md)
- [Phase 1 Plan](../../plans/completed/phase-1-lifecycle-engine.md)
- [Strategy Engine](./strategy_engine.md)
