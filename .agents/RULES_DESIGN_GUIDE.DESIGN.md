---
agent_id: design_guide_design
agent_name: "Rules Design Guide (DESIGN subset)"
file_type: design_guide_submodule
version: v1.0
last_modified: 2026-04-24
parent: RULES_DESIGN_GUIDE.md
subject: DESIGN
last_proposal: PROPOSAL_20260423_011
audit_baseline: v1.0
trigger: manual
maintained_by: "@Retro"
content_scope: 設計形式（rules 結構 / 模板 / 脈絡 / 約束 / 通知）
source_sections: [§一, §三, §五, §六, §九]
---

# RULES_DESIGN_GUIDE (DESIGN) — 設計形式子檔

> 依 PROPOSAL_20260423_011 從 `RULES_DESIGN_GUIDE.md` 拆分。
> 聚焦「設計形式」：rules 結構 / 模板外部化 / 業務脈絡 / 負面約束 / 通知分級。
> 其他主題見 `RULES_DESIGN_GUIDE.SCOPE.md`（範圍治理）/ `RULES_DESIGN_GUIDE.QUALITY.md`（品質與量化）。
> 主文件 `RULES_DESIGN_GUIDE.md` 為 orchestrator 含目錄 + 專案特化參照 + 相容層。

---

## 一、Rules 標準結構

每份 Rules 必須依以下順序包含六個章節：

1. 任務目標（含業務脈絡三層次）
2. 核心工作流程（含 Agent 呼叫關係）
3. 產出物規範（含格式定義與 DoD 自評）
4. 禁止行為清單（含零容忍條款）
5. HITL 觸發條件（含數值化終止條件）
6. @Assistant 自動化兜底（或等效機制）

章節順序固定，不可省略任何章節。

AlwaysOn 文件（`system-prompt.md`）豁免六章節要求，以精簡為最高原則。

### 結構化 metadata 層

自 PROPOSAL-021 起，所有 Rules 文件除六章節之外，**必須**包含：

1. **YAML Frontmatter**（檔案頂部）— 機器可讀 metadata，依 `.agents/RULES_METADATA_SCHEMA.md` §二
2. **Body `<section>` 標籤**（每個 `##` 章節）— LLM 注意力錨點，依 Schema §三
3. **Body 版本標頭**（H1 之後）— 人類摘要，依本文件 §十一

AlwaysOn 文件例外：依 Schema §四之一，可免 body 版本標頭 + `<section>` 標籤（frontmatter 仍必備）。

---

</section>

<section id="s02" priority="normal">

## 三、模板外部化強制規定

### 規定

所有產出物模板（報告格式、User Story 格式、提案格式、Checklist 格式）一律存放於 `.agents/skills/` 目錄。

Rules 主文件只保留參照路徑，**禁止在 Rules 主文件內嵌入任何模板**。

### 現有模板 Skill 文件索引

| 模板類型                      | 路徑                                                                 | 建立提案              |
| ----------------------------- | -------------------------------------------------------------------- | --------------------- |
| User Story                    | `.agents/skills/templates/user-story-template.md`                    | PROPOSAL-001          |
| Draft Features                | `.agents/skills/templates/draft-features-template.md`                | PROPOSAL-001          |
| TEST_SPEC                     | `.agents/skills/templates/test-spec-template.md`                     | PROPOSAL-001          |
| TEST_REPORT                   | `.agents/skills/templates/test-report-template.md`                   | PROPOSAL-001          |
| REVIEW_REPORT                 | `.agents/skills/templates/review-report-template.md`                 | PROPOSAL-001          |
| RULE_UPDATE_PROPOSAL          | `.agents/skills/rule-update-proposal-template.md`                    | PROPOSAL-001          |
| ADVICE                        | `.agents/skills/templates/advice-template.md`                        | PROPOSAL-001          |
| PENDING_ACTIONS               | `.agents/skills/templates/pending-actions-template.md`               | PROPOSAL_20260422_005 |
| SECURITY_REPORT               | `.agents/skills/templates/security-report-template.md`               | PROPOSAL_20260422_003 |
| GLOBAL_STATUS_SUMMARY         | `.agents/skills/templates/global-status-summary-template.md`         | PROPOSAL_20260422_004 |
| Proposal Integration Analysis | `.agents/skills/templates/proposal-integration-analysis-template.md` | PROPOSAL_20260422_007 |

新增模板時，先確認此索引是否已有對應文件，避免重複建立。

