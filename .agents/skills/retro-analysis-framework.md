<!-- MACHINE_READABLE
type: analysis-framework
category: F1
id: retro-analysis-framework
related_proposals: [PROPOSAL_20260424_020]
related_decisions: [ADR-0019, ADR-0020, ADR-0021, ADR-0027]
-->

# Skill: Retro Analysis Framework（@Retro 完整分析框架）

> 由 PROPOSAL_20260424_020 Phase D 建立；F1 類（純通用原則）。
> `rules/retro.md` 保留核心身分 + 觸發條件 + 根因分析 4 層分類；本文為完整操作細則。
> @Retro 產出提案時的操作手冊；行為準則回到 rules/retro.md 對應 section。

---

## 目錄

- §一：歷史提案比對 + 設計意圖衝突偵測（對齊 `rules/retro.md §s04`）
- §二：提案生命週期完整規範（對齊 `rules/retro.md §s06`）
- §三：提案目錄結構規範（對齊 `rules/retro.md §s07`）
- §四：Rules 回滾機制（對齊 `rules/retro.md §s10`）
- §五：定期設計檢視與重大變更量化（對齊 `rules/retro.md §s02` 細則）

---

## 一、歷史提案比對 + 設計意圖衝突偵測

對齊 `rules/retro.md §s04`；@Retro **產出新提案前必先執行**。

### 1.1 比對規則

- 讀取 `.agents/proposals/` 目錄下所有提案（含所有狀態）
- 以「**目標 Agent + 根因分類**」為比對鍵值，計算累計出現次數
- **REJECTED 狀態的提案納入計數**（代表問題曾被評估但未修正，再發更需重視）
- **IN_PROGRESS 狀態的提案不計入已解決**（避免誤判）

### 1.2 反覆問題警告觸發條件

同一 Agent + 同一根因分類，**累計出現第 3 次**時：

1. 在新提案頂部加上 `🚨 反覆問題警告`
2. 提案狀態為 OPEN，但**必須等待 User 明確確認**才可進入 IN_PROGRESS
3. `@Assistant` 巡邏將於下次收斂時自動偵測並產生 🔴 通知（無需手動發出）

### 1.3 設計意圖衝突偵測

除既有「反覆問題偵測」外，@Retro 於起草新提案時**必須**執行（機制見 ADR-0020 提案意圖繼承）：

1. **掃描方式**：讀取 `PROPOSAL_INDEX.md §🔗 提案意圖繼承關係` 表
2. **比對維度**：
   - 本次新提案的「改寫方向」是否與某歷史 DONE 提案的「設計意圖」**相反**？
   - 若是 → 必須於新提案 §七 備註明文標注「意圖繼承」，並於 `PROPOSAL_INDEX.md §🔗` 新增繼承關係條目
3. **違規判定**：若新提案執行後 `PROPOSAL_INDEX.md §🔗` 未新增對應繼承關係 → 視為「設計意圖回退」違規
4. **通知機制**：由 `@Assistant` 巡邏 P-14 偵測並產生 🔴 `PROPOSAL_INTENT_REGRESSION` 通知

### 1.4 IN_PROGRESS 逾時偵測

@Retro 執行歷史比對時，若發現某提案停留 IN_PROGRESS 超過一個任務週期（即上次 Retro 到本次 Retro 之間），自動在該提案頂部標注：

```
⚠️ 提案執行逾時：此提案自 <日期> 起停留 IN_PROGRESS，請 User 確認執行狀態
```

---

## 二、提案生命週期完整規範

對齊 `rules/retro.md §s06`；詳見 ADR-0021。

### 2.1 狀態流程圖

```
OPEN（待審）
  ├─ User 採納 → IN_PROGRESS（@Lead 執行規則更新中）
  │     ├─ @Lead 執行完成 → DONE（套用完成，近期紀錄）
  │     │     └─ 超過 2 個審計週期 → ARCHIVED（歷史歸檔）
  │     └─ 逾時未完成 → ⚠️ 逾時標注，等待 User 確認
  └─ User 拒絕（附原因）→ REJECTED（永久保留，納入歷史比對計數）

或：任何階段可人工標記 CANCELLED（提案廢棄，保留編號佔位）
```

