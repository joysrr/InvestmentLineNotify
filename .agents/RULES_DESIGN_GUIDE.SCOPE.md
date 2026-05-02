---
agent_id: design_guide_scope
agent_name: "Rules Design Guide (SCOPE subset)"
file_type: design_guide_submodule
version: v1.2
last_modified: 2026-04-24
parent: RULES_DESIGN_GUIDE.md
subject: SCOPE
last_proposal: PROPOSAL_20260423_011+PROPOSAL_20260423_013+PROPOSAL_20260423_015
audit_baseline: v1.0
trigger: manual
maintained_by: "@Retro"
content_scope: 範圍治理（版本 / 後續更新 / 文件自維護 / 技術知識分層 / 提案 scope / 文件分層 / 提案輕重）
source_sections: [§十一, §十二, §十五, §十六, §十七, §二十, §二十一]
---

# RULES_DESIGN_GUIDE (SCOPE) — 範圍治理子檔

> 依 PROPOSAL_20260423_011 從 `RULES_DESIGN_GUIDE.md` 拆分。
> 聚焦「範圍治理」：版本標頭 / 提案後更新義務 / 本文件自維護 / 技術知識分層 / 提案 scope / 文件分層 / 提案輕重分級。
> 其他主題見 `RULES_DESIGN_GUIDE.DESIGN.md`（設計形式）/ `RULES_DESIGN_GUIDE.QUALITY.md`（品質與量化）。
> 主文件 `RULES_DESIGN_GUIDE.md` 為 orchestrator。

---

## 十一、Rules 文件版本標頭標準 (Version Header)

依 PROPOSAL-019 建立。所有 `.agents/` Rules 文件必須在第一個章節前包含版本標頭。

### 標頭格式

```
***
版本：v{major}.{minor}
最後修改：{YYYY-MM-DD}
修改提案：{PROPOSAL-XXX}
修改摘要：{一句話描述}
審計基準：v{major}.{minor}
***
```

### 版本號規則

- **major（+1）**：章節結構重組（如 PROPOSAL-015 lead.md 重整）/ Persona 或角色邊界重大調整 / 向下不相容的規則變更
- **minor（+1）**：新增章節或條文 / 修改現有條文語意 / 修正錯誤或補充說明

### 初始版本

所有現有 Rules 首次加入版本標頭時統一標注為 **v1.0**，修改日期為加入版本標頭的日期。

### 禁止行為

- **絕對禁止** Rules 文件缺少版本標頭
- **絕對禁止** 版本號倒退（v1.1 → v1.0）或跨 major 號跳躍（v1.3 → v3.0）

### 版本遞增時的驗證義務

每次提案執行合併前，`@Lead` 必須執行：

1. `node .agents/tests/schema-validator.mjs` — 驗證 frontmatter + XML section + Token 預算
2. 確認退出碼為 0（或僅 1 警告且已評估）；若為 2（錯誤）必須修正後重提
3. 涉及產出物變更 → 同時執行 `artifact-format-validator.mjs`

**絕對禁止** 跳過驗證直接合併；違反由 `@Retro` 於下次審計時標注。

<!-- END: 版本標頭標準 -->

</section>

<section id="s11" priority="normal">

## 十二、提案執行後版本更新義務 (Post-Proposal Update Obligation)

每份提案執行完成後，`@Lead` 在合併前必須執行版本更新：

1. **識別修改範圍** — 本次提案修改的所有 Rules 文件
2. **遞增版本號**：結構性重組 → `major +1`；新增/修改條文 → `minor +1`
3. **更新版本標頭四欄位** — 版本、最後修改、修改提案、修改摘要
4. **同步 `RULES_VERSION_INDEX.md`** — 見 `.agents/RULES_VERSION_INDEX.md`
5. **同步 `.agents/CHANGELOG.md`**— append 本提案對應 `[vX.Y]` 章節的 `### Added / Changed / Fixed / Deprecated / Removed / Security` 區塊
6. **同步 `.agents/FRAMEWORK_VERSION`**— 若觸發 major/minor bump 則更新 `framework_version` / `release_date` / `baseline_proposal` / `proposals_included` / `auditor_baseline` 欄位；僅 patch 時可略過

### Phase E.1 — Rules 結構變更後的 drift_score 回歸驗證

若提案修改 `rules/*.md` 的結構性內容（章節新增 / 拆分 / 合併 / 跨檔案引用更動），執行後必須：

