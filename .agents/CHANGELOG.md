# Framework Changelog

> 由 PROPOSAL_20260423_001 建立。
> 記錄 `.agents/` 框架層時序變更；採 [Keep a Changelog](https://keepachangelog.com/) 格式。
> `@Lead` 於每次提案執行 Phase E 時 append 對應 `[vX.Y]` 章節（依 RULES_DESIGN_GUIDE §十二 第 5 條）。
> 多專案並行（方案 B）升級時參照本檔決定是否拉取新版框架。

> **注意（依 PROPOSAL_20260423_012 Phase B）**：新增的 `[vX.Y]` 條目由 `gen-changelog.mjs --write` 自動 prepend。手動編輯既有條目為允許；但新增條目 **必須透過 generator**（`gen-changelog --check` 會驗證提案+版本條目存在）。

---

## [v6.28] - 2026-05-02

### Added — Platform compatibility layer（PROPOSAL_502_019）

- **PROPOSAL_20260502_019**（Lite → DONE；P2）：multi-harness 支援度公佈 + adapter 設計指南 + 自動偵測
  - T-1：新建 `docs/PLATFORM_COMPATIBILITY.md`（4 harness × 12 capability 對照表 + 已知限制 + 移植成本估算 + 部署建議）
  - T-2：新建 `tasks/harness-adapter-pattern.md`（4 個 adapter 切入點：sub-agent dispatch / MCP / hooks / 工具命名 + Qwen-Agent 概念實作 + DoD）
  - T-3：新建 `scripts/platform-detect.mjs`（自動偵測 harness + 12 capability + fallback 建議 + warnings；支援 `--json` / `--verbose`）

### Changed

- `.agents/FRAMEWORK_VERSION`：v6.27 → v6.28（minor bump）

### Notes

- 解 User 詢問「是否支援 Antigravity / 自建 Qwen Agent / Claude Code Web」；公布支援度誠實版
- **支援度總表**：Claude Code CLI 100% / Web 70-80% / Antigravity 60-70% / Qwen Agent 50-60%
- 不變層（rules / iron-themes / decisions / skills / tasks / validators / mempalace CLI）任何 harness 共用
- 4 個可變層需 adapter（sub-agent / MCP / hooks / tools）；指南 + 範例已備
- platform-detect.mjs 可即時告訴 User 當前環境能用什麼 / 缺什麼 / 建議降級策略
- 真實 adapter 實作（按需做）+ web mode fallback wiring 不在本提案；future PROPOSAL

---

## [v6.27] - 2026-05-02

### Added — 重驗 sprint 5 bug 修補（PROPOSAL_502_018）

- **PROPOSAL_20260502_018**（Lite → DONE；P0）：13 情境重驗發現的 5 個新 bugs（皆 014-017 sprint 自身引入）
  - R-1 修 5 個錯誤 ADR body 連結（3 task SOP；0001/0002/0034 檔名）
  - R-2 ref-validator 擴展（加 tasks/ 目錄 + 掃 body markdown ADR links；補漏網檢查）
  - R-3 PENDING_DISPATCHES queue 串接 lead.md §s_complexity_lane（解 017 Q-8 孤兒）+ 加 P-29 DISPATCH_QUEUE_OVERFLOW
  - R-4 retro.md §s_exemption_audit hotfix 24h 矛盾解（trigger=@Lead；execute=@Retro 分離）
  - R-5 14→15 validators 文字統一（run-all.sh helper / proposal-adoption / PRODUCTION_READINESS）
  - R-6 auditor.md §s03 baseline 比對加 affects_dimension 必含註解（schema 加但 consumer 升級）
  - R-7 補做 v6.21→v6.26 drift_score sync（016 P-2 SOP 自身違反；單一 SoT = AUDIT_HISTORY；FRAMEWORK_VERSION 鏡像）

### Changed

- `.agents/tasks/workspace-switch-handover.md` / `session-start-checklist.md` / `existing-project-import-workflow.md`（5 個 ADR 連結修正）
- `.agents/tests/ref-validator.mjs`（SCAN_DIRS 加 tasks + body link scan）
- `.agents/rules/lead.md §s_complexity_lane`（並發排隊串接）
- `.agents/skills/patrol-notification-catalog.md`（P-29；§A 標題 P-28→P-29）
- `.agents/rules/retro.md §s_exemption_audit`（trigger vs execute 分離）
- `.agents/tests/run-all.sh` / `.agents/tasks/proposal-adoption-workflow.md` / `.agents/docs/PRODUCTION_READINESS.md`（14→15）
- `.agents/rules/auditor.md §s03`（affects_dimension 必含）
- `.agents/docs/Reports/AUDIT_HISTORY.md`（v6.27 baseline；drift_score 0.957→0.883；persona ↓ / boundary ↑）
- `.agents/FRAMEWORK_VERSION`：v6.26 → v6.27 + auditor_baseline 三欄 sync
- `.agents/skills/lead-context-mappings.md` 等 4 處 inline P-01~P-29 同步

### Notes

- **13 情境重驗通過率 4 部分 → 全 fixed**：S20 / S21 / S22 / S26 全清
- 14 → 15 validators 全綠（連續第 6 個版本完全 clean state）
- drift_score 0.957 → 0.883（Δ=-0.074；persona_stability 0.962→0.731 反映 5 sprint 大幅修改；boundary_adherence 0.862→0.954 反映 tier 釋放 + KI 治理 + SOP 補強；仍 PASS ≥ 0.85）
- patrol P-29 加入；catalog P-01 ~ P-29
- 「行為層」+「validator 層」+「文件層」三層驗證對齊；自動化 enforcement 仍 weak（drift sync / queue patrol 需 future automation）

---

## [v6.26] - 2026-05-02

### Added — 27 情境模擬演練後 4-proposal sprint

- **PROPOSAL_20260502_014**（Lite → DONE；P0）：Tier 1 架構性修補
  - N-1 PENDING_ACTIONS / ROUTING_TICKET §🏠 ACTIVE_WORKSPACE 標頭 + session-start 漂移檢測
  - N-2 新建 `tasks/workspace-switch-handover.md`（5 步 snapshot/restore SOP）
  - N-3 ROUTING_TICKET status 4→8 enum + task_class 4 enum + validator
  - N-4 工作對話 counter 持久化 + wall-clock 7 天 fallback
  - N-5 ADR-0014 路徑 / 載體勘誤
  - N-6 retro.md 補 §s_exemption_audit（解死鏈 + 24h 自動歸檔 hotfix）
  - N-7 lead.md §s05/s07 + architect §s05 任務分類例外（modify-existing / doc-sync / hotfix light）
  - N-8 文字勘誤（archive→archived；12→14 validators）

- **PROPOSAL_20260502_015**（Lite → DONE；P1）：偵測 + 防線層
  - O-1 P-27 SUBAGENT_TIMEOUT
  - O-2 P-28 DRAWER_COUNT_THRESHOLD
  - O-3 memory-palace-validator 加 §7 SoT vs vector store drift 偵測
  - O-4 backend.md §s06 加 Pre-execution 刪除防線
  - O-5 memory-operations §2.5 偵測時機細化（probe / fail-fast / health-check）
  - O-6 memory-operations §2.6 sub-agent fallback 行為對照表 + 復活切回流程

- **PROPOSAL_20260502_016**（Lite → DONE；P1）：治理層補強
  - P-1 AUDIT_HISTORY auto-append 強化（missing → P-15 升 🔴）
  - P-2 drift_score 三處同步 SOP（每 minor bump 必跑 + 單一 SoT）
  - P-3 drawer count SoT 文件統一
  - P-4 retro.md §s09 批次歸檔執行條件 + 4 步流程 + 鐵律 @Retro
  - P-5 KNOWN_ISSUES schema 加 affects_dimension（5 條目補對應 dim）
  - P-6 KI-005 計時器明文（連續 3 次 dim 4 ≥3.0）
  - P-7 audit-retro-coordination「連續 2 次」明文（同一維度）

- **PROPOSAL_20260502_017**（Lite → DONE；P2）：SOP + 文字一致性
  - Q-1 新建 `tasks/existing-project-import-workflow.md`（既有專案 5 步 SOP）
  - Q-2 lane-routing 加 modify-existing 案例
  - Q-4 新建 `tasks/proposal-adoption-workflow.md`（6 步 SOP；從 template 抽 task）
  - Q-5 衝突仲裁記錄 SoT 強制（AUDIT_DECISION_LOG §仲裁）
  - Q-6 parallel-review §防線 3 加「複審結論矛盾」row
  - Q-8 PENDING_ACTIONS 加 §📥 PENDING_DISPATCHES queue（解並發排隊）
  - Q-9 Discussion mode skill map 加 rule_category + Memory Palace 雙寫 keyword
  - Q-10 散在文字勘誤（lead 5→6 欄位 / reviewer telegram-miniapp-sdk / Redis stub）

### Changed

- `.agents/FRAMEWORK_VERSION`：v6.25 → v6.26（minor bump；4 個 Lite 同 sprint）

### Notes

- **27 情境 tabletop walkthrough → 30 個 🔴 BUG + 30 個 🟡 GAP + 22 個 💡 → 4-proposal sprint 全處置**
- 14 validators 全綠 + 0 warnings（連續第 5 個版本完全 clean state）
- 5 個 KI 條目升級 schema（affects_dimension）
- 新增 4 個 task SOP：workspace-switch-handover / existing-project-import / proposal-adoption / + 修補 multiple
- ADR-0014 amend；ADR-0038 仍為 4 tier
- proposals 累積 = 105

### Architecture Milestones

- ROUTING_TICKET status 4 → 8 enum；task_class 4 enum 引入
- @Assistant 巡邏 P-26 → P-28（補 timeout / drawer threshold）
- KNOWN_ISSUES schema 加維度標記
- @Lead 並發排隊機制明文（PENDING_DISPATCHES）
- 既有專案導入 SOP 完整覆蓋（綠地 vs 既有 雙軌）

---

## [v6.25] - 2026-05-02

### Added

- **PROPOSAL_20260502_013**（Lite → DONE；P1）：Tabletop walkthrough 4 bug 修復（8 情境演練 4 處 GAP）
  - M-1：`session-start-checklist.md` Step 2 補「結果分支」3 種（檔案存在完整 / 損毀 / 不存在 fresh init）+ Step 5 決策表加第 6 情境（🟢 fresh init；不阻斷接受新指令）
  - M-2：`assistant.md §s05` 加「首次巡邏初始化」段落；偵測 PENDING_ACTIONS 不存在 → 依 pending-actions-template 自動建立空殼（fresh init 預設值明文）
  - M-3：`memory-operations.md` 3 處 CLI flag 修正 `--limit` → `--results`（實際 mempalace CLI 是 `--results`；`--limit` 會 unrecognized arguments error）+ §1 Core MCP tools 表加「CLI flag」column + 重要對照註解（CLI vs MCP API 參數名差異）
  - M-4：`routing-ticket-protocol.md` schema 加 `memory_mode: mcp | filesystem_fallback`（PROPOSAL_502_009 P-26 周邊；ADR-0039 hybrid fallback）+ `memory_hint`（palace.search 結果摘要）+ `routing-ticket-validator` 加合法值檢查

### Changed

- `.agents/tasks/session-start-checklist.md` / `.agents/rules/assistant.md §s05` / `.agents/skills/memory-operations.md` / `.agents/skills/routing-ticket-protocol.md` / `.agents/tests/routing-ticket-validator.mjs`
- `.agents/FRAMEWORK_VERSION`：v6.24 → v6.25

### Notes

- **8 情境 tabletop walkthrough 通過率：4/8 → 8/8（100%）**
- 14 validators 全綠 + 0 warnings（連續第 4 個版本完全 clean state）
- 系統實際可用性驗證完成；可正式上線使用

---

## [v6.24] - 2026-05-02

### Added

- **PROPOSAL_20260502_010**（Lite → DONE；P1）：治理收尾 — Q1 audit 6 處漂移修復（PROPOSAL_INDEX / superseded_by / mempalace.yaml / 11 rules frontmatter / lead footer / 三房間用語校準）
- **PROPOSAL_20260502_011**（Lite → DONE；P1）：central_orchestrator tier 設立 — lead.md 一勞永逸方案（Q2 audit Option F）
  - ADR-0038 amend：判定 5 原則（新增 #5 User-facing entry + 聚合 ≥ 3 orchestrator iron-laws）；4 tier（central_orchestrator: warn=2500 / block=3500）
  - **效果**：lead.md 1749/1800（97.2%）→ **1782/2500（71%；剩 718 token healthy headroom）**；3+ 年 sustainability
  - Iron-Law Index 合併 SKIPPED（headroom 已充足；保留為未來 hygiene patch）
- **PROPOSAL_20260502_012**（Lite → DONE；P2）：skills/ by-type 重組 + ~250 references 全域更新（Q3 audit Option A）
  - ref-validator walkMd() 遞迴；git-diff-detector 子目錄 case
  - 35 檔 git mv：templates/(16) + examples/(12) + checklists/(7)；頂層 64 → 29
  - perl 雙 pass 跨檔 reference 更新（覆蓋 .md / .mjs / .sh / .yaml / .json）
  - 新建 skills/README.md（目錄結構 + audience 標示：User-invoked < 3 檔）

### Changed

- `.agents/decisions/0038-tier-based-rule-budget.md`（5 原則 + 4 tier amend）
- `.agents/SYSTEM_THRESHOLDS.yaml`（tier block 加 central_orchestrator）
- `.agents/tests/rule-token-budget-validator.mjs` / `schema-validator.mjs` / `ref-validator.mjs` / `lib/git-diff-detector.sh`（4 validators 升級）
- `.agents/rules/lead.md`（rule_category: central_orchestrator + footer ADR-0034/0039）
- 12 rules frontmatter（lead + 11 sub-agent rules）+ title comment 升版
- `.agents/proposals/completed/PROPOSAL_20260430_002.md`（superseded_by + ⚠️ banner）
- `.agents/skills/`（35 檔 git mv 至子目錄；250+ references 跨檔更新）
- `.agents/memory/mempalace.yaml`（4 rooms schema）
- `.agents/FRAMEWORK_VERSION`：v6.23 → v6.24（minor bump；3 個 Lite 同 sprint）

### Notes

- **3 個 Lite 提案同 sprint 採納**（510 + 511 + 512）：pre-launch 評鑒 3 大 Q 完整處置
- **首次 100 proposals 完成**：FRAMEWORK_VERSION proposals 計數達 100
- 14 validators 全綠 + **0 warnings**（連續第 3 個版本維持完全 clean state）
- ADR-0038 amend：3 tier → 4 tier（central_orchestrator 新類；只 lead.md 符合）
- skills/ 結構化：64 檔 flat → 子目錄分組（45% 頂層；55% 子目錄）
- 治理層完成度：88% → ~98%（MemPalace 五部曲 + governance 三部曲完工）

---

## [v6.23] - 2026-05-02

### Added

- **PROPOSAL_20260502_009**（Lite → DONE）：Post-launch 防呆三補（pre-launch 評鑒 Phase B/D 觀察項處置）
  - I-1：`patrol-notification-catalog.md` 加 P-26 `MEMPALACE_SILENT_SKIP`（解 Phase D Risk #2 M×H；MCP 可達情況下 ROUTING_TICKET 無 mempalace.\* 引用 → 🟡；累計 ≥ 3 升 🔴）
  - I-2：`rule-token-budget-validator.mjs` 加 `loadKIAllowlist()` KI-001 已知 warning 不計入 warnings 總數（解 Phase D Risk #4 M×M；防新 warning 被掩蓋）
  - I-3：`docs/PRODUCTION_READINESS.md §2` 加 sub-agent timeout 行（單次重試 1 次 → 升級 User；SLA 5 min；與 ≥3 累積 dispatch failure 全局阻斷分離；解 Phase B 缺口）
  - I-4：`KNOWN_ISSUES.md` 加 KI-005（C-4 持續🔴 自動歸檔行為合規由 @Auditor 觀察；解 Phase C archive validator 缺口；不立 validator）

### Changed

- `.agents/skills/patrol-notification-catalog.md`：加 P-26（`P-01~P-25` → `P-01~P-26`）；6 處 inline references 同步（rules/assistant.md×3 / lead-context-mappings / assistant-summary-protocol / agents-overview）
- `.agents/tests/rule-token-budget-validator.mjs`：KI 已知 warning allowlist 邏輯
- `.agents/FRAMEWORK_VERSION`：v6.22 → v6.23（minor bump）

### Notes

- **首次達到完全 clean state**：14 validators 0 errors / **0 warnings**（KI-001 allowlist 後）
- KNOWN_ISSUES 5 條目：KI-001（observation；704 自然成長前無動作）/ KI-003（partial closure；待 retro）/ KI-004（observation）/ KI-005（observation；首次違反才補 validator）
- KI-002 已於 PROPOSAL_502_006 解除
- pre-launch 評鑒所有 4 minor patches（PROPOSAL_502_008）+ 4 optional patches（PROPOSAL_502_009）全處置完成
- 剩餘 post-launch deferred：skills+tasks 78→<50 整併（@Retro periodic-design-review 觸發）/ ChromaDB 損壞自動偵測（首次故障後評估）

---

## [v6.22] - 2026-05-02

### Added

- **PROPOSAL_20260502_008**（Lite → DONE）：Pre-launch 收尾 4 patch（完整 pre-launch 評鑒後）
  - H-1：lead.md §s_memory_palace 「Drawer count 健康閾值」段壓縮為 1-line 指針；詳細移至 `memory-operations.md §6.5`；token 1779 → 1749（剩 51 token healthy headroom；解 Phase D Risk #3）
  - H-2：補 PROPOSAL_502_006 F-3 漏網的 stale §s10 引用（`rules/reviewer.md:65` + `skills/checklists/backend-dod-checklist.md` frontmatter）
  - H-3：`docs/PRODUCTION_READINESS.md §1.1` 校準 13 → 14 validators + 補 memory_palace 列舉 + KI-001 註明
  - H-4：新建 `tasks/session-start-checklist.md`（5 步 SOP；解 Phase B audit 缺口 + Phase D Risk #5）

### Changed

- `.agents/rules/lead.md`：1779 → 1749 tokens（orchestrator tier 1800 warn；剩 51 token；下次小修不再緊張）
- `.agents/skills/memory-operations.md`：§6 加 §6.5「@Lead dispatch 阻斷整合」承接 lead.md 移出內容
- `.agents/rules/reviewer.md` / `.agents/skills/checklists/backend-dod-checklist.md`（stale §s10 引用補）
- `.agents/docs/PRODUCTION_READINESS.md`（validator count drift 校準）
- `.agents/FRAMEWORK_VERSION`：v6.21 → v6.22（minor bump）

### Notes

- 完整 pre-launch 評鑒由 4 並行 audit subagent 執行（A 驗證 504-507 / B 生產就緒 / C 跨刀整合 / D 風險登記）
- 評鑒結果：SAFE TO LAUNCH with 4 minor patches（本提案處理）
- 剩餘 post-launch optional：MEMPALACE_SILENT_SKIP patrol code / KI-001 validator allowlist / C-4 archive validator / sub-agent timeout playbook / skills+tasks 78→<50 整併
- 14 validators 全綠（0 errors；1 既有 KI-001 warning）

---

## [v6.21] - 2026-05-02

### Added

- **PROPOSAL_20260502_006**（Lite → DONE）：architect.md + backend.md token slim（KI-002 主動處理；解除 KNOWN_ISSUES）
  - F-1：architect.md 1446 → 1303 tokens（-143；-9.9%）；§s04 / §s09 / §s10 slim（保所有量化門檻表 + 「絕對禁止」語意）
  - F-2：backend.md 1426 → 1319 tokens（-107；-7.5%）；§s09+s10 合併 + §s07 零容忍指針化 + §s12 Hotfix 壓縮
  - F-3：3 處 §s10 引用更新指向新 §s09（lead-artifact-protocols / backend-examples / dod-audit-template）
  - F-4：KI-002 解除（兩 rule 皆遠低於 worker tier 1500 warn；剩 ~190 token healthy headroom）
- **PROPOSAL_20260502_007**（Lite → DONE）：Deprecated cleanup（W-4 token_budget_ref + SYSTEM_THRESHOLDS deprecated 子鍵；KI-003 部分閉合）
  - G-1：SYSTEM_THRESHOLDS.yaml 移除 `token_budget.warn/block/target_max`（保 `exempt_files: []` validator 仍讀）
  - G-2：13 rules frontmatter 全清 `token_budget_ref: TOKEN_*_LIMIT`（ADR-0038 後語意失效）
  - G-3：RULES_METADATA_SCHEMA.md §84 / §245 / §350 對齊（標 REMOVED + 範例移除 + Token Monitor 改 rule_category）
  - G-4：KNOWN_ISSUES.md KI-003 條目部分閉合（W-4 + deprecated 子鍵已清；剩餘 hardcoded 數字 / DoD 體例仍觀察）

### Changed

- `.agents/rules/*.md`（13 檔 frontmatter）/ `.agents/SYSTEM_THRESHOLDS.yaml` / `.agents/RULES_METADATA_SCHEMA.md` / `.agents/KNOWN_ISSUES.md`
- `.agents/rules/architect.md`（§s04 / §s09 / §s10）/ `.agents/rules/backend.md`（§s07 / §s09+s10 合併 / §s12）
- `.agents/skills/lead-artifact-protocols.md` / `backend-examples.md` / `dod-audit-template.md`（§s10 → §s09 引用更新）
- `.agents/RULES_VERSION_INDEX.md`（auto-regen；frontmatter 變更觸發）
- `.agents/proposals/PROPOSAL_INDEX.md`（auto-regen）
- `.agents/FRAMEWORK_VERSION`：v6.20 → v6.21（minor bump；兩個 Lite 同 sprint）

### Notes

- KI-002 解除 + KI-003 部分閉合 = pre-launch 架構性風險最小化
- 剩餘 KNOWN_ISSUES：KI-001（iron-theme 696/600；observation）+ KI-003（hardcoded 數字 / DoD 體例；retro 排程）+ KI-004（7+ MCP tools advanced；觀察）
- 14 validators 全綠（0 errors；1 既有 rule_token warning 為 KI-001）
- MemPalace 五部曲完整收官 + 預啟動 token slim：001 基礎 → 002 廣度 → 003 永續性 → 004 邏輯補完 → 005 KNOWN_ISSUES 治理 → 006 token slim → 007 deprecated cleanup
- 永續性 runway 重新估：architect/backend 各剩 ~190 token headroom（從原 55-75）；下次大改不再被迫拆 skill

---

## [v6.20] - 2026-05-02

### Added

- **PROPOSAL_20260502_004**（Lite → DONE）：MemPalace 整合補完 + 邏輯一致性修補（Phase 1-4 audit 跨階段點名 6 項）
  - D-1：`auditor.md §s03` 第 3 條 baseline 比對加 KNOWN_ISSUES 讀取 + `mempalace.search` baseline-search hook（達成 13/13 整合；不違反 auditor-rubric-iron Rule #2/#3）
  - D-2：`lead.md §s_memory_palace` 加 drawer count 阻斷派發強制條款（>5000 暫停 + 必先 compress；>1000 🟡 排程）
  - D-3：`memory-palace-schema.md` §3 操作流程整段移交 `memory-operations.md`；§6 Hybrid Fallback 移交 §2.5；行數 174 → 133（-24%）；移除 ~30-40% 重疊
  - D-4：`assistant.md §s04` 異常判定表加 PENDING_RED_EXPIRE 至 §s07 自動歸檔 drawer 指針（讀者跨 section 不漏看）
  - D-5：`mempalace-auto-mine.sh` header 退出碼契約釐清（post-commit / `--staged` + pre-commit 行為差異）
  - D-6：PROPOSAL_502_002 §43「@Auditor 已整合」勘誤 → 暫未整合 + 引用 D-1 補位
- **PROPOSAL_20260502_005**（Lite → DONE）：KNOWN_ISSUES 治理 + cleanup（Phase 4 永續性）
  - E-1：新建 `.agents/KNOWN_ISSUES.md` 4 條目（KI-001 data-deletion 696/600 / KI-002 architect.md 96.3% / KI-003 PROPOSAL_501_004 26 deferred WARNINGs / KI-004 7+ MCP tools 未利用）+ 引用規範 + 解除流程 + 三方參照（@Auditor / @Retro / @Lead）
  - E-2：刪 `.agents/memory_palace/` 空 stub 目錄（防與 mempalace 套件混淆）
  - E-3：`memory-operations.md §1` MCP tools 分 Core / Advanced tier（KI-004 對應；解除 advanced 條件明文化）

### Changed

- `.agents/rules/lead.md`：1722 → 1785 tokens（orchestrator tier 1800 warn；剩 15 token headroom）
- `.agents/rules/auditor.md` / `assistant.md` / `lead.md` / `skills/memory-palace-schema.md` / `skills/memory-operations.md` / `scripts/hooks/mempalace-auto-mine.sh`
- `.agents/proposals/completed/PROPOSAL_20260502_002.md`（§43 勘誤）
- `.agents/FRAMEWORK_VERSION`：v6.19 → v6.20（minor bump；兩個 Lite 提案同 sprint 共用）

### Notes

- Phase 1-4 audit（4 並行 subagent）後續整合；0 BLOCKING / 2 cleanup-tier 🔴 全清；~12 🟡 中 8 處置（其餘 4 進 KI-001~004 觀察）
- KI-002 architect.md 96.3% 為下次預警；下次大改前必先審
- Hybrid fallback helper script + diagnostic-playbook MemPalace + backend.md strategy_context write-back 留待後續觀察
- 14 validators 全綠（0 errors；1 既有 rule_token warning 為 KI-001）
- MemPalace 五部曲完整：001 基礎 → 002 廣度（12+1 達 13/13）→ 003 永續性 → 004 邏輯補完 → 005 KNOWN_ISSUES 治理

---

## [v6.19] - 2026-05-02

### Added

- **PROPOSAL_20260502_003**（Lite → DONE）：MemPalace 永續性整合 Tier 2+3（4 項雙星 win）
  - C-1：`.agents/scripts/hooks/mempalace-auto-mine.sh`（自動採礦；偵測 git 變動 + 增量呼叫 mempalace mine；冪等；可選裝至 post-commit 或 Claude Code PostToolUse）
  - C-2：memory-palace-validator drawer count 健康閾值（>1000 🟡 WARN / >5000 🔴 ERROR）+ skills/memory-operations.md §6 Compress 流程（4 步驟 + AAAK Dialect 30x 特性 + 禁止條款）
  - C-3：init-workspace.mjs 加 `runMempalaceWakeup()`；workspace 切換 / 建立成功後自動跑 wake-up 注入 L0+L1 上下文（~600-900 tokens）；mempalace 不可用時靜默降級
  - C-4：assistant.md §s07（immutable）擴充「持續 🔴 自動歸檔」規則 — 同一 🔴 持續 > `PENDING_RED_EXPIRE` 自動寫 markdown drawer（`category: operational_critical` / `severity: critical`）+ mempalace mine；過濾條件防噪音（🟡 不寫；自動關閉 🔴 不寫）

### Changed

- `.agents/tests/memory-palace-validator.mjs`：drawer count 健康指標（COMPRESS_WARN_THRESHOLD=1000 / COMPRESS_ERROR_THRESHOLD=5000）
- `.agents/skills/memory-operations.md`：新增 §6 Compress 流程（§7 Related Decisions 編號順移）
- `.agents/scripts/init-workspace.mjs`：新增 `runMempalaceWakeup()` 純函式 + 互動式 / `--config` 雙路徑均呼叫；`--help` 文字加 PROPOSAL_502_003 C-3 註解
- `.agents/rules/assistant.md §s07`（immutable）：1401 → 1489 tokens（orchestrator tier 1800 上限）
- `.agents/FRAMEWORK_VERSION`：v6.18 → v6.19（minor bump；Lite 提案）

### Notes

- 與 PROPOSAL_20260502_001（MemPalace primary backend）+ PROPOSAL_20260502_002（12 sub-agents 整合）形成完整三部曲：基礎 → 廣度 → 永續性
- 不採納項：Tier 3-3 self-evolving prompts（違反 ADR-0001 stateless）/ Tier 3-2 cross-workspace bridge（solo + single workspace 暫無需求）/ Tier 3-1 全 KG（風險高；只做最小可行 retro 用）
- 14 validators 全綠（0 errors；1 既有 rule_token warning 為 data-deletion-zero-tolerance.md 696/600 密度，非本提案引入）
- §s07 immutable 修改原則：擴充強化（持續 🔴 自動歸檔強化原阻斷意圖），未變更既有「拒絕新功能」鐵律 → 視為相容性新增；通過 iron-theme-validator
- mempalace 套件不可用時，C-3 靜默降級為 hybrid fallback；C-1 hook warn + exit 0 不阻斷 commit；C-4 阻斷流程仍能寫 markdown SoT，只跳過 mempalace mine

---

## [v6.18] - 2026-05-02

### Added

- **PROPOSAL_20260502_002**（Full → DONE）：MemPalace 深度整合 Tier 1（12 sub-agents 接入 + 4 tasks 整合 + 5 高優先 deep integration）

### Changed

- 5 高優先 sub-agents deep integration：
  - `retro.md §s04`：歷史比對升級為 mempalace.wake-up + search + proposals 三層
  - `qa.md §s04`：TEST_SPEC 產出前 search debug_graveyard 既有踩坑作 regression TC
  - `reviewer.md §s06`：第 3 條新增 anti-pattern memory check（同類重現標 🟡）
  - `architect.md §s04`：前置 0 設計階段 search architecture + debug_graveyard
  - `security.md §s03`：第 5 條新增 SC-XX 歷史 incident 比對
- 5 一般 sub-agents 加 1-line Memory Palace 入口：
  - backend / frontend / consultant / planner / assistant 各加 §s01 段
- 4 tasks 加 Memory Palace query step：
  - hotfix-checklist Step 0 / proposal-integration-analysis Stage 0 / periodic-design-review-workflow 前置 / audit-retro-coordination Step 0

### Notes

- **整合覆蓋率**：12/13 sub-agents 直接接入（system-prompt 0 budget；經 @Lead 間接）；4/13 關鍵 tasks 整合
- **解鎖能力**：MemPalace 96.6% R@5 retrieval 從「@Lead-only」升級為「全 agent」價值
- **Token 餘量**：13 rules 全在 tier budget 內（最緊：architect 96%；backend 95%）
- **Drift PASS**：≥ 0.85（無退化）
- **Validators**：14 全綠（memory_palace=0；rule_token=1 既有 data-deletion warning）
- 結論：MemPalace 從「基礎設施」升級為「實際使用工具」；ADR-0039 真正發揮全 framework 價值

---

## [v6.17] - 2026-05-02

### Added

- **PROPOSAL_20260502_001**（Full → DONE）：Memory Backend 全面遷移至 MemPalace
- **ADR-0039**：MemPalace as Primary Memory Backend（github.com/MemPalace/mempalace v3.3.4 MIT）
- 新依賴：Python 3.9+ / pip 24+ / mempalace>=3.3.4 / ChromaDB embedded（FRAMEWORK_REQUIREMENTS §1+§2）
- `.mcp.json`（mempalace MCP server 註冊；29 tools）
- `tests/memory-palace-validator.mjs`（14th validator；6 健康檢查項）
- `skills/memory-operations.md`（MCP tools 5 典型情境 + 治理原則）
- `skills/memory-palace-schema.md` v2.0（Wings/Rooms/Drawers + hybrid fallback）

### Changed

- `rules/lead.md §s_memory_palace`：升級為 MemPalace MCP primary（mempalace.search / wake-up / read）+ hybrid fallback
- `FRAMEWORK_REQUIREMENTS.md`：§1 Runtime 加 Python 3.9+ + mempalace 必需；§2 重命名「依賴原則」+ Python 白名單
- `tests/lib/git-diff-detector.sh`：ALL_VALIDATORS 13→14（含 memory_palace）+ case 補 .agents/memory/_ / .mcp.json / skills/memory-_ 觸發
- `tests/run-all.sh`：VALIDATOR_CMD/\_TITLE 加 memory_palace
- `docs/PRODUCTION_READINESS.md` §1.5：MemPalace 健康檢查升級；§4.5 ChromaDB Corruption Recovery 新增

### Notes

- **跨 session 持久記憶解鎖**：解決 ADR-0001 stateless routing 失憶痛點
- **96.6% R@5 LongMemEval**：retrieval 精度遠超手工 INDEX grep
- **Local-first 兼容**：ChromaDB embedded；無 API key；不違 ADR-0024 精神（Python 3.9+ 為新棧；明文加入 FRAMEWORK_REQUIREMENTS）
- **Hybrid fallback 設計**：MCP down → markdown SoT grep（短期 emergency）；保留既有 markdown 治理路徑
- **Markdown SoT backup**：`.agents/memory/` 仍是 git 可審計來源；用於 re-mine 還原；vector embedding 黑箱問題緩解
- **Drawers indexed**：25（framework debug_graveyard 16 + workspace general 9）；retrieval 驗證 PASS
- **Validators**：13 → **14**（新增 memory_palace；全綠 + rule_token=1 既有 warning）
- **三軸 ADR 兼容**：ADR-0036/0037/0038 正交不衝突；ADR-0001/0034 強化整合
- **Pre-Launch Audit 強耦合解除**：lead.md §s_memory_palace 「派發前必查 INDEX」鐵律 → MemPalace MCP + fallback 機制保證可達

---

## [v6.16] - 2026-05-01

### Added

- **PROPOSAL_20260501_004**（Full → DONE）：Pre-Launch Comprehensive Framework Audit（上線前全框架稽核 6 phases）
- `tasks/pending-actions-recovery.md`：PENDING_ACTIONS.md 損毀恢復三策略（A=.bak / B=ROUTING_TICKET 重建 / C=完全重置）
- `docs/PRODUCTION_READINESS.md`：Production Readiness Checklist + Hotfix Walkthrough × 3 + Recovery Playbook × 5 + Monitoring Dashboard 設計
- SYSTEM_THRESHOLDS.yaml 新增 `rule_token_thresholds.tier`（含 iron_theme 600/1000）

### Changed

- system-prompt.md §全局緊急阻斷：條件 1+3 加 Hotfix 豁免治理（B-1）
- iron-rules/data-deletion-zero-tolerance.md：授權詞統一規範段（W-1）
- skills/checklists/strategyweight-change-checklist.md：補中段失敗回滾流程（W-2）
- skills/lead-artifact-protocols.md：Gate Check 條件表全面校準（B-3；對齊 lead.md §s05 階段編號 1-9）+ 補 Stage 4 Test Spec gate + Stage 7→8 中介 Gate
- rules/qa.md + iron-rules/machine-readable-output.md：TEST_SPEC 第一行五級符號合規（B-5）
- skills/patrol-notification-catalog.md P-23：`💡` Hint → `🟢` INFO 對齊 ADR-0030 五級（B-4）
- decisions/0029 + docs/agents-overview.md：P-23 符號同步
- skills/rule-slim-down-playbook.md：3 處 stale token_budget_exception 替換為 ADR-0038 tier 路徑（B-7）
- RULES_DESIGN_GUIDE.QUALITY.md §十四：補 Tier-based Rule Budget 表 + 4 判定原則（B-6）
- RULES_METADATA_SCHEMA.md：token_budget_ref 標 deprecated（W-4）
- iron-rules/README.md：Theme 清單補完 6 themes（跨切 3 + Solo 3；W-3）+ parallel-review-boundary applies_to 加 project_lead
- tests/lib/git-diff-detector.sh：tasks→workspace + iron-rules→rule_token 觸發修補（W-6+W-7）
- tests/rule-token-budget-validator.mjs：iron_theme tier 校準 600/1000 + 掃 IRON_RULES_DIR
- .claude/settings.local.json.example：hook command 改 stdin/jq pattern（B-8）+ permissions 補完

### Notes

- **8 BLOCKERs 全修 + 7 重要 WARNINGs 修復**：上線前阻斷風險清零
- **26 餘 WARNINGs 退 retro 觀察**：hardcoded magic numbers / DoD 體例 / SYSTEM_THRESHOLDS dead keys 等非阻斷類
- **驗證**：13 validators 全綠（rule_token=1 warning：data-deletion-zero-tolerance 696 > 600 warn / < 1000 block；安全主題密度合理）
- **drift_score**：PASS ≥ 0.85（baseline 0.883）
- **三軸框架完整 + Pre-Launch 稽核完成 + Recovery 機制建立** → agents 上線就緒

---

## [v6.15] - 2026-05-01

### Added

- **PROPOSAL_20260501_003**（Lite → DONE）：Tier-based Rule Budget — Mutable budget 量化機制治理
- **ADR-0038**：Tier-based Rule Budget（meta/worker/orchestrator 三層 + 4 條 orchestrator 判定原則）
- 新 frontmatter 欄位 `rule_category`（必填；agent_rule + always_on 適用）
- `RULES_METADATA_SCHEMA.md` §2.2.0 Tier Budget Table + 判定原則明文

### Changed

- 13 rules 全加 `rule_category`：meta×1（system-prompt）/ orchestrator×5（lead/retro/assistant/qa/planner）/ worker×7（architect/backend/frontend/reviewer/security/consultant/auditor）
- `schema-validator.mjs`：TOKEN_LIMITS 改 TIER_BUDGETS；讀 rule_category；缺即 error
- `rule-token-budget-validator.mjs`：tier-aware；token 估算公式與 schema-validator 對齊（bytes\*0.6/4）；移除 chars/3.5 雙公式
- `RULES_METADATA_SCHEMA.md` §2.2 file_type enum 加說明（`iron_theme` PROPOSAL_002 + `rule_category` PROPOSAL_003）

### Removed

- 11 個 `token_budget_exception` 區塊（含 reason / proposal / baseline / target 子欄位）：lead / retro / assistant / qa / planner / backend / architect / frontend / reviewer / security 全清除
- token_budget_exception 機制完全退場（schema 純淨；無 escape hatch 殘留）

### Notes

- **三軸完整治理達成**：ADR-0036（mutable 縮減）+ ADR-0037（immutable 治理）+ ADR-0038（budget 量化）= rules 治理升級完整循環
- **驗證 13 validators 全綠**：schema=0 / rule_token=0 / iron_theme=0 / drift PASS / 其他 11 全綠
- **單一 SoT**：兩 token validator 公式統一（bytes\*0.6/4）；不再有 verdict 衝突
- **與 ADR-0006 對偶**：3 層 rule_category 對偶 3 層 model tier（haiku/sonnet/opus）+ 3 層 lane（fast/standard/heavy）；正交設計
- **演化路徑**：未來新 rule 加入只判定 category；不再用 exception flag 補
- **後續觀察**：若 worker 自然漲到 1500+ → 重評 tier 值（lite proposal）；本 ADR 為 first cut

---

## [v6.14] - 2026-05-01

### Added

- **PROPOSAL_20260501_002**（Full → DONE）：Iron Themes — 跨切不可變鐵律 first-class artifact 治理
- **ADR-0037**：Iron Themes — Cross-cutting Immutable Governance（4 條 theme 判定原則 + 雙向一致性機制）
- `iron-rules/` 新目錄 + 3 主要跨切 themes：
  - `iron-rules/machine-readable-output.md`（reviewer/qa/security 共用 5 條鐵律；3 處→1）
  - `iron-rules/data-deletion-zero-tolerance.md`（backend/lead/security/consultant/system-prompt 5 處→1）
  - `iron-rules/parallel-review-boundary.md`（reviewer/security 共用邊界鐵律；3 處→1）
- `tests/iron-theme-validator.mjs`（13th validator；雙向一致性檢查）
- `scripts/lib/rule-loader.mjs`（context loader 整合；`loadRuleWithThemes(agentId)`）
- `RULES_METADATA_SCHEMA.md`：`file_type` enum 新增 `iron_theme`；新欄位 `applies_iron_themes`（agent_rule）/ `applies_to`（iron_theme）/ `theme_id` / `immutable` / `modification_policy`

### Changed

- 8 rules（reviewer/qa/security/backend/consultant/lead/system-prompt + assistant 暫保）frontmatter 加 `applies_iron_themes`
- 6 rules sections 從 immutable 轉為 critical + ref 入口（s_output_strict / s06 / s07 / s10 / s11 / s02 等）
- `lib/git-diff-detector.sh §ALL_VALIDATORS`：12→13 個 validators（含 iron_theme）
- `tests/run-all.sh §VALIDATOR_CMD/_TITLE`：加 iron_theme 條目
- `tests/README.md`：13 自動 validator + ALL_VALIDATORS 同步

### Removed

- 11 處跨切重複內容（output-strict 3 處 / data-deletion 5 處 / parallel-review 3 處 → 由 iron themes canonical 取代）

### Notes

- **跨切 SoT 100% 消除**：output-strict / data-deletion / parallel-review 三 theme 取代 11 處重複；修改鐵律時改一處生效
- **structural immutability**：iron-rules/ 路徑 + iron-theme-validator 強過 `<section immutable="true">` attribute convention
- **bidirectional consistency 強制**：theme `applies_to` ↔ rule `applies_iron_themes` 雙向 validator；ALL_VALIDATORS 升 13
- **drift_score 不退化**：baseline 0.865 → final 0.865（unchanged；PASS ≥ 0.85）
- **token budget 影響有限**：3/13 達嚴格 budget（system-prompt + consultant + auditor）；10/13 仍超（mutable 自身 heavy；exception flag 保留作 mutable-only escape hatch）
- **ADR-0037 與 ADR-0036 正交**：mutable 縮減（0036）vs immutable 治理（0037）兩軸並存
- **後續 Phase H**（solo themes 抽出）為可選工作；本提案不執行；待 ROI 評估後另立 lite proposal

---

## [v6.13] - 2026-05-01

### Added

- **PROPOSAL_20260501_001**（Full → DONE）：Rules token budget 12 warnings 解消（-32%；13 rules 全完成）
- **ADR-0036**：Rule Decomposition Patterns（4 patterns + 決策矩陣 + 自驗收三層）
- `skills/rule-slim-down-playbook.md`（subagent 工作手冊；含結構不變量 + atomic write 範本）
- `skills/lead-orchestration-guide.md` §八/§九/§十（接收 lead.md 拆出內容；team roster + force_complex 7 場景 + Gate Check 範例庫）

### Changed

- 13 rules 全部 v2.0→v2.1（slim-down + token_budget_exception 標記）
- Total tokens: ~24967 → ~16856（-32%）
- 2/13 達嚴格 budget（system-prompt 494/500；consultant 986/1000）
- 11/13 觸發 token_budget_exception（lead/assistant/retro/qa/planner/backend/architect/security/frontend/reviewer/system-prompt 不適用；consultant 不適用）— orchestrator-class 含 critical/immutable section 為自足性硬限

### Notes

- **drift_score 不退化**：baseline 0.872 → final 0.865（-0.007；PASS ≥ 0.85）
- **結構保留**：13 rules 全部 section count 不變；所有 immutable section 內容未動；所有「絕對禁止」鐵律 100% 保留
- **subagent 並行教訓固化**：assistant.md 多次被 subagent 違規移除 sections（17→11→9）；playbook §三 補「結構不變量」明文 + atomic write 範本 + 並行寫衝突防護
- **「絕對禁止」鐵律 boundary_adherence 敏感**：§s01 派發鐵律段遺失導致 drift 0.846；恢復後回 0.865；compress 時必逐字保留鐵律詞
- **後續優化**：完整 11 rules 達嚴格 budget 需重新設計 immutable section 機制（允許抽出至獨立檔）；本提案不處理；ROI 衰減邊際

---

## [v6.12] - 2026-04-30

### Added

- **PROPOSAL_20260430_005**（Lite → DONE）：scripts/tasks/tests/domains/tech-stacks 整合優化（24 條 fix；4 commits）
- **ADR-0035**：Single Source of Truth — 跨工具共享清單統一原則
- `scripts/generators/lib/frontmatter.mjs`（集中 YAML frontmatter 解析；3 generators 共用）
- `tests/lib/frontmatter.mjs`（4 validator 共用 parseFrontmatter / extractFrontmatterScope）
- `domains/README.md` + Finance 三檔 SSOT 矩陣 + 衝突仲裁規則
- 13 tasks frontmatter 補齊；5 domains frontmatter 補齊；9 tech-stacks frontmatter 補齊（對齊 MANIFEST）
- `scripts/run.sh` L1 段補入 `auto-generated-block.test.mjs` + `gen-proposal-index.test.mjs` 兩 lib unit test

### Changed

- `tests/lib/git-diff-detector.sh §ALL_VALIDATORS` 升為 fast/full 共用 SoT；run-all.sh source 之
- `tests/run-all.sh --regenerate-indexes` 由 2 generator 補完到 4（rvi / pi / adr / proposal-summary）
- `tests/README.md` 重寫（12 自動 + 4 on-demand + 2 lib unit；含 SoT 章節）
- `decisions/PROPOSAL_MAPPING.md` 補 14 列（10 PROPOSAL→ADR + 4 ADR→PROPOSAL；補齊 ADR-0031~0034）
- 4 個 task rename：new-agent-onboarding→role-onboarding-checklist / domain-creation-guide→domain-creation-checklist / project-onboarding→project-onboarding-workflow / periodic-design-review→periodic-design-review-workflow
- `tasks/emergency-shutdown-playbook.md §3.2.0` verbatim 38 行壓 5 行；指 SSOT = hotfix-checklist
- `tech-stacks/desktop/semi-avalonia/SOURCE.md` 加「資料夾角色矩陣」釐清 5 檔職責邊界

### Removed

- `tech-stacks/desktop/.gitkeep`（已有實檔不需）
- 4 處 inline `parseFrontmatter` 重複實作（schema/agent-drift/routing-ticket/proposal-scope；改 import lib）

### Notes

- **SoT Pattern（ADR-0035）**：本提案首次套用「離散具名清單統一」原則。新增 validator 只改 `lib/git-diff-detector.sh §ALL_VALIDATORS` 一處，避免 fast/full 漂移。
- **零 breaking change**：4 task rename 採 git mv + 全文引用同步；lib 對外 API 與舊 inline 行為等價（已比對）。
- **Token impact ≈ 0**：lib 抽出 +100 行 / validator 各檔減 10×4=40 行；net +60 行；無 rule 受影響。
- **驗證**：12 validator + scripts L1/L3 全通過（schema/rule_token 維持 token budget warning，與本提案無關，留給 PROPOSAL_20260430_002 §M-3 延伸獨立處理）。
- **後續待辦**：PROPOSAL_20260430_002 形式提案檔缺失（同等比照建立補檔）；POC 整合（poc/langgraph-mcp/）；Pre-commit hook 範本。

---

## [v6.11] - 2026-04-27

### Added

- **PROPOSAL_20260425_002**（Full → ACCEPTED）：LangGraph + 雙環境共用 POC（公司 Qwen + 家中 Antigravity Gemini）
  - 採 **hybrid_minor**：POC 列入 framework 資產；既有 13-agent rules 並行保留（不取代）
  - Phase B 13 nodes 全跑通；HITL Prior Art Gate / Proposal Adoption 雙環跨進程 round-trip 驗證
  - 7/13 自我進化機制實證通過（T-01/04/05/07/10/11 + 程式存在）；6/13 排 Phase C 補跑
- 新 `poc/langgraph-mcp/`（~3000 lines）：
  - `state.py`（WorkflowState；對齊 PROPOSAL_023 ROUTING_TICKET schema v1）
  - `llm_factory.py`（雙 backend：qwen / gemini / sampling；動態 thinking + 16K max_tokens）
  - `graph.py`（StateGraph；70% static + 30% conditional edges）
  - `server.py`（CLI + MCP stdio 雙模；SqliteSaver 跨進程持久化）
  - `nodes/`（13 agent nodes + Auditor 5 並行 sub-nodes + qa 2 phases）
  - `tools/`（9 file/system tools；對齊既有 .agents/ 結構）
  - `tests/self-evolution-test.md`（13 項驗證 checklist）
  - `tests/dual-env-workflow.md`（10 項雙環境驗證腳本）
  - `tests/debug_qwen_raw.py`（Qwen API 原始回應 debug 工具）
- 新 `decisions/0034-langgraph-dual-env-integration.md`（Draft → **Accepted**）
- 9 大 hot-fix（POC 過程暴露 LangGraph 通用陷阱；含 Windows 友善化、TypedDict schema 完整性、Qwen3 thinking、markdown regex 容忍、cross-process checkpointer）

### Changed

- `decisions/0034-...`：status Draft → **Accepted**（accepted_at: 2026-04-27）
- `proposals/active/PROPOSAL_20260425_002.md` → `proposals/completed/`（status: ACCEPTED）

### Notes

- v6.11 為 minor bump；不取代既有 13-agent rules；既有 Claude Code workflow 不受影響
- 升 v7.0（major bump）需 Phase C 全綠 + 9/9 自我進化機制 + 雙環境 dim_avg 差異 < 0.3
- 整合公司 Qwen Agent / 家中 Antigravity sampling 詳見 `poc/langgraph-mcp/README.md`

---

## [v6.10] - 2026-04-25

### Added

- **PROPOSAL_20260425_001**（Full）：lead.md 第二輪保守拆檔（Audit #6 OPT-2.1-001 follow-up；6 Phase / 5 commits）
  - 對齊 Audit #6 R27 持續追蹤；1.4 Token Economy 從 3.8 預期再升至 ~4.3
- 新 `skills/lead-context-mappings.md`（F1；~190 行；9 章；6 類映射 + 熔斷機制 + 8 項 Context 注入 Checklist）
- 新 `skills/lead-artifact-protocols.md`（F1；~140 行；8 章；10 階段 Gate Check + DoD Auto-Audit + Hotfix 4 條件 + ROUTING_TICKET 整合）

### Changed

- `rules/lead.md` 4 sections 瘦身（保留 marker + 鐵律 + 「絕對禁止」+ skill pointer 策略）：
  - §s13 資源與上下文映射: 74 → 28 行（搬入 lead-context-mappings.md）
  - §s09 產出物確認機制: 49 → 32 行（搬入 lead-artifact-protocols.md）
  - §s05 核心工作流引擎: 33 → 25 行（補入 lead-orchestration-guide.md §六新增）
  - §s07 中斷+Hotfix: 33 → 26 行（再縮；引用既有 §五）
  - **chars/3.5 估算：9,113 → 7,516 tokens（-17.5%；-1,597 tokens）**
  - **validator 估算：5,921 → 5,037 tokens（-15%；仍超 block 4000；繼續 exempt）**
- `skills/lead-orchestration-guide.md` 新增 **§六 核心工作流引擎完整 10 階段**（~80 行）
- `SYSTEM_THRESHOLDS.yaml rule_token_thresholds.exempt_files`：lead.md 註解更新（紀錄第二輪降幅）
- `FRAMEWORK_VERSION` v6.9 → v6.10（baseline → 026）
- `proposals/PROPOSAL_INDEX.md`：DONE 79 → 80（026 完成）
- Skills 總數：48 → 50

### Notes

- **方法論一致**：與 PROPOSAL_020 第一輪相同保守策略（保留 section marker + 三鐵律關鍵字 + 「絕對禁止」≥5 條 critical files 標準）
- **Drift Gate 4 次全綠**：Phase B/C/D/E 各執行後跑 `agent-drift-simulator`；**全部 0.000 Δ 通過**（drift_score 0.957 維持；persona 0.962 / instruction 1.000 / boundary 0.862）
- **lead.md 仍 exempt**：validator 估 5,037 tokens > block 4,000 約 1,000 tokens；剩餘缺口需後續第三輪處理（候選：拆 §s_pre_adoption_check / §s12 / §s11）
- **未動 sections**：s_state_anchor / s06 / s11（immutable）/ s_complexity_lane（已瘦兩次）/ s10（PROPOSAL_025 剛重寫）— 嚴守邊界
- **預期 Audit #7 影響**：1.4 Token Economy 預估 3.8 → ~4.2（partial recovery；lead.md 仍超 block 限制完全恢復）；Dim 1 avg 預估 4.53 → ~4.60；整體 Audit 預估 4.59 → ~4.62
- **Skills 總成果累積**：v6.4-v6.10 期間新增 7 skills（dual-tracking + routing-ticket-protocol + orchestrator-pattern + lead-orchestration-guide + retro-analysis-framework + assistant-summary-protocol + lead-context-mappings + lead-artifact-protocols）共 ~1,520 行 F1 純通用知識資產

---

## [v6.9] - 2026-04-25

### Added

- **PROPOSAL_20260424_022**（Lite）：@Auditor 派遣 prompt 絕對路徑標準化（消除 sub-agent 路徑誤解）
  - 收 Audit #5 R29：第五次評審 Dim 3 子 Agent 因路徑誤解產生 3 項事實錯誤
- `validate-auditor-dispatch.mjs --verify-paths` 新模式：偵測 21 個已知產物的裸檔名引用 → 🟡 warn

### Changed

- `tasks/auditor-dispatch-checklist.md §派遣前 DoD` 新增條目「**絕對路徑強制**」：禁止裸檔名；外部化產物（patrol-notification-catalog 含 P-XX / lead-orchestration-guide 含 §State Anchor）須明文註記實際位置
- `rules/auditor.md §3.0` 第 6 條新增「絕對路徑強制」鐵律 + 「派遣前路徑驗證」執行指令
- `skills/examples/auditor-examples.md` 範例補絕對路徑示範（`.agents/docs/Reports/AUDIT_HISTORY.md` 完整路徑）+ 第 4 條「禁止裸檔名」要求
- `tests/validate-auditor-dispatch.mjs`：新 `--verify-paths` 模式（偵測 21 個 KNOWN_BARE_NAMES：AUDIT_HISTORY / AUDIT_DECISION_LOG / PENDING_ACTIONS / GLOBAL_STATUS_SUMMARY / ROUTING_TICKET / PROPOSAL_INDEX 等）
- `FRAMEWORK_VERSION` v6.8 → v6.9（baseline → 022）
- `proposals/PROPOSAL_INDEX.md`：DONE 78 → 79（022 完成）

### Notes

- **裸檔名偵測算法**：對每個 KNOWN_BARE_NAME，計算「裸名出現次數」減「帶前綴出現次數」；差值 > 0 → warn；避免誤報已正確使用絕對路徑的引用
- **與 Audit #5 R29 對應**：當時 Dim 3 子 Agent 誤判 AUDIT_DECISION_LOG.md 不存在（路徑找錯）；本提案防止同類錯誤再現
- **與 PROPOSAL_023 ROUTING_TICKET 對齊**：ticket schema 內 `touched_files` / `artifact_paths` 同樣要求絕對路徑（哲學一致）
- **drift_score**：0.957 維持（Δ=0.000；4 處檔案改動 + 新 validator 模式；不影響 rules drift signal）
- **預期 Audit 影響**：5.3 Judge LLM 評分 4.5 → 4.7（dispatch quality 提升；路徑誤解風險清零）
- **既有 15 筆 AUDIT_DECISION_LOG 稽核**：仍 exit 0（無回歸）

---

## [v6.8] - 2026-04-25

### Added

- **PROPOSAL_20260424_021**（Lite）：Hotfix tier routing 於 `force_complex_scenarios` 明文分層
  - 收 Audit #5 R28：避免輕 hotfix 誤派 opus（成本浪費）/ 重 hotfix 誤走 sonnet（品質風險）

### Changed

- `SYSTEM_THRESHOLDS.yaml force_complex_scenarios` 拆分原「Hotfix 緊急通道」為兩 entry：
  - `Hotfix heavy`：`force_model=opus`；trigger=`hotfix_tier=heavy OR SC-01~10 任一觸發 OR 跨檔變更 OR D1-D4 任一觸發`
  - `Hotfix light`：`allowed_models=[sonnet, haiku]`；disqualify=`cross_file OR business_logic OR SC 觸發 OR D1-D4 觸發`
- `skills/auditor-rubric-prompts.md §3.4` Cost Efficiency：
  - (d) 補「Hotfix 必拆 heavy/light tier」要求
  - (g) 新增「Hotfix tier 分層存在」獨立檢查項
  - 扣分規則新增「Hotfix tier 未拆分 → 扣 0.5 分」
- `tasks/emergency-shutdown-playbook.md §3.2.0`：YAML block 補 `hotfix_tier` 欄位（必填）+ 強制檢查說明
- `tasks/hotfix-checklist.md Step 0`：YAML block 補 `hotfix_tier` 欄位 + 3 條強制檢查（缺欄位 / light+SC衝突 / 派發訊息一致）
- `FRAMEWORK_VERSION` v6.7 → v6.8（baseline → 021）
- `proposals/PROPOSAL_INDEX.md`：DONE 77 → 78（021 完成）

### Notes

- **與 PROPOSAL_20260423_009 對齊**：PROPOSAL_009 已建立 Hotfix 輕重分級概念（light/heavy）；本提案於 SYSTEM_THRESHOLDS 機械化分層
- **與 PROPOSAL_023 ROUTING_TICKET 對齊**：派發訊息的 `Complexity-Tier` 欄位 = `hotfix-checklist Step 0` 的 `hotfix_tier` = `force_complex_scenarios` 條目；三方一致
- **drift_score**：0.957 維持（Δ=0.000；新增「絕對禁止」/ 強制檢查條款符合 boundary_adherence signal）
- **預期 Audit 影響**：3.4 Cost Efficiency 4.5 → 4.7（Hotfix 分層覆蓋）；4.1 沙盒 +0.1（程序層約束）

---

## [v6.7] - 2026-04-25

### Added

- **PROPOSAL_20260424_025**（Lite）：@Lead 自律強化（PROPOSAL_020 Phase B 程序層補全）
  - 與 PROPOSAL_020 Phase B `rule_edit_large/critical`（**量**的防護）形成**雙層程序+量**防護
  - 不含 TEST_MAPPING.md 部分（依 User 指令暫不更動 workspace）

### Changed

- `rules/lead.md §s10 行為準則`「修改的唯一例外」條款重寫：
  - **絕對禁止** 在以下情境**外**修改 `rules/*.md` 或 `RULES_DESIGN_GUIDE*.md` 中的 Agent 行為定義 / 職責邊界 / 鐵律條款：
    - (a) PROPOSAL_ADOPT 任務（User 明確採納指令觸發）
    - (b) Hotfix 緊急通道
    - (c) 框架自動產出（generators / patrol / AUDIT trail / proposals 移動 / workspace init / version 遞增）
  - 若 User 指令含規則異動但無明確採納格式 → **必先派 @Retro 產出提案**
- `rules/lead.md §s_complexity_lane`：`force_complex_scenarios.rule_edit_*` 補與 §s10 雙層協同註解
- `skills/lead-orchestration-guide.md §一` 鐵律 3 重命名為「短指令交接 + ROUTING_TICKET 機讀化」+ 補**派發前雙層 Gate**：
  1. 程序防護（§s10）
  2. 量防護（§s_complexity_lane）
  - 兩者必皆通過 → 寫 ROUTING_TICKET → 派發
- `FRAMEWORK_VERSION` v6.6 → v6.7（baseline_proposal → 025）
- `proposals/PROPOSAL_INDEX.md`：DONE 76 → 77（025 完成）

### Notes

- **採用 User 方案 A 的 framework 部分**：原方案 A 拆 framework + project；本次只執行 framework；TEST_MAPPING.md 部分暫不執行（User 指令限縮 .agents/ 範疇）
- **精確收斂禁止語**：避免誤傷 generators / patrol / AUDIT trail 等正常維運（前次粗暴禁止語會 block 這些）
- **與 PROPOSAL_020 Phase B 雙層協同**：
  - **本提案**（程序）：誰可以改 → 必經 PROPOSAL_ADOPT / Hotfix / 框架自動產出 三豁免
  - **PROPOSAL_020 Phase B**（量）：能改多大 → token_estimate > warn(3000) / block(4000) 觸發 force_complex 升等
  - **任務派發前必皆通過**才能進入 ROUTING_TICKET 寫入階段
- **drift_score**：0.957 維持（Δ=0.000；新增「絕對禁止」條款符合 boundary_adherence signal）
- **預期 Audit 影響**：4.2 HITL 維持滿分；4.1 沙盒安全 +0.1（程序層約束加強）
- **後續**：`ILN_PROPOSAL_*` TEST_MAPPING SSOT（待 ILN workspace 重建後另立）

---

## [v6.6] - 2026-04-24

### Added

- **PROPOSAL_20260424_024**：Orchestrator + Policies/Core 開發模式納入 framework 知識庫
  - `skills/orchestrator-pattern.md`（F1；~280 行）：8 章；何時用決策樹 + Orchestrator 3 鐵律 + core/policies 規範 + Decision Trace 測試 + 5 反模式 + 框架對齊
  - `decisions/0033-orchestrator-policies-pattern.md`（ADR；~110 行）：架構決策；包含 4 個 Alternatives Considered（Monolithic / MVC / Plugin / Microservices）

### Changed

- `rules/architect.md §s01`：補「設計模式引用」段；≥500 行 / ≥3 子流程 / 需測試 → 必引用 `skills/orchestrator-pattern.md`
- `rules/backend.md §s01`：補「模組結構鐵律」段；同等規模模組必依 Orchestrator + Policies/Core 結構
- `decisions/README.md`：32 → **33** ADRs（gen-adr-index 自動同步）
- `FRAMEWORK_VERSION` v6.5 → v6.6（baseline_proposal → 024）
- `proposals/PROPOSAL_INDEX.md`：DONE 75 → 76（024 完成）

### Notes

- **沉澱實戰經驗**：來自 InvestmentLineNotify 2026-04 `strategyEngine.mjs` 重構（1500 行單體 → Orchestrator 80 行 + 5 policies + 3 core；測試覆蓋率 30% → 85%）
- **跨層 Hub-and-Spoke 對齊**：
  - **agent 層**：PROPOSAL_20260422_026 黑板模式（@Lead Orchestrator + 多 worker agents）
  - **module 層**：本 ADR-0033（`index.mjs` Orchestrator + policies/core 子模組）
  - **派發層**：PROPOSAL_20260424_023 ROUTING_TICKET（macro ticket）
  - 三層形成完整的「機讀化 + 上下文保護 + 防禦性返回」設計哲學
- **不過度設計防護**：skill §一明文「< 500 行 / < 3 子流程不採用」決策樹；避免小型功能誤套此模式
- **drift_score**：0.957 維持（Δ=0.000；僅新增 skill + ADR + 2 處 §s01 引用補強）
- **預期 Audit 影響**：2.1 模組化 4.5 → 4.7（module 層設計模式覆蓋）

---

## [v6.5] - 2026-04-24

### Added

- **PROPOSAL_20260424_023**：ROUTING_TICKET.md 派發 artifact 機讀化（5 Phase / 7 commits）
  - `skills/routing-ticket-protocol.md`（F1；~190 行）：v1 schema + workflow + 與 PENDING_ACTIONS.md §🎯 職責邊界對照表 + 5 條鐵律 + Validator 5 檢查項
  - `tests/routing-ticket-validator.mjs`（**第 12 validator**）：schema 完整性 + Lane↔Model 對應 + Hotfix sc_evaluation 強制；ticket 不存在時 exit 0（運行時 artifact 容許缺）
  - 整合 `run-all.sh`：11 → **12** validators 並行

### Changed

- `rules/lead.md §s_state_anchor` 鐵律 3 強化：派發前**必須**先寫 ROUTING_TICKET.md；對話訊息僅作 ticket 創建通知
- `rules/lead.md §s_complexity_lane` 派發指令格式新欄位 `Ticket: ROUTING_TICKET.md`（必填）
- **7 個子 agents §s01 任務目標**插入「派發接收鐵律」：被 @Lead 喚醒首讀 ROUTING_TICKET.md；禁止從對話歷史推導任務範圍
  - `rules/planner.md` / `rules/architect.md` / `rules/backend.md` / `rules/frontend.md`
  - `rules/qa.md` / `rules/reviewer.md` / `rules/security.md`
- `FRAMEWORK_VERSION` v6.4 → v6.5（baseline_proposal → 023）

### Notes

- **採用 User 方案 B 並擴大**：原方案 B 僅 @Lead 端寫 ticket；User 指令擴大至子 agents 改讀檔順序
- **不設 @Router**：避免違反 ADR-0027 §2.4(a) 扁平 Agent 名冊；@Lead 仍是唯一 Orchestrator
- **ROUTING_TICKET vs PENDING_ACTIONS.md §🎯 職責邊界**：前者「**派發 artifact**」（每次派發一張）；後者「**狀態錨點**」（跨派發累積）；不可合併或互相取代
- **儲存位置**：ROUTING_TICKET.md 屬**運行時 artifact**；放專案根層（與 PENDING_ACTIONS.md 同層）；**不入 .agents/**（依 User 指令「不更動 workspace」）
- **drift_score 守門**：4 commits 各跑 drift check；**全程 0.957 維持（Δ=0.000）**
  - persona 0.962 / instruction 1.000 / boundary 0.862 不變
- **LangGraph 遷移準備度**：30% → 70%（ROUTING_TICKET 對應未來 LangGraph node state）
- **預期 Audit 影響**：2.4 Orchestration Efficiency 4.5 → 4.8

---

## [v6.4] - 2026-04-24

### Added

- **PROPOSAL_20260424_020**：Rules Token 經濟性治本 + 治標雙軌（合併方案；6 Phase / 19 commits）
  - **治本層（Phase B）**：
    - `SYSTEM_THRESHOLDS.yaml` v1.1 → v1.2：新 `rule_token_thresholds`（warn 3000 / block 4000）+ `force_complex_scenarios` 加 `rule_edit_large` / `rule_edit_critical` 兩條
    - `skills/patrol-notification-catalog.md`：P-01~P-23 → **P-01~P-24**（新 P-24 `RULE_SIZE_OVERDUE` 🟡）
    - `rules/lead.md §s_complexity_lane`：強制升等場景補 2 條 rule_edit 觸發
  - **治標層（Phase C/D/E）**：3 大 rule 拆檔 + 對偶 skill：
    - `skills/lead-orchestration-guide.md`（F1；~520 行；§State Anchor + §Complexity Lane + §Pre-Adoption + §Prior Art Gate + §Hotfix）
    - `skills/retro-analysis-framework.md`（F1；~280 行；§歷史比對 + §生命週期 + §目錄結構 + §回滾 + §定期審計）
    - `skills/assistant-summary-protocol.md`（F1；~230 行；§HCI 全局摘要 + §M2M 巡邏摘要 + §通知關閉 + §過期門檻）
  - **守門層（Phase F）**：
    - `tests/rule-token-budget-validator.mjs`（**第 11 validator**）：偵測超 warn/block 門檻；整合 `run-all.sh` 並行
    - Block 強制阻 commit；warn 不阻；exempt_files 機制（明文豁免清單）

### Changed

- `rules/lead.md`：5 sections 瘦身（§s_state_anchor / §s_complexity_lane / §s_pre_adoption_check / §s06b / §s07）；保留 marker + 三鐵律 + 「絕對禁止」+ skill pointer
  - **10,231 → 8,708 tokens（-14.9%）**；列入 exempt_files（後續提案處理剩餘超量）
- `rules/retro.md`：5 sections 瘦身（§s02 / §s04 / §s06 / §s07 / §s10）
  - **6,923 → 5,169 tokens（-25%）**
- `rules/assistant.md`：3 sections 瘦身（§s_global_summary / §s16 / §s15）
  - **6,278 → 4,938 tokens（-21%）**
- `rules/lead.md §s_complexity_lane` 強制升等場景：5 條 → 7 條
- `rules/assistant.md §巡邏規則` + `docs/agents-overview.md §4.2`：P-23 → P-24
- `tests/run-all.sh`：10 → **11** validators 並行
- `FRAMEWORK_VERSION` v6.3 → v6.4（baseline_proposal → 020）
- `proposals/PROPOSAL_INDEX.md`：DONE 73 → 74（020 完成）

### Notes

- **雙軌策略**（治本 + 治標）：合併 User 方法 2（auto-escalation）+ 原拆檔策略；單一提案內**先治本後治標**達成永久防呆 + 一次性瘦身
- **Drift Gate 守門**：Phase C/D/E 各執行後強制 `agent-drift-simulator` Gate 檢查；3 Gates **全部 0.000 Δ 通過**（drift_score 0.957 維持）
  - 關鍵設計：拆檔時**保留 section marker + 三鐵律關鍵字 + 「絕對禁止」條款數**；確保 instruction_accuracy 1.000 / boundary_adherence 0.862 不變
- **Token 縮減全貌**：rules/ 主體 10,231 + 6,923 + 6,278 = **23,432 tokens** → **18,815 tokens**（-19.7%）；新增 3 skills 共 ~1,030 tokens（按需載入）
- **lead.md exempt 處置**：第一輪保守拆檔僅達 -14.9%（未達 6,500 目標）；validator 暫時豁免；後續可立 PROPOSAL_023+ 進一步拆 §s05 / §s06b / §s09 等
- **分批執行**（User 指令）：本提案分 19 commits 執行（Phase A~F；C 拆 7 子步驟 / D 拆 6 / E 拆 4）；每子步驟獨立 commit + drift check + push
- **預期效益（量化）**：
  - 1.4 Token Economy 預估恢復：3.2 → ~4.2（+1.0；未達原 +1.3 目標但顯著改善）
  - 整體 Audit 預估：4.58 → ~4.75（+0.17）
  - 永久防護：未來新 rules ≥ 3000 tokens 自動觸發 @Architect HITL；≥ 4000 阻斷派發
- **回退路徑**：`git revert <Phase commit>` 可逐 Phase 回退；section markers + 鐵律保留確保即使 partial revert 也不破壞 drift 基準

---

## [v6.3] - 2026-04-24

### Added

- **PROPOSAL_20260424_019**：Batch 017+018 Retro Follow-ups（4 項改善；F-1 P1 / F-2~F-4 P2；tier: full）
  - **F-1**（純函式雙向測試覆蓋）：
    - `tests/scripts/unit.test.mjs` 新增 13 cases（46 → 59）：`applyTechStackChoices` 4 雙向 + deps 展開 + restore / `updateManifestInstalledFlag` 2 / `deriveTechStackAnswersFromStacks` 2 / `resolveAutoPopulate` + `applyAutoPopulate` 5
    - `RULES_DESIGN_GUIDE.QUALITY.md §十、雙向邏輯測試準則`（新章節；鐵律 + 判定標準 + 違規偵測）
  - **F-2**（Phase tracking vs 驗收 checklist 雙維度）：
    - `skills/checklists/dual-tracking-checklist.md`（F1 類；新建）：雙維度鐵律 + 觸發時機 + 必行動作 + 反模式 + 範例
    - `rules/lead.md §狀態錨點` 補「雙維度追蹤」小節 + 引用 skill
  - **F-3**（Schema `interactive` + `auto_populate` 屬性）：
    - `WORKSPACE_SCHEMA.yaml` v1.3 → v1.4：新 field-level 屬性 `interactive` + `auto_populate`（source ∈ [system, default, derive_from_stacks]）
    - `scripts/init-workspace.mjs`：新 exported 純函式 `resolveAutoPopulate` + `applyAutoPopulate`；取代 018 Phase B 的 ad-hoc TECH_STACK 欄位 skip；`collectAnswers` + `runFromConfig` 統一套用 schema 驅動
    - `tests/workspace-schema-validator.mjs`：新 interactive/auto_populate 合法性檢查（interactive:false → 必有 auto_populate；source 白名單）
  - **F-4**（Pre-skeleton WebFetch）：
    - `skills/tech-stack-onboarding.md §4.2 Step 0`（新）：資料夾模式建骨架前**強制** WebFetch vendor 官方 repo 確認定位 + license + 分類合理性
    - `decisions/0031-tech-stacks-catalog.md §Notes` 補 F-4 退火紀錄

### Changed

- `RULES_DESIGN_GUIDE.md` orchestrator TOC：新增 §十 雙向邏輯測試準則映射至 QUALITY 子檔
- `scripts/init-workspace.mjs`：移除 018 Phase B 的硬編 TECH_STACK skip + ad-hoc today/30 預設（由 schema 驅動）
- `FRAMEWORK_VERSION` v6.2 → v6.3（baseline_proposal → 019）
- `proposals/PROPOSAL_INDEX.md`：73 proposals（DONE 73 / OPEN 0）

### Notes

- **Retro 閉環**：本提案為 2026-04-24 Batch 017+018 retro 的 4 項實質缺失改善行動；源自 `docs/Reports/RETRO_20260424_batch_017_018.md §六`
- **測試文化升級**：雙向邏輯測試成為硬規則（RULES_DESIGN_GUIDE §十 明文）；取代以往 ad-hoc 單向覆蓋
- **Schema 元數據層進化**：從「欄位值」擴展為「欄位屬性 + 值 + 自動填入規則」；為未來 UI generator / agent driven onboarding 奠基
- **向後相容**：schema v1.4 向後相容 v1.3（缺 `interactive` 視為預設 true）；既有 workspaces 不需重生
- **雙維度追蹤**：退火「驗收條件 100% ⇒ 提案 DONE」的路由誤差；Phase 進度 vs 驗收 checklist 以 Phase 為準（流程控制 > 結果驗證）
- **Pre-skeleton WebFetch**：Onboarding SOP 防呆；解決 017 Phase F.2 → F.3 二次工作根因（React vs Avalonia 分類誤判）
- **測試規模**：unit 46 → 59（+13；+28%）；新 pure function `resolveAutoPopulate` / `applyAutoPopulate` 可單獨測試

---

## [v6.2] - 2026-04-24

### Added

- **PROPOSAL_20260424_018**：init-workspace UX 一鍵化 + tech-stack 定期 audit 機制（minor 擴充 ADR-0031）
  - `WORKSPACE_SCHEMA.yaml` v1.2 → v1.3：新 2 欄位 `TECH_STACK.last_audit_date` / `audit_interval_days`
  - `scripts/init-workspace.mjs`：
    - 修 017 Phase C Step 6.5 bug（雙向 installed 處理；選中 false→true + 缺檔 git-restore）
    - 新 `--config <yaml>` 旗標（非互動模式；agent 代跑）
    - 預設改 Enter = 全保留（新 User 友善）
    - TECH_STACK 欄位自動從選中 stacks MACHINE_READABLE 推導
    - Post-init reminder 含 audit 提示
  - `scripts/tech-stack-manage.mjs audit` 新指令：引用統計（refs_in_rules / workspace / code）+ 分級（remove/audit/keep）+ 逐個確認 + 批次最終確認
  - `tasks/agent-onboarding-flow.md`（F1）：agent 驅動對話 5 步驟 SOP
  - `skills/patrol-notification-catalog.md`：P-01~P-20 擴展為 P-01~P-23
    - 補齊 P-21 HOTFIX_LIGHT_MISUSE（PROPOSAL_009；原 catalog 漏列）
    - 補齊 P-22 LITE_OVERUSE（PROPOSAL_010；原 catalog 漏列）
    - 新增 P-23 TECH_STACK_AUDIT_OVERDUE（本提案；💡 Hint 級）
  - `decisions/ADR-0032`：Tech-Stack 生命週期 Audit 機制（extends ADR-0031）
  - `rules/lead.md §6.4`：新觸發時機（User 開案語 + audit 過期傳達）

### Changed

- `rules/assistant.md`：P-01 ~ P-22 全文替換為 P-01 ~ P-23
- `decisions/0029-assistant-patrol-catalog.md`：title + 表格擴充至 P-23
- `docs/agents-overview.md §4.2`：23 條規則表（補 P-21/22/23 三列）
- `decisions/README.md`：AUTO-GENERATED 區塊 → 32 ADRs
- `proposals/PROPOSAL_INDEX.md`：72 proposals
- `FRAMEWORK_VERSION` v6.1 → v6.2（baseline_proposal → 018）

### Notes

- **安全鐵律**（User 2026-04-24 明確要求）：agent / 腳本只做初步篩選，刪除永遠需 User 逐個確認；**無** `--yes-all` 旗標
- **向後相容**：workspace schema 新欄位為 `required: false`；舊 workspace 不破壞
- **通知分級**：P-23 採 💡 Hint 級（ADR-0030）；不阻斷新任務
- **Agent 驅動**：`--config` 旗標讓 agent 可用 Bash 代跑 init-workspace；User 只需對話 3-5 題（vs 互動 40 題）
- **生命週期完整**：從 017 的「裝 / 移除」擴充為「裝 / 審視 / 移除」三階段

---

## [v6.1] - 2026-04-24

### Added

- **PROPOSAL_20260423_017**：Tech-Stacks Catalog 分類重構 + MANIFEST 選擇性搬運（minor 擴充 ADR-0015）
  - `tech-stacks/` 引入 6 分類子目錄：`core/` / `web-backend/` / `web-frontend/` / `desktop/` / `messaging/` / `storage/`
  - `tech-stacks/MANIFEST.yaml`：Catalog 索引 SSOT（schema v1；10 stacks + 6 categories）
  - `scripts/tech-stack-manage.mjs`：5 指令 CLI（list / info / install / remove / restore）+ DFS 依賴解析
  - `scripts/init-workspace.mjs` Step 6.5：互動選擇保留 stacks（非 TTY 自動跳過）
  - `skills/tech-stack-onboarding.md`（F1）：tech-stack 新增 SOP + vendor prompt injection 安全準則
  - `tests/tech-stack-validator.mjs`（runner 第 10 個 validator）：9 檢查項含循環依賴 DFS 偵測
  - `decisions/ADR-0031-tech-stacks-catalog.md`：架構 ADR（extends ADR-0015）
  - `tech-stacks/desktop/avalonia-ui.md`：Avalonia 11.x 單檔骨架（installed: false）
  - `tech-stacks/desktop/semi-avalonia/`：資料夾模式骨架（README + SOURCE + CHANGELOG + upstream/ + adapted/）

### Changed

- `tech-stacks/` 8 個既存 stacks 遷入分類目錄（`git mv` 保留 rename history）
- 19 檔引用路徑更新（rules / skills / docs / WORKSPACE_SCHEMA / unit.test.mjs）
- `RULES_DESIGN_GUIDE.SCOPE.md §十六.C-D`：擴充分類子目錄規則 + MANIFEST 索引 + vendor 安全準則
- `ADR-0015`：`extended_by: [ADR-0031]` + related_proposals 新增 017
- `tests/run-all.sh` + `lib/git-diff-detector.sh`：註冊 tech_stack validator（fast mode 映射）
- `FRAMEWORK_VERSION`：v6.0 → v6.1（baseline_proposal → 017）

### Notes

- 本版本為 **minor** 擴充：ADR-0015 6 鐵律 + 純淨原則完全保留；僅新增 Catalog 層
- Avalonia + Semi.Avalonia 骨架 `installed: false`；新 Avalonia 專案透過 `tech-stack-manage install` opt-in（自動解析依賴）
- Vendor 內容安全準則（防 prompt injection）：LLM 只讀我方 README.md；upstream/ 為 audit 隔離區
- Phase F.3（Semi.Avalonia upstream/ 填入 vendor 文件 + vendor_last_vetted 填日期）為後續觸發項；本提案範圍外
- 與 ADR-0024 零依賴相容：全程 Node.js 內建 + Bash + git，無 npm 依賴

---

## [v6.0] - 2026-04-24

### Added

- **PROPOSAL_20260423_016**：導入 ADR Pattern — 規則去 PROPOSAL 化 + 決策層分離（major 結構性變更）
  - `decisions/` 目錄新建（跨專案知識資產）
    - `README.md`：ADR 索引 + 三層職責定義 + 編號規則 + 搬運規範
    - `ADR-TEMPLATE.md`：標準格式（Context / Decision / Consequences / Alternatives）
    - `PROPOSAL_MAPPING.md`：PROPOSAL ↔ ADR 對照表（47+ 條）
    - **30 ADRs**（ADR-0001 ~ ADR-0030）涵蓋框架核心決策：
      - Core Agent（5）：Stateless routing / Workspace / Drift / Concurrency / Auditor
      - Workflow（4）：Model tier / Lane / Hotfix dual-track / Proposal Full/Lite
      - Security（5）：Parallel review / SC-01~10 / Diagnostic team / DoD / Prior Art
      - Structure（4）：Tech-stacks purity / F1/F2/F3 / Doc layering / DESIGN_GUIDE split
      - Governance（4）：Scope tiering / Intent inheritance / Lifecycle / Frontmatter
      - Framework（6）：Version mgmt / Runtime / AUTO-GENERATED / Validator / Script-underuse / Summaries
      - Monitoring（2）：Patrol catalog / Notification classification
  - `scripts/generators/gen-adr-index.mjs`（新；AUTO-GENERATED 區塊管理）
  - `tests/adr-validator.mjs`（新；Type A/B/C 分類統計 + 合法內容豁免）

### Changed

- `rules/*.md` 13 檔：移除 42 處 Type C semantic refs；每檔新增 Related Decisions footer
- `skills/*.md` + `tasks/*.md` 52 檔：機械清理歸屬性引用 + 添加 Related Decisions footer
- `RULES_DESIGN_GUIDE` 家族 + `RULES_METADATA_SCHEMA.md`：補 footer + 機械清理
- `FRAMEWORK_REQUIREMENTS.md §6`：搬運流程加入 decisions/ 層（三層職責分離）
- `docs/agents-overview.md §1.2`：新增 decisions/ 樹 + 設計層更新為 7 + ADR 目錄
- **framework v5.1 → v6.0**（major bump；結構性導入決策層）

### Fixed

- **Type B 引用**：115 → 0（100% 清理）
- **Type C 引用**：298 → 120（59% 清理；剩餘 120 為合法 audit trail / 表格欄 / 範例佔位）
- `adr-validator.mjs` 合法內容豁免（AUTO-GENERATED / Related Decisions / §🔗 / TOC / code blocks）

### Notes

- **三層職責清晰分離**：
  - 規則層（rules/）描述 WHAT（每任務必讀）
  - 決策層（decisions/）描述 WHY（需要時才讀）
  - 歷史層（proposals/）記錄 AUDIT（審計時才讀）
- **新 LLM onboarding 成本**：25k 行 proposals → ~300 行 summary + 30 ADRs 按需展開
- **跨專案搬運**：rules/ + decisions/ + summaries/ 必帶；proposals/completed/ 可選帶
- **產業範式對齊**：Kubernetes KEP / IETF RFC / ADR 標準架構
- **自我演進能力保留**：ADR 為 markdown；LLM 可直接讀寫；不破壞 `@Retro` 提案機制
- **Dogfooding**：本提案 Batch 6 Phase G 全用 generators 自動化（0 手動 Edit INDEX）
- **6 批次執行**：總計 ~16 小時工作 + User 6 次 review 節點；drift_score 0.957 維持

### Future Work

- `adr-validator --strict`（需先細化豁免 patterns；待獨立提案）
- ADR 反向引用自動化（Referenced By section 由 generator 維護）
- ADR supersede 鏈路視覺化

---

## [v5.1] - 2026-04-24

### Added

- **PROPOSAL_20260423_015**：Framework/Project 提案分離執行機制 + 歷史摘要自動化
  - `tests/proposal-scope-validator.mjs`（新；run-all.sh 第 11 個 validator）
  - `scripts/generators/gen-proposal-summary.mjs`（新；支援 --period / --range / --workspace）
  - `proposals/summaries/SUMMARY_2026Q2.md`（首次季度摘要；70 份提案）
  - `proposals/summaries/README.md`（摘要索引）
  - `gen-proposal-index.mjs --workspace <name>` 雙區模式
  - `workspaces/investmentlinenotify/proposals/PROPOSAL_INDEX.md` 補 3 個 AUTO-GENERATED 標記
  - `FRAMEWORK_REQUIREMENTS.md §6` 擴充搬運流程（A/B/C 模式 + 驗收）
  - `RULES_DESIGN_GUIDE.SCOPE §十七.G` 執行時強制機制（G.1-G.4）
  - `rules/retro.md §s06` Scope 判定 SOP

### Fixed

- PROPOSAL_20260423_014 之 RULES_METADATA_SCHEMA frontmatter 補齊（本版本同時上）
- PROPOSAL_20260423_013 之 FRAMEWORK_REQUIREMENTS 建立（本版本同時上）
- 68 份歷史 completed/ 提案稽核：全 scope: framework 正確（71 含 015）

### Changed

- `run-all.sh` validators 10 → **11**（新增 proposal_scope）
- `rules/retro.md` v1.8 → v1.9
- `RULES_DESIGN_GUIDE.SCOPE.md` v1.1 → v1.2
- `RULES_METADATA_SCHEMA.md` frontmatter 補齊

### Notes

- **設計落地的閉環**：023（設計）+ 007（generators）+ 012（validator 強制範式）→ 015（執行層 + 歷史摘要）
- **Dogfooding**：本提案 Phase H 全用 generators 自動化（0 手動 Edit INDEX）
- **搬運規範明文**：FRAMEWORK_REQUIREMENTS §6 三種搬運模式（A 完整 / B 精簡 / C 極簡）
- **首次歷史摘要**：SUMMARY_2026Q2 涵蓋 PROPOSAL_20260420_001 ~ 20260423_015 共 70 份；新 LLM onboarding 從 25k 行縮至 ~300 行

---

## [v5.0] - 2026-04-24

### Added

- **PROPOSAL_20260423_011**：RULES_DESIGN_GUIDE 拆檔（design / scope / quality 三主題子檔；自我應用 004 文件分層）
  - `RULES_DESIGN_GUIDE.DESIGN.md`（~248 行；§一、三、五、六、九 — 設計形式）
  - `RULES_DESIGN_GUIDE.SCOPE.md`（~483 行；§十一、十二、十五、十六、十七、二十、二十一 — 範圍治理）
  - `RULES_DESIGN_GUIDE.QUALITY.md`（~457 行；§二、四、七、八、十四、十八、十九 — 品質與量化）
  - `RULES_DESIGN_GUIDE.md` 縮為 orchestrator（~175 行；TOC + 專案特化參照 + 相容層）

### Changed

- `RULES_DESIGN_GUIDE.md` v1.13 → **v2.0**（重大結構變更 major bump）
- 主檔 1194 行 → 175 行（orchestrator）；內容分散至 3 子檔

### Fixed

- 解除 `periodic-design-review §7 警示維度 #6` 觸發（單檔 rules ≥800 行）：最大子檔 483 < 800

### Notes

- **自我應用**：首次將 PROPOSAL_20260423_004（文件分層三原則）用於本文件自身
- **相容歷史**：60+ DONE 提案引用 `§N` 透過主檔「相容層」+ TOC 映射繼續可讀
- **DEPRECATED 時程**：舊 `§N` 引用 2026-10-24 標記 DEPRECATED；2027-04-24 後可移除相容層
- **新提案強制新格式**：`RULES_DESIGN_GUIDE.<subject>.md#<N>`（subject ∈ {DESIGN, SCOPE, QUALITY}）
- **子檔 frontmatter**：含 `parent` / `subject` / `source_sections`；未來可由 schema-validator 擴充檢查
- **v5.0 重大版本**：結構性拆檔 → major bump；framework v4.10 → v5.0

---

## [v4.10] - 2026-04-24

### Added

- **PROPOSAL_20260423_010**：Lite Proposal 流程（1-2 phase 微提案；降低立案心理門檻）
  - `RULES_DESIGN_GUIDE §二十一` 新增「提案輕重分級」7 小節（A-G）
    - A 兩類定義 / B 決策樹 / C Lite 7 欄標準 / D Phase 結構
    - E 限制（≤2 phases / ≤50 LOC / ≤1 hr / 0 Agent 行為）
    - F 禁止 5 條 / G 違規偵測 5 類
  - `skills/templates/rule-update-proposal-lite-template.md`（新增；F1 類；含決策自檢 + 7 欄模板 + 使用時機範例表 + SOP）
  - `skills/rule-update-proposal-template.md` → `rule-update-proposal-full-template.md`（git mv；相容註記保留）
  - `rules/retro.md §s06` 新增「提案輕重選擇」規範（v1.7 → v1.8）
  - `rules/lead.md` 派發產出表分 Full / Lite 雙列
  - `tasks/audit-retro-coordination.md` 提案格式指引更新

### Changed

- `RULES_DESIGN_GUIDE` v1.12 → v1.13
- `rules/retro.md` v1.7 → v1.8

### Notes

- **預設 Full**：決策樹從最嚴謹開始；全例外才落 Lite
- **Lite 強制溯源**：7 欄必填「基於」；不因簡化斷 §🔗 鏈
- **禁止 Agent 行為走 Lite**：Agent 行為屬規則層 → 必走 Full
- **相容歷史**：舊 template 相容註記保留；歷史 DONE 提案引用不動
- **Dogfooding Skills 檢索**：lite-template 為首個「F1 但有嚴格決策自檢」skill；後續 Skills 設計範式

---

## [v4.9] - 2026-04-24

### Added

- **PROPOSAL_20260423_009**：Hotfix 流程分輕重（簡單 3 步 light / 複雜 5 步 heavy）
  - `emergency-shutdown-playbook §三` 重構雙軌：§3.2.0 Step 0 複雜度判定 + §3.2.A light + §3.2.B heavy
  - `hotfix-checklist.md` Step 0 加複雜度判定；分 🟢 A 路徑（3 步）+ 🔴 B 路徑（5 步）
  - `lead.md §s07` 派發訊息加 `Complexity-Tier` + `Tier-Reason` 欄位；6 項禁止行為
  - `RULES_DESIGN_GUIDE §十九.G` 新增「Hotfix 輕重分級」5 小節（G.1-G.5）

### Changed

- `RULES_DESIGN_GUIDE` v1.11 → v1.12
- `rules/lead.md` v2.0 → v2.1

### Notes

- **修正範圍非推翻**：保留 PROPOSAL_20260423_003 D1-D4 / SC-01~10 / 診斷組 / @Security 核心設計；僅將適用範圍縮至 heavy 路徑
- **預設 heavy**：判定從最保守開始；全滿足排除條件才落 light
- **語意恢復**：light 路徑即恢復 PROPOSAL_20260422_026 原 3 步設計
- **資安零容忍**：SC/D 任一觸發 → heavy 鎖定（無例外）

---

## [v4.8] - 2026-04-24

### Added

- **PROPOSAL_20260423_012**：Script 漏用防護機制（四道防線：AUTO-GENERATED 標記 + SOP + pre-commit + 警示）
  - `scripts/generators/lib/auto-generated-block.mjs`（共用 replaceBlock / checkDrift）
  - 4 generators 全面支援 `--write` / `--check` 雙 mode（gen-proposal-index / rules-version-index / changelog / framework-version）
  - `PROPOSAL_INDEX.md` 3 個 AUTO-GENERATED 區塊（stats / open_list / in_progress_list）
  - `RULES_VERSION_INDEX.md` 1 個 AUTO-GENERATED 區塊（rules_versions）
  - `tests/index-drift-validator.sh`（獨立驗證；run-all.sh 第 10 validator）
  - `tests/auto-generated-block.test.mjs`（10 cases）+ `gen-proposal-index.test.mjs`（7 cases）
  - `rules/retro.md §s06` Pre/Post-Commit SOP（v1.6 → v1.7）
  - `skills/rule-update-proposal-template.md`「🔧 立案/採納後必跑腳本」章節
  - `tasks/periodic-design-review.md §7` 警示維度 #9 SCRIPT_UNDERUSE（≥2 WARN / ≥5 ALERT）

### Fixed

- `gen-proposal-index.mjs parseProposalStatus` 支援 markdown 粗體/斜體（`**CANCELLED**` / `_DONE_`）
  - regex 改用 `[A-Z_]+` 顯式字元類避免 `\w` 吞掉標記
- `parseProposalTitle` 增強：優先讀 frontmatter `title:` > 執行摘要 > H1 heading
- CANCELLED 統計由 0 → 1（正確反映歷史 PROPOSAL_20260422_020）
- `run-all.sh --regenerate-indexes` 現可真正寫入（之前因 AUTO-GENERATED 標記未設而失敗）

### Changed

- `run-all.sh` validators 9 → 10（新增 index_drift）
- `tests/lib/git-diff-detector.sh` fast-mode 觸發表擴充 index_drift
- `docs/agents-overview.md §1.2` scripts/generators + tests/ 結構更新

### Notes

- **四道防線設計**：工具（AUTO-GENERATED 標記）+ 流程（SOP）+ 執行（pre-commit）+ 監控（警示 #9）
- **Dogfooding**：本提案 Phase G 全用 4 generators --write 完成（0 手動 Edit INDEX 類檔案；反向驗證機制有效）
- **語意對偶**：與 PROPOSAL_20260423_007（generators 建立）+ 008（run-all.sh 並行）+ 019（pre-commit hook）形成「建立 + 落地 + 兜底」三重組合
- **觸發事件**：2026-04-24 commit `ff95f38` 手動 Edit INDEX 留下 stale 統計 → User 糾正後立案執行
- **LLM 行為校正**：從「選擇性使用工具」變「強制使用工具」；跨 session 記憶斷層問題透過機械性強制解決

---

## [v4.7] - 2026-04-23

### Added

- **PROPOSAL_20260423_007**：索引自動產生器（4 generators + --regenerate-indexes mode）
  - `scripts/generators/gen-rules-version-index.mjs`（從 17 追蹤檔 frontmatter 自動產版本表；含註解 fallback）
  - `scripts/generators/gen-changelog.mjs`（從提案 markdown 撈 §三 / §基本資訊產 [vX.Y] 條目模板）
  - `scripts/generators/gen-proposal-index.mjs`（掃描 active/completed/archived 自動產統計 + OPEN/IN_PROGRESS）
  - `scripts/generators/gen-framework-version.mjs`（--bump minor/major + proposals_total 自動同步）
  - `scripts/generators/README.md`（設計原則 + 工具清單 + 限制）
  - `tests/run-all.sh --regenerate-indexes` 模式啟用（一鍵跑 rules-version + proposal-index）
  - `tests/scripts/unit.test.mjs` +16 cases（30→46；100% generators 純函式覆蓋）
  - `tests/scripts/smoke.test.sh` +3 cases（9→12；含 dry-run 不寫檔驗證）

### Changed

- `RULES_DESIGN_GUIDE §十二` 補「Phase E 自動化」段落（v1.10 → v1.11）
- `agents-overview §1.2` scripts/ 區塊新增 generators/ 子目錄結構
- 本提案 RULES_VERSION_INDEX 版本表由 gen-rules-version-index 自動更新（首次 dogfooding）

### Performance

- 預期每提案 Phase E 同步成本：~22 min → ~5 min（-77%；本日 6 提案累積節省 ~2 hr）

### Notes

- **SSOT 落實**：rules / proposals frontmatter 為真相；INDEX 為派生視圖
- **不取代 LLM 判斷**：Notes / §🔗 / 摘要章節仍由 @Lead 處理
- **Dry-run 預設**：所有 generator 預設僅 console.log；--write 才實際寫檔
- **語意對偶**：與 PROPOSAL_20260423_008 為「索引自動 + 執行加速」雙效改善（007+008 雙提案組合）
- **限制**：`RULES_METADATA_SCHEMA.md` 無 frontmatter → 顯示 `<unknown>`（後續可獨立提案補）

---

## [v4.6] - 2026-04-23

### Added

- **PROPOSAL_20260423_008**：run-all.sh 並行 + --fast + --validator 三模式（pre-commit 速度大幅提升）
  - `tests/run-all.sh` 重構：7 validators 並行（背景作業 + wait + /tmp log）+ scripts L3 序列
  - `tests/lib/git-diff-detector.sh`（純 Bash；依 git diff 偵測相關 validators）
  - `--fast` 模式：依 git diff 跳過無關 validators（< 5 sec for typo）
  - `--validator <name>` 子集模式（單一 validator 反覆測試）
  - `--help` 模式
  - `tests/scripts/smoke.test.sh` +3 cases（6 → 9）
- **附加：定期設計檢視機制**（依 User 2026-04-23「列為未來定期檢視的目標」）
  - `tasks/periodic-design-review.md`（流程繁瑣 + LLM 可程式化雙目標 + 8 維度警示門檻）
  - `retro.md §s02` 定期審計觸發 +1 條（每次審計強制執行 periodic-design-review）

### Changed

- `RULES_DESIGN_GUIDE §十二` 補「Validator 執行模式」段落 + 1 項禁止行為（v1.9 → v1.10）
- `retro.md` v1.5 → v1.6
- `tests/README.md` 更新三模式說明

### Performance

- Full mode：35 sec（baseline）→ **0.9 sec**（實測；超預期）
- Single mode：N/A → **0.07 sec**
- Fast mode（typo）：35 sec → **< 5 sec**

### Notes

- 並行為主：8 互不依賴 validators 並行；scripts L3 序列保留（避免 workspace 競爭）
- 保守 fast：未知檔案類型 fallback 跑相關 validator
- 向後相容：預設 full 模式；既有 pre-commit hook 不需動
- **語意對偶**：與 PROPOSAL_20260423_007 為「索引自動 + 執行加速」雙效改善

---

## [v4.5] - 2026-04-23

### Added

- **PROPOSAL_20260423_006**：scripts/ 測試框架（L1 單元 + L3 smoke；修正 005 §1.5「不新增自動化測試」決策）
  - `tests/scripts/unit.test.mjs`（`node:test` + `node:assert`；30 cases；零 npm）
  - `tests/scripts/smoke.test.sh`（Bash E2E；6 cases；setup + trap EXIT cleanup）
  - `tests/scripts/run.sh`（統一測試入口；串 L1 + L3）
  - `run-all.sh` 第 9 validator（scripts tests；warning-level policy）

### Changed

- `scripts/framework-diff.mjs` export 5 純函式 + `import.meta.url` 守衛（不改行為）
- `scripts/init-workspace.mjs` export 7 純函式 + lazy readline init + `import.meta.url` 守衛
- `run-all.sh` validators 8 → 9
- `agents-overview §1.2` tests/ 區塊新增 scripts/ 子目錄說明

### Fixed

- 補足 PROPOSAL_20260423_005 §1.5 未涵蓋的自動化測試缺口
- 本次 CLI Bug 1（單欄位 block）+ Bug 2（readline/promises 非 TTY）類型可由測試自動捕獲

### Notes

- **雙層互補**：L1 單元（ms 級速度，邏輯 bug）+ L3 smoke（整合 bug）
- **零依賴**：`node:test`（Node.js 18+ 內建）+ Bash；無 npm / 無網路
- **語意對偶**：與 PROPOSAL_20260423_005 為「建立 CLI + 保證 CLI 正確」對偶組合

---

## [v4.4] - 2026-04-23

### Added

- **PROPOSAL_20260423_005**：互動式 CLI 初始化工具（降低 onboarding 摩擦；雙軌引導並存）
  - `scripts/init-workspace.mjs`（純 Node.js 內建模組；零 npm / 零網路）
    - CLI 參數 `--name` / `--dry-run` / `--force` / `--help`
    - Schema-driven 動態問答（讀 `WORKSPACE_SCHEMA.yaml`）
    - 熔斷自動化（掃描 `tech-stacks/` 產生可用清單）
    - Transaction-like 寫檔（失敗完整 rollback；CURRENT_WORKSPACE 還原）
    - 驗證收尾（呼叫 `workspace-schema-validator`）
    - 自動更新 `workspaces/README.md` 表格
  - `tasks/project-onboarding.md` 擴充 §引導模式（雙軌 A/B + 選擇建議表）
  - `workspaces/README.md` 擴充三方式（CLI 主推 / AI 對話 / 手動警告）

### Notes

- **雙軌不取代**：CLI 與 @Lead AI 對話並存；兩者共用 schema 與 validator 出口
- **語意對偶**：與 PROPOSAL_20260423_001 Part 6 `framework-upgrade-workflow.md` 互補（首次建立 vs 升級既有）

---

## [v4.3] - 2026-04-23

### Added

- **PROPOSAL_20260423_004**：文件分層三原則（`.agents/docs/` 與 `docs/` 分離；堵跨專案搬運污染）
  - `RULES_DESIGN_GUIDE §二十` 新增（6 小節：三層定義 + 判定流程 + 禁止行為 + validator 偵測 + 與 §十六.F 互補 + 意圖繼承）
  - `.agents/docs/` 目錄層（跨專案通用 framework 說明文件）
  - `.agents/docs/README.md`（目錄說明 + 分層規則 + 禁止行為）
  - `tests/docs-location-validator.mjs`（3 規則偵測；整合 `run-all.sh` 7 → 8 validators）

### Changed

- 3 份 framework 文件從 `docs/` 移入 `.agents/docs/`：
  - `docs/agents-overview.md` → `.agents/docs/agents-overview.md`
  - `docs/Reports/AI Agent 品質實踐評鑒表 (2026 旗艦版).md` → `.agents/docs/quality-audit-checklist.md`
  - `docs/Reports/AI Agent 品質自動化評審手冊 (2026 專業版).md` → `.agents/docs/quality-audit-automation-manual.md`
- 引用路徑更新（6 處主動檔案；歷史 proposals/completed 依規範不動）
- `scripts/framework-diff.mjs` `FRAMEWORK_LAYER_PATTERNS` 新增 `/^docs\/[^/]+\.md$/`
- `RULES_DESIGN_GUIDE` v1.8 → v1.9；`rules/auditor.md` v1.1 → v1.2
- `agents-overview §1.2` RULES_DESIGN_GUIDE 章節範圍更新為 §一~§二十 + `.agents/docs/` 層說明

### Notes

- **類別 B（運作紀錄）保留 `docs/`**：User 2026-04-23 決策「運作紀錄屬專案特有，不需特別分 project」
- **歷史不改寫**：`proposals/completed/` 內文保留舊路徑（類比 git log 性質）
- **位置 × 內容雙軌**：§二十 規範位置；§十六.F 規範內容；互補完整

---

## [v4.2] - 2026-04-23

### Added

- **PROPOSAL_20260423_003**：Hotfix 診斷強化三支柱（堵 Hotfix 資安空窗 + 消除診斷單點盲點）
  - `RULES_DESIGN_GUIDE §十九` 新增（6 小節 A-F：三支柱總覽 + 診斷組 D1-D4 + @Security SC-01~10 + @Lead 上下文注入 + 違規偵測 + 意圖繼承）
  - `skills/diagnostic-playbook.md`（F2 類；五步 SOP + 診斷組三段式協作 + 上下文包格式 + DIAGNOSIS_NOTE.md 產出格式）
  - `tasks/emergency-shutdown-playbook.md §三` 擴充為五步驟（+ Step 0 上下文 + Step 4 Gate Check 4 條件）+ 事故分類決策樹 + 診斷組 vs @Security 關係表
  - `tasks/hotfix-checklist.md` 擴充 Step 0 + Step 1 診斷組協作 + Step 2 @Security 條件式 + Step 4 Gate Check 4 條件
  - `lead.md §s07` Hotfix 派發五步驟擴充（派發訊息加 `Incident-Context` + `SC-Evaluation`；4 項禁止）
  - `backend.md` + `frontend.md` 各新增 §「Hotfix 模式 DoD」
  - `security.md` 新增 §「Hotfix 模式介入條件」（SC-01~10 強制平行介入）

### Changed

- `RULES_DESIGN_GUIDE` v1.7 → v1.8
- `lead.md` v1.9 → v2.0（結構性強化）
- `backend.md` v1.3 → v1.4；`frontend.md` v1.3 → v1.4；`security.md` v1.4 → v1.5
- `agents-overview §1.2` RULES_DESIGN_GUIDE 章節範圍更新為 §一~§十九

### Fixed

- **Hotfix 資安空窗**：PROPOSAL-020 @Security 條件式介入從「正常流程 §6.5」擴展至 Hotfix 模式；SC-01~10 觸發時強制平行介入（對齊 §十九.C）

### Notes

- **意圖對偶**：§十八 Prior Art Scan（事前預防）+ §十九 Hotfix 診斷強化（事後修復）形成完整品質閉環
- **不新設 Agent**：13 Agent 維持；方法論 skill + 既有角色組合解決「根因分析無專責角色」問題

---

## [v4.1] - 2026-04-23

### Added

- **PROPOSAL_20260423_002**：Prior Art Scan 強制程序（預防重複造輪子的重工風險）
  - `RULES_DESIGN_GUIDE §十八` 新增（6 小節 A-F + 禁止行為 + 意圖繼承）
  - `planner.md` User Story 新增 `existing_solution_hint` 粗篩欄位
  - `architect.md` 新增 Prior Art Scan 前置強制階段（6 步驟 DoD + 4 項禁止行為）
  - `lead.md` 新增 Prior Art Verification Gate（強制 HITL；User WebSearch 驗證未通過阻斷實作）
  - `skills/checklists/prior-art-scan-checklist.md`（F2 類；檢索模板 + 評估矩陣 + 決策樹）
  - `skills/templates/prior-art-report-template.md`（F1 類；6 章節標準格式）
  - `WORKSPACE_SCHEMA.yaml` 新增 `EVALUATED_PACKAGES` 欄位（optional）

### Changed

- `RULES_DESIGN_GUIDE` v1.6 → v1.7
- `lead.md` v1.8 → v1.9；`planner.md` v1.2 → v1.3；`architect.md` v1.2 → v1.3
- `WORKSPACE_SCHEMA.yaml` v1.1 → v1.2
- `agents-overview §1.2` 章節範圍更新為 §一~§十八 + skills/ 說明增補

---

## [v4.0] - 2026-04-23

### Added

- **PROPOSAL_20260423_001**：skills/tasks 專案特化參照規範 + 框架版本治理（Part 1-6 合併）
  - `RULES_DESIGN_GUIDE §十六.F` 新增（三態分類 F1/F2/F3 + §專案特化參照標準格式 + 違規偵測 + 回溯分類表）
  - 9 份 F2 類 skills/tasks 補 §專案特化參照 + MACHINE_READABLE anchor
  - `workspace-schema-validator.mjs` 擴充 `validateSkillsAndTasks()`
  - `.agents/FRAMEWORK_VERSION`（YAML v4.0 baseline）
  - `.agents/CHANGELOG.md`（本檔）
  - `.agents/scripts/framework-diff.mjs`（純 Node.js；framework_layer vs project_layer 比對）
  - `.agents/tasks/framework-upgrade-workflow.md`（8 步驟升級 SOP + 禁止行為 + 回滾指引）

### Changed

- `RULES_DESIGN_GUIDE §十二` 第 5-6 條新增：提案執行 Phase E 必須同步 CHANGELOG.md + FRAMEWORK_VERSION

---

## [v3.5] - 2026-04-23

### Added

- **PROPOSAL_20260422_030**：examples 補充（assistant-examples + reviewer-security-examples；Few-Shot 11/11 Agent 覆蓋）

### Audit

- `@Auditor` 第 4 次評審：整體 4.62（+0.21 vs #3）；**P-15 AUDIT_QUALITY 解除**（3.2 Cost: 2.8 → 4.5，Δ +1.7）
- `drift_score = 0.957` 維持

---

## [v3.0] - 2026-04-22

### Added

- **PROPOSAL_20260422_024**：MODEL_ROUTING（haiku/sonnet/opus 分層路由）
- **PROPOSAL_20260422_032**：LANE_ROUTING（fast/standard/heavy 多車道）+ `SYSTEM_THRESHOLDS.complexity_thresholds` 共用
- **PROPOSAL_20260422_025**：`agent-drift-simulator.mjs` Mode A（static 靜態評分）
- **PROPOSAL_20260422_026**：lead/assistant 黑板模式外部化（新建 3 skills + 2 tasks；rules/ 維持 13 檔；lead.md token 4800+ → 4178）
- **PROPOSAL_20260422_027**：auditor-rubric-prompts Fragment 16→18（新增 2.4 Orchestration Efficiency + 3.4 Cost Efficiency）+ `validate-auditor-dispatch.mjs` + `AUDIT_DECISION_LOG.md`
- **PROPOSAL_20260422_031**：`tasks/audit-retro-coordination.md` 5 步驟協作 SOP + 衝突仲裁
- **PROPOSAL_20260422_028**：`agents-overview-sync-validator.mjs`（5 檢查項）
- **PROPOSAL_20260422_029**：`ref-validator.mjs`（22/22 `!ref` 有效 + 零循環）

### Fixed

- **P-15 AUDIT_QUALITY 解除**：3.2 Cost Efficiency 2.8 → 4.5（PROPOSAL_024+032 同 Sprint 執行效果）

---

## [v2.0] - 2026-04-22

### Added

- **PROPOSAL_20260422_022**：tech-stacks 純淨分離 + `WORKSPACE_SCHEMA.yaml` SSOT + Schema-driven Onboarding
- **PROPOSAL_20260422_023**：提案 scope 分層治理（framework / project:<name> 二元分層）
- **PROPOSAL_20260422_003**：審查類 Agent 機讀產出物強制規範（M2M 合約）
- **PROPOSAL_20260422_001**：@Lead 狀態錨點與無狀態路由限制（LangGraph 前置）
- **PROPOSAL_20260422_002 + 006**：workspaces/ + project-onboarding（跨專案通用性）

### Changed

- `.agents/tech-stacks/*.md`（8 份）統一補 §專案特化參照 + MACHINE_READABLE anchor

---

## [v1.5] - 2026-04-22

### Added

- **PROPOSAL_20260422_008**：`@Auditor` Agent + 5 維度 15 細項定期評分
- **PROPOSAL_20260422_009**：Agent 行為自動化驗收框架（schema-validator.mjs）
- **PROPOSAL_20260422_010**：File-based 並行防護（`concurrency-guard-pattern`）+ PM2 身份
- **PROPOSAL_20260422_011**：隱私 + strategyWeight 流程治理（`strategyweight-change-checklist`）
- **PROPOSAL_20260422_012**：DoD 自評統一化 + Gate Check Auto-Audit
- **PROPOSAL_20260422_013**：Token 優化 + Few-Shot 補齊（批 1；10 份 \*-examples.md）
- **PROPOSAL_20260422_014**：`SYSTEM_THRESHOLDS.yaml`（系統參數單點配置）
- **PROPOSAL_20260422_007**：提案整合性分析機制（`proposal-integration-analysis`）
- **PROPOSAL_20260422_004**：@Assistant HCI 全局摘要機制

---

## [v1.0] - 2026-04-21

### Initial Framework

- 12 核心 Agent rules（system-prompt + lead + assistant + planner + architect + backend + frontend + reviewer + security + qa + retro + consultant）
- 基礎 `skills/` + `tech-stacks/` + `domains/` + `tasks/` 四目錄
- `RULES_DESIGN_GUIDE.md` 十五章節 + `RULES_METADATA_SCHEMA.md`
- 9 份 AlwaysOn Rules YAML frontmatter 標準化

### Key Proposals

- PROPOSAL_20260421_001~019：系統性模板外部化 / frontend 重構 / 設計指引 / system-prompt 修補 / HITL 數值化 / 巡邏週期 / DoD 機制 / 豁免記錄 / 版本控制
- PROPOSAL_20260421_020：@Security Agent 新增 + 系統參數單點配置
- PROPOSAL_20260421_021：Rules 結構標準化（YAML frontmatter + XML section）

---

## 版本號規則（依 RULES_DESIGN_GUIDE §十二）

- **major（X.0）**：結構性重組（如 tech-stacks 純淨分離、scope 分層）
- **minor（X.Y）**：新增規範條目 / 新 Agent / 新 validator
- **patch（X.Y.Z）**：修正 typo / 回溯分類更新 / 僅文檔微調

## 維護規範

- `@Lead` 於提案執行 Phase E 時 append 對應章節
- `### Added / Changed / Fixed / Deprecated / Removed / Security` 標準分類
- 每個變更標示提案編號（`PROPOSAL_YYYYMMDD_NNN`）
- 重大變更（major/minor bump）同步更新 `FRAMEWORK_VERSION`
