# 文件系統整理計畫

**建立日期**: 2026-09-10  
**狀態**: 🔜 待開始  
**目標**: 整理過時文件、更新現有文件、建立清晰的文件結構

---

## 📊 現況盤點

### 總體統計

- **總文件數**: 141 個 .md 文件
  - docs/ 目錄: 133 個
  - 根目錄: 8 個
- **超過 60 天未更新**: 約 80+ 個文件
- **文件總大小**: ~1.2 MB

### 按類別分布

| 類別                                               | 數量          | 狀態      | 備註                     |
| -------------------------------------------------- | ------------- | --------- | ------------------------ |
| **completed** (已完成計畫)                         | 32 個         | ⚠️ 需歸檔 | 大量已完成的計畫文件堆積 |
| **archive** (舊歸檔)                               | 25 個         | ✅ 已歸檔 | 2026-04 ~ 2026-08 舊計畫 |
| **modules** (模組文件)                             | 26 個         | ⚠️ 需審查 | 部分可能過時             |
| **Reports** (報告)                                 | 13 個         | ⚠️ 需審查 | 審計、測試報告混雜       |
| **plans/backlog**                                  | 4 個          | ✅ OK     | 待規劃功能               |
| **plans/active**                                   | 1 個 (本文件) | ✅ OK     | 當前活躍計畫             |
| **根目錄**                                         | 8 個          | ⚠️ 需整理 | 部分重複/過時            |
| **其他** (api, architecture, decisions, design 等) | 32 個         | ⚠️ 需審查 | 散落在不同子目錄         |

---

## 🎯 整理目標

### 1. 結構重組

- ✅ 保留清晰的模組化文件結構
- 🔄 合併重複內容
- 📦 歸檔過時文件
- 🗑️ 刪除無用文件

### 2. 內容更新

- 確保技術文件反映當前實作狀態（例如：Langfuse v5）
- 更新部署指南、測試指南
- 更新 API 合約文件

### 3. 可維護性

- 建立文件更新 checklist
- 定義文件生命週期管理規則
- README 引導使用者找到正確文件

---

## 📋 分階段執行計畫

### Phase 1: 根目錄清理 (1-2h)

**目標**: 精簡根目錄，保留關鍵入口文件

#### 1.1 保留文件

- ✅ `README.md` - 專案主入口
- ✅ `CHANGELOG.md` - 版本變更記錄
- ✅ `SOUL.md` - Agent 行為準則

#### 1.2 需審查文件

- ⚠️ `AGENTS.md` (2.2KB, 2026-08-09)
  - 內容: gitnexus:start 標記，可能是 agent 協作相關
  - **決策**: 檢查是否仍在使用，考慮移至 docs/operations/

- ⚠️ `CLAUDE.md` (2.2KB, 2026-08-09)
  - 內容: 與 AGENTS.md 相同，可能重複
  - **決策**: 檢查用途，合併或刪除

- ⚠️ `PENDING_ACTIONS.md` (6.7KB, 2026-08-09)
  - 內容: 待辦事項清單
  - **決策**: 檢查是否已完成，移至 docs/plans/backlog/ 或刪除

- ⚠️ `TEST_REPORT.md` (3KB, 2026-08-09)
  - 內容: 測試結論報告
  - **決策**: 移至 docs/Reports/ 或歸檔

- ⚠️ `TEST_VERIFICATION_PLAN.md` (17.5KB, 2026-08-09)
  - 內容: 測試驗證計畫
  - **決策**: 檢查是否完成，移至 docs/plans/completed/ 或保留在根目錄

#### 1.3 預期結果

根目錄保留 3-5 個核心文件，其餘移至適當子目錄。

---

### Phase 2: Plans 目錄整理 (2-3h)

**目標**: 清理已完成計畫，保持 active/ 目錄乾淨

#### 2.1 completed/ 目錄 (32 個文件)

**問題**: 大量已完成計畫堆積，難以查找歷史決策

**策略**:

