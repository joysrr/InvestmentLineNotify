# Skill: Lead Dispatch Patterns（@Lead 派發指令模板）

> `@Lead` 派發任務至子 Agent 時的**標準指令格式**；對齐 PROPOSAL_001 短指令交接鐵律 + PROPOSAL_024 Model Routing + PROPOSAL_032 Lane Routing。

---

## 一、派發指令通用格式

```
Next: @<Agent>
Model: <haiku|sonnet|opus> # 依 PROPOSAL_024 MODEL_ROUTING（complexity_thresholds）
Lane: <fast|standard|heavy> # 依 PROPOSAL_032 LANE_ROUTING
Tech-stacks: <tech-stack 清單> # 本次任務需讀取的 tech-stacks/*.md
Artifacts: <檔案路徑清單> # 本次任務將讀取/寫入的檔案
```

**鐵律（對齐 `stateless-routing-pattern.md` 三鐵律）**：
- 僅傳 Artifact Paths，**絕對禁止**複製貼上 REVIEW/TEST/SECURITY_REPORT 原文
- 下一步指令 ≤ 5 行純文字
- 不預測超過 1 步（當前階段派發完即止，下一階段由 Gate Check 觸發）

---

## 二、Gate Check 短指令格式

```
✅ Gate Check ✔ S<當前階段>→S<下一階段>
Next: @<Agent> | Artifacts: <paths>
```

**範例**：
```
✅ Gate Check ✔ S3→S4
Next: @QA | Artifacts: docs/api/strategy-update.md, docs/plans/draft_features.md
```

---

## 三、三種車道派發範例（對齐 PROPOSAL_032）

### 3.1 🏎️ Fast Lane 範例（simple + haiku）

**情境**：修正 Telegram 推播訊息拼字錯誤（符合 20 項快車道指標）

```
Next: @Backend
Model: haiku
Lane: fast
Tech-stacks: nodejs-esm-backend
Artifacts: src/modules/notification/telegramPusher.mjs
```

### 3.2 🚗 Standard Lane 範例（medium + sonnet）

**情境**：新增 GET API 端點列出追蹤股票清單

```
Next: @Planner
Model: sonnet
Lane: standard
Tech-stacks: nodejs-esm-backend, file-based-storage
Artifacts: docs/plans/draft_features.md, src/api/routes/stocks.mjs
```

### 3.3 🚚 Heavy Lane 範例（complex + opus；含強制升等）

**情境**：修改 `strategyWeight`（觸發 force_complex_scenarios 強制升等）

```
Next: @Consultant
Model: opus
Lane: heavy
Tech-stacks: nodejs-esm-backend, file-based-storage
Artifacts: data/Strategy.json, docs/plans/advice/ADVICE_strategy_update.md
注：strategyWeight 異動觸發 force_complex_scenarios；強制升等至 heavy + opus
```

---

## 四、審查階段派發範例（Stage 6 / 6.5）

### 4.1 @Reviewer 派發

```
Next: @Reviewer
Model: sonnet
Lane: standard
Artifacts: src/api/routes/stocks.mjs, REVIEW_REPORT.md
範疇：Backend 程式碼；讀取 backend.md §完成定義 + tech-stacks/web-backend/nodejs-esm-backend.md
```

### 4.2 @Security 平行派發（條件式）

觸發條件：`skills/security-audit.md §1` SC-01~SC-11 任一成立 → 與 @Reviewer 平行派發：

```
Next: @Security（與 @Reviewer 平行）
Model: opus
Lane: heavy
Artifacts: src/api/middleware/initDataGuard.mjs, SECURITY_REPORT.md
觸發範疇：SC-01 Token 時效驗證
```

---

## 五、退件派發範例

### 5.1 @Reviewer 退件

**情境**：`REVIEW_REPORT.md` 含 BLOCKER，退回 @Backend 修正

```
Next: @Backend
Model: sonnet
Lane: standard
Artifacts: src/modules/signal/rsiCalc.mjs, REVIEW_REPORT.md
狀態：BLOCKER 退件；複審計數 1/REVIEW_CYCLE_LIMIT（依 §十四 預設 2）
```

### 5.2 第二次複審觸發 P-01 阻斷

**情境**：複審 ≥ REVIEW_CYCLE_LIMIT 仍有 BLOCKER → `@Assistant` P-01 `REVIEW_QUALITY` 🔴 阻斷新功能

`@Lead` 不再派發；等待 User 指令 `重新評估實作方案 <功能名稱>` 解除。

---

## 六、特殊場景派發

### 6.1 Hotfix Fast Lane（依 `tasks/emergency-shutdown-playbook.md`）

```
Next: @Backend
Model: opus
Lane: heavy（Hotfix 強制升等）
Artifacts: src/<修復標的>.mjs
觸發：Hotfix 緊急通道；User 明確下令「啟動 Hotfix」
```

### 6.2 @Retro 根因分析派發（提案後）

```
Next: @Retro
Model: opus（force_complex_scenarios）
Lane: heavy
Artifacts: TEST_REPORT.md, REVIEW_REPORT.md（若有）, AUDIT_HISTORY.md（若觸發 P-15）
```

---

## 七、禁止行為

- **絕對禁止** 派發指令 > 5 行純文字
- **絕對禁止** 複製貼上完整報告原文於派發指令
- **絕對禁止** 同時派發多個 Agent 執行同一任務（平行審查除外，需明示「與 @X 平行」）
- **絕對禁止** 省略 `Model:` / `Lane:` 欄位（對齐 PROPOSAL_024+032；`@Assistant` P-19/P-20 巡邏偵測）
- **絕對禁止** 派發時未執行複雜度三步評估（對齐 `lead.md §s_complexity_lane`）

---

## 八、溯源

本檔案抽出自：
- `lead.md §s_state_anchor`（三鐵律摘要）
- `lead.md §s09 產出物確認機制`（Gate Check 格式部分）
- PROPOSAL_20260422_001（@Lead 無狀態路由）
- PROPOSAL_20260422_024（MODEL_ROUTING）
- PROPOSAL_20260422_032（LANE_ROUTING）

供 `@Lead` 派發時動態讀取；修訂需透過 RULE_UPDATE_PROPOSAL。

---

<!-- MACHINE_READABLE
type: project-specific-references
schema_version: v1.0
category: F2
skill_or_task: lead-dispatch-patterns
-->

## 🔗 專案特化參照 (Project-Specific References)

> 本 skill 描述**通用派發指令模板**；專案業務規則與關鍵路徑由 workspace 注入。
> 請參照 `.agents/workspaces/<CURRENT_WORKSPACE>.md` 對應欄位。

| 通用概念 | Workspace 欄位 | Fallback 行為 |
|---|---|---|
| 專案業務規則（派發時上下文）| `BUSINESS_RULES` | 警告：無業務規則無法驗證派發合理性 |
| 關鍵路徑（派發前評估）| `CRITICAL_PATHS.*` | 升級 User：關鍵路徑未定義時強制 complex lane |

---

## Related Decisions

- [ADR-0001](../decisions/0001-stateless-lead-routing.md) — Stateless @Lead Routing 三鐵律
- [ADR-0006](../decisions/0006-model-tier-routing.md) — 模型分層路由
- [ADR-0007](../decisions/0007-lane-routing.md) — 多車道路由
- [ADR-0008](../decisions/0008-hotfix-dual-track.md) — Hotfix 雙軌流程
