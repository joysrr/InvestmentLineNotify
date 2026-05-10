# RULES_VERSION_INDEX

> Rules 文件版本總索引（依 PROPOSAL-019 建立）。
> 由 `@Lead` 於每次提案執行合併後更新。

- **最後更新**：2026-04-22（PROPOSAL_030 批 3 收尾執行完成：新建 assistant-examples.md + reviewer-security-examples.md；11/11 Agent Few-Shot 完整覆蓋）
- **維護者**：`@Lead`
- **最近一次 Schema 重構**：PROPOSAL-021（YAML frontmatter + XML section 統一規範）
- **最近一次批次執行**：PROPOSAL_20260422_008 + 009 + 010 + 011 + 012 + 013 + 014（自我評比改善組）
- **最近一次結構性重構**：PROPOSAL_20260422_022 + 023（tech-stacks 純淨分離 + WORKSPACE_SCHEMA SSOT + 提案 Scope 分層治理）
- **最近一次執行**：PROPOSAL_20260422_024 + 032 同 Sprint（complexity_thresholds → Model × Lane 雙軌路由；13 rules 補 default_model_tier；解除 P-15 AUDIT_QUALITY 3.2=2.8 警示）

---

## 版本總覽

<!-- ⚠️ 下方區塊由 gen-rules-version-index.mjs --write 管理；手動編輯會在下次執行時被覆蓋 -->
<!-- AUTO-GENERATED:BEGIN rules_versions -->

| 文件                               | 當前版本 | 最後修改日期 | 最近提案                                                                                             | 審計基準版本 |
| ---------------------------------- | -------- | ------------ | ---------------------------------------------------------------------------------------------------- | ------------ |
| `.agents/RULES_DESIGN_GUIDE.md`    | **v2.0** | 2026-04-24   | PROPOSAL-021+022+023+025+20260423_001+20260423_002+20260423_003+20260423_004+007+008+009+010+011+012 | v1.0         |
| `.agents/RULES_METADATA_SCHEMA.md` | **v1.0** | 2026-04-21   | PROPOSAL_20260421_021+PROPOSAL_20260423_014                                                          | v1.0         |
| `.agents/rules/system-prompt.md`   | **v2.1** | 2026-05-01   | PROPOSAL_20260501_001                                                                                | v1.0         |
| `.agents/rules/lead.md`            | **v3.1** | 2026-05-02   | PROPOSAL_20260502_011                                                                                | v1.0         |
| `.agents/rules/planner.md`         | **v2.1** | 2026-05-02   | PROPOSAL_20260502_002                                                                                | v1.0         |
| `.agents/rules/architect.md`       | **v2.1** | 2026-05-02   | PROPOSAL_20260502_006                                                                                | v1.0         |
| `.agents/rules/backend.md`         | **v2.1** | 2026-05-02   | PROPOSAL_20260502_006                                                                                | v1.0         |
| `.agents/rules/frontend.md`        | **v2.1** | 2026-05-02   | PROPOSAL_20260502_002                                                                                | v1.0         |
| `.agents/rules/qa.md`              | **v2.1** | 2026-05-02   | PROPOSAL_20260502_002                                                                                | v1.0         |
| `.agents/rules/reviewer.md`        | **v2.1** | 2026-05-02   | PROPOSAL_20260502_008                                                                                | v1.0         |
| `.agents/rules/consultant.md`      | **v2.1** | 2026-05-02   | PROPOSAL_20260502_002                                                                                | v1.0         |
| `.agents/rules/retro.md`           | **v2.1** | 2026-05-02   | PROPOSAL_20260502_002                                                                                | v1.0         |
| `.agents/rules/assistant.md`       | **v2.1** | 2026-05-02   | PROPOSAL_20260502_009                                                                                | v1.0         |
| `.agents/rules/security.md`        | **v2.1** | 2026-05-02   | PROPOSAL_20260502_002                                                                                | v1.0         |
| `.agents/rules/auditor.md`         | **v2.1** | 2026-05-04   | PROPOSAL_20260502_021                                                                                | v1.0         |
| `.agents/SYSTEM_THRESHOLDS.yaml`   | **v1.2** | <unknown>    | <unknown>                                                                                            | —            |
| `.agents/WORKSPACE_SCHEMA.yaml`    | **v1.4** | 2026-04-24   | PROPOSAL_20260424_019                                                                                | —            |

<!-- AUTO-GENERATED:END rules_versions -->

## PROPOSAL_20260423_007 執行摘要（2026-04-23，索引自動產生器）

| Phase | 主要變更                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | 新建 `scripts/generators/gen-rules-version-index.mjs`：parseFrontmatter（支援 markdown + YAML）+ buildVersionTable + collectFilesInfo（17 追蹤檔；含 `# 版本：` 註解 fallback for SYSTEM_THRESHOLDS）+ replaceVersionTableSection（保留歷史段落）                                                                                                                                                                                |
| B     | 新建 `scripts/generators/gen-changelog.mjs`：parseProposalMetadata（從提案 markdown 撈 §三 Part / §基本資訊）+ bumpVersion（minor/major）+ readFrameworkVersion + buildChangelogEntry + prependEntryToChangelog                                                                                                                                                                                                                  |
| C     | 新建 `scripts/generators/gen-proposal-index.mjs`：scanProposals（active/completed/archived）+ parseProposalStatus + buildStatsTable + buildOpenTable + buildInProgressTable（dry-run 預設；--write 待 markdown 替換邏輯啟用）                                                                                                                                                                                                    |
| D     | 新建 `scripts/generators/gen-framework-version.mjs`：bumpVersion + readCurrentVersion + countCompletedProposals + updateFrameworkVersionFields（一次替換 5 個欄位 + proposals_total）                                                                                                                                                                                                                                            |
| E     | `tests/run-all.sh --regenerate-indexes` 模式啟用（先前預留；現在串接 gen-rules-version-index --write + gen-proposal-index dry-run + 提示 CHANGELOG / FRAMEWORK_VERSION 手動指令）+ `RULES_DESIGN_GUIDE §十二` 補「Phase E 自動化」段落（v1.10 → **v1.11**）+ `scripts/generators/README.md` 新建                                                                                                                                 |
| F     | 測試框架擴充：<br>　· `tests/scripts/unit.test.mjs` +16 cases（generators 純函式；46 total）<br>　· `tests/scripts/smoke.test.sh` +3 cases（regenerate-indexes 整合 + dry-run 不寫檔；12 total）<br>　· **L1 46/46 + L3 12/12 全通過**                                                                                                                                                                                           |
| G     | 派生視圖 + 索引同步：<br>　· `agents-overview §1.2` scripts/ 新增 generators/ 子目錄結構<br>　· `RULES_VERSION_INDEX` 本條目新增 + 由 generator 自動更新版本表（首次自動化驗證）<br>　· `PROPOSAL_INDEX §🔗` 新增「022+028+001 Part 5+005+006 → 007」延伸繼承<br>　· `CHANGELOG [v4.7]` 新增<br>　· `FRAMEWORK_VERSION` v4.6 → **v4.7**（由 gen-framework-version 自動 bump）<br>　· 提案 IN_PROGRESS → DONE + 移至 `completed/` |

**核心成就**：