1. 按完成時間分組歸檔
2. 保留近 3 個月的重要計畫在 completed/
3. 3 個月以上移至 archive/YYYY-MM/

**文件清單** (部分):

- `LANGFUSE_V5_MIGRATION_PLAN.md` - ✅ 剛完成 (2026-09-09)
- `PHASE2_SPEC_V5.md` - ✅ 剛完成 (2026-09-09)
- `PHASE3_SCORE_MIGRATION_SPEC.md` - ✅ 剛完成 (2026-09-09)
- `E2E_TESTING_PLAN_v2.0_20260815.md` - ⚠️ 2026-08-15，考慮歸檔
- `PHASE_6_PLAN.md` - ⚠️ 需確認完成時間
- `PHASE_7_PLAN.md` - ⚠️ 需確認完成時間
- `WEBAPP_*.md` (多個) - ⚠️ WebApp 相關計畫，需檢查狀態
- ... 還有 20+ 個

**行動**:

```
completed/
├── 2026-09/  (保留最近)
│   ├── LANGFUSE_V5_MIGRATION_PLAN.md
│   ├── PHASE2_SPEC_V5.md
│   └── PHASE3_SCORE_MIGRATION_SPEC.md
└── → 移至 archive/2026-08/ (其餘)
    ├── E2E_TESTING_PLAN_v2.0_20260815.md
    ├── PHASE_6_PLAN.md
    └── ...
```

#### 2.2 archive/ 目錄 (25 個文件)

**現狀**: 已有良好結構

- `2026-04_remediation_advice/` (3 個)
- `2026-07_completed/` (3 個)
- `2026-08-10_old_active/` (8 個)
- `2026-08-12_phase2_plans/` (4 個)
- `diagnosis/` (9 個階段診斷文件)

**決策**: ✅ 保持現有結構，不需變動

#### 2.3 backlog/ 目錄 (4 個文件)

- `ideas_features.md` - 功能點子
- `preplan_features.md` - 待規劃功能
- `preplan_interface.md` - 介面規劃
- `system_optimize_suggest.md` - 系統優化建議

**決策**: ✅ 保留，這些是有效的 backlog

#### 2.4 active/ 目錄

**目標**: 永遠保持清空或只有 1-3 個活躍計畫

**當前**: 1 個 (本文件)  
**決策**: ✅ 維持此狀態

---

### Phase 3: Modules 文件更新 (3-4h)

**目標**: 更新模組文件，反映當前架構與實作

#### 3.1 需要更新的模組

