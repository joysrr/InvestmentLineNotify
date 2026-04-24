# Skill: Stateless Routing Pattern (@Lead 無狀態路由模板)

> 定義 @Lead 無狀態路由三鐵律的完整實作細節，供 `lead.md §s_state_anchor` 引用。

## 三大鐵律

### 1. 強制狀態讀取（State-Driven）
- 每次對話開始必讀 `PENDING_ACTIONS.md §🎯 工作流狀態錨點`
- 依 `[CURRENT_STAGE]` 直接 lookup §s05 10 階段表
- **絕對禁止** 推論中回顧或預測超過 1 步

### 2. 禁止文本合併（No Content Merging）
- 僅掃描符號（🔴 BLOCKER 等），不讀完整報告內容
- 退件時僅傳檔案路徑 list 給 @Backend / @Frontend
- **絕對禁止** 對話中引用報告原文

### 3. 短指令交接（Short Command Handoff）
- 三類內容：PROJECT_CONTEXT 路徑 / Artifact Paths / 3 行內下一步指令
- **絕對禁止** 交接指令 > 5 行純文字
- 對應 Gate Check 輸出：`✅ Gate Check ✔ S<X>→S<Y>` + `Next: @<Agent> | Artifacts: <paths>`

## 缺失判斷備案（Fallback，依 PROPOSAL_20260422_002 + 014）

workspace 缺失時依 §3.4 分級動作表執行；參照 `lead.md §s_state_anchor §6.1`。

## 派發子 Agent 的 tech-stack 注入規則

`@Lead` 派發涉及 tech-stacks 引用的任務給子 Agent 時（`@Backend` / `@Frontend` / `@Reviewer` / `@QA` 等），**必須**依下列規則注入 workspace 欄位：

### A. 派發前檢查

1. 依 `resources` mapping 表識別本次任務應引用的 tech-stacks 清單
2. 對每份 tech-stacks 讀取其 `§專案特化參照` 表格，取得所需的 workspace 欄位清單
3. 從當前 `CURRENT_WORKSPACE` 對應 workspace md 抽取對應欄位實值
4. 若**任一 required 欄位缺失** → 依 `WORKSPACE_SCHEMA.yaml` 標記的 required 強制阻斷；執行 Fallback 策略

### B. 注入格式

派發指令中，將 workspace 欄位實值以 **`【WORKSPACE】`** 區塊明示：

```
Next: @Backend
Tech-stacks: file-based-storage, nodejs-esm-backend
Artifacts: src/modules/storage.mjs

【WORKSPACE 注入】
- PATHS.data_root: data/
- PATHS.source_modules.storage: src/modules/storage.mjs
- PATHS.source_modules.concurrency: src/modules/bot/runnerLock.mjs
- DEPLOYMENT_CONSTRAINTS.memory: 24GB
```

### C. Fallback 分級（對齊 tech-stacks `§專案特化參照` 表）

| 缺失欄位類型 | @Lead 動作 |
|------------|-----------|
| tech-stacks 表列「阻斷」類別 | 🔴 阻斷派發，要求 User 補齊 workspace 欄位 |
| tech-stacks 表列「升級」類別 | 🟡 升級 User 確認是否派生「請先建立該模組」前置任務 |
| tech-stacks 表列「警告降級」類別 | 🟡 注入預設值 + 警告註記，允許任務進行 |
| tech-stacks 表列「略過」類別 | ⚪ 不注入，正常派發 |

### D. 違反判定

- `@Lead` 派發時未執行注入 → `@Auditor §2.2` WORKSPACE_SCHEMA 完整性扣分
- 派發時 required 欄位缺失仍強制派發 → 視同 `PROPOSAL_INTENT_REGRESSION`（PROPOSAL_002 + 022 意圖違反）

## LangGraph 遷移對應

| 當前實作 | LangGraph 對應 |
|---------|--------------|
| 讀取 `[CURRENT_STAGE]` | State 物件 `current_node` |
| 檔案路徑交接 | State 物件 `artifacts` list |
| 短指令輸出 | Node structured output |

## 違反處理（對齊 lead.md §s_state_anchor 第 4 條）

累積 ≥ 3 次違反 → 觸發 `system-prompt.md §全局緊急阻斷` 條件一（協調失敗）。

---

## Related Decisions

- [ADR-0001](../decisions/0001-stateless-lead-routing.md) — Stateless @Lead Routing 三鐵律