- ✅ 索引手動同步成本大幅降低：每提案 Phase E 從 ~22 min → 預期 ~5 min（**-77%**）
- ✅ 4 個 generators（共 ~700 行）+ README + run-all.sh `--regenerate-indexes` 一鍵入口
- ✅ SSOT 落實：rules / proposals frontmatter 為真相；INDEX 為派生視圖
- ✅ 不取代 LLM 判斷：Notes / §🔗 / 摘要章節仍由 @Lead 處理
- ✅ Generators 全納入測試框架：L1 16 cases + L3 3 cases；47% 程式碼覆蓋（粗估）
- ✅ 首次 dogfooding：本提案的 RULES_VERSION_INDEX 版本表由 generator 自動更新
- ✅ 100% 符合 User 2026-04-23 原則：純 .agents/ 內部工具；零 npm；零網路

**預期效益（@Auditor 下次評審）**：

- 5.2 測試覆蓋：4.8 → 4.9（generator 測試 +16）
- 整體：4.93 → **預期 4.94**（+0.01；首批投資已部分回收）

---

## PROPOSAL_20260423_008 執行摘要（2026-04-23，run-all.sh 並行 + --fast + --validator 三模式）

| Phase | 主要變更                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | `tests/run-all.sh` 重構：7 validators 並行（背景作業 + wait + /tmp log 暫存）+ scripts L3 序列；--help 模式                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| B     | 新建 `tests/lib/git-diff-detector.sh`（純 Bash；依檔案路徑 → validators 集合；fallback 跑全部）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| C     | `--fast` 模式（依 git diff）+ `--validator <name>` 子集模式 + `RULES_DESIGN_GUIDE §十二` 補「Validator 執行模式」段落 + 「禁止 Phase E 用 fast」+ `tests/README.md` 更新；RULES_DESIGN_GUIDE v1.9 → **v1.10**                                                                                                                                                                                                                                                                                                                                                                                                   |
| D     | `tests/scripts/smoke.test.sh` +3 cases：<br>　· run-all.sh --validator schema 單一模式<br>　· git-diff-detector.sh detect_relevant_validators 函式驗證（避開遞迴）<br>　· run-all.sh --help 顯示說明<br>　· **9/9 cases pass**（從 6 cases）                                                                                                                                                                                                                                                                                                                                                                    |
| E     | 派生視圖 + 索引同步：<br>　· `agents-overview §1.2` tests/ 區塊新增 lib/ 子目錄 + 標示 8 升 9 + 三模式說明<br>　· `RULES_VERSION_INDEX` 本條目新增 + retro.md v1.5→v1.6 + RULES_DESIGN_GUIDE v1.9→v1.10<br>　· `PROPOSAL_INDEX §🔗` 新增「019 升級 → 008」延伸繼承<br>　· `CHANGELOG [v4.6]` 新增<br>　· `FRAMEWORK_VERSION` v4.5 → **v4.6**<br>　· **新增定期檢視機制**（依 User 2026-04-23 指示）：<br>　　- 新建 `tasks/periodic-design-review.md`（流程繁瑣 + LLM 可程式化雙目標檢視）<br>　　- `retro.md §s02` 定期審計觸發條件 +1 條（強制執行 periodic-design-review）<br>　　- retro.md v1.5 → **v1.6** |

**核心成就**：

- ✅ Pre-commit 速度大幅改善：實測 full mode **0.9 sec**（vs 預估 25 sec；超預期）
- ✅ Single mode **0.07 sec**（極速反覆測試）
- ✅ Fast mode 對單檔變更 **< 5 sec**（依 git diff 跳過無關 validators）
- ✅ scripts/ 測試從 36 → **39 cases**（L1 30 + L3 9）
- ✅ 並行設計：8 互不依賴 validators 並行 + scripts 序列保留（避免 workspace 競爭）
- ✅ 保守 fast 設計：未知檔案類型 fallback；無變更 fallback 跑全部
- ✅ 向後相容：預設 full 模式；既有 pre-commit hook 不需動
- ✅ **附加成果**：定期設計檢視機制納入 retro 流程（防未來繁瑣 / 程式化機會遺漏）

**預期效益（@Auditor 下次評審）**：

- 2.1 架構模組化：5.0 → 5.0（已滿）
- 3.1 Latency：5.0 → 5.0（已滿；run-all 速度提升不再列項）
- 整體：4.92 → **預期 4.93**（+0.01；定期檢視機制納入計分）

---

## PROPOSAL_20260423_006 執行摘要（2026-04-23，scripts/ 測試框架）

| Phase | 主要變更                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | `scripts/` 函式 export 重構：<br>　· `framework-diff.mjs` export 5 純函式（classifyPath / isAgentsDir / listAllFiles / hashFile / readVersion）+ import.meta.url 守衛<br>　· `init-workspace.mjs` export 7 純函式（parseYaml / splitTopLevel / parseScalar / renderWorkspaceMd / renderProposalIndexShell / scanAvailableTechStacks / answerMatchesAvailableStacks）+ lazy readline init + import.meta.url 守衛              |
| B     | 新建 `.agents/tests/scripts/unit.test.py`（`node:test` + `node:assert`；零 npm）：<br>　· parseYaml 5 cases / parseScalar 3 cases / splitTopLevel 2 cases<br>　· renderWorkspaceMd 4 cases（含 Bug 1 單欄位 block 修正驗證）<br>　· renderProposalIndexShell 2 cases / answerMatchesAvailableStacks 4 cases<br>　· classifyPath 4 cases / hashFile 2 cases / readVersion 2 cases / isAgentsDir 2 cases<br>　· **30/30 pass** |
| C     | 新建 `.agents/tests/scripts/smoke.test.sh`（Bash 6 cases）：<br>　· `--help` 輸出 / `--dry-run` 不寫檔 / 完整成功路徑 / rollback 路徑 / framework-diff self-diff / CURRENT*WORKSPACE 保護<br>　· setup + trap EXIT 完整 cleanup（workspaces/smoke*\* + CURRENT_WORKSPACE 還原 + README 條目清除）<br>　· **6/6 pass**                                                                                                        |
| D     | 新建 `.agents/tests/scripts/run.sh` 測試入口（串 L1 + L3；統一 pass/fail 摘要）                                                                                                                                                                                                                                                                                                                                              |
| E     | `run-all.sh` 整合第 9 validator（SCRIPTS_CODE；warning-level policy）；validators 8 → **9**                                                                                                                                                                                                                                                                                                                                  |
| F     | 派生視圖 + 索引同步：<br>　· `agents-overview.md §1.2` tests/ 新增 scripts/ 子目錄說明 + run-all.sh 改「9 validators」<br>　· `RULES_VERSION_INDEX.md` 本條目新增<br>　· `PROPOSAL_INDEX.md §🔗` 新增「001 Part 5 + 005 → 006」延伸繼承<br>　· `CHANGELOG.md [v4.5]` 新增<br>　· `FRAMEWORK_VERSION` v4.4 → **v4.5**<br>　· 提案 IN_PROGRESS → DONE + 移至 `completed/`                                                      |

**核心成就**：

- ✅ scripts/ 自動化測試覆蓋從 0 → **36 cases**（30 L1 + 6 L3）
- ✅ run-all.sh validators 8 → **9**
- ✅ 本次 CLI Bug 1（單欄位 block）由 renderWorkspaceMd 單元測試專案例捕獲
- ✅ 本次 CLI Bug 2（readline/promises 非 TTY）由 smoke test piped input 捕獲
- ✅ L1 執行時間 ~130 ms / L3 執行時間 ~15 s（合計 < 20 s）
- ✅ Transaction-like 測試清理（trap EXIT + README 條目 sed 移除）
- ✅ 明文修正 PROPOSAL_20260423_005 §1.5「不新增自動化測試」決策
- ✅ 100% 符合 User 2026-04-23「專注 .agents/ 自身改善」原則（零 npm / 零網路）