**ai_news/** (7 個文件)

- ⚠️ `integrations/langfuse_*.md` (3 個) - 需確認是否更新至 Langfuse v5
- ⚠️ `ai_pipeline.md` - 檢查是否反映當前 AI 流程
- ⚠️ `news_fetcher.md` - 檢查是否包含最新新聞採集邏輯
- ✅ `keyword_config.md` - 關鍵字配置（應該相對穩定）

**strategy/** (9 個文件)

- ⚠️ `strategy_engine.md` - 核心策略引擎文件，需確認是否最新
- ⚠️ `lifecycle_engine.md` - 生命週期引擎
- ⚠️ `providers.md` - 資料提供者
- ⚠️ `regime_policy.md` - 市場狀態政策
- ⚠️ `maintenance_state_machine.md` - 維護狀態機
- ⚠️ `audit/` (2 個) - 策略參數審計記錄

**presentation/** (4 個文件)

- ⚠️ `bot.md` - Telegram Bot (需確認指令是否完整)
- ⚠️ `api/portfolio_health_api.md` - API 文件
- ⚠️ `notifications.md` - 通知模組

**infrastructure/** (3 個文件)

- ⚠️ `data_manager.md`
- ⚠️ `storage.md`

**operations/** (3 個文件)

- ⚠️ `deployment_oracle_vm.md` - 部署指南
- ⚠️ `env_vars.md` - 環境變數 (需確認 Langfuse v5 變數)
- ⚠️ `schedules.md` - Cron 排程

#### 3.2 更新策略

對每個模組文件：

1. **驗證**: 檢查文件描述是否與當前代碼一致
2. **更新**: 修正過時內容
3. **標記**: 添加 `最後更新: YYYY-MM-DD` 標記
4. **刪除**: 如果模組已不存在，移至 archive/deprecated/

#### 3.3 預期產出

- 每個模組都有準確的 `_index.md` 總覽
- 技術細節與代碼實作同步
- 清楚標示最後審查日期

---

### Phase 4: Reports 目錄整理 (1h)

**目標**: 清理審計報告、測試報告，建立歷史歸檔

#### 4.1 當前文件 (13 個)

**審計類**:

- `AUDIT_DECISION_LOG.md`
- `AUDIT_HISTORY.md`
- `DoD_AUDIT_LOG.md`
- `agents_overview.md`
- `archive/agents_audit_report_202604.md`

**測試類**:

- `TEST_MAPPING.md`
- `TEST_REPORT.md`

**代碼審查類**:

- `REVIEW_REPORT.md`
- `archive/code_review_20260428.md`
- `archive/main_code_review_20260429.md`
- `archive/perplexity_code_review_20260426.md`

**其他**:

- `GLOBAL_STATUS_SUMMARY.md`
- `security_report.md`
- `archive/leverage_strategy_review_v2.3.md`
- `archive/strategy_review_20260417.md`

#### 4.2 整理策略

1. **保留**: 最新的狀態摘要
   - `GLOBAL_STATUS_SUMMARY.md` (如果最新)
   - `security_report.md` (如果最新)

2. **歸檔**: 所有帶時間戳的報告
   - 按 YYYY-MM 分組
   - 移至 `archive/reports/YYYY-MM/`

3. **決策日誌**: 考慮整合
   - `AUDIT_DECISION_LOG.md` 可能與 ADR/DEC 重複
   - 評估是否合併至 `docs/decisions/`

#### 4.3 預期結果

```
Reports/
├── CURRENT_STATUS.md  (最新狀態摘要)
├── SECURITY_REPORT.md (最新安全報告)
└── archive/
    ├── 2026-04/
    ├── 2026-05/
    └── ...
```

---

### Phase 5: 其他目錄整理 (1-2h)

#### 5.1 docs/ 根目錄文件 (11 個)

- `API_CONTRACT.md` - ⚠️ 檢查是否最新
- `DEPLOYMENT_CHECKLIST.md` - ⚠️ 更新部署步驟
- `E2E_TESTING_GUIDE.md` - ⚠️ 檢查是否包含最新 E2E 實踐
- `TESTING.md` - ⚠️ 與 TEST_SPEC_*.md 可能重複
- `TEST_SPEC_strategyEngine.md` - ⚠️ 策略引擎測試規格
- `TEST_TROUBLESHOOTING.md` - ⚠️ 測試除錯指南
- `SCHEDULER_COUPLING_ANALYSIS.md` - ⚠️ 排程器耦合分析 (可能過時)
- `SYSTEM_E2E_BUILD_PROCESS.md` - ⚠️ E2E 構建流程
- `useApiRequest-guide.md` - ⚠️ API 請求指南 (前端?)

**策略**:

- 測試相關 → 移至 `docs/testing/`
- API 相關 → 移至 `docs/api/`
- 部署相關 → 移至 `docs/operations/`

#### 5.2 architecture/ (4 個)

- `DEC-004-backtest-scheduler-automation.md`
- `DEC-005-monitoring-alerting.md`
- `DEC-006-deployment-automation.md`
- `backtest_engine_design.md`

**決策**: ✅ 保留，這些是架構決策記錄

#### 5.3 decisions/ (1 個)

- `DEC-016-vitest-worker-crash.md`

**決策**: ✅ 保留

#### 5.4 design/ (1 個)

- `BUDGET_PRIORITY_DESIGN.md`

**決策**: ✅ 保留，這是重要的設計文件

#### 5.5 api/ (2 個)

- `decision-chain_api.md`
- (modules/presentation/api/ 下還有 2 個)

**策略**: 考慮合併所有 API 文件至 `docs/api/`

#### 5.6 performance/ (1 個)

- `PHASE_6_BASELINE.md`

**決策**: ⚠️ 檢查是否為最新基準，考慮移至 Reports/archive/

#### 5.7 verification/ (3 個)

- `CORE_LOGIC_DATA_FLOW_MATRIX.md`
- `CORE_LOGIC_FINDINGS.md`
- `CORE_LOGIC_REPLAY_RESULTS.md`

**決策**: ⚠️ 驗證結果，考慮移至 Reports/archive/ 或 plans/completed/

---

## 🎯 預期文件結構 (整理後)

```
/
├── README.md              # 專案主入口
├── CHANGELOG.md           # 版本記錄
├── SOUL.md                # Agent 準則
│
├── docs/
│   ├── api/               # API 文件集中
│   │   ├── README.md
│   │   ├── API_CONTRACT.md
│   │   ├── portfolio_health_api.md
│   │   └── decision-chain_api.md
│   │
│   ├── architecture/      # 架構決策記錄 (ADR)
│   │   ├── README.md
│   │   ├── DEC-004-backtest-scheduler-automation.md
│   │   ├── DEC-005-monitoring-alerting.md
│   │   └── DEC-006-deployment-automation.md
│   │
│   ├── decisions/         # 技術決策記錄
│   │   └── DEC-016-vitest-worker-crash.md
│   │
│   ├── design/            # 設計文件
│   │   ├── README.md
│   │   └── BUDGET_PRIORITY_DESIGN.md
│   │
│   ├── modules/           # 模組文件 (保持現有結構)
│   │   ├── README.md
│   │   ├── ai_news/
│   │   ├── infrastructure/
│   │   ├── operations/
│   │   ├── presentation/
│   │   └── strategy/
│   │
│   ├── testing/           # 測試文件集中
│   │   ├── README.md
│   │   ├── E2E_TESTING_GUIDE.md
│   │   ├── TESTING.md
│   │   ├── TEST_TROUBLESHOOTING.md
│   │   └── strategyEngine_TEST_SPEC.md
│   │
│   ├── operations/        # 運維文件
│   │   ├── README.md
│   │   ├── DEPLOYMENT_CHECKLIST.md
│   │   └── SYSTEM_E2E_BUILD_PROCESS.md
│   │
│   ├── Reports/           # 報告 (僅最新)
│   │   ├── CURRENT_STATUS.md
│   │   ├── SECURITY_REPORT.md
│   │   └── archive/       # 歷史報告歸檔
│   │       ├── 2026-04/
│   │       ├── 2026-05/
│   │       └── ...
│   │
│   └── plans/
│       ├── active/        # 當前活躍計畫 (0-3 個)
│       ├── backlog/       # 待規劃功能
│       ├── completed/     # 近期完成 (近 3 個月)
│       │   └── 2026-09/
│       └── archive/       # 歷史計畫歸檔
│           ├── 2026-04_remediation_advice/
│           ├── 2026-07_completed/
│           ├── 2026-08-10_old_active/
│           ├── 2026-08-12_phase2_plans/
│           ├── 2026-08/   # 新增: 8月完成的計畫
│           └── diagnosis/
```

---

## ✅ 驗收標準

### Phase 1 完成標準

- [ ] 根目錄保留 ≤ 5 個 .md 文件
- [ ] 所有移動的文件在新位置可正常訪問
- [ ] README.md 更新文件導航連結

### Phase 2 完成標準

- [ ] plans/completed/ 僅保留近 3 個月文件
- [ ] 舊文件已按月份歸檔至 archive/
- [ ] plans/active/ 保持清空狀態 (除本計畫外)

### Phase 3 完成標準

- [ ] 每個模組文件都有 `最後更新: YYYY-MM-DD` 標記
- [ ] Langfuse v5 相關文件已更新
- [ ] 所有 `_index.md` 反映當前模組狀態

### Phase 4 完成標準

- [ ] Reports/ 僅保留 2-3 個最新報告
- [ ] 歷史報告已按月份歸檔
- [ ] 重複的審計日誌已合併

### Phase 5 完成標準

- [ ] docs/ 根目錄文件 ≤ 3 個
- [ ] API 文件集中至 docs/api/
- [ ] 測試文件集中至 docs/testing/
- [ ] 運維文件集中至 docs/operations/

### 總體驗收

- [ ] 所有文件移動都有 git commit 記錄
- [ ] 無損失或誤刪重要文件
- [ ] 文件總數減少 30-40%
- [ ] 新結構在 README.md 中有清晰導航

---

## 📅 執行時程

| Phase                 | 預估時間 | 累積時間 | 備註                   |
| --------------------- | -------- | -------- | ---------------------- |
| Phase 1: 根目錄清理   | 1-2h     | 1-2h     | 低風險，可先執行       |
| Phase 2: Plans 整理   | 2-3h     | 3-5h     | 需仔細檢查每個計畫狀態 |
| Phase 3: Modules 更新 | 3-4h     | 6-9h     | 最耗時，需驗證代碼     |
| Phase 4: Reports 整理 | 1h       | 7-10h    | 機械性工作             |
| Phase 5: 其他目錄     | 1-2h     | 8-12h    | 收尾工作               |

**總預估**: 8-12 小時

**建議分批執行**:

- Session 1: Phase 1 + Phase 2 (3-5h)
- Session 2: Phase 3 (3-4h)
- Session 3: Phase 4 + Phase 5 (2-3h)

---

## 🔄 後續維護規則

### 文件生命週期管理

1. **新文件規則**
   - 所有新文件必須放在適當分類目錄
   - 根目錄禁止新增 .md 文件 (除非經過討論)
   - 所有文件必須包含建立日期

2. **計畫文件規則**
   - active/ 最多同時 3 個活躍計畫
   - 計畫完成後 7 天內移至 completed/
   - completed/ 中超過 3 個月的文件每季度歸檔一次

3. **模組文件規則**
   - 重大代碼變更時必須同步更新相關文件
   - 每個模組的 `_index.md` 必須列出所有子文件
   - 每次更新必須更新 `最後更新` 日期

4. **報告文件規則**
   - 測試報告、審計報告在新報告產生後 30 天歸檔
   - 保留 "CURRENT_*" 命名的最新摘要
   - 歷史報告按月份歸檔

5. **刪除原則**
   - 永不直接刪除，先移至 archive/deprecated/
   - 在 deprecated/ 停留 6 個月後可安全刪除
   - 刪除前必須確認無其他文件引用

---

## 📌 注意事項

1. **執行前備份**
   - 建立 git branch: `docs/cleanup-2026-09`
   - 每個 Phase 完成後 commit
   - 全部完成後再 merge 到 main

2. **影響評估**
   - 檢查是否有外部連結指向移動的文件
   - 檢查 CI/CD 腳本是否引用文件路徑
   - 檢查 README.md 中的連結

3. **團隊協作**
   - 如果是多人專案，需通知團隊文件結構變更
   - 提供舊路徑 → 新路徑對照表

4. **回滾計畫**
   - 保留完整 git history
   - 如有問題可快速 revert
   - 分 Phase commit 便於定位問題

---

## 🚀 開始執行

**當前狀態**: 🔜 待開始

執行時請依序完成各 Phase，並在此更新進度：

- [ ] Phase 1: 根目錄清理
- [ ] Phase 2: Plans 目錄整理
- [ ] Phase 3: Modules 文件更新
- [ ] Phase 4: Reports 目錄整理
- [ ] Phase 5: 其他目錄整理
- [ ] 最終驗收
- [ ] 更新 README.md 文件導航

---

**最後更新**: 2026-09-10  
**負責人**: Hermes Agent + Han