1. 執行 `node .agents/tests/agent-drift-simulator.mjs --mode static`
2. 將新 drift_score 記錄於 `.agents/docs/Reports/AUDIT_HISTORY.md §drift_score 記錄` 表
3. 與拆分前 baseline 比對：

- **drift_score 下降 > 0.05** → 🟡 警示；`@Lead` 於提案 Phase E 評估是否需補強 rules 結構
- **drift_score 下降 > 0.10** → 🔴 阻斷；必須修補後重新驗證才可將提案移至 completed/

4. 若本提案不觸及 rules 結構（僅 skills / tasks / tests / docs 調整）→ Phase E.1 可跳過，但需於提案 §六 驗收明文「drift_score 回歸驗證不適用，理由：<具體說明>」

**適用邊界**：Phase E.1 僅針對 rules/ 結構變更；skills/ 或 tests/ 的內容調整不納入（避免無關提案被強制執行）。

### Phase E 自動化

提案執行 Phase E 同步索引時，可選用 `.agents/scripts/generators/` 取代手動更新：

| 索引                                     | Generator                                                                   | 自動覆蓋程度                              |
| ---------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------- |
| RULES_VERSION_INDEX 版本表               | `gen-rules-version-index.mjs --write`                                       | 100%（執行摘要章節仍手動）                |
| CHANGELOG `[vX.Y]` 條目                  | `gen-changelog.mjs --proposal <path> [--write]`                             | 模板（Notes 段落手動微調）                |
| PROPOSAL_INDEX 統計 / OPEN / IN_PROGRESS | `gen-proposal-index.mjs`                                                    | dry-run 100%（write 模式 Phase G 後啟用） |
| FRAMEWORK_VERSION bump                   | `gen-framework-version.mjs --bump <minor\|major> --proposal <id> [--write]` | 100%                                      |

或一次性執行（自動跑 rules-version + proposal-index）：

```bash
bash .agents/tests/run-all.sh --regenerate-indexes
```

**仍需 @Lead 手動處理**（內容判斷無法自動化）：

- CHANGELOG 「Notes」段落（設計原則 / 對偶說明 / 警告）
- PROPOSAL_INDEX 「§🔗 提案意圖繼承關係表」（從提案 §七.2 撈但語意需 @Lead 確認）
- RULES_VERSION_INDEX 「執行摘要章節」（PROPOSAL_XXX 摘要 + 核心成就 + 預期效益）
- DONE 列表 append（編號 + 標題 + 優先級 + 完成日期 + 執行者）

詳見 `.agents/scripts/generators/README.md`。

### Validator 執行模式

`run-all.sh` 提供 3 種執行模式以平衡速度與覆蓋：

| 模式             | 指令                                               | 用途                                       | 預期時長                          |
| ---------------- | -------------------------------------------------- | ------------------------------------------ | --------------------------------- |
| **full**（預設） | `bash .agents/tests/run-all.sh`                    | 完整檢查；提案執行 / 大改動                | < 30 sec（並行 7 + scripts 序列） |
| **fast**         | `bash .agents/tests/run-all.sh --fast`             | Pre-commit；依 git diff 跳過無關 validator | 通常 < 5 sec                      |
| **single**       | `bash .agents/tests/run-all.sh --validator <name>` | 開發時反覆測試特定 validator               | 通常 < 1 sec                      |

**選擇建議**：

- 提案執行 Phase E 收尾驗證 → 用 **full**（兜底完整覆蓋）
- Pre-commit hook → 建議改用 **fast**（User 自行於 `.git/hooks/pre-commit` 設定；速度提升 90%+）
- 修正特定 validator 失敗 → 用 **single** 反覆測

**Fast 模式注意**：

- Fast 模式為「保守跳過」（漏報優於誤報）；偵測檔案類型不在白名單則跑 sync 兜底
- 完全無變更（罕見情境）→ 跑全部 fallback
- 若 fast 模式漏掉某 validator → 由 提案執行的 full 模式或手動 full 兜底

### 禁止行為

- **絕對禁止** 提案執行合併後對應 Rules 文件的版本標頭未更新；版本標頭更新是提案執行 DoD 的必要項目。
- **絕對禁止**（依 PROPOSAL_025）修改 rules/\*.md 結構後未執行 Phase E.1 drift_score 回歸驗證。
- **絕對禁止**提案執行 Phase E 用 `--fast` 模式驗收（必須 `full` 兜底覆蓋）。

<!-- END: 提案執行後版本更新義務 -->

</section>

<section id="s12" priority="critical" immutable="true">

## 十五、RULES_DESIGN_GUIDE.md 本身的維護規範