### 產出物範疇（補充於 PROPOSAL_20260422_005）

「產出物」涵蓋兩大類：

1. **開發產出物**：User Story / Draft / Test Spec / Test Report / Review Report / Rule Update Proposal / ADVICE / SECURITY_REPORT
2. **系統維護產出物**：`PENDING_ACTIONS.md` / `GLOBAL_STATUS_SUMMARY.md` / Proposal Integration Analysis

兩類模板一律存放於 `.agents/skills/`。

### 派生視圖同步義務

`.agents/` 為 SSOT（Single Source of Truth）；`.agents/docs/agents-overview.md` 為派生視圖。
所有影響以下項目的提案執行合併前，`@Lead` **必須**檢查 `.agents/docs/agents-overview.md` 是否需同步：

| 觸發條件                                         | 對應 agents-overview 章節                          |
| ------------------------------------------------ | -------------------------------------------------- |
| 新增 / 移除 / 重命名 Agent                       | §1.2（Rules 數量）/ §2.1（名冊）/ §9.2（檔案清單） |
| 巡邏規則 P-XX 增減                               | §4.2（巡邏規則表）                                 |
| 通知分級符號變動                                 | §4.1（5 符號表）                                   |
| `§十四` 參數新增                                 | §7.1（系統參數）                                   |
| Workflow 階段增減                                | §3.1 / §3.2                                        |
| 產出物新增                                       | §9.3（交叉引用表）                                 |
| 新建 rules / skills / tasks / domains 結構層變化 | §1.2 / §5.2                                        |

**執行準則**：

- 需同步 → 於 Phase E 完成 agents-overview 對應章節更新
- 不需同步 → 於提案 §六 驗收標準明文「agents-overview 無需同步，理由：<具體說明>」

**違反判定**：提案執行合併後 agents-overview 未同步且未於驗收標準明文「無需同步」→ `@Auditor` 維度 2.2 自動偵測扣分（依 `skills/auditor-rubric-prompts.md §2.2`）。

---

</section>

<section id="s04" priority="normal">

## 五、業務脈絡三層次規範（通用版，依 PROPOSAL_20260422_002 改寫）

Agent rules 的「任務目標」章節必須以**通用形式**定義三層次，**禁止硬編碼專案名稱或特定技術棧**；專案特定資訊由 workspace 注入。

### Layer 1：系統定位說明（What）

描述 Agent 在**通用軟體開發協作**中保護或負責什麼價值（與專案無關）。

- 優秀範例：「確保後端服務穩定、對外 API 正確且及時回應」
- 不足範例：「負責 InvestmentLineNotify 後端開發」（❌ 硬編碼專案名）

### Layer 2：業務觸發場景（When）

以**觸發模式**描述，不綁定特定業務功能。

- 優秀範例：「當需要新增資料寫入路徑、外部 API 串接、或排程任務時被呼叫」
- 不足範例：「當需要修改 strategyWeight 時被呼叫」（❌ 硬編碼專案變數）

### Layer 3：技術棧錨定（How）

**以動態注入方式描述**，明文指向 workspace 機制，不直接錨定單一技術。

- 優秀範例：「依 `@Lead` 注入之 `TECH_STACK` 執行，並嚴格遵守對應 `tech-stacks/*.md` 之鐵律」
- 不足範例：「Node.js ESM / Oracle VM Free Tier 記憶體限制」（❌ 硬編碼技術環境）

### §五之一：過渡期兼容（v1.x 窗口，2026-Q2 內有效）

PROPOSAL_20260422_002 執行過渡期內，允許以下兩種寫法並存：

- **新式（推薦）**：rules 任務目標引用 `workspace` 注入變數
- **舊式（過渡）**：rules 任務目標暫時保留專案特定內容，但必須在 frontmatter 標注 `project_aware: true` + `migration_target_version: v1.X`

過渡期結束後 `@Retro` 審計時強制全部降為新式；仍保留 `project_aware: true` 者須重新提案說明永久保留理由。

### §五之二：意圖繼承聲明

本章節的「動態注入」設計方向繼承 **PROPOSAL-011**（業務脈絡錨定批次補強，2026-04-21 DONE）的原始意圖——**防止 LLM 產生偏離系統約束的建議**。實作方式由 PROPOSAL-011 的「Rules 硬編碼錨定」調整為 PROPOSAL_20260422_002 + 006 的「workspace 動態注入 + 缺失保守升級」：