**預期效益（@Auditor 下次評審）**：

- 5.2 測試覆蓋：4.5 → 4.8（+0.3）
- 整體：4.90 → **預期 4.92**（+0.02）

---

## PROPOSAL_20260423_005 執行摘要（2026-04-23，互動式 CLI 初始化工具）

| Phase | 主要變更                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | 新建 `.agents/scripts/init-workspace.py`（純 Node.js 內建模組；零 npm / 零網路）：<br>　· CLI 參數 `--name` / `--dry-run` / `--force` / `--help`<br>　· 沿用 workspace-schema-validator 的 parseYaml 函式<br>　· Step 0 preCheck（CURRENT_WORKSPACE 檢查 + schema 載入 + tech-stacks 掃描）<br>　· Step 1-5 collectAnswers（動態 schema 問答 + required 阻斷 + 熔斷三選一 fallback）<br>　· Step 6 previewAndCommit（預覽 + transaction-like 寫檔 + validator 呼叫）<br>　· rollback（失敗完整回退；CURRENT_WORKSPACE 還原為執行前值）<br>　· Step 7 postGuide + updateWorkspacesReadme（自動更新 README 表格） |
| B     | `tasks/project-onboarding.md` 擴充 §引導模式：<br>　· 軌道 A @Lead AI 對話引導（原流程）<br>　· 軌道 B 互動式 CLI（新增）<br>　· 選擇建議表（5 情境）+ 軌道切換規則<br>　· §Schema 驅動原則 補雙軌共用原則說明<br>　· §6 Step 6 加註（CLI 自動執行 Step 6.1~6.4）                                                                                                                                                                                                                                                                                                                                               |
| C     | `workspaces/README.md` 擴充 §建立新專案 workspace 為**三方式**：<br>　· 方式一 CLI（🟢 主推；快速；不留半成品）<br>　· 方式二 AI 對話（適合需解釋欄位意義）<br>　· 方式三 手動（⚠️ 容易遺漏；僅供非標準情境）                                                                                                                                                                                                                                                                                                                                                                                                   |
| D     | CLI 自測：<br>　· `--help` 顯示正常<br>　· `--dry-run` 不寫檔<br>　· CURRENT_WORKSPACE 已存在 + 無 `--force` + "n" → 正確取消<br>　· 語法檢查 `node --check` 通過                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| E     | 派生視圖 + 索引同步：<br>　· `agents-overview.md §1.2` scripts/ 增補 init-workspace.mjs<br>　· `RULES_VERSION_INDEX.md` 本條目新增<br>　· `PROPOSAL_INDEX.md §🔗` 新增「002+022+023+20260423_001 → 20260423_005」延伸繼承<br>　· `CHANGELOG.md [v4.4]` 新增<br>　· `FRAMEWORK_VERSION` v4.3 → **v4.4**（proposals_included 58 → 59）<br>　· 提案 IN_PROGRESS → DONE + 移至 `completed/`                                                                                                                                                                                                                         |

**核心成就**：

- ✅ 雙軌引導並存（AI 對話 + CLI）；兩者共用 schema 與 validator 出口
- ✅ 多專案並行部署友好：CLI 批次建立時間預估 ~30 min → ~10 min（-65%）
- ✅ 結構建立自動化：8 個檔案 / 目錄一次產出；避免手動遺漏
- ✅ Transaction-like 設計：失敗完整回退；CURRENT_WORKSPACE 還原至執行前值
- ✅ 零依賴（純 Node.js 內建；沿用 `framework-diff.mjs` 風格）
- ✅ 熔斷自動化：掃描 `tech-stacks/` 產生可用清單
- ✅ 100% 符合 User 2026-04-23「專注 .agents 自身改善」原則

**預期效益（@Auditor 下次評審）**：

- 3.1 Latency（onboarding 效率）：4.9 → 5.0
- 整體：4.88 → **預期 4.90**（+0.02）

---

## PROPOSAL_20260423_004 執行摘要（2026-04-23，文件分層三原則 + .agents/docs/ 回歸）

| Phase | 主要變更                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A+B   | 新建 `.agents/docs/` 目錄 + README.md；`git mv` 3 份 framework 文件從 `docs/` 移入：<br>　· `docs/agents-overview.md` → `.agents/docs/agents-overview.md`<br>　· `docs/Reports/AI Agent 品質實踐評鑒表 (2026 旗艦版).md` → `.agents/docs/quality-audit-checklist.md`（去版本標記）<br>　· `docs/Reports/AI Agent 品質自動化評審手冊 (2026 專業版).md` → `.agents/docs/quality-audit-automation-manual.md`（去版本標記）<br>　· 3 份文首加 framework 標示區塊         |
| C     | 引用路徑更新（6 處主動檔案）：<br>　· `RULES_DESIGN_GUIDE.md` 2 處（派生視圖 SSOT 說明）<br>　· `skills/auditor-rubric-prompts.md` 3 處<br>　· `tasks/proposal-integration-analysis.md` 1 處<br>　· `skills/rule-update-proposal-template.md` 2 處<br>　· `rules/auditor.md` 3 處（frontmatter references + 文中；v1.1→**v1.2**）<br>　· `tests/agents-overview-sync-validator.mjs` OVERVIEW_PATH 改指 `.agents/docs/`<br>　· 類別 B / 歷史 proposals 依規範**不動** |
| D     | 新建 `.agents/tests/docs-location-validator.py`（3 規則；純 Node.js）：<br>　· 規則 1 docs/ 下 framework 說明偵測（error；含排除清單防誤判）<br>　· 規則 2 `.agents/docs/` 業務污染偵測（warning；含歷史範例豁免）<br>　· 規則 3 標示區塊完整性（warning）<br>　· 整合 `run-all.sh` **7 → 8 validators**                                                                                                                                                             |
| E     | `RULES_DESIGN_GUIDE §二十` 新增六小節（A 三層定義 / B 三步判定 / C 4 項禁止 / D 違規偵測 / E 與 §十六.F 互補 / F 意圖繼承）；RULES_DESIGN_GUIDE v1.8 → **v1.9**                                                                                                                                                                                                                                                                                                      |
| F     | `scripts/framework-diff.mjs` `FRAMEWORK_LAYER_PATTERNS` 新增 `/^docs\/[^/]+\.md$/`；self-diff **exit 0**                                                                                                                                                                                                                                                                                                                                                             |
| G     | 派生視圖 + 索引同步：<br>　· `.agents/docs/agents-overview.md §1.2` 目錄樹新增 `docs/` 層 + §一~§二十 範圍更新 + tests/ 新增 docs-location-validator<br>　· `RULES_VERSION_INDEX.md` 本條目新增 + RULES_DESIGN_GUIDE v1.9 + auditor v1.2 同步<br>　· `PROPOSAL_INDEX.md §🔗` 新增「022+023+20260423_001 → 20260423_004」延伸繼承<br>　· `CHANGELOG.md [v4.3]` 新增<br>　· `FRAMEWORK_VERSION` v4.2 → **v4.3**<br>　· 提案 IN_PROGRESS → DONE + 移至 `completed/`     |

**核心成就**：