本文件由 @Retro 透過 RULE_UPDATE_PROPOSAL 提案維護，禁止直接修改。

### 更新觸發條件

- 系統新增 Rules 時發現規範不足
- Retro 執行時識別出新的高頻設計問題
- 靜態審計報告建議補充新規範項目

### 版本號規則

- Major（X.0.0）：結構性規範變更
- Minor（X.Y.0）：新增規範條目
- Patch（X.Y.Z）：修正說明文字
</section>

<section id="s14" priority="normal">

## 十六、技術知識分層原則

本節為 PROPOSAL_20260422_022 核心產物，確立 `.agents/tech-stacks/` / `.agents/skills/` / `.agents/domains/` 三分法 + tech-stacks 純淨原則。

### A. 三分法定義

| 目錄           | 內容定位                                                                      | 跨專案適用性        | 範例                                                                                    |
| -------------- | ----------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------- |
| `tech-stacks/` | **特定技術的實踐規範與鐵律**（某語言 / 框架 / 平台 / SDK 的使用規範）         | ✅ 跨專案通用       | `nodejs-esm-backend.md` / `vue3-vite.md` / `telegram-bot.md`                            |
| `skills/`      | **技術無關的流程 / 模板 / 產出物 / 跨技術的模式**（不綁定特定技術名稱）       | ✅ 跨專案通用       | `concurrency-guard-pattern.md` / `review-report-template.md` / `consultant-examples.md` |
| `domains/`     | **業務領域知識**（量化投資 / 電商 / SaaS 等領域的概念 / 術語 / 業務規則基礎） | ❌ 僅適用該業務領域 | （依專案業務而建立）                                                                    |

### B. tech-stacks 純淨原則（6 項鐵律）

1. **不得包含專案特定路徑**（如 `src/modules/xxx.mjs` / `data/Strategy.json`）→ 改為 workspace 欄位引用
2. **不得包含專案特定命名**（如 `iln-api` / `useTelegram.js`）→ 改為通用範例 + workspace 引用
3. **不得包含部署平台特定規格**（如 `Oracle VM 24GB` / `ARM 架構`）→ 移至 workspace `DEPLOYMENT_CONSTRAINTS`
4. **必須引用 workspace 欄位而非硬編碼數值**（如網路逾時 / 記憶體上限 / 排程清單）
5. **必須含 §專案特化參照 + MACHINE_READABLE anchor**（格式對齊 PROPOSAL_022 §3.2）
6. **Fallback 策略明文化**（每個 workspace 欄位缺失時的降級行為：阻斷 / 警告 / 略過）

### C. tech-stacks 分類子目錄規則（依 ADR-0031 / PROPOSAL_20260423_017 更新）

**歷史脈絡**：2026-04-22 原設採「統一扁平命名」；2026-04-24 ADR-0031 擴充為「分類子目錄 + MANIFEST 索引」。
原 6 鐵律（§十六.B）**完全有效**；本節只規範 Catalog 結構層。

**6 個 categories**（由 `tech-stacks/MANIFEST.yaml §categories` 定義 SSOT）：

| Category       | 適用                                     | priority |
| -------------- | ---------------------------------------- | -------- |
| `core`         | 幾乎所有專案通用（git / testing 基礎）   | 1        |
| `web-backend`  | 後端服務 / 語言 / 測試框架               | 2        |
| `web-frontend` | Web 前端框架 / 打包工具                  | 2        |
| `desktop`      | 桌面應用 UI（Avalonia / WPF / Electron） | 2        |
| `messaging`    | 即時通訊 / Bot / Mini App                | 3        |
| `storage`      | 資料儲存（檔案 / DB / 快取）             | 2        |

**命名規則**：

- 檔案路徑：`tech-stacks/<category>/<name>.md`（單檔模式）或 `tech-stacks/<category>/<name>/`（資料夾模式）
- 同類內仍用語意前綴分組（例：`messaging/telegram-*.md`）
- 命名衝突加後綴（例：`telegram-miniapp.md` UI 模式 vs `telegram-miniapp-sdk.md` SDK 協定）

### D. MANIFEST.yaml 索引 + 選擇性搬運（ADR-0031）

`tech-stacks/MANIFEST.yaml` 為 Catalog 索引 SSOT，所有新增 / 移除 stack 必同步 MANIFEST。

**欄位**：`name / category / class / file|folder / depends_on / installed / platforms / extends_base? / vendor_source? / vendor_last_vetted?`

**管理 CLI**：`scripts/tech-stack-manage.mjs`

