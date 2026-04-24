# Skill: Auditor Rubric Prompts (18 份自動化評審 Prompt Fragment)

> 對應 `.agents/docs/quality-audit-automation-manual.md §一`。

## 維度一 — 角色與行為約束

### 1.1 Persona 具體化程度
"分析 Agent 的角色設定。給予 1-5 分。5 分標準：具備明確職稱、2026 年標準職責描述及溝通語氣定義。若僅使用 '你是一個助手' 等通用語句，直接給予 1 分並標註 'Identity Missing'。"

### 1.2 負面約束與邊界
"檢查規則中是否存在 [NEVER] 或 [FORBIDDEN] 標籤。5 分標準：明確列出至少 3 個關鍵安全邊界（如隱私保護、權限限制）。若無任何禁止指令，給予 2 分並警告潛在越權風險。"

### 1.3 Few-Shot 範例品質
"檢查 Agent rules 是否包含至少 3 組高品質輸入/輸出範例。5 分標準：≥ 3 組標準 I/O 對 + 涵蓋複雜情境。"

### 1.4 規則密度審核
"計算輸入 Rules 的 Token 數量。評等標準：<200 為精簡；200-1,000 為平衡(優)；>3,000 為冗長(風險)。若為冗長，請在建議中列出應拆分為多 Agent 協作的具體模組。"

## 維度二 — 技術架構

### 2.1 架構模組化
"辨識規則中是否將推理、工具調用與治理邏輯分離。5 分標準：工具定義獨立於行為指南。若業務邏輯直接寫死在 Prompt 敘述中，給予 2 分並建議進行 Decoupling 重構。"

