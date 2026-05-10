<!-- MACHINE_READABLE
type: skill
category: F2
id: code-graph-exploration
load_priority: lazy
load_when: "agent 評估是否建議 user 用 GitNexus；大型 refactor / cross-file impact / onboarding 場景"
related_proposals: [PROPOSAL_20260502_033]
related_decisions: [ADR-0039, ADR-0041]
-->

# Skill: Code Graph Exploration（GitNexus 外部輔助）

> 由 PROPOSAL_502_033 建立；F2 類（外部工具集成）。
> GitNexus = 語法層 code knowledge graph 工具（外部 MCP）；本 skill 定義 agent **何時建議 user 啟用** + **如何吃輸出**。

---

## §A 何時建議用 GitNexus（場景表）

| 場景                                                             | 角色                 | 建議用 GitNexus                                  | 理由                                    |
| ---------------------------------------------------------------- | -------------------- | ------------------------------------------------ | --------------------------------------- |
| 大型 refactor（rename / move 跨 ≥5 檔）                          | @Backend / @Frontend | ✅ 強烈建議                                      | impact analysis 比 grep 準；避免漏網    |
| Cross-file 影響評估（Stage 3）                                   | @Architect           | ✅ 建議                                          | call graph 顯示真實調用鏈               |
| 新 codebase onboarding（PROJECT_CONTEXT）                        | @Architect           | ✅ 建議                                          | 自動產 architecture map                 |
| 深度 review（千行檔 / cross-stack diff）                         | @Reviewer            | 🟡 視情況（B-5 強制觸發；§C.4）                  | 看 caller breakage                      |
| **TEST_SPEC pattern reuse**（PROPOSAL_502_038 G3 補）            | @QA                  | 🟡 建議                                          | 取既有 endpoint test 模式；對齊歷史風格 |
| **Effort estimation / draft_features**（PROPOSAL_502_038 G3 補） | @Planner             | 🟡 視情況                                        | 大型 feature 預估 caller 衝擊面         |
| 單檔 typo / 小 bug fix                                           | 任                   | ❌ 不需要                                        | 殺雞用牛刀                              |
| Hotfix-light（生產事故；非 SC/D）                                | @Backend             | ❌ **強制不可用**（lead.md §s07 三機制全關鐵律） | 緊急通道；time-sensitive                |
| Hotfix-heavy + cross-stack                                       | @Backend / @Reviewer | ✅ 例外允許                                      | diagnostic team 需要                    |
| Doc-sync / config-adjust                                         | 任                   | ❌ 不需要                                        | 不涉 code structure                     |
| @Security SC-01~10 審查                                          | @Security            | ❌ 邊界外                                        | 安全範疇；專用 SC 工具                  |

**建議格式**：agent 在 ROUTING_TICKET `memory_hint` 或派發訊息加註：

```
建議：本任務涉跨檔影響；user 可考慮先跑 `gitnexus impact <symbol>` 提供結果作 Prior Art Phase B 輸入
```

## §B 啟用前提（user 動作；agent 不代執行）

GitNexus 預設 disabled。User 啟用步驟：

1. `npm install -g gitnexus`（**Node 依賴；豁免理由：套件原生要求 + noncommercial 用途**）
2. 改 `.mcp.json` + `.qwen/settings.json` 內 key `_gitnexus_disabled_by_default` → `gitnexus`
3. 重啟 Claude Code / Qwen session
4. `gitnexus analyze .`（首次建索引）

未跑 #4 → 16 個 `mcp__gitnexus__*` tools 不會出現。

### 環境裝置類腳本豁免（PROPOSAL_502_035 主題 5；解 G-D3）

`agent-driven-onboarding §0` 鐵律「user 0 user-script-execution」針對**業務 / validator / migration / 框架腳本**；不擴及**環境裝置類**：

- ✅ 允許 agent 在 onboarding multi-choice 中請 user 跑：`npm install` / `pip install` / `gitnexus analyze` / `docker pull` 等套件 / 環境裝置命令
- ❌ 仍禁：`python3 .agents/scripts/*.py` / `bash .agents/tests/*.sh` / migration scripts / validator 等業務性腳本

→ 環境裝置 ≠ 業務執行；agent 提示 user 跑 `npm install gitnexus` 不違反鐵律。

### Polyglot Scope（PROPOSAL_502_041 + PROPOSAL_502_043 R3-E1+E3 強化）

monorepo / multi-stack 場景 GitNexus 索引建立 scope：

