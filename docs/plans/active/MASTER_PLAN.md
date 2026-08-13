# InvestmentLineNotify Master Plan (v5.0)

> **單一真實來源**：[UNIFIED_DEVELOPMENT_PLAN.md](./UNIFIED_DEVELOPMENT_PLAN.md)
>
> 本文件為高層級概覽，詳細規劃請參考統一開發計畫。

---

## 📊 專案整體進度 (2026-08-11 更新)

`\nPhase 1: 系統審計與架構硬化     ████████████████████ 100% ✅\nPhase 2: 策略進化與環境感知     ████████████████████ 100% ✅\nPhase 3: 資產解耦與多標的支援   ████████████████████ 100% ✅\nPhase 4: 生產級基礎設施         ████████████████████ 100% ✅\nSimulator (獨立功能)            ████████████████░░░░  80% 🟡\n`

---

## ✅ 已完成核心里程碑

| 階段          | 完成項目                                                    | 驗收             |
| ------------- | ----------------------------------------------------------- | ---------------- |
| **Phase 1**   | 模組化重構、安全性修補、動態停利、前端基建、儀表板重構      | 420 tests passed |
| **Phase 2**   | 批次模擬、敏感度分析、Pareto 前沿、匯出功能                 | 100%             |
| **Phase 3**   | Asset Abstraction、回測報表、策略參數編輯器、回測非同步 API | 100%             |
| **Simulator** | Phase B/C/D 接線、Phase 0 技術債清理、E2E (30 tests)        | 80% (Task #6)    |
| **TDD 補課**  | 48 測試補完 + E2E 30 測試                                   | 100%             |

---

## 🎯 當前執行焦點

### Phase 4: 生產級基礎設施 (單人單機部署)

- **狀態**: ✅ 完成
- **目標**: 回測排程自動化、監控告警、部署腳本 (含 Mini App 遠端部署按鈕)
- **工時**: 14h (4.1: 6h, 4.2: 4h, 4.3: 4h)
- **環境**: 單人單機，無 Redis，無 GitHub Actions (DEC-24)
- **完成項目**:
  - 4.1 回測排程自動化 (Cron + Bull 記憶體佇列、多配置併行、失敗重試、結果持久化)
  - 4.2 監控/告警 (錯誤追蹤 SQLite、效能指標 p50/p95/p99、告警引擎、儀表板 API)
  - 4.3 部署自動化 (部署 API adminGuard、執行器 git pull→npm ci→build→pm2 reload、WebSocket 日誌流、DeployButton.vue、deploy-local.mjs --rollback、Systemd 服務)

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

## 📋 Phase 5: 後續改善與優化計畫 (疊代自 Phase 1-4 審計)

**總工時**: 22h+ (含緩衝) | **文件**: `PHASE_5_REMAINING_WORK.md` | **執行順序**: 5.1→5.2→5.6→5.4→5.3→5.5 (不並行)

| 階段                                | 預估工時 | 優先級    | 狀態                 | 關鍵決策                                                    |
| ----------------------------------- | -------- | --------- | -------------------- | ----------------------------------------------------------- |
| **5.1** 測試環境修復與穩定化        | 3h       | 🟡 High   | ✅ 完成              | DEC-28/35: Mock 最小集合                                    |
| **5.2** 既有整合測試基礎設施修復    | 5h       | 🟡 High   | ✅ 完成              | DEC-29/38/41: 全面統一 .mjs、feature branch 驗證、8h 時間盒 |
| **5.4** Coverage 門檻實際驗證與提升 | 4h+      | 🟡 Medium | ✅ 完成 (分階段門檻) | DEC-31/39/42: 先補 thresholds、分階段門檻、Branch 留 P6     | \n  | **5.3** dogfood 探索式 QA 報告補齊 | 3h  | 🟢 Low | ⏳ 下一步 | DEC-30/40: Playwright 自訂腳本、不並行 | \n  | **5.5** 文件完善與架構決策補充 | 2h  | 🟢 Low | ⏳  | DEC-32: DEC 輕量格式 | \n  | **5.6** 既有程式碼品質問題修復 | 5h  | 🟡 Medium | 🔄 進行中 (5.6.1/3/4 完成) | DEC-33/34/36/37: vitest globals、暫緩 warnings、分類清理、排除 archive |

> **DEC-27**: 既有程式碼品質問題納入 Phase 5.6 統一修復
> **DoD**: 5 條門檻 (測試綠燈、ESLint 0 errors、Prettier pass、Coverage≥70%(P5)/80%(P6)、Dogfood報告)
> **時間盒**: 5.2=8h、5.4.2=6h、5.6=6h；超時啟用替代方案
> **註**: 不並行執行，確保品質；預估 3-4 工作天

---

## 📁 文件索引

|| 文件 | 用途 | 狀態 ||
|| --------------------------------------------- | ---------------- | ----------- ||
|| **UNIFIED_DEVELOPMENT_PLAN.md** | 詳細單一真實來源 (Phase 1-4 完成版) | ✅ Active ||
|| **PHASE_1_4_AUDIT_REPORT.md** | Phase 1-4 審計報告 | ✅ Active ||
|| **PHASE_5_REMAINING_WORK.md** | Phase 5 後續改善計畫 | ✅ Active ||
|| **MASTER_PLAN.md** (本檔) | 高層級概覽 | ✅ Active ||
|| **BUDGET_PRIORITY_DESIGN.md** | 資金管控設計規格 | ✅ Active ||
|| **docs/plans/archive/2026-08-10_old_active/** | 舊版計畫歸檔 | 📦 Archived ||

---

## 📈 測試基線 (2026-08-12)

| 類別             | 結果                 |
| ---------------- | -------------------- |
| 後端單元/整合    | 640+ passed / 6 todo |
| 前端單元         | 163 passed           |
| E2E (Playwright) | 30 passed            |
| Simulator 專用   | 72 passed            |

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
- **Phase 5 後續改善計畫**: `PHASE_5_REMAINING_WORK.md` (單一真實來源)
- **高層概覽**: 本檔案 (MASTER_PLAN.md)
- **歸檔舊版**: `docs/plans/archive/2026-08-10_old_active/`
- **更新頻率**: 每 Sprint 結束或重大里程碑

> 詳細規劃、決策記錄、測試缺口、執行建議請參考 **UNIFIED_DEVELOPMENT_PLAN.md**  
> 後續改善項目請參考 **PHASE_5_REMAINING_WORK.md**
