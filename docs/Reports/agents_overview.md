---
type: report
status: archived
last_updated: 2026-09-10
tags:
  - agents
  - overview
wiki_links: []
---

# 📋 InvestmentLineNotify AI Agents 系統總覽圖表

> **對齊基準**：`.agents/` v1.x（PROPOSAL-021 執行後）
> **文件定位**：視覺化 Workflow / 互動關係 / 阻斷機制的詳細圖解版系統總覽。
> **穩定入口**：簡明版請見 `docs/agents-overview.md`；本文件為互補的深度視覺化版本。
>
> **文件更新歷程**：
>
> - 2026/04/21 v1 建立（10 Agents，PROPOSAL-001~014 基線）
> - 2026/04/21 v2 全面翻修（11 Agents + 1 AlwaysOn = 12 Rules；含 @Security / 平行審查 / P-10~P-11 / 5 級符號 / 提案四狀態三層目錄 / §十四 SSOT / PROPOSAL-021 Schema）

## 一、Agent 角色一覽表

> 11 個執行 Agent + 1 個 AlwaysOn 規則文件 = 12 份 `.agents/rules/` 文件。各 Agent 的角色定位、核心職責、產出文件、唯讀/可寫範圍。

### 1.1 全員總覽（12 份 Rules）

| #   | Rules 檔案         | Agent         | 角色定位               | 核心職責                                                                                              | 主要產出文件                                                                | 可寫範圍            | 唯讀範圍                                                                                    |
| --- | ------------------ | ------------- | ---------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------- |
| 0   | `system-prompt.md` | —（AlwaysOn） | 模式判斷入口           | 每次對話載入；判斷任務模式（Dev/Config/Review/Conversation/Retro）、觸發 `@Lead`、全局緊急阻斷        | （純規則，無產出）                                                          | —                   | 所有規則                                                                                    |
| 1   | `lead.md`          | `@Lead`       | 工作流指揮官           | 接收 User 指令、驅動 Workflow、執行 Gate Check、呼叫各 Agent、派發平行審查                            | `PENDING_ACTIONS.md`（狀態更新）、Gate Check 通知、`PROPOSAL_*.md` 執行採納 | 流程控制、規則更新  | 不直接寫業務程式碼                                                                          |
| 2   | `assistant.md`     | `@Assistant`  | 巡邏與通知管理員       | 巡邏各產出文件、偵測異常、彙整待處理事項至 `PENDING_ACTIONS.md`                                       | `PENDING_ACTIONS.md`                                                        | 通知看板            | 不執行任何業務邏輯                                                                          |
| 3   | `planner.md`       | `@Planner`    | 專案經理（PM）         | 管理功能從 ideas → preplan → draft → finishedplan 的狀態流轉、撰寫 User Story 與驗收標準              | `ideas/preplan/draft/finishedplan_features.md`、`ADVICE_RESPONSE_*.md`      | 計畫文件            | 不寫程式碼                                                                                  |
| 4   | `architect.md`     | `@Architect`  | 系統架構師             | 設計階段產 API 規格與資料結構；收斂階段更新系統文件                                                   | `docs/api/<模組>_api.md`、`docs/architecture.md`、`docs/modules/`           | API Spec、架構文件  | 不寫 `src/` / `webapp/` 實作                                                                |
| 5   | `consultant.md`    | `@Consultant` | 領域顧問（動態化身）   | 從 `domains/*.md` 注入的金融領域視角審查需求、偵測邏輯衝突與多流派矛盾                                | `docs/plans/advice/ADVICE_<功能名稱>.md`                                    | 顧問建議文件        | 不直接修改 `draft_features.md`                                                              |
| 6   | `backend.md`       | `@Backend`    | 後端開發者             | 實作 API 路由、排程任務、量化策略引擎；產出部署指令清單                                               | `src/` 程式碼、單元測試、部署指令清單                                       | `src/`、測試腳本    | 不直接執行伺服器指令                                                                        |
| 7   | `frontend.md`      | `@Frontend`   | 前端開發者             | 實作 Telegram Mini App UI；串接 API；遵守 ThemeParams 與 Telegram WebApp SDK 規範                     | `webapp/` 程式碼、元件測試                                                  | `webapp/`、測試腳本 | 不捏造假資料繞過 API                                                                        |
| 8   | `reviewer.md`      | `@Reviewer`   | 資深程式碼審查員       | 第 6 階段審查程式碼品質（非安全範疇）；動態載入對應 DoD 作為審查基準                                  | `REVIEW_REPORT.md`                                                          | 審查報告            | 不修改任何 `src/` / `webapp/` 程式碼；**絕對禁止**審查 SC-01~10 範疇                        |
| 9   | `security.md`      | `@Security`   | 資訊安全審查員         | 第 6.5 階段依 `skills/security-audit.md §1` SC-01~SC-10 範疇執行資安審查，與 `@Reviewer` **平行派發** | `SECURITY_REPORT.md`                                                        | 資安審查報告        | 不修改任何 `src/` / `webapp/` 程式碼；**絕對禁止**審查程式碼可讀性 / 效能（@Reviewer 範疇） |
| 10  | `qa.md`            | `@QA`         | 品質保證專家           | 介入點一：開發前產 Test Spec（TDD 先行）；介入點二：開發後執行整合與邊界測試                          | `TEST_SPEC_<功能名稱>.md`、`TEST_REPORT.md`                                 | 測試腳本、測試報告  | 不修改 `src/` / `webapp/` 業務邏輯                                                          |
| 11  | `retro.md`         | `@Retro`      | 敏捷教練（進化管理員） | 分析 BLOCKER / Bug 的根因；比對歷史提案識別反覆問題；提議修改 `.agents/` 規則                         | `.agents/proposals/active/PROPOSAL_YYYYMMDD_NNN.md`                         | 提案文件            | 不直接修改任何 `.agents/` 規則文件                                                          |

### 1.2 Agent 分類

| 分類           | 成員                                    | 特徵                                               |
| -------------- | --------------------------------------- | -------------------------------------------------- |
| **協調層**     | `@Lead`、`@Assistant`                   | 流程控制 + 通知管理，不直接產出業務內容            |
| **規劃層**     | `@Planner`、`@Consultant`、`@Architect` | 需求、領域審查、技術設計                           |
| **測試先行層** | `@QA`（介入點一）                       | 在實作前定義 Test Spec（TDD）                      |
| **實作層**     | `@Backend`、`@Frontend`                 | 產出 `src/` / `webapp/` 程式碼                     |
| **平行審查層** | `@Reviewer`、`@Security`                | **互斥範疇、平行派發、共用計數器**（PROPOSAL-020） |
| **驗證層**     | `@QA`（介入點二）                       | 邊界值 + 整合測試                                  |
| **進化層**     | `@Retro`                                | 根因分析 → `.agents/` 規則提案                     |

### 1.3 新增與重大調整歷程

| 時期       | 調整                                               | 依據提案         |
| ---------- | -------------------------------------------------- | ---------------- |
| 基線       | 10 Agents（無 @Security）                          | PROPOSAL-001~014 |
| 2026-04-21 | 新增 `@Security`，與 `@Reviewer` 平行審查          | PROPOSAL-020     |
| 2026-04-21 | 全 13 份 Rules 統一 YAML frontmatter + XML section | PROPOSAL-021     |

### 1.4 動態注入設計的 Agent（6 個）

以下 Agent 的核心行為由 `@Lead` 任務時傳入的外部文件決定，而非硬編碼在 rules 中。這是系統**最關鍵的擴充性設計**——新增領域 / 技術 / 技能不需修改任何 Agent 本體。

| Agent         | 必備注入                                                                 | 條件式注入                                                                                 | 注入決定                                                 |
| ------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `@Consultant` | `domains/*.md`（至少 1 份）                                              | —                                                                                          | 金融領域知識、投資流派邏輯、衝突偵測依據                 |
| `@Backend`    | `tech-stacks/nodejs-esm-backend.md`、`tech-stacks/file-based-storage.md` | `skills/telegram-bot-pattern.md`、`skills/deploy-oracle.md`、`skills/infra-constraints.md` | 程式語言規範、部署流程、資源限制                         |
| `@Frontend`   | `tech-stacks/vue3-vite.md`、`tech-stacks/telegram-mini-app.md`           | `skills/telegram-miniapp-pattern.md`、`skills/infra-constraints.md`                        | 前端框架規範、Telegram Mini App SDK                      |
| `@Reviewer`   | 對應 Agent 的 DoD 章節                                                   | `skills/*.md`（依任務範疇）、`tasks/hotfix-checklist.md`                                   | 非安全範疇的審查 Checklist（動態組合）                   |
| `@QA`         | `tech-stacks/testing-nodejs.md`                                          | 對應 Agent 的 DoD、`skills/*.md`（依任務範疇）                                             | 測試範疇、測試框架規範                                   |
| `@Security`   | `skills/security-audit.md`                                               | `tech-stacks/telegram-mini-app.md`、`tech-stacks/file-based-storage.md`                    | SC-01~SC-10 資安審查項目、Token 時效 / 原子鎖 / 金鑰鐵律 |

**設計優點**：

- 擴充成本低 — 新增文件即可，不修改 rules
- 規範一致性高 — `@Reviewer` / `@QA` / `@Security` 永遠讀最新版 DoD / SC 清單
- 職責清晰度高 — 知識來源單一，可追溯
- 風險可控 — 傳入文件品質決定輸出品質，責任歸屬明確

### 1.5 Rules 文件版本現況（PROPOSAL-021 後）

| 檔案               | 當前版本 | 上次審計基準 | 最近異動提案                 |
| ------------------ | -------- | ------------ | ---------------------------- |
| `system-prompt.md` | v1.2     | v1.0         | PROPOSAL-021                 |
| `lead.md`          | v1.2     | v1.0         | PROPOSAL-021                 |
| `assistant.md`     | v1.2     | v1.0         | PROPOSAL-021                 |
| `planner.md`       | v1.1     | v1.0         | PROPOSAL-021                 |
| `architect.md`     | v1.1     | v1.0         | PROPOSAL-021                 |
| `consultant.md`    | v1.1     | v1.0         | PROPOSAL-021                 |
| `backend.md`       | v1.1     | v1.0         | PROPOSAL-021                 |
| `frontend.md`      | v1.1     | v1.0         | PROPOSAL-021                 |
| `reviewer.md`      | v1.3     | v1.0         | PROPOSAL-021                 |
| `security.md`      | v1.1     | v1.0         | PROPOSAL-021（首次隨同升級） |
| `qa.md`            | v1.3     | v1.0         | PROPOSAL-021                 |
| `retro.md`         | v1.2     | v1.0         | PROPOSAL-021                 |

完整版本索引見 `.agents/RULES_VERSION_INDEX.md`。

---

## 二、完整 Workflow 流程圖

