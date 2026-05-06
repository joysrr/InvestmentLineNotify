# Portfolio Health API Specification

**Version**: 1.0.0 (Phase 1)
**Status**: ✅ Implemented
**Last Updated**: 2026-05-06
**Related Proposal**: ILN_PROPOSAL_20260506_001
**Implementation**: [`src/api/routes/portfolioHealth.mjs`](../../../src/api/routes/portfolioHealth.mjs)

---

## Overview

Portfolio Health API 提供完整的投資組合健康度評估，整合 6 個核心組件：

| 組件 | 描述 | 對應模組 |
|------|------|---------|
| **Margin** | 維持保證金健康度 | `marginPolicy.mjs` |
| **Survival** | 生存空間充足度 | `marginPolicy.mjs` |
| **Decoupling** | 資產解耦風險 | `marginPolicy.mjs` |
| **Leverage** | 槓桿使用狀況 | `leverageMonitor.mjs` |
| **Lifecycle** | 生命週期槓桿匹配 | `lifecycleEngine.mjs` |
| **Regime** | 市場環境適應性 | `portfolioHealth.mjs` |

---

## Endpoints

### GET /api/portfolio/health

計算並回傳 Portfolio 健康度報告。

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `maintenanceMargin` | number | No | 0 | 當前維持保證金比例 (%) |
| `z2Ratio` | number | No | 0 | Z2 資產解耦比例 (%) |
| `survivalDropPercent` | number | No | 0 | 生存空間下跌幅度 (%) |
| `currentGrossLeverage` | number | No | 0 | 當前總槓桿倍數 |
| `vix` | number | No | 0 | VIX 波動指數 |
| `macroSentiment` | string | No | "NEUTRAL" | 市場情緒 (BULL / BEAR / NEUTRAL) |
| `currentAge` | number | No | null | 當前年齡 (用於生命週期計算) |

#### Response: 200 OK

```json
{
  "status": "GREEN",
  "score": 88,
  "components": {
    "margin": {
      "status": "GREEN",
      "score": 100,
      "details": {
        "level": "safe",
        "message": "維持率健康",
        "margin": 165,
        "threshold": 160
      }
    },
    "survival": {
      "status": "GREEN",
      "score": 100,
      "details": {
        "level": "safe",
        "message": "生存空間充足",
        "dropPercent": 35,
        "limit": 140
      }
    },
    "decoupling": {
      "status": "GREEN",
      "score": 100,
      "details": {
        "level": "safe",
        "message": "資產解耦風險低",
        "z2Ratio": 20,
        "target": 45
      }
    },
    "leverage": {
      "status": "YELLOW",
      "score": 60,
      "details": {
        "level": "warning",
        "message": "接近槓桿上限",
        "current": 1.8,
        "max": 2.0
      }
    },
    "lifecycle": {
      "status": "GREEN",
      "score": 100,
      "details": {
        "stage": "MID",
        "yearsToRetirement": 12,
        "mode": "balanced",
        "message": "生命週期槓桿匹配"
      }
    },
    "regime": {
      "status": "GREEN",
      "score": 100,
      "details": {
        "vix": 18,
        "message": "市場環境穩定"
      }
    }
  },
  "recommendations": [
    "維持當前槓桿水準",
    "持續監控生存空間"
  ],
  "lightStatus": {
    "emoji": "🟢",
    "label": "健康",
    "colorClass": "green"
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | 整體健康狀態 (GREEN / YELLOW / RED) |
| `score` | number | 健康分數 (0-100) |
| `components` | object | 6 個組件的詳細狀態 |
| `recommendations` | array | 建議行動清單 |
| `lightStatus` | object | 簡化燈號資訊 |

---

## Health Score Calculation

### 分數計算邏輯

```
總分 = Σ(componentScore × weight) / Σ(weight)

權重分配：
- Margin: 25%
- Survival: 25%
- Decoupling: 15%
- Leverage: 15%
- Lifecycle: 10%
- Regime: 10%
```

### 燈號判定

| 分數範圍 | 燈號 | 描述 |
|---------|------|------|
| 80-100 | 🟢 GREEN | 健康，可正常操作 |
| 60-79 | 🟡 YELLOW | 注意，需提高警覺 |
| 0-59 | 🔴 RED | 危險，需立即處理 |

---

## Lifecycle Stage Mapping

| 階段 | 距離退休 | 槓桿上限 | 模式 |
|------|---------|---------|------|
| EARLY | > 15 年 | 2.0x | aggressive |
| MID | 10-15 年 | 2.0x | balanced |
| LATE | 5-10 年 | 1.5x | conservative |
| PRE_RETIRE | ≤ 5 年 | 1.0x | defensive |

---

## Error Responses

### 400 Bad Request

```json
{
  "error": "Invalid maintenanceMargin parameter"
}
```

### 500 Internal Server Error

```json
{
  "error": "Internal server error"
}
```

---

## Examples

### 基本查詢

```bash
curl "http://localhost:3000/api/portfolio/health?maintenanceMargin=165&currentGrossLeverage=1.8&currentAge=50"
```

### 完整參數

```bash
curl "http://localhost:3000/api/portfolio/health?maintenanceMargin=165&z2Ratio=20&survivalDropPercent=35&currentGrossLeverage=1.8&vix=18&macroSentiment=BULL&currentAge=50"
```

---

## Related Documentation

- [Strategy Engine](../../modules/strategy/strategy_engine.md)
- [Lifecycle Engine](../../modules/strategy/lifecycle_engine.md)
- [API 總覽](../../swagger.json)
