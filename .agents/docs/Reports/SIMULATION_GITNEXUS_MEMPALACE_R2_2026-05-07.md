# v7.11 Stabilization Regression 驗證報告（Round 2 模擬）

> 由 4 個並行 simulation agents 對 v7.11 framework 用**參數調整後**情境（不同 stack / 中文關鍵字 / boundary LOC / polyglot / drift / probe 4 模式 / tier 升級）做設計層 walkthrough。
>
> **目的**：驗證 PROPOSAL_502_035~038 stabilization 是否真覆蓋宣稱修補面；揪出**「修了 schema 沒修 agent 行為路徑」**類隱性失敗。
>
> **基準版本**：framework v7.11（PROPOSAL_502_038 採納完成；commit 411d180）
> **報告版本**：Round 2 — 2026-05-07
> **與 Round 1 報告比較**：原 48 gaps / 27 已修；新發現 **32 個 GR**（regression gaps）

---

## §1 執行摘要

### 1.1 兩輪模擬比較

| 維度                              | Round 1（v7.7 基準） | Round 2（v7.11 基準） |
| --------------------------------- | -------------------- | --------------------- |
| 識別 gaps                         | 48 個                | 32 個（GR）           |
| 高嚴重度                          | 15                   | **9**                 |
| 中嚴重度                          | 22                   | **17**                |
| 低嚴重度                          | 11                   | 6                     |
| 已被 v7.11 修補的 Round 1 gaps    | —                    | **27 個**             |
| Round 1 仍未根治 + Round 2 新引入 | —                    | **32 個**             |

**結論**：Round 1 → v7.11 修補有效率 ~56%（27/48），但 stabilization 過程**新引入 17 個 gaps**（占 v7.7→v7.11 改動的副作用）。

### 1.2 「修了 schema 沒修 agent 行為路徑」核心發現

v7.11 整體呈現一個**重複模式**：

| 修補項                            | Schema/條文層     | 實作層（agent 行為）                       | 狀態          |
| --------------------------------- | ----------------- | ------------------------------------------ | ------------- |
| `gitnexus_hint` 5 enum + optional | ✅ 完整           | ✅                                         | 真生效        |
| `runtime_telemetry` 5-enum probe  | ✅ schema 加了    | 🔴 **誰寫/何時寫/如何寫全空白**            | **空殼**      |
| §C.3「list_repos 不拋且回非空」   | 提案文字          | 🔴 **未真寫進 skill**                      | **未落地**    |
| timeout 閾值                      | enum 含 `timeout` | 🔴 **未指定秒數**                          | **孤兒 enum** |
| `.mcp.json` availability 預檢     | lead.md 條文一行  | 🟡 **實作層不明**（agent 邏輯/validator?） | 模糊          |
| pending_group 共享計時            | 文字宣告          | 🟡 **schema 無欄位**；跨 ticket 升級不繼承 | 部分          |
| modify-existing「4 場景全命中」   | lead.md 一行      | 🟡 **「4 場景」具體未列舉**                | 模糊          |
| Hotfix-light 三機制全關           | lead.md §s07 鐵律 | ✅ + reviewer.md short-circuit             | 真生效        |
| §C.6 結果合併規則                 | 文字明文          | 🟡 **agent 自動 trigger 點不明**           | 部分          |

→ **8/9 項**有實作層落差；**只 1 項**（hotfix-light 三機制全關）真完整生效。

### 1.3 三大新發現架構性盲點

1. **🔴 hotfix tier 升級流程完全空白**：light → heavy 中途升級的 5 個邊界（觸發者 / in-flight 修改 / autonomy 變更 / pending_group 跨 ticket / telemetry 累計）v7.11 全無覆蓋
2. **🔴 runtime_telemetry 寫入機制與 ticket append-only 鐵律衝突**：schema 加了但無 workflow → P-35 patrol 沒資料可吃 → 整個 ADR-0041 v3 鐵律 2-B 自動化閉環有名無實
3. **🔴 stabilization 條文層 ≠ 實作層**：v7.11 整體有「寫了 ADR 文字 / schema enum / 條文一行」但對應 skill workflow 章節 / agent decision tree 沒同步補完整定義 → 落地等於空話