### 2.2 狀態定義

| 狀態          | 說明                                         | 目錄位置     | 下一步                       |
| ------------- | -------------------------------------------- | ------------ | ---------------------------- |
| `OPEN`        | 已產出，等待 User 審查                       | `active/`    | User 採納或拒絕              |
| `IN_PROGRESS` | User 已採納，@Lead 執行中                    | `active/`    | @Lead 完成後改為 DONE        |
| `DONE`        | 規則更新已完成（< 2 個審計週期）             | `completed/` | 超過 2 個週期後改為 ARCHIVED |
| `CANCELLED`   | 提案已廢棄（保留編號佔位；**不可重用**編號） | `completed/` | 無（終態）                   |
| `ARCHIVED`    | 已歸檔（超過 2 個審計週期）                  | `archived/`  | 無（終態）                   |
| `REJECTED`    | User 拒絕採納，附原因永久保留，納入再發計數  | `completed/` | 無（終態）                   |

### 2.3 User 指令格式

**採納**：

```
採納提案 PROPOSAL_YYYYMMDD_NNN
```

**拒絕**：

```
拒絕提案 PROPOSAL_YYYYMMDD_NNN，原因：<一句話說明>
```

### 2.4 Scope 判定 SOP

撰寫提案前**必**先判定 scope（framework / project）；決定儲存位置：

| Scope         | 儲存位置                                                                          | 範例觸發                                                                                              |
| ------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **framework** | `.agents/proposals/active/PROPOSAL_YYYYMMDD_NNN.md`                               | 修改 `rules/*.md` / `skills/*.md` / `tasks/*.md` / `RULES_DESIGN_GUIDE*.md` / generators / validators |
| **project**   | `.agents/workspaces/<project>/proposals/active/<PREFIX>_PROPOSAL_YYYYMMDD_NNN.md` | 修改 `src/` / `data/` / `docs/` / `workspaces/<project>.md` 實值                                      |

**判定 3 步**（依 `RULES_DESIGN_GUIDE.SCOPE §十七.B`）：

1. 列出所有修改檔案路徑
2. 取 path prefix 分類
3. 若跨兩類 → **強制拆分**為 2 份獨立提案；不可混合

**違規攔截**：`proposal-scope-validator.mjs` 於 `run-all.sh` 攔截 scope 與儲存位置不一致。

### 2.5 提案輕重選擇（Full / Lite）

撰寫前**必**先判定：

- **預設 Full**（`skills/templates/rule-update-proposal-full-template.md`）：適用一般變更
- **Lite**（`skills/templates/rule-update-proposal-lite-template.md`）：僅當**全滿足**以下條件
  - 不動 Agent 行為
  - 不跨檔（單檔 + 至多 1 個 INDEX）
  - 不需根因分析
  - LOC diff ≤ 50
  - ≤ 2 phases / ≤ 1 小時

決策樹詳見 `RULES_DESIGN_GUIDE §二十一.B`。

**違規攔截**：Lite 執行中若觸及 Full 條件（如需跨檔）→ 立即中止並改立 Full；`@Reviewer` 審查時拒絕放行違規 Lite。

### 2.6 Pre/Post-Commit 腳本執行 SOP

**原則**：凡動 `proposals/active/` / `proposals/completed/` / `proposals/archived/` 下 `.md` 檔，或動 `rules/*.md` frontmatter `version`，**必**於 commit 前跑對應 generator。

| 動作                                                    | 必跑 generator                                                          |
| ------------------------------------------------------- | ----------------------------------------------------------------------- |
| 新增 / 移動 / 改名 proposal                             | `python3 .agents/scripts/generators/gen-proposal-index.py --write`      |
| 改動 rules/ 或 RULES_DESIGN_GUIDE frontmatter `version` | `python3 .agents/scripts/generators/gen-rules-version-index.py --write` |
| 發布 framework 新版本                                   | `gen-framework-version.mjs --bump minor --proposal <id> --write`        |
| CHANGELOG 新增 [vX.Y] 條目                              | `gen-changelog.mjs --proposal <path> --write`                           |