> 從 User 下達指令 → Planner → Consultant → Architect → QA（Test Spec）→ Backend/Frontend → **Reviewer + Security 平行** → QA（Test Report）→ Architect（收斂）→ Planner（完成）→ Retro，標示各 Gate Check 位置。

### 2.1 STEP 0：前置檢查

```
┌─────────────────────────────────────────────────────────────┐
│  User 下達開發指令                                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  @Lead：前置檢查                                              │
│  讀取 PENDING_ACTIONS.md，確認 🔴 區塊為空                    │
│  ❌ 有未處理 🔴 項目 → 拒絕啟動，回覆阻斷通知給 User            │
│  ✅ 無 🔴 項目 → 繼續                                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
```

### 2.2 STEP 1：需求規劃階段

```
╔═════════════════════════════════════════════════════════════╗
║  STEP 1｜需求規劃階段                                         ║
╚═════════════════════════════════════════════════════════════╝
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  @Lead 呼叫 @Planner                                          │
│  • 從 preplan_features.md 選取下一個執行項目                   │
│  • 撰寫 User Story + 驗收標準（Given/When/Then）               │
│  • 標注排除範圍、依賴項目、功能優先級                            │
│  • 產出：draft_features.md（新增功能條目 v1）                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
              ┌───────────────┐
              │ User 確認草案 │ ← Gate Check：需求確認
              └───────┬───────┘
                      │ ✅ 確認
                      ▼
```

### 2.3 STEP 2：戰略審查階段

```
╔═════════════════════════════════════════════════════════════╗
║  STEP 2｜戰略審查階段                                         ║
╚═════════════════════════════════════════════════════════════╝
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  @Lead 呼叫 @Consultant（傳入對應 domains/*.md）               │
│  • 從領域視角審查需求草案的邏輯合理性                            │
│  • 偵測多流派衝突 → 標注 🚨 領域衝突警告 + 要求填寫 strategyWeight│
│  • 偵測未知術語 → 標注 ❓ 未知知識領域                           │
│  • 產出：docs/plans/advice/ADVICE_<功能名稱>.md                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  @Planner 處理顧問建議（閉環 3 種路徑）                         │
│  • 完全採納 → 更新 draft v2，通知 @Lead 繼續                    │
│  • 部分採納 → 更新 draft，產出 ADVICE_RESPONSE_*.md             │
│    └─ 若拒絕 🔴 高風險建議 → 標注 ⚠️ 未採納高風險建議             │
│       （@Assistant P-07 巡邏偵測後產 🔴 CONSULTANT_RISK）      │
│  • 完全拒絕 → 記錄理由，流程繼續                                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
```

### 2.4 STEP 3：架構設計階段

```
╔═════════════════════════════════════════════════════════════╗
║  STEP 3｜架構設計階段                                         ║
╚═════════════════════════════════════════════════════════════╝
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  @Lead 呼叫 @Architect（設計階段，依 S/M/L 動態範疇）          │
│  • 讀取 infra-constraints.md（硬性限制）                       │
│  • 技術依賴審查：缺少 tech-stacks 規範 → 🚧 阻斷通知 → 等 User  │
│  • 產出：docs/api/<模組>_api.md（API Spec）                    │
│  • 定義資料結構（欄位、型別、範例值）                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
```

### 2.5 STEP 4：測試規格先行（TDD）

```
╔═════════════════════════════════════════════════════════════╗
║  STEP 4｜測試規格先行                                         ║
╚═════════════════════════════════════════════════════════════╝
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  @Lead 呼叫 @QA（介入點一）                                    │
│  • 將每個 AC 轉化為具體測試案例                                  │
│  • 標注各 TC 的執行者（@Backend / @Frontend / @QA）             │
│  • 產出：TEST_SPEC_<功能名稱>.md                               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
```

### 2.6 STEP 5：實作階段（可並行）

```
╔═════════════════════════════════════════════════════════════╗
║  STEP 5｜實作階段（可並行）                                    ║
╚═════════════════════════════════════════════════════════════╝
                      │
           ┌──────────┴──────────┐
           ▼                     ▼
┌──────────────────┐   ┌──────────────────────┐
│  @Backend        │   │  @Frontend           │
│  • 參照 API Spec  │   │  • 參照 API Spec      │
│  • 參照 TEST_SPEC │   │  • 參照 TEST_SPEC     │
│  • 撰寫單元測試   │   │  • 撰寫元件測試        │
│  • 產出部署指令清單│   │  • 遵守 ThemeParams   │
│  • DoD 自評 ✅    │   │  • DoD 自評 ✅        │
└────────┬─────────┘   └──────────┬───────────┘
         │                        │
         │  ⚠️ API 規格不符 UI 需求 │
         │  @Frontend 發出退回通知 ──→ @Lead → @Architect 重新設計
         │                        │
         └──────────┬─────────────┘
                    │ 雙方 DoD 自評完成
                    ▼
         ┌──────────────────────┐
         │  @Lead Gate Check    │ ← Gate Check：實作 → 審查
         │  實作 → 審查          │
         └──────────┬───────────┘
                    │
                    ▼
```

### 2.7 STEP 6 + 6.5：平行審查階段（PROPOSAL-020 新機制）

```
╔═════════════════════════════════════════════════════════════╗
║  STEP 6｜程式碼審查階段      ║    STEP 6.5｜資安審查階段     ║
║  （@Reviewer 非安全範疇）    ║    （@Security，條件式觸發） ║
╚═════════════════════════════════════════════════════════════╝
                    │
                    ▼
        @Lead 依 skills/security-audit.md §1 判斷
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
   涉及任一 SC-01~10      皆不涉及 SC
   同時派發 R + S         僅派發 @Reviewer
          │                    │
          ▼                    ▼
┌────────────────────┐  ┌──────────────────┐
│  @Reviewer（第 6）  │  │ @Reviewer 單獨審 │
│  • 程式碼品質      │  │ （跳過 6.5，於    │
│  • 可讀性 / 命名   │  │  REVIEW_REPORT    │
│  • 效能（非安全）  │  │  附註判斷依據）   │
│  • Memory Leak    │  └──────────────────┘
│  • 產 REVIEW_REPORT│
└──────────┬─────────┘
           │                （平行）
           │  ┌────────────────────────┐
           │  │  @Security（第 6.5）     │
           │  │  • SC-01 Token 時效     │
           │  │  • SC-02 金鑰處理       │
           │  │  • SC-03 strategyWeight │
           │  │  • SC-04 資料刪除       │
           │  │  • SC-05 API 授權       │
           │  │  • SC-06 原子鎖/TOCTOU  │
           │  │  • SC-07 Webhook 並發   │
           │  │  • SC-08 錯誤訊息       │
           │  │  • SC-09 第三方套件     │
           │  │  • SC-10 未知範疇       │
           │  │  • 產 SECURITY_REPORT   │
           │  └──────────┬─────────────┘
           │             │
           └──────┬──────┘
                  │
                  ▼
         ┌──────────────────────┐
         │  @Lead 合併報告      │
         │  統一退件清單        │
         │  （不分開退件）      │
         └──────────┬───────────┘
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
   ❌ 有 BLOCKER          ✅ 無 BLOCKER
          │                    │
          ▼                    ▼
  @Backend / @Frontend    @Lead Gate Check
  一次性修正              審查 → 測試
  重送審（雙方同時派發）
  複審次數計入
  REVIEW_CYCLE_LIMIT（共用）
          │
          ▼
  達上限（預設 2）
  @Assistant 自動偵測：
    P-01（未通過方：🔴 REVIEW_QUALITY）
    P-11（未通過方：🔴 SECURITY_AUDIT_FAIL）
  阻斷新功能
```

**平行審查四層防線**（對齊 `lead.md §平行審查與衝突仲裁規則`）：

| 防線       | 機制             | 執行方式                                                                                |
| ---------- | ---------------- | --------------------------------------------------------------------------------------- |
| 1 職責互斥 | 明文切分範疇     | `@Security` 專屬 SC-01~10；`@Reviewer` 專屬程式碼品質 / 效能（未涉安全）                |
| 2 平行派發 | 絕對禁止序列派發 | `@Lead` 同時派發 `@Reviewer` + `@Security`，避免先後退件循環                            |
| 3 衝突仲裁 | 安全優先原則     | 安全 vs 可讀性：`@Security` 優先；安全 vs 效能：`@Security` 優先，但需提供 3 個緩解方案 |
| 4 共用計數 | 單點配置         | `REVIEW_CYCLE_LIMIT`（§十四，預設 2）兩方共用；修改 §十四 即套用                        |

**越界處理**：任一方審對方專屬範疇 → `@Lead` 判定該項**無效**，不計入 BLOCKER，通知越界方撤回。

### 2.8 STEP 7：QA 驗證測試

```
╔═════════════════════════════════════════════════════════════╗
║  STEP 7｜QA 測試階段                                          ║
╚═════════════════════════════════════════════════════════════╝
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  @Lead 呼叫 @QA（介入點二）                                    │
│  • 確認開發者已完成自身 DoD 測試覆蓋（否則退回補齊）              │
│  • 執行 QA 負責的測試項目（邊界值、整合、靜默失敗等）             │
│  • 產出：TEST_REPORT.md                                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
   ❌ 有未解決 Bug            ✅ 全數通過
          │                       │
          ▼                       ▼
  開發者修正後重測          @Lead Gate Check
  （最多重測 QA_RETEST      測試 → 收斂
   _LIMIT = 3 次）                │
  超過上限 → 🔴 QA_QUALITY         │
  @Assistant P-02 偵測            │
  阻斷新功能                       ▼
```

### 2.9 STEP 8：收斂階段

```
╔═════════════════════════════════════════════════════════════╗
║  STEP 8｜收斂階段                                             ║
╚═════════════════════════════════════════════════════════════╝
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│  @Lead 呼叫 @Architect（收斂階段）                             │
│  • 更新 docs/architecture.md                                  │
│  • 更新 docs/modules/ 受影響模組文件                            │
│  • 確認 Mermaid 流程圖與系統一致                                │
│  • 產出 Artifact Confirmation 清單                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
              ┌───────────────┐
              │ User 確認清單 │ ← Gate Check：收斂 → 進化
              └───────┬───────┘
                      │ ✅ 全部確認
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  @Lead 發出收斂完成信號                                        │
│  @Planner 將功能從 draft_features.md                          │
│           移入 finishedplan_features.md                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
```

### 2.10 STEP 9：進化階段