- **緊耦合 monorepo**（cross-module call graph 重要）→ root 一次 `gitnexus analyze .`
- **獨立 deploy unit**（子模組獨立部署）→ 各 sub-module `cd <sub> && gitnexus analyze .`
- **同 root 多語言**（PROPOSAL_502_043 R3-E1；PyO3/Cython/JNI/WASM 等 FFI binding pattern；root 含 ≥2 種主 manifest 如 `Cargo.toml + pyproject.toml` 同層）→ root analyze + 標 `polyglot_in_root: true`
- **FFI/binding caveat**（PROPOSAL_502_043 R3-E3；新第 4 分類）→ root analyze + 顯示 caveat：「跨語言 call graph 工具可能不完整解析（FFI 邊界）；建議搭配 mempalace `room=ffi_boundary` drawer 手記 binding 表面」
- **模糊** → 預設 root analyze（較安全；onboarding-scenario default）

## §C Agent 對輸出的處理

### C.1 透過 Prior Art Phase B 吃輸入（推薦；既有機制）

PROPOSAL_502_030 HITL-first：user 跑外部 search → 回填 §B 結構化結果表。**GitNexus 結果同此路徑**：

- User 跑 `gitnexus impact <symbol>` → 截圖 / 文字結果
- 回填 PRIOR_ART_REPORT §B
- @Architect Phase C 評估 + 推薦

→ **零框架改動**；既有 gate 天然吃。

### C.2 執行期 agent 直呼（PROPOSAL_502_034 B-2；ADR-0041 v2 amend）

若 user 已 enable + agent session 看到 `mcp__gitnexus__*` tools：

- `mcp__gitnexus__impact(symbol=...)` — 影響分析（B-5 reviewer caller scan）
- `mcp__gitnexus__context(file=...)` — 取單檔 context（千行檔 navigation）
- `mcp__gitnexus__cypher(query=...)` — 自訂圖查詢
- `mcp__gitnexus__list_repos()` — 列已索引 repo（亦作 availability probe）

**鐵律分階段**（ADR-0041 v2 鐵律 3）：

- **派發前 batch 不加**（4 探測 PENDING/grep/mempalace/ROUTING_TICKET 維持低 latency）
- **執行期 agent 可直呼**（場景命中時主動取結果；不透 user）

### C.3 B-1 + B-2 整合決策樹（agent 接到 task 後）

````
1. Read ROUTING_TICKET → 看 gitnexus_hint 欄位
   ├─ 無 hint → 場景非高頻；走 grep / Read 既有路徑
   └─ 有 hint → 進 step 2

