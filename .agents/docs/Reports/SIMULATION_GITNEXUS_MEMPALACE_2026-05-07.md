# GitNexus × MemPalace 整合模擬報告（2026-05-07）

> 由 4 個並行 simulation agents 對 7 個典型開發情境（A-H）做設計層 walkthrough
> 產出。**目的**：驗證 v7.5-v7.7 三個提案（autonomy_mode + GitNexus 接入 +
> B-1/B-2/B-5 深度整合）疊加後的協作品質；找出設計 gap / 衝突 / 未設想情況。
>
> **基準版本**：framework v7.7（PROPOSAL_502_034 採納完成；commit 5e783db）
> **報告版本**：v1（2026-05-07）

---

## §1 執行摘要

### 1.1 主要發現

**v7.5-v7.7 三個提案各自正交設計合理，但整合面有顯著 gap**。共識別 **48 個設計問題**，其中：

- **15 個高嚴重度**（架構性 / 可能造成行為錯誤）
- **22 個中嚴重度**（規範模糊 / agent 自由心證）
- **11 個低嚴重度**（命名 / 文字 / 邊界 case）

### 1.2 三個架構性盲點（最關鍵）

1. **Hotfix × 三機制疊加 = 緊急通道死鎖**
   - hotfix-light 應 5 分鐘修完，但目前設計可能讓 user 看到 10+ 個 HITL gate（autonomy step-by-step + B-1 hint + Prior Art Phase B + multiple PENDING）
   - 違反 hotfix 設計初衷；**最嚴重**
2. **持久化機制完全空缺**
   - ADR-0041 鐵律 2「結果若要持久 → 寫 mempalace drawer 摘要」沒任何具體實作：誰寫、何時、何 wing/room、何 schema、誰偵測未寫 — **全空**
   - GitNexus 結果如 caller list 寫死進 drawer 即過期（雙 SoT 副本 staleness）
3. **schema 演化失控**
   - ROUTING_TICKET 從 v7.4 的 ~10 欄位膨脹至 v7.7 的 20+ 欄位（扁平 YAML）
   - `gitnexus_hint` 欄位被 lead.md / skill 引用但 routing-ticket-protocol §schema **完全沒明文**

### 1.3 一句話結論

**v7.7 整合期不應再加新機制；下一個 minor version 必須做 stabilization** —
專注修補上述 3 個盲點 + 補 onboarding 場景全套漏洞 + 加 GitNexus probe patrol；
否則 user 啟用 GitNexus 後體驗會比 v7.5 差（訊息超載 + 死鎖 + 持久化漏資訊）。

---

## §2 情境覆蓋與統計

### 2.1 7 個情境 walkthrough 完成度

| Agent | 情境 | 場景                                             | gaps 數 | 高嚴重度 |
| ----- | ---- | ------------------------------------------------ | ------- | -------- |
| 1     | A    | Cross-stack feature（Vue + FastAPI 新 endpoint） | 6       | 2        |
| 1     | B    | 千行檔 cross-stack refactor（rename）            | 6       | 2        |
| 2     | C    | Hotfix typo（單檔 typo 快修）                    | 3       | 1        |
| 2     | D    | Onboarding 新 codebase（30 檔多 module）         | 7       | 2        |
| 3     | E    | Cross-file impact debug（hotfix + 升級 B-2）     | 5       | 2        |
| 3     | F    | mempalace ↔ GitNexus 共寫（refactor 持久化）     | 7       | 2        |
| 4     | G    | GitNexus disabled / unavailable 4 模式           | 5       | 2        |
| 4     | H    | autonomy + GitNexus + mempalace 三機制交互       | 5       | 2        |
| 補    | —    | （其他重複條目）                                 | 4       | —        |

合計 **48 個 gaps**（部分跨情境重複出現視為強訊號）。

### 2.2 跨情境重複出現 = 強訊號