```
╔═════════════════════════════════════════════════════════════╗
║  STEP 9｜進化階段                                             ║
╚═════════════════════════════════════════════════════════════╝
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  @Lead 呼叫 @Retro                                            │
│  • 分析 REVIEW_REPORT / SECURITY_REPORT / TEST_REPORT 根因   │
│  • 比對歷史提案，偵測反覆問題（第 3 次 → 🚨 反覆問題警告）        │
│  • 產出：.agents/proposals/active/PROPOSAL_YYYYMMDD_NNN.md    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  @Lead 呼叫 @Assistant 巡邏                                   │
│  • 掃描所有產出文件，依 P-01 ~ P-11 偵測異常                    │
│  • 更新 PENDING_ACTIONS.md（5 級符號分級）                     │
│  • 自動關閉條件已消失的通知                                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
              ┌───────────────┐
              │  等待下一個    │
              │  User 開發指令 │
              └───────────────┘
```

### 2.11 Gate Check 位置彙整

| Gate 名稱     | 位置            | 觸發者  | 通過條件                                                      |
| ------------- | --------------- | ------- | ------------------------------------------------------------- |
| `需求確認`    | STEP 1 後       | User    | User 確認 User Story 與 AC                                    |
| `實作 → 審查` | STEP 5 後       | `@Lead` | Backend + Frontend DoD 自評全數通過                           |
| `審查 → 測試` | STEP 6 + 6.5 後 | `@Lead` | REVIEW_REPORT + SECURITY_REPORT（若觸發）**合併**後無 BLOCKER |
| `測試 → 收斂` | STEP 7 後       | `@Lead` | TEST_REPORT 全數通過                                          |
| `收斂 → 進化` | STEP 8 後       | User    | User 確認 Artifact Checklist                                  |

### 2.12 10 階段派發順序總覽

| #       | 階段                   | 呼叫 Agent                               | 重點動作                                                                             |
| ------- | ---------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| 0       | 前置檢查               | `@Lead`                                  | 確認 `PENDING_ACTIONS.md` 🔴 區塊為空                                                |
| 1       | 需求                   | `@Planner`                               | 寫入 `draft_features.md`                                                             |
| 2       | 戰略審查               | `@Consultant`                            | 附 `domains/*.md` 作 Context；若提出 🔴 風險，必強制呼叫 `@Planner` 讀取 ADVICE 整合 |
| 3       | 設計                   | `@Architect`                             | 產 API 規格（依 §「動態範疇機制」S/M/L 調整深度）                                    |
| 4       | 測試規格               | `@QA`（介入點一）                        | 依技術規格產 Test Spec                                                               |
| 5       | 實作                   | `@Backend` / `@Frontend`                 | 附 `.agents/tasks/` 對應模板                                                         |
| 6       | 審查                   | `@Reviewer`                              | 退件重修或通過進下一階段                                                             |
| **6.5** | **資安審查（條件式）** | **`@Security`**                          | **依 `skills/security-audit.md §1` SC-01~10 判斷；與第 6 平行派發**                  |
| 7       | 驗證                   | `@QA`（介入點二）                        | 邊界值 + 整合測試                                                                    |
| 8       | 收斂                   | `@Architect` + `@Planner` + `@Assistant` | `@Architect` 更新 `docs/`、`@Planner` 標記完成、`@Lead` 必呼叫 `@Assistant` 執行巡邏 |
| 9       | 進化                   | `@Retro`                                 | 產規則提案至 `.agents/proposals/active/`；暫停動作提示 User 審查                     |

---

## 三、Agent 互動關係圖

> 誰可以呼叫誰、誰可以退回誰、通知路徑（一律透過 @Lead）。

### 3.1 呼叫關係（誰可以呼叫誰）

```
User
 │
 └──→ @Lead（唯一接收 User 指令的 Agent）
         │
         ├──→ @Assistant（每次任務完成後巡邏）
         ├──→ @Planner（需求規劃 / 收斂完成後移動狀態）
         ├──→ @Consultant（傳入 domains/*.md）
         ├──→ @Architect（設計階段 / 收斂階段）
         ├──→ @QA（介入點一：Test Spec / 介入點二：Test Report）
         ├──→ @Backend（實作階段）
         ├──→ @Frontend（實作階段）
         ├──→ @Reviewer（審查階段：非安全範疇）
         ├──→ @Security（資安審查階段：SC-01~10 條件觸發，與 @Reviewer 平行派發）
         └──→ @Retro（進化階段）
```

> **原則**：所有 Agent 只與 `@Lead` 溝通，**絕對禁止 Agent 直接呼叫另一個 Agent**。跨 Agent 的訊息傳遞（例如 @Frontend 退回 API 給 @Architect、@Reviewer 與 @Security 之間的衝突仲裁）一律透過 `@Lead` 轉達。

### 3.2 退回關係（誰可以退回給誰）

```
@Consultant ──退件→ @Planner（透過 @Lead）
              └─ 觸發：ADVICE 含 🔴 重大風險或 🚨 領域衝突
              └─ 閉環：@Planner 必出 ADVICE_RESPONSE_*.md（完全採納 / 部分採納 / 完全拒絕）

@Architect ──退件→ @Planner（透過 @Lead）
             └─ 觸發：技術依賴缺失或需求無法在現有架構實作

@Frontend ──退回 API 規格→ @Architect（透過 @Lead）
             └─ 觸發：API Spec 無法滿足 UI 需求
             └─ 超時：P-08 🟡 FRONTEND_API_BLOCK

@Reviewer ──退件→ @Backend / @Frontend（透過 @Lead）
             └─ 觸發：REVIEW_REPORT 含 🔴 [BLOCKER]（非安全範疇）
             └─ 上限：REVIEW_CYCLE_LIMIT（2，與 @Security 共用）
             └─ 超限：P-01 🔴 REVIEW_QUALITY

@Security ──退件→ @Backend / @Frontend（透過 @Lead，與 @Reviewer 合併為「統一退件清單」）
             └─ 觸發：SECURITY_REPORT 含 🔴 [BLOCKER]（SC-01~10 範疇）
             └─ 上限：REVIEW_CYCLE_LIMIT（2，與 @Reviewer 共用）
             └─ 超限：P-11 🔴 SECURITY_AUDIT_FAIL
             └─ 衝突仲裁（對齊 lead.md §平行審查）：
                · 安全 vs 可讀性 → @Security 優先
                · 安全 vs 效能 → @Security 優先 + 提供 3 個緩解方案

@QA ──退回→ @Backend / @Frontend（透過 @Lead）
      └─ 觸發：TEST_REPORT 含未解決 Bug
      └─ 觸發（前置）：開發者未完成自身 DoD 測試覆蓋
      └─ 上限：QA_RETEST_LIMIT（3）
      └─ 超限：P-02 🔴 QA_QUALITY
```

**重要變更**（PROPOSAL-020 後）：

- `@Reviewer` 與 `@Security` 為**平行審查**關係，退件由 `@Lead` **合併**為「統一退件清單」，`@Backend` / `@Frontend` **一次性修正**所有問題後重送審
- 絕對禁止 `@Lead` 序列派發 `@Reviewer` → `@Security`（避免先後退件循環）
- 絕對禁止 `@Reviewer` 與 `@Security` 直接跨 Agent 互動，衝突必須經 `@Lead` 仲裁

### 3.3 通知路徑（產出 → @Assistant 偵測）

所有 Agent 完成任務後，**不需要手動發出通知**，`@Assistant` 透過巡邏規則表自動偵測各產出文件的狀態（P-01~P-11）：

```
@Reviewer 產出 REVIEW_REPORT.md
    └─ @Assistant 巡邏 P-01：複審 ≥ REVIEW_CYCLE_LIMIT（2）仍有 BLOCKER → 🔴 REVIEW_QUALITY
    └─ @Assistant 巡邏 P-09：標記 Hotfix 且收斂文件尚未更新 → 🟡 HOTFIX_DOC_PENDING

@Security 產出 SECURITY_REPORT.md（PROPOSAL-020 新增）
    └─ @Assistant 巡邏 P-11：複審 ≥ REVIEW_CYCLE_LIMIT（2）仍有 BLOCKER（與 P-01 共用計數）→ 🔴 SECURITY_AUDIT_FAIL

@QA 產出 TEST_REPORT.md
    └─ @Assistant 巡邏 P-02：重測 ≥ QA_RETEST_LIMIT（3）仍有 Bug → 🔴 QA_QUALITY

@Retro 產出 PROPOSAL_*.md（狀態 OPEN）
    └─ @Assistant 巡邏 P-05：新提案待審 → 🟡 RETRO_PROPOSAL
    └─ @Assistant 巡邏 P-04：含 🚨 反覆問題警告 → 🔴 RETRO_REPEAT
    └─ @Assistant 巡邏 P-03：IN_PROGRESS 超過一個任務週期 → 🟡 RETRO_TIMEOUT

@Consultant 產出 ADVICE_*.md
    └─ @Assistant 巡邏 P-06：含 🚨 領域衝突警告且 strategyWeight 未填 → 🔴 CONSULTANT_CONFLICT
    └─ @Assistant 巡邏 P-07：含 ⚠️ 未採納高風險建議 → 🔴 CONSULTANT_RISK

@Frontend 發出 API 退回通知
    └─ @Assistant 巡邏 P-08：超過一個任務週期未回應 → 🟡 FRONTEND_API_BLOCK

@Lead 豁免授權記錄（PENDING_ACTIONS.md 豁免區塊）
    └─ @Assistant 巡邏 P-10：未歸檔豁免記錄 ≥ EXEMPTION_AUDIT_THRESHOLD（5 筆）→ 🟡 EXEMPTION_ACCUMULATED
```

### 3.4 文件所有權對應表

每份文件只有一個負責產出的 Agent，其他 Agent 只能讀取：

| 文件 / 目錄                                                                                    | 產出者                   | 可讀取者                                                 |
| ---------------------------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------- |
| `PENDING_ACTIONS.md`                                                                           | `@Assistant` / `@Lead`   | 全體                                                     |
| `ideas/preplan/draft/finishedplan_features.md`                                                 | `@Planner`               | 全體                                                     |
| `docs/plans/advice/ADVICE_*.md`                                                                | `@Consultant`            | `@Planner`、`@Lead`、`@Assistant`                        |
| `ADVICE_RESPONSE_*.md`                                                                         | `@Planner`               | `@Consultant`、`@Lead`                                   |
| `docs/api/<模組>_api.md`                                                                       | `@Architect`             | `@Backend`、`@Frontend`、`@Reviewer`、`@Security`、`@QA` |
| `docs/architecture.md` / `docs/modules/`                                                       | `@Architect`（收斂階段） | 全體                                                     |
| `TEST_SPEC_*.md`                                                                               | `@QA`                    | `@Backend`、`@Frontend`、`@Lead`                         |
| `TEST_REPORT.md`                                                                               | `@QA`                    | `@Lead`、`@Assistant`、`@Retro`、`@Planner`              |
| `REVIEW_REPORT.md`                                                                             | `@Reviewer`              | `@Lead`、`@Assistant`、`@Retro`、`@Backend`、`@Frontend` |
| `SECURITY_REPORT.md`                                                                           | `@Security`              | `@Lead`、`@Assistant`、`@Retro`、`@Backend`、`@Frontend` |
| `.agents/proposals/active/*.md`                                                                | `@Retro`                 | `@Lead`、`@Assistant`、User                              |
| `.agents/proposals/completed/*.md`                                                             | `@Lead`（移動時）        | `@Lead`、`@Assistant`、`@Retro`、User                    |
| `.agents/proposals/archived/*.md`                                                              | `@Retro`（歸檔時）       | 全體                                                     |
| `src/`                                                                                         | `@Backend`               | `@Reviewer`、`@Security`、`@QA`                          |
| `webapp/`                                                                                      | `@Frontend`              | `@Reviewer`、`@Security`、`@QA`                          |
| `.agents/rules/*.md`                                                                           | `@Lead`（提案執行後）    | 全體                                                     |
| `.agents/RULES_*.md`（`RULES_DESIGN_GUIDE` / `RULES_METADATA_SCHEMA` / `RULES_VERSION_INDEX`） | `@Lead`（提案執行後）    | 全體                                                     |

