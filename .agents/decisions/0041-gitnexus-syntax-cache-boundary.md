---
adr_id: ADR-0041
title: GitNexus Syntax-Layer Cache Boundary（mempalace 為 SoT；GitNexus 為輔助）
status: Accepted
date: 2026-05-06
amended: 2026-05-07 # PROPOSAL_502_036 鐵律 2 v3 升級（持久化判定矩陣 + caller list 不寫死）
supersedes: []
superseded_by: []
amends: [ADR-0039]
related_proposals:
  - PROPOSAL_20260502_033
  - PROPOSAL_20260502_034 # B-1/B-2/B-5 深度整合；鐵律 3 amend
  - PROPOSAL_20260502_036 # 鐵律 2 v3 amend；持久化判定矩陣
  - PROPOSAL_20260502_001 # mempalace MCP backend
  - PROPOSAL_20260502_030 # Prior Art HITL-first（外部工具輸入點）
referenced_by:
  - .mcp.json
  - .qwen/settings.json
  - skills/code-graph-exploration.md
  - rules/lead.md §s_complexity_lane
  - rules/reviewer.md §s06
  - AGENT_BOOTSTRAP.md §10
---

# ADR-0041: GitNexus Syntax-Layer Cache Boundary

## Status

**Accepted** (2026-05-06)

## Context

PROPOSAL_502_033 接入 GitNexus 為外部 MCP 工具（個人開發輔助；noncommercial license + Node 套件依賴雙豁免）。GitNexus 提供：

- Code knowledge graph（call graph / impact / AST 解析）
- 16 MCP tools（query / context / impact / cypher / ...）
- 14 種程式語言支援
- LadybugDB embedded graph DB（per-repo `.gitnexus/`）

**問題**：本框架已有 mempalace 為 primary memory backend（ADR-0039 v2 Plan G）；引入 GitNexus 後 SoT 變兩套，agent 需釐清「何時用哪個」+「結果如何持久」。若不明文邊界 → 雙寫 / 衝突 / agent 困惑。

## Decision

確立 **語意 vs 語法 雙層職責分離**：

### 層級 1：mempalace = primary SoT（語意層；既有）

- **角色**：跨 session knowledge palace（decisions / lessons / context / debug / strategy）
- **持久性**：SQLite + ChromaDB；`.export/` cold backup；zip 攜帶
- **派發前必查**：既有鐵律（lead.md §s_memory_palace）
- **寫入路徑**：rules 直呼 `mcp__mempalace__add_drawer/update_drawer`
- **Fallback**：`.export/` grep + `.pending/` buffer

### 層級 2：GitNexus = auxiliary cache（語法層；新增）

- **角色**：code structure cache（call graph / impact / cross-file 影響）
- **持久性**：per-repo `.gitnexus/`（gitignored；可重建；非 SoT）
- **派發前必查**：❌ 否；只在場景觸發查（大型 refactor / cross-file impact / onboarding）
- **使用路徑**：
  - **A 路徑（推薦）**：user 自跑 `gitnexus impact` → 結果回填 PRIOR_ART_REPORT §B（PROPOSAL_502_030 既有 HITL gate 天然吃）
  - **B 路徑（agent enable 後）**：agent 直呼 `mcp__gitnexus__*` tools（場景命中才用）
- **Fallback**：無；直接退回 grep / Read（GitNexus 結果非必要）

### 鐵律（不可違反）

1. **mempalace 永遠是 SoT**：GitNexus 結果絕不取代 mempalace drawer
2. **GitNexus 結果持久化規則**（PROPOSAL_502_036 v3 升級；解 G-F1/G-F2/G-F4/G-F5）：
   - **A. caller list 永不寫死進 drawer body**（避免雙 SoT 副本 staleness）
     - drawer body 只記事件摘要（why / decision / 影響範圍粗估；≤200 chars）
     - drawer 加 `regenerate_via: "gitnexus impact <symbol>"` 指針欄位
     - 半年後 user 可重跑 GitNexus 取最新 caller；drawer 始終 fresh
   - **B. 「該寫」判定矩陣**（替代原「若要持久」模糊詞；整合 sub-agent runtime_telemetry）
     - refactor / rename 任務完成 → **強制寫**
     - `runtime_telemetry.gitnexus_callers_count > 10` + cross-stack → **強制寫**
     - debug 找根因（mempalace drawer 過期 + GitNexus 顯示新事實）→ **強制寫**
     - 其他場景 → 預設不寫；user 明示才寫
   - **C. 寫入點**（單一寫入 agent 避重複；PROPOSAL_502_041 改 stage-agnostic）
     - **核心鐵律**：「task close 前必寫」（不綁特定 stage 編號；hotfix-heavy 流程亦適用）
     - 有 review 場景：`@Reviewer` review 完成後寫入（任 stage）
     - debug / hotfix-heavy（無常規 review）：`target_agent` task close 前最後一步寫入；與 runtime_telemetry append 同 atomic boundary
     - onboarding：`@Architect` 完成 PROJECT_CONTEXT 後寫入
     - **hotfix 緊急優先級**（解 GR-F4）：「fix 提交 + drawer 寫入同 atomic boundary」— 寫 drawer 算 ticket close 條件之一；不可先 fix commit close 再補 drawer（會被 P-35 偵測為違反）
   - **D. 衝突仲裁**（mempalace ↔ GitNexus 結果不一致；解 G-E2）
     - GitNexus 為「當前事實」優先（語法層；可重建）
     - mempalace drawer 觸發 `update_drawer`：加 `last_verified_at` + `superseded_by_drawer_id`
     - 不刪舊 drawer（保 audit trail）；新 drawer link 舊