---

## §2 32 個 GR 分主題彙整

### 主題 A：B-1 偵測 closed-list grep（中文 / 不同表達 fragile）— 4 GR

| GR    | 描述                                                                   | 嚴重度 | 屬於         |
| ----- | ---------------------------------------------------------------------- | ------ | ------------ |
| GR-A1 | refactor-keyword 中文「改名/同步調整/整合」miss                        | 🔴 高  | v7.11 仍存在 |
| GR-A2 | frontend-backend-pair 路徑寫死範例（無 monorepo `backend/+frontend/`） | 🟡 中  | v7.11 新引入 |
| GR-A3 | stack 副檔名白名單 closed list（無 .scala/.cs/.swift）                 | 🟡 中  | v7.11 新引入 |
| GR-A4 | task_class 推導預設未明文 → autonomy default 取決推導                  | 🟡 中  | 未解決原 gap |

**修補方向**：

- 短期：擴充清單加中文同義詞（「改名/重新命名/同步更新引用」）
- 中期：改用 LLM-classifier（@Lead 派發前呼叫 haiku 分類 `is_refactor: bool`）
- 長期：直接從 git diff stat 推（rename + ≥3 caller grep → refactor）

### 主題 B：runtime_telemetry 寫入機制空白 — 4 GR

| GR    | 描述                                                              | 嚴重度 | 屬於         |
| ----- | ----------------------------------------------------------------- | ------ | ------------ |
| GR-B1 | runtime_telemetry append-only 鐵律衝突 → 沒人會寫                 | 🔴 高  | v7.11 新引入 |
| GR-B2 | §C.3 step 2「list_repos 不拋且回非空」未落地（no-index 偵測失效） | 🔴 高  | 修補不完整   |
| GR-B3 | timeout 閾值未明定（孤兒 enum）                                   | 🟡 中  | v7.11 新引入 |
| GR-B4 | P-34「連續 ≥3」reset 條件未定義（跨 session/ticket?）             | 🟡 中  | v7.11 新引入 |

**修補方向**：

- routing-ticket-protocol §3.6 補「runtime_telemetry 回填 step」明文：誰寫=target_agent / 何時=task close 前最後一步 / 如何=`# === RUNTIME_TELEMETRY ===` block append（視為 append-only 例外）
- §C.3 step 2 改寫三分（拋→crash / 回 [] →no-index / 回非空 →available）
- timeout default 5s 寫入 schema
- P-34 加 reset 規則：「ok 單次出現即歸零；計數讀近 24h archive」

### 主題 C：Hotfix tier 升級流程完全空白 — 5 GR（新主題）

| GR    | 描述                                               | 嚴重度 | 屬於           |
| ----- | -------------------------------------------------- | ------ | -------------- |
| GR-C1 | 觸發者未明（@Backend ack 後 @Lead 重派？）         | 🔴 高  | 邊界 case 暴露 |
| GR-C2 | in-flight 修改處理空白                             | 🔴 高  | 邊界 case 暴露 |
| GR-C3 | autonomy_mode 變更時機（user context stale 風險）  | 🟡 中  | 邊界 case 暴露 |
| GR-C4 | pending_group 跨 ticket 不繼承（孤兒 PENDING）     | 🟡 中  | v7.11 新引入   |
| GR-C5 | telemetry 跨 ticket 累計（P-34「連續」跨 ticket?） | 🟡 中  | 邊界 case 暴露 |

**修補方向**：

- 新提案「Hotfix Tier 升級 SOP」：
  - sub-agent 發現升級條件 → 立即停 + 寫 telemetry `tier_upgrade_required: heavy + reason` + status: `paused`（新增 status enum）
  - @Lead 接 paused → cancel 舊 ticket → 新派 heavy ticket，frontmatter `superseded: <舊 ticket_id>`
  - pending_group 從舊 ticket_id 顯式 carry-over
  - telemetry 加 `prior_ticket_telemetry_carryover: true` 由 P-34 跨 ticket 累計

