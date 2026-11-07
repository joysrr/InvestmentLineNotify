---
type: plan
status: active
last_updated: 2026-11-06
tags:
  - strategy-score
  - verification
  - entry-scoring
  - api
  - mini-app
wiki_links: []
---

# 策略分數構成驗證計畫

## 目標

確認「策略分數構成」區塊的資料是否有計算，計算是否正確，以及前後端顯示是否一致。在完整確認細節並核實發現後，才開始任何修改。

## 待驗證項目清單

| #   | 項目                                   | 檢查點                                                                                                                                                                              | 狀態                                                        | 備註                                                                                                                |
| --- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1   | `computeEntryScore()` 計算邏輯         | `entryScoringPolicy.mjs` 各細項如何加總為總分                                                                                                                                       | ✅ 已驗證                                                   | 總分 = dropScore + Math.max(rsiScore, kdScore) + macdScore + sentimentScore；RSI 與 KD 取最大值（去相關化），不相加 |
| 2   | 後端 `/api/strategy-status` total 來源 | `strategyStatus.mjs` line 41 `total: signals.weightScore ?? signals.score ?? 0`，直接從狀態快取讀取，**不重新計算細項之和**                                                         | ✅ 已驗證                                                   | 風險：細項加總不等於 total，因為 RSI/KD 取 MAX 不相加                                                               |
| 3   | 前端 `StrategyStatusView.vue` 顯示邏輯 | 總分與各細項皆從 `health.weightScore` 讀取，不重新計算                                                                                                                              | ✅ 確認：用戶決定前端只負責顯示，後端負責計算，不需前端驗證 | 細項顯示與總分來自同一後端物件，前端信賴後端給定總分                                                                |
| 4   | 缺少 `computeEntryScore` 單元測試      | ✅ 已補上 `src/test/unit/strategy/entryScoringPolicy.test.mjs`（7 測試，全部通過）                                                                                                  | 已驗證                                                      | 確認 MAX(rsiScore, kdScore) 去相關化邏輯是預期行為                                                                  |
| 5   | 後端 total 與細項一致性驗證            | ✅ 已修正：`strategyStatus.mjs` line 41 現在重新計算 `total = (dropScore ?? 0) + MAX(rsiScore ?? 0, kdScore ?? 0) + (macdScore ?? 0) + (sentimentScore ?? 0)`，並補上一致性驗證測試 | 已驗證                                                      | total 現在與細項嚴格一致，不再直接從狀態快取讀取                                                                    |

## 驗證方法

- 閱讀並分析相關源代碼（上述三個文件）
- 檢查現有測試覆蓋情況
- 如有需要，撰寫臨時腳本以確認計算式
- 每項驗證完成後更新本計畫文件的「狀態」與「備註」

## 修改原則

- 僅在所有項目驗證完成且發現確實問題後，才開始修改代碼
- 修改前先補上缺失的單元測試（TDD）
- 最小改動，不新增無關功能