- `list` / `info` / `install <name>` / `remove <name>` / `restore <name>`
- install 自動 DFS 解析依賴；remove 保留 MANIFEST entry（`installed: false`）作為記憶

**Init 互動選擇**：`scripts/init-workspace.mjs` Step 6.5 互動列出 stacks → 使用者選要保留的；未選者可刪檔或僅標記 `installed: false`

**建立模式決策**（`skills/tech-stack-onboarding.md §4`）：

- 規範 < 200 行 + 無 vendor 原文 → 單檔模式 `category/name.md`
- 規範 ≥ 200 行 OR 需引用 vendor 原文 → 資料夾模式 `category/name/`（含 README + SOURCE + upstream/ + adapted/ + CHANGELOG）

**Vendor 安全準則**（防 prompt injection；ADR-0031 §5）：

- LLM 規範唯一權威：我方 `README.md` / `name.md`
- `upstream/` 為 vendor 原文隔離區；**不得**被 rules / skills 引用
- `SOURCE.md` 必填：URL + commit + 日期 + 審核人
- MANIFEST `vendor_last_vetted` 同步填寫；未填時 validator 警告

### E. 三分法違規偵測

以下情況視為三分法違規（由 `@Auditor §2.2` + `@Assistant` 巡邏偵測）：

| 違規類型                                     | 判定               | 處理                                   |
| -------------------------------------------- | ------------------ | -------------------------------------- |
| tech-stacks 含專案特定路徑 / 命名            | 🔴 違反 B 原則 1-2 | `@Retro` 提案清洗；對齊 workspace 欄位 |
| tech-stacks 硬編碼數值（未引用 workspace）   | 🟡 違反 B 原則 3-4 | 同上；補 §專案特化參照                 |
| tech-stacks 缺少 MACHINE_READABLE anchor     | 🟡 違反 B 原則 5   | `@Lead` 補上 anchor                    |
| skills/ 內容含具體技術名稱且為該技術實踐規範 | 🟡 三分法違規      | 應遷移至 tech-stacks/（扁平命名）      |
| 子分類目錄未達 5 份閾值提前建立              | 🟡 違反 D 原則     | 扁平化回退                             |

### F. skills / tasks 專案特化參照原則

skills / tasks 目錄檔案依專案特化引用需求分三類；不同類別適用不同格式要求。延伸 §十六 B（tech-stacks 純淨原則）至 skills / tasks 層。

#### F.1 三態分類定義

| 類別                       | 定義                                            | 判定方法                                         | 格式要求                                                                                                                           |
| -------------------------- | ----------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **F1 純通用模板**          | 不涉及任何專案實值；純結構 / 格式 / 鐵律 / 流程 | 檢視內容無路徑 / 業務命名 / 配置值               | 無需 §專案特化參照；無需 MACHINE_READABLE anchor                                                                                   |
| **F2 通用原則 + 專案特化** | 通用鐵律與專案特定實作位置分離                  | 內容含規則 + 明示「workspace 欄位由 @Lead 注入」 | **必須**含 §專案特化參照 + MACHINE_READABLE anchor（格式同 tech-stacks PROPOSAL_022 §3.2）                                         |
| **F3 純專案特化**          | 完全綁定特定專案業務                            | 全檔內容為專案特定規則 / 路徑 / 命名             | 🔴 **禁止**於 `.agents/skills/` 或 `.agents/tasks/`；應入 workspace 實值欄位或 `workspaces/<project>/`（若未來擴展專案獨立子目錄） |

#### F.2 F2 類標準格式（與 tech-stacks §專案特化參照一致）

於檔案末尾 append 以下區塊：

````markdown
---

<!-- MACHINE_READABLE
type: project-specific-references
schema_version: v1.0
category: F2
skill_or_task: <name>
-->

### G. 框架腳本 Runtime 規範

**完整規範**：見 `.agents/FRAMEWORK_REQUIREMENTS.md`

**核心鐵律**（摘要）：

- 框架腳本語言：**Node.js `.mjs`** + **Bash `.sh`**（僅此二者）
- **絕對禁止** 引入 npm / pip / gem 等外部依賴（含 `package.json`）
- **絕對禁止** 新增 `.py` / `.go` / `.rs` / `.cs` 腳本於 `.agents/scripts/`（例外需提 Full Proposal）
- `.mjs` 只能 `import 'node:*'` 內建模組

**違規偵測**：

```bash
# 檢查第三方 package 引入
grep -rE "^import.*from ['\"](?!node:)" .agents/scripts/ --include="*.mjs"

# 檢查禁語言腳本
find .agents/scripts -type f \( -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.cs" \)
```
````