---

## 四、阻斷機制對應表

> 11 條巡邏規則（P-01 ~ P-11）× 觸發來源 × 嚴重程度 × 阻斷新功能與否 × User 解除指令格式

### 4.1 P-01 ~ P-11 巡邏規則完整對應

依 `.agents/rules/assistant.md §巡邏規則`，所有門檻值引用 `RULES_DESIGN_GUIDE.md §十四 系統參數配置` 之 SSOT。

| 巡邏 ID  | 掃描目標文件                               | 偵測條件                                                                                                     | 通知類型                    | 嚴重程度 | 阻斷新功能 | User 解除指令                                                                                                              |
| -------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | --------------------------- | -------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| P-01     | `REVIEW_REPORT.md`                         | 審查結論為退件，且同功能**複審 ≥ `REVIEW_CYCLE_LIMIT`**（§十四，預設 2）；**與 P-11 共用計數**               | `REVIEW_QUALITY`            | 🔴       | ✅         | `重新評估實作方案 <功能名稱>`                                                                                              |
| P-02     | `TEST_REPORT.md`                           | 測試結論為未通過，且同功能**重測 ≥ `QA_RETEST_LIMIT`**（§十四，預設 3）                                      | `QA_QUALITY`                | 🔴       | ✅         | `重新評估需求範圍 <功能名稱>`                                                                                              |
| P-03     | `.agents/proposals/*.md`                   | 狀態為 `IN_PROGRESS`，且距上次 Retro 執行後超過一個「任務週期」未更新（週期定義見 `retro.md §工作對話定義`） | `RETRO_TIMEOUT`             | 🟡       | ❌         | `繼續執行提案 PROPOSAL_YYYYMMDD_NNN` 或 `拒絕提案 PROPOSAL_YYYYMMDD_NNN，原因：<說明>`                                     |
| P-04     | `.agents/proposals/*.md`                   | 狀態為 `OPEN`，且文件頂部含 `🚨 反覆問題警告`                                                                | `RETRO_REPEAT`              | 🔴       | ✅         | `採納提案 PROPOSAL_YYYYMMDD_NNN`                                                                                           |
| P-05     | `.agents/proposals/*.md`                   | 狀態為 `OPEN`（任何新提案）                                                                                  | `RETRO_PROPOSAL`            | 🟡       | ❌         | `採納提案 PROPOSAL_YYYYMMDD_NNN` 或 `拒絕提案 PROPOSAL_YYYYMMDD_NNN，原因：<說明>`                                         |
| P-06     | `docs/plans/advice/ADVICE_*.md`            | 含 `🚨 領域衝突警告`，且 `strategyWeight` 欄位為空或未填                                                     | `CONSULTANT_CONFLICT`       | 🔴       | ✅         | 直接在 `ADVICE_*.md` 填寫 `strategyWeight: { <領域A>: 0.X, <領域B>: 0.X }`，填寫完成後回覆 `已填寫 strategyWeight，請繼續` |
| P-07     | `docs/plans/advice/ADVICE_*.md`            | 含 `⚠️ 未採納高風險建議`                                                                                     | `CONSULTANT_RISK`           | 🔴       | ✅         | `確認接受風險 <ADVICE_*.md 檔名>` 或 `退回修改需求 <功能名稱>`                                                             |
| P-08     | `docs/api/*.md` 或任何架構文件             | `@Frontend` 正式發出 API 規格退回請求，且超過一個任務週期未回應                                              | `FRONTEND_API_BLOCK`        | 🟡       | ❌         | `確認 API 規格修改 <模組名稱>`                                                                                             |
| P-09     | `REVIEW_REPORT.md`                         | 標記為 Hotfix 且收斂文件尚未更新的項目                                                                       | `HOTFIX_DOC_PENDING`        | 🟡       | ❌         | （更新收斂文件後，`@Assistant` 自動關閉）                                                                                  |
| **P-10** | **`PENDING_ACTIONS.md` §「豁免記錄」區塊** | **未歸檔豁免記錄 ≥ `EXEMPTION_AUDIT_THRESHOLD`（§十四，預設 5 筆）；對齊 `lead.md §豁免累積警示`**           | **`EXEMPTION_ACCUMULATED`** | **🟡**   | **❌**     | **`執行豁免審計`**                                                                                                         |
| **P-11** | **`SECURITY_REPORT.md`**                   | **審查結論為退件，且同功能複審 ≥ `REVIEW_CYCLE_LIMIT`（§十四，預設 2）；與 P-01 共用計數（PROPOSAL-020）**   | **`SECURITY_AUDIT_FAIL`**   | **🔴**   | **✅**     | **`重新評估實作方案 <功能名稱>`**                                                                                          |

### 4.2 PROPOSAL-020 新增巡邏（相對 v1 變更）

| 巡邏 ID | 新增原因                                                             | 設計要點                                                               |
| ------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| P-10    | 系統級豁免記錄規範（PROPOSAL-013）+ 系統參數單點配置（PROPOSAL-020） | 觸發 `@Retro` 豁免審計，防止豁免記錄長期堆積                           |
| P-11    | `@Security` 角色導入（PROPOSAL-020）                                 | 與 P-01 **共用 `REVIEW_CYCLE_LIMIT`** 計數器；兩方同時退件同時產雙通知 |

### 4.3 共用計數器設計（PROPOSAL-020 防線 4）

P-01（`@Reviewer`）與 P-11（`@Security`）**共用**一個計數器：

```
第 1 次平行審查
  ├─ @Reviewer 退件（BLOCKER） → 計數 +1
  └─ @Security 退件（BLOCKER） → 不再額外 +1（同一輪平行審查）
計數 = 1

第 2 次平行審查（達 REVIEW_CYCLE_LIMIT = 2）
  ├─ @Reviewer 通過 ✅，@Security 仍有 BLOCKER
  │    → 僅 P-11 觸發 🔴 SECURITY_AUDIT_FAIL
  ├─ @Reviewer 仍有 BLOCKER，@Security 通過 ✅
  │    → 僅 P-01 觸發 🔴 REVIEW_QUALITY
  └─ 兩方皆未通過
       → P-01 + P-11 **同時產生雙通知**
```

### 4.4 五級阻斷符號（PROPOSAL-017 通知分級標準）

依 `.agents/RULES_DESIGN_GUIDE.md §九`，全系統統一 5 個通知符號。所有 Agent 向 `@Lead` 的回報必須在標頭行包含對應級別符號。

| 級別     | 符號 | 含義                         | `@Lead` 處理時限     | 數量（本系統）                             |
| -------- | ---- | ---------------------------- | -------------------- | ------------------------------------------ |
| CRITICAL | 🔴   | 需立即處理，可能阻斷系統執行 | 本次對話立即處理     | 6 條（P-01、P-02、P-04、P-06、P-07、P-11） |
| BLOCKED  | ❌   | 執行被阻斷，需外部解除       | 本次對話立即處理     | 依任務發生時觸發                           |
| WARNING  | 🟡   | 需關注，不阻斷但有潛在風險   | 本次對話結束前處理   | 5 條（P-03、P-05、P-08、P-09、P-10）       |
| DONE     | ✅   | 任務 / 項目已完成            | 無需處理，確認即可   | DoD 自評完成等                             |
| INFO     | 🟢   | 資訊性通知，無需立即行動     | 下次巡邏前處理或記錄 | 純文字通知                                 |

### 4.5 歷史符號映射（相容性保留）

| 歷史符號   | 映射至     | 備註                                          |
| ---------- | ---------- | --------------------------------------------- |
| ⚠️         | 🟡 WARNING | PROPOSAL-012 DoD 自評機制的「n 項需說明」標記 |
| （無符號） | 🟢 INFO    | 純文字通知視為 INFO 等級                      |

### 4.6 通知格式標準

所有 Agent 向 `@Lead` 的回報**必須**在標頭行包含對應級別符號：

```
【@{Agent} {回報類型}】{級別符號} {簡短描述}
```

**範例**：

- `【@Backend DoD 自評】✅ 任務完成，全數通過`
- `【@Security 審查完成】🔴 CRITICAL：SC-06 原子鎖 TOCTOU 漏洞`
- `【@Reviewer 複審報告】✅ 通過（歷經 2 次複審）`
- `【@QA 測試回報】❌ BLOCKED：P0 必測失敗，需修正後重測`
- `【@Assistant 巡邏摘要】🔴 CRITICAL：P-11 SECURITY_AUDIT_FAIL 觸發`

### 4.7 阻斷通知標準格式

當 `@Lead` 因 🔴 項目拒絕啟動新功能時，回覆格式如下：

```
🚫 新功能啟動已阻斷

原因：PENDING_ACTIONS.md 存在以下未處理的 🔴 項目：
- [BLOCK_001] <通知類型>：<說明>

請先處理以上項目後，再重新下達開發指令。
處理指令：<對應的 User 標準指令格式>
```

### 4.8 自動關閉機制

`@Assistant` 在每次巡邏結束後，對所有「未關閉的 🔴 / 🟡」項目執行反向檢查：

```
對每筆未關閉通知：
  重新檢查原始偵測條件是否仍成立？
  → 條件已消失：自動關閉，移至「最近已處理」，記錄「條件消失，@Assistant 自動關閉」
  → 條件仍成立：保留不動
```

**自動關閉典型情境**：

- P-06：User 已在 `ADVICE_*.md` 填寫 `strategyWeight` → 自動關閉 `CONSULTANT_CONFLICT`
- P-09：`@Architect` 已更新收斂文件 → 自動關閉 `HOTFIX_DOC_PENDING`
- P-05：User 已採納或拒絕提案 → 自動關閉 `RETRO_PROPOSAL`
- P-10：`@Retro` 已執行豁免審計，豁免記錄歸檔 → 自動關閉 `EXEMPTION_ACCUMULATED`
- P-01 / P-11：複審通過或重新評估實作 → 自動關閉 `REVIEW_QUALITY` / `SECURITY_AUDIT_FAIL`