- ✅ 跨專案搬運純度 70% → **100%**（3 份 framework 文件回歸 `.agents/`；`docs/` 專屬專案業務 + 運作紀錄）
- ✅ 文件分層規範化：`RULES_DESIGN_GUIDE §二十` 鐵律 + `docs-location-validator` 自動偵測雙重防護
- ✅ 位置 × 內容雙軌規範：§二十 位置層級 + §十六.F 內容層級互補完整
- ✅ 歷史不改寫：`proposals/completed/` 內文保留（git log 性質）
- ✅ 類別 B（運作紀錄）依 User 決策保留 `docs/`
- ✅ 100% 符合 User 2026-04-23「專注 .agents 自身改善」原則（移入不移外；零外部依賴）
- ✅ `drift_score = 0.957` 維持（不動 rules 結構）

**預期效益（@Auditor 下次評審）**：

- 1.2 負面約束：4.9 → 5.0（+4 項禁止行為）
- 2.1 架構模組化：4.9 → 5.0（`.agents/docs/` 完整自包含）
- 2.2 可觀察性：4.9 → 5.0（文件分層明文化 + validator）
- 整體：4.82 → **預期 4.88**（+0.06）

---

## PROPOSAL_20260423_003 執行摘要（2026-04-23，Hotfix 診斷強化三支柱）

| Phase | 主要變更                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | `RULES_DESIGN_GUIDE §十九` 新增「Hotfix 診斷強化三支柱」六小節（A 三支柱總覽 / B 診斷組 D1-D4 / C @Security SC-01~10 / D @Lead 上下文注入 / E 違規偵測 / F 意圖繼承）；與 §十八 語意對偶；RULES_DESIGN_GUIDE v1.7 → **v1.8**                                                                                                                                                                                                     |
| B     | 新建 `skills/diagnostic-playbook.md`（**F2** 類；五步 SOP + 診斷組協作 + 上下文包格式 + DIAGNOSIS_NOTE.md 產出格式 + 6 項禁止行為）                                                                                                                                                                                                                                                                                              |
| C     | `tasks/emergency-shutdown-playbook.md §三` 擴充：§3.2 三步驟 → **五步驟**（+ Step 0 上下文 + Step 4 Gate Check 4 條件）+ §3.3 行為守則補 3 條 + §3.5 事故分類決策樹 + §3.6 診斷組 vs @Security 關係表                                                                                                                                                                                                                            |
| D     | `tasks/hotfix-checklist.md` 擴充為 5 Step + 事後收尾：<br>　· Step 0（上下文 + SC + 診斷組評估）新增<br>　· Step 1 診斷組協作條款 + 五步 SOP 清單化<br>　· Step 2 @Security 條件式審查<br>　· Step 4 Hotfix Gate Check 4 條件<br>　· 事後收尾 D3 觸發 @Retro 根因提案                                                                                                                                                            |
| E     | `lead.md §s07` 新增「Hotfix 派發五步驟擴充」子節（派發前必執行 4 步 + 派發訊息格式 + 派發後流程 + 4 項禁止行為）；lead.md v1.9 → **v2.0**（結構性強化）                                                                                                                                                                                                                                                                          |
| F     | `backend.md` + `frontend.md` 各新增 §「Hotfix 模式 DoD」：<br>　· backend.md：執行前提 / 診斷組協作 / 單人模式 / 修復實作 / 平行審查協作<br>　· frontend.md：前端特有診斷重點（initData / vue-vite / miniapp-sdk / ThemeParams）<br>　· 兩份 rules v1.3 → **v1.4**                                                                                                                                                               |
| G     | `security.md` 新增 §s08「Hotfix 模式介入條件」（SC-01~10 對照表 + 執行規範 4 條 + 衝突處理 + 3 項 Hotfix 禁止行為）；security.md v1.4 → **v1.5**                                                                                                                                                                                                                                                                                 |
| H     | 派生視圖 + 索引同步：<br>　· `docs/agents-overview.md §1.2` RULES_DESIGN_GUIDE §一~§十九 + skills/ diagnostic-playbook 新增<br>　· `RULES_VERSION_INDEX.md` 5 份 rules 版本同步 + 本條目執行摘要<br>　· `PROPOSAL_INDEX.md §🔗` 新增「020+026+20260423_001+20260423_002 → 20260423_003」延伸繼承<br>　· `CHANGELOG.md [v4.2]` 新增<br>　· `FRAMEWORK_VERSION` v4.1 → **v4.2**<br>　· 提案 IN_PROGRESS → DONE + 移至 `completed/` |

**核心成就**：

- ✅ Hotfix 資安覆蓋率 0% → ≥ 90%（堵真實漏洞；SC-01~10 強制條件式介入）
- ✅ 診斷單點盲點消除：D1-D4 觸發時組診斷組（`@Backend|@Frontend` + `@Reviewer` 雙眼）
- ✅ @Lead 上下文注入規範：`Incident-Context` 強制附帶；@Backend / @Frontend 免自行搜尋
- ✅ 「診斷 → 實作 → 審查」三段式職責切換：@Reviewer 在不同階段扮演不同角色，避免思維混淆
- ✅ 與 §十八 Prior Art Scan 語意對偶：事前預防（避免造 bug）+ 事後修復（bug 已發生）
- ✅ 100% 符合 User 2026-04-23「專注 .agents 自身改善 + 不導入過多串接」原則
  - 不新設 Agent（13 Agent 維持）
  - 零外部依賴
- ✅ `drift_score = 0.957` 維持（純 DoD 擴充 + 新建 skill + 既有章節 append）

**預期效益（@Auditor 下次評審）**：

- 2.1 架構模組化：4.8 → 4.9（+0.1）
- 3.1 Latency：4.8 → 4.9（+0.1）
- 4.1 角色邊界：4.8 → 4.9（+0.1）
- 4.3 安全：4.6 → **4.9**（+0.3 🔴 堵 Hotfix 資安空窗）
- 整體：4.72 → **預期 4.82**（+0.10）

---

## PROPOSAL_20260423_002 執行摘要（2026-04-23，Prior Art Scan 強制程序）

| Phase | 主要變更                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | `RULES_DESIGN_GUIDE §十八` 新增「Prior Art Scan 強制程序」六小節（A 觸發條件 / B 三階段執行 / C 產出物契約 / D HITL Gate / E 違規偵測 / F EVALUATED_PACKAGES 快取）+ 禁止行為 + 意圖繼承；RULES_DESIGN_GUIDE v1.6 → **v1.7**                                                                                                                                                                                                |
| B     | `planner.md` §s04 User Story 模板 + §s05 第 2.5 步新增 `existing_solution_hint` 欄位（feature / major_enhancement 條件性觸發）；planner.md v1.2 → **v1.3**                                                                                                                                                                                                                                                                  |
| C     | `architect.md` §s04 新增「前置強制步驟 2：Prior Art Scan」：6 步驟執行（讀快取 → 檢索 → 矩陣 → 決策 → 產出 → 通知）+ 4 項禁止行為 + 6 項 DoD；產出物 `docs/plans/prior-art/*.md` 加入 frontmatter；architect.md v1.2 → **v1.3**                                                                                                                                                                                             |
| D     | `lead.md` §s05 新增第 3.5 階段（Prior Art Verification Gate）+ 新增 §s06b 完整 Gate 規範（通知 / 阻斷 / User Bypass / 衝突處理 / 禁止行為）；lead.md v1.8 → **v1.9**                                                                                                                                                                                                                                                        |
| E     | 新建 2 份 skills：<br>　· `skills/checklists/prior-art-scan-checklist.md`（**F2** 類；含 MACHINE_READABLE anchor + §專案特化參照 + 檢索關鍵字 11 類 + 評估矩陣 5 維度加權 + 自建 vs 採納決策樹）<br>　· `skills/templates/prior-art-report-template.md`（**F1** 類；6 章節標準格式 + 完整 date-picker 範例）                                                                                                                |
| F     | `WORKSPACE_SCHEMA.yaml` 新增 `EVALUATED_PACKAGES` 欄位（optional；item_schema 含 7 子欄位）+ `BUSINESS_RULES.description` 補 license_preference / forbidden_packages 子節說明；schema v1.1 → **v1.2**                                                                                                                                                                                                                       |
| G     | 派生視圖 + 索引同步：<br>　· `docs/agents-overview.md §1.2` RULES_DESIGN_GUIDE 章節範圍 §一~§十八 + skills/ 說明增補<br>　· `RULES_VERSION_INDEX.md` 本條目新增 + 4 份 rules / 1 schema 版本同步<br>　· `PROPOSAL_INDEX.md §🔗` 新增「022+20260423_001 → 20260423_002」延伸繼承<br>　· `.agents/CHANGELOG.md [v4.1]` 新增<br>　· `.agents/FRAMEWORK_VERSION` v4.0 → v4.1<br>　· 提案 IN_PROGRESS → DONE + 移至 `completed/` |