任一命中 → 🔴 阻斷；詳細處置見 `FRAMEWORK_REQUIREMENTS.md §4`。

## 十七、提案 Scope 分層原則

本節確立「提案 scope 分層治理」核心規範：`.agents/proposals/`（framework）與 `workspaces/<project>/proposals/`（project）二元分層，實現「`.agents/` = 可跨專案搬運的純通用資產」核心意圖。

### A. 兩 Scope 定義

| Scope            | 修改標的                                                                                                                                                                      | 跨專案適用性    | 儲存位置                               | 編號格式                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------- | ---------------------------------------- |
| `framework`      | `.agents/` 底下所有檔案（rules/ / skills/ / tech-stacks/ / domains/ / tasks/ / tests/ / proposals/ 本身結構 / workspaces/README.md + default_env.md + WORKSPACE_SCHEMA.yaml） | ✅ 跨專案通用   | `.agents/proposals/`                   | `PROPOSAL_YYYYMMDD_NNN`                  |
| `project:<name>` | 專案原始碼 / 業務資料 / 專案文檔 / workspace 實值填寫                                                                                                                         | ❌ 僅該專案適用 | `.agents/workspaces/<name>/proposals/` | `<PROJECT_PREFIX>_PROPOSAL_YYYYMMDD_NNN` |

### B. 判定流程（三步機械化）

1. **列出本提案所有修改標的檔案路徑**
2. **取得 path prefix 分類**：

- `.agents/`（排除 `workspaces/<project>.md` 實值填寫）→ **framework**
- `src/` / `data/` / `docs/` / `scripts/` / `tests/` / `workspaces/<project>.md` 實值調整 → **project**

3. **若 prefix 同時涵蓋兩類** → **強制拆分為獨立提案**（禁止混合）

#### 邊界例外說明

- `.agents/workspaces/<project>.md` 的**欄位實值填寫/調整** → `project` scope（綁定特定專案）
- `.agents/workspaces/default_env.md` 的**模板欄位調整** → `framework` scope
- `.agents/WORKSPACE_SCHEMA.yaml` 結構調整 → `framework` scope

### C. 儲存位置與 frontmatter

- **framework** 提案 → `.agents/proposals/{active,completed,archived}/`
- **project** 提案 → `.agents/workspaces/<name>/proposals/{active,completed,archived}/`

所有提案基本資訊（含既有提案回溯補填）必須含 `scope:` 欄位：

```markdown
## 基本資訊

- 提案編號：<PROPOSAL_ID>
- scope：`framework` | `project:<project_name>`
- ...其餘欄位
```

### D. 編號前綴規則

- **framework**：`PROPOSAL_YYYYMMDD_NNN`（不變，對齊 PROPOSAL-016 歷史）
- **project**：`<PROJECT_PREFIX>_PROPOSAL_YYYYMMDD_NNN`（前綴由 workspace frontmatter `proposal_prefix` 定義）
- **前綴規則**：3–5 字母大寫英數；於 workspace frontmatter 定義一次；不可變更（類似 commit hash 不可重寫）
- **編號空間獨立**：framework 與 project 即使同日同序號，因前綴不同不衝突

### E. 違規偵測

| 違規類型                                                                 | 判定                              | 偵測機制                          |
| ------------------------------------------------------------------------ | --------------------------------- | --------------------------------- |
| 缺少 scope 欄位                                                          | 🟡 維度 1 違規                    | `@Auditor §2.2` scope 純度檢查    |
| scope 與儲存位置不一致（例：scope: project 但存於 `.agents/proposals/`） | 🟡 `PROPOSAL_SCOPE_MISCLASSIFIED` | `@Assistant` 巡邏 P-18            |
| 混合 scope 提案未拆分                                                    | 🔴 `@Retro` 產出階段阻斷          | `@Retro` workflow §Scope 判定閘門 |
| project 提案編號缺少前綴                                                 | 🟡 `PROPOSAL_SCOPE_MISCLASSIFIED` | `@Assistant` 巡邏 P-18            |

### F. 跨專案搬運規則

複製 `.agents/` 至新專案時（依 PROPOSAL_002 + 022 意圖延伸）：

1. ✅ **帶走**：`.agents/proposals/`（framework 提案演進史為通用資產）
2. ❌ **不帶走**：`.agents/workspaces/<old_project>/`（含該專案 proposals/）
3. **新專案初始化**（`project-onboarding`）時自動建立：
   `.agents/workspaces/<new_project>/proposals/{active,completed,archived}/`