### 2.2 可觀察性（更新於 PROPOSAL_20260422_021 + 022）
"評估 Agent 是否集成 Telemetry 並輸出結構化決策鏈。5 分標準：
(a) 具備完整時序資料框架（如 AUDIT_HISTORY.md）
(b) **.agents/docs/agents-overview.md 派生視圖與 .agents/ 狀態一致**（自動掃描以下 5 項對齊；依 PROPOSAL_20260423_004 位置移入）：
 - Agents 數量（§2.1）vs .agents/rules/*.md 實際數量
 - 巡邏規則 P-XX 範圍（§4.2）vs assistant.md §s05 實際條目數
 - 產出物交叉引用（§9.3）vs 實際產出物清單
 - Rules 檔案版本（§9.2）vs RULES_VERSION_INDEX.md
 - 系統參數（§7.1）vs SYSTEM_THRESHOLDS.yaml
(c) **WORKSPACE_SCHEMA 完整性（新增於 PROPOSAL_20260422_022）**：
 - `.agents/WORKSPACE_SCHEMA.yaml` 存在且可被 validator 解析
 - 當前 active workspace（`.agents/CURRENT_WORKSPACE`）所有 required 欄位齊全
 - `node .agents/tests/workspace-schema-validator.mjs` 回傳 exit 0
 - 所有 tech-stacks 含 §專案特化參照 + MACHINE_READABLE anchor
 - tech-stacks / skills 遵守 `RULES_DESIGN_GUIDE §十六` 三分法純淨原則
 - referenced_by 反向索引與實際引用一致（無孤兒欄位 / 斷裂引用）
(d) **Proposal Scope 純度（新增於 PROPOSAL_20260422_023）**：
 - 所有 active + completed 提案 frontmatter 含 `scope:` 欄位（framework | project:<name>）
 - scope: framework 提案全部位於 .agents/proposals/{active,completed,archived}/
 - scope: project:<name> 提案全部位於 .agents/workspaces/<name>/proposals/{active,completed,archived}/
 - 若任一 workspace 存在 project proposals → 該 workspace frontmatter 必須含 proposal_prefix
 - project 提案編號含對應 workspace 的 proposal_prefix（例：ILN_PROPOSAL_*）
 - 不存在混合 scope 提案（修改標的同時涵蓋 .agents/ + src/ 等）
(e) 扣分規則：
 - 任一 (b) 項不一致 → 扣 0.5 分
 - WORKSPACE_SCHEMA validator exit 2 → 扣 1.0 分
 - tech-stacks 違反三分法純淨原則 → 每份扣 0.5 分
 - Proposal 缺 scope 欄位 → 每份扣 0.3 分
 - scope 與儲存位置不一致 → 每份扣 0.5 分
 - 累積 ≥ 3 項不一致 → 扣 1.5 分
 - 維度 2.2 最低分 3.5（不降至更低，避免單一子項過度扣分）"

### 2.3 MCP 協定符合度
"檢查工具定義格式。5 分標準：完全符合 Model Context Protocol (MCP) 的 Schema 規範。若無明確工具描述或缺乏上下文傳遞機制，標註為 'Non-compliant'。"

### 2.4 編排效率（Orchestration Efficiency；新增於 PROPOSAL_20260422_027）
"評估 Multi-Agent 系統是否採用 Hub-and-Spoke + Blackboard Pattern 避免多層次發散（依 User 2026-04-22 警示）。5 分標準：
(a) **扁平 Agent 名冊**：無樹狀階層（如 @Lead → @Sub-Lead → @Worker）；Agent 彼此平級由 Orchestrator 調度
(b) **黑板節點完整**：共用狀態（PENDING_ACTIONS.md / AUDIT_HISTORY.md / WORKSPACE_SCHEMA.yaml 等）可被多 Agent 讀寫
(c) **零跨 Agent 私聊**：所有 Agent 溝通透過黑板；禁止 Agent 之間直接摘要轉譯
(d) **路由層解耦**：Orchestrator（@Lead 或未來 LangGraph）僅傳 artifact paths；不做文本合併
(e) 扣分規則：
 - 發現多層次 Agent 階層 → 扣 1.5 分
 - 黑板節點缺失（如無 PENDING_ACTIONS.md）→ 扣 1.0 分
 - Agent 間直接傳遞摘要文本 → 每案扣 0.5 分
 - 路由層包含業務邏輯（非純指令轉發）→ 扣 0.5 分
 - 維度 2.4 最低分 3.0（維持基礎價值）"

## 維度三 — 效能優化

### 3.1 提示詞自我優化機制
"檢查系統是否能根據回饋自動迭代 Rules。5 分標準：存在明確的 Retro / Auditor 閉環。"

### 3.2 模型分層路由
"評估規則是否支援多級模型分配。5 分標準：存在針對簡單任務（如格式化）與複雜任務（如邏輯推理）的模型分流指令。若全由單一旗艦模型執行，提示其成本優化空間。"

### 3.3 本地化處理率
"評估重複或隱私任務是否優先在邊緣端執行。5 分標準：File-based 並行防護與資料處理有明確標準模板。"

### 3.4 成本效益（Cost Efficiency；新增於 PROPOSAL_20260422_027）
"評估 Multi-Model Routing 與 Lane Routing 的實際成本優化程度（對齐 PROPOSAL_024 + 032）。5 分標準：
(a) **complexity_thresholds 實作**：SYSTEM_THRESHOLDS.yaml 含 simple/medium/complex 三層定義
(b) **MODEL_ROUTING 實作**：simple→haiku / medium→sonnet / complex→opus 分流指令明文
(c) **LANE_ROUTING 實作**：simple→fast / medium→standard / complex→heavy 工作流分流
(d) **force_complex_scenarios 覆蓋**：strategyWeight / @Security / Hotfix / @Retro / @Auditor 等高風險場景強制升等
(e) **派發驗證**：@Assistant P-19 (MODEL_ROUTING_VIOLATION) + P-20 (LANE_ESCALATION) 偵測不當派發
(f) **紀錄可追溯**：派發紀錄含 Model: / Lane: 欄位可稽核（AUDIT_DECISION_LOG）
(g) 扣分規則：
 - 缺 complexity_thresholds → 扣 1.5 分
 - MODEL_ROUTING 未實作 → 扣 1.5 分（對齐 PROPOSAL_024 觸發 P-15 條件）
 - LANE_ROUTING 未實作 → 扣 1.0 分
 - force_complex_scenarios 缺 ≥ 1 場景 → 每缺一扣 0.3 分
 - P-19 / P-20 巡邏規則缺 → 各扣 0.5 分
 - 維度 3.4 最低分 2.0（低於觸發 P-15 AUDIT_QUALITY）"

## 維度四 — 安全合規

### 4.1 沙盒執行安全性
"審查代碼執行相關規則。5 分標準：明確要求在 Ephemeral MicroVM 或 Sandbox 中運行。若規則允許直接存取宿主機環境，直接標註為 'High Risk' 並給予 1 分。"

### 4.2 干預與揭露機制
"檢查是否存在高風險操作的 Human-in-the-Loop (HITL) 觸發條件。5 分標準：對金融交易或系統修改有明確的 '詢問使用者' 指令。若缺乏此機制，扣除 2 分。"

### 4.3 法規與隱私對齊
"評估是否符合 2026 最新 AI 安全與隱私標準（GDPR / 個資法）。5 分標準：具備完整 PII 清單 + 資料保留期 + 刪除權 SOP + 加密政策 + 72h 外洩通知 + DPA + 跨境轉移。"

## 維度五 — 品質評估

### 5.1 指令遵循度（Follow-rate）
"模擬 50 步之後的任務狀態。評估 Agent 是否仍維持維度一中設定的 Persona。給予 1-5 分，5 分表示完全無指令漂移 (Prompt Drifting)。"

### 5.2 自動化評測集成
"檢查是否導入 AgencyBench V2 等腳本跑分。5 分標準：具備 CI/CD 整合 + pre-commit hook + 驗證腳本完整。"

### 5.3 LLM-as-a-Judge 評分
"檢查是否利用裁判模型對每一維度進行客觀打分。5 分標準：存在定期 Judge 派遣機制 + 時序歷史追蹤 + 觸發閾值通知 + 實際調用 Prompt Fragment。"

## 使用規範

1. **必須直接貼入**：`@Auditor` 派遣每個子 Agent 時**必須**複製對應維度的 3~4 份 Prompt Fragment 完整貼入派遣提示詞
2. **不得模糊化**：不得以「依手冊評審」的模糊語句取代完整 Fragment
3. **手冊同步**：若 `.agents/docs/quality-audit-automation-manual.md` 更新，本 skill **必須同步更新**（透過 RULE_UPDATE_PROPOSAL）
4. **評分對齊**：子 Agent 的輸出必須含 JSON `{ scores, rationales, baseline_comparison }` + 每項 ≥ 100 字 rationale

---

## Related Decisions

- [ADR-0005](../decisions/0005-auditor-periodic-scoring.md) — @Auditor 5 維度評分
- [ADR-0013](../decisions/0013-dod-self-audit.md) — DoD 自評 + Gate Check