### 4.9 重複偵測防呆

同一來源文件的同一條件，在同一功能週期內**只寫入一次**。判斷方式：`PENDING_ACTIONS.md` 中已存在相同 `type` + 相同 `ref` 的未關閉項目時，跳過不重複新增。

### 4.10 全局緊急阻斷（system-prompt.md）

除 P-01~P-11 外，`system-prompt.md §全局緊急阻斷`（priority="critical" immutable）定義三類全局阻斷條件：

| 條件   | 觸發                                                                              | 動作                                             |
| ------ | --------------------------------------------------------------------------------- | ------------------------------------------------ |
| 條件一 | 安全邊界觸碰（strategyWeight 未經流程直改、資料刪除未經授權、金鑰硬寫等）         | 立即停止所有動作，回覆 `🔴 全局緊急阻斷：<條款>` |
| 條件二 | `PENDING_ACTIONS.md` 🔴 項目超過 `PENDING_RED_EXPIRE`（§十四，預設 2 對話）未處理 | 強制進入 Retro 模式，不再接受新開發指令          |
| 條件三 | 其他 Agent 回報 `🔴 CRITICAL` 與預期嚴重度不符                                    | 由 `@Lead` 啟動 HITL 升級                        |

---

## 五、動態注入機制彙整

> 6 個 Agent（@Consultant / @Backend / @Frontend / @Reviewer / @QA / @Security）採動態注入設計——核心行為不硬編碼於 rules，而是由 `@Lead` 任務時傳入的外部文件決定。

### 5.1 設計意義

這個設計讓系統具備高度擴充性：新增領域知識、技術規範或技能手冊時，**只需新增對應文件，不需修改任何 Agent 的 rules 本體**。

### 5.2 注入來源文件目錄結構

```
.agents/
├── domains/          ← @Consultant 的領域知識庫（金融流派）
│   ├── finance-left-side.md       （左側交易 / 逆勢）
│   ├── finance-lifecycle.md       （生命週期投資法）
│   ├── finance-technical.md       （技術面分析）
│   └── math-quant.md              （量化數學模型）
├── tech-stacks/      ← @Backend / @Frontend / @Security 的技術規範
│   ├── nodejs-esm-backend.md      （Node.js ESM 後端）
│   ├── vue3-vite.md               （前端框架）
│   ├── file-based-storage.md      （檔案持久層原子鎖）
│   ├── telegram-mini-app.md       （Telegram Mini App / initData 鐵律）
│   └── testing-nodejs.md          （測試框架規範）
├── skills/           ← 模板與技能手冊（15 份）
│   ├── security-audit.md          （@Security SC-01~10 清單）
│   ├── telegram-bot-pattern.md
│   ├── telegram-miniapp-pattern.md
│   ├── deploy-oracle.md
│   ├── pm2-management.md
│   ├── infra-constraints.md
│   ├── advice-template.md
│   ├── draft-features-template.md
│   ├── user-story-template.md
│   ├── review-report-template.md
│   ├── test-spec-template.md
│   ├── test-report-template.md
│   ├── rule-update-proposal-template.md
│   ├── vue3-component-pattern.md
│   └── git-pr-workflow.md
└── tasks/            ← 事件觸發 checklist
    ├── hotfix-checklist.md
    ├── new-agent-onboarding.md
    └── domain-creation-guide.md
```

### 5.3 各 Agent 動態注入對應表

#### @Consultant — 領域知識注入

| 注入來源                             | 目錄               | 決定內容                         | 觸發時機                               |
| ------------------------------------ | ------------------ | -------------------------------- | -------------------------------------- |
| `domains/<領域名稱>.md`（至少 1 份） | `.agents/domains/` | 發言視角、審查邏輯、衝突偵測依據 | 每次 `@Lead` 呼叫 `@Consultant` 時傳入 |

**注入行為規則**：

- 每次回覆必須以 `【領域：<名稱>】` 標示發言視角
- 傳入多個領域時，每段各自標示，**禁止混合發言**
- 若計畫出現 `domains/` 未涵蓋的術語 → 標示 `❓ 未知知識領域`，建議補充 domain 檔
- 若傳入多個領域產生直接衝突 → 頂部標 `🚨 領域衝突警告`，強制 User 填寫 `strategyWeight` 權重參數

**擴充方式**：新增一個金融流派只需在 `.agents/domains/` 建立對應 `.md`，`@Consultant` 即可化身為該領域專家。

#### @Backend — 技術棧注入

| 注入來源                            | 目錄                   | 決定內容                                           | 觸發條件                                    |
| ----------------------------------- | ---------------------- | -------------------------------------------------- | ------------------------------------------- |
| `tech-stacks/nodejs-esm-backend.md` | `.agents/tech-stacks/` | 程式語言規範、ESM 模組                             | **每次任務必備**                            |
| `tech-stacks/file-based-storage.md` | `.agents/tech-stacks/` | 檔案持久層、原子鎖鐵律（`fs.openSync(..., 'wx')`） | 涉及 `data/` 持久化                         |
| `skills/telegram-bot-pattern.md`    | `.agents/skills/`      | Telegram Bot、Webhook handler 開發模式             | 涉及 Telegram Bot / Webhook / Mini App 後端 |
| `skills/deploy-oracle.md`           | `.agents/skills/`      | Oracle VM 部署流程                                 | 涉及部署操作說明                            |
| `skills/pm2-management.md`          | `.agents/skills/`      | PM2 程序管理                                       | 涉及排程 / 長駐服務                         |
| `skills/infra-constraints.md`       | `.agents/skills/`      | 記憶體限制、資源上限、禁用技術清單                 | 涉及系統資源 / 基礎設施評估                 |

#### @Frontend — 技術棧注入

| 注入來源                             | 目錄                   | 決定內容                                    | 觸發條件                       |
| ------------------------------------ | ---------------------- | ------------------------------------------- | ------------------------------ |
| `tech-stacks/vue3-vite.md`           | `.agents/tech-stacks/` | Vue 3 Composition API、Vite 構建            | **每次任務必備**               |
| `tech-stacks/telegram-mini-app.md`   | `.agents/tech-stacks/` | WebApp SDK、initData 鐵律、ThemeParams      | 涉及 Telegram Mini App UI      |
| `skills/telegram-miniapp-pattern.md` | `.agents/skills/`      | BackButton / MainButton / HapticFeedback 等 | 涉及 Mini App 互動模式         |
| `skills/vue3-component-pattern.md`   | `.agents/skills/`      | 元件設計、Composable 拆分                   | 涉及元件架構重構               |
| `skills/infra-constraints.md`        | `.agents/skills/`      | 基礎設施限制評估                            | 涉及系統資源或基礎設施限制評估 |

#### @Reviewer — 動態審查範疇注入（非安全範疇）

| 注入來源                                         | 決定內容                | 觸發條件（任務範疇）            |
| ------------------------------------------------ | ----------------------- | ------------------------------- |
| `backend.md` 的「完成定義」+「排程任務規範」章節 | Backend 審查 Checklist  | 任務涉及 `src/`                 |
| `frontend.md` 的「完成定義」章節                 | Frontend 審查 Checklist | 任務涉及 `webapp/`              |
| `skills/telegram-bot-pattern.md`                 | Bot / Webhook 審查重點  | 任務涉及 Telegram Bot / Webhook |
| `skills/telegram-miniapp-pattern.md`             | Mini App UI 審查重點    | 任務涉及 Telegram Mini App UI   |
| `skills/deploy-oracle.md`                        | 部署變更審查項目        | 任務涉及 Oracle VM 部署相關變更 |
| `tasks/hotfix-checklist.md`                      | Hotfix 特殊流程         | 標記為 Hotfix 的任務            |

**絕對禁止**：

- 審查 `@Security` 專屬 SC-01~10 範疇（越界項目由 `@Lead` 判定無效）
- 審查未注入的檔案類型

**設計優點**：`@Reviewer` 本身不持有任何 Checklist，永遠審查各 Agent DoD 的**最新版本**，不會因 `reviewer.md` 未同步更新而遺漏規範。

#### @QA — 動態測試範疇注入

| 注入來源                             | 額外測試重點                           | 觸發條件（任務範疇）            |
| ------------------------------------ | -------------------------------------- | ------------------------------- |
| `tech-stacks/testing-nodejs.md`      | 測試框架規範、可重複執行要求           | **每次測試任務必備**            |
| `backend.md` 的「排程任務規範」      | 冪等性、靜默失敗、執行日誌格式         | 任務涉及 `src/` 或排程任務      |
| `frontend.md` 的「完成定義」         | UI 三態、Empty State、響應式           | 任務涉及 `webapp/`              |
| `skills/telegram-bot-pattern.md`     | Webhook 重試行為、429 處理             | 任務涉及 Telegram Bot / Webhook |
| `skills/telegram-miniapp-pattern.md` | initData 驗證、ThemeParams、BackButton | 任務涉及 Telegram Mini App UI   |
| `skills/security-audit.md`           | 與 `@Security` 審查結果對照            | 任務涉及安全性（SC-01~10 任一） |

#### @Security — 資安審查範疇注入（PROPOSAL-020 新增）

| 注入來源                             | 決定內容                                  | 觸發條件                    |
| ------------------------------------ | ----------------------------------------- | --------------------------- |
| `skills/security-audit.md`           | SC-01~SC-10 資安審查清單、DoD Checklist   | **每次觸發第 6.5 階段必備** |
| `tech-stacks/telegram-mini-app.md`   | initData HMAC 驗證 + `auth_date` 時效鐵律 | 涉及 Telegram Mini App API  |
| `tech-stacks/file-based-storage.md`  | 原子鎖 TOCTOU 防護、`fs.openSync('wx')`   | 涉及檔案持久層 / Lock       |
| `tasks/security-review.md`（若存在） | 專項安全審查 checklist                    | 特殊事件觸發                |

**SC-01 ~ SC-10 範疇清單**（`@Security` 專屬，對齊 `.agents/skills/security-audit.md §1`）：

| 代碼  | 範疇                                                                  |
| ----- | --------------------------------------------------------------------- |
| SC-01 | Token 時效驗證（initData / JWT / OAuth state / refresh token）        |
| SC-02 | 金鑰 / API Key / Secret 處理                                          |
| SC-03 | `strategyWeight` 異動路徑（零容忍，對齊 consultant.md §核心禁止條款） |
| SC-04 | 資料刪除操作（零容忍）                                                |
| SC-05 | 新增對外 API 端點授權機制                                             |
| SC-06 | 檔案 Lock / 共用資源競爭（TOCTOU 防護）                               |
| SC-07 | Webhook / Cron job 並發資源                                           |
| SC-08 | 錯誤訊息格式（是否洩漏系統資訊）                                      |
| SC-09 | 新增第三方套件（安全漏洞掃描）                                        |
| SC-10 | 未來擴充（由 `@Retro` 提案新增）                                      |

