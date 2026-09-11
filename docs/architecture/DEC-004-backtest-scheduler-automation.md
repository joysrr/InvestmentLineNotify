---
type: explanation
status: archived
completed_date: 2026-08-13
last_updated: 2026-09-10
tags:
  - backtest
  - scheduler
  - automation
wiki_links:
  - [[AI News]]
  - [[Strategy Engine]]
---

# DEC-004: Phase 4 架構決策 - 回測排程自動化

**日期**: 2026-08-12  
**狀態**: ✅ 已採納  
**類別**: 架構/基礎設施  
**相關**: Phase 4.1, ADR-002

## 背景

Phase 4.1 需要實作回測排程自動化，支援多配置併行、失敗重試、結果持久化。

## 決策

採用 **Cron (node-cron) + Bull 記憶體佇列** 架構：

- **排程器**: `node-cron` 定時觸發，讀取啟用的回測配置
- **佇列**: Bull 使用記憶體模式 (無 Redis 依賴，DEC-24)，支援併行控制 (concurrency=2)
- **重試**: 指數退避 (最多 3 次)，失敗記錄錯誤詳情
- **持久化**: 結果存入 `data/backtest/results/` 目錄，狀態持久化至 SQLite

## 替代方案評估

| 方案                  | 優點                            | 缺點                           | 決策    |
| --------------------- | ------------------------------- | ------------------------------ | ------- |
| A: Cron + Bull 記憶體 | 無外部依賴、輕量、支援併行/重試 | 進程重啟丟失佇列               | ✅ 採納 |
| B: Cron + 直接執行    | 簡單                            | 無併行控制、無重試、阻塞排程器 | ❌      |
| C: Bull + Redis       | 生產級持久化                    | 需 Redis 基礎設施，違反 DEC-24 | ❌      |

## 實作檔案

- `src/modules/backtest/backtestScheduler.ts` - 排程器主邏輯
- `src/modules/backtest/backtestQueue.mjs` - Bull 記憶體佇列 (雙模式: Redis/記憶體)
- `src/api/routes/backtestRoutes.mjs` - 手動觸發/查詢 API

## 影響

- 測試環境無需 Redis，`USE_REDIS=false` 自動降級記憶體模式
- 部署簡化：無額外服務依賴