4. **新專案 workspace frontmatter** 必須自行定義 `proposal_prefix`（新增必填欄位）

### G. 執行時強制機制

PROPOSAL_023 建立本節分層設計；PROPOSAL_015 補執行層強制：

#### G.1 機械性 validator

`.agents/tests/proposal-scope-validator.mjs` 掃：

- `.agents/proposals/{active,completed,archived}/` → 必須 `scope: framework`
- `.agents/workspaces/*/proposals/{active,completed,archived}/` → 必須 `scope: project`
- 違規 → 🔴 exit 1（阻斷 commit）

納入 `run-all.sh` 第 11 個 validator `proposal_scope`（fast-mode 觸發條件含 proposals/\* 變動）。

#### G.2 Generator 雙區支援

`gen-proposal-index.mjs`：

- 預設掃 framework；`--workspace <name>` 掃 project
- 兩個 PROPOSAL_INDEX.md 獨立統計，避免混合

#### G.3 歷史摘要機制

`gen-proposal-summary.mjs` → `.agents/proposals/summaries/SUMMARY_<period>.md`

- 週期：季度或每 20 DONE
- 新專案搬運時 summaries/ 必帶，completed/ 可選
- 新 LLM onboarding 從 25k 行縮至 ~300 行

#### G.4 搬運時處置

詳見 `.agents/FRAMEWORK_REQUIREMENTS.md §6`：

- A 模式（完整）/ B 模式（精簡）/ C 模式（極簡 only summaries）

### H. 意圖繼承聲明

- **PROPOSAL_002 + 006**：Core Soul vs Project Context 分離（workspace 欄位層）
- **PROPOSAL_022**：tech-stacks 純淨分離（知識層）
- **PROPOSAL_023**：proposals 分層治理（紀錄層；設計）
- **PROPOSAL_20260423_015（本節 G）**：執行層強制 + 歷史摘要（落地）

四階段延伸共同落實「`.agents/` = 可跨專案搬運的純通用資產」核心設計意圖。

</section>

<section id="s16" priority="normal">

## 二十、文件分層三原則

本節為 PROPOSAL_20260423_004 核心產物，確立 `.agents/` vs `docs/` 的文件分層規範，防止「`.agents/` = 可跨專案搬運的純通用資產」意圖被污染。與 §十六.F 互補：§十六.F 規範**內容層級**（F1/F2/F3）；本節規範**位置層級**（`.agents/docs/` vs `docs/`）。

### A. 四層定義（依 PROPOSAL_20260424_019 audit #5 後 User 指令擴充）

| 層級                                                  | 位置                                      | 判定準則                                                                                                              | 歸屬      | 搬運性               |
| ----------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------- | -------------------- |
| **L1 Framework 說明**                                 | `.agents/docs/`                           | 通用 AI Agent 規範 / 多專案共享參考                                                                                   | framework | 隨 `.agents/` 搬運   |
| **L2a Framework 運作紀錄（agents 專用；跨專案通用）** | `.agents/docs/Reports/`                   | Framework 級 Agent（`@Auditor` / `@Retro`）產出的**框架自身**稽核 / 評分 / retro 歷史；**屬 agents 專用不隨專案廢棄** | framework | 隨 `.agents/` 搬運   |
| **L2b Framework 運作紀錄（專案實例化）**              | `docs/Reports/` + `docs/DoD_AUDIT_LOG.md` | 在**本專案**實例化運作的歷史（如 GLOBAL_STATUS_SUMMARY / DoD_AUDIT_LOG）；與具體業務綁定                              | 專案特有  | 不隨 `.agents/` 搬運 |
| **L3 專案業務文件**                                   | `docs/` 其他位置                          | 專案業務邏輯 / API / 架構                                                                                             | 專案特有  | 不搬運               |

**L2a vs L2b 判定鐵律（User 2026-04-24 指令）**：

- **L2a 判準**：產出者是 framework agent（`@Auditor` / `@Retro`）且記錄對象是**框架本身**（五維度評分 / 派遣軌跡 / retro 根因分析）→ 歸 `.agents/docs/Reports/`
- **L2b 判準**：記錄對象是**本專案當下狀態 / 運作事件**（任務進度 / DoD 自評 / 業務異常）→ 歸 `docs/Reports/`
- **歷史決策**：2026-04-24 User 指令「AUDIT 文件移入 `.agents/`，因其性質屬 agents 專用」→ `AUDIT_HISTORY.md` / `AUDIT_DECISION_LOG.md` / `RETRO_*.md` 皆為 L2a；`GLOBAL_STATUS_SUMMARY.md` / `DoD_AUDIT_LOG.md` 為 L2b

