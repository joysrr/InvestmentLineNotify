# Framework Changelog

> 由 PROPOSAL_20260423_001 建立。
> 記錄 `.agents/` 框架層時序變更；採 [Keep a Changelog](https://keepachangelog.com/) 格式。
> `@Lead` 於每次提案執行 Phase E 時 append 對應 `[vX.Y]` 章節（依 RULES_DESIGN_GUIDE §十二 第 5 條）。
> 多專案並行（方案 B）升級時參照本檔決定是否拉取新版框架。

> **注意（依 PROPOSAL_20260423_012 Phase B）**：新增的 `[vX.Y]` 條目由 `gen-changelog.mjs --write` 自動 prepend。手動編輯既有條目為允許；但新增條目 **必須透過 generator**（`gen-changelog --check` 會驗證提案+版本條目存在）。

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
      * Core Agent（5）：Stateless routing / Workspace / Drift / Concurrency / Auditor
      * Workflow（4）：Model tier / Lane / Hotfix dual-track / Proposal Full/Lite
      * Security（5）：Parallel review / SC-01~10 / Diagnostic team / DoD / Prior Art
      * Structure（4）：Tech-stacks purity / F1/F2/F3 / Doc layering / DESIGN_GUIDE split
      * Governance（4）：Scope tiering / Intent inheritance / Lifecycle / Frontmatter
      * Framework（6）：Version mgmt / Runtime / AUTO-GENERATED / Validator / Script-underuse / Summaries
      * Monitoring（2）：Patrol catalog / Notification classification
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
- **產業範式對齐**：Kubernetes KEP / IETF RFC / ADR 標準架構
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
  - `skills/rule-update-proposal-lite-template.md`（新增；F1 類；含決策自檢 + 7 欄模板 + 使用時機範例表 + SOP）
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
- **Hotfix 資安空窗**：PROPOSAL-020 @Security 條件式介入從「正常流程 §6.5」擴展至 Hotfix 模式；SC-01~10 觸發時強制平行介入（對齐 §十九.C）

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
  - `skills/prior-art-scan-checklist.md`（F2 類；檢索模板 + 評估矩陣 + 決策樹）
  - `skills/prior-art-report-template.md`（F1 類；6 章節標準格式）
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
- **PROPOSAL_20260422_013**：Token 優化 + Few-Shot 補齊（批 1；10 份 *-examples.md）
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
