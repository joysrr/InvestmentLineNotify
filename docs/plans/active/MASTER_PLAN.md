# InvestmentLineNotify Master Plan (v5.0)

> **單一真實來源**：[UNIFIED_DEVELOPMENT_PLAN.md](./UNIFIED_DEVELOPMENT_PLAN.md)
>
> 本文件為高層級概覽，詳細規劃請參考統一開發計畫。

---

## 📊 專案整體進度 (2026-08-10 更新)

```
Phase 1: 系統審計與架構硬化     ████████████████████ 100% ✅
Phase 2: 策略進化與環境感知     ████████████████░░  85% 🟡
Phase 3: 資產解耦與多標的支援   ████░░░░░░░░░░░░░░  20% ⬜
Phase 4: 回測與驗證體系         ████████░░░░░░░░░░  40% 🟡
Simulator (獨立功能)            ████████████░░░░░░  60% 🟡
```

---

## ✅ 已完成核心里程碑

| 階段          | 完成項目                                                      | 驗收             |
| ------------- | ------------------------------------------------------------- | ---------------- |
| **Phase 1**   | 模組化重構、安全性修補、動態停利、前端基建、儀表板重構        | 420 tests passed |
| **Phase 2**   | VIX Regime、估值動能、策略參數編輯器                          | 85%              |
| **Phase 3**   | T-3.1 Asset Abstraction、T-3.2 回測報表、T-3.3 策略參數編輯器 | 100% (Task #14)  |
| **Simulator** | Phase B/C 接線、Phase 0 技術債清理                            | 60% (Task #6)    |
| **TDD 補課**  | 48 測試補完 + E2E 21 測試                                     | 100%             |

---

## 🎯 當前執行焦點

### Phase 1: Simulator Phase D (前端反向推導 UI)

- **狀態**: 待開始 (Day 3-4)
- **目標**: 結果展示、參數表單、歷史記錄、E2E 測試
- **工時**: 16h

### Phase 2: T-3.4 參數調優 UI (Task #15)

- **狀態**: 待開始 (Day 5-7)
- **目標**: 批次模擬、敏感度分析、Pareto 前沿
- **工時**: 20h

---

## 🔑 關鍵依賴鏈 (Critical Path)

```
archiveManager.getArchiveRecords(dateRange)
    → runBacktest.mjs runner
        → 回測 Phase 1/2/3 解鎖
            → signalCategory/signalType
                → 回測 Phase 2 + 資金管控 Phase 2
                    → 回測非同步 API (Job Queue + WebSocket)
                        → Mini App 回測整合、排程自動回測
```

---

## 📁 文件索引

| 文件                                          | 用途             | 狀態        |
| --------------------------------------------- | ---------------- | ----------- |
| **UNIFIED_DEVELOPMENT_PLAN.md**               | 詳細單一真實來源 | ✅ Active   |
| **MASTER_PLAN.md** (本檔)                     | 高層級概覽       | ✅ Active   |
| **BUDGET_PRIORITY_DESIGN.md**                 | 資金管控設計規格 | ✅ Active   |
| **docs/plans/archive/2026-08-10_old_active/** | 舊版計畫歸檔     | 📦 Archived |

---

## 📈 測試基線 (2026-08-10)

| 類別             | 結果                |
| ---------------- | ------------------- |
| 後端單元/整合    | 560 passed / 6 todo |
| 前端單元         | 110 passed          |
| E2E (Playwright) | 21 passed           |
| Simulator 專用   | 72 passed           |

---

## 🛑 閘門條件

| 閘門   | 目標日期 | 條件                              |
| ------ | -------- | --------------------------------- |
| **G1** | Day 4    | Phase D E2E ≥ 8 tests、全測試通過 |
| **G2** | Day 7    | T-3.4 核心功能可用                |
| **G3** | Day 8    | 技術債清單清零、Coverage 門檻生效 |
| **G4** | Day 10   | 生產部署就緒                      |

---

## 📌 維護說明

- **單一真實來源**：`UNIFIED_DEVELOPMENT_PLAN.md`
- **高層概覽**：本檔案 (MASTER_PLAN.md)
- **歸檔舊版**：`docs/plans/archive/2026-08-10_old_active/`
- **更新頻率**：每 Sprint 結束或重大里程碑

> 詳細規劃、決策記錄、測試缺口、執行建議請參考 **UNIFIED_DEVELOPMENT_PLAN.md**
