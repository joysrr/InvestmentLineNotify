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
ticket_id: TKT-YYYYMMDD-NNN          # 必填；NNN 為當日序號
created_at: ISO8601                   # 必填；UTC
done_at: <ISO8601 或 null>             # 選填（PROPOSAL_502_046 R5-7 補；status: completed 時 sub-agent 寫；P-34 sort 依此；非 mtime；缺 → fallback created_at）
retry_of: <failed ticket_id 或 null>   # 選填（PROPOSAL_502_046 R5-1 補；validator failed 後 @Lead 派新 ticket 鏈接；非 superseded（後者為 hotfix-tier-upgrade 專用）
multi_signal_secondary: []             # 選填（PROPOSAL_502_046 + ADR-0043 R5-4）；list of task_class enum；本 ticket 為主時填次要訊號清單
multi_signal_primary: <ticket_id 或 null>  # 選填（同上）；本 ticket 為次時填主 ticket id
created_by: "@Lead"                   # 必填；目前固定為 @Lead（單一 Orchestrator）
status: dispatched | acknowledged | completing | completed | cancelled | paused | timeout | retried | failed  # 必填（PROPOSAL_502_043 R3-B5 加 completing 中介態；validator 跑於 completing→completed 之間 archive 前）
task_class: feature                    # 選填；enum: feature | modify-existing | doc-sync | hotfix | config-adjust | onboarding；預設 feature；對應 lead.md §s05 任務分類例外
task_class_source: keyword             # 選填（PROPOSAL_502_044/045 + ADR-0042 v2）；enum: explicit | structural | keyword | llm_classifier | llm_failed_fallback（5 值）；audit 用；指示三層判定哪層命中或 LLM 失敗 fallback
task_class_source_evidence: <string>   # 選填（PROPOSAL_502_045 R4-G）；source=structural 時填觸發訊號名（missing_workspace/git_rename_detected/all_new_files/existing_files_majority）
intent_ambiguous: false                # 選填；LLM confidence: low 或 unsure 同義詞 → true；@Lead 派發前提示 user 確認 task_class

# ─────── User 原始指令（不得改寫）───────
original_request: |                   # 必填；多行字串；保留標點
  <User 原文一字不漏>

# ─────── Lane / Model / 複雜度決策（依 SYSTEM_THRESHOLDS）───────
assigned_lane: fast | standard | heavy   # 必填
model_tier: haiku | sonnet | opus        # 必填
complexity_tier: simple | medium | complex  # 必填
tier_reason: <一句話評估摘要>            # 必填

# ─────── 任務目標 ───────
target_agent: "@Backend"              # 必填；單一主目標
sibling_agents: []                    # 選填；並行派發（@Reviewer + @Security 等）
touched_files: []                     # 必填（可為空陣列）
artifact_paths: []                    # 必填（產出物路徑）
tech_stacks: []                       # 必填；workspace 注入

# ─────── Memory Palace 模式（PROPOSAL_502_013 M-4；ADR-0039）───────
memory_mode: mcp                       # 選填；enum: mcp | filesystem_fallback；預設 mcp；MCP 不可達時 @Lead 設 filesystem_fallback
memory_hint: <none>                    # 選填；palace.search 結果摘要（如 'no strong match' / drawer ref）
skip_memory_search: false              # 選填（PROPOSAL_502_028 O-3 + PROPOSAL_502_039 GR-G1 補 hotfix-light）；true = 派發前略過 mempalace.search；自動觸發條件：task_class ∈ {doc-sync, config-adjust} OR (task_class=hotfix AND hotfix_tier=light)；皆需無 strategyWeight 敏感參數命中
runtime_setup: []                      # 選填（PROPOSAL_502_029 T-2）；list of pre_command_hooks 從 active workspace.RUNTIME_CONTEXT 注入；sub-agent 跑 shell 前依序先跑；例：[{command: '$env:Path = "D:\\node-v24...;"+$env:Path', shell: powershell, reason: 'Windows Node 強制版本'}]

# ─────── Autonomy 控制（PROPOSAL_502_032）───────
autonomy_mode: gate-at-design          # 選填；enum: auto | step-by-step | gate-at-design | gate-at-impl；缺則 fallback auto（既有行為）
# auto              一路跑完 Stage 1-9 不停 → smart default for task_class ∈ {doc-sync, config-adjust, hotfix-light（PROPOSAL_502_035）}
# step-by-step      每階段轉移前發 🟡 STAGE_<N>_VERIFY_PENDING（**僅 user override 才用**；PROPOSAL_502_039 GR-D1 不再為 default）
# gate-at-design    Stage 3 設計後卡 1 次 → smart default for task_class ∈ {feature, onboarding}
# gate-at-impl      Stage 5 實作前卡 1 次 → smart default for task_class ∈ {modify-existing, **hotfix-heavy**（PROPOSAL_502_039 GR-D1 從 step-by-step 改 gate-at-impl；解通知爆炸 ≥10 條）}
# User override 自然語言對應：
#   "幫我跑完" / "全自動"          → auto
#   "每階段跟我確認" / "step by step" → step-by-step
#   "設計完先給我看" / "確認方向"   → gate-at-design
#   "實作前先看" / "TEST_SPEC 後確認" → gate-at-impl

