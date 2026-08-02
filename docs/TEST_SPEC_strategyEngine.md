# Test Specification

**功能名稱**：StrategyEngine (策略引擎)
**對應草案版本**：MASTER_PLAN v3.0
**建立日期**：2026-05-17
**建立者**：`@QA`

## 測試案例清單

| #     | 測試案例描述                                      | 前置條件                                      | 輸入              | 預期結果                                                                                                  | 執行者 | 優先級 |
| ----- | ------------------------------------------------- | --------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------- | ------ | ------ |
| TC-01 | 優先處理 🔴 斷頭危機 (Critical Margin)            | 大盤維持率低於 135% (例如 130%)               | `buildDecision()` | `maintenanceLayer` 應為 `"critical"`，`marketStatus` 應含 `"斷頭"`，`target` 應含 `"強制降槓桿"`          | `@QA`  | 🔴     |
| TC-02 | 應在 🟠 高危凍結 (Frozen Zone) 攔截加碼           | 大盤維持率低於 145% (例如 140%)               | `buildDecision()` | `maintenanceLayer` 應為 `"frozen"`，`target` 應含 `"禁止進場"`                                            | `@QA`  | 🔴     |
| TC-03 | 應正確攔截 EntryGate 封鎖 (RSI 過高)              | 大盤維持率正常，近距跌幅小，但 RSI 達 80 以上 | `buildDecision()` | `entryGateBlocked` 應為 `true`，`marketStatus` 應含 `"前置過濾"`                                          | `@QA`  | 🔴     |
| TC-04 | 應觸發 Valuation Guard Latch (PR 100)             | 大盤估值 PB 達 3.0 (高 PR 水位)               | `buildDecision()` | `valuationGuardStatus` 應為 `"latch_triggered"`，`marketStatus` 應含 `"估值守衛"`，`target` 應含 `"清倉"` | `@QA`  | 🔴     |
| TC-05 | 正常市況應輸出 Scoring Matrix 建議 (Neutral Zone) | 各項維持率與估值指標均在安全區                | `buildDecision()` | `marketStatus` 應含 `"常態佈局"`，`target` 應含 `"0050 DCA"`                                              | `@QA`  | 🔴     |

## 不在本次測試範圍內

- 多標的回測系統之表現 (Phase 3 範疇)。
- 實際 Telegram / Line Bot HTTP 送信行為與外部連線 (Providers API 為 Integration/Mock 驗證，不直接發送 Telegram / Line 通知到真實環境)。
