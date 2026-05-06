# 市場策略與數據源 (Strategy & Providers)

本目錄包含系統的核心決策大腦 (Strategy Engine) 與負責收集外部市場資訊的供應商介面 (Providers)。

## 模組列表

- [`strategy_engine.md`](./strategy_engine.md)：策略引擎的核心運作機制、計分矩陣、狀態機與風控策略。
- [`providers.md`](./providers.md)：定義系統目前支援的所有外部資料源、API 以及實作規格。
- [`lifecycle_engine.md`](./lifecycle_engine.md)：生命週期槓桿引擎。
- [`maintenance_state_machine.md`](./maintenance_state_machine.md)：維持率狀態機。

## 核心設計理念

1. **策略與資料解耦**：Providers 層的責任是將外部 API 亂七八糟的資料格式，轉換為系統統一的規格。Strategy Engine 絕不直接呼叫外部 API，只向 Providers 請求數據。
2. **多層防護**：決策流程是由上而下的優先權鏈 (Priority Chain)，風控與停損 (如維持率斷頭、估值泡沫) 具備絕對優先權，可以攔截並覆寫底層的戰術買入訊號。