**絕對禁止**：

- 審查 `@Reviewer` 專屬範疇（程式碼可讀性 / 命名 / 效能未涉安全）
- 核准資安範疇的豁免申請（零容忍，無例外，對齊 `security.md §禁止行為清單` immutable 章節）

### 5.4 動態注入 vs 硬編碼的設計對比

| 面向           | 動態注入（本系統）                                           | 硬編碼                     |
| -------------- | ------------------------------------------------------------ | -------------------------- |
| **擴充成本**   | 新增文件即可，不修改 rules                                   | 每次擴充需修改 rules 本體  |
| **規範一致性** | `@Reviewer` / `@QA` / `@Security` 永遠讀最新版 DoD / SC 清單 | 可能因未同步而審查舊規範   |
| **職責清晰度** | 知識來源單一，可追溯                                         | 知識分散在多個 rules 中    |
| **風險**       | 傳入文件品質決定輸出品質                                     | 規範直接可見，但維護成本高 |

### 5.5 注入品質保障

- **必備注入**未傳入 → `@Lead` 必須阻斷該階段派發（`@Reviewer` / `@QA` / `@Security` 拒絕執行）
- **條件式注入**遺漏 → Agent 於 DoD 自評中標注 `🟡 n 項待說明`
- **SC-10 未知範疇**：`@Security` 若遭遇未列於 SC-01~09 的情境，暫停審查並通知 `@Lead` 建議 `@Retro` 提案擴充 SC 清單

---

## 六、退件/重提次數上限一覽

> 各階段的上限設定與觸發後的連鎖動作。所有上限參數均引用 `RULES_DESIGN_GUIDE.md §十四 系統參數配置` SSOT。

### 6.1 次數上限彙整表

| 階段                   | 退件發出方      | 退件接收方                   | 上限參數                                 | 預設值   | 超限觸發                            | 對應巡邏規則 | 嚴重程度 |
| ---------------------- | --------------- | ---------------------------- | ---------------------------------------- | -------- | ----------------------------------- | ------------ | -------- |
| 審查階段（程式碼品質） | `@Reviewer`     | `@Backend` / `@Frontend`     | `REVIEW_CYCLE_LIMIT`                     | **2**    | 同功能複審達第 2 次仍有 BLOCKER     | P-01         | 🔴       |
| **審查階段（資安）**   | **`@Security`** | **`@Backend` / `@Frontend`** | **`REVIEW_CYCLE_LIMIT`**（與 P-01 共用） | **2**    | **同功能複審達第 2 次仍有 BLOCKER** | **P-11**     | **🔴**   |
| 測試階段               | `@QA`           | `@Backend` / `@Frontend`     | `QA_RETEST_LIMIT`                        | **3**    | 同功能重測達第 3 次仍有未解決 Bug   | P-02         | 🔴       |
| 提案採納               | `@Retro` → User | `@Lead`                      | （無上限，但反覆計數）                   | —        | 同 Agent + 同根因累計第 3 次出現    | P-04         | 🔴       |
| 提案執行               | User 採納後     | `@Lead`                      | 1 個任務週期                             | —        | IN_PROGRESS 超過一個任務週期未完成  | P-03         | 🟡       |
| 豁免累積               | `@Lead` 記錄    | `@Retro` 審計                | `EXEMPTION_AUDIT_THRESHOLD`              | **5** 筆 | 未歸檔豁免記錄累積達門檻            | P-10         | 🟡       |

**修改方式**：調整 `RULES_DESIGN_GUIDE.md §十四` 的參數值即生效，**無需**同步更新 `reviewer.md` / `security.md` / `qa.md` / `assistant.md`（各文件已以參數名引用）。

### 6.2 次數計算規則

#### 審查複審次數（P-01 + P-11，共用計數）

```
計算單位：同一功能名稱的 REVIEW_REPORT.md + SECURITY_REPORT.md

第 1 次：@Reviewer 初審 + @Security 初審（平行派發）
          ├─ @Reviewer 退件（BLOCKER，非安全）
          └─ @Security 退件（BLOCKER，SC-XX）
          → @Lead 合併為統一退件清單
          → @Backend / @Frontend 一次性修正後重提
          → 計數器 = 1

第 2 次：@Reviewer 複審 + @Security 複審（再次平行派發）
          ├─ 皆通過 → Gate Check 放行
          ├─ 僅 @Reviewer 退件 → P-01 觸發 🔴 REVIEW_QUALITY
          ├─ 僅 @Security 退件 → P-11 觸發 🔴 SECURITY_AUDIT_FAIL
          └─ 兩方皆退件 → P-01 + P-11 **同時雙通知**
          → 計數器 = 2（達 REVIEW_CYCLE_LIMIT）
          → @Lead 阻斷新功能啟動，等待 User 指令
```

**重置條件**：User 下達 `重新評估實作方案 <功能名稱>` 後，`@Lead` 重新規劃方案，計數器歸零。

#### 測試重測次數（P-02）

```
計算單位：同一功能名稱的 TEST_REPORT.md

第 1 次：@QA 初測 → 未通過（未解決 Bug）
第 2 次：@QA 重測 → 未通過
第 3 次：@QA 重測 → 仍未通過
          → @Assistant 巡邏偵測 P-02
          → 自動產生 🔴 QA_QUALITY 通知
          → @Lead 阻斷新功能
```

**重置條件**：User 下達 `重新評估需求範圍 <功能名稱>` 後，`@Lead` 重新規劃需求，計數器歸零。

#### 提案執行週期（P-03）

```
計算單位：同一提案檔案（PROPOSAL_YYYYMMDD_NNN.md）

User 採納提案 → 狀態 IN_PROGRESS
     │
     ▼
  @Lead 未在「一個任務週期」內完成規則更新
     │
     ▼
  在提案頂部加上 ⚠️ 提案執行逾時 標注
  → @Assistant 巡邏偵測後產生 🟡 RETRO_TIMEOUT 通知

「一個任務週期」定義：
  上一次 Retro 執行時間點 → 本次 Retro 執行時間點之間的期間
  （對齊 retro.md §工作對話定義）
```

### 6.3 超限後的連鎖動作

```
超限事件發生
    │
    ▼
@Assistant 自動偵測（下次巡邏時）
    │
    ▼
PENDING_ACTIONS.md 新增 🔴 或 🟡 項目
    │
    ▼
@Lead 下次接收 User 指令時執行前置檢查
    │
    ├─ 🔴 項目存在 → 拒絕啟動新功能
    │                └─ 回覆阻斷通知 + 附上解除指令格式
    │
    └─ User 下達解除指令
              │
              ▼
         @Lead 執行對應處理流程
              │
              ▼
         @Assistant 下次巡邏時確認條件消失
              │
              ▼
         自動關閉 🔴 項目，解除阻斷
```

### 6.4 次數設計的背後邏輯

| 階段                                   | 上限   | 設計理由                                                                                                |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| 審查複審（@Reviewer + @Security 共用） | 2 次   | 第 2 次仍失敗代表問題可能源自架構或需求，繼續複審無法解決根本問題；共用計數避免兩方輪流退件造成無限循環 |
| 測試重測                               | 3 次   | 投資訊號錯誤的代價高，給予較多修正機會，但超過 3 次代表需重新審視需求範圍                               |
| 提案反覆                               | 3 次   | 同一問題三度出現代表規則本身有系統性缺失，需要 User 明確介入決策                                        |
| 提案執行                               | 1 週期 | 被採納的規則更新若長期未執行，等同虛假承諾，需強制提醒                                                  |
| 豁免累積                               | 5 筆   | 豁免是系統的「壓力閥」，累積過多代表規則本身需優化，觸發 `@Retro` 審計                                  |

### 6.5 禁止行為（PROPOSAL-014 複審上限設計意圖）

依 `.agents/rules/reviewer.md §s07` + `security.md §s07`：

- **絕對禁止** 因「次數壓力」任一方降低審查標準
- **絕對禁止** 為規避上限而將 BLOCKER 降級為 WARNING
- **絕對禁止** 在達上限前「放水通過」以避免觸發 🔴 通知

---

## 七、提案生命週期（`@Retro`）

> 四狀態 + 三層目錄設計，對齊 PROPOSAL-016 目錄規模管理。

### 7.1 狀態機圖示（PROPOSAL-016 後：四狀態）

```
                    @Retro 產出提案
                          │
                          ▼
                    ┌─────────────┐
                    │    OPEN     │  ← 初始狀態
                    │  （待審）   │     @Assistant P-05 偵測後
                    └──────┬──────┘     產生 🟡 RETRO_PROPOSAL
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
    User 下達採納指令             User 下達拒絕指令
    採納提案 PROPOSAL_*          拒絕提案 PROPOSAL_*
              │                  原因：<說明>
              │                         │
              ▼                         ▼
       ┌─────────────┐           ┌─────────────┐
       │ IN_PROGRESS │           │  CANCELLED  │  ← 終態
       │  （執行中） │           │  （已拒絕） │     永久保留於 completed/
       └──────┬──────┘           └─────────────┘
              │                         ↑
              │                  納入反覆問題計數
              ▼
      @Lead 執行完成
      規則更新套用
              │
              ▼
       ┌─────────────┐
       │    DONE     │  ← 中間終態
       │  （已完成） │     存於 completed/
       └──────┬──────┘     @Assistant 可巡邏偵測
              │            完成未歸檔警示（10 份）
              │
              │ 超過 2 個審計週期
              ▼
       ┌─────────────┐
       │  ARCHIVED   │  ← 最終終態
       │ （已歸檔）  │     @Retro 歸檔後移至 archived/
       └─────────────┘     不納入反覆計數
```

### 7.2 五種狀態定義

| 狀態          | 說明                                  | 存放目錄               | 是否納入反覆問題計數           | 下一步                         |
| ------------- | ------------------------------------- | ---------------------- | ------------------------------ | ------------------------------ |
| `OPEN`        | 提案已產出，等待 User 審查            | `proposals/active/`    | ❌（尚未決策）                 | User 採納或拒絕                |
| `IN_PROGRESS` | User 已採納，`@Lead` 正在執行規則更新 | `proposals/active/`    | ❌（視為進行中）               | `@Lead` 完成後改為 `DONE`      |
| `DONE`        | 規則更新已完成，等待歷時歸檔          | `proposals/completed/` | ❌（已解決）                   | 超過 2 個審計週期 → `ARCHIVED` |
| `CANCELLED`   | User 拒絕採納，附原因永久保留         | `proposals/completed/` | ✅（問題未修正，納入再發計數） | — 終態                         |
| `ARCHIVED`    | 歷史參考，已超過 2 個審計週期         | `proposals/archived/`  | ❌（已解決不計）               | — 終態                         |