2. Probe GitNexus availability（PROPOSAL_502_039 GR-B2 三分判定；PROPOSAL_502_043 R3-B3 補實作樣板）
   實作（不依賴 MCP RPC default timeout 60s）：
   ```js
   const probePromise = mcp__gitnexus__list_repos();
   const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 5000));
   try {
     const repos = await Promise.race([probePromise, timeoutPromise]);
     if (repos.length === 0) telemetry = "no-index";
     else telemetry = "ok";
   } catch (e) {
     if (e.message === "timeout") telemetry = "timeout";
     else if (toolNotFound(e)) telemetry = "disabled";
     else telemetry = "crash";  // ECONNREFUSED 等
   }
````

結果：
├─ "disabled" / "crash" / "timeout" / "no-index" → step 3b
└─ "ok" → step 3a

3a. B-2 直呼路徑（agent 自主）- 依 hint.suggested_query 直呼 mcp**gitnexus**{impact|context|cypher} - 結果寫 ROUTING_TICKET runtime_telemetry block append（PROPOSAL_502_039 §3.6 step）：
gitnexus_used: true / gitnexus_callers_count: <int> / mempalace_writes: [...] - 結果若達**雙閾值任一**（PROPOSAL_502_043 R3-E4）→ 寫 mempalace drawer at room=refactor_log：- **A. callers > 10**（即 ≥11；既有閾值；對齊 ADR-0041 v3 鐵律 2-B）- **B. callers ≥ 3 AND triggered_by 含 cross-stack**（新增；解業務直覺脫節；caller=10+cross-stack 高風險仍寫）

3b. B-1 fallback 路徑 - 派發訊息加：「建議 user 跑 `gitnexus impact <symbol>` 並回填 PRIOR_ART_REPORT §B」- probe mode 寫入 telemetry（GR-B2 4 種失敗模式區分）- 不阻斷；走 PROPOSAL_502_030 既有 HITL Phase B 機制

````

### C.4 B-5 @Reviewer Stage 6 default（PROPOSAL_502_034）

`reviewer.md §s06` checklist #4 規定：
- PR diff touched_files 含 LOC>800 / cross-stack（前+後端）→ **必查 caller graph**
- Available 走 B-2；unavailable grep + REVIEW_REPORT 標 `[INFO] caller scan 不完整`
- Hotfix / typo / 單檔 < 200 LOC 不必（場景不符）

### C.6 mempalace ↔ GitNexus 結果合併規則（PROPOSAL_502_037 解 G12）

派發前 mempalace.search 結果（語意層）+ 執行期 GitNexus impact / context 結果（語法層）合併規則：

| 維度 | mempalace（語意層）| GitNexus（語法層）| 合併原則 |
|------|------------------|-------------------|---------|
| 內容 | drawer 摘要 / 歷史 lessons / 決策 | 當前 caller graph / impact / AST | mempalace 為 why；GitNexus 為 who/where |
| 時間 | 跨 session（drawer 可能過期）| 當前事實（per-repo `.gitnexus/` 重建即 fresh）| **時序仲裁**：GitNexus 為「當前」優先 |
| 角色 | **決策依據**（為何這樣做）| **執行細節**（呼叫鏈是什麼）| 合併呈現 |

**caller_count sync 時點**（PROPOSAL_502_043 R3-E5）：drawer body `caller_count_at_write` 採與 `runtime_telemetry.gitnexus_callers_count` **同次 probe** 結果（非寫 drawer 時重 probe）；agent 兩動作須 atomic（同 task close 期 append telemetry + 寫 drawer 用同個變數）。若兩值不一致 → P-35 加副偵測「telemetry vs drawer count 差 >0」→ 🟡 提醒 sync 失敗。

**Agent 合併步驟**：
1. 若 mempalace drawer 提及具體檔案路徑 + GitNexus 顯示該路徑不存在 → drawer 過期；觸發 `update_drawer` 加 `last_verified_at` + `superseded_by_drawer_id`（ADR-0041 v3 鐵律 2-D）
2. 若 mempalace drawer 提及 anti-pattern + GitNexus 顯示新 caller 仍重蹈 → 標 🟡 `[WARNING]`（pattern 重現）
3. 若 mempalace 無相關 drawer + GitNexus 結果重大（caller >10 / cross-stack）→ Stage 5.5 / 6 寫新 drawer 至 `room=refactor_log`

**衝突優先級**（PROPOSAL_502_041 GR-F1 加第三類）：
- **命名衝突**（mempalace 提「OldName」+ GitNexus 顯「NewName」）→ GitNexus 優先；mempalace 過期 → update_drawer 加 last_verified_at + superseded_by_drawer_id
- **邏輯衝突**（mempalace 說「應走路徑 A」+ GitNexus 顯實際走路徑 B）→ user 仲裁；agent 標 🟡 提交 user 決策
- **結構性 drift**（symbol split / merge / move）— 例：`processPayment` → `PaymentInitiator + Executor + Reconciler` 1→N 拆分；或 `A.foo + B.foo` → `Common.foo` 2→1 合併
  - GitNexus 優先（當前事實）
  - 寫**新** drawer 至 `room=refactor_log`，含 `split_into: [<new symbols>]` 或 `merged_from: [<old symbols>]` 欄位
  - 舊 drawer **批次 update_drawer**：對 ALL 命中 drawer 逐一加 `superseded_by_drawer_id: <新 drawer_id>`（解 GR-F3 批次處理）
  - **未對 ALL 命中 drawer update** 視為違反 ADR-0041 v3 鐵律 2-D；P-35 加副偵測「mempalace_writes 為空 + drawer 命中 ≥2」→ 🟡

### C.5 B-1 偵測場景（lead.md auto-hint；4+1 觸發條件 + 前置短路）

**前置短路**（PROPOSAL_502_042 GR-H5；優先序硬編開頭）：派發前先檢 `task_class=hotfix AND hotfix_tier=light` → **skip 整段**（hotfix-light 三機制全關）；否則進 grep 4+1 條件。

派發前 batch 後 lead.md 跑輕量 grep（不耗 IPC）：

| 觸發 ID | 條件 | 範例 |
|---------|------|------|
| cross-stack | touched_files ≥3 + 含 ≥2 種**主層**副檔名（白名單對 OR heuristic fallback PROPOSAL_502_042 GR-A3）；正規化：`.test.ts/.spec.ts` → `.ts`；`.d.ts` → `.ts`；`.tsx` 視為 `.ts` 集合內 | Frontend Vue + Backend FastAPI 同改 |
| large-file | 任一 touched_file LOC > 800 | grep -c '^' file.ts > 800 |
| refactor-keyword | user 指令含**完整中英擴充清單**（PROPOSAL_502_042 GR-A1）；下方表 | "改名 getUserOrders 跨前後端" |
| frontend-backend-pair | touched_files 同時含 frontend 路徑 + backend 路徑（**路徑慣例白名單** PROPOSAL_502_042 GR-A2）| src/components/ + src/api/；backend/ + frontend/；server/ + web/ |
| **onboarding-scenario** | task_class=onboarding（強制命中；不依 touched_files；PROPOSAL_502_035 主題 5）| 新 codebase 接入 |

**refactor-keyword 完整清單**（PROPOSAL_502_042 + PROPOSAL_502_044 R3-A4 補極口語）：
- 英文：refactor / rename / impact / restructure / consolidate / extract / inline / move / split / merge / reorganize / cleanup / simplify
- 中文（正式）：改名 / 重新命名 / 重構 / 統一命名 / 同步調整 / 同步更新引用 / 整合呼叫 / 影響分析 / 拆分 / 合併 / 移到 / 跨檔 / 找出所有
- 中文（極口語；PROPOSAL_502_044 R3-A4）：砍掉 / 拿掉 / 幹掉 / 合一 / 收斂 / 整理 / 清乾淨 / 對齊 / 對一下 / 不對勁 / 混在一起 / 亂七八糟 / 一致一下 / 同名一下
- Heuristic fallback（PROPOSAL_502_044 R3-A5 收緊；解 false positive）：「touched_files 含 ≥1 既有檔（非新建）+ user 指令含『改 / 修 / 調整 / 重新 / 統一 / 同步 / 整合 / 影響 / 全部 / 所有』+ ≥3 caller 檔 **AND 指令含 ≥1 既有 symbol 名（已存於 touched_files grep ≥2 處）**」→ 視為 refactor-keyword 命中
  - 副條件：indent 「指令含既有 symbol 名」過濾「全部統一改 config」「所有 client 統一用 axios」等 false positive
- LLM fallback（ADR-0042 層 3）：精確清單 + heuristic 全 miss → @Lead 呼 LLM 推「is_refactor: bool」

**frontend-backend-pair 路徑慣例白名單**（PROPOSAL_502_042 GR-A2 + PROPOSAL_502_043 R3-E2 加結構特徵 heuristic）：認可的前端目錄 ↔ 後端目錄配對：
- 前端：`{src/components/, src/views/, frontend/, web/, client/, ui/, app/, pages/, mobile/}`
- 後端：`{src/api/, src/services/, backend/, server/, api/, services/, lib/, internal/, app/api/}`
- monorepo 結構：`{frontend/, backend/}` / `{client/, server/}` / `{web/, api/}` / `{packages/<frontend>, packages/<backend>}`
- **結構特徵 heuristic**（PROPOSAL_502_043 R3-E2；解 business-domain 命名如 `Acme.Accounting/` / `bi-dashboard/` miss）：
  - 後端：目錄名含 `Controller(s) / Service(s) / Repository / Models / Domain / Handler` 子目錄 → 視為後端（不依字面前綴）
  - 前端：目錄名含 `dashboard / widget / component / ui / view / page / screen` → 視為前端
  - 例：`Acme.Accounting/Controllers/` → 後端命中；`bi-dashboard/lib/widgets/` → 前端命中

**Cross-stack heuristic fallback**（PROPOSAL_502_042 GR-A3；白名單外 stack 不漏）：白名單對未命中 → 檢查 `touched_files` 含 ≥2 種**程式碼**副檔名（**排除** `.json/.toml/.yaml/.md/.txt/.lock/.env/.gitignore` 等配置/文件副檔名）→ 視為 cross-stack。例：`.scala + .ts` / `.cs + .vue` / `.swift + .kt` / `.dart + .py` 等次主流 stack 自動覆蓋。

**Cross-stack 白名單副檔名對**（PROPOSAL_502_038 G5 強化；解誤觸發）：認可的「跨棧」配對：
- `{.ts, .tsx}` ↔ `{.py, .pyx}` — 典型 frontend TS + backend Python
- `{.vue, .ts}` ↔ `{.py}` — Vue 前端 + Python 後端
- `{.go}` ↔ `{.ts, .tsx, .vue}` — Go 後端 + 前端
- `{.rs}` ↔ `{.ts, .tsx}` — Rust 後端 + 前端
- `{.java, .kt}` ↔ `{.ts, .tsx, .vue}` — JVM 後端 + 前端

**不算 cross-stack**（避免誤觸發）：
- 同集合內 mix：`.ts + .tsx + .vue`（純前端）；`.py + .pyx`（純 Python）
- 配置 + 程式碼：`.ts + .json` / `.py + .toml`
- 測試 + 主檔：`.ts + .test.ts`（正規化後同檔）

任一命中 → 寫 ROUTING_TICKET：
```yaml
gitnexus_hint:
  triggered_by: cross-stack | large-file | refactor-keyword | frontend-backend-pair | onboarding-scenario
  suggested_query: "gitnexus impact <symbol>" | "gitnexus context <file>" | "gitnexus analyze ."
  fallback: "B-1 Prior Art Phase B（user 自跑 + 回填）"
  optional: false                # PROPOSAL_502_035；onboarding-scenario 強制 true → P-32 偵測只記 🟢 不升 🟡/🔴；其他場景 default false
