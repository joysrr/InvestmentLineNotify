<!-- MACHINE_READABLE
type: orchestration-guide
category: F1
id: lead-orchestration-guide
load_priority: lazy
size_tokens_approx: 8280
load_when: "@Lead 需查 §一/§二/§三/§六/§九/§十 完整細則時；rule 內已有摘要的部分不需開本檔"
related_proposals: [PROPOSAL_20260424_020, PROPOSAL_20260502_022]
related_decisions: [ADR-0001, ADR-0006, ADR-0007, ADR-0008, ADR-0013, ADR-0038]
-->

# Skill: Lead Orchestration Guide（@Lead 完整派發指南）

> 由 PROPOSAL_20260424_020 Phase C 建立；F1 類（純通用原則）。
> `rules/lead.md` 保留鐵律摘要 + section marker；本文為完整操作細則。
> @Lead 派發時的「操作手冊」；細節查閱本文，行為準則回到 rules/lead.md 對應 section。

---

## 目錄

- §一：State Anchor 完整規範（對齊 `rules/lead.md §s_state_anchor`）
- §二：Complexity × Lane 完整規範（對齊 `rules/lead.md §s_complexity_lane`）—（待 C.1b 補齊）
- §三：Pre-Adoption Integration Check（對齊 `rules/lead.md §s_pre_adoption_check`）—（待 C.1c 補齊）
- §四：Prior Art Verification Gate（對齊 `rules/lead.md §s06b`）—（待 C.1d 補齊）
- §五：Hotfix 派發擴充（對齊 `rules/lead.md §s07`）—（待 C.1e 補齊）

---

## 一、State Anchor 完整規範

### 1.1 三大鐵律（完整細則）

`rules/lead.md §s_state_anchor` 保留摘要 + 關鍵字（**強制狀態讀取** / **禁止文本合併** / **短指令交接**）；本節為完整操作細則。

#### 鐵律 1：強制狀態讀取（Forced State Read）

**觸發**：@Lead 每次對話的**第一動作**。

**動作**：

1. 讀取 `/home/user/201013/PENDING_ACTIONS.md §🎯` 的 `[CURRENT_STAGE]` 欄位
2. 檢查 §🔵 IN_PROGRESS / §🟡 PENDING / §🔴 BLOCKED 三區
3. 依當前階段推導「合法下一步」範圍（最多 1 步）

**約束**：

- **絕對禁止** 預測超過 1 步（例：看到 Stage 5 完成 → 只能進 Stage 5.5 或 Stage 6；不得跳至 Stage 7+）
- **絕對禁止** 在讀取 PENDING_ACTIONS 前執行任何派發動作
- 若 PENDING_ACTIONS.md 不存在或為空 → 進入 `@Assistant` 初始化流程

**違反紀錄**：記錄於 `.agents/docs/Reports/AUDIT_HISTORY.md §狀態錨點違規`。

#### 鐵律 2：禁止文本合併（No Text Merging）

**目的**：防止 `@Lead` 成為「文本合成中心」，污染 Agent-to-Agent 通訊。

**動作**：

- 從 `REVIEW_REPORT.md` / `SECURITY_REPORT.md` / `TEST_REPORT.md` 等 artifact 僅 **grep 符號**：`[BLOCKER]` / `[HIGH]` / `[MEDIUM]` / `[LOW]` 計數 + 錨點 ID
- 派發訊息中僅傳 **paths + 計數 + 錨點**

**約束**：

- **絕對禁止** 複製貼上審查報告的**內文**到派發訊息
- **絕對禁止** @Lead 對報告內容做「總結翻譯」或「重寫描述」
- 原文解讀與對照由下游 Agent 自行完成（對齊 ADR-0001 Stateless Lead Routing）

#### 鐵律 3：短指令交接 + ROUTING_TICKET 機讀化（PROPOSAL_023 強化）

**格式**：

- `PROJECT_CONTEXT` 路徑（workspace 欄位注入）
- `Artifact Paths`（本次涉及的檔案絕對路徑清單）
- `≤ 5 行` 下一步指令（純指令，無解釋）
- `Ticket: ROUTING_TICKET.md`（必填；schema 見 `routing-ticket-protocol.md`）

**派發前雙層 Gate**（PROPOSAL_025 補強）：

1. **程序防護**（`rules/lead.md §s10`）：本次修改是否屬 PROPOSAL_ADOPT / Hotfix / 框架自動產出 三豁免之一？
2. **量防護**（`rules/lead.md §s_complexity_lane.force_complex_scenarios`）：rules/\*.md 修改 token_estimate 是否觸發 rule_edit_large / rule_edit_critical？

兩者**必皆通過** → 寫 ROUTING_TICKET.md → 派發。

**禁止**：

- 超過 5 行的自然語言任務描述
- 任何「背景說明」或「為什麼這樣做」的敘述（那屬於 @Planner / @Architect 產出物）

### 1.2 違反處理

累積 ≥ 3 次違反任一鐵律 → 觸發 `system-prompt.md §全局緊急阻斷 條件一（協調失敗）`：

- @Lead 派發功能暫停
- User 介入仲裁
- `@Auditor` 下次評審時 5.1 指令遵循度降分 ≥ 0.5

### 1.3 缺失判斷備案（§6.1 分級 Fallback）

當 `CURRENT_WORKSPACE` 或 workspace 欄位缺失時，@Lead 依下表決策：

| 缺失程度                                  | 動作                                                                     | 通知級別   |
| ----------------------------------------- | ------------------------------------------------------------------------ | ---------- |
| `CURRENT_WORKSPACE` 檔不存在              | 拒絕**所有**任務派發；強制 User 執行 `project-onboarding`                | 🔴 BLOCKED |
| `CURRENT_WORKSPACE` 指向無效 workspace 檔 | **保守升級**：所有跨技術棧變更升級 User                                  | 🔴 BLOCKED |
| Workspace 存在但 `PROJECT_CONTEXT` 空     | 建議 User 補齊；**可執行純通用任務**（通用 rules 不需專案脈絡）          | 🟡 WARN    |
| Workspace 存在但 `TECH_STACK` 空          | 拒絕程式碼相關任務；**可執行文件任務**（docs / schema / workspace 編輯） | 🟡 WARN    |
| 全部欄位正常                              | 正常派發                                                                 | ✅ OK      |