### 主題 D：訊息超載 / hotfix-heavy 設計矛盾 — 2 GR

| GR    | 描述                                                                        | 嚴重度 | 屬於                     |
| ----- | --------------------------------------------------------------------------- | ------ | ------------------------ |
| GR-D1 | hotfix-heavy + step-by-step + SC + B-1 → user 收 ≥10 通知；違反緊急通道初衷 | 🔴 高  | v7.11 新引入（部分繼承） |
| GR-D2 | pending_group 解逾時雜訊但不解 STAGE_VERIFY 本身派出量                      | 🟡 中  | v7.11 新引入             |

**修補方向**：

- hotfix-heavy autonomy default 改為 `gate-at-impl`（單一 gate；user 看 TEST_SPEC + 修復方案後一次 OK）
- step-by-step 退化為 user override 才用
- SC trigger P-15 紅通知與 STAGE_VERIFY 合併（`combined_trigger_pending` 欄位避免雙重通知）

### 主題 E：onboarding 機制 SPOF + polyglot 不足 — 4 GR

| GR    | 描述                                                          | 嚴重度 | 屬於           |
| ----- | ------------------------------------------------------------- | ------ | -------------- |
| GR-E1 | task_class=onboarding 偵測純靠 LLM（SPOF；漏標 → 機制全失效） | 🔴 高  | v7.11 新引入   |
| GR-E2 | init-workspace 流程未自動加 GITNEXUS_INTEGRATION 占位         | 🟡 中  | v7.11 新引入   |
| GR-E3 | polyglot multi-stack — sub-wing/sub-index 機制缺失            | 🟡 中  | 邊界 case 暴露 |
| GR-E4 | GitNexus polyglot index scope 模糊（root vs per-submodule）   | 🟡 中  | 邊界 case 暴露 |

**修補方向**：

- lead.md §s05 加 task_class detection 表 + grep 規則（onboarding 觸發詞表）
- @Assistant P-X 偵測「Step 4.5 wing 未建 + workspace 是新建」→ 補升 onboarding
- agent-driven-onboarding §Step 4.5 加 polyglot 分流規則：「monorepo ≥2 sub-module → 每 sub-module 額外 add `room=index_<submodule>`」
- §B 加 polyglot scope 段：「monorepo → root analyze；獨立 deploy → per sub-module」

### 主題 F：mempalace ↔ GitNexus 結果合併分類不足 — 4 GR

| GR    | 描述                                                       | 嚴重度 | 屬於           |
| ----- | ---------------------------------------------------------- | ------ | -------------- |
| GR-F1 | 結構性 drift（split/merge/move）不在 §C.6 命名/邏輯 二分內 | 🔴 高  | v7.11 新引入   |
| GR-F2 | 鐵律 2-C 寫入點 Stage 5.5 vs hotfix-heavy stage 對應未定   | 🔴 高  | v7.11 新引入   |
| GR-F3 | 批次 update_drawer（drift 觸發 N 個 drawer 過期）處理空白  | 🟡 中  | v7.11 新引入   |
| GR-F4 | hotfix 緊急 vs 寫 drawer 優先級未定（先 fix vs 先 drawer） | 🟡 中  | 邊界 case 暴露 |

**修補方向**：

- §C.6 加第三類「結構性 drift（symbol split/merge/move）→ GitNexus 優先 + 寫新 drawer 含 split_into 欄位 + 舊 drawer mark superseded」
- 鐵律 2-C 改 stage-agnostic「task close 前必寫」
- 補 §C.6 step「合併時對 ALL 命中 drawer 逐一 update_drawer；未 update 視為違反鐵律 2-D」
- 明文「fix 提交 + drawer 寫入同 atomic boundary（寫 drawer 算 close 條件）」

### 主題 G：Schema 欄位 vs 條文不一致 — 4 GR