3. **使用階段二分**（PROPOSAL_502_034 amend）：
   - **派發前 batch 不加 GitNexus**：4 探測（PENDING_ACTIONS / grep / mempalace / ROUTING_TICKET）維持低 latency；多數 dispatch 不需語法層查詢
   - **執行期間 agent 可直呼**：sub-agent 接到 task 後場景命中（refactor / cross-file / 千行檔 navigation）→ 直呼 `mcp__gitnexus__*`；無需透 user 中介
   - **不可在派發前 batch 加 GitNexus** 即使 user profile 高頻；執行期再呼即可
4. **disabled by default**：MCP config 預設 disabled；user 啟用前 agent 不假設可用
5. **B-1 fallback 路徑**（PROPOSAL_502_034）：GitNexus unavailable（MCP 不可達 / disabled）→ sub-agent 走 Prior Art Phase B（提示 user 自跑 + 回填）；不阻斷任務

## Consequences

### 正向

- **零行為破壞**：disabled by default；既有 v7.5 行為完全保留
- **Agent 認知成本低**：明文「mempalace 必查；GitNexus 場景觸發」二分；不必判斷複雜邊界
- **User 自由度**：個人開發可隨時 enable / disable；不啟用即看不出差異
- **既有 HITL gate 天然吃**：A 路徑不需新機制（PROPOSAL_502_030 Phase B 已存在）

### 負向 / 風險

- **License 風險（noncommercial）**：用途若變商用需重新評估；登記於 AUDIT_HISTORY §豁免記錄
- **Node 依賴**：違反 v7.0 Python-only milestone 表面意圖；豁免理由：milestone 約束「自寫腳本」非「外部 MCP server 套件」
- **重建成本**：`.gitnexus/` gitignored；新 clone / CI 環境需重跑 `gitnexus analyze`（user 動作；agent 不代執行）

### 中性

- **agent skills 命名**：GitNexus auto-install `.claude/skills/` 4 個 skills（exploration / debugging / impact / refactoring）；本框架 skills 在 `.agents/skills/`；不同目錄不衝突；agent 視 `.agents/skills/code-graph-exploration.md` 為權威來源

## Alternatives Considered

1. **完全不接（Plan A）**：純外部工具；零框架登記
   - 優：零成本；缺：agents 不知存在；場景判斷靠 user 記憶
   - **拒絕原因**：場景判斷自動化價值（agent 主動建議 user 用）值得輕度登記

2. **深度整合（Plan C）**：@Reviewer / @Architect 工作流強制使用
   - 優：自動化最強；缺：違反 ADR-0039 SoT；雙寫成本高；商用風險擴大
   - **拒絕原因**：個人開發場景投入產出不成比例；mempalace SoT 不應稀釋

3. **Python 等價物自建**（不用 GitNexus）：tree-sitter-python + networkx
   - 優：保 Python-only；無 license 風險
   - 缺：自寫 ~500-1000 LOC；功能弱於 GitNexus；維護成本
   - **拒絕原因**：重新造輪；GitNexus 已成熟（28k+ stars）

## Compliance / Validation

- 本 ADR 不引入新 validator（disabled by default；無強制行為）
- 若 user enable + 大量使用 → 未來可考慮加 validator 檢查「GitNexus 結果是否有對應 mempalace drawer 摘要」（PROPOSAL_502_033 v2 候選）
- License 變更（user 用途轉商用）→ AUDIT_HISTORY §豁免記錄追蹤；30 天 review

## v2 Amendment（2026-05-06；PROPOSAL_502_034）

User profile 確認：跨檔（前↔後端）+ 千行檔 = 高頻 → GitNexus sweet spot。原 v1 「外部輔助」升級為「半自動整合」：

- **B-1 lead.md auto-suggest**：派發前輕量 grep 偵測 4 場景（cross-stack ≥3 檔 / LOC>800 / refactor 關鍵字 / 前後端雙路徑）；命中 → 寫 `gitnexus_hint` 至 ROUTING_TICKET
- **B-2 執行期 agent 直呼**：sub-agent 接到 task + 場景命中 → 直呼 `mcp__gitnexus__{impact, context, cypher}`；不必透 user
- **B-5 reviewer.md §s06 caller scan**：千行檔 / cross-stack diff → 必查 caller graph（GitNexus available 直呼；unavailable grep 並標 INFO）
- **鐵律 3 amend**：保留「派發前 batch 不加」；新增「執行期間 agent 可直呼」

非破壞性：disabled 時所有路徑 fallback 至 grep / Read（既有 v1 行為）。

## References

- PROPOSAL_502_033（本 ADR 建立提案）
- PROPOSAL_502_034（v2 amend；B-1/B-2/B-5 深度整合）
- PROPOSAL_502_001 + ADR-0039（mempalace primary SoT）
- PROPOSAL_502_030（Prior Art HITL-first；B-1 fallback 路徑）
- ADR-0040（Script Language Policy；本 ADR Node 豁免理由依據）
- GitNexus 官方：https://github.com/abhigyanpatwari/GitNexus（noncommercial PolyForm 1.0.0）