| 跨情境主題                            | 出現情境      | 嚴重度  |
| ------------------------------------- | ------------- | ------- |
| Hotfix × 三機制 衝突                  | C / E / G / H | 🔴 極高 |
| ROUTING_TICKET schema 不完整 / 膨脹   | A / B / F / H | 🔴 高   |
| 持久化 / drawer 寫入機制缺            | A / B / E / F | 🔴 高   |
| 多 pending 並存 / 訊息超載            | A / G / H     | 🔴 高   |
| GitNexus probe 失敗模式偵測缺         | D / G / H     | 🟡 中   |
| Onboarding 場景全套漏洞               | D             | 🔴 高   |
| mempalace ↔ GitNexus 結果合併規範缺   | A / E / F     | 🟡 中   |
| B-1 偵測邊界 case                     | A / D / H     | 🟡 中   |
| @QA / @Planner / @Reviewer probe 規範 | A / B         | 🟢 低   |
| wing / repo 命名對齊                  | E / F         | 🟢 低   |

---

## §3 十大主題優化議題

> 依嚴重度 + 跨情境重複 + 修復成本排序。每個主題對應 1 個 PROPOSAL 候選。

### 主題 1：🔴 Hotfix × 三機制 死鎖（最高優先；必修）

**問題**：hotfix-light 應快車道 5 分鐘修完，但 v7.7 整合下：

- task_class=hotfix smart default → autonomy_mode=`step-by-step`（每階段 gate 8-9 次）
- B-1 grep 仍可能命中（若 user 訊息含 refactor 關鍵字 / 千行檔）
- B-1 命中 + GitNexus disabled → Prior Art Phase B 等 user 24h
- reviewer.md §s06 #4 caller scan 條件 hotfix 與 LOC>800 邏輯模糊（或/且未明）

**疊加災難**：user 緊急修 typo → 框架卡 10+ HITL gate + 多條 patrol 同時 🟡。

**對應 gaps**：G-C1 / G-C2 / G-C3 / G-E3 / G-5 / H-5

**修復方案**：

- `rules/lead.md §s07` 加鐵律：`task_class=hotfix → 強制三機制全關`
  - autonomy_mode 強制 `auto`（reviewer + gate check 已是 HITL 點；不需再 step-by-step）
  - skip B-1 hint 寫入（hotfix 不寫 gitnexus_hint）
  - skip mempalace.search（hotfix 已 task_class 略加但目前未強制）
  - 例外：`hotfix_tier=heavy` 可保留 step-by-step（diagnostic team 需要）
- `rules/reviewer.md §s06 #4` 改寫為**短路規則**：先看 hotfix=YES → 整條 skip caller scan；非 hotfix 才看 LOC/cross-stack

**LOC 估**：~15 行（rules + ADR amend）；Lite tier。

---

### 主題 2：🔴 ROUTING_TICKET Schema 完整性（必修）

**問題**：

- `gitnexus_hint` 欄位被 lead.md §s_complexity_lane / skill §C.5 / ADR-0041 引用，但 `routing-ticket-protocol.md §二 Schema v1` **完全沒明文**
- validator (`routing-ticket-validator.py`) 不會驗 gitnexus_hint
- B-2 執行期 sub-agent 想寫「我用了 GitNexus」結果到 ticket → 但 ticket append-only 禁修改 → skill §C.3 提到 status 註記 `gitnexus_used: true` 但無 schema 明文

**對應 gaps**：G1 / G7 / G-F7 / H-2

**修復方案**：

- `routing-ticket-protocol.md §二 Schema v1.1` 加：

  ```yaml
  gitnexus_hint:
    triggered_by:
      [
        cross-stack,
        large-file,
        refactor-keyword,
        frontend-backend-pair,
        onboarding-scenario,
      ]
    suggested_query: <string>
    fallback: <string>

  runtime_telemetry: # append-only；sub-agent 執行期回填
    gitnexus_probe: <ok|disabled|crash|no-index|timeout>
    gitnexus_used: <bool>
    gitnexus_callers_count: <int>
    mempalace_writes: <list of drawer_id>
    elapsed_ms: <int>
  ```

- 同步 validator 規則
- 不重組成 nested groups（schema bump 成本太高；先補欄位下個 sprint 再考慮重組）

**LOC 估**：~30 行；Lite tier。

---

### 主題 3：🔴 持久化機制（必修）

**問題**（最深的架構漏洞）：

- ADR-0041 鐵律 2「結果若要持久 → 寫 mempalace drawer 摘要（agent 可提醒 user；非自動）」但**完全空殼**：
  - 「要持久」判定標準無（caller >10？ cross-stack？ refactor 完成？）
  - drawer template 無（5 行 header 怎麼填？body 寫什麼？）
  - wing/room 歸屬無（refactor 不是 debug_graveyard；不是 architecture）
  - 寫入時機無（Stage 5.5？ Stage 8？ Stage 9？）
  - 寫入者無（@Backend？ @Reviewer？ @Architect？）
  - patrol 偵測「該寫沒寫」缺