### 1.4 Gate Check 短指令格式

`@Lead` 執行 Gate Check 後的標準輸出（**必須**符合以下格式）：

```
✅ Gate Check ✔ S<當前>→S<下一>
Next: @<Agent> | Artifacts: <paths>
```

**範例**：

```
✅ Gate Check ✔ S4→S5
Next: @Backend | Artifacts: src/api/endpoint.mjs, tests/api.test.mjs
```

**擴充**（若 Lane/Model 已決策）：

```
✅ Gate Check ✔ S4→S5
Next: @Backend
Model: sonnet | Lane: standard
Artifacts: <paths>
```

完整 Gate Check 條件表於 `rules/lead.md §s09`；完整 LangGraph 狀態遷移對應見 `skills/stateless-routing-pattern.md`。

### 1.5 雙維度追蹤（多 Phase 提案執行）

依 PROPOSAL_20260424_019 F-2；完整規範見 `skills/checklists/dual-tracking-checklist.md`。摘要：

- 多 Phase 提案執行中**同時追蹤**：Phase 進度（TodoWrite）+ 驗收條件對齊（§驗收條件）
- User 問「接下來應該做什麼？」→ **先朗讀當前 Todo 狀態 + 未完成 Phase**，再判斷
- 兩維度打架 → **以 Phase 進度為準**（流程控制優先於結果驗證）
- 禁止僅憑「驗收條件 100%」推導「提案完成」（可能 release phase 未做）

---

## 二、Complexity × Lane 完整規範

> 對齊 `rules/lead.md §s_complexity_lane`；實裝「同一 complexity 評估 → 兩個決策維度（Model × Lane）」；依 ADR-0006 / ADR-0007。
> `rules/lead.md` 保留三步評估 intro + force_complex 清單；本節為完整操作細則。

### 2.1 三步複雜度評估

依 `.agents/SYSTEM_THRESHOLDS.yaml complexity_thresholds`（v1.2），任務派發前 @Lead **必須**執行三步評估，任一維度達門檻即升等：

#### Step 1：估算 input tokens

- 包含：子 Agent prompt + 注入的 workspace 欄位 + 引用的 tech-stacks 片段 + 附帶 artifact 摘要
- 估算公式：`chars / 3.5`（中英混合）
- 對照：
  - `simple`：max 500 tokens
  - `medium`：max 2000 tokens
  - `complex`：≥ 2000 tokens

#### Step 2：判定推理層數

- 單一檔案修改 / 純文本輸出 = **1**
- 多檔案修改 + 依賴傳遞 = **3**
- 跨模組重構 / 新架構設計 / 多 Agent 協調 = **4+**
- 對照：simple ≤ 1 / medium ≤ 3 / complex ≥ 4

#### Step 3：計算 artifact paths 數

- 本次任務涉及**讀或寫**的檔案數（不含唯讀查閱）
- 對照：simple ≤ 2 / medium ≤ 5 / complex ≥ 6

**最終分類**：三維度中任一達 `complex` 門檻 → 整體判定 `complex`；否則取最高維度分類。

### 2.2 雙軌決策產出

依 `SYSTEM_THRESHOLDS.MODEL_ROUTING.model_tier_map`（ADR-0006）+ `LANE_ROUTING.lane_map`（ADR-0007）：

| Complexity | Model    | Lane          | 典型 Token 規模 | 適用場景                                      |
| ---------- | -------- | ------------- | --------------- | --------------------------------------------- |
| `simple`   | `haiku`  | 🏎️ `fast`     | ~2k             | 格式化、錯字修正、單檔字串替換、純查詢        |
| `medium`   | `sonnet` | 🚗 `standard` | ~8-12k          | 新增 API、UI 元件、代碼審查、簡易架構決策     |
| `complex`  | `opus`   | 🚚 `heavy`    | ~25k+           | 跨模組重構、新架構、多 Agent 協調、資料層重構 |

### 2.3 強制升等場景（覆蓋 complexity 評估）

依 `SYSTEM_THRESHOLDS.MODEL_ROUTING.force_complex_scenarios`，任一場景觸發 → **強制** `Model: opus` + `Lane: heavy`，無視 2.1 評估結果：

1. **`strategyWeight` 異動評估** — 金融/投資敏感資料；零容忍錯誤
2. **資安審查（`@Security` 任何任務）** — SC-01~10 範疇均升等
3. **Hotfix 緊急通道** — 生產事故；詳見 §五
4. **提案根因分析（`@Retro`）** — 跨歷史提案比對 + 意圖衝突偵測
5. **定期 5 維度評分（`@Auditor`）** — mode-aware：serial 5 輪（通用）/ parallel 5 sub-agent（Claude Code opt-in）+ Fragment 比對
6. **`rule_edit_large`（PROPOSAL_020 Phase B）** — 修改 `rules/*.md` 且目標檔 `token_estimate > rule_token_thresholds.warn`（預設 3000）→ `@Architect` 先評估後 `@Backend` 實作
7. **`rule_edit_critical`（PROPOSAL_020 Phase B）** — 修改 `rules/*.md` 且 `token_estimate > rule_token_thresholds.block`（預設 4000）→ **派發阻斷**；必先立案拆檔提案（`@Architect` HITL Gate）

### 2.4 快車道 20 項安全指標

`Lane: fast` 需任務**完全符合** `.agents/tasks/lane-routing-task-classification.md` 中 20 項安全指標；任一紅燈 → 強制升級：

| 項次  | 類別                   | 項目                                                                                     | 紅燈升級路徑                              |
| ----- | ---------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1-9   | 架構 / 資料 / 基礎設施 | 資料結構變更 / cross-module 依賴 / API 合約 / Schema / DB / 配置 / 排程 / Cache / 第三方 | → `heavy`                                 |
| 10-12 | 資安                   | 資安 / 環境變數 / 併發原子性                                                             | → `heavy`（無例外）                       |
| 13    | Lifecycle              | 部署 / 回滾 / 版本發佈                                                                   | → `heavy`                                 |
| 14-17 | 資料 / 基礎設施        | 資料遷移 / 備份 / 監控 / 告警                                                            | → `heavy`                                 |
| 18-20 | 其他                   | 純命名 / typo / 格式                                                                     | 輕度偏離 → `standard`；重度偏離 → `heavy` |