````

**suggested_query 抽取規則**（PROPOSAL_502_042 + PROPOSAL_502_044 R3-A6 補 URL 抽取）：

- 優先：user 指令明示 symbol 名（grep `\\b[a-zA-Z_]\\w*\\b` 命中且該名在 touched_files grep 命中 ≥2 處）→ 用該 symbol → `gitnexus impact <symbol>`
- Fallback A：無 symbol 但有 URL pattern（含 `/`）→ 抽最後 segment 轉 PascalCase 候選（例 `/api/accounting/v2/period-summary` → 候選 `PeriodSummary`）+ 「fuzzy 命中 touched*files」→ `gitnexus impact <PascalCase*候選>`
- Fallback B：無 symbol + 無 URL 但有 touched_file → `gitnexus context <touched_file_path>`
- Fallback C：無 symbol + 無 touched_file（onboarding 場景）→ `gitnexus analyze .`

**hotfix-light 例外**（PROPOSAL_502_035 主題 1；lead.md §s07）：`task_class=hotfix + tier=light` → **不寫 gitnexus_hint**（即使 4 條件命中）。Hotfix 緊急通道優先。

## §D SoT 邊界（ADR-0041）

| 維度            | mempalace                           | GitNexus                                              |
| --------------- | ----------------------------------- | ----------------------------------------------------- |
| 角色            | **primary SoT**（語意層；ADR-0039） | **auxiliary cache**（語法層）                         |
| 持久性          | 跨 session（drawer + cold export）  | per-repo `.gitnexus/`（gitignored；可重建）           |
| 派發前必查      | ✅ 是（鐵律）                       | ❌ 否（場景觸發才查）                                 |
| 結果若要持久    | 直接寫 drawer                       | **手動寫 mempalace drawer 摘要**（agent 可提醒 user） |
| 不可達 fallback | `.export/` + `.pending/`            | 無；直接退回 grep / Read                              |

