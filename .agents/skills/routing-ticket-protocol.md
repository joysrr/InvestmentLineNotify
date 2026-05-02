<!-- MACHINE_READABLE
type: protocol
category: F1
id: routing-ticket-protocol
related_proposals: [PROPOSAL_20260424_023]
related_decisions: [ADR-0001, ADR-0006, ADR-0007, ADR-0027]
-->

# Skill: ROUTING_TICKET Protocol（派發 artifact 機讀化協定）

> 由 PROPOSAL_20260424_023 建立；F1 類（純通用協定）。
> 定義 `ROUTING_TICKET.md` 的 schema + workflow + 與 `PENDING_ACTIONS.md §🎯` 的職責邊界。
> 取代 `lead.md §s_state_anchor` 鐵律 3「短指令交接」的純文本約束 → 機讀檔案約束。

---

## 一、定位與目的

### 1.1 為何需要 ROUTING_TICKET

| 痛點                                             | ROUTING_TICKET 解法                                          |
| ------------------------------------------------ | ------------------------------------------------------------ |
| @Lead 派發訊息純對話文本，schema 無強制          | YAML schema 必填欄位驗證（routing-ticket-validator）         |
| 子 agents 易參考對話歷史而非派發訊息（語意發散） | 子 agents §s01 鐵律：**首讀 ROUTING_TICKET；禁參考對話歷史** |
| 缺 LangGraph 遷移 node state 對應物              | ROUTING_TICKET = LangGraph node state 直接對應               |

### 1.2 與 PENDING_ACTIONS.md §🎯 的職責邊界

| 維度       | `PENDING_ACTIONS.md §🎯`             | `ROUTING_TICKET.md`                          |
| ---------- | ------------------------------------ | -------------------------------------------- |
| 角色       | **狀態錨點**（state anchor）         | **派發 artifact**（dispatch payload）        |
| 回答的問題 | 「現在誰在做什麼？」                 | 「這次派發完整脈絡？」                       |
| 累積方式   | 跨派發累積（CURRENT_STAGE 不斷更新） | 每次派發一張新 ticket（append-only history） |
| 寫入時機   | @Lead 對話開始 + 階段轉移            | 派發子 agent 前必寫                          |
| 讀取者     | @Lead（強制狀態讀取鐵律 1）          | 被派發的子 agent（§s01 鐵律）                |
| 生命週期   | 永續（直至專案結束）                 | 單次派發（執行完移 archive）                 |

**鐵律**：兩者**並存且互補**；不可合併；不可任一取代另一。

---

## 二、Schema 規格（v1）

```yaml
# ROUTING_TICKET.md（YAML frontmatter + markdown 註解）
schema_version: v1
ticket_id: TKT-YYYYMMDD-NNN # 必填；NNN 為當日序號
created_at: ISO8601 # 必填；UTC
created_by: "@Lead" # 必填；目前固定為 @Lead（單一 Orchestrator）
status: dispatched | acknowledged | completed | cancelled | paused | timeout | retried | failed # 必填（PROPOSAL_502_014 N-3 擴展 4 狀態）
task_class: feature # 選填；enum: feature | modify-existing | doc-sync | hotfix；預設 feature；對應 lead.md §s05 任務分類例外

# ─────── User 原始指令（不得改寫）───────
original_request: | # 必填；多行字串；保留標點
  <User 原文一字不漏>

# ─────── Lane / Model / 複雜度決策（依 SYSTEM_THRESHOLDS）───────
assigned_lane: fast | standard | heavy # 必填
model_tier: haiku | sonnet | opus # 必填
complexity_tier: simple | medium | complex # 必填
tier_reason: <一句話評估摘要> # 必填

# ─────── 任務目標 ───────
target_agent: "@Backend" # 必填；單一主目標
sibling_agents: [] # 選填；並行派發（@Reviewer + @Security 等）
touched_files: [] # 必填（可為空陣列）
artifact_paths: [] # 必填（產出物路徑）
tech_stacks: [] # 必填；workspace 注入

# ─────── Memory Palace 模式（PROPOSAL_502_013 M-4；ADR-0039）───────
memory_mode: mcp # 選填；enum: mcp | filesystem_fallback；預設 mcp；MCP 不可達時 @Lead 設 filesystem_fallback
memory_hint: <none> # 選填；palace.search 結果摘要（如 'no strong match' / drawer ref）

# ─────── Workspace 注入摘要（非全文；防 token 浪費）───────
project_context_excerpt: <精選欄位>
business_rules_excerpt: <若觸發>
critical_paths_excerpt: <若觸發>

# ─────── Hotfix 模式擴充（若 assigned_lane=heavy + Hotfix 場景）───────
hotfix:
  enabled: false # true 時下列欄位必填
  sc_evaluation:
    triggered: false
    sc_codes: []
  diagnostic_team_required: false
```

