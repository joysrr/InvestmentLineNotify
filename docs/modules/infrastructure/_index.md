---
type: reference
status: current
last_updated: 2026-09-11
last_verified: 2026-09-11
related_code:
  - src/modules/data/archiveManager.mjs
  - src/modules/data/newsPoolManager.mjs
  - src/modules/storage.mjs
tags:
  - infrastructure
  - data
  - storage
wiki_links:
  - "[[AI News]]"
  - "[[News Fetcher]]"
---

# 底層基礎設施 (Infrastructure)

本目錄包含系統最底層的資料持久化 (Persistence) 與共用工具，負責隔離外部依賴失敗風險，並提供穩定、可恢復的資料存取層。

## 模組列表

- [`storage.md`](./storage.md)：Google Sheets 同步層（帳戶狀態與每日戰報寫入）。
- [`data_manager.md`](./data_manager.md)：本機檔案快取與歷檔管理（Market Data、AI Logs、檔案結構）。
- [`news_pool.md`](./news_pool.md)：新聞池管理（標題指紋去重、活躍池視窗、滾動生命週期封存）。

## 核心設計理念

1. **防禦性存取**：所有對 Google Sheets 與外部 Provider 的呼叫，必須具備 Retry 機制。
2. **本地 Fallback**：雲端儲存（如 Sheet）失敗時，應嘗試切換至本地的 `data/` 快取以維持系統基本運作。
3. **無資料庫設計**：使用 File-based persistence，確保系統可隨時在輕量 VM 上搬遷與部署。