**重要設計變更**（PROPOSAL-016）：

- v1（早期）：僅三狀態 OPEN / IN_PROGRESS / ARCHIVED，REJECTED 為另一終態
- v2（PROPOSAL-016 後）：四狀態 OPEN / IN_PROGRESS / DONE / CANCELLED + 歸檔狀態 ARCHIVED
- 語義修正：`ARCHIVED` 從「已套用」改為「已超過審計週期的歷史參考」
- 目錄結構：單層 `proposals/` → 三層 `active/` / `completed/` / `archived/`

### 7.3 User 操作指令格式

#### 採納提案

```
採納提案 PROPOSAL_YYYYMMDD_NNN
```

`@Lead` 收到後執行對應 `.agents/` 規則文件的更新，狀態由 OPEN → IN_PROGRESS；執行完畢後改為 DONE，移至 `completed/`。

#### 拒絕提案

```
拒絕提案 PROPOSAL_YYYYMMDD_NNN，原因：<一句話說明>
```

`@Lead` 收到後將狀態改為 `CANCELLED`，原因永久附記於提案文件，移至 `completed/`。

#### 繼續執行逾時提案

```
繼續執行提案 PROPOSAL_YYYYMMDD_NNN
```

重新確認 `IN_PROGRESS`，清除逾時標注，`@Assistant` 下次巡邏後自動關閉 `RETRO_TIMEOUT`。

#### 豁免審計（P-10 觸發後）

```
執行豁免審計
```

`@Lead` 呼叫 `@Retro` 分析累積豁免記錄，歸檔或升級為規則修改提案。

### 7.4 提案粒度規則

每份提案只能包含以下**一項修改**：

| 限制               | 說明                                                  |
| ------------------ | ----------------------------------------------------- |
| **一個目標 Agent** | 禁止在單一提案中同時修改多個 Agent 的規則             |
| **一條規則變更**   | 禁止在單一提案中同時新增多條規則或修改多個章節        |
| **一個根因層級**   | 每份提案對應一個明確的根因（REQ / ARCH / DEV / TEST） |

**設計理由**：確保每份提案可以獨立採納或拒絕，避免「捆綁決策」讓 User 難以評估個別修改的必要性。

**特例**（PROPOSAL-020 / PROPOSAL-021 如何處理單一大提案）：

- 若提案範疇必然跨多 Agent（如新增 Agent、架構重構），可分 Phases 在單一提案內線性執行
- Phase 邊界在提案文件中清楚標示，且每個 Phase 可獨立 commit

### 7.5 反覆問題警告觸發流程

```
@Retro 執行歷史比對
    │
    ▼
以「目標 Agent + 根因分類」為鍵值
掃描 .agents/proposals/ 所有提案（含 active / completed / archived）
    │
    ▼
計算累計出現次數
    │
    ├─ 第 1 次 → 正常產出 OPEN 提案
    │
    ├─ 第 2 次 → 提案中附上歷史提案參考連結
    │
    └─ 第 3 次（含）以上
              │
              ▼
         提案頂部加上：
         🚨 反覆問題警告
         同一問題類型已出現第 N 次
         歷史相關提案：PROPOSAL_* / PROPOSAL_*
              │
              ▼
         提案狀態為 OPEN
         但必須等待 User 明確確認
         才可進入 IN_PROGRESS
              │
              ▼
         @Assistant P-04 巡邏偵測後
         自動產生 🔴 RETRO_REPEAT 通知
         @Lead 阻斷新功能啟動
```

### 7.6 知識點保留規則

當提案內容包含新的 SOP、技術手冊或領域知識文件時，`@Retro` 必須在提案中同時標注：

```markdown
📌 請 @Lead 將新檔案路徑與觸發情境更新至 `lead.md` 的資源與上下文映射表
新增文件：.agents/<路徑>/<檔名>.md
觸發情境：<說明何時應傳入此文件>
```

確保新知識被正確納入 `@Lead` 的動態注入機制，而非孤立存在於 `.agents/` 目錄中。

### 7.7 提案目錄結構（PROPOSAL-016 三層制）

```
.agents/
└── proposals/
    ├── PROPOSAL_INDEX.md             ← 總索引（@Lead 維護）
    ├── active/                       ← OPEN + IN_PROGRESS
    │   └── PROPOSAL_YYYYMMDD_NNN.md
    ├── completed/                    ← DONE + CANCELLED
    │   ├── PROPOSAL_20260421_001.md  ← DONE
    │   ├── PROPOSAL_20260421_015.md  ← DONE
    │   └── PROPOSAL_20260421_021.md  ← DONE（最新）
    └── archived/                     ← 超過 2 個審計週期
        └── RULE_UPDATE_PROPOSAL_20260419.md  ← 原 archive/
```

**目錄轉移時機**：

- `OPEN` → User 採納 → `IN_PROGRESS`（仍在 `active/`）
- `IN_PROGRESS` → `@Lead` 完成 → `DONE`（`git mv active/ → completed/`）
- User 拒絕 → `CANCELLED`（`git mv active/ → completed/`）
- `DONE` / `CANCELLED` 超過 2 個審計週期 → `ARCHIVED`（`@Retro` 批次 `git mv completed/ → archived/`）

### 7.8 規模警示門檻（對齊 `retro.md §提案目錄規模警示`）

| 指標                | 警示門檻 | 參數名（§十四）            | 處理動作                                              |
| ------------------- | -------- | -------------------------- | ----------------------------------------------------- |
| `active/` OPEN 累積 | ≥ 15 份  | `PROPOSAL_OPEN_WARN`       | `@Retro` 評估優先級，建議 `@Lead` 啟動批次執行 Sprint |
| `completed/` 未歸檔 | ≥ 10 份  | `PROPOSAL_UNARCHIVED_WARN` | `@Retro` 執行批次歸檔                                 |
| 全目錄總計          | ≥ 50 份  | `PROPOSAL_TOTAL_WARN`      | `@Retro` 提出目錄重整提案                             |

### 7.9 當前提案分布快照（PROPOSAL-021 執行後）

| 狀態        | 數量   | 目錄位置     |
| ----------- | ------ | ------------ |
| OPEN        | 0      | `active/`    |
| IN_PROGRESS | 0      | `active/`    |
| DONE        | 23     | `completed/` |
| CANCELLED   | 0      | `completed/` |
| ARCHIVED    | 1      | `archived/`  |
| **合計**    | **24** | —            |

完整索引見 `.agents/proposals/PROPOSAL_INDEX.md`。

---

## 八、系統參數配置（§十四 SSOT）

> 依 PROPOSAL-020 建立，`.agents/RULES_DESIGN_GUIDE.md §十四` 為所有數值門檻的**單一配置點**。
> 本章節標 `priority="critical" immutable="true"`，修改需透過 `RULE_UPDATE_PROPOSAL` 提案。

### 8.1 設計意義

在 PROPOSAL-020 前，各 Rules 各自寫死門檻數值（如 reviewer.md 寫 "複審 2 次"、assistant.md 寫 "P-01 觸發於第 2 次"），造成：

- 修改一個門檻需同步改多處
- 容易遺漏造成規則不一致
- 跨 Rules 數值關係隱性依賴

PROPOSAL-020 後：**所有數值集中於 §十四**，各 Rules 以**參數名**引用（如「依 `RULES_DESIGN_GUIDE.md §十四` 之 `REVIEW_CYCLE_LIMIT`」）。修改 §十四 任一數值自動影響所有引用 Rules，**無需同步更新多處**。

### 8.2 參數總表

#### 審查與測試循環

| 參數名               | 預設值 | 說明                                   | 引用位置                                                   |
| -------------------- | ------ | -------------------------------------- | ---------------------------------------------------------- |
| `REVIEW_CYCLE_LIMIT` | **2**  | `@Reviewer` + `@Security` 共用複審上限 | `reviewer.md` / `security.md` / `assistant.md` P-01 / P-11 |
| `QA_RETEST_LIMIT`    | **3**  | `@QA` 重測上限                         | `qa.md` / `assistant.md` P-02                              |

#### 巡邏與狀態

| 參數名                  | 預設值           | 說明                    | 引用位置                                           |
| ----------------------- | ---------------- | ----------------------- | -------------------------------------------------- |
| `PATROL_CYCLE`          | **3** 個工作對話 | 標準巡邏週期            | `assistant.md` / `retro.md`                        |
| `PATROL_OVERDUE`        | **5** 個工作對話 | 即時觸發（超時保底）    | `assistant.md`                                     |
| `PENDING_YELLOW_EXPIRE` | **3** 對話       | 🟡 PENDING 過期升 🔴    | `assistant.md`                                     |
| `PENDING_RED_EXPIRE`    | **2** 對話       | 🔴 BLOCKED 高優異常過期 | `assistant.md` / `system-prompt.md` 全局阻斷條件二 |
| `PENDING_DONE_EXPIRE`   | **5** 對話       | ✅ DONE 未歸檔提示      | `assistant.md`                                     |

#### 豁免與提案

| 參數名                      | 預設值    | 說明                   | 引用位置                        |
| --------------------------- | --------- | ---------------------- | ------------------------------- |
| `EXEMPTION_AUDIT_THRESHOLD` | **5** 筆  | 觸發 `@Retro` 豁免審計 | `lead.md` / `assistant.md` P-10 |
| `PROPOSAL_OPEN_WARN`        | **15** 份 | 提案 OPEN 規模警示     | `retro.md`                      |
| `PROPOSAL_UNARCHIVED_WARN`  | **10** 份 | 完成未歸檔警示         | `retro.md`                      |
| `PROPOSAL_TOTAL_WARN`       | **50** 份 | 目錄總量警示           | `retro.md`                      |

#### Token 預算（既有，集中引用）

| 參數名                 | 預設值   | 說明                                        |
| ---------------------- | -------- | ------------------------------------------- |
| `TOKEN_ALWAYSON_LIMIT` | **500**  | AlwaysOn 文件上限（system-prompt.md）       |
| `TOKEN_ONDEMAND_LIMIT` | **1000** | 按需載入 Rules 上限（rules/\*.md 共 11 份） |

### 8.3 變更規範

- **絕對禁止** 直接修改 §十四 之參數值；任何調整必須透過 `RULE_UPDATE_PROPOSAL` 提案執行
- 調整後 `@Lead` **不必**同步更新引用文件（各文件已採參數名參照，自動套用新值）
- 本章節調整計為 `RULES_DESIGN_GUIDE.md` 的 `minor +1` 版本遞增
- `RULES_DESIGN_GUIDE.md §十四` 標 `priority="critical" immutable="true"`

