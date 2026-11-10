---
type: reference
status: current
last_updated: 2026-11-11
tags:
  - modules
  - index
wiki_links:
  - docs/README.md
  - docs/modules/overview.md
---

# 模組總索引 (Modules Index)

本目錄包含 InvestmentLineNotify 的核心子模組技術規格。完整系統架構請參見 [`overview.md`](./overview.md)。

## 子模組

| 子目錄                                 | 說明                                                    | 主要索引                                               |
| -------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| [`infrastructure/`](./infrastructure/) | 底層基礎設施：資料持久化、快取、歷史 K 線、新聞池       | [infrastructure/_index.md](./infrastructure/_index.md) |
| [`strategy/`](./strategy/)             | 策略引擎、技術指標、生命週期、現金風險、宏觀判斷        | [strategy/_index.md](./strategy/_index.md)             |
| [`presentation/`](./presentation/)     | 入口與通知層：Telegram Bot、API 對接、通知格式化        | [presentation/_index.md](./presentation/_index.md)     |
| [`operations/`](./operations/)         | 運維層：環境變數、排程、Oracle VM 部署                  | [operations/_index.md](./operations/_index.md)         |
| [`ai_news/`](./ai_news/)               | AI 管線與新聞處理：Langfuse 觀測、Prompt 管理、評分分析 | [ai_news/_index.md](./ai_news/_index.md)               |

## 相關文件

- [`overview.md`](./overview.md)：系統架構總覽（數據治理、Mermaid 流程圖、目錄責任對照）
- [`docs/README.md`](../../README.md)：文件總導航中心