**核心成就**：

- ✅ 前置套件生態掃描機械化：新功能 / 大型改版觸發條件明確（C1/C2/C3）+ 排除條件排除微調
- ✅ HITL Gate 補 LLM 知識截止盲區：User WebSearch 驗證強制（Bypass 需記錄 AUDIT_HISTORY）
- ✅ 決策快取跨功能一致：`EVALUATED_PACKAGES` 欄位 + `@Architect` 執行 Scan 前強制讀取
- ✅ 與 tech-stacks 形成閉環：Scan → 採納 → tech-stacks 文件化 → 未來改版再評估
- ✅ 100% 符合 User 2026-04-23「專注 .agents 自身改善」原則：零外部 CI/CD / runtime monitor / 第三方 API；User WebSearch 為自主步驟
- ✅ `drift_score = 0.957` 維持（純 DoD 擴充 + 新建 skill，不拆分 rules 結構）

**預期效益（@Auditor 下次評審）**：

- 1.1 Prompt Quality：4.7 → 4.8（+0.1）
- 2.1 架構模組化：4.8 → 4.9（+0.1）
- 3.1 Latency：4.6 → 4.8（+0.2；避免重工）
- 3.2 Cost Efficiency：4.5 → 4.7（+0.2）
- 整體：4.62 → **預期 4.72**（+0.10）

---

## PROPOSAL_20260423_001 執行摘要（2026-04-23，skills/tasks 專案特化參照 + 框架版本治理）

| Phase | 主要變更                                                                                                                                                                                                                                                                                                                                                                                             |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | `RULES_DESIGN_GUIDE §十六` 新增 F 節（skills/tasks 三態分類 F1/F2/F3 + §專案特化參照標準格式 + 違規偵測 + 既有 35 份 skills/tasks 回溯分類）；RULES_DESIGN_GUIDE v1.5 → **v1.6**                                                                                                                                                                                                                     |
| B     | 9 份 F2 類 skills/tasks 補 §專案特化參照 + `MACHINE_READABLE` anchor：<br>　· `skills/concurrency-guard-pattern.md` / `infra-constraints.md`（補 category: F2）/ `security-audit.md` / `lead-dispatch-patterns.md` / `consultant-bypass-rules.md` / `pm2-management.md` / `strategyweight-change-checklist.md`<br>　· `tasks/project-onboarding.md` / `emergency-shutdown-playbook.md`               |
| C     | `tests/workspace-schema-validator.mjs` 擴充 `validateSkillsAndTasks()`：<br>　· 掃描 skills/ + tasks/，偵測 F2 anchor + §專案特化參照完整性<br>　· F2 workspace 欄位 cross-reference to WORKSPACE_SCHEMA top-level keys<br>　· F3 類違規偵測（error）+ 誤植 §專案特化參照 偵測（warning）                                                                                                            |
| D     | 新建版本治理雙軌：<br>　· `.agents/FRAMEWORK_VERSION`（YAML v4.0 baseline）<br>　· `.agents/CHANGELOG.md`（Keep a Changelog；回溯 v1.0 ~ v4.0 五個里程碑）<br>　· `RULES_DESIGN_GUIDE §十二` 新增第 5-6 條：提案 Phase E 同步 CHANGELOG + FRAMEWORK_VERSION                                                                                                                                          |
| E     | 新建 `.agents/scripts/framework-diff.py`：<br>　· 純 Node.js 內建模組（無 npm 依賴；無網路依賴）<br>　· framework_layer vs project_layer 白名單分離<br>　· 輸出 5 類區塊（New / Modified / Deleted / Protected / Recommended Commands）<br>　· Self-diff 測試通過（exit 0）                                                                                                                          |
| F     | 新建 `.agents/tasks/framework-upgrade-workflow.md`：<br>　· 8 步驟升級 SOP（取版 → diff → 審視 → schema 相容 → 基線 → 合併 → 驗證 → 記錄）<br>　· 禁止行為清單（覆寫 project_layer 6 項）<br>　· 升級失敗 3 種回滾方式（全量 / 特定檔 / 回 commit）                                                                                                                                                  |
| G     | 派生視圖 + 索引同步：<br>　· `docs/agents-overview.md §1.2` 目錄樹新增 5 項（FRAMEWORK_VERSION / CHANGELOG / scripts/ / framework-upgrade-workflow / §十六.F 註記）+ 系統層 5 → **6**<br>　· `RULES_VERSION_INDEX.md` 本條目新增 + RULES_DESIGN_GUIDE v1.6 同步<br>　· `PROPOSAL_INDEX.md §🔗` 新增「022+023+028+029 → 20260423_001」延伸繼承記錄<br>　· 提案 IN_PROGRESS → DONE 並移至 `completed/` |

**核心成就**：

- ✅ 三分法完整覆蓋：tech-stacks（PROPOSAL_022）+ skills/tasks（本提案）統一 §專案特化參照格式
- ✅ 多專案並行友好：方案 B 獨立部署場景有標準升級路徑（8 步驟 SOP + framework-diff 工具）
- ✅ FRAMEWORK_VERSION + CHANGELOG 雙軌治理：各專案副本版本狀態可追溯；drift 可偵測
- ✅ 100% 符合 User 2026-04-23「專注 .agents 自身改善」原則：零外部 CI/CD / runtime monitor / 第三方評測依賴
- ✅ `drift_score = 0.957` 維持（Δ = 0.000；§十六 新增純擴充，不觸及 rules 結構）

**預期效益（@Auditor 下次評審）**：

- 2.1 架構模組化：4.5 → 4.8（+0.3）
- 2.2 可觀察性：4.8 → 4.9（+0.1）
- 整體：4.62 → **預期 4.70**（+0.08）

---

## PROPOSAL_20260422_030 執行摘要（2026-04-22，批 3 Examples 補充收尾）

