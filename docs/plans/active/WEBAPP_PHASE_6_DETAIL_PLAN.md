# WebApp Phase 6 品質硬化與技術債清理計畫

> 版本：v1.0
> 狀態：Active
> Branch：`phase-6`
> Baseline anchor：`9156e8a`
> 建立日期：2026-08-17

## 目標

建立可信品質基線，修復測試執行穩定性，降低 production source lint 噪音，補足核心業務分支測試，重新驗證探索式 QA。

## 已鎖定決策

| 決策          | 實際採用                                         |
| ------------- | ------------------------------------------------ |
| 主要目標      | 品質門檻達標，技術債與 Dogfood 一併處理          |
| Coverage 範圍 | Frontend / Backend 分開計算                      |
| Coverage 排除 | 只排除 generated code 與測試工具                 |
| Coverage 目標 | 全域 Branches ≥40%；核心模組 Branches ≥70%       |
| ESLint 目標   | production source 0 warnings；tests <20 warnings |
| Worker 驗收   | Frontend + Backend 完整測試各連續 3 次通過       |
| Dogfood 驗收  | Critical/High/Medium bugs = 0；Low 可記錄        |
| 執行順序      | Baseline → Worker → ESLint → Coverage → Dogfood  |
| 測試策略      | 每個 coverage 缺口採 RED → GREEN                 |
| Branch 策略   | 單一 `phase-6` branch；每階段一個 commit         |

## 階段與 Definition of Done

### 6.0 Baseline

- [x] `scripts/phase6-baseline.mjs` 可重複執行
- [x] `docs/performance/PHASE_6_BASELINE.md` 記錄 coverage、lint、測試時間、E2E、Dogfood、build、API health、git anchor
- [x] baseline script 不修改工作樹、不建立 commit、不啟動長駐服務

**結果**：Baseline commit `432d265`。Frontend Branches 24.31%、Backend Branches 63.24%、Frontend source 75 warnings、Backend source 219 warnings。

### 6.1 Worker 穩定性

- [x] Frontend 完整測試連續 3 次通過
- [x] Backend 完整測試連續 3 次通過
- [x] 每次記錄執行時間與 worker/unhandled error
- [x] 無證據時不修改 Vitest pool 設定

**結果**：Frontend 268 tests/run，115.71s、116.91s、117.02s；Backend API 149 tests/run，11.07s、11.11s、11.05s。3 次均無 worker/unhandled error。

### 6.2 ESLint

- [x] `webapp/src` production source：0 errors、0 warnings
- [x] tests：少於 20 warnings
- [x] generated coverage、dist、node_modules 不納入結果
- [x] 新增/修改檔案先通過 lint；完成後啟用 production source 全量 gate

**結果**：Frontend production source（排除 `src/test/**`）0 errors/0 warnings；Frontend tests 0 errors/13 warnings。清理 23 個 WebApp source 檔案，未修改產品行為，Frontend 268/268 tests 與 production build 通過。

### 6.3 Coverage

- [ ] Frontend 全域 Branches ≥40%
- [x] 核心 simulator module `SimulatorView.vue` Branches ≥70%
- [x] 核心 simulator module `SensitivityPanel.vue` Branches ≥70%
- [x] 核心 auth/data composables tested with behavior tests
- [x] `usePortfolioSnapshots.js` Branches ≥70%
- [x] `useEChartsInstance.js` Branches ≥70%
- [x] `MacroBattleView.vue` Branches ≥70%
- [x] `NewsView.vue` Branches ≥70%
- [x] `ChartView.vue` Branches ≥70%
- [x] `AccountView.vue` Branches ≥70%
- [ ] Frontend 全域 Branches ≥40%（目前 37.53%，大型 Views/panels 尚有缺口）
- [ ] Backend 另行記錄，不與 Frontend 合併
- [x] 每個新增缺口先寫行為測試並完成 RED → GREEN
- [x] 不為提高數字修改產品行為、刪除失敗測試或排除 source

**目前結果**：Frontend Lines 60.95%、Statements 57.48%、Functions 41.16%、Branches 37.53%。`useTelegram` all metrics 100%；`usePortfolioSnapshots` all metrics 100%；`useEChartsInstance` all metrics 100%，Branches 86.36%；`StrategyStatusView` Branches 74.03%；`ReportsView` Branches 64.34%；`MacroBattleView` Branches 71.60%；`NewsView` Branches 77.90%；`ChartView` Branches 70.06%；`AccountView` Branches 77.77%。

**未完成缺口**：全域 Branches 仍低於 40%，主要來自未充分測試的大型 Views、simulator panels 與 chart components；保留為後續 coverage slices，不降低門檻。