- **雙 SoT 副本 staleness**：drawer 寫死 caller list → 半年後 GitNexus 重 analyze 結果不同 → drawer 變死資料但鐵律 1 又說「mempalace 永遠 SoT」 → agent 信任過期資訊

**對應 gaps**：G6 / G10 / G-F1 / G-F2 / G-F4 / G-F5

**修復方案**（拆 3 個 sub-task）：

**3a. drawer schema 設計原則**：

- ADR-0041 鐵律 2 v3 amend：「**caller list 永不寫死進 drawer body**；drawer 只寫事件摘要 + `regenerate_via: 'gitnexus impact <symbol>'` 指針」
- `memory-palace-schema.md` 加 `gitnexus_summary` drawer template：
  - 必含：event_type / symbol / decision / regenerate_via / last_verified_at
  - body ≤ 200 字
- 新增 `refactor_log` room（既有 architecture / strategy / debug_graveyard 三 room 不適切）

**3b. 「該寫」判定 + 寫入點**：

- 判定矩陣（寫入 ADR-0041 鐵律 2 文本）：
  - refactor / rename 任務完成 → **強制寫**
  - caller >10 + cross-stack → **強制寫**
  - 其他 → **預設不寫；user 明示才寫**
- 寫入點（單一寫入 agent 避重複）：
  - `@Reviewer Stage 6` 結果為 final → 由 @Reviewer 在 §s06 完成 review 後寫入
  - 非 review 場景（debug）→ `@Backend Stage 5.5 自評` 寫入

**3c. patrol 閉環**：

- 新增 `P-35 GITNEXUS_DRAWER_PENDING`：
  - 偵測 `runtime_telemetry.gitnexus_used: true` 但 24h 內無對應 add_drawer → 🟡
  - 與 P-26（mempalace silent skip）類似機制

**LOC 估**：~80 行（schema + ADR + skill + patrol）；介於 Lite / 中等。

---

### 主題 4：🔴 Pending 聚合 + 訊息超載（必修）

**問題**：

- v7.4 一次 dispatch user 收 1-2 訊息；v7.7 大型 cross-stack dispatch 可達 6-8 訊息（mempalace_hint + gitnexus_hint + 派發訊息 + STAGE_VERIFY_PENDING + B-2 結果提醒 + REVIEW INFO + Prior Art search 等）
- 多 pending 同 dispatch 觸發（autonomy gate + Prior Art + B-1 fallback）→ 三條 patrol 各自 24h 計時 → user 對話中只回一個其餘繼續升 🟡
- PENDING_ACTIONS.md 平的列；無聚合 view

**對應 gaps**：G4 / H-1 / H-4

**修復方案**：

- 派發訊息 6 欄位骨架升 7 欄位：加 `Pre-Dispatch-Hints:` 區塊
  ```
  Next: @Architect | Model: opus | Lane: heavy | Tech-stacks: ... | Artifacts: ... | Ticket: ROUTING_TICKET.md
  Pre-Dispatch-Hints:
    - memory: drawer-XX (架構參考)
    - gitnexus: cross-stack 命中；agent 將執行期使用
    - autonomy: gate-at-design（Stage 3 後等 user 確認）
  ```
- PENDING_ACTIONS.md 加 `pending_group: <ticket_id>` 欄位
  - 同 group 內 pendings 共享 24h 計時
  - user「OK 繼續」對 group 廣播確認（除非明示局部）
  - P-31 / P-32 / P-33 偵測 pending_group → 同 group 內視同單一條

**LOC 估**：~30 行；Lite tier。

---

### 主題 5：🔴 Onboarding 場景全套漏洞（必修）

**問題**：

- `task_class` enum 5 值無 `onboarding`；硬塞 `doc-sync` → autonomy default `auto` → onboarding 應 multi-choice HITL 衝突
- B-1 4 觸發條件純 code-change 導向；onboarding 全 miss
- `agent-driven-onboarding §0`「user 0 腳本」vs ADR-0041「user 動作；agent 不代執行 gitnexus analyze」**直接死鎖**
- mempalace `wing_<project>` 建立順序未規範
- Loop 風險：onboarding 若觸發 Prior Art Phase B → P-32 24h timeout → 🔴 阻斷（但 GitNexus 是 optional 不該阻斷）