**檢查機制**（pre-commit hook 自動執行）：

- `run-all.sh` 含 `index_drift` validator（見 ADR-0027 第 3 道防線）
- 偵測 AUTO-GENERATED 區塊與 generator 輸出不一致 → block commit
- 錯誤訊息會指出具體修復指令

**違反後果**：

- Pre-commit block：commit 失敗，需先跑對應 generator
- 重複違反（近 30 天 ≥ 2 次）：由 `periodic-design-review §7.#9 SCRIPT_UNDERUSE` 列入警示

**快速自檢**（任何 commit 前可執行）：

```bash
python3 .agents/tests/index-drift-validator.py
```

---

## 三、提案目錄結構規範

對齊 `rules/retro.md §s07`；三層目錄 + 總索引（見 ADR-0021）；**分為 framework / project 兩層 scope**。

### 3.1 Framework scope（跨專案資產）

```
.agents/proposals/
├── PROPOSAL_INDEX.md       # framework 提案總索引（必維護，由 @Lead）
├── active/                 # 狀態：OPEN / IN_PROGRESS
│   └── PROPOSAL_YYYYMMDD_NNN.md
├── completed/              # 狀態：DONE / CANCELLED / REJECTED
│   └── PROPOSAL_YYYYMMDD_NNN.md
└── archived/               # 狀態：ARCHIVED（超過 2 個審計週期）
    └── PROPOSAL_YYYYMMDD_NNN.md
```

### 3.2 Project scope（隨專案獨立）

```
.agents/workspaces/<project>/proposals/
├── PROPOSAL_INDEX.md       # 該專案提案索引（必維護，由 @Lead）
├── active/
│   └── <PROJECT_PREFIX>_PROPOSAL_YYYYMMDD_NNN.md
├── completed/
│   └── <PROJECT_PREFIX>_PROPOSAL_YYYYMMDD_NNN.md
└── archived/
    └── <PROJECT_PREFIX>_PROPOSAL_YYYYMMDD_NNN.md
```

### 3.3 目錄維護責任

| 動作                                                        | 執行者                                    | 時機                                           |
| ----------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------- |
| `PROPOSAL_INDEX.md` 更新（framework + 各 project 獨立維護） | `@Lead`                                   | 每次提案狀態變更（5 分鐘內）                   |
| `active/` → `completed/` 移動                               | `@Lead`                                   | 提案執行完成時（DONE / CANCELLED / REJECTED）  |
| `completed/` → `archived/` 移動                             | `@Retro`                                  | 審計時，距完成超過 2 個審計週期時批次執行      |
| scope 分類判定                                              | `@Retro`（產出時）+ `@Lead`（採納前複審） | 依 `RULES_DESIGN_GUIDE §十七.B` 3 步機械化流程 |

---

## 四、Rules 回滾機制

對齊 `rules/retro.md §s10`；Rules 修改後偏差的回退路徑。

### 4.1 回滾觸發條件

1. 🔴 **CRITICAL**：Rules 修改導致 Agent 行為出現系統性偏差（連續 ≥ 2 次任務異常）
2. 🟡 **WARNING**：Rules 修改與其他 Rules 產生語意衝突（@Retro 審計或 @Lead 協調時發現）
3. 🟡 **WARNING**：User 明確要求回滾至指定版本

### 4.2 回滾流程（4 步驟）

**Step 1 — 識別**：@Retro 或 @Lead 識別回滾需求，向 User 回報（對齊 ADR-0030 通知分級）：

```
【回滾評估報告】🟡 / 🔴 <一句話摘要>
受影響文件：<文件名>
當前版本：v{x.y}
建議回滾至：v{x.y-1}
回滾原因：<具體描述>
回滾影響：<會失去哪些修改>
```

**Step 2 — User 確認**：User 明確授權後才進入 Step 3。

**Step 3 — 執行回滾**：@Lead 依 `.agents/RULES_VERSION_INDEX.md` 還原 Rules 文件至指定版本，更新版本標頭（修改摘要：「回滾至 v{x.y}，原因：<原因>」）。

**Step 4 — 增量審計**：@Retro 執行增量審計，確認回滾後系統狀態一致。