### 8.4 引用範例

```markdown
# reviewer.md 內範例

| HITL 觸發情境 | 行動 |
| ------------- | ---- |

| 複審次數達 `REVIEW_CYCLE_LIMIT`（依 `RULES_DESIGN_GUIDE.md §十四`，預設 2，
**與 @Security 共用計數**）仍有 BLOCKER | 產 🔴 `REVIEW_QUALITY` 通知 |
```

```yaml
# Rules frontmatter 內範例（PROPOSAL-021 Schema）
constraints_ref:
  review_cycle_limit: !ref RULES_DESIGN_GUIDE.md#REVIEW_CYCLE_LIMIT
  exemption_threshold: !ref RULES_DESIGN_GUIDE.md#EXEMPTION_AUDIT_THRESHOLD
```

---

## 九、Rules 版本控制機制（PROPOSAL-019）

> 所有 `.agents/` Rules 文件必須在第一個章節前包含版本標頭，並維護於 `RULES_VERSION_INDEX.md`。

### 9.1 版本標頭標準

```
***
版本：v{major}.{minor}
最後修改：{YYYY-MM-DD}
修改提案：{PROPOSAL-XXX}
修改摘要：{一句話描述}
審計基準：v{major}.{minor}
***
```

### 9.2 版本號規則

| 變更         | 調整                                                   | 典型案例                                    |
| ------------ | ------------------------------------------------------ | ------------------------------------------- |
| **major +1** | 章節結構重組 / Persona 或角色邊界重大調整 / 向下不相容 | PROPOSAL-015 lead.md 精簡重整               |
| **minor +1** | 新增章節或條文 / 修改現有條文語意 / 修正錯誤或補充     | PROPOSAL-021 YAML frontmatter + XML section |

### 9.3 初始版本

所有現有 Rules 首次加入版本標頭時統一標注為 **v1.0**，修改日期為加入版本標頭的日期（PROPOSAL-019 執行日）。

### 9.4 禁止行為

- **絕對禁止** Rules 文件缺少版本標頭
- **絕對禁止** 版本號倒退（v1.1 → v1.0）
- **絕對禁止** 跨 major 號跳躍（v1.3 → v3.0）

### 9.5 提案執行後版本更新義務（PROPOSAL-019 §十二）

每份提案執行完成後，`@Lead` 在合併前必須執行：

1. **識別修改範圍** — 本次提案修改的所有 Rules 文件
2. **遞增版本號** — 結構性重組 → `major +1`；新增/修改條文 → `minor +1`
3. **更新版本標頭四欄位** — 版本、最後修改、修改提案、修改摘要
4. **同步 `RULES_VERSION_INDEX.md`**

**禁止行為**：絕對禁止提案執行合併後對應 Rules 文件的版本標頭未更新（視為提案執行 DoD 未達成）。

---

## 十、Rules Metadata Schema（PROPOSAL-021）

> 依 `.agents/RULES_METADATA_SCHEMA.md` SSOT，所有 Rules 文件除六章節外**必須**包含三層結構。

### 10.1 三層結構概覽

```
第 1 層：YAML Frontmatter（機器可讀 metadata）
---
agent_id: ...
agent_name: "@..."
file_type: agent_rule | always_on | design_guide
version: v1.x
last_modified: 2026-04-21
last_proposal: PROPOSAL-021
audit_baseline: v1.0
trigger: manual | always_on
token_budget_ref: TOKEN_ONDEMAND_LIMIT
workflow_stages: [...]
reports_to: "@Lead"
interacts_with: [...]
produces: [...]
references: {...}
constraints_ref:
  review_cycle_limit: !ref RULES_DESIGN_GUIDE.md#REVIEW_CYCLE_LIMIT
---

第 2 層：H1 + 版本標頭（人類摘要層，PROPOSAL-019）

第 3 層：Markdown Body + XML section 標籤（LLM 注意力層）
<section id="s01" priority="critical|high|normal|info" [immutable="true"]>
## 章節標題
...內容（markdown 保留不變）...
</section>
```

### 10.2 Frontmatter 共用欄位（所有 Rules 必備）

| 欄位               | 型別    | 必要 | 範例                                        | 說明                                 |
| ------------------ | ------- | ---- | ------------------------------------------- | ------------------------------------ |
| `agent_id`         | string  | ✅   | `project_lead`                              | 小寫底線格式；`system_prompt` 為特例 |
| `agent_name`       | string  | ✅   | `@Lead`                                     | 顯示用                               |
| `file_type`        | enum    | ✅   | `agent_rule` / `always_on` / `design_guide` | 三類區分                             |
| `version`          | semver  | ✅   | `v1.2`                                      | 對齊 PROPOSAL-019                    |
| `last_modified`    | date    | ✅   | `2026-04-21`                                | ISO 格式                             |
| `last_proposal`    | string  | ✅   | `PROPOSAL-021`                              | 最近影響此檔的提案                   |
| `audit_baseline`   | version | ✅   | `v1.0`                                      | 上次 `@Retro` 審計時版本             |
| `trigger`          | enum    | ✅   | `manual` / `always_on`                      | 載入時機                             |
| `token_budget_ref` | string  | ⭕   | `TOKEN_ONDEMAND_LIMIT`                      | 引用 §十四                           |

### 10.3 Agent 專屬欄位（`file_type: agent_rule`）

| 欄位              | 型別   | 必要 | 範例                    | 說明                            |
| ----------------- | ------ | ---- | ----------------------- | ------------------------------- |
| `workflow_stages` | list   | ⭕   | `[審查, 資安審查]`      | 此 Agent 在 Workflow 參與的階段 |
| `reports_to`      | string | ⭕   | `@Lead`                 | 回報對象                        |
| `interacts_with`  | list   | ⭕   | `[@Reviewer, @Backend]` | 協作 Agent                      |
| `produces`        | list   | ⭕   | `[SECURITY_REPORT.md]`  | 產出物                          |
| `references`      | map    | ⭕   | 見下                    | 引用其他文件                    |
| `constraints_ref` | map    | ⭕   | 見下                    | 引用 §十四 參數                 |

### 10.4 XML `<section>` 標籤 Schema

| 屬性        | 型別    | 必要 | 值                                      | 說明                                         |
| ----------- | ------- | ---- | --------------------------------------- | -------------------------------------------- |
| `id`        | string  | ✅   | `s01`、`s02`...                         | 每份 rules 內唯一                            |
| `priority`  | enum    | ✅   | `critical` / `high` / `normal` / `info` | LLM 注意力權重提示                           |
| `immutable` | boolean | ⭕   | `true`                                  | 標記此章節需透過提案才能修改（如零容忍條款） |

### 10.5 AlwaysOn 例外（Schema §四之一）

`system-prompt.md`（`trigger: always_on`）依 Schema §四之一 適用例外：

- **免** body 版本標頭（避免 token 膨脹超過 500 限制）
- **免** `<section>` 標籤
- Frontmatter 為**唯一** metadata 層
- 受 `TOKEN_ALWAYSON_LIMIT`（§十四，預設 500）硬性限制

目前 `system-prompt.md` token 實測約 487，符合限制。

### 10.6 `immutable="true"` 保護章節（8 處）

以下章節標 `priority="critical" immutable="true"`，修改必須透過提案：

| 檔案                    | 章節                        | 保護主題                                    |
| ----------------------- | --------------------------- | ------------------------------------------- |
| `system-prompt.md`      | §全局緊急阻斷               | 三條件全局阻斷（AlwaysOn 例外，以註解標示） |
| `lead.md`               | §s06 平行審查與衝突仲裁規則 | PROPOSAL-020 防線設計                       |
| `lead.md`               | §s11 豁免授權與記錄機制     | 豁免流程不可繞過                            |
| `consultant.md`         | §s07 核心禁止條款           | strategyWeight 零容忍                       |
| `backend.md`            | §s06 HITL 升級條件          | 數值化終止條件                              |
| `security.md`           | §s02 審查職責邊界           | SC 範疇互斥                                 |
| `security.md`           | §s07 禁止行為清單           | 資安零豁免                                  |
| `RULES_DESIGN_GUIDE.md` | §s12 系統參數配置（§十四）  | SSOT 參數不可直改                           |

### 10.7 違反 Schema 的處理

- `@Retro` 審計時依 Schema 檢查 13 份 Rules
- 發現違反（例：缺必要欄位、`id` 重複、`priority` 非定義值）→ 於審計報告標記 🔴
- 修正需透過 `RULE_UPDATE_PROPOSAL` 流程，不可直接改

---

## 十一、文件索引與維護規範

### 11.1 `.agents/` 核心文件

| 文件                          | 用途                                   | 維護者                 |
| ----------------------------- | -------------------------------------- | ---------------------- |
| `RULES_DESIGN_GUIDE.md`       | 設計規範（§一 ~ §十五，含 §十四 SSOT） | `@Retro` 提案維護      |
| `RULES_METADATA_SCHEMA.md`    | Metadata Schema SSOT（PROPOSAL-021）   | `@Retro` 提案維護      |
| `RULES_VERSION_INDEX.md`      | 版本總索引（PROPOSAL-019）             | `@Lead` 提案執行後同步 |
| `proposals/PROPOSAL_INDEX.md` | 提案總索引（PROPOSAL-016）             | `@Lead` 狀態變更時同步 |

### 11.2 相關 docs/ 視圖

| 文件                                                 | 定位             | 建議用途                                   |
| ---------------------------------------------------- | ---------------- | ------------------------------------------ |
| `docs/agents-overview.md`                            | 簡明穩定入口     | 新成員第一次接觸系統                       |
| **`docs/reports/agents_overview.md`**（本文件）      | **視覺化詳細版** | **完整流程圖、互動關係、阻斷機制深度參考** |
| `docs/reports/archive/agents_audit_report_202604.md` | 品質評鑑快照     | 系統健康度追蹤                             |

### 11.3 本文件維護規範

- **更新時機**：每次影響 Workflow / 通知 / 參數 / Schema 的提案執行合併後
- **觸發條件**：以下任一 → 必須更新本文件
  - 新增 / 移除 / 重命名 Agent
  - Workflow 階段增減（如未來新增 STEP 6.6）
  - 巡邏規則 P-XX 增減
  - 通知分級符號變動
  - `§十四` 參數新增 / 命名變更
  - Metadata Schema 變更
- **派生視圖定位**：本文件反映 `.agents/` 當前狀態，不定義新規則
- **衝突處理**：若本文件與 `.agents/` 不一致，以 `.agents/` 為準；由 `@Retro` 提案同步

---

_對齊提案：PROPOSAL-021（2026-04-21）_
_下次審視：`@Retro` 審計週期或下一次影響 Workflow 的提案執行時_
_派生來源：`.agents/` v1.x（詳細版本見 `.agents/RULES_VERSION_INDEX.md`）_