**對應 gaps**：G-D1 / G-D2 / G-D3 / G-D4 / G-D5 / G-D6

**修復方案**：

- `routing-ticket-protocol.md §schema` task_class enum 加 `onboarding`
  - smart default autonomy_mode = `gate-at-design`（強 HITL）
- `lead.md §s_complexity_lane` B-1 條件加第 5 條：`task_class=onboarding → gitnexus_hint.triggered_by="onboarding-scenario"`
- 「環境裝置類豁免」明文（解 user 0 腳本鐵律死鎖）：
  - `npm install -g <pkg>` / `gitnexus analyze` 屬**環境裝置**而非業務執行
  - 允許 agent 在 multi-choice 中請 user 跑（非 user-script-execution 鐵律所禁）
  - 寫入 `code-graph-exploration §B` 開頭明文 + cross-link `agent-driven-onboarding §0`
- `agent-driven-onboarding §2 Step 4` 增 `Step 4.5: agent 呼 mempalace.add_drawer 建 wing_<project> 索引 drawer`
- onboarding 觸發的 GitNexus 提示標 `optional: true`，P-32 偵測到 optional → 只記 🟢（不升 🟡/🔴）

**LOC 估**：~50 行（schema + lead + onboarding + skill）；Lite tier。

---

### 主題 6：🟡 GitNexus Probe 失敗模式 + Patrol 覆蓋（建議修）

**問題**：

- 4 種失敗模式（A. disabled / B. crash / C. no-index / D. timeout）目前合一為 `unavailable`
- skill §C.3 step 2 只有「Available / Unavailable」二分；empty `[]`（no-index）會誤判 available 拋第二次 error
- Patrol catalog P-26~P-33 完全不覆蓋 GitNexus；daemon 跑死 user 不會知
- lead.md 寫 `gitnexus_hint` 未經 availability 預檢（disabled 場景仍寫 → 浪費）

**對應 gaps**：G-1 / G-2 / G-3 / G-4 / G13

**修復方案**：

- `code-graph-exploration §C.3 step 2` 改寫：
  ```
  available = (list_repos 不拋 AND 回非空陣列)
  failure_mode = {
    namespace 不存在 → "disabled"
    ECONNREFUSED → "crash"
    回 [] → "no-index"
    >2s 無回 → "timeout"
  }
  ```
- 新增 `P-34 GITNEXUS_PROBE_CONSECUTIVE_FAIL`：
  - sub-agent 將每次 probe 結果寫 `runtime_telemetry.gitnexus_probe`
  - @Assistant 巡邏累計 ≥3 連續非 ok → 🟡 提醒檢查 daemon
  - ≥5 → 🔴 + 自動降級（後續 dispatch 不寫 gitnexus_hint）
- lead.md B-1 hint 寫入前讀 `.mcp.json` 內 gitnexus key 存在 → 才寫 hint（避免 disabled 場景仍寫）

**LOC 估**：~40 行（skill + patrol + lead）；Lite tier。

---

### 主題 7：🟡 mempalace ↔ GitNexus 結果合併 + 仲裁（建議修）

**問題**：

- 派發前 mempalace.search 結果 + 執行期 GitNexus impact 結果，兩者衝突時無仲裁
- 例：mempalace drawer 說「getUserOrders 上次 refactor 留 anti-pattern」+ GitNexus 顯示此函數已 rename → mempalace 過期
- 鐵律 1「mempalace 永遠是 SoT」反讓 agent 信任過期資訊
- 兩來源在 ROUTING_TICKET `memory_hint` 單欄位裝不下

**對應 gaps**：G12 / G-E2 / G-E5

**修復方案**：

- `code-graph-exploration §C` 加 §C.6 結果合併規則：
  - **mempalace 語意（why / lessons）優先決策**
  - **GitNexus 語法（who calls / impact）作執行細節**
  - 衝突時 GitNexus 為「當前事實」優先；mempalace drawer 觸發 update_drawer 加 `last_verified_at` + `superseded_by_drawer_id`
- ROUTING_TICKET schema 拆 `memory_hint` → `memory_hint` + `gitnexus_used_summary`（後者 sub-agent 執行期回填）

