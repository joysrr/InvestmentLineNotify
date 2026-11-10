---
type: reference
status: current
last_updated: 2026-11-01
related_code:
  - src/modules/strategy/
tags:
  - strategy
  - signals
  - lifecycle
wiki_links:
  - [[AI News]]
  - [[Strategy Engine]]
---

# 市場策略與數據源 (Strategy & Providers)

本目錄包含系統的核心決策大腦 (Strategy Engine) 與負責收集外部市場資訊的供應商介面 (Providers)。

## 模組列表

- [`strategy_engine.md`](./strategy_engine.md)：策略引擎的核心運作機制、計分矩陣、狀態機與風控策略。
- [`leading_indicator_radars.md`](./leading_indicator_radars.md)：四大極端雷達矩陣、狀態機防禦層與雙軌風控分流。
- [`providers.md`](./providers.md)：定義系統目前支援的所有外部資料源、API 以及實作規格。
- [`lifecycle_engine.md`](./lifecycle_engine.md)：生命週期槓桿引擎。
- [`regime_policy.md`](./regime_policy.md)：市場環境適應性 (Regime-aware) 策略。
- [`cash_exposure_advisor.md`](./cash_exposure_advisor.md)：現金風險顧問，四層槓桿與分批進場邏輯。
- [`maintenance_state_machine.md`](./maintenance_state_machine.md)：維持率狀態機。
- [`lifecycle_health_test_spec.md`](./lifecycle_health_test_spec.md)：生命週期引擎與健康儀表板測試規格。
- [`macro_regime_metrics_analysis.md`](./macro_regime_metrics_analysis.md)：四象限宏觀規則與指標量化定義。

## 核心設計理念

1. **策略與資料解耦**：Providers 層的責任是將外部 API 亂七八糟的資料格式，轉換為系統統一的規格。Strategy Engine 絕不直接呼叫外部 API，只向 Providers 請求數據。
2. **多層防護**：決策流程是由上而下的優先權鏈 (Priority Chain)，風控與停損 (如維持率斷頭、估值泡沫) 具備絕對優先權，可以攔截並覆寫底層的戰術買入訊號。
