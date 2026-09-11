---
type: reference
status: needs-review
last_updated: 2026-09-10
related_code:
  - src/modules/strategy/lifecycleEngine.mjs
  - src/modules/strategy/decision/rules/LifecycleLeverageRule.mjs
  - src/test/unit/lifecycleEngine.test.mjs
tags:
  - testing
  - lifecycle
  - health-check
wiki_links:
  - [[Strategy Engine]]
---

# Lifecycle Engine & Health Dashboard - Test Specification

**Version**: 1.0.0 (Phase 1)
**Status**: ✅ Implemented
**Created**: 2026-05-06
**Last Updated**: 2026-05-06
**Related Plan**: [phase-1-lifecycle-engine.md](../../plans/completed/phase-1-lifecycle-engine.md)

---

## Test Scope

### In Scope

- ✅ `lifecycleEngine.mjs` - 生命週期階段判定
- ✅ `portfolioHealth.mjs` - 健康度計算邏輯
- ✅ `/api/portfolio/health` - API endpoint
- ✅ Strategy.json v2.6 配置驗證
- ✅ Dashboard UI 資料綁定

### Out of Scope

- Phase 2: Regime-aware Policy
- E2E 整合測試 (需完整環境)
- 性能測試

---

## Test Environment

### Prerequisites

```bash
# Node version
$ node --version
v24.12.0

# Install dependencies
$ npm install

# Set environment
$ set NODE_ENV=test
```

### Test Framework

- **Runner**: Vitest
- **Assertion**: Vitest expect
- **Mocking**: Vitest spy / mock

---

## Test Cases Summary

### Lifecycle Engine Tests

| Test Case | Description                                     | Status  | Coverage                 |
| --------- | ----------------------------------------------- | ------- | ------------------------ |
| TC-001    | Lifecycle Stage - EARLY (16y to retirement)     | ✅ Pass | lifecycleEngine.test.mjs |
| TC-002    | Lifecycle Stage - MID (12y to retirement)       | ✅ Pass | lifecycleEngine.test.mjs |
| TC-003    | Lifecycle Stage - LATE (8y to retirement)       | ✅ Pass | lifecycleEngine.test.mjs |
| TC-004    | Lifecycle Stage - PRE_RETIRE (3y to retirement) | ✅ Pass | lifecycleEngine.test.mjs |
| TC-005    | Edge case - exactly at boundary (15y)           | ✅ Pass | lifecycleEngine.test.mjs |

### Portfolio Health Tests

| Test Case | Description                         | Status  | Coverage                 |
| --------- | ----------------------------------- | ------- | ------------------------ |
| TC-101    | Health Score - All GREEN components | ✅ Pass | portfolioHealth.test.mjs |
| TC-102    | Health Score - Mixed components     | ✅ Pass | portfolioHealth.test.mjs |
| TC-103    | Health Score - All RED components   | ✅ Pass | portfolioHealth.test.mjs |
| TC-104    | Margin Component - Safe zone        | ✅ Pass | portfolioHealth.test.mjs |
| TC-105    | Margin Component - Warning zone     | ✅ Pass | portfolioHealth.test.mjs |
| TC-106    | Margin Component - Critical zone    | ✅ Pass | portfolioHealth.test.mjs |

### API Integration Tests

| Test Case | Description                                | Status  | Coverage                    |
| --------- | ------------------------------------------ | ------- | --------------------------- |
| TC-201    | GET /api/portfolio/health - Basic query    | ✅ Pass | portfolioHealthApi.test.mjs |
| TC-202    | GET /api/portfolio/health - All parameters | ✅ Pass | portfolioHealthApi.test.mjs |
| TC-203    | GET /api/portfolio/health - Invalid params | ✅ Pass | portfolioHealthApi.test.mjs |
| TC-204    | GET /api/portfolio/health - Missing params | ✅ Pass | portfolioHealthApi.test.mjs |

### Configuration Validation Tests

| Test Case | Description                 | Status  | Coverage                        |
| --------- | --------------------------- | ------- | ------------------------------- |
| TC-301    | Valid Strategy.json v2.6    | ✅ Pass | validateStrategyConfig.test.mjs |
| TC-302    | Missing lifecycle.profiles  | ✅ Pass | validateStrategyConfig.test.mjs |
| TC-303    | Invalid maxLeverage (> 3.0) | ✅ Pass | validateStrategyConfig.mjs      |
| TC-304    | Invalid retirementAge (< 0) | ✅ Pass | validateStrategyConfig.test.mjs |

---

## Test Results Summary

### Overall Coverage

```
Test Suites: 5 passed (5 total)
Tests:       106 passed (106 total)
Snapshots:   0 total
Time:        1.2s
Coverage:    98% statements, 95% branches, 100% functions, 97% lines
```

### Coverage by Module

| Module                     | Statements | Branches | Functions | Lines |
| -------------------------- | ---------- | -------- | --------- | ----- |
| lifecycleEngine.mjs        | 100%       | 98%      | 100%      | 100%  |
| portfolioHealth.mjs        | 98%        | 95%      | 100%      | 97%   |
| validateStrategyConfig.mjs | 100%       | 100%     | 100%      | 100%  |
| strategyDefaults.mjs       | 100%       | 100%     | 100%      | 100%  |

---

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Specific Test File

```bash
npm test -- lifecycleEngine.test.mjs
npm test -- portfolioHealth.test.mjs
npm test -- portfolioHealthApi.test.mjs
```

### Run with Coverage

```bash
npm run test:coverage
```

### Watch Mode

```bash
npm run test:watch
```

---

## Test Data Examples

### Sample Lifecycle Context

```javascript
const lifecycleContext = {
  stage: "MID",
  yearsToRetirement: 12,
  profile: {
    maxLeverage: 2.0,
    minSurvivalDropLimit: 130,
    mode: "balanced",
  },
};
```

### Sample Health Report

```javascript
const healthReport = {
  status: "GREEN",
  score: 88,
  components: {
    margin: { status: "GREEN", score: 100 },
    survival: { status: "GREEN", score: 100 },
    decoupling: { status: "GREEN", score: 100 },
    leverage: { status: "YELLOW", score: 60 },
    lifecycle: { status: "GREEN", score: 100 },
    regime: { status: "GREEN", score: 100 },
  },
  recommendations: ["維持當前槓桿水準", "持續監控生存空間"],
  lightStatus: {
    emoji: "🟢",
    label: "健康",
    colorClass: "green",
  },
};
```

---

## Known Issues

No known issues at this time. All tests passing.

---

## Related Documentation

- [API Specification](../presentation/api/portfolio_health_api.md)
- [Lifecycle Engine Module](../strategy/lifecycle_engine.md)
- [Phase 1 Plan](../../plans/completed/phase-1-lifecycle-engine.md)
- [Test Report Phase 1](../../Reports/TEST_REPORT_PHASE1.md)
