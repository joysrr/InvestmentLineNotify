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

本矩陣記錄 `src/` 下每個核心模組是否有對應的 `docs/` 技術規格文件。依據 Phase 7 計畫，每個模組標記三種狀態之一：

- **✅ 已覆蓋**：有對應 docs 文件，位置正確
- **⚠️ 部分覆蓋**：有相關文件但未完整涵蓋模組職責
- **❌ 未覆蓋**：完全無對應 docs 文件

## 模組覆蓋一覽表

| #   | src 模組                     | 對應 docs 位置                                          | 狀態             | 備註                                                        |
| --- | ---------------------------- | ------------------------------------------------------- | ---------------- | ----------------------------------------------------------- |
| 1   | `src/api/`                   | `docs/modules/presentation/api/`                        | ✅ 已覆蓋        | API 契約與端點規格                                          |
| 2   | `src/bot/`                   | `docs/modules/presentation/bot.md`                      | ✅ 已覆蓋        | Telegram Bot 入口規格                                       |
| 3   | `src/domain/`                | `docs/modules/overview.md`                              | ⚠️ 部分覆蓋      | Context/State 物件定義，合併入架構總覽資料治理章節          |
| 4   | `src/interfaces/`            | 各對應模組文件                                          | ⚠️ 部分覆蓋      | INotifier/IDataProvider 等散記於各模組文件，不需獨立文件    |
| 5   | `src/modules/ai/`            | `docs/modules/ai_news/`                                 | ✅ 已覆蓋        | AI 管線、提示詞、Langfuse                                   |
| 6   | `src/modules/assets/`        | `docs/modules/strategy/`                                | ⚠️ 部分覆蓋      | assetRegistry 在策略文件已說明（DEC-14 資產抽象）           |
| 7   | `src/modules/bot/`           | `docs/modules/presentation/bot.md`                      | ⚠️ 部分覆蓋      | 僅涵蓋 Bot 入口，未涵蓋 handlers/middleware                 |
| 8   | `src/modules/config/`        | `docs/modules/strategy/`                                | ⚠️ 部分覆蓋      | configValidator 功能在策略文件已涵蓋，不需獨立文件          |
| 9   | `src/modules/data/`          | `docs/modules/infrastructure/`                          | ✅ 已覆蓋        | 資料持久化、快取、歷史 K 線                                 |
| 10  | `src/modules/deployment/`    | `docs/operations/deployment-agent.md`                   | ⚠️ 部分覆蓋      | 部署代理有文件，executorLock/verification 未涵蓋            |
| 11  | `src/modules/monitoring/`    | `docs/decisions/DEC-005-monitoring-alerting.md`         | ⚠️ 部分覆蓋      | 架構決策文件存在，alertEngine 實作未細述                    |
| 12  | `src/modules/news/`          | `docs/modules/ai_news/`                                 | ✅ 已覆蓋 (部分) | 新聞獲取已涵蓋，AI 分析管線分散在 ai_news/                  |
| 13  | `src/modules/notifications/` | `docs/modules/presentation/notifications.md`            | ⚠️ 部分覆蓋      | 通知格式化已涵蓋，傳輸層未涵蓋                              |
| 14  | `src/modules/operations/`    | `docs/modules/operations/`                              | ✅ 已覆蓋        | 環境變數、排程、Oracle VM 部署                              |
| 15  | `src/modules/portfolio/`     | `docs/modules/presentation/api/portfolio_health_api.md` | ⚠️ 部分覆蓋      | 僅 API 端點，無模組內部邏輯文件                             |
| 16  | `src/modules/providers/`     | `docs/modules/strategy/providers.md`                    | ✅ 已覆蓋        | Provider 架構與 10 個實作文件                               |
| 17  | `src/modules/replay/`        | `docs/verification/`                                    | ⚠️ 部分覆蓋      | replayRunner 在 verification 已說明，細節可補充             |
| 18  | `src/modules/sentiment/`     | `docs/modules/strategy/sentiment.md`                    | ✅ 已覆蓋        | Phase 8 已補寫                                              |
| 19  | `src/modules/simulator/`     | `docs/modules/strategy/simulator.md`                    | ✅ 已覆蓋        | Phase 8 已補寫                                              |
| 20  | `src/modules/strategy/`      | `docs/modules/strategy/`                                | ✅ 已覆蓋        | 策略引擎、雷達、生命週期、現金風險                          |
| 21  | `src/modules/verification/`  | `docs/verification/`                                    | ⚠️ 部分覆蓋      | 驗證報告存在，但非模組技術規格                              |
| 22  | `src/scheduler/`             | `docs/modules/operations/schedules.md`                  | ✅ 已覆蓋 (部分) | 每日計算排程已涵蓋                                          |
| 23  | `src/scripts/`               | `docs/meta/scripts-inventory.md`（Phase 4 建立）        | ❌ 未覆蓋        | 待 Phase 4 腳本盤點建立後補充                               |
| 24  | `src/tools/`                 | `docs/TESTING.md`                                       | ⚠️ 部分覆蓋      | stressTest 工具可併入 TESTING.md 壓力測試段落               |
| 25  | `src/utils/`                 | `docs/modules/infrastructure/`                          | ⚠️ 部分覆蓋      | logger/coreUtils/snapshotCrypto/envGuard 合併入基礎設施文件 |