# ─────── Workspace 注入摘要（非全文；防 token 浪費）───────
project_context_excerpt: <精選欄位>
business_rules_excerpt: <若觸發>
critical_paths_excerpt: <若觸發>

# ─────── Hotfix Tier 升級 carry-over（PROPOSAL_502_040；hotfix-light → heavy 中途升級）───────
pending_group: <pg_id 或 null>         # 選填（PROPOSAL_502_041 GR-G3 補 schema 明文）；同 ticket 內多 pending 共享 24h 計時 + user 廣播確認；validator: sibling_agents.length ≥1 → pending_group 必填；default GRP-YYYYMMDD-NNN
superseded: <舊 ticket_id 或 null>      # 選填；新 heavy ticket 寫；指向被取代的 light ticket
pending_group_inherited_from: <pg_id>  # 選填；舊 ticket pending_group 繼承標記（解 GR-C4 跨 ticket 不孤兒）
context_carryover_summary: <string>    # 選填；新 heavy ticket 派發訊息含的舊 ticket 完成部分 1 行摘要（解 GR-C3 user context stale）

# ─────── Hotfix 模式擴充（若 assigned_lane=heavy + Hotfix 場景）───────
hotfix:
  enabled: false                      # true 時下列欄位必填
  hotfix_tier: light                  # PROPOSAL_502_046 R5-3 補；enum: light | heavy；對應 lead.md §s07 三機制鐵律 + tasks/hotfix-checklist.md Step 0 分流；hotfix.enabled=true 時必填（5 輪累積債修補）
  sc_evaluation:
    triggered: false
    sc_codes: []
  diagnostic_team_required: false

# ─────── GitNexus B-1 Hint（PROPOSAL_502_034 v7.7 + PROPOSAL_502_036 v7.9 schema 補明文；ADR-0041 v2）───────
gitnexus_hint:                         # 選填；@Lead B-1 派發前 grep 命中時寫入；hotfix-light 強制 null
  triggered_by:                        # enum 多值：cross-stack | large-file | refactor-keyword | frontend-backend-pair | onboarding-scenario
    - <enum>
  suggested_query: <string>            # 例 "gitnexus impact getUserOrders"
  fallback: <string>                   # 通常 "Prior Art Phase B"
  optional: false                      # default false；onboarding-scenario 強制 true → P-32 偵測 → 只記 🟢

# ─────── Runtime Telemetry（PROPOSAL_502_036 新增；sub-agent 執行期 append-only 回填）───────
runtime_telemetry:                     # 選填；sub-agent 執行期 append（PROPOSAL_502_039 §3.6 規範；append-only 例外白名單）
  gitnexus_probe: <enum: ok|disabled|crash|no-index|timeout>  # 5 失敗模式（PROPOSAL_502_039 §C.3 三分判定；timeout default 5s）
  gitnexus_used: false                 # B-2 直呼是否成功
  gitnexus_callers_count: 0            # impact caller 數；**> 10**（即 ≥11）+ cross-stack 觸發強制寫 drawer（ADR-0041 v3 鐵律 2-B；PROPOSAL_502_041 GR-G2 統一 `>` 不用 `≥`；schema/ADR/P-35 三處對齊）
  mempalace_writes: []                 # list of drawer_id
  elapsed_ms: 0                        # task 總耗時
  tier_upgrade_required: <none|heavy>  # PROPOSAL_502_040 GR-C2；hotfix-light → heavy 升級觸發
  tier_upgrade_reason: <string>        # PROPOSAL_502_040 GR-C2；觸發條件 § 編號 + 一句說明
  in_flight_changes: []                # PROPOSAL_502_040 GR-C2 + PROPOSAL_502_043 R3-C4 enum 對齊 git 術語；[{file, status: working_tree|staged|committed, technical_revert_safe: bool, business_impact_revert_safe: bool}]（PROPOSAL_502_043 R3-D1 拆雙 revert_safe）
  prior_ticket_telemetry_carryover: false  # PROPOSAL_502_040 GR-C5；新 heavy ticket 寫 true 時 P-34 跨 ticket 連續累計
  prior_ticket_id: <舊 ticket_id 或 null>   # 同上
  prior_ticket_probe_history: []       # 同上；舊 telemetry.gitnexus_probe 序列
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
   4.5. **若 frontmatter 含 `superseded` 非 null**（PROPOSAL_502_043 R3-B9）：
   - 自動繼承 `prior_ticket_id = <superseded>` → 寫入後續 telemetry
   - 從 archive 讀舊 ticket telemetry → 抽 `gitnexus_probe` 序列 → 預備寫 `prior_ticket_probe_history`
   - validator 會檢「`superseded != null AND prior_ticket_id == null` → fail」