### B. 判定流程（四步機械化）

```
Step 1：文件是否含「多 Agent 並列 / RULES_DESIGN_GUIDE / AI Agent 品質」等 framework 特徵？
 ├─ 是 → 進入 Step 2
 └─ 否 → L3 專案業務文件 → 歸 docs/

Step 2：文件是否為「Agents 運作結果紀錄」？
 ├─ 否 → L1 Framework 說明 → 歸 .agents/docs/
 └─ 是 → 進入 Step 2.5

Step 2.5：紀錄對象是「框架自身」還是「專案當下狀態」？
 ├─ 框架自身（@Auditor 評分 / @Retro 根因；跨專案通用語彙）→ L2a → 歸 .agents/docs/Reports/
 └─ 專案狀態（任務進度 / 業務異常 / DoD 自評；含專案業務語彙）→ L2b → 歸 docs/Reports/

Step 3：命名與格式對齊
 ├─ L1：英文 kebab-case；禁版本標記；須含「文件分層：framework」標示區塊
 ├─ L2a：語意化 UPPER_SNAKE（如 AUDIT_HISTORY.md）；檔頭註明「framework 跨專案紀錄」
 ├─ L2b：語意化命名；檔頭可含專案上下文
 └─ L3：依專案自訂；建議對齊業務語彙
```

### C. 禁止行為

- **絕對禁止** `.agents/docs/` 或 `.agents/docs/Reports/` 存放專案業務邏輯
- **絕對禁止** `.agents/docs/Reports/` 存放含專案特定命名（如 `InvestmentLineNotify` / `strategyWeight` / 業務檔案路徑）的文件
- **絕對禁止** `docs/` 根目錄或 `docs/Reports/` 存放通用 framework 規範說明（如 AI Agent 品質評鑒表）
- **絕對禁止** `docs/Reports/` 存放 framework 自身稽核紀錄（`AUDIT_*.md` / `RETRO_*.md` 屬 L2a，必歸 `.agents/docs/Reports/`）
- **絕對禁止** 新增 `.agents/docs/*.md` 時缺「文件分層：framework」標示區塊

### D. 違規偵測

由 `.agents/tests/docs-location-validator.mjs` 自動偵測：

| 違規類型                                                    | 判定       | 處理                                              |
| ----------------------------------------------------------- | ---------- | ------------------------------------------------- |
| `docs/` 下含 framework 說明特徵                             | 🔴 error   | 移至 `.agents/docs/`（透過 RULE_UPDATE_PROPOSAL） |
| `docs/Reports/AUDIT_*.md` 或 `docs/Reports/RETRO_*.md` 存在 | 🔴 error   | 移至 `.agents/docs/Reports/`（L2a 歸屬）          |
| `.agents/docs/` 含專案特化命名                              | 🟡 warning | 明文註解「歷史範例」或通用化                      |
| `.agents/docs/Reports/` 含業務語彙                          | 🔴 error   | 移至 `docs/Reports/`（L2b 歸屬）                  |
| `.agents/docs/` 缺分層標示區塊                              | 🟡 warning | `@Lead` 補上                                      |

### E. 與既有規則的關係

- `§十六.F` skills/tasks 三態分類：規範**內容層級**（F1/F2/F3）
- **本節（§二十）**：規範**位置層級**（`.agents/docs/` vs `docs/`）
- 兩者互補，共同達成「`.agents/` 可跨專案搬運」意圖

### F. 意圖繼承聲明

- **PROPOSAL_20260422_022**（tech-stacks 純淨分離）→ 本節延伸至 `docs/` 層
- **PROPOSAL_20260422_023**（提案 scope 分層）→ 本節延伸至文件儲存位置分層
- **PROPOSAL_20260423_001**（skills/tasks 三態分類）→ 本節**類比**（位置分層 vs 內容分層）

</section>

<section id="s19" priority="normal">

## 二十一、提案輕重分級

為降低微型變更（typo / 設定常數 / 路徑更新）立案心理門檻，同時保留中大型變更嚴謹度，本節定義 **Full Proposal**（完整）與 **Lite Proposal**（輕量）兩類提案機制。

### A. 兩類定義