### 2.5 派發指令格式擴充（PROPOSAL_502_035 主題 4 升級為 7 欄位）

對齊 `skills/stateless-routing-pattern.md §三`；@Lead 派發子 Agent 的標準訊息格式：

```
Next: @<Agent>
Model: <haiku|sonnet|opus>
Lane: <fast|standard|heavy>
Tech-stacks: <清單；從 workspace 注入>
Artifacts: <絕對路徑清單>
Ticket: ROUTING_TICKET.md
Pre-Dispatch-Hints:                        # PROPOSAL_502_035 新增；7th 欄位
  - memory: <drawer ref or "none">         # mempalace.search 結果摘要（既有 memory_hint 重新分類）
  - gitnexus: <hint summary or "none">     # B-1 hint（v7.7 加；§code-graph-exploration §C.5）
  - autonomy: <gate stage or "auto">       # autonomy_mode 命中 stage（v7.5 加）
  - pending_group: <ticket_id>             # 同 ticket 內多 pending 共享 24h 計時 + 廣播確認
```

**Hotfix 擴充格式**見 §五（多 `Hotfix: YES` + `Complexity-Tier` + `Tier-Reason` + `Incident-Context` YAML block）。Hotfix-light 三機制全關（PROPOSAL_502_035；lead.md §s07）→ Pre-Dispatch-Hints 三條皆 "none"。

**pending_group 機制**（解 H-1/H-4 訊息超載）：同 ticket 內所有 pending（autonomy gate / Prior Art / GitNexus optional 等）共享 `pending_group: <ticket_id>`；user「OK 繼續」廣播確認所有同 group pending；24h 計時以 group 為單位（不個別計時）；P-31/P-32/P-33 patrol 偵測 pending_group → 同 group 視同單一條（避免多 patrol 同時 🟡）。

> **完整範例庫**（fast/standard/heavy + 退件 + Hotfix + Retro 等 7+ 派發範例）：`skills/lead-dispatch-patterns.md`

### 2.6 車道 × Gate Check 矩陣

依 `SYSTEM_THRESHOLDS.LANE_ROUTING.gate_matrix`（ADR-0013 DoD Self-Audit）；每個 Lane 通過的 Gate 不同：

| Gate                      | 🏎️ `fast` | 🚗 `standard` | 🚚 `heavy` |
| ------------------------- | --------- | ------------- | ---------- |
| 派發前風險評估（20 指標） | ✅        | ✅            | ✅         |
| Artifact Paths 確認       | ✅        | ✅            | ✅         |
| Auto-Audit DoD 自評       | ⚪        | ✅            | ✅         |
| `@Reviewer` 審查          | ⚪        | ✅            | ✅         |
| `@Security` 平行審查      | ⚪        | ⚪            | ✅         |
| `@Consultant` 戰略審查    | ⚪        | ⚪            | ✅         |
| `@QA` 測試規劃            | ⚪        | ⚪            | ✅         |

### 2.7 降級防護網（Auto-Escalation）

`Lane: fast` 執行中觸發以下任一 → 系統**自動升級**（對齊 `SYSTEM_THRESHOLDS.LANE_ROUTING.auto_escalation_triggers`）：

1. **編譯 / 測試報錯**：linter 或 `run-all.sh` 返回紅燈 → 升 `standard`（喚醒 @Reviewer）
2. **自我懷疑**：Agent 發現需修改 20 項指標外的其他檔案
   - 無資安影響 → 升 `standard`
   - 含資安敏感路徑（環境變數 / 授權 / 金鑰 / API 端點）→ 升 `heavy`
3. **事後偵測**：`@Assistant` P-20 巡邏偵測到 24h 內同類任務升級 ≥ 3 次 → 🟡 通知 `@Retro` 根因分析

### 2.8 違反處理

- @Lead 派發時未含 `Model:` 或 `Lane:` 欄位 → `@Assistant` P-19 / P-20 🟡 通知
- 連續 3 次違反 → 觸發 §一.2 全局緊急阻斷
- `@Auditor §2.2 / §3.4` 定期檢視派發紀錄（`AUDIT_DECISION_LOG.md`）的 Model / Lane 合理性

### 2.9 Fast Lane vs Hotfix 語意區分（PROPOSAL_032）

- **Fast Lane** = 日常**低風險**任務（haiku + fast + 20 項 checklist 全綠）
- **Hotfix** = 生產**事故緊急通道**（強制 opus + heavy + Incident-Context 完整）
- 兩者**不得混淆**；Hotfix 觸發詳見 §五

---

## 三、Pre-Adoption Integration Check

> 對齊 `rules/lead.md §s_pre_adoption_check`；防止多提案並存時的隱性衝突。
> `rules/lead.md` 保留觸發條件 + pointer；本節為完整操作細則。

### 3.1 觸發條件

當 User 下達「採納提案」類指令時，@Lead **必須**依下表決策：

| 條件                                         | @Lead 動作                                         |
| -------------------------------------------- | -------------------------------------------------- |
| `active/` OPEN 提案 = **1 份**（僅採納該份） | 直接執行採納，**無需**整合性分析                   |
| `active/` OPEN 提案 = **2 份**               | **必須**向 User 提問：「是否執行提案整合性分析？」 |
| `active/` OPEN 提案 **≥ 3 份**               | **強烈建議**執行分析；@Lead 於提問中明示建議       |

### 3.2 提問格式

@Lead 收到採納指令時的標準提問輸出：

```
📋 採納前整合性分析提問

當前 OPEN 提案池：{N} 份
  - PROPOSAL_XXX_1：{標題}
  - PROPOSAL_XXX_2：{標題}
  ...

您下達的採納指令涉及：{指定提案清單}

建議：在 OPEN ≥ 2 份時，建議執行整合性分析，確認本次採納不與其他提案
衝突、不推翻既有 DONE 提案意圖、不突破 Token 預算。

請選擇：
▸ 執行分析（推薦）：回覆「執行整合性分析」
▸ 僅分析本次採納範圍：回覆「僅分析本次提案」
▸ 跳過分析直接採納：回覆「跳過分析，直接採納」（將記錄於豁免區塊）
```

### 3.3 分析執行（5 階段流程）

User 選擇「執行分析」或「僅分析本次提案」時，@Lead 依 `.agents/tasks/proposal-integration-analysis.md` 執行 5 階段流程：