| Phase | 主要變更                                                                                                                                                                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | 新建 `.agents/skills/examples/assistant-examples.md`（3 組 I/O）：<br>　· 多級別通知衝突（P-04 🔴 + P-13 🟢）<br>　· PENDING_RED_EXPIRE 邊界觸發（全局緊急阻斷條件二升級）<br>　· SUMMARY_STALE 與巡邏並發（P-13 + P-05）                         |
| B     | 新建 `.agents/skills/reviewer-security-examples.md`（3 組跨 Agent 邊界協調）：<br>　· 純前端調整（@Reviewer 獨佔；@Security 不介入）<br>　· API endpoint 新增（雙審 + 安全仲裁優先）<br>　· strategyWeight 異動（@Security 獨佔 + 強制升級 User） |
| C     | 3 份 rules frontmatter 新增 examples 引用：<br>　· `assistant.md`: `examples` + `user_commands`<br>　· `reviewer.md`: `examples` + `boundary_examples`<br>　· `security.md`: `examples` + `boundary_examples`                                     |
| D     | 版本管理：<br>　· assistant v1.7 → v1.8<br>　· reviewer v1.5 → v1.6<br>　· security v1.3 → v1.4<br>　+ agents-overview §1.2 同步 + 移至 completed/                                                                                                |

**核心成就**：

- ✅ Few-Shot 覆蓋達 **11/11**（加入 @Assistant 獨立 examples）
- ✅ 跨 Agent 邊界協調（@Reviewer × @Security）實戰案例就位
- ✅ 所有範例對齊既有規則（PROPOSAL-020 防線 + SC-XX 清單 + 車道分流 + user-commands）

**預期效益（@Auditor 下次評審）**：

- 1.3 Few-Shot 範例品質：4.6 → 5.0（+0.4）
- 整體：4.61 → 4.65（+0.04）

## PROPOSAL_20260422_028 + 029 執行摘要（2026-04-22，批 2 Validator 擴充）

依 User「批 2」裁決；合併 8 Sprint 執行（先 029 後 028）。

| 提案    | Phase       | 主要變更                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **029** | A-C         | 新建 `.agents/tests/ref-validator.py`（185 行）：<br>　· 掃描 rules/ + skills/ frontmatter 的 `!ref <file>#<anchor>` 標記<br>　· 驗證目標檔案存在 + anchor 四種模式定位（章節標題 / 參數名 / YAML key / 模糊匹配 warn）<br>　· DFS 循環引用偵測<br>　· 當前結果：**22 筆 !ref 全部有效 + 零循環**                                                                                                                                                                      |
| **029** | D           | run-all.sh 整合（5 → 6 validators）                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **028** | A           | 新建 `.agents/tests/agents-overview-sync-validator.py`（195 行）：<br>　· **Check 1**：Agents 數（§2.1 ↔ rules/）= 13 ✓<br>　· **Check 2**：Patrol 範圍（§4.2 ↔ patrol-catalog）= P-01~P-20 ✓<br>　· **Check 3**：Rules 版本（§9.2 ↔ RULES_VERSION_INDEX）✓<br>　· **Check 4**：系統參數（§7.1 ↔ SYSTEM_THRESHOLDS.yaml）✓<br>　· **Check 5**：產出物交叉引用（§9.3 ↔ rules produces）寬鬆匹配 ✓<br>　· 退出碼：0（全對齊）/ 1（1-2 項 warn）/ 2（≥ 3 項或關鍵不一致） |
| **028** | B-C         | run-all.sh 整合（6 → **7 validators**）+ 版本管理                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 共同    | Phase D / C | 移至 completed/ + agents-overview §1.2 tests/ 目錄樹註記                                                                                                                                                                                                                                                                                                                                                                                                               |

**核心成就**：

- ✅ 派生視圖同步從「手動 Phase E」升級為「commit-time 自動驗證」
- ✅ MCP !ref 引用從「人工維護」升級為「自動 anchor 解析 + 循環防護」
- ✅ run-all.sh 7 validators 聯合（schema / intent / workspace-schema / drift / ref / sync / —）
- ✅ @Auditor §2.2 可觀察性自動化實現（5 項對齊不再依賴手動巡檢）

**預期效益（@Auditor 下次評審）**：

- 2.2 可觀察性：4.8 → 5.0（+0.2）
- 2.3 MCP 符合度：4.5 → 5.0（+0.5）
- 整體：4.55 → 4.61（+0.06）

## PROPOSAL_20260422_027 + 031 執行摘要（2026-04-22，批 1 @Auditor 閉環強化）

| 提案    | Phase | 主要變更                                                                                                     |
| ------- | ----- | ------------------------------------------------------------------------------------------------------------ |
| **027** | A     | `auditor-rubric-prompts.md` 補齊 Fragment 16 → 18（新增 2.4 Orchestration Efficiency + 3.4 Cost Efficiency） |
| **027** | B     | 新建 `.agents/tests/validate-auditor-dispatch.py`（3 模式：盤點 / 派遣驗證 / AUDIT_DECISION_LOG 稽核）       |
| **027** | C     | 新建 `docs/Reports/AUDIT_DECISION_LOG.md`（回填 #3 評審 5 維度記錄；格式規範 + Fragment 版本對照）           |
| **027** | D     | `auditor.md §3.0` 新增第 5 條 DoD（AUDIT_DECISION_LOG.md 寫入要求）                                          |
| **031** | A     | 新建 `.agents/tasks/audit-retro-coordination.md`（5 步驟協作流程 + 衝突仲裁 + User 介入點 + 優先級明文化）   |
| **031** | B     | `lead.md §s04` 新增 AUDIT_QUALITY 特殊處理（走 coordination task；P-15 連續 2 次升 🔴）                      |
| **031** | C     | `auditor.md` / `retro.md` frontmatter 新增 `coordination_task` / `decision_log` 引用                         |
| 共同    | E     | 版本管理 + agents-overview 同步 + 移至 completed/                                                            |

**核心成就**：

- ✅ Fragment 完整性：16 → 18（100% 覆蓋手冊）
- ✅ 派遣可稽核：AUDIT_DECISION_LOG 記錄每次派遣軌跡
- ✅ 協作 SOP 明文化：@Auditor 與 @Retro 衝突仲裁規則就位
- ✅ P-15 處理升級：連續 2 次觸發 → 🔴 暫停派發

**預期效益（@Auditor 下次評審）**：

- 5.3 Judge LLM：4.0 → 4.5（+0.5）
- 1.1 Persona 具體化：4.8 → 4.9（+0.1）
- 整體：4.49 → 4.55（+0.06）

## PROPOSAL_20260422_026 執行摘要（2026-04-22，選項 B 黑板模式純度版）

依 User「選項 B」裁決將原拆分派修訂為黑板外部化；Phase A-E 分 10 Sprint 執行：

| Phase | 主要變更                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | lead.md 外部化 4 大章節至 skills/tasks：<br>　- skills/lead-dispatch-patterns.md（Gate Check + 派發範例）<br>　- tasks/exemption-approval-workflow.md（豁免授權 4 步驟；critical + immutable）<br>　- tasks/emergency-shutdown-playbook.md（中斷重啟 + 全局緊急阻斷 + Hotfix）<br>　- skills/consultant-bypass-rules.md（戰略審查 Bypass 判定）<br>lead.md 本體：4800+ → 4178 tokens（-620；§s07/s08/s11/s12 改為入口引用） |
| B     | assistant.md 外部化 §s08 User 指令格式：<br>　- skills/assistant-user-commands.md（P-01~P-20 完整對照 + 變體指令）<br>assistant.md 本體：3423 → 3224 tokens（-199）                                                                                                                                                                                                                                                         |
| C     | 引用完整性驗證：grep 確認零殘留殘破引用；agents-overview §1.2 目錄樹更新                                                                                                                                                                                                                                                                                                                                                    |
| D     | drift_score 回歸驗證：**0.957 維持 baseline 不變**（Δ=0.000；≥ 0.90 容許閾值 PASS）                                                                                                                                                                                                                                                                                                                                         |
| E     | 版本管理：lead v1.6→v1.7；assistant v1.6→v1.7（minor；非 major 因無結構重組）                                                                                                                                                                                                                                                                                                                                               |