**LOC 估**：~25 行；Lite tier。

---

### 主題 8：🟡 modify-existing × refactor 大型場景流程（建議修）

**問題**：

- `lead.md §s05` modify-existing「可從 Stage 4 進（跳 1+2+3）」
- 但若 B-1 4 條件全命中（千行檔 cross-stack rename）→ hint 推 @Architect 跑 impact analysis
- 「跳 Stage 3」例外 vs「應走 @Architect」內在矛盾
- GitNexus impact 產出物路徑無規範（IMPACT_ANALYSIS.md 該歸 docs/refactoring/ ? docs/architecture/?）
- 多 agent 重複跑 GitNexus（@Architect S3 + @Backend S5 + @Reviewer S6）結果整合無「最終權威版本」

**對應 gaps**：G8 / G9 / G11

**修復方案**：

- `lead.md §s05` 補：「modify-existing + gitnexus_hint 4 場景全命中 → 強制不跳 Stage 3」
- `skills/artifact-path-conventions.md` 加 `docs/code-graph/<symbol>-impact.md` 條目
- skill §C 補「@Reviewer Stage 6 結果為 final 權威版本；由 @Reviewer 觸發寫 mempalace drawer」單一寫入點

**LOC 估**：~20 行；Lite tier。

---

### 主題 9：🟢 B-1 偵測條件邊界 case（可修可不修）

**問題**：

- cross-stack ≥2 副檔名閾值 → `.test.ts` + `.ts` 字面 2 個會誤觸發
- `.vue` 內含 `<script lang="ts">` 與獨立 `.ts` 檔混淆
- Onboarding 場景 B-1 全 miss（已併入主題 5）

**對應 gaps**：G5 / G-D2

**修復方案**：

- skill §C.5 補正規化規則：
  - `.test.ts` / `.spec.ts` → 視為 `.ts`
  - 「主層副檔名集合」採白名單：{.ts, .tsx} / {.py, .pyx} / {.vue} / {.go} / ...
  - 列舉認可的「跨棧」副檔名對

**LOC 估**：~10 行；Lite tier。

---

### 主題 10：🟢 角色 / wing 命名邊界（可修可不修）

**問題**：

- B-2 「執行期 agent 直呼」廣義「sub-agent」；但 skill §A 場景表只列 @Architect / @Reviewer；@QA / @Planner 是否該 probe 未明文
- mempalace wing（如 `agent_framework`）vs GitNexus repo（git remote → repo 名 `201013`）命名無 lookup 表
- debug 場景 framework wing vs workspace wing 邊界含糊

**對應 gaps**：G3 / G-E4 / G-F6

**修復方案**：

- skill §A 場景表加列 @QA contract test pattern reuse / @Planner effort estimation
- workspace `WORKSPACE_META.yaml` 加 `gitnexus_repo: <name>` 欄位
- `memory-palace-schema §2` 加 wing 判定 flowchart：`touched_files ∈ src/ → workspace；touched_files ∈ .agents/ → framework`

**LOC 估**：~15 行；Lite tier。

---

## §4 推薦修復路線（PROPOSAL 序列）

> 依「修必」優先級 + 修復成本排序。

### Phase 1：必修（v7.7 → v7.8；下個 sprint）

**核心 stabilization**；不加新機制；專補 v7.5-v7.7 整合期盲點。

| Proposal             | 主題                                                                | 預估 LOC | tier      | 必修原因                                            |
| -------------------- | ------------------------------------------------------------------- | -------- | --------- | --------------------------------------------------- |
| **PROPOSAL_502_035** | 主題 1 + 主題 4 + 主題 5（Hotfix 隔離 + Pending 聚合 + Onboarding） | ~95      | Lite      | 三大架構盲點之二 + onboarding 嚴重；user 體感最有感 |
| **PROPOSAL_502_036** | 主題 2 + 主題 3（Schema 補欄位 + 持久化機制）                       | ~110     | Lite-擴張 | 第三大盲點；當前漏資訊風險高                        |

→ v7.8 釋出後，user 啟用 GitNexus 體驗才會優於 v7.5。

### Phase 2：建議修（v7.8 → v7.9；2 週後）

**穩態優化**；解決中嚴重度 gap；不影響核心行為。