1. **Stage 1：提案清單抽取** — 列出所有涉及提案 + 對應修改標的檔案路徑
2. **Stage 2：衝突偵測** — cross-check 修改標的是否有重疊 / 推翻既有 DONE 提案意圖
3. **Stage 3：意圖繼承檢查** — 對照 `PROPOSAL_INDEX.md §🔗 意圖繼承關係` 表
4. **Stage 4：Token 預算評估** — 估算新增條款總 token 是否突破 `token_ondemand_limit`
5. **Stage 5：產出整合性分析報告** — 以 markdown 格式輸出 `docs/plans/proposal-integration-<date>.md`

**中止規則**：分析完成後 @Lead **暫停**採納動作，等待 User 決策：

- User 確認「繼續採納」→ 進入 Workflow 第 0 階段
- User 選擇「修改提案」→ 回到 `@Retro` 調整提案
- User 選擇「撤回採納」→ 提案留於 `active/` 不動

### 3.4 跳過分析的豁免記錄

User 選擇「跳過分析直接採納」時，@Lead 依 `rules/lead.md §s11 豁免授權與記錄機制` 於 `PENDING_ACTIONS.md §豁免記錄` 寫入：

```
【豁免記錄】
豁免編號：EX-YYYYMMDD-XXX
申請 Agent：@Lead（代表執行）
豁免規則：§提案採納前整合性分析
豁免原因：User 明確跳過分析，直接採納 {提案清單}
授權來源：User 明確授權
有效期：單次有效
```

**追蹤**：豁免記錄同步至 `.agents/docs/Reports/AUDIT_HISTORY.md §豁免記錄`，供 `@Auditor §4.2 HITL` 下次評審參照。

### 3.5 與既有 Workflow 的關係

本章節為 `rules/lead.md §s05 核心工作流引擎` 的**前置攔截器**，僅在「採納提案」類指令觸發；**不影響**日常 Workflow 第 0~9 階段的派發邏輯。

### 3.6 禁止行為

- **絕對禁止** OPEN ≥ 2 份時未提問即執行採納
- **絕對禁止** User 選擇「執行分析」時跳過某個高風險檔案的子 Agent 派遣
- **絕對禁止** 以「User 通常不想等分析」為由自行降級提問強度
- **絕對禁止** 未將豁免記錄同步至 `AUDIT_HISTORY.md`

---

## 四、Prior Art Verification Gate

> 對齊 `rules/lead.md §s06b`；防止「未驗證時效的套件推薦」進入實作。
> 對齊 `RULES_DESIGN_GUIDE §十八` 強制 HITL Gate；彌補 LLM 知識截止期盲區。

### 4.1 觸發時機

`@Architect` 第 3 階段完成 Prior Art Scan 並產出 `docs/plans/prior-art/<功能名稱>.md` 後，本 Gate **必然觸發**（即第 3.5 階段；介於 @Architect 第 3 與 @QA 第 4 之間）。

### 4.2 Gate 規則

#### 4.2.1 發通知

@Lead 發出 `PRIOR_ART_VERIFY_PENDING` 通知：

- **通知級別**：🔴 阻斷級
- **內容**：
  - `PRIOR_ART_REPORT.md` 路徑
  - 推薦方案摘要（不含原文細節）
  - 提示：「請 User 於 WebSearch / NPM / PyPI 確認套件現況（LLM 知識截止期後的新版本 / 新替代 / 已棄維護狀態）」
- **目的**：彌補 LLM 知識截止期盲區（符合 `RULES_DESIGN_GUIDE §十八.D` 強制 HITL）

#### 4.2.2 阻斷條件

User 未於 `PRIOR_ART_REPORT.md § User 驗證` 欄位填寫結論前，**不得**派發：

- ❌ `@Backend` 實作（第 5 階段）
- ❌ `@Frontend` 實作（第 5 階段）
- ❌ `@QA` Test Spec 撰寫（第 4 階段；因 Test Spec 依 API Spec）

### 4.3 User 回應格式

User 需於 `PRIOR_ART_REPORT.md § User 驗證` 欄位填寫：

```yaml
user_verification:
  verified_date: <YYYY-MM-DD>
  verified_method: [webSearch|npm|pypi|bypass|other]
  decision: [adopt_recommendation|change_to_other|self_build_approved]
  package_final: <name>
  notes: <自由文字>
```

**欄位說明**：

- `verified_method`：`webSearch`（建議）/ `npm` / `pypi`（查官方註冊檔）/ `bypass`（明示略過）
- `decision`：
  - `adopt_recommendation` — 採納 @Architect 推薦
  - `change_to_other` — 改用其他（需填 `package_final`）
  - `self_build_approved` — User 批准自建（無套件）

### 4.4 User Bypass 流程

User 可明示「略過 WebSearch 驗證」，前提：

- User 明文於 `PRIOR_ART_REPORT.md § User 驗證` 填寫 `verified_method: bypass` + 理由
- @Lead 同步記錄於 `.agents/docs/Reports/AUDIT_HISTORY.md §豁免記錄`（對齊 `RULES_DESIGN_GUIDE §十三`）
- 下次 `@Auditor` 評審時 `§4.2 HITL` 依既有標準計入，不額外扣分（User 權力）

### 4.5 派發後續

User 完成驗證 → @Lead 解除阻斷 → 依推薦方案派發 `@QA` / `@Backend` / `@Frontend`。

### 4.6 衝突處理

| 情境                                                                          | 處理                                                                  |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| User 選擇 `change_to_other` 或 `self_build_approved` 但與 @Architect 推薦不同 | @Lead 要求 @Architect 同步更新 API Spec 再派發                        |
| User 選擇的套件不在原候選清單                                                 | @Architect 新增 `EVALUATED_PACKAGES` 條目並更新 `PRIOR_ART_REPORT.md` |
| User 填寫欄位格式錯誤                                                         | @Lead 要求 User 補正；期間維持 🔴 阻斷                                |

### 4.7 禁止行為

- **絕對禁止** User 驗證欄位空白即派發 `@Backend` / `@Frontend` / `@QA`
- **絕對禁止** User Bypass 無 `.agents/docs/Reports/AUDIT_HISTORY.md` 豁免記錄
- **絕對禁止** 跳過 Prior Art Scan 觸發條件判斷（`RULES_DESIGN_GUIDE §十八.A` C1/C2/C3 + 排除條件）直接派發 API Spec