- **PROPOSAL-011（歷史）**：Rules 內化專案技術棧，提供 LLM 即時參照
- **PROPOSAL_20260422_002（本期）**：Rules 通用化，專案資訊由 workspace 注入
- **PROPOSAL_20260422_006（本期）**：明文標注意圖繼承；同時新增「workspace 缺失時保守升級」備案，避免意圖失聯

此「意圖繼承」機制由 `PROPOSAL_INDEX.md §🔗 提案意圖繼承關係` 集中維護。

---

</section>

<section id="s06" priority="normal">

## 六、負面約束設計四原則

### 原則一：零容忍條款必須明文聲明

不只說「禁止」，要說「絕對禁止」或「無豁免空間」，讓 LLM 無法推測例外情況。

- 標準語言：「絕對禁止 X，無例外」／「X 屬於零容忍違規，無豁免空間」

### 原則二：跨角色邊界必須正向定義

不只說「不做什麼」，要說「遇到 X 情境必須呼叫 Y Agent」，明確合法的替代路徑。

- 標準語言：「遇到 X 情境，必須呼叫 @Y，不可自行處理」

### 原則三：數值化終止條件優於定性描述

- 正確：「退件 ≥ 2 次 → 強制暫停」
- 不足：「多次退件後 → 考慮暫停」

### 原則四：業務安全邊界優先於技術規範邊界

InvestmentLineNotify 的業務安全禁區（靜默失敗、金鑰暴露、策略參數誤改、initData 驗證缺失）應比通用技術規範（代碼格式、命名慣例）具備更高優先級的禁止條款語言。

---

</section>

<section id="s07" priority="normal">

## 九、通知分級標準 (Notification Classification Standards)

依 PROPOSAL-017 建立全系統統一通知分級，共 **5 個符號**。所有 Agent 向 `@Lead` 的回報必須在標頭行包含對應級別符號。

### 通知分級定義

| 級別     | 符號 | 含義                         | `@Lead` 處理時限     |
| -------- | ---- | ---------------------------- | -------------------- |
| CRITICAL | 🔴   | 需立即處理，可能阻斷系統執行 | 本次對話立即處理     |
| BLOCKED  | ❌   | 執行被阻斷，需要外部解除     | 本次對話立即處理     |
| WARNING  | 🟡   | 需關注，不阻斷但有潛在風險   | 本次對話結束前處理   |
| DONE     | ✅   | 任務 / 項目已完成            | 無需處理，確認即可   |
| INFO     | 🟢   | 資訊性通知，無需立即行動     | 下次巡邏前處理或記錄 |

### 通知格式標準

所有 Agent 向 `@Lead` 的回報**必須**在標頭行包含對應級別符號：

```
【@{Agent} {回報類型}】{級別符號} {簡短描述}
```

**範例**：

- `【@Backend DoD 自評】✅ 任務完成，全數通過`
- `【@Backend DoD 自評】🟡 WARNING：n 項待說明`
- `【@Assistant 巡邏摘要】🔴 CRITICAL：發現高優異常`
- `【@QA 測試回報】❌ BLOCKED：P0 必測失敗，需修正後重測`
- `【@Reviewer 複審報告】✅ 通過（歷經 2 次複審）`

### 符號映射（歷史相容）

以下舊符號在現有 Rules 文件中仍可能出現，對應映射如下：

| 歷史符號   | 映射至     | 備註                                          |
| ---------- | ---------- | --------------------------------------------- |
| ⚠️         | 🟡 WARNING | PROPOSAL-012 DoD 自評機制的「n 項需說明」標記 |
| （無符號） | 🟢 INFO    | 純文字通知視為 INFO 等級                      |

### 設計規範

新增 Rules 或修改回報格式時：

- **絕對禁止** 使用本標準以外的通知符號
- **絕對禁止** 在同一通知中混用兩個以上級別符號（以最高級別為代表）
- 若 Agent 回報需跨越多個級別（例：同時有 🔴 與 🟡），必須**拆分**為多個獨立通知

---

</section>

<section id="s10" priority="normal">

---

## Related Decisions

- [ADR-0001](decisions/0001-stateless-lead-routing.md) — Stateless @Lead Routing 三鐵律
- [ADR-0022](decisions/0022-rules-metadata-frontmatter.md) — Rules 結構標準化
- [ADR-0030](decisions/0030-notification-classification.md) — 通知分級標準