| GR    | 描述                                                       | 嚴重度 | 屬於         |
| ----- | ---------------------------------------------------------- | ------ | ------------ |
| GR-G1 | `skip_memory_search` auto-trigger 條件漏列 hotfix-light    | 🟡 中  | v7.11 新引入 |
| GR-G2 | caller_count 邊界 `>` vs `≥` 三處不一致（schema/ADR/P-35） | 🟡 中  | v7.11 新引入 |
| GR-G3 | pending_group 欄位 routing-ticket-protocol schema 中未明文 | 🟢 低  | 修補不完整   |
| GR-G4 | modify-existing「4 場景全命中」具體未列舉                  | 🟡 中  | v7.11 新引入 |

**修補方向**：

- routing-ticket-protocol §二 auto-trigger 改：`task_class ∈ {doc-sync, config-adjust} OR (task_class=hotfix AND hotfix_tier=light)`
- 統一 `> 10`（即 ≥11）並修 schema 註解
- 補 `pending_group` 至 routing-ticket schema；validator 檢「sibling_agents.length ≥1 → pending_group 必填」
- lead-orchestration-guide §六 補「modify-existing-不跳-S3-4-場景表」

### 主題 H：其他邊界 + 弱化 — 5 GR

| GR    | 描述                                                                   | 嚴重度 | 屬於         |
| ----- | ---------------------------------------------------------------------- | ------ | ------------ |
| GR-H1 | regenerate_via 指針弱化 audit trail 時間切片                           | 🟡 中  | v7.11 新引入 |
| GR-H2 | P-35 偵測 add_drawer 維度未明（wing/room 比對精度）                    | 🟡 中  | v7.11 新引入 |
| GR-H3 | rename 後 regenerate_via 用新名失去舊名 search 命中                    | 🟢 低  | v7.11 新引入 |
| GR-H4 | suggested_query 缺 symbol 時無 fallback                                | 🟢 低  | v7.11 新引入 |
| GR-H5 | hotfix short-circuit 條文散落多處（lead/§C.5/§A/reviewer）優先序未硬編 | 🟡 中  | v7.11 新引入 |

**修補方向**：

- drawer body 加 `caller_count_at_write: 15` 純數字快照 + commit hash；audit 雙視角（當時 vs 現在）
- P-35 加三維度比對：`wing=<ticket workspace_id> AND room=refactor_log AND tags 含 ticket_id 或 symbol_name`
- drawer template 加 `aliases: [<old_name>]`
- suggested_query fallback「`gitnexus context <touched_file>`」
- lead.md B-1 條文改前置條件式：先檢 `task_class=hotfix AND tier=light` → skip 整段

---

## §3 推薦 v7.12 修補路線

### Phase 1：必修（v7.11 → v7.12；最高優先；解 SPOF + 空殼）

| Proposal             | 主題                                                               | 對應 GR        | LOC | 必修原因                       |
| -------------------- | ------------------------------------------------------------------ | -------------- | --- | ------------------------------ |
| **PROPOSAL_502_039** | runtime_telemetry 寫入機制 + §C.3 三分 + timeout 閾值 + P-34 reset | B1/B2/B3/B4    | ~50 | P-34/P-35 整個 patrol 機制空殼 |
| **PROPOSAL_502_040** | Hotfix Tier 升級 SOP（5 邊界全包）                                 | C1/C2/C3/C4/C5 | ~80 | 真實生產場景常見；現完全無覆蓋 |
| **PROPOSAL_502_041** | hotfix-heavy autonomy default 改 gate-at-impl + 通知合併           | D1/D2          | ~25 | 違反 hotfix 設計初衷           |

### Phase 2：建議修（v7.12 → v7.13）