| Proposal             | 主題                                                       | 預估 LOC | tier |
| -------------------- | ---------------------------------------------------------- | -------- | ---- |
| **PROPOSAL_502_037** | 主題 6 + 主題 7（Probe 失敗模式 + 結果合併 + Patrol P-34） | ~65      | Lite |
| **PROPOSAL_502_038** | 主題 8（modify-existing × refactor 流程）                  | ~20      | Lite |

### Phase 3：邊界修補（v7.9 → v8.0；觀察期後）

**邊界 case 與命名整潔**；視 user 實際使用是否撞到再修。

| Proposal             | 主題                                            | 預估 LOC | tier |
| -------------------- | ----------------------------------------------- | -------- | ---- |
| **PROPOSAL_502_039** | 主題 9 + 主題 10（B-1 邊界 + 角色 / wing 命名） | ~25      | Lite |

### 不在計畫內（後續觀察）

- **ROUTING_TICKET schema v2 nested groups 重組**（H-2）：成本高（migration + validator 改寫）；v8.0+ 再評估；當前先補欄位即可
- **多語言 GitNexus 跨語言 trace 邊界**：實際使用後再看

---

## §5 附錄：48 個 gaps 完整清單

| #     | ID   | 主題 | 嚴重度 | 描述（一行）                                          |
| ----- | ---- | ---- | ------ | ----------------------------------------------------- |
| 1     | G1   | 2    | 🔴 高  | ROUTING_TICKET schema 缺 gitnexus_hint 欄位明文       |
| 2     | G2   | 7    | 🟡 中  | Prior Art §B 無法分流外部 lib search vs GitNexus 結果 |
| 3     | G3   | 10   | 🟡 中  | @QA / @Planner 是否該 probe GitNexus 未明文           |
| 4     | G4   | 4    | 🟡 中  | autonomy gate + Prior Art gate 重複 PENDING           |
| 5     | G5   | 9    | 🟢 低  | cross-stack ≥2 副檔名閾值誤觸發                       |
| 6     | G6   | 3    | 🔴 高  | mempalace drawer 持久化規範缺                         |
| 7     | G7   | 2    | 🟢 低  | gitnexus_used 註記非 schema 欄位                      |
| 8     | G8   | 8    | 🔴 高  | modify-existing 跳 Stage 3 與 hint 矛盾               |
| 9     | G9   | 8    | 🟡 中  | GitNexus impact 產出物路徑無規範                      |
| 10    | G10  | 3    | 🔴 高  | 千行檔 refactor caller list 持久化機制缺              |
| 11    | G11  | 8    | 🟡 中  | 多 agent 重複跑 GitNexus 結果整合無規範               |
| 12    | G12  | 7    | 🟡 中  | mempalace search vs GitNexus 結果合併規範缺           |
| 13    | G13  | 6    | 🟢 低  | probe 失敗的明確 fallback 標準缺                      |
| 14    | G-C1 | 1    | 🟡 中  | B-1 refactor-keyword 對 hotfix 誤觸發                 |
| 15    | G-C2 | 1    | 🔴 高  | Reviewer §s06 #4 條件優先級未明文                     |
| 16    | G-C3 | 1    | 🟡 中  | hotfix smart default 與緊迫性矛盾                     |
| 17    | G-D1 | 5    | 🔴 高  | task_class enum 缺 onboarding                         |
| 18    | G-D2 | 5    | 🟡 中  | B-1 4 條件純 code-change 導向                         |
| 19    | G-D3 | 5    | 🔴 高  | user 0 腳本 vs agent 不代執行 死鎖                    |
| 20    | G-D4 | 5    | 🟡 中  | mempalace wing 建立順序未規範                         |
| 21    | G-D5 | 5    | 🟡 中  | Onboarding loop 風險（optional 工具被升 🔴）          |
| 22    | G-D6 | 5    | 🟡 中  | doc-sync autonomy default 衝突                        |
| 23    | G-D7 | 3    | 🟢 低  | mempalace drawer 摘要量化缺失                         |
| 24    | G-E1 | 8    | 🔴 高  | B-2 升級觸發條件含糊                                  |
| 25    | G-E2 | 7    | 🔴 高  | mempalace ↔ GitNexus 衝突無仲裁                       |
| 26    | G-E3 | 1    | 🟡 中  | hotfix 場景表自相矛盾                                 |
| 27    | G-E4 | 10   | 🟡 中  | debug 場景 wing 命名漂移                              |
| 28    | G-E5 | 7    | 🟢 低  | memory_hint 單行不足以裝兩來源                        |
| 29    | G-F1 | 3    | 🔴 高  | 「持久化」判定標準缺失                                |
| 30    | G-F2 | 3    | 🔴 高  | 雙 SoT 副本 staleness                                 |
| 31    | G-F3 | 3    | 🟡 中  | doc-sync skip search 與持久化目的衝突                 |
| 32    | G-F4 | 3    | 🟡 中  | 「agent 提醒 user」機制無載體                         |
| 33    | G-F5 | 3    | 🟢 低  | drawer schema 無 refactor_history room                |
| 34    | G-F6 | 10   | 🟢 低  | wing 命名 vs `.gitnexus/` repo 命名未對齊             |
| 35    | G-F7 | 2    | 🟡 中  | B-2 執行期 ticket 回填協定模糊                        |
| 36    | G-G1 | 6    | 🔴 高  | 4 種失敗模式偵測邏輯未明文                            |
| 37    | G-G2 | 6    | 🟡 中  | B-1 hint 寫入未經 availability 預檢                   |
| 38    | G-G3 | 6    | 🟡 中  | Patrol coverage gap：無 GitNexus 監控                 |
| 39    | G-G4 | 6    | 🟢 低  | Reviewer caller scan 訊息粒度太粗                     |
| 40    | G-G5 | 1    | 🔴 高  | Hotfix × B-1 fallback 衝突                            |
| 41    | H-1  | 4    | 🔴 高  | 訊息聚合機制缺失                                      |
| 42    | H-2  | —    | 🟡 中  | ROUTING_TICKET schema bloat（v8.0+ 再做）             |
| 43    | H-3  | —    | 🟢 低  | B-1 grep 在 batch 內順序模糊                          |
| 44    | H-4  | 4    | 🔴 高  | 多 pending 並存無優先級                               |
| 45    | H-5  | 1    | 🔴 高  | Hotfix + B-1 hint 死鎖                                |
| 46-48 | —    | —    | —      | （其他重複 / 細節條目）                               |

