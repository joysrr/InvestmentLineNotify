---
type: reference
status: current
last_updated: 2026-11-10
last_verified: 2026-11-10
related_code:
  - src/api/
  - docs/api/openapi.json
tags:
  - api
  - rest
  - openapi
wiki_links:
  - [[API Contract]]
---

# API 規格總覽

本專案的 HTTP API 介面規格，主要維護於 `docs/api/openapi.json`（OpenAPI 3.0 規範，共 51 個端點）。

## 真理之源 (Source of Truth)

- **OpenAPI 3.0 規格真理之源**：[`docs/api/openapi.json`](../../../docs/api/openapi.json)
- **實作邏輯**：[`/src/api/`](../../../../src/api/)

## 模組內部合約

除了對外的 HTTP API，針對內部模組之間的資料交換合約，請參考本目錄下的子文件，例如：

- [`report_signals_contract.md`](./report_signals_contract.md)：規範 `strategyEngine` 產出的 `report.signals` 結構與前端的介面對接。
- [`report_news_contract.md`](./report_news_contract.md)：規範 `/api/report/news` 只讀最新每日報告，最新報告無新聞時不回退舊資料。