| 類別              | 適用                                     | 模板                                                     | 章節數    | 典型長度 | 撰寫時間 |
| ----------------- | ---------------------------------------- | -------------------------------------------------------- | --------- | -------- | -------- |
| **Full Proposal** | 一般變更（新功能 / 架構調整 / 規則變更） | `skills/rule-update-proposal-template.md`                | §一 ~ §七 | ~400 行  | ~45 min  |
| **Lite Proposal** | 微型變更（typo / 路徑更新 / 設定常數）   | `skills/templates/rule-update-proposal-lite-template.md` | 7 欄必填  | ~70 行   | ~10 min  |

**預設為 Full**；Lite 需全滿足 B.3 排除條件。

### B. 判定決策樹

```
┌─ 會動 Agent 行為？ → YES → Full
│ NO ↓
├─ 會跨 ≥ 2 檔？ → YES → Full
│ NO ↓
├─ 需根因分析 / 權衡判斷？ → YES → Full
│ NO ↓
├─ 變更 LOC > 50？ → YES → Full
│ NO ↓
├─ 需 ≥ 3 phases 執行？ → YES → Full
│ NO ↓
└─ 全前 5 項皆否？ → YES → **Lite**
 NO → Full（保守）
```

**不確定** → Full（由嚴）。

### C. Lite Proposal 標準結構（7 欄必填）

```markdown
---
id: PROPOSAL_YYYYMMDD_NNN
title: <一句話標題>
status: OPEN
tier: lite
scope: framework
date: YYYY-MM-DD
---

# PROPOSAL_YYYYMMDD_NNN: <title>

- **Why**：為何需要此變更（1-2 句）
- **Change**：具體變更點（bullet list）
- **Impact**：影響面（單檔或跨檔；≤2 檔）
- **Rollback**：一句話如何回退
- **Acceptance**：驗收條件（1-3 項）
- **基於**：前置提案 / 觸發事件（§🔗 意圖繼承強制）
- **採納指令**：`採納提案 PROPOSAL_YYYYMMDD_NNN`
```

### D. Lite Proposal Phase 結構

- **Phase A（必選）**：單一變更實作 + 必要驗證
- **Phase B（可選）**：派生同步（INDEX / agents-overview；若無版本變動可省略）

**上限**：≤ 2 phases；≤ 1 小時完成。

### E. Lite Proposal 限制

| 指標           | 硬性上限                     | 超限處置            |
| -------------- | ---------------------------- | ------------------- |
| Phases 數      | 2                            | 升級 Full           |
| LOC diff       | 50 行                        | 升級 Full           |
| 影響檔案數     | 1（+1 可選 INDEX）           | 升級 Full           |
| Agent 行為變更 | 0                            | **絕對不可**走 Lite |
| 執行時間       | ≤ 1 小時                     | 升級 Full           |
| 前置依賴       | 可有；但不可是其他 OPEN Lite | —                   |

### F. 禁止行為（鐵律）

- **絕對禁止** Lite 用於 Agent 行為變更（rules/\* 內容邏輯動）
- **絕對禁止** Lite 跨 ≥ 2 主檔（skills/tasks 同時動算 2 檔）
- **絕對禁止** Lite 省略「基於」欄位（§🔗 意圖繼承不可斷鏈）
- **絕對禁止** Lite 執行中擴充範圍（觸頂立即中止 + 改立 Full）
- **絕對禁止** Lite 跳過 Phase G 索引更新（`gen-proposal-index --write` 強制）

### G. 違規偵測

| 違規類型                            | 判定 | 處理                                       |
| ----------------------------------- | ---- | ------------------------------------------ |
| Lite 但 LOC diff > 50               | 🟡   | @Reviewer 要求升級 Full                    |
| Lite 但 phases > 2                  | 🟡   | 同上                                       |
| Lite 但 Agent 行為變更              | 🔴   | 立即阻斷；重立 Full                        |
| Lite 缺「基於」欄位                 | 🟡   | @Lead 補填                                 |
| 連續 3 個 Lite 提案同一 rules/\* 檔 | 🟡   | periodic-design-review §7 觀察「切細症狀」 |

</section>

---

## Related Decisions

- [ADR-0015](decisions/0015-tech-stacks-purity.md) — Tech-Stacks 純淨原則
- [ADR-0016](decisions/0016-skills-tasks-classification.md) — skills/tasks F1/F2/F3 分類
- [ADR-0017](decisions/0017-document-layering.md) — 文件分層三原則
- [ADR-0019](decisions/0019-proposal-scope-tiering.md) — Proposal Scope 分層
- [ADR-0021](decisions/0021-proposal-lifecycle.md) — 提案生命週期
- [ADR-0022](decisions/0022-rules-metadata-frontmatter.md) — Rules 結構標準化
