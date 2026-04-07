# Agent Task Cache — Phase 2-A 實作進度

**Task**: Phase 2-A — Fastify API Server (`src/api/server.mjs`)  
**Status**: IN_PROGRESS  
**Updated**: 2026-04-07

---

## 已確認的 data schema

### `data/reports/YYYY-MM-DD.json` 結構
```json
{
  "date": "YYYY-MM-DD",
  "signals": {
    "currentPrice", "basePrice", "totalLoan", "actualLeverage",
    "historicalLevel", "netAsset", "bias240",
    "priceChangePercent", "priceChangePercentText",
    "priceUpPercent", "priceDropPercent",
    "RSI", "KD_K", "KD_D",
    "overheat": { isOverheat, factorCount, highCount, coolCount, factors },
    "reversal": { totalFactor, triggeredCount, rsiDrop, kdDrop, ... },
    "weightScore", "weightDetails": { dropInfo, dropScore, rsiInfo, ... },
    "sellSignals": { flags, signalCount, total, stateFlags },
    "macdSignal", "maintenanceMargin", "z2Ratio",
    "strategy": { 完整策略參數... },
    "macroSentiment": { direction, bonus, penalty },
    "effectiveCooldownDays", "marketStatus", "target",
    "targetSuggestionShort", "targetSuggestion", "suggestion",
    "entry": { weightScore, weightDetails, entrySignals },
    "cooldownStatus": { inCooldown, daysLeft, lastBuyDate, ... }
  },
  "ai": {
    "coach_internal_thinking",
    "risk_warnings": [...],
    "action_items": [...],
    "mindset_advice": [...]
  }
}
```

---

## 待建立檔案清單

- [ ] `src/api/server.mjs` — Fastify 主程式
- [ ] `src/api/middleware/initDataGuard.mjs` — Telegram initData HMAC-SHA256 驗證
- [ ] `src/api/routes/status.mjs` — GET /api/status
- [ ] `src/api/routes/reports.mjs` — GET /api/reports, GET /api/report/:date
- [ ] `src/api/routes/news.mjs` — GET /api/news
- [ ] `package.json` — 新增 fastify、@fastify/cors deps 與 `api` script

---

## 路由規格速查

| 路由 | 資料來源 | 說明 |
|---|---|---|
| GET /api/status | data/market/latest.json | 完整回傳，不存在回 404 |
| GET /api/reports?limit=N | data/reports/*.json | DESC 排序，預設 limit=30，完整回傳 |
| GET /api/report/:date | data/reports/YYYY-MM-DD.json | 不存在回 404 |
| GET /api/news | data/news/pool_filtered_active.json | 不存在回 [] |

## Middleware
- initDataGuard: NODE_ENV=dev 或 BYPASS_INIT_DATA=true 時 bypass
- CORS: 允許 localhost:5173，可透過 CORS_ORIGIN env 覆蓋
- Port: 3000，可透過 PORT env 覆蓋