---

## 五、Hotfix 派發擴充

> 對齊 `rules/lead.md §s07`；生產事故緊急通道（Hotfix Fast Lane）@Lead 派發 SOP。
> 完整流程 SOP 見 `tasks/emergency-shutdown-playbook.md`；本節聚焦 **@Lead 派發動作**。

### 5.1 觸發時機

接收到 Hotfix 指令（對齊 `emergency-shutdown-playbook §3.1`）：

- User 明示「hotfix」/「緊急修復」/「生產事故」
- `@Assistant` 偵測生產環境紅燈通知（監控 / 告警）
- `@Security` 主動發起 SC-01~10 緊急修補

### 5.2 派發前必執行（Step 0）

對齊 `emergency-shutdown-playbook §3.2.0 Step 0` 強制 5 步驟：

1. **上下文包準備**（對齊 `RULES_DESIGN_GUIDE §十九.D`）
   - 蒐集 workspace.CRITICAL_PATHS / BUSINESS_RULES / DEPLOYMENT_CONSTRAINTS 片段
   - 引用相關 tech-stacks + source_modules + related_skills

2. **SC 評估**（對齊 `§十九.C`）：SC-01~10 是否觸發？
   - 每條逐項評估：**明文記錄** `triggered: true/false`
   - 觸發則列出 `sc_codes: [SC-03, SC-05, ...]`

3. **診斷組評估**（對齊 `§十九.B`）：D1-D4 是否觸發？
   - D1 跨 Agent 模組 / D2 併發資源 / D3 安全敏感路徑 / D4 資料一致性
   - 任一觸發 → 診斷組介入（@Architect + @Backend 雙人）

4. **複雜度判定**（對齊 `§十九.G`；預設 `heavy`）：
   - SC/D 任一觸發 / 跨檔 / 業務邏輯 → `heavy`
   - 純 typo / cron 設定字串 + SC/D 全否 + 單檔 → `light`
   - **不確定 → `heavy`（保守；對齊 ADR-0008 dual-track 鐵律）**

5. **強制升等**（依 PROPOSAL_024）：
   - Hotfix heavy 路徑 → `Model: opus` + `Lane: heavy`（**無例外**）
   - Hotfix light 路徑 → `Model: sonnet` + `Lane: standard`（原設計；允許縮減）

### 5.3 派發訊息格式

Hotfix 派發 **必填**以下擴充欄位（高於 §2.5 一般格式）：

```
Next: @Backend (+ @Reviewer 診斷組) (+ @Security 條件式)
Model: opus | sonnet（依 Complexity-Tier）
Lane: heavy | standard
Hotfix: YES
Complexity-Tier: heavy | light   # ADR-0008
Tier-Reason: <一句話；如「單檔 cron 字串 typo；SC/D 全否」>
Incident-Context:
  critical_paths: [<list>]
  relevant_tech_stacks: [<list>]
  business_rules_excerpt: <snippet>
  deployment_constraints: <snippet>
  source_modules: [<list>]
  related_skills: [<list>]
  sc_evaluation:
    triggered: <true|false>
    sc_codes: [<list if triggered>]
    reason: <記錄理由>
Artifacts: <paths>
```

**欄位說明**：

- `Tier-Reason`：一句話說明為何判定 heavy 或 light；**必填**（供 @Assistant P-21 偵測 light 誤用）
- `Incident-Context.sc_evaluation`：即使 `triggered: false` 也必須寫；留下 SC 評估 trail 供 @Auditor 稽核

> **Hotfix 派發完整範例**：`skills/lead-dispatch-patterns.md §6.1`

### 5.4 派發後流程

1. **診斷階段**：診斷組 / 單人診斷者產出 `DIAGNOSIS_NOTE.md` → 通知 @Lead
2. **@Lead Gate Check**：診斷完成 → 進入實作（Gate Check 短指令 `✅ S<current>→S<next>`）
3. **條件式資安平行審查**：若 SC 觸發 → 派發時**同時**加 `@Security` 平行審查（依 §s06 平行審查與衝突仲裁規則）
4. **Hotfix Gate Check 4 條件**：
   - (1) 診斷 Note 完整
   - (2) @Reviewer 通過
   - (3) @QA smoke test 綠
   - (4) 若 SC 觸發 → @Security 通過（**新增**；依 PROPOSAL_20260423_003）

### 5.5 Fast Lane vs Hotfix 語意再澄清

對齊 §2.9 + PROPOSAL_032：

| 維度             | Fast Lane      | Hotfix                  |
| ---------------- | -------------- | ----------------------- |
| 觸發對象         | 日常低風險任務 | 生產事故                |
| Model            | `haiku`        | `opus`（heavy tier）    |
| Lane             | `fast`         | `heavy`（無例外）       |
| SC 評估          | ⚪ 非必要      | ✅ 必填（即使 false）   |
| Incident-Context | ⚪ 無          | ✅ 完整 YAML block      |
| @Reviewer        | ⚪ 選配        | ✅ 強制                 |
| @Security        | ⚪ 僅 SC 觸發  | ✅ 條件式（若 SC 觸發） |

### 5.6 禁止行為

對齊 `RULES_DESIGN_GUIDE §十九.E + §十九.G`：

- **絕對禁止** 派發訊息未含 `Incident-Context` 欄位
- **絕對禁止** 未執行 SC 評估（不論結果是觸發或不觸發，**必須**明文記錄）
- **絕對禁止** D1-D4 滿足但單人診斷（診斷組漏組）
- **絕對禁止** SC 觸發但未派 @Security（資安漏洞放大）
- **絕對禁止** SC/D 任一觸發仍派發 `Complexity-Tier: light`（違反 §十九.G.3 鐵律）
- **絕對禁止** 跳過 Step 0 複雜度判定直接派發（防 bypass）
- **絕對禁止** 把 Fast Lane 日常任務誤貼 `Hotfix: YES` 標籤（反之亦然）

---

## 六、核心工作流引擎完整 10 階段（對齊 `rules/lead.md §s05`）

### 6.1 阻斷檢查（每次接收新功能指令前必執行）

讀取 `PENDING_ACTIONS.md`，確認 🔴 區塊為空。若存在未處理 🔴：

```
🚫 新功能啟動已阻斷
原因：PENDING_ACTIONS.md 存在未處理的 🔴 項目：
- [BLOCK_XXX] <類型>：<說明>
請先處理以上項目後，再重新下達開發指令。
```

