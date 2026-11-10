---
type: plan
status: reference-only
last_updated: 2026-09-18
tags:
  - completed
  - archived
wiki_links: []
---

# MASTER PLAN v6.0

> **更新日期**: 2026-08-16  
> **核心原則**: 單一真實來源、Grill-Me 鎖定決策、Phase 分段驗收、歸檔即結案

---

## 🎯 當前執行焦點

### WebApp 系統性優化計畫（歷史總覽）

- **狀態**: superseded
- **實際後續證據**: [2026-09-10-WEBAPP_PHASE_6_DETAIL_PLAN.md](./2026-09-10-WEBAPP_PHASE_6_DETAIL_PLAN.md)
- **說明**: 原 v2.0 執行規格已由 Phase 6 實際基線取代。

### Phase 6: 品質硬化與技術債清理（已完成）

- **狀態**: ✅ Completed
- **實際證據**: [2026-09-10-WEBAPP_PHASE_6_DETAIL_PLAN.md](./2026-09-10-WEBAPP_PHASE_6_DETAIL_PLAN.md)
- **結果**: E2E 49/49、production lint 0 warnings、backend 1514 tests passed；後續 coverage slices 保留為需求驅動工作

### E2E 測試修正 (22→0)

- **狀態**: ✅ **Completed**
- **成果**: **49/49 passed**
- **歸檔**: `docs/plans/completed/2026-09-18-E2E_TEST_FIX_PLAN.md`

### Mini App Bug Fix

- **狀態**: ✅ Completed
- **目標**: HMAC 過期修正、API 部署同步、502 防護、UI 降級
- **歸檔**: `docs/plans/completed/2026-09-18-MINIAPP_BUG_FIX_PLAN.md`

---

## 📋 專案健康度總覽

| 領域                 | 當前狀態                                                                   | 目標           | 差距           |
| -------------------- | -------------------------------------------------------------------------- | -------------- | -------------- |
| **後端 API**         | ✅ 穩定 (149/149 tests)                                                    | 100% 綠燈      | 無             |
| **前端單元**         | ✅ 穩定 (212/212 tests)                                                    | 100% 綠燈      | 無             |
| **E2E (Playwright)** | ✅ **49/49 passed**                                                        | 100% 綠燈      | 無             |
| **打包體積 (gzip)**  | vendor-vue 47KB / vendor-element 335KB / vendor-echarts 185KB / index 70KB | < 300KB 總計   | Phase 1 完成   |
| **防禦網覆蓋**       | 13/13 Views (GlobalErrorBoundary)                                          | 100%           | Phase 2 完成   |
| **程式碼品質**       | ESLint 0 errors / 264 warnings                                             | 0 warnings     | Phase 6 規劃中 |
| **測試覆蓋率**       | Branch 61.08%                                                              | ≥ 70% (DEC-42) | Phase 6 規劃中 |

---

## 📁 文件索引

| 文件                                                  | 用途                      | 狀態              |
| ----------------------------------------------------- | ------------------------- | ----------------- |
| **2026-09-18-WEBAPP_SYSTEMATIC_OPTIMIZATION_PLAN.md** | 系統性優化歷史規格        | 📦 Superseded     |
| **2026-09-18-MASTER_PLAN.md** (本檔)                  | 歷史高層級概覽            | 📚 Reference-only |
| **2026-09-18-MINIAPP_BUG_FIX_PLAN.md**                | Mini App Bug Fix 完整記錄 | 📦 Completed      |
| **2026-09-18-E2E_TEST_FIX_PLAN.md**                   | E2E 22→0 修正記錄         | 📦 Completed      |
| **DEPLOYMENT_CHECKLIST.md**                           | 部署檢查清單              | 📦 Completed      |
| **2026-09-10-HARDCODED_AUDIT.md**                     | 硬編碼審計                | 📦 Completed      |

---

## 🔗 依賴關係圖

```
Mini App Bug Fix (完成)
    │
    ▼
WebApp 系統性優化 Phase 1-2 (完成)
    │
    ├── Phase 1: Code Splitting + ECharts tree-shaking
    │   └── 依賴: 無
    │
    ├── Phase 2: GlobalErrorBoundary 全覆蓋
    │   └── 依賴: Phase 1 (無直接依賴，可並行)
    │
    ├── Phase 3: 死碼評估 (暫緩 - YAGNI)
    │   └── 依賴: Phase 1-2
    │
    ├── Phase 4: useApiRequest 選用遷移 (選用制)
    │   └── 依賴: Phase 1-2
    │
    └── Phase 5: Hardcoded 維持原位 (結案)
        └── 依賴: 無

E2E 測試修正 22→0 (完成)
    │
    └── 修正測試期望對齊實際 UI 行為

Phase 6: 品質硬化 (規劃中)
    │
    ├── Coverage 門檻 ≥ 70%
    ├── ESLint 零警告
    └── 效能基準線建立
        └── 依賴: WebApp Phase 1-5
```

---

## 🛑 閘門條件

| 閘門   | 目標日期 | 條件                                  |
| ------ | -------- | ------------------------------------- |
| **G1** | Day 4    | Phase D E2E ≥ 8 tests、全測試通過     |
| **G2** | Day 7    | T-3.4 核心功能可用                    |
| **G3** | Day 8    | 技術債清單清零、Coverage 門檻生效     |
| **G4** | Day 10   | 生產級基礎設施就緒 (排程、監控、部署) |

---

## 📌 關鍵決策記錄 (ADR/DEC)

| 決策                            | 狀態 | 關聯文件                          |
| ------------------------------- | ---- | --------------------------------- |
| ADR-001: 後端負責回測           | ✅   | src/api/routes/backtestRoutes.mjs |
| ADR-002: Bull + Redis 佇列      | ✅   | ecosystem.config.cjs              |
| DEC-13/14/15: Asset Abstraction | ✅   | src/utils/assetRegistry.mjs       |
| DEC-42: Coverage 門檻 70%       | ⏳   | Phase 6 規劃中                    |

---

## 🚀 下一步行動

1. **歸檔 2026-09-18-WEBAPP_SYSTEMATIC_OPTIMIZATION_PLAN.md v2.0** → completed/ ✅
2. **Phase 3-5 完成**：N1 useApiRequest、N3 ECharts composable、N4 GlobalErrorBoundary tests、N5 MSW 評估 ✅
3. **開始 Phase 6 規劃** (Coverage 70% / ESLint 0 warnings)