**核心成就**：

- rules/ 檔案數**維持 13 不變**（User 警示 Hub-and-Spoke 原則完全落實）
- 單向引用（rules → skills/tasks），零跨 rules 引用新增
- drift_score 維持 baseline，證明外部化對 Agent 行為穩定性零衝擊
- 新增 5 份黑板節點為 LangGraph 過渡友好（可映射為 Tool call / Sub-chain）

## PROPOSAL_20260422_025 執行摘要（2026-04-22，選項 A 僅 Mode A）

| Phase | 主要變更                                                                                                                                                                               |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | 新建 `.agents/tests/agent-drift-simulator.py` Mode A（202 行，3 評分項：persona/instruction/boundary；LCG seeded 50-step simulation；exit 0/1/2 依 drift_score ≥0.85 / ≥0.70 / <0.70） |
| B     | ❌ **跳過**（Claude Code 平台不適用；詳見 PROPOSAL_025 §七）                                                                                                                           |
| C     | `AUDIT_HISTORY.md` 新增「drift_score 記錄」表；首筆 2026-04-22 drift_score=0.957（persona=0.962 / instruction=1.000 / boundary=0.862）                                                 |
| D     | `run-all.sh` 整合 Mode A（4 → 5 腳本聯合驗證）+ `RULES_DESIGN_GUIDE §十二` 新增 Phase E.1 回歸驗證條款                                                                                 |
| E     | 版本管理 + agents-overview §10 同步 + 移至 completed/                                                                                                                                  |

**首次 drift_score 基準**：0.957（PASS）；為 PROPOSAL_026 lead/assistant 拆分提供結構穩定性 baseline。

## PROPOSAL_20260422_024 + 032 同 Sprint 執行摘要（2026-04-22）

依 User「024 + 032 同 Sprint 執行」指令合併執行，8 個 Sprint Phase：

| Sprint | 主要變更                                                                                                                                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | 2 提案狀態 OPEN → IN_PROGRESS + PROPOSAL_INDEX 統計                                                                                                                                                                                         |
| 2      | SYSTEM_THRESHOLDS.yaml v1.0 → v1.1 → v1.2：新增 `complexity_thresholds`（024+032 共用基礎）+ `MODEL_ROUTING`（simple/medium/complex → haiku/sonnet/opus）+ `LANE_ROUTING`（→ fast/standard/heavy + gate_matrix + auto_escalation_triggers） |
| 3      | lead.md §s_complexity_lane 新增（三步評估 + 雙軌決策 + 20 指標 + Gate 矩陣 + 降級防護）；v1.5 → v1.6                                                                                                                                        |
| 4      | assistant.md P-19 MODEL_ROUTING_VIOLATION + P-20 LANE_ESCALATION；patrol-notification-catalog §A 範圍 P-01~P-20；v1.5 → v1.6                                                                                                                |
| 5      | 13 rules frontmatter 批次插入 `default_model_tier`（依 024 §3.4 映射：architect/consultant/security/retro/auditor = complex；backend/frontend/lead/planner/qa/reviewer = medium；assistant/system-prompt = simple）                         |
| 6      | 新建 `.agents/tasks/lane-routing-task-classification.md`（20 項指標 + 3×5 案例 + 降級防護 3 機制 + 兜底規則）                                                                                                                               |
| 7      | RULES_VERSION_INDEX 同步；2 提案 IN_PROGRESS → DONE + 移至 completed/；agents-overview §1.2/§3.1/§4.2/§7.1 派生視圖同步；PROPOSAL_INDEX §🔗 新增 024 ↔ 032 平行延伸記錄                                                                     |
| 8      | tests/run-all.sh 驗證 + commit + push                                                                                                                                                                                                       |

**預期效益（@Auditor 下次評審）**：

- 3.2 模型分層路由：2.8 → 4.5（+1.7，**解除 P-15 AUDIT_QUALITY 🟡 警示**）
- 3.1 自我優化：4.5 → 4.7
- 5.1 指令遵循度：4.6 → 4.8
- **整體**：4.41 → 4.52（+0.11）

## PROPOSAL_20260422_023 執行摘要（2026-04-22）

| Phase | 主要變更                                                                                                                                                                                                                                                                               |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | Rules 更新：retro §s07 雙軌目錄 / §s08 前綴編號 / §s13 Scope 強制；RULES_DESIGN_GUIDE §十七（A-G 七小節）；rule-update-proposal-template scope 欄位 + checklist；assistant + patrol-catalog P-18；lead §資源映射表 + 行為準則 Scope 路由；auditor-rubric §2.2 Scope 純度（含扣分規則） |
| B     | Workspace frontmatter 擴充：WORKSPACE_SCHEMA v1.0 → v1.1（PROJECT_CONTEXT.proposal_prefix 新增）+ default_env 模板 + investmentlinenotify 實值 ILN                                                                                                                                     |
| C     | 初始化 `workspaces/investmentlinenotify/proposals/{active,completed,archived}/` + PROPOSAL_INDEX.md 空殼                                                                                                                                                                               |
| D     | 47 份既有提案批次補填 scope: framework frontmatter（45 completed + 1 archived + 1 active）                                                                                                                                                                                             |
| E     | `.agents/proposals/PROPOSAL_INDEX.md` 標頭加「僅 framework scope」+ §🔗 新增 002+022 → 023 延伸記錄；agents-overview §1.2 + §4.2 + §6.1 同步（新增 P-18 / §十七 / Scope 雙軌儲存表）                                                                                                   |
| F     | 版本管理：4 rules minor +1（assistant 1.4→1.5 / lead 1.4→1.5 / retro 1.3→1.4 / RULES_DESIGN_GUIDE 1.3→1.4）+ RULES_VERSION_INDEX 同步 + 移至 completed/                                                                                                                                |

## PROPOSAL_20260422_022 執行摘要（2026-04-22）

| Phase | 主要變更                                                                                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | 新建 `WORKSPACE_SCHEMA.yaml` v1.0（11 區塊 43 欄位，referenced_by 反向索引）                                                                                              |
| B     | 5 份 tech-stacks 去污染 + §專案特化參照 + MACHINE_READABLE anchor                                                                                                         |
| C     | 1 份 skill 刪除（deploy-oracle）+ 1 份拆分（infra-constraints）+ 1 份微調（concurrency-guard-pattern）+ 1 份清洗（vue3-component-pattern）+ 4 份 rules 引用修正           |
| D     | workspaces/default_env 新增 4 欄位區塊 + investmentlinenotify 補填實值（DEPLOYMENT_CONSTRAINTS / DEPLOYMENT_SOP / BUSINESS_DOMAINS / PATHS.source_modules）               |
| E     | 新建 `tests/workspace-schema-validator.mjs` + 納入 `run-all.sh`                                                                                                           |
| F     | `tasks/project-onboarding.md` 擴充為 Schema-driven 6 步驟                                                                                                                 |
| G     | RULES_DESIGN_GUIDE §十六 新增（三分法 + 純淨原則 + 扁平命名 + 閾值規則）+ auditor §2.2 擴充 + stateless-routing-pattern 派發注入規則 + assistant/patrol-catalog P-16/P-17 |
| H     | 3 份 skills 遷移至 tech-stacks（扁平命名）+ telegram-mini-app 重命名為 telegram-miniapp-sdk + 6 rules 引用路徑更新                                                        |
| I     | Rules 版本表更新（7 rules minor +1 + RULES_DESIGN_GUIDE minor +1 + 新增 WORKSPACE_SCHEMA.yaml v1.0 條目）                                                                 |
| J     | PROPOSAL_INDEX 同步 + agents-overview 派生視圖 + 移至 completed/                                                                                                          |