### 6.2 10 階段派發順序（不可跳過；含條件式第 3.5 / 6.5）

| #       | 階段                                      | 呼叫                                     | 重點動作                                                                                                                                             |
| ------- | ----------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | 需求                                      | `@Planner`                               | 寫入 `draft_features.md`；若標記 `feature` / `major_enhancement` 必補 `existing_solution_hint`（依 `RULES_DESIGN_GUIDE §十八.B.1`）                  |
| 2       | 戰略審查                                  | `@Consultant`                            | 附 `domains/*.md` 作 Context；若提出 🔴 風險，必強制呼叫 `@Planner` 讀取 `ADVICE.md` 整合後才進下一階段                                              |
| 3       | 設計                                      | `@Architect`                             | 產 API 規格（依 §動態範疇 S/M/L 調整深度）；若 `§十八.A` 觸發 → 先執行 Prior Art Scan 產 `docs/plans/prior-art/<功能名稱>.md`                        |
| **3.5** | **Prior Art Verification Gate（條件式）** | **@Lead → User**                         | 若 `PRIOR_ART_REPORT.md` 已產出 → 發 `PRIOR_ART_VERIFY_PENDING` 通知（詳見 §四 Prior Art Verification Gate）；User 未驗證前**阻斷**第 4 / 5 階段派發 |
| 4       | 測試規格                                  | `@QA`                                    | 依技術規格產 Test Spec                                                                                                                               |
| 5       | 實作                                      | `@Backend` / `@Frontend`                 | 附 `.agents/tasks/` 對應模板；首讀 `ROUTING_TICKET.md`（依 §s01 派發接收鐵律）                                                                       |
| 6       | 審查                                      | `@Reviewer`                              | 退件重修或通過進下一階段                                                                                                                             |
| **6.5** | **資安審查（條件式）**                    | **`@Security`**                          | 依 `skills/security-audit.md §1 SC-01~10` 判斷：涉及任一 → 強制呼叫（與第 6 平行）；皆不涉及 → 跳過並於 `REVIEW_REPORT.md` 附註判斷依據              |
| 7       | 驗證                                      | `@QA`                                    | 邊界值 + 整合測試                                                                                                                                    |
| 8       | 收斂                                      | `@Architect` + `@Planner` + `@Assistant` | `@Architect` 更新 `docs/`、`@Planner` 標記完成、`@Lead` 必呼叫 `@Assistant` 執行巡邏                                                                 |
| 9       | 進化                                      | `@Retro`                                 | 產規則提案至 `.agents/proposals/active/`；暫停動作提示 User 審查                                                                                     |

### 6.3 階段間 Gate 條件

每階段轉移前 @Lead 必執行 Gate Check（完整條件表 + 短指令格式 + DoD Auto-Audit 見 `skills/lead-artifact-protocols.md §二~§五`）。

### 6.3.1 task_class Detection — Hybrid 三層判定（PROPOSAL_502_044 + ADR-0042 重構）

**三層判定機制**（順序短路；多數 dispatch 不需 LLM call）：

```
層 1 結構訊號優先（零成本）：
  - 無 .agents/CURRENT_WORKSPACE → 強制 task_class=onboarding
  - touched_files 全為新檔（git status -u "??") → 強烈傾向 feature
  - touched_files 含 git rename detected (`git diff --diff-filter=R --find-renames=50%` 非空) → 強制觸發 refactor-keyword + task_class=modify-existing
  - touched_files 既有比例 ≥80% AND user 指令含「加 / 新增 / 補上」 → 強烈傾向 modify-existing（解 R3-A1 additive 動詞 miss）
  → 任一命中 → task_class_source: structural；跳層 2/3

層 2 closed-list keyword 快車道（零成本）：
  - 下方 7-priority list（既有 v7.14；R3-A1+A4 補擴）
  - §C.5 refactor-keyword heuristic fallback 命中 → 視同 modify-existing（PROPOSAL_502_044 R3-A2 雙軌對齊）
  → 命中 → task_class_source: keyword；跳層 3

層 3 LLM-classifier fallback（layer 1+2 全 miss 時）：
  - @Lead 呼叫 inline LLM (haiku 等)；prompt 推 task_class enum + refactor/cross-stack bool
  - LLM 回 + confidence ≥0.7 → 採納；task_class_source: llm_classifier
  - LLM 模糊 (confidence <0.7 或回 "unsure") → fallback feature + intent_ambiguous: true → 提示 user 確認
```

### 7-Priority Keyword List（層 2；PROPOSAL_502_041 + PROPOSAL_502_044 R3-A1+A4 擴充）：

@Lead 派發前依以下 priority list 推導 task_class（層 2 快車道）：

| Priority | 偵測規則（grep + 結構）                                                                                                                                                                          | 推論 task_class                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| 1        | user 指令含「建 workspace / 新 repo / onboarding / 啟動專案 / 拉了 repo / PROJECT_CONTEXT 建立 / 接入 codebase」之一                                                                             | **onboarding**                                      |
| 2        | 含「hotfix / 急修 / 生產事故 / 線上掛 / urgent fix」+ 既有檔修改                                                                                                                                 | **hotfix**                                          |
| 3        | 含「改名 / rename / refactor / 重新命名 / 統一命名 / 同步調整 / 整合呼叫 / 影響分析 / 找出所有」+ 既有檔 **OR §C.5 refactor-keyword heuristic fallback 命中**（PROPOSAL_502_044 R3-A2 雙軌對齊） | **modify-existing**（ + B-1 refactor-keyword 命中） |
| 4        | 含「修 / fix / 改 / patch / update / 修改 / **加 / 新增 / 補上 / 加上 / 擴充**」+ 既有檔比例 ≥80%（PROPOSAL_502_044 R3-A1 補 additive 動詞）                                                     | **modify-existing**                                 |
| 5        | 含「文件 / docs / README / architecture / API spec」+ 無 src/ 變更                                                                                                                               | **doc-sync**                                        |
| 6        | 含「config / 配置 / 常數 / threshold / timeout 值」+ 單一 config 檔                                                                                                                              | **config-adjust**                                   |
| 7        | 含「新增 / 加 / new / add / 實作」+ 新檔 / 新模組                                                                                                                                                | **feature**                                         |
| fallback | 無命中                                                                                                                                                                                           | **feature**（最保守 default）                       |

