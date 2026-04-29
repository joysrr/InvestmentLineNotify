# AI 管線與新聞處理 (AI & News Pipeline)

本目錄負責專案所有的自然語言處理，包含從市場上抓取生肉新聞 (Raw News)、透過過濾器清理、再交由 LLM 進行資訊萃取與戰報總結。

## 模組列表

- [`news_fetcher.md`](./news_fetcher.md)：說明 `newsFetcher.mjs` 如何使用 RSS 抓取新聞並進行第一層的物理過濾。
- [`keyword_config.md`](./keyword_config.md)：說明 `keywordConfig.mjs` 的靜態與動態關鍵字，以及黑名單 (Blacklist) 機制。
- [`ai_pipeline.md`](./ai_pipeline.md)：說明 `ai/` 目錄下的 LLM 呼叫封裝、斷路器與 Langfuse 整合機制。

## 核心設計理念

1. **多層過濾漏斗**：每天有數百篇新聞，先透過 Keyword 排除、指紋去重 (Fingerprint)、來源過濾，最後才送入 AI，大幅節省 Token 花費。
2. **AI 不是神**：AI 僅做「資訊萃取」與「摘要」，絕不賦予其直接操作資金或決定買賣訊號的權限，嚴守「演算法主導、AI 輔助」的界線。