5. 依 `touched_files` / `artifact_paths` 確認工作範圍
6. 完成後 ticket `status: acknowledged → completed`（前須 §3.6 append telemetry）

### 3.3 歷史保留（PROPOSAL_502_031 強化；append-only + auto-archive）

- 每張新 ticket 寫入 `ROUTING_TICKET.md`（**單檔；覆寫最新**）
- **status: completed / cancelled / failed → @Lead auto-archive**：
  - 移至 `.agents/archive/routing-tickets/TKT-YYYYMMDD-NNN.md`
  - 保留 30 天滾動（retro / drift 分析用）
  - 移完後 `ROUTING_TICKET.md` reset 為「無 active ticket」狀態（單行：`status: idle`）
- **絕對禁止建變體檔**（PROPOSAL_502_031 T-1）：
  - ❌ `ROUTING_TICKET_PhaseXXX.md` / `ROUTING_TICKET_v2.md` / `ROUTING_TICKET_2026-05-04.md` 等
  - 多 phase 任務 → 同一 `ROUTING_TICKET.md` 內逐 phase 更新；phase 完成歸檔；下 phase 覆蓋
  - 並發任務 → 用 `PENDING_ACTIONS.md §📥 PENDING_DISPATCHES` queue（FIFO）
  - 違反偵測：`tests/root-artifact-pollution-validator.py`（19th validator；root 出現 `ROUTING_TICKET_*.md` 變體即 fail）

### 3.4 Autonomy Gate 機制（PROPOSAL_502_032）

`autonomy_mode` 命中對應 stage 時，agent **不直接 Gate Check 進下一階段**：

1. 該 stage 完成 + DoD 自評通過 → 寫 `PENDING_ACTIONS.md §🟡 STAGE_<N>_VERIFY_PENDING`（含 stage 編號 + artifact paths + 推薦下一步）
2. 等 user 回應：
   - "OK / 繼續" → 走原 Gate Check + 派發下一階段
   - "改 X" → 退回該 stage 修正
   - 24h / 5 對話無回 → P-33 升 🔴

**Gate 觸發 stage 對照**：

- `auto` → 0 gate（既有行為）
- `step-by-step` → 每階段轉移前皆 gate（最多 8-9 次）
- `gate-at-design` → 僅 Stage 3 → 3.5/4 轉移前 gate（1 次）
- `gate-at-impl` → 僅 Stage 4 → 5 轉移前 gate（1 次）

### 3.6 Runtime Telemetry 回填 Step（PROPOSAL_502_039 解 GR-B1；append-only 例外白名單）

**問題**：v7.11 加 `runtime_telemetry` schema 但與 §五「絕對禁止修改既存 ticket 內容（append-only）」衝突 → P-34/P-35 patrol 無資料可吃。

**解法**：明文「runtime_telemetry block append」為 append-only 例外白名單。

**誰寫**：`target_agent`（被派發的 sub-agent；非 @Lead）

**何時寫**：sub-agent task close 前**最後一步**（status 改 `completed` 之前）

**如何寫**（PROPOSAL_502_043 R3-B4+B8 補實作 pattern）：

1. 讀現有 ROUTING_TICKET.md
2. 確認尾部無既有 `# === RUNTIME_TELEMETRY ===` block：用 Bash `grep -c '^# === RUNTIME_TELEMETRY' ROUTING_TICKET.md`；==0 才 append；>0 → P-35 加 double-write 副偵測 → 🟡 提醒
3. Append 實作三選一（推薦順序）：
   - **A. Bash heredoc**（推薦；atomic）：`cat >> ROUTING_TICKET.md << 'EOF'\n# === RUNTIME_TELEMETRY ...\nEOF`
   - **B. Edit tool with anchor**：anchor 推薦 ticket 倒數第二行（通常為 frontmatter 結尾 `---` 或 schema 最末欄位行）；anchor 不 unique → fallback A
   - **C. Write tool**（避免；除非整檔重寫場景）
4. block 格式：
   ```
   # === RUNTIME_TELEMETRY (append-only; written by @<agent> at <ISO8601>) ===
   gitnexus_probe: ok | disabled | crash | no-index | timeout
   gitnexus_used: <bool>
   gitnexus_callers_count: <int>
   mempalace_writes:
     - <drawer_id>
   elapsed_ms: <int>
   tier_upgrade_required: <none | heavy>   # PROPOSAL_502_040 跨 ticket carry-over 用
   ```