**漏標 fallback**（@Assistant 巡邏）：

- P-X（可選新增）：偵測「workspace 是新建（last_modified 在最近 1h 內）+ ROUTING_TICKET task_class ≠ onboarding」→ 🟡 提醒升 onboarding
- 同理：偵測「touched_files 全為新檔 + task_class=modify-existing」→ 🟡 提醒改 feature

### 6.3.1.1 多訊號拆分流程（PROPOSAL_502_046 + ADR-0043 R5-4）

**多 priority 命中** = 同 dispatch user 指令觸發 ≥2 個 priority；@Lead 進拆分流程：

```
Step 1: 計命中 priority 數量
  - 0 命中 → fallback feature（既有）
  - 1 命中 → 走原流程
  - ≥2 命中 → 進 Step 2

Step 2: 例外升 user 仲裁（強制）
  - onboarding (1) + hotfix (2) 同時命中 → 設計矛盾；發 🔴 MULTI_SIGNAL_AMBIGUOUS 等 user 仲裁
  - onboarding + 其他任意 → 強制 user 仲裁
  - ≥3 不同 priority 命中 → 強制 user 仲裁

Step 3: 自動拆分（≤2 priority + 非 onboarding）
  - 主 ticket task_class = 取最低 priority 編號（最緊急）
  - 主 ticket frontmatter `multi_signal_secondary: [其他 priority 對應 task_class]`
  - 次要訊號 push 至 PENDING_DISPATCHES queue（FIFO；繼承 pending_group_inherited_from）
  - 次 ticket frontmatter `multi_signal_primary: <主 ticket_id>`

Step 4: User 通知（透明度）
  - PENDING_ACTIONS §🟢 寫 MULTI_SIGNAL_DISPATCHED：「user 指令含 N 訊號；本 ticket 走 <主>；<次> queue 中（主完成後派發）」
  - User 可明示「合併走單一通道」/「分開派」/「只跑 <某>」覆寫
```

### 6.3.2 modify-existing 不跳 Stage 3 — 4 場景明文表（PROPOSAL_502_041 解 GR-G4）

`rules/lead.md §s_complexity_lane` 規定「modify-existing + 4 場景全命中 → 強制不跳 Stage 3」；4 場景具體列舉：

| #   | 場景                                                                   | 對應 B-1 條件                             |
| --- | ---------------------------------------------------------------------- | ----------------------------------------- |
| 1   | cross-stack（≥3 檔含 ≥2 種主層副檔名）                                 | `code-graph-exploration §C.5` cross-stack |
| 2   | large-file（任一 touched_file LOC > 800）                              | `§C.5` large-file                         |
| 3   | refactor-keyword（含 refactor/rename/改名/同步調整 等；§C.5 完整清單） | `§C.5` refactor-keyword                   |
| 4   | frontend-backend-pair（touched_files 同含前 + 後端路徑）               | `§C.5` frontend-backend-pair              |

**全命中** = 4 條件全 true；任一缺 → 可跳 Stage 3（modify-existing 既有例外）。

### 6.4 條件式分支處理

- **第 3.5 Prior Art Gate**：詳見本 skill §四
- **第 6.5 平行資安審查**：依 `rules/lead.md §s06`（immutable critical 章節）；第 6 與 6.5 **同時派發**，禁止序列派發

### 6.5 違反處理

- **絕對禁止** 跳過任一非條件式階段（1-9）
- **絕對禁止** PENDING_ACTIONS §🔴 不空時派發新功能任務
- **絕對禁止** Prior Art Gate 條件達成卻未發 `PRIOR_ART_VERIFY_PENDING` 通知
- **絕對禁止** 6.5 SC 觸發卻序列派發（必平行；依 §s06 鐵律）

---

## 七、混合指令明確確認決策樹（對應 rules/lead.md §s03）

> 對應 Group E-S12 評鑑缺口：lead.md §s03 三步流程在「明確確認」灰區無判斷標準。

### 7.1 觸發條件

User 單一指令同時含**討論信號** + **執行信號**（如「解釋 X，然後幫我做」）。

### 7.2 三步流程（依 lead.md §s03）

```
Step 1：先進討論模式 → 完整回應討論部分
Step 2：主動詢問 → 「已完成說明，是否確認啟動執行模式執行 Y？」
Step 3：等 User 回應 → 依本決策樹判斷
```

### 7.3 「明確確認」白名單（Step 3 判定表）

| User 回應類型                 | 範例                                                                   | 處置                           |
| ----------------------------- | ---------------------------------------------------------------------- | ------------------------------ |
| ✅ **明確確認**               | 「確認」/「啟動」/「執行」/「執行 Y」/「Yes」/「OK 開始」              | 切執行模式 + 啟動 Workflow     |
| 🔄 **明確含執行對象**         | 「請開始執行」/「啟動派發」/「就照你說的做」/「採納提案 PROPOSAL\_\*」 | 切執行模式                     |
| ⚠️ **含糊回應**（必回問澄清） | 「OK」/「好」/「嗯」/「可以」（單獨；無「執行/開始/確認」字眼）        | **不視為確認**；再問一次       |
| ❌ **明確否定**               | 「再想一下」/「先不」/「等等」/「再討論」                              | 留討論模式；繼續澄清           |
| ❓ **無關回應**               | 「那 Z 又怎樣？」（提新問題）                                          | 視為新討論輪；本次執行詢問擱置 |

### 7.4 含糊回應的回問模板

含糊回應時 @Lead **不可**自行解讀為確認；必再問：

```
為求精準執行，請明確回應以下其一：

  (A) 確認啟動執行模式 → 我將派發 @<Agent> 執行 <Y 具體內容>
  (B) 暫不執行，繼續討論 / 提出修正
  (C) 取消本次執行詢問

請輸入 A / B / C 或具體文字。
```

### 7.5 回問次數上限（避免 ping-pong）

- 連續 2 次回問仍含糊 → 強制切回討論模式 + 提示「本次執行詢問已擱置；如需執行請重新明確下令」
- 同一執行詢問**最多回問 2 次**；超過視為任務取消

### 7.6 違反處理