## 自我評比後七提案執行摘要（2026-04-22）

| Sprint         | 提案                       | 主要變更                                                                                |
| -------------- | -------------------------- | --------------------------------------------------------------------------------------- |
| Sprint 1 / 008 | @Auditor 定期評分          | 新建 auditor.md v1.0 + AUDIT_HISTORY.md + retro.md/assistant.md 補強 + §十四 補 3 參數  |
| Sprint 1 / 009 | 自動化驗收框架             | 新建 .agents/tests/ + 4 份 .mjs 腳本 + §十一 驗證義務                                   |
| Sprint 1 / 010 | 並行防護 + PM2 身份        | 新建 concurrency-guard-pattern.md + backend.md 強制條款 + deploy-oracle.md 補 SOP       |
| Sprint 1 / 011 | 隱私 + strategyWeight 治理 | 新建 domains/privacy-compliance.md + strategyweight-change-checklist.md + SC-11         |
| Sprint 2 / 012 | DoD 統一化                 | 新建 dod-audit-checklist-template.md + DoD_AUDIT_LOG.md + lead.md §s09 Auto-Audit       |
| Sprint 2 / 013 | Token + Few-Shot           | 新建 stateless-routing-pattern + patrol-notification-catalog + 5 份 examples skills     |
| Sprint 3 / 014 | 參數 YAML + 機械化         | 新建 SYSTEM_THRESHOLDS.yaml + lead.md §s_state_anchor 6.1 分級動作表 + §十四 外部化引用 |

## 2026-04-22 七提案配套執行摘要

| Step | 提案             | 主要變更                                                                                                                                                                                                                          |
| ---- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | PROPOSAL_005     | assistant.md §s10~s14 合併為引用格式；新建 skills/templates/pending-actions-template.md                                                                                                                                           |
| 2    | PROPOSAL_002+006 | workspaces/ 架構（+CURRENT_WORKSPACE）；13 份 rules 加通用註記；RULES_DESIGN_GUIDE §五 通用化 + §五之一 過渡兼容 + §五之二 意圖繼承；PROPOSAL_INDEX §🔗 意圖繼承表                                                                |
| 3    | PROPOSAL_007     | 新建 tasks/proposal-integration-analysis.md + skills/templates/proposal-integration-analysis-template.md；lead.md §s_pre_adoption_check；retro.md 設計意圖衝突偵測；assistant.md P-14                                             |
| 4    | PROPOSAL_003     | 新建 skills/templates/security-report-template.md；reviewer.md / security.md / qa.md §s_output_strict；security.md §s04 外部化                                                                                                    |
| 5    | PROPOSAL_001     | lead.md §s_state_anchor（狀態錨點 + 無狀態路由 + 缺失備案）；assistant.md §s10 狀態錨點區塊                                                                                                                                       |
| 6    | PROPOSAL_004     | assistant.md §s_global_summary；新建 skills/templates/global-status-summary-template.md + docs/Reports/GLOBAL_STATUS_SUMMARY.md + archive/summary/；RULES_DESIGN_GUIDE §十四 新增 SUMMARY_STALE_THRESHOLD / SUMMARY_HISTORY_LIMIT |

---

## 版本差異速查

> 每次 `@Retro` 審計前更新。

- **上次審計日期**：2026-04-21（初始化）
- **本次審計日期**：<待填>
- **自上次審計後有版本變更的文件**（PROPOSAL-021 Schema 重構，13 份 rules 全面升級）：
  - `RULES_DESIGN_GUIDE.md`：v1.1 → v1.2（PROPOSAL-021 §一 結構化 metadata 層 + §十五 Schema 維護規範）
  - `RULES_METADATA_SCHEMA.md`：**新建 v1.0**（PROPOSAL-021 Schema SSOT）
  - `system-prompt.md`：v1.1 → v1.2（PROPOSAL-021 frontmatter 擴充 + AlwaysOn 例外文件化）
  - `lead.md`：v1.1 → v1.2（PROPOSAL-021 frontmatter 擴充 + 11 個 `<section>` 包覆）
  - `planner.md`：v1.0 → v1.1（PROPOSAL-021 frontmatter 擴充 + `<section>` 包覆）
  - `architect.md`：v1.0 → v1.1（PROPOSAL-021 frontmatter 擴充 + `<section>` 包覆）
  - `backend.md`：v1.0 → v1.1（PROPOSAL-021 frontmatter 擴充 + `<section>` 包覆 + §s06 `immutable`）
  - `frontend.md`：v1.0 → v1.1（PROPOSAL-021 frontmatter 擴充 + `<section>` 包覆）
  - `qa.md`：v1.2 → v1.3（PROPOSAL-021 frontmatter 擴充 + `<section>` 包覆）
  - `reviewer.md`：v1.2 → v1.3（PROPOSAL-021 frontmatter 擴充 + `<section>` 包覆）
  - `consultant.md`：v1.0 → v1.1（PROPOSAL-021 frontmatter 擴充 + `<section>` 包覆 + §s07 `immutable`）
  - `retro.md`：v1.1 → v1.2（PROPOSAL-021 frontmatter 擴充 + `<section>` 包覆）
  - `assistant.md`：v1.1 → v1.2（PROPOSAL-021 frontmatter 擴充 + `<section>` 包覆）
  - `security.md`：v1.0 → v1.1（PROPOSAL-021 frontmatter 擴充 + `<section>` 包覆 + §s02/s07 `immutable`）

### PROPOSAL-021 重構統計

- **新建檔案**：1（`RULES_METADATA_SCHEMA.md`）
- **修改檔案**：13（全部 rules + DESIGN_GUIDE）
- **包覆 `<section>` 總數**：~144 章
- **`priority="critical" immutable="true"` 章節**：8 處（全局阻斷 / 平行審查 / 豁免授權 / 禁止條款 / HITL 升級 / 審查邊界 / 禁止清單 / 系統參數）
- **AlwaysOn 例外文件**：1（`system-prompt.md` 依 Schema §四之一 免 body 版本標頭 + section 標籤）

---

## 維護規則

- **更新時機**：`@Lead` 於每次提案執行合併後立即更新
- **遞增規則**：
  - Major（X.0.0）— 章節結構重組或向下不相容
  - Minor（X.Y.0）— 新增章節或條文
  - Patch 層級不使用（保持兩段版本號足以追蹤）
- **審計基準同步**：`@Retro` 審計完成後更新所有文件的「審計基準版本」為當前版本

## 相關文件

- 版本標頭格式：`.agents/RULES_DESIGN_GUIDE.md` §十一「Rules 文件版本標頭標準」
- 提案更新義務：`.agents/RULES_DESIGN_GUIDE.md` §十二「提案執行後版本更新義務」
- Metadata Schema：`.agents/RULES_METADATA_SCHEMA.md`（PROPOSAL-021 建立）
- Rules 回滾機制：`.agents/rules/retro.md` §「Rules 回滾機制」
