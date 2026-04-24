# Skill: @Reviewer + @Security 邊界協調 Few-Shot 範例（3 組）

> 補強既有 `reviewer-examples.md` / `security-examples.md` 獨立 examples 未涵蓋的**跨 Agent 邊界協調**情境。

## 範例 1：純前端調整（@Reviewer 獨佔，@Security 不介入）

**情境**：修改 `webapp/src/views/DashboardView.vue` 的按鈕顏色從藍色改為橘紅色

**@Lead 派發決策**（對齐 `tasks/lane-routing-task-classification.md` 20 項指標）：
- 觸發指標：僅第 18 項（CSS 顏色微調）
- complexity = simple；Lane = fast；Model = haiku
- **不觸發 `skills/security-audit.md §1` 任一 SC-XX** → @Security 不介入

```
Next: @Frontend
Model: haiku
Lane: fast
Tech-stacks: vue3-vite, vue3-component-pattern
Artifacts: webapp/src/views/DashboardView.vue
```

**審查階段派發**（完成後）：
```
Next: @Reviewer（獨佔）
Model: sonnet
Lane: standard
Artifacts: webapp/src/views/DashboardView.vue, REVIEW_REPORT.md
範疇：純前端 ThemeParams 合規 + 無業務邏輯變更
注：本任務不觸發資安範疇，@Security 不派發
```

**產出物**：
- `REVIEW_REPORT.md`（由 @Reviewer 產出）→ ✅ 通過
- **無 SECURITY_REPORT.md**（@Security 未介入）

**關鍵遵循**：
- @Lead 派發前判斷 SC-XX → 無觸發 → 跳過 @Security（對齊 `skills/security-audit.md §1`）
- @Security 若被派發將視為越界（依 `security.md §s02 審查職責邊界`）
- 本案例符合快車道分流（PROPOSAL_032）

---

## 範例 2：API endpoint 新增（雙審 + 安全仲裁優先）

**情境**：新增 `/api/strategy/update` endpoint 用於寫入 `strategyWeight`

**@Lead 派發決策**：
- 觸發指標：第 3 項（外部 API）+ 第 6 項（API 合約變更）+ **第 10 項（身分驗證）**
- complexity = complex；Lane = heavy；Model = opus
- **force_complex_scenarios 觸發**（strategyWeight 異動）
- @Security 強制介入 SC-01（initData 時效）+ SC-03（strategyWeight 異動）+ SC-05（新 API 授權）

```
Next: @Architect（先設計）
Model: opus
Lane: heavy
Tech-stacks: nodejs-esm-backend, telegram-miniapp-sdk
Artifacts: docs/api/strategy-update.md
注：涉及 strategyWeight → 必升級 User 後續 @Backend 執行
```

**平行審查階段**（@Reviewer 與 @Security 同時派發）：

```
Next: @Reviewer（與 @Security 平行）
Model: sonnet
Lane: heavy
Artifacts: src/api/routes/strategyUpdate.mjs, REVIEW_REPORT.md
範疇：程式碼品質 + API 合約實作（**不含**金鑰 / Token / 授權，已由 @Security 負責）

Next: @Security（與 @Reviewer 平行）
Model: opus
Lane: heavy
Artifacts: src/api/middleware/initDataGuard.mjs, src/api/routes/strategyUpdate.mjs, SECURITY_REPORT.md
觸發範疇：SC-01 initData 時效 + SC-03 strategyWeight 路徑 + SC-05 新 API 授權
```

**衝突仲裁情境**（依 `lead.md §s06 平行審查與衝突仲裁規則` 防線 3）：

假設產出結果：
- **REVIEW_REPORT.md**：✅ 通過（程式碼品質無問題）
- **SECURITY_REPORT.md**：🔴 BLOCKER（initData `auth_date` 時效檢查缺失）

**@Lead 仲裁決策**：
```
仲裁結果：以 SECURITY_REPORT 為終態
理由：防線 3「安全優先」原則（安全 > 效能、安全 > 可讀性）
退件：@Backend 修正 initData 時效驗證
複審計數：1/REVIEW_CYCLE_LIMIT（@Reviewer 與 @Security 共用計數）
User 標準指令（若最終失敗）：`重新評估實作方案 strategy-update`
```