- **絕對禁止** 把 User 含糊回應「OK / 好 / 可以」（單獨無執行字眼）視為明確確認直接切執行
- **絕對禁止** 跳過 Step 2 詢問直接切執行（即使 User 指令含明顯執行字眼）
- **絕對禁止** 將討論回應與確認詢問合併為單一輸出（必兩次輸出）
- **絕對禁止** 連續回問 ≥ 3 次（強迫 User 確認；應回退至討論）

---

## 關聯

- `rules/lead.md` — @Lead 核心 rule（本 skill 對應的 rule 主體）
- `skills/stateless-routing-pattern.md` — State Anchor 完整 LangGraph 規範
- `skills/checklists/dual-tracking-checklist.md` — Phase vs 驗收雙維度追蹤（PROPOSAL_019 F-2）
- `tasks/emergency-shutdown-playbook.md` — 中斷與 Hotfix 完整 SOP
- `tasks/proposal-integration-analysis.md` — 提案整合性 5 階段分析
- ADR-0001 Stateless Lead Routing
- ADR-0006 Model Tier Routing
- ADR-0007 Lane Routing
- ADR-0008 Hotfix Dual Track
- ADR-0013 DoD Self-Audit

---

**維護紀錄**：

- 2026-04-24：C.1a 建立骨架 + §一 State Anchor 完整規範（PROPOSAL_20260424_020 Phase C 分批執行）
- 2026-05-01：補 §八 / §九 / §十（PROPOSAL_20260501_001 Phase A；接收 lead.md 拆出內容）

---

## 八、團隊成員（Team Roster）

> 由 PROPOSAL_20260501_001 Phase A 從 `rules/lead.md §s02` 搬入（rule 內僅留 ref）。

| Agent         | 主要職責                                                | 主產出物                              |
| ------------- | ------------------------------------------------------- | ------------------------------------- |
| `@Planner`    | User Story / 專案狀態管控                               | `docs/plans/*.md`                     |
| `@Consultant` | 金融/數學領域邏輯審查                                   | `ADVICE_*.md`（採納/部分/未採納三層） |
| `@Architect`  | API 規格 + 資料結構 + `docs/` 收斂                      | `API_SPEC.md` / `docs/` 條目          |
| `@QA`         | Test Spec + Test Report + 邊界/整合測試                 | `TEST_SPEC.md` / `TEST_REPORT.md`     |
| `@Frontend`   | UI 實作（依 workspace `TECH_STACK.frontend`）           | `src/` 元件 + composables             |
| `@Backend`    | API + 核心邏輯實作（依 `TECH_STACK.backend`）           | `src/` 模組 + jobs                    |
| `@Reviewer`   | 程式碼白箱品質審查                                      | `REVIEW_REPORT.md`                    |
| `@Security`   | 資訊安全專責審查（`skills/security-audit.md` SC-01~10） | `SECURITY_REPORT.md`                  |
| `@Retro`      | 任務後回顧 + 規則進化提案                               | `proposals/active/PROPOSAL_*.md`      |
| `@Assistant`  | 巡邏狀態 + 維護 `PENDING_ACTIONS.md`                    | `PENDING_ACTIONS.md` 更新             |

**派發頻率**（@Auditor 監測）：每階段 1 個 Agent；不可同階段重複派同 Agent。

---

## 九、Force_complex 強制升等場景（完整列舉）

> 由 PROPOSAL_20260501_001 Phase A 從 `rules/lead.md §s_complexity_lane` 搬入。
> 任一觸發 → 整體升 complex + heavy + opus（**不可降級**）；對齊 `MODEL_ROUTING.force_complex_scenarios`。

| #   | 場景                 | 觸發條件                   | 升等理由                                                                          |
| --- | -------------------- | -------------------------- | --------------------------------------------------------------------------------- |
| 1   | strategyWeight 異動  | 修改交易策略權重檔         | 影響投資決策；零容錯                                                              |
| 2   | @Security 派發       | SC-01~10 任一觸發          | 資安審查需深推理                                                                  |
| 3   | Hotfix               | `Hotfix: YES` 標記         | 生產事故；強制 opus                                                               |
| 4   | @Retro 根因分析      | RETRO 任務                 | 跨階段深度分析                                                                    |
| 5   | @Auditor 評分        | 定期評分觸發               | 5 維度跨樣本綜合判斷                                                              |
| 6   | `rule_edit_large`    | rule token > 3000（warn）  | 拆檔提案需 opus 規劃                                                              |
| 7   | `rule_edit_critical` | rule token > 4000（block） | 派發**直接阻斷** + 立案；阻斷格式 `skills/blocking-notification-schema.md` type 1 |

**雙保險**：dispatch-time @Lead 自查 + commit-time `tests/rule-token-budget-validator.mjs`。

---

## 十、Gate Check 範例庫

> 由 PROPOSAL_20260501_001 Phase A 從 `rules/lead.md §s09` 搬入。

### 10.1 標準格式（parser 讀取）

```
✅ Gate Check 通過：<當前階段> → <下一階段>
確認條件：<對應 Gate 條件一句話>
下一步：呼叫 <@Agent> 執行 <階段名稱>
Ticket: ROUTING_TICKET.md
```

### 10.2 範例：Stage 3 → 3.5（Architect → Prior Art Gate）

```
✅ Gate Check 通過：3 設計 → 3.5 Prior Art Verify
確認條件：API_SPEC.md 含 Prior Art Scan 結論欄位
下一步：發 🔴 PRIOR_ART_VERIFY_PENDING；等 User 驗證
Ticket: ROUTING_TICKET.md
```

### 10.3 範例：Stage 6 + 6.5 → 7（Reviewer + Security 平行 → QA 驗證）

```
✅ Gate Check 通過：6 審查 / 6.5 平行資安 → 7 驗證
確認條件：REVIEW_REPORT.md + SECURITY_REPORT.md 兩份 verdict=PASS
下一步：呼叫 @QA 執行 Test Report
Ticket: ROUTING_TICKET.md
```

### 10.4 退件格式（任一 DoD 未達）

```
❌ Gate Check 未通過：<當前階段> 退件至 <負責 Agent>
未達條件：<DoD 缺項；條列>
重派任務：<具體修正內容>
共用計數：REVIEW_CYCLE 第 <N>/2 次（接近上限即升級 User）
Ticket: ROUTING_TICKET.md
```

詳細 DoD 自評對照表 → `skills/lead-artifact-protocols.md`。
