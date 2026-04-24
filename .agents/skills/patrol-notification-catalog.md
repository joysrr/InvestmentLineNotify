# Skill: Patrol Notification Catalog (@Assistant 巡邏規則 + 通知目錄)


## §A 巡邏規則表（P-01 ~ P-20）

| # | 掃描目標 | 偵測條件 | 通知類型 | 級別 | 阻斷新功能 |
|---|---|---|---|---|---|
| P-01 | `REVIEW_REPORT.md` | 複審 ≥ `REVIEW_CYCLE_LIMIT` 仍有 BLOCKER | `REVIEW_QUALITY` | 🔴 | ✅ |
| P-02 | `TEST_REPORT.md` | 重測 ≥ `QA_RETEST_LIMIT` 仍有 Bug | `QA_QUALITY` | 🔴 | ✅ |
| P-03 | `proposals/*.md` | `IN_PROGRESS` 超過任務週期未更新 | `RETRO_TIMEOUT` | 🟡 | ❌ |
| P-04 | `proposals/*.md` | `OPEN` 含 🚨 反覆問題警告 | `RETRO_REPEAT` | 🔴 | ✅ |
| P-05 | `proposals/*.md` | 任何 `OPEN` 新提案 | `RETRO_PROPOSAL` | 🟡 | ❌ |
| P-06 | `ADVICE_*.md` | 含 🚨 領域衝突警告且 strategyWeight 未填 | `CONSULTANT_CONFLICT` | 🔴 | ✅ |
| P-07 | `ADVICE_*.md` | 含 ⚠️ 未採納高風險建議 | `CONSULTANT_RISK` | 🔴 | ✅ |
| P-08 | `docs/api/*.md` | API 規格退回請求超過週期未回應 | `FRONTEND_API_BLOCK` | 🟡 | ❌ |
| P-09 | `REVIEW_REPORT.md` | 標記 Hotfix 且收斂文件未更新 | `HOTFIX_DOC_PENDING` | 🟡 | ❌ |
| P-10 | `PENDING_ACTIONS.md §豁免記錄` | 未歸檔豁免記錄 ≥ `EXEMPTION_AUDIT_THRESHOLD` | `EXEMPTION_ACCUMULATED` | 🟡 | ❌ |
| P-11 | `SECURITY_REPORT.md` | 複審 ≥ `REVIEW_CYCLE_LIMIT` 仍有 BLOCKER（共用 P-01 計數）| `SECURITY_AUDIT_FAIL` | 🔴 | ✅ |
| P-12 | `CURRENT_WORKSPACE` + `workspaces/` | workspace 缺失或欄位不完整 | `WORKSPACE_MISSING` | 🔴 | ✅ |
| P-13 | `docs/Reports/GLOBAL_STATUS_SUMMARY.md` | 摘要過期 > `SUMMARY_STALE_THRESHOLD` | `SUMMARY_STALE` | 🟢 | ❌ |
| P-14 | `proposals/completed/*.md` + `PROPOSAL_INDEX.md §🔗` | 意圖回退未標注繼承關係 | `PROPOSAL_INTENT_REGRESSION` | 🔴 | ✅ |
| P-15 | `AUDIT_HISTORY.md` | 任一維度分數 < `AUDIT_DIMENSION_MIN_SCORE` | `AUDIT_QUALITY` | 🟡 | ❌ |
| P-16 | `WORKSPACE_SCHEMA.yaml` + `workspaces/<active>.md` | workspace-schema-validator exit 2（required 欄位缺失）| `WORKSPACE_REQUIRED_MISSING` | 🔴 | ✅ |
| P-17 | `WORKSPACE_SCHEMA.yaml` + `workspaces/<active>.md` | workspace-schema-validator exit 1（recommended 欄位缺失）| `WORKSPACE_RECOMMENDED_MISSING` | 🟡 | ❌ |
| P-18 | `.agents/proposals/` + `workspaces/<*>/proposals/` | scope 欄位與儲存位置不符 / scope 欄位缺失 / project 提案缺前綴（依 `RULES_DESIGN_GUIDE §十七.E`）| `PROPOSAL_SCOPE_MISCLASSIFIED` | 🟡 | ❌ |
| P-19 | `PENDING_ACTIONS.md` 派發紀錄 + `SYSTEM_THRESHOLDS.MODEL_ROUTING` | 派發指令未含 Model: 欄位 / 模型與 complexity 評估不符 / force_complex_scenarios 場景未使用 complex | `MODEL_ROUTING_VIOLATION` | 🟡 | ❌ |
| P-20 | `PENDING_ACTIONS.md §LANE_ESCALATION_*` + `SYSTEM_THRESHOLDS.LANE_ROUTING` | 24 小時內同一類任務升級 ≥ 3 次 / 派發指令未含 Lane: 欄位 / force_complex 場景未走 heavy | `LANE_ESCALATION` | 🟡 | ❌ |

## §B 通知類型完整定義（簡要）

每個通知類型的處理指令、條件消失定義、阻斷語意，詳見 `assistant.md §s06 + §s15 + §s08`。

## §C 巡邏執行流程

```
@Lead 呼叫 @Assistant 巡邏
 ↓
依序掃描 P-01 ~ P-20
 ↓
每條規則：條件成立 → 寫入 PENDING_ACTIONS.md（避免重複）
 ↓
主動關閉掃描：條件消失 → 移至「最近已處理」
 ↓
回報新增 / 關閉筆數給 @Lead
```

## §D 重複偵測防呆

同一 `type` + 同一 `ref` 的未關閉項目 → 跳過不重複新增。

---

## Related Decisions

- [ADR-0029](../decisions/0029-assistant-patrol-catalog.md) — @Assistant 巡邏規則目錄
- [ADR-0030](../decisions/0030-notification-classification.md) — 通知分級標準
