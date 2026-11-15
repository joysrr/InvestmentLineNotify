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
last_verified: "2026-11-11"
related_code:
  - src/modules/
related_docs:
  - docs/modules/overview.md
summary: "Modules index - core sub-module technical specifications"
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

## 代碼目錄 → 文檔分組對照

| 代碼目錄                     | 對應文檔分組              | 主要職責                               |
| ---------------------------- | ------------------------- | -------------------------------------- |
| `src/modules/strategy/`      | `modules/strategy/`       | 策略引擎、技術指標、生命週期、投資組合 |
| `src/modules/portfolio/`     | `modules/strategy/`       | 投資組合、持倉、現金流                 |
| `src/modules/assets/`        | `modules/strategy/`       | 資產管理、配置                         |
| `src/modules/ai/`            | `modules/ai_news/`        | AI 管線、Langfuse 觀測、Prompt 管理    |
| `src/modules/news/`          | `modules/ai_news/`        | 新聞抓取、去重、評分分析               |
| `src/modules/sentiment/`     | `modules/ai_news/`        | 社群情緒分析、多空指標                 |
| `src/modules/bot/`           | `modules/presentation/`   | Telegram Bot 長駐、即時指令            |
| `src/modules/notifications/` | `modules/presentation/`   | 通知格式化、HTML 模板                  |
| `src/modules/providers/`     | `modules/infrastructure/` | 市場資料提供者、快取                   |
| `src/modules/data/`          | `modules/infrastructure/` | 數據持久化、歷史 K 線                  |
| `src/modules/replay/`        | `modules/infrastructure/` | 歷史數據重播                           |
| `src/modules/config/`        | `modules/operations/`     | 環境變數、系統配置                     |
| `src/modules/deployment/`    | `modules/operations/`     | Oracle VM 部署、排程觸發               |
| `src/modules/operations/`    | `modules/operations/`     | 排程、運維、健康檢查                   |
| `src/modules/monitoring/`    | `modules/operations/`     | 錯誤監控、健康度統計                   |
| `src/modules/verification/`  | `modules/operations/`     | 資料驗證、契約同步                     |

## 相關文件

- [`overview.md`](./overview.md)：系統架構總覽（數據治理、Mermaid 流程圖、目錄責任對照）
- [`docs/README.md`](../../README.md)：文件總導航中心