5. 寫完 → 改 `status: completing`（中介態；PROPOSAL_502_043 R3-B5）
6. **inline call validator**（PROPOSAL_502_045 R4-B1 解 trigger 主體）：sub-agent 用 Bash tool 跑 `python3 .agents/tests/routing-ticket-validator.py`；exit 0 → 改 `status: completed` → @Lead auto-archive；exit ≠0 → status: `failed` + telemetry 加 `validator_failed_reason: <stderr>` + 不 archive；user 介入修
7. **失敗 retry policy**（R4-B1 + PROPOSAL_502_046 R5-1 修正）：append 一次原則；fail 後不可改原 telemetry block；@Lead 派新 ticket **走獨立 retry 流程**（**非** superseded 鏈；superseded 為 hotfix-tier-upgrade 專用）→ 新 ticket frontmatter 寫 `retry_of: <failed ticket_id>`（schema 新欄位）；validator 驗 `retry_of != null AND prior status=failed`
8. **commit hook ↔ inline validator 一致性 SOP**（PROPOSAL_502_046 R5-2 + PROPOSAL_502_047 T-3 補 atomic）：
   - inline 跑於 status=`completing` 中間態（telemetry append 後、status: completed 前）
   - commit hook 跑於檔案落盤後（含 status: completed + archive 動作）
   - **偵測**：@Assistant 巡邏 P-39 `COMMIT_HOOK_VS_INLINE_DIVERGENCE`（PROPOSAL_502_047 T-2 補；消除 owner 缺失）→ 觸發以下 rollback SOP
   - **Rollback atomic SOP**（PROPOSAL_502_047 T-3 R6-4 補；原子性保證）：
     ```
     1. 先讀 archive ticket 全文 → 暫存 var $ticket_content
     2. 執行 `git revert HEAD --no-commit`（暫不 commit）
     3. 若 step 2 fail（merge conflict 等）→ abort：`git revert --abort` + 不動 archive + 發 🔴 ROLLBACK_MANUAL_REVIEW 等 user 介入
     4. step 2 pass → 從 archive 移檔回 root：`mv .agents/archive/routing-tickets/<id>.md ROUTING_TICKET.md`
     5. 改 status: failed + 加 telemetry `validator_failed_reason: <commit hook stderr>` + `failed_at: <ISO8601>`
     6. `git add ROUTING_TICKET.md && git commit -m "rollback: ticket <id> commit hook fail"`
     7. @Lead 派新 retry_of ticket（指向 failed id）
     - **任一 step fail → 整體 abort**（atomic 鐵律）；半完成態禁止；user 介入修
     ```
   - **預防**：inline 與 commit hook 跑同一 validator 程式（routing-ticket-validator.py）；唯一差別是時態；理論一致；發散 = bug 應 root-cause 而非繞

**鐵律**：

- ❌ 絕對禁止 append 後再修改 telemetry block 任何值（仍 append-only）
- ❌ 絕對禁止 sub-agent 跳過 telemetry 直接 status: completed（除非 hotfix-light 例外）
- ✅ 例外：hotfix-light → telemetry 可全省（skip 三機制鐵律連帶）；**P-34 跨 ticket 累計跳過此類**（PROPOSAL_502_043 R3-B10；archive 掃描忽略 hotfix-light ticket；既無 telemetry 也不算入 fail）

**pending_group=null 場景**（PROPOSAL_502_043 R3-F1；hotfix-light → heavy 升級時舊 ticket 三機制全關無 pg）：

- 新 heavy ticket 自建 `pending_group: GRP-YYYYMMDD-NNN`（依 schema validator）
- `pending_group_inherited_from: null` 明文標
- P-31/P-32/P-33 24h 計時 anchor = **升級時間點**（telemetry tier_upgrade_required 寫入 ISO timestamp）；非舊 ticket 創建時間

**Validator 規則**（routing-ticket-validator 升級）：

- ticket status=completed AND task_class ≠ hotfix-light → telemetry block 必存在
- telemetry block 內 `gitnexus_probe` ∈ enum 5 值

### 3.7 散落檔禁止（PROPOSAL_502_031）

Root 唯一允許的運行 artifact：`ROUTING_TICKET.md` + `PENDING_ACTIONS.md`。
其他報告（DIAGNOSIS / REVIEW / SECURITY / TEST_REPORT / AUDIT_REPORT 等）必依
`skills/artifact-path-conventions.md` 歸檔到 `docs/` 子目錄。
散落 root 視為 ❌ 違規；validator 偵測 + 必須清理。

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
- 2026-05-04：PROPOSAL_502_031 強化 lifecycle（auto-archive + 禁變體）
- 2026-05-06：PROPOSAL_502_032 加 `autonomy_mode` 欄位（per-dispatch HITL gate 控制）
