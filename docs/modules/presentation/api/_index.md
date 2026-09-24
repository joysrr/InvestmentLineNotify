---
type: reference
status: current
last_updated: 2026-09-10
last_verified: 2026-09-10
related_code:
  - src/api/
  - swagger.json
tags:
  - api
  - rest
  - swagger
wiki_links:
  - [[API Contract]]
---

# API 規格總覽

本專案的 HTTP API 介面規格，主要由 `fastify-swagger` 自動生成並維護於專案根目錄的 `swagger.json`。

## 真理之源 (Source of Truth)

- **OpenAPI / Swagger 定義**：[`/swagger.json`](../../swagger.json)
- **實作邏輯**：[`/src/api/`](../../src/api/)

## 模組內部合約

除了對外的 HTTP API，針對內部模組之間的資料交換合約，請參考本目錄下的子文件，例如：

- [`report_signals_contract.md`](./report_signals_contract.md)：規範 `strategyEngine` 產出的 `report.signals` 結構與前端的介面對接。
- [`report_news_contract.md`](./report_news_contract.md)：規範 `/api/report/news` 只讀最新每日報告，最新報告無新聞時不回退舊資料。
