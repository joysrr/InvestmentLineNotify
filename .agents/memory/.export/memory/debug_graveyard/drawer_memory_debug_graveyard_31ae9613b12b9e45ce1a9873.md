---
drawer_id: drawer_memory_debug_graveyard_31ae9613b12b9e45ce1a9873
wing: memory
room: debug_graveyard
exported_at: 2026-05-04T03:02:59.976Z
exported_by: mempalace-export.mjs (PROPOSAL_502_020 T-1)
---

nal[bool]
prior_art_report_path: Optional[str]
orchestrator_pattern_required: Optional[bool]
proposal_id: Optional[str]
proposal_path: Optional[str] # 5 並行 dim avg（auditor 子流程）
dim_1_avg: Optional[float]
dim_2_avg: Optional[float] # ...

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
```