## 統計摘要

| 狀態        | 數量    | 比例 |
| ----------- | ------- | ---- |
| ✅ 已覆蓋   | 11 / 25 | 44%  |
| ⚠️ 部分覆蓋 | 13 / 25 | 52%  |
| ❌ 未覆蓋   | 1 / 25  | 4%   |

## 補寫優先級

依據 Phase 7 計畫評估：

| 優先級  | 模組                         | 原因                        | 建議動作                                                     |
| ------- | ---------------------------- | --------------------------- | ------------------------------------------------------------ |
| ✅ 完成 | `src/modules/simulator/`     | 核心業務邏輯（0050 模擬器） | 已補寫 `docs/modules/strategy/simulator.md`                  |
| ✅ 完成 | `src/modules/sentiment/`     | 社群情緒核心模組            | 已補寫 `docs/modules/strategy/sentiment.md`                  |
| 🟠 中   | `src/modules/portfolio/`     | 投資組合核心邏輯            | 補寫 `docs/modules/strategy/portfolio.md`                    |
| 🟠 中   | `src/modules/notifications/` | 傳輸層未涵蓋                | 補寫 `docs/modules/presentation/notifications-transports.md` |
| 🟠 中   | `src/modules/bot/`           | handlers/middleware 未涵蓋  | 補寫 `docs/modules/presentation/bot-handlers.md`             |
| 🟢 低   | `src/utils/`                 | 工具函式                    | 併入 `docs/meta/documentation-standards.md`                  |
| 🟢 低   | `src/scripts/`               | 驗證腳本                    | 併入 `docs/meta/documentation-standards.md`                  |
| 🟢 低   | `src/modules/config/`        | 設定模組                    | 評估是否需文件                                               |
| 🟢 低   | `src/modules/assets/`        | 資產模組                    | 評估是否需文件                                               |
| 🟢 低   | `src/modules/deployment/`    | 部署模組                    | 評估是否需文件                                               |
| 🟢 低   | `src/modules/monitoring/`    | 監控模組                    | 評估是否需文件                                               |
| 🟢 低   | `src/modules/replay/`        | 重放模組                    | 評估是否需文件                                               |
| 🟢 低   | `src/domain/`                | 領域模型                    | 評估是否需文件                                               |
| 🟢 低   | `src/interfaces/`            | 介面定義                    | 評估是否需文件                                               |
| 🟢 低   | `src/tools/`                 | 工具集                      | 評估是否需文件                                               |

## 驗收準則

- [x] src/ 下每個模組在「模組覆蓋一覽表」中都有明確狀態
- [x] 「完全無文件」的模組（❌ 未覆蓋）已評估補寫需求
- [x] 補寫清單已納入 Phase 8（simulator.md、sentiment.md 已完成）

---

_產出：Phase 1-A 文件覆蓋率矩陣_
_建立：2026-11-11 | 負責人：Han_
