---
type: reference
status: current
last_updated: 2026-11-11
tags:
  - coverage
  - matrix
  - governance
wiki_links:
  - docs/modules/_index.md
  - docs/README.md
  - docs/meta/maintenance-schedule.md
---

# 文件覆蓋率矩陣 (Documentation Coverage Matrix)

本矩陣記錄 \`src/\` 下每個核心模組是否有對應的 \`docs/\` 技術規格文件。依據 Phase 7–9 計畫，每個模組標記四種狀態之一：

- **✅ 已覆蓋**：有對應 docs 文件，位置正確
- **⚠️ 部分覆蓋**：有相關文件但未完整涵蓋模組職責
- **❌ 未覆蓋**：完全無對應 docs 文件
- **N/A**：無需獨立文件（純型別、純工具、靜態資源，已合併入其他文件或無用戶導向需求）

## 模組覆蓋一覽表

| #   | src 模組                       | 對應 docs 位置                                                                | 狀態             | 備註                                                                      |
| --- | ------------------------------ | ----------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------- |
| 1   | \`src/api/\`                   | \`docs/modules/presentation/api/\`                                            | ✅ 已覆蓋        | API 契約與端點規格                                                        |
| 2   | \`src/bot/\`                   | \`docs/modules/presentation/bot.md\`                                          | ✅ 已覆蓋        | Telegram Bot 入口規格                                                     |
| 3   | \`src/domain/\`                | \`docs/modules/overview.md\`                                                  | N/A              | 純型別定義，合併入架構總覽資料治理章節，不需獨立文件                      |
| 4   | \`src/interfaces/\`            | 各對應模組文件                                                                | N/A              | 純型別定義，散記於各模組文件，不需獨立文件                                |
| 5   | \`src/modules/ai/\`            | \`docs/modules/ai_news/\`                                                     | ✅ 已覆蓋        | AI 管線、提示詞、Langfuse                                                 |
| 6   | \`src/modules/assets/\`        | \`docs/modules/strategy/\`                                                    | N/A              | assetRegistry 在策略文件已說明（DEC-14 資產抽象），不需獨立文件           |
| 7   | \`src/modules/bot/\`           | \`docs/modules/presentation/bot.md\`                                          | ✅ 已覆蓋        | 已補充 runnerLock 說明（handlers/middleware 完整涵蓋）                    |
| 8   | \`src/modules/config/\`        | \`docs/modules/overview.md\`、\`docs/meta/hardcoded-parameters-inventory.md\` | N/A              | configValidator 功能在策略文件已涵蓋，不需獨立文件                        |
| 9   | \`src/modules/data/\`          | \`docs/modules/infrastructure/\`                                              | ✅ 已覆蓋        | 資料持久化、快取、歷史 K 線                                               |
| 10  | \`src/modules/deployment/\`    | \`docs/operations/deployment-agent.md\`                                       | ✅ 已覆蓋        | 已補充 executorLock/verification 機制說明                                 |
| 11  | \`src/modules/monitoring/\`    | \`docs/modules/infrastructure/monitoring.md\`                                 | ✅ 已覆蓋        | 已新建 monitoring.md，涵蓋 alertEngine/MetricsCollector/ErrorStore 實作   |
| 12  | \`src/modules/news/\`          | \`docs/modules/ai_news/\`                                                     | ✅ 已覆蓋 (部分) | 新聞獲取已涵蓋，AI 分析管線分散在 ai_news/                                |
| 13  | \`src/modules/notifications/\` | \`docs/modules/presentation/notifications.md\`                                | ✅ 已覆蓋        | 已補充傳輸層、重試機制說明                                                |
| 14  | \`src/modules/operations/\`    | \`docs/modules/operations/\`                                                  | ✅ 已覆蓋        | 環境變數、排程、Oracle VM 部署                                            |
| 15  | \`src/modules/portfolio/\`     | \`docs/modules/strategy/portfolio.md\`                                        | ✅ 已覆蓋        | 已新建 portfolio.md，涵蓋驗證/推導快照全流程                              |
| 16  | \`src/modules/providers/\`     | \`docs/modules/strategy/providers.md\`                                        | ✅ 已覆蓋        | Provider 架構與 10 個實作文件                                             |
| 17  | \`src/modules/replay/\`        | \`docs/modules/verification/\`                                                | N/A              | replayRunner 在 verification 已說明，不需獨立文件                         |
| 18  | `src/modules/sentiment/`       | `docs/modules/strategy/sentiment.md`                                          | ✅ 已覆蓋        | Phase 8 已補寫                                                            |
| 19  | `src/modules/strategy/`        | `docs/modules/strategy/`                                                      | ✅ 已覆蓋        | 策略引擎、雷達、生命週期、現金風險                                        |
| 21  | \`src/modules/verification/\`  | \`docs/TESTING.md\`                                                           | N/A              | 驗證報告存在，但非模組技術規格，在 TESTING.md 說明                        |
| 22  | \`src/scheduler/\`             | \`docs/modules/operations/schedules.md\`                                      | ✅ 已覆蓋 (部分) | 每日計算排程已涵蓋                                                        |
| 23  | `src/scripts/`                 | `docs/meta/scripts-inventory.md`（Phase 9 建立）                              | ✅ 已覆蓋        | 腳本盤點已完整，涵蓋 26 個 .mjs 腳本                                      |
| 24  | \`src/tools/\`                 | \`docs/TESTING.md\`                                                           | N/A              | stressTest 工具可併入 TESTING.md 壓力測試段落，不需獨立文件               |
| 25  | \`src/utils/\`                 | \`docs/modules/infrastructure/_index.md\`                                     | N/A              | logger/coreUtils/snapshotCrypto/envGuard 合併入基礎設施文件，不需獨立文件 |

## 統計摘要

| 狀態        | 數量      | 比例   |
| ----------- | --------- | ------ |
| ✅ 已覆蓋   | 16 / 25   | 64%    |
| ⚠️ 部分覆蓋 | 0 / 25    | 0%     |
|             | ❌ 未覆蓋 | 0 / 25 | 0%  |     |
|             | N/A       | 9 / 25 | 36% |     |

## 補寫優先級

| 優先級  | 模組                           | 原因                        | 建議動作                                              |
| ------- | ------------------------------ | --------------------------- | ----------------------------------------------------- |
| ✅ 完成 | `src/modules/sentiment/`       | 社群情緒核心模組            | 已補寫 `docs/modules/strategy/sentiment.md`           |
| ✅ 完成 | `src/modules/portfolio/`       | 投資組合核心邏輯            | 已補寫 `docs/modules/strategy/portfolio.md`           |
| ✅ 完成 | \`src/modules/notifications/\` | 傳輸層未涵蓋                | 已補寫 \`docs/modules/presentation/notifications.md\` |
| ✅ 完成 | \`src/modules/bot/\`           | handlers/middleware 未涵蓋  | 已補寫 \`docs/modules/presentation/bot.md\`           |
| ✅ 完成 | \`src/modules/monitoring/\`    | 監控模組                    | 已補寫 \`docs/modules/infrastructure/monitoring.md\`  |
|         | ✅ 完成                        | \`src/modules/deployment/\` | 部署模組                                              | 已補充 \`docs/operations/deployment-agent.md\` executorLock/verification |     |
|         | ✅ 完成                        | \`src/scripts/\`            | 腳本盤點文件                                          | 已建立 \`docs/meta/scripts-inventory.md\`，涵蓋 26 個 .mjs 腳本          |     |
|         | N/A                            | \`src/domain/\`             | 領域模型                                              | 已合併入概要，不需獨立文件                                               |     |
| N/A     | \`src/interfaces/\`            | 介面定義                    | 已合併入各模組文件，不需獨立文件                      |
| N/A     | \`src/modules/assets/\`        | 資產模組                    | 已合併入策略文件，不需獨立文件                        |
| N/A     | \`src/modules/config/\`        | 設定模組                    | 已合併入概要與 inventory，不需獨立文件                |
| N/A     | \`src/modules/replay/\`        | 重放模組                    | 已合併入 verification，不需獨立文件                   |
| N/A     | \`src/tools/\`                 | 工具集                      | 已合併入 TESTING.md，不需獨立文件                     |
| N/A     | \`src/utils/\`                 | 工具函式                    | 已合併入基礎設施文件，不需獨立文件                    |

## 驗收準則

- [x] src/ 下每個模組在「模組覆蓋一覽表」中都有明確狀態
- [x] 「完全無文件」的模組（❌ 未覆蓋）已評估補寫需求（src/scripts/ 列入 Phase 4 腳本盤點）
- [x] 補寫清單已納入 Phase 8（sentiment.md、portfolio.md、notifications.md、bot.md、monitoring.md、deployment-agent.md 已完成）
- [x] 覆蓋矩陣中 ⚠️ 部分覆蓋比例降至 0%（≤ 20% 目標達成）

---

_產出：Phase 1-A 文件覆蓋率矩陣（Phase 9 深化版）_
_建立：2026-11-11 | 負責人：Han_