---

## 三、Workflow

### 3.1 寫入時機（@Lead 端）

派發子 agent 前**必須**：

1. 完成 `§s_complexity_lane` 三步複雜度評估
2. 確認 `force_complex_scenarios` 是否觸發（含 PROPOSAL*020 Phase B 的 `rule_edit*\*`）
3. **寫入 ROUTING_TICKET.md** 至專案根層
4. 對話訊息以人讀格式通知（`Next: @<Agent> | Ticket: ROUTING_TICKET.md`）
5. **絕對禁止** 派發訊息含 ticket 以外的任務細節（ticket 是唯一 SSOT）

### 3.2 讀取時機（子 agent 端）

被 @Lead 喚醒時的**首要動作**（依各子 agent §s01）：

1. 讀取 `ROUTING_TICKET.md`（專案根層）
2. **絕對禁止** 從對話歷史推導本次任務範圍
3. 依 `target_agent` / `sibling_agents` 確認自己是否為本次接收者
4. 依 `original_request` 理解 User 意圖
5. 依 `touched_files` / `artifact_paths` 確認工作範圍
6. 完成後 ticket `status: acknowledged → completed`

### 3.3 歷史保留（append-only）

- 每張新 ticket 寫入 `ROUTING_TICKET.md`（覆寫最新）
- 完成 / 取消後 → 移至 `archive/routing-tickets/TKT-YYYYMMDD-NNN.md`
- 至少保留 **30 天**滾動（用於 retro 比對 / drift 分析）

---

## 四、與 ADR / Rules 的關係

- **ADR-0001 Stateless Lead Routing**：本協定為 ADR-0001 在 CLI 環境下的具體實作（檔案級 handoff）
- **ADR-0006 Model Tier Routing** + **ADR-0007 Lane Routing**：`model_tier` / `assigned_lane` 欄位直接對應
- **ADR-0027 Hub-and-Spoke 黑板**：ROUTING_TICKET = 派發黑板節點之一（與 PENDING_ACTIONS.md / AUDIT_HISTORY.md 並列）
- **PROPOSAL_20260424_020 Phase B**：`tier_reason` 必含 `rule_edit_large/critical` 觸發判定（若涉及 rules/\*.md）

## 五、禁止行為

- **絕對禁止** @Lead 派發子 agent 而未寫 ROUTING_TICKET（違反 §3.1.3）
- **絕對禁止** 子 agent 從對話歷史推導任務範圍（違反 §3.2.2）
- **絕對禁止** 派發訊息含 ticket 以外的任務細節（違反 SSOT）
- **絕對禁止** 修改既存 ticket 內容（append-only；錯誤 → 新 ticket cancel 舊的）
- **絕對禁止** ROUTING_TICKET 與 PENDING_ACTIONS 內容互相覆蓋（職責邊界鐵律）

## 六、Validator

`tests/routing-ticket-validator.mjs`（PROPOSAL_023 Phase E 建立；run-all.sh 第 12 validator）：

1. Schema 完整性：必填欄位齊全
2. `model_tier` ↔ `assigned_lane` 對應正確（haiku-fast / sonnet-standard / opus-heavy）
3. `force_complex_scenarios` 觸發時 `tier_reason` 必含原因
4. Hotfix 模式啟用時 `sc_evaluation` 必填
5. archive 歷史 append-only 檢查

## 七、與 PROPOSAL_023 後續演進

- **v1**（本提案）：基本 schema + 7 子 agents 改讀檔順序
- **v2 候選**：tickets 加密 / 簽章（防偽造）；待後續提案
- **v3 候選**：直接遷移至 LangGraph node state；待 LangGraph adapter 完成

## 八、關聯

- `rules/lead.md §s_state_anchor` — 派發鐵律（本協定強化鐵律 3）
- `rules/<child-agent>.md §s01` — 子 agent 派發接收鐵律
- `skills/lead-orchestration-guide.md §一` — State Anchor 完整規範
- `skills/stateless-routing-pattern.md` — LangGraph 遷移規範
- ADR-0001 / 0006 / 0007 / 0027

---

**維護紀錄**：

- 2026-04-24：PROPOSAL_20260424_023 Phase B 建立（F1 類；schema v1）