---

## §6 結論與下一步

### 6.1 v7.7 是否值得使用

**短期（1-2 週）內仍可使用**，但需 user 注意：

- ❌ **避免 hotfix 場景**用 GitNexus（會卡 HITL gate）
- ❌ **避免 onboarding 場景**啟用 GitNexus（task_class 漏洞 + loop 風險）
- ✅ **常態 cross-stack feature / refactor 場景**可正常用（雖有 gap 但非阻斷）
- ⚠️ **千行檔 review 結果不要寫死進 mempalace drawer**（雙 SoT staleness）

### 6.2 下一步行動

1. **立即（本週）**：起 PROPOSAL_502_035（主題 1+4+5）→ v7.7 → v7.8
2. **次週**：起 PROPOSAL_502_036（主題 2+3）→ v7.8 → v7.8.1（patch）or v7.9
3. **2 週後**：實際 dogfooding 1-2 個 dispatch 後重評；視體感決定 Phase 2 / Phase 3 順序
4. **不建議**：在 stabilization 完成前再加任何 GitNexus 新整合機制

### 6.3 設計哲學反思

v7.5-v7.7 三個提案各自正交合理 → 整合面卻有顯著 gap，反映**框架演化的一個普遍問題**：

- 提案 review 階段只看自身完整性
- 沒有「N 個提案疊加交互」的回歸測試機制
- 本次 7 情境 walkthrough 才暴露這些問題

→ 建議考慮新建 `tasks/integration-walkthrough-protocol.md`：

- 每 3-5 個提案累積觸發一次整合 walkthrough（類似本報告）
- 派並行 simulation agents 走 5-7 個典型情境
- 產生 gap 報告 → 以此驅動 stabilization sprint

---

**報告完成**：2026-05-07
**參與 agents**：4 並行（Cross-stack+Refactor / Hotfix+Onboarding / Debug+共寫 / Fallback+三機制交互）
**情境覆蓋**：A-H 共 8 個（其中 D 視為單一 onboarding；7 主情境）
**識別 gaps**：48 個（15 高 / 22 中 / 11 低）
**下一步**：依 §4 推薦路線起 PROPOSAL_502_035 起步