**鐵律**：mempalace 永遠是 SoT；GitNexus 結果絕不取代 mempalace drawer。

## §E 反模式（禁止行為）

1. ❌ Agent 自行 `npm install gitnexus`（user 動作；agent 0 user-script-execution 鐵律但 npm install 屬環境裝置權）
2. ❌ 派發前 batch 加 `gitnexus query`（非 SoT；浪費 IPC）
3. ❌ GitNexus 結果直接當 SoT（必透 mempalace drawer 摘要持久）
4. ❌ Hotfix / typo 任務建議 user 跑 GitNexus（場景不符；增 cognitive load）
5. ❌ 商用專案 user 用 GitNexus 不告知 license（PolyForm Noncommercial 1.0.0 約束）

## §F 關聯

- ADR-0039（mempalace primary SoT）
- ADR-0041（mempalace 語意 vs GitNexus 語法 邊界；本 skill 之決策依據）
- `skills/routing-ticket-protocol.md` §schema `memory_hint` 欄位（GitNexus 結果摘要可寫此）
- `skills/lead-orchestration-guide.md §四` Prior Art Gate Phase B（外部工具輸入點）
- PROPOSAL_502_030（HITL-first；天然吃 GitNexus 輸出）
- PROPOSAL_502_033（本 skill 建立提案）

---

**維護紀錄**：

- 2026-05-06：PROPOSAL_502_033 建立（F2 類；GitNexus v初版接入）
- 2026-05-06：PROPOSAL_502_034 v2 補 §C.3-C.5（B-1/B-2/B-5 整合決策樹 + 偵測場景；ADR-0041 鐵律 3 amend）

## Related Decisions

- [ADR-0039](../decisions/0039-mempalace-memory-backend.md) — MemPalace primary SoT
- [ADR-0041](../decisions/0041-gitnexus-syntax-cache-boundary.md) — GitNexus syntax cache boundary
