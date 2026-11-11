---
type: explanation
status: archived
completed_date: 2026-08-13
last_updated: 2026-09-10
tags:
  - monitoring
  - alerting
  - langfuse
wiki_links:
  - [[Langfuse]]
  - [[AI Pipeline]]
---

# DEC-005: Phase 4 架構決策 - 監控與告警系統

**日期**: 2026-08-12  
**狀態**: 📦 已封存 (Archived / 後續生產環境改由 Oracle VM 伺服器 PM2 守護與 Telegram Bot 通報承接)  
**類別**: 架構/基礎設施  
**相關**: Phase 4.2

## 背景

Phase 4.2 需要實作生產級監控：錯誤追蹤、效能指標 (p50/p95/p99)、告警引擎、儀表板 API。

## 決策

採用 **SQLite 本地儲存 + 記憶體聚合 + WebSocket 即時推送** 架構：

- **錯誤追蹤**: SQLite 資料表 `error_events`，支援依 traceId/時間範圍/嚴重度查詢
- **效能指標**: 記憶體環形緩衝區收集請求延遲，定期計算 p50/p95/p99
- **告警引擎**: 閾值規則 (錯誤率、延遲、佇列積壓)，支援多通道 (Console、Webhook、Telegram)
- **儀表板 API**: `/api/monitoring/*` 提供健康檢查、指標摘要、告警歷史、錯誤詳情

## 替代方案評估

| 方案                      | 優點                   | 缺點                    | 決策    |
| ------------------------- | ---------------------- | ----------------------- | ------- |
| A: SQLite + 記憶體 + WS   | 無外部依賴、輕量、即時 | 長期儲存受限於磁碟      | ✅ 採納 |
| B: Prometheus + Grafana   | 生產級標準             | 需額外服務，違反 DEC-24 | ❌      |
| C: Elasticsearch + Kibana | 全文搜尋強大           | 重型、資源消耗大        | ❌      |

## 實作檔案

- `src/modules/monitoring/errorTracker.mjs` - SQLite 錯誤追蹤
- `src/modules/monitoring/metricsCollector.mjs` - 效能指標收集 (p50/p95/p99)
- `src/modules/monitoring/alertEngine.mjs` - 告警規則評估與通知
- `src/api/routes/monitoringRoutes.mjs` - 監控 API 端點

## 影響

- 單機部署零依賴
- WebSocket 即時推送適合 Mini App 儀表板
- SQLite 可備份/遷移

## 目前實作狀態 (2026-11-10 文件一致性審查)

本 DEC 為 Phase 4.2 已封存決策，生產環境監控已改由 Oracle VM PM2 守護與 Telegram Bot 通報承接。對照程式碼 SSOT：

- `src/modules/monitoring/metricsCollector.mjs` — 存在 ✅
- `src/modules/monitoring/alertEngine.mjs` — 存在 ✅
- `src/modules/monitoring/errorTracker.mjs` — 不存在（已被 `errorStore.mjs` 取代）
- `src/api/routes/monitoringRoutes.mjs` — 不存在（監控 API 未以本 DEC 規格實作）