**RED → GREEN slices**：`useEChartsInstance`、`useTelegram`、`usePortfolioSnapshots`、`apiFetch` 401 retry、`SensitivityPanel`、`SimulatorView`。

核心模組：

- `webapp/src/api`
- `webapp/src/composables`
- simulator business logic
- strategy / decision logic
- backend monitoring / storage
- router guards

### 6.4 Dogfood

- [x] 修正 Dogfood 腳本與現行 port、endpoint、測試環境對齊
- [x] 不修改產品行為迎合報告
- [x] 重新執行並產生新報告
- [x] Critical/High/Medium/Low bugs = 0

**結果**：API 10/10、關鍵頁面 3/3；Critical 0、High 0、Medium 0、Low 0。報告：`dogfood-output/report.md`。腳本使用 readiness polling、`PORT=3000`、`BYPASS_INIT_DATA=true`，並以 process group cleanup 確認零殘留程序。

### 6.5 Performance baseline

- [x] Phase 6 baseline artifact 已建立於 `docs/performance/`
- [ ] Final comparison after all quality stages

**目前結果**：Frontend test suite 287 tests passed；production lint 0 warnings；build passed；Dogfood API 10/10、頁面 3/3 通過。

**Backend 驗證**：`src/api + src/modules` 單 worker 728/728 passed；完整 `src/test` assertions 1502 passed，但 Vitest worker 在 suite 結束時發生 native segmentation fault，暫不標記完整 Backend gate 通過，待獨立資源污染問題處理。

**Dogfood 產物**：報告與 screenshots 為 generated output，已留在本地驗證但不提交 Git。

## 檔案邊界

允許修改：

- `webapp/src`
- Backend source
- 相關 tests
- `vitest.config.mjs`、`webapp/vite.config.js`、ESLint config
- Dogfood scripts
- Phase 6 文件與 baseline artifacts

禁止：

- 為 coverage 修改產品行為
- 刪除或 skip 失敗測試
- 提交 generated output、coverage、screenshots
- 修改無關部署設定
- 無關重構或新增依賴

## Branch / Commit 規則

每個階段一個 commit，完成驗證後 push：

1. `chore: establish phase 6 baseline`
2. `test: verify phase 6 worker stability`
3. `chore: reduce phase 6 eslint warnings`
4. `test: raise phase 6 core coverage`
5. `test: reverify dogfood flows`

## 差距處理

若最高目標未達成：

- 不降低 threshold
- 不灌低價值測試
- 不排除 source 迎合數字
- 記錄實際差距、原因與後續 DEC

## 驗證命令

```bash
node scripts/phase6-baseline.mjs
cd webapp && npx vitest run
cd .. && npx vitest run src/api
```

## 歷史參考

舊版 Phase 6 計畫位於 `docs/plans/completed/PHASE_6_PLAN.md`，其中 baseline 數據已過期，不直接作為現況依據。
*"} เดิมพันฟรี? 在天天中彩票
rom pathlib import Path
p=Path('/workspace/projects/InvestmentLineNotify/docs/performance/PHASE_6_BASELINE.md')
p.parent.mkdir(parents=True, exist_ok=True)
p.write_text('''# Phase 6 Performance and Quality Baseline

> Baseline anchor: `9156e8a`
> Branch: `phase-6`
> Date: 2026-08-17
> Generated by: `node scripts/phase6-baseline.mjs`

## Metrics

| Metric                   | Value                        | Command / Source                              |
| ------------------------ | ---------------------------- | --------------------------------------------- |
| Git commit               | pending                      | `git rev-parse HEAD`                          |
| Frontend tests           | pending                      | `cd webapp && npx vitest run`                 |
| Backend tests            | pending                      | `npx vitest run src/api`                      |
| Frontend coverage        | pending                      | `cd webapp && npx vitest run --coverage`      |
| Backend coverage         | pending                      | `npx vitest run --coverage`                   |
| ESLint production source | pending                      | `cd webapp && npx eslint src`                 |
| ESLint tests             | pending                      | `cd webapp && npx eslint src/test`            |
| E2E tests                | 49/49 passed                 | Playwright run before Phase 6 branch          |
| Dogfood                  | stale report; pending re-run | `dogfood-output/report.md` uses old port 3001 |
| Frontend build size      | pending                      | `cd webapp && npm run build`                  |
| API health latency       | pending                      | `curl http://localhost:3000/health`           |

## Rules

- Frontend and Backend coverage remain separate.
- Only generated code and test utilities may be excluded.
- Baseline collection must not modify the worktree or create commits.
- E2E and Dogfood results are recorded separately; one does not replace the other.

## Notes

This document is intentionally created before collection. Replace `pending` values only with fresh command output from the baseline script.
''')
print(p)
PY