**關鍵遵循**：
- 平行派發而非序列（對齐 PROPOSAL-020 第 6 / 6.5 階段）
- 衝突時安全優先（防線 3）
- 複審計數 `REVIEW_CYCLE_LIMIT` 共用（依 `RULES_DESIGN_GUIDE §十四`）
- @Reviewer **絕對禁止**審查金鑰 / Token / 授權（防線 1 職責互斥）

---

## 範例 3：strategyWeight 異動（@Security 獨佔 + 強制升級 User）

**情境**：單純修改 `data/Strategy.json` 中的 strategyWeight 數值（不涉及新 API / UI）

**@Lead 派發決策**：
- 觸發指標：**第 10 項資安 + PROPOSAL_024 force_complex_scenarios**
- complexity = complex；Lane = heavy；Model = opus
- 必升級 User（依 `lead.md §s_state_anchor` + `tasks/exemption-approval-workflow.md §豁免授權邊界` 第 1 條）

**升級 User 流程**（對齊 `system-prompt.md §全局緊急阻斷` 條件三）：
```
🚨 strategyWeight 異動請求

觸發條件：data/Strategy.json 數值變更
必要流程（對齐 consultant.md §核心禁止條款）：
 1. @Consultant 戰略審查 → ADVICE_*.md
 2. @Lead 確認 ADVICE 內「已填寫 strategyWeight」欄位
 3. User 明確授權（例：`確認接受風險 ADVICE_strategyweight_update.md`）
 4. @Backend 執行寫入

當前阻斷：等待 User 授權

User 標準指令（對齐 skills/assistant-user-commands.md P-07）：
 `確認接受風險 ADVICE_strategyweight_update.md`
 或 `退回修改需求 strategyweight-update`
```

**審查階段派發**（User 授權後）：

```
Next: @Security（獨佔 — @Reviewer 禁止越界審查 strategyWeight）
Model: opus
Lane: heavy
Artifacts: data/Strategy.json, src/modules/strategy/weightWriter.mjs, SECURITY_REPORT.md
觸發範疇：SC-03（strategyWeight 異動路徑零容忍）+ SC-06（File Lock TOCTOU 防護）
補強：執行前後讀取舊值 + 寫入 audit_log.jsonl（對齊 skills/strategyweight-change-checklist.md）
```

**@Reviewer 不介入**（職責互斥）：
```
@Lead 於 REVIEW_REPORT.md 附註：
「本任務觸發 SC-03 strategyWeight 異動路徑 → 完整移交 @Security
@Reviewer 跳過；無 REVIEW_REPORT 產出」
```

**產出物**：
- ✅ **SECURITY_REPORT.md**（由 @Security 產出）
- **無 REVIEW_REPORT.md**（@Reviewer 不介入 strategyWeight 審查）
- `audit_log.jsonl` append 一行（寫入時機：@Backend 執行時自動）

**關鍵遵循**：
- strategyWeight 屬於 SC-03 範疇，**@Reviewer 絕對禁止**審查（`reviewer.md §s07` 明文 + PROPOSAL-020 範疇移交）
- @Lead 無權單獨授權（`tasks/exemption-approval-workflow.md §豁免授權邊界`）
- 強制 Model: opus + Lane: heavy（PROPOSAL_024 `force_complex_scenarios`）
- 即使審查通過，實際寫入前仍需 User 明確授權（`consultant.md §核心禁止條款`）

---

## 對齐的既有規則

- `lead.md §s06 平行審查與衝突仲裁規則` 防線 1-4
- `security.md §s02 審查職責邊界`（SC-01~SC-11 完整移交）
- `reviewer.md §s07` + PROPOSAL-020 範疇移交註記
- `skills/security-audit.md §1` SC-XX 觸發清單
- `tasks/lane-routing-task-classification.md` 20 項指標
- `tasks/exemption-approval-workflow.md §豁免授權邊界`
- `consultant.md §核心禁止條款` strategyWeight 流程
- `SYSTEM_THRESHOLDS.yaml MODEL_ROUTING.force_complex_scenarios`
- `skills/assistant-user-commands.md` P-07 / P-11 指令

## 溯源

本檔案為 PROPOSAL_20260422_030 新建；補強 `reviewer-examples.md` / `security-examples.md` 獨立版未涵蓋的跨 Agent 邊界協調情境（依 @Auditor 第三次評審 Dim 1.3 建議）。

---

## Related Decisions

- [ADR-0010](../decisions/0010-parallel-review.md) — 平行審查制度
- [ADR-0011](../decisions/0011-security-conditional-intervention.md) — @Security 條件式介入（SC-01~10）
