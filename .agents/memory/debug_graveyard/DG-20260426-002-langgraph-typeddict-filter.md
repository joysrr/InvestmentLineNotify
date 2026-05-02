---
room: debug_graveyard
incident_id: DG-20260426-002
date: 2026-04-26
category: api_limit
severity: major
agents_involved: [@Backend]
related_proposal: PROPOSAL_20260425_002
related_files:
  - poc/langgraph-mcp/state.py
  - poc/langgraph-mcp/graph.py
fix_commit: d2c1870
---

# LangGraph TypedDict total=False 仍會過濾未宣告欄位

## 症狀

- POC 加了 `review_quality_violation: bool` flag 想讓 reviewer 達 limit 後跳出
- node 回傳的 dict 含 `{"review_quality_violation": True, ...}`
- conditional edge 函式 `route_after_reviewer` 讀 `state.get("review_quality_violation")` → 永遠是 None
- → reviewer 永遠進入 backend 重做迴圈（cycle 上限失效）
- 同樣 bug：`prior_art_scan_triggered`（HITL 不觸發）、`dim_1_avg`~`dim_5_avg`（auditor 5 並行 aggregate 抓不到）

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
    proposal_id: Optional[str]
    proposal_path: Optional[str]
    # 5 並行 dim avg（auditor 子流程）
    dim_1_avg: Optional[float]
    dim_2_avg: Optional[float]
    # ...
```

## 教訓（避免再犯）

- ❌ 假設 `TypedDict total=False` 就能塞任何 key 進 LangGraph state
- ❌ 「先實作；之後缺什麼再加 schema」── 此 framework 必先 schema 完整
- ✅ 先列舉所有 node 可能寫入的 key，**全部**加進 WorkflowState
- ✅ 加 unit test：每個 node 回傳 dict 的 key 都應在 schema 內（CI 可自動掃）
- ✅ Conditional edge 的判斷欄位**特別**檢查（這些是路由命脈）

## 相似 pattern 警示

LangGraph 同類型陷阱：

- Reducer 沒設定的欄位 → 後寫覆蓋前寫（不會累積）
- `Annotated[list, operator.add]` 才能讓 list reducer 累積
- Channel 自訂 reducer 要在 schema 宣告型別

**判斷簡則**：要塞進 LangGraph state 的東西，先想「這欄位有沒有在 TypedDict 裡？」「reducer 是 set or add？」

<!-- END: DG-20260426-002 -->