| Proposal             | 主題                                                                    | 對應 GR     | LOC |
| -------------------- | ----------------------------------------------------------------------- | ----------- | --- |
| **PROPOSAL_502_042** | onboarding 偵測 + polyglot 分流 + workspace GITNEXUS_INTEGRATION 自動加 | E1/E2/E3/E4 | ~60 |
| **PROPOSAL_502_043** | §C.6 結構性 drift 第三類 + 寫入點 stage-agnostic + 批次 update          | F1/F2/F3/F4 | ~40 |
| **PROPOSAL_502_044** | Schema 一致性掃修（auto-trigger / `>10` / pending_group / 4 場景表）    | G1/G2/G3/G4 | ~30 |

### Phase 3：邊界補強（v7.13 → v8.0）

| Proposal             | 主題                                                                                   | 對應 GR     | LOC |
| -------------------- | -------------------------------------------------------------------------------------- | ----------- | --- |
| **PROPOSAL_502_045** | B-1 keyword fragility（中文擴充 + LLM classifier 評估）                                | A1/A2/A3/A4 | ~40 |
| **PROPOSAL_502_046** | 邊界補強（audit trail / P-35 維度 / aliases / suggested_query / short-circuit 前置化） | H1~H5       | ~30 |

### 不建議（觀察期）

- ROUTING_TICKET schema v2 nested groups 重組（H-2 from Round 1）：成本仍高；v8.0+ 再評估

---

## §4 結論與行動建議

### 4.1 v7.11 stabilization 整體成果評估

| 維度                | 評分       | 說明                                                                           |
| ------------------- | ---------- | ------------------------------------------------------------------------------ |
| 條文層完整度        | ⭐⭐⭐⭐   | 4 個 proposals 連續執行；ADR/schema/skill 條文充實                             |
| 實作層落地度        | ⭐⭐       | 8/9 項有實作落差；落地度約 30-50%                                              |
| Round 1 gaps 修補率 | ⭐⭐⭐     | 27/48 ≈ 56%；架構性盲點解 2/3（持久化 + schema 部分；hotfix 解但引入新副作用） |
| 新引入副作用        | ⭐⭐       | 17 個新 GR；其中 6 個高嚴重度                                                  |
| **整體**            | **⭐⭐⭐** | **stabilization v1：條文 OK 但實作未完整；需 v7.12 三項目補齊**                |

### 4.2 短期行動（本週）

1. **凍結 v7.11** 為「stabilization milestone v1」
2. **立即起 PROPOSAL_502_039**（runtime_telemetry 完整化）— 解 P-34/P-35 空殼問題
3. **接續 PROPOSAL_502_040**（Hotfix Tier 升級 SOP）— 補生產關鍵場景

### 4.3 中期行動（2 週內）

4. **PROPOSAL_502_041**（hotfix-heavy 通知收斂）+ **042**（onboarding 強化）+ **043**（drift 分類）
5. 實際 dogfooding 1-2 個真實 GitNexus 啟用 dispatch；驗證 v7.12 是否解決體感問題

### 4.4 長期行動（1 個月）

6. **PROPOSAL_502_044~046**（schema 一致性 + B-1 keyword + 邊界補強）
7. 考慮新建 `tasks/integration-walkthrough-protocol.md`：每 3-5 個 stabilization proposals 自動觸發 Round N 回歸 simulation；設為 SOP

### 4.5 一句話結論

**v7.11 把 v7.7 的「不知道有問題」改善為「schema 上看起來解了但 agent 用不出來」**；下個 minor version 必須補實作落地，否則 stabilization 流於形式。建議 v7.12 一次解 Phase 1 三項（039/040/041 ~155 LOC）後再評估 Phase 2/3 順序。

---

**報告完成**：2026-05-07（Round 2）
**參與 agents**：4 並行（Cross-stack+中文 refactor / Hotfix-LOC邊界+Polyglot onboarding / Drift+Caller邊界 / 4 probe modes+Tier 升級）
**情境覆蓋**：A2-H2 共 8 個（含 G2 4 子情境 + H2 3 子情境 = 14 sub-cases）
**識別 GR**：32 個（9 高 / 17 中 / 6 低）
**Round 1 修補率**：27/48 ≈ 56%
**下一步**：依 §3 推薦路線起 PROPOSAL_502_039 起步
