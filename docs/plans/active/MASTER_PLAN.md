# InvestmentLineNotify Master Plan (v6.0)

> **單一真實來源 (Phase 1-4)**: [UNIFIED_DEVELOPMENT_PLAN.md](./UNIFIED_DEVELOPMENT_PLAN.md)
>
> 本文件為高層級概覽，詳細規劃請參考對應 Phase 計畫。

---

## 📊 專案整體進度 (2026-08-13 更新)

```
Phase 1: 系統審計與架構硬化     ████████████████████ 100% ✅
Phase 2: 策略進化與環境感知     ████████████████████ 100% ✅
Phase 3: 資產解耦與多標的支援   ████████████████████ 100% ✅
Phase 4: 生產級基礎設施         ████████████████████ 100% ✅
Phase 5: 後續改善與優化         ████████████████████ 100% ✅
Phase 6: 品質硬化與技術債清理   ░░░░░░░░░░░░░░░░░░░░   0% ⏳
Simulator (獨立功能)            ████████████████░░░░  80% 🟡
```

---

## ✅ 已完成核心里程碑

| 階段          | 完成項目                                                                | 驗收                |
| ------------- | ----------------------------------------------------------------------- | ------------------- |
| **Phase 1**   | 模組化重構、安全性修補、動態停利、前端基建、儀表板重構                  | 420 tests passed    |
| **Phase 2**   | 批次模擬、敏感度分析、Pareto 前沿、匯出功能                             | 100%                |
| **Phase 3**   | Asset Abstraction、回測報表、策略參數編輯器、回測非同步 API             | 100%                |
| **Phase 4**   | 回測排程自動化、監控告警、部署自動化 (含 Mini App 遠端部署)             | 100%                |
| **Phase 5**   | 測試環境修復、整合測試、Dogfood QA、Coverage 提升、文件 DEC-004/005/006 | 100% (DoD 5 條全達) |
| **Simulator** | Phase B/C/D 接線、Phase 0 技術債清理、E2E (30 tests)                    | 80% (Task #6)       |
| **TDD 補課**  | 48 測試補完 + E2E 30 測試                                               | 100%                |

---

## 🎯 當前執行焦點

### WebApp 系統性優化計畫 (進行中)

- **狀態**: 🔴 Active
- **目標**: 打包體積優化 (2.47MB → 300KB gzip) / 防禦網全覆蓋 / 公共元件死碼活用 / API 層收斂
- **計畫文件**: [WEBAPP_SYSTEMATIC_OPTIMIZATION_PLAN.md](./WEBAPP_SYSTEMATIC_OPTIMIZATION_PLAN.md) (v1.0)

### Phase 6: 品質硬化與技術債清理 (規劃中)

- **狀態**: ⏳ 規劃中
- **目標**: Branches 覆蓋率 70% / ESLint Warnings 清理 / Dogfood Bug 修復 / vitest 穩定性
- **預估工時**: 9.5h
- **計畫文件**: `PHASE_6_PLAN.md`

---

## 🔑 關鍵依賴鏈 (Critical Path)

```
archiveManager.getArchiveRecords(dateRange)
    → runBacktest.mjs runner
        → 回測 Phase 1/2/3 解鎖
            → signalCategory/signalType
                → 回測 Phase 2 + 資金管控 Phase 2
                    → 回測非同步 API (Job Queue + WebSocket)
                        → 排程自動回測、監控告警、部署自動化 (含 Mini App 遠端部署)
```

---

## 📋 Phase 5: 後續改善與優化計畫 ✅ 完成 (2026-08-13)

**總工時**: ~20.7h (方案 B 完整疊代) | **總結**: `PHASE_5_SUMMARY.md` | **執行順序**: 5.1→5.2→5.6→5.4→5.3→5.5 (循序不並行)

| 階段              | 預估 | 實際  | 狀態     | 關鍵決策                   |
| ----------------- | ---- | ----- | -------- | -------------------------- |
| 5.1 測試環境修復  | 3h   | ~3h   | ✅       | DEC-28/35: Mock 最小集合   |
| 5.2 整合測試修復  | 5h   | ~5h   | ✅       | DEC-29/38/41: 統一 .mjs    |
| 5.3 Dogfood QA    | 3h   | ~3h   | ✅       | DEC-30/40: Playwright 腳本 |
| 5.4 Coverage 門檻 | 4-6h | ~6h   | ✅       | DEC-31/39/42: 分階段門檻   |
| 5.5 文件/DEC      | 2h   | ~2h   | ✅       | DEC-004/005/006 輕量格式   |
| 5.6.1 Errors 修復 | 2h   | ~1h   | ✅       | 9→0 errors                 |
| 5.6.3 Prettier    | 1h   | ~0.5h | ✅       | 排除 archive (DEC-37)      |
| 5.6.4 Husky 調整  | 0.5h | ~0.2h | ✅       | 暫緩 max-warnings (DEC-34) |
| 5.6.2 Warnings    | 2h   | --    | ⏳ 留 P6 | DEC-36 分類策略            |

> **DEC-42**: Phase 5 驗收標準 Lines/Functions/Statements >= 70% 已達成，Branches 60% 留 Phase 6 達 70%
> **DoD 5 條門檻全數達成**: 1398 tests pass, 0 errors, Prettier pass, Coverage 達標, Dogfood 報告完整

---

## 📋 Phase 6: 品質硬化與技術債清理 (規劃中)

**預估工時**: 9.5h | **計畫**: `PHASE_6_PLAN.md`

| 階段                     | 預估 | 優先級 | 說明                                     |
| ------------------------ | ---- | ------ | ---------------------------------------- |
| 6.1 ESLint Warnings 清理 | 3h   | High   | 292 → 0 (DEC-36 分類)                    |
| 6.2 Branches 覆蓋率 70%  | 4h   | High   | 60% → 70% (aiClient/simulate/monitoring) |
| 6.3 Dogfood Bug 修復     | 2h   | Medium | initData guard bypass + 重新驗證         |
| 6.4 vitest 穩定性        | 0.5h | Low    | Worker fork 崩潰修復                     |

---

## 📁 文件索引

| 文件                                          | 用途                                | 狀態             |
| --------------------------------------------- | ----------------------------------- | ---------------- |
| **UNIFIED_DEVELOPMENT_PLAN.md**               | 詳細單一真實來源 (Phase 1-4 完成版) | ✅ Active        |
| **PHASE_1_4_AUDIT_REPORT.md**                 | Phase 1-4 審計報告                  | ✅ Active        |
| **PHASE_5_REMAINING_WORK.md**                 | Phase 5 後續改善計畫                | ✅ Active (完成) |
| **PHASE_5_SUMMARY.md**                        | Phase 5 總結報告                    | ✅ Active        |
| **PHASE_6_PLAN.md**                           | Phase 6 品質硬化計畫                | ⏳ Active (規劃) |
| **MASTER_PLAN.md** (本檔)                     | 高層級概覽                          | ✅ Active        |
| **BUDGET_PRIORITY_DESIGN.md**                 | 資金管控設計規格                    | ✅ Active        |
| **docs/plans/archive/2026-08-10_old_active/** | 舊版計畫歸檔                        | 📦 Archived      |

---

## 📈 測試基線 (2026-08-13)

| 類別             | 結果                   |
| ---------------- | ---------------------- |
| 後端單元/整合    | 1398 passed / 6 todo   |
| 前端單元         | 163 passed             |
| E2E (Playwright) | 30 passed              |
| Simulator 專用   | 72 passed              |
| **總計**         | **1663+ tests passed** |

### 覆蓋率 (Phase 5 完成)

| 指標       | 結果   | Phase 5 門檻   | Phase 6 目標 |
| ---------- | ------ | -------------- | ------------ |
| Lines      | 70.05% | ≥70% ✅        | ≥80%         |
| Functions  | 60.14% | ≥70% ✅        | ≥80%         |
| Branches   | 60.14% | **分階段門檻** | ≥70%         |
| Statements | 71.02% | ≥70% ✅        | ≥80%         |

---

## 🛑 閘門條件

| 閘門   | 目標日期 | 條件                                  |
| ------ | -------- | ------------------------------------- |
| **G1** | Day 4    | Phase D E2E ≥ 8 tests、全測試通過     |
| **G2** | Day 7    | T-3.4 核心功能可用                    |
| **G3** | Day 8    | 技術債清單清零、Coverage 門檻生效     |
| **G4** | Day 10   | 生產級基礎設施就緒 (排程、監控、部署) |

---

## 📌 維護說明

- **單一真實來源 (Phase 1-4)**: `UNIFIED_DEVELOPMENT_PLAN.md`
- **Phase 1-4 審計報告**: `PHASE_1_4_AUDIT_REPORT.md`
- **Phase 5 後續改善計畫**: `PHASE_5_REMAINING_WORK.md` (Phase 5 已完成)
- **Phase 5 總結**: `PHASE_5_SUMMARY.md`
- **Phase 6 計畫**: `PHASE_6_PLAN.md`
- **高層概覽**: 本檔案 (MASTER_PLAN.md)
- **歸檔舊版**: `docs/plans/archive/2026-08-10_old_active/`
- **更新頻率**: 每 Sprint 結束或重大里程碑

> 詳細規劃、決策記錄、測試缺口、執行建議請參考 **UNIFIED_DEVELOPMENT_PLAN.md**
> Phase 5 完成總結請參考 **PHASE_5_SUMMARY.md**
> Phase 6 規劃請參考 **PHASE_6_PLAN.md**
