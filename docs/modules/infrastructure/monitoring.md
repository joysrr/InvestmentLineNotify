---
type: reference
title: "監控與告警模組 (`src/modules/monitoring/`)"
category: "infrastructure"
status: current
created: "2026-11-11"
last_updated: "2026-11-11"
last_verified: "2026-11-11"
related_code:
  - src/modules/monitoring/alertEngine.mjs
  - src/modules/monitoring/metricsCollector.mjs
  - src/modules/monitoring/errorStore.mjs
related_docs:
  - docs/decisions/DEC-005-monitoring-alerting.md
tags:
  - monitoring
  - alerting
  - metrics
  - infrastructure
wiki_links:
  - [[Monitoring]]
  - [[AI Pipeline]]
---

# 監控與告警模組 (`src/modules/monitoring/`)

提供 HTTP 效能指標收集、應用層錯誤儲存、以及規則驅動的告警引擎。
本模組為輕量本地實作（無外部服務依賴）；生產環境監控以 Oracle VM PM2 守護與 Telegram Bot 通報為主。

> **架構決策參考**：見 `docs/decisions/DEC-005-monitoring-alerting.md`（已封存，說明選型背景）

---

## 📋 目錄

1. [模組清單](#模組清單)
2. [AlertEngine — 告警引擎](#alertengine--告警引擎)
3. [MetricsCollector — 效能指標收集器](#metricscollector--效能指標收集器)
4. [ErrorStore — 應用層錯誤儲存](#errorstore--應用層錯誤儲存)

---

## 模組清單

| 檔案                   | 職責                                                               |
| ---------------------- | ------------------------------------------------------------------ |
| `alertEngine.mjs`      | 規則驅動的告警評估、冷卻期機制、多通道通知（EventEmitter）         |
| `metricsCollector.mjs` | HTTP 請求計數、佇列深度、p50/p95/p99 延遲計算（記憶體環形緩衝區）  |
| `errorStore.mjs`       | 應用層錯誤收集與持久化（取代 DEC-005 規格中的 `errorTracker.mjs`） |

---

## AlertEngine — 告警引擎

`alertEngine.mjs` 是 `EventEmitter` 子類別，採規則清單 + 冷卻期設計。

### 規則結構

```js
{
  name: "high-error-rate",          // 規則唯一識別名
  condition: (metrics) => boolean,  // 評估函式：接收 metricsCollector.getMetrics()
  severity: "low" | "medium" | "high",
  message: "錯誤率超過門檻",
  cooldownMs: 300000,               // 冷卻期（預設 5 分鐘），防止重複告警
  enabled: true                     // 可動態啟用/停用
}
```

### 告警流程

```
alertEngine.check()
  │
  ├─ 取得 metrics（metricsCollector.getMetrics()）
  │
  ├─ for each rule（enabled & 冷卻期已過）
  │   ├─ rule.condition(metrics) === true
  │   │   ├─ 更新 cooldowns（Map<ruleName, timestamp>）
  │   │   ├─ 推入 alertHistory
  │   │   ├─ 呼叫 notifier(alert)（若已設定）
  │   │   └─ emit("alert", alert)
  │   └─ 評估例外 → logger.error（不中斷其餘規則）
  │
  └─ 回傳 triggeredAlerts[]
```

### 主要方法

| 方法                    | 說明                                                      |
| ----------------------- | --------------------------------------------------------- |
| `setNotifier(fn)`       | 注入告警發送器（如 Telegram 推送函式）                    |
| `addRule(rule)`         | 新增告警規則                                              |
| `removeRule(name)`      | 移除規則                                                  |
| `check(metrics?)`       | 評估所有規則，傳入 metrics 或由 metricsCollector 自動取得 |
| `getHistory(limit=100)` | 取得最近 N 筆告警記錄（倒序）                             |
| `clearHistory()`        | 清除告警歷史                                              |

### 冷卻期機制

- 每個規則獨立冷卻計時器（`Map<ruleName, lastAlertTimestamp>`）
- 預設冷卻 5 分鐘，防止同一規則頻繁通知
- 冷卻期間命中不計入 `alertHistory`

---

## MetricsCollector — 效能指標收集器

`metricsCollector.mjs` 是全域單例（`EventEmitter` 子類別），收集 HTTP 請求延遲與佇列深度。

### 收集維度

| 維度                       | 說明                                                |
| -------------------------- | --------------------------------------------------- |
| `httpRequests.total`       | 總請求次數                                          |
| `httpRequests.errors`      | ≥ 400 狀態碼的請求數                                |
| `httpRequests.durations[]` | 延遲樣本（上限 10,000；超出截取後 5,000）           |
| `queueDepth`               | 當前 / 最大 / 最小 / 平均佇列深度                   |
| `systemResources`          | 記憶體 / CPU 使用率（需主動更新）                   |
| `customMetrics`            | Map：自定義指標（`recordCustomMetric(key, value)`） |
| `workerHeartbeats`         | Map：Worker 心跳（`recordWorkerHeartbeat(id)`）     |

### p50/p95/p99 計算

由 `getMetrics()` 即時計算（排序後取百分位索引），適合低頻查詢（如 `/api/monitoring/metrics`）。

---

## ErrorStore — 應用層錯誤儲存

`errorStore.mjs` 取代 DEC-005 中的 `errorTracker.mjs`，提供記憶體（非 SQLite）的錯誤收集。

> 注意：生產環境正式錯誤追蹤以 Oracle VM PM2 守護的 stderr / `pm2 logs` 為主。

---

## 與生產監控的分界

| 層級             | 工具                               | 說明                        |
| ---------------- | ---------------------------------- | --------------------------- |
| 應用層（本模組） | `alertEngine` / `metricsCollector` | HTTP 指標、規則告警，限單機 |
| 生產守護         | Oracle VM PM2                      | 進程崩潰重啟、記憶體守護    |
| 生產通報         | Telegram Bot                       | 策略異常、每日收盤通報      |
