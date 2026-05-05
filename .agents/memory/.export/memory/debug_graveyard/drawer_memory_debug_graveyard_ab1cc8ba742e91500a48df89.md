---
drawer_id: drawer_memory_debug_graveyard_ab1cc8ba742e91500a48df89
wing: memory
room: debug_graveyard
exported_at: 2026-05-04T03:02:59.963Z
exported_by: mempalace-export.mjs (PROPOSAL_502_020 T-1)
---

bug：`prior_art_scan_triggered`（HITL 不觸發）、`dim_1_avg`~`dim_5_avg`（auditor 5 並行 aggregate 抓不到）

## 根因

- `WorkflowState(TypedDict, total=False)` 宣告了部分欄位
- 即使 `total=False` 表示「所有欄位都可選」，**LangGraph 仍會過濾 schema 未宣告的 key**
- node 回傳 dict 中的未宣告 key 被 silently 丟掉
- conditional edge 讀不到→ 路由錯誤

## 解法

把所有 node 會寫入的 key **明確宣告**在 `WorkflowState`：

```python
class WorkflowState(TypedDict, total=False):
    # ... 既有欄位
    # 修：LangGraph 過濾未宣告欄位 → 旗標設了但 route 函數讀不到
    review_result: Optional[str]
    review_quality_violation: Optional[bool]
    security_result: Optional[str]
    qa_result: Optional[str]
    consultant_risk_level: Optional[str]
    prior_art_scan_triggered: Optional[bool]
    prior_art_report_path: Optional[str]
    orchestrator_pattern_required: Optional[bool]
```