### 4.3 禁止行為

- **絕對禁止** 未經 User 確認執行任何 Rules 文件回滾
- **絕對禁止** 跳過 @Retro 增量審計直接認為回滾完成
- 回滾操作屬於豁免行為，必須依 `lead.md §豁免授權與記錄機制` 寫入 `AUDIT_HISTORY.md §豁免記錄`

---

## 五、定期設計檢視與重大變更量化

對齊 `rules/retro.md §s02` 細則。

### 5.1 工作對話定義

本框架所有「週期」計量以「**工作對話**」為單位：

- **工作對話**：包含任務派發或執行動作的對話
- **不計入**：純聊天、狀態確認、單純問答、Gate Check 等待 User 確認的對話

此定義與 `assistant.md` 巡邏週期一致。

### 5.2 定期審計 5 觸發條件

| #   | 條件類型           | 量化門檻                                                                                                                |
| --- | ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | 時間週期           | 距上次完整審計已超過 **10 個工作對話**                                                                                  |
| 2   | 提案累積量         | 已執行提案累積 **≥ 5 份**，且本次執行完成後未進行增量審計                                                               |
| 3   | 跨功能模式識別     | 每完成 **3 個功能後**執行跨功能比對                                                                                     |
| 4   | 重大變更後下次對話 | 發生「重大變更」後，下次對話自動觸發增量審計                                                                            |
| 5   | **定期設計檢視**   | 每次定期審計**必須**執行 `tasks/periodic-design-review-workflow.md`：流程繁瑣 / 過度設計檢視 + LLM 可被程式取代作業檢視 |

### 5.3 定期 Judge 派遣（@Auditor）

- `@Auditor` 每 `AUDIT_INTERVAL` 個工作對話自動觸發一次 5 維度 × 15 細項評分
- 與本 @Retro §歷史提案比對機制 形成雙軌：
  - **Retro 內視**：根因分析 + 提案
  - **Auditor 外視**：量化評分 + 趨勢監控
- `@Auditor` 任一維度 < 3.0 → 產 🟡 `AUDIT_QUALITY` 通知 @Retro 提案改善

### 5.4 重大變更量化定義

以下任一情況視為「重大變更」，觸發 @Retro 增量審計：

| 變更類型              | 量化門檻                   |
| --------------------- | -------------------------- |
| Rules 文件新增        | ≥ 1 份新文件               |
| 單份 Rules Token 增加 | ≥ 20%（相較上次審計）      |
| 系統業務功能新增      | 任何新增核心功能           |
| Agent 角色定義變更    | 任何 Persona 或邊界修改    |
| HITL 機制修改         | 任何終止條件或升級條件變更 |

**增量審計範圍**：僅針對發生變更的 Rules 文件及其直接相關的 Rules（上下游 Agent）。

### 5.5 資料收集清單

@Retro 執行前**必須**依序讀取以下文件（有則讀，無則跳過）：

**單次 Retro（即時觸發）**：

- `TEST_REPORT_<功能名稱>.md`
- `REVIEW_REPORT.md`（若本次有 BLOCKER）
- `docs/plans/advice/ADVICE_<功能名稱>.md`（顧問建議的採納狀態）
- `docs/plans/draft_features.md`（對比驗收標準與實際結果）

**跨功能模式識別 Retro（模式識別觸發）**：

- 以上所有文件
- `.agents/proposals/` 目錄下所有狀態的歷史提案（含 OPEN / IN_PROGRESS / ARCHIVED / REJECTED）

---

## 關聯

- `rules/retro.md` — @Retro 核心 rule
- `tasks/proposal-integration-analysis.md` — 整合性 5 階段分析
- `tasks/periodic-design-review-workflow.md` — 定期設計檢視
- `skills/templates/rule-update-proposal-full-template.md` / `-lite-template.md`
- ADR-0019 Proposal Scope Tiering
- ADR-0020 Proposal Intent Inheritance
- ADR-0021 Proposal Lifecycle
- ADR-0027 Script Underuse Prevention

---

**維護紀錄**：

- 2026-04-24：Phase D 建立（PROPOSAL_20260424_020 Phase D 分批執行）
