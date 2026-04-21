# 📋 InvestmentLineNotify AI Agents 系統總覽圖表 大綱
> 文件更新歷程: 2026/04/21-建立

## 一、Agent 角色一覽表
> 各 Agent 的角色定位、核心職責、產出文件、唯讀/可寫範圍

| Agent | 角色定位 | 核心職責 | 主要產出文件 | 可寫範圍 | 唯讀範圍 |
|---|---|---|---|---|---|
| `@Lead` | 工作流指揮官 | 接收 User 指令、驅動 Workflow、執行 Gate Check、呼叫各 Agent | `PENDING_ACTIONS.md`（狀態更新）、`PROPOSAL_*.md`（執行採納） | 流程控制、規則更新 | 不直接寫業務程式碼 |
| `@Assistant` | 人助理與通知管理員 | 巡邏各產出文件、偵測異常、彙整所有待處理事項至 `PENDING_ACTIONS.md` | `PENDING_ACTIONS.md` | 通知看板 | 不執行任何業務邏輯 |
| `@Planner` | 專案經理（PM） | 管理功能從 ideas → preplan → draft → finished 的狀態流轉、撰寫 User Story 與驗收標準 | `ideas/preplan/draft/finishedplan_features.md`、`ADVICE_RESPONSE_*.md` | 計畫文件 | 不寫程式碼 |
| `@Architect` | 系統架構師 | 將需求轉化為 API 規格與資料結構（設計階段）；功能完成後更新系統文件（收斂階段） | `docs/api/<模組>_api.md`、`docs/architecture.md`、`docs/modules/` | API Spec、架構文件 | 不寫 `src/` / `webapp/` 實作程式碼 |
| `@Consultant` | 領域顧問（動態化身） | 在架構設計前，從 `domains/*.md` 注入的金融領域視角審查需求草案、偵測邏輯衝突 | `docs/plans/advice/ADVICE_<功能名稱>.md` | 顧問建議文件 | 不直接修改 `draft_features.md` |
| `@Backend` | 後端開發者 | 實作 API 路由、排程任務、量化策略引擎；產出部署指令清單 | `src/` 程式碼、單元測試、部署指令清單 | `src/`、測試腳本 | 不直接執行伺服器指令 |
| `@Frontend` | 前端開發者 | 實作 Telegram Mini App UI；串接 API；遵守 ThemeParams 與 Telegram WebApp SDK 規範 | `webapp/` 程式碼、元件測試 | `webapp/`、測試腳本 | 不捏造假資料繞過 API |
| `@Reviewer` | 資深程式碼審查員 | 在進入 QA 前進行品質把關；動態載入對應 DoD 作為審查基準；產出三級問題清單 | `REVIEW_REPORT.md` | 審查報告 | 不修改任何 `src/` / `webapp/` 程式碼 |
| `@QA` | 品質保證專家 | 開發前產出 Test Spec（TDD 先行）；開發後執行整合與邊界測試；產出 Test Report | `TEST_SPEC_<功能名稱>.md`、`TEST_REPORT.md` | 測試腳本、測試報告 | 不修改 `src/` / `webapp/` 業務邏輯 |
| `@Retro` | 敏捷教練（進化管理員） | 分析 BLOCKER / Bug 的根因；比對歷史提案識別反覆問題；提議修改 `.agents/` 規則 | `.agents/proposals/PROPOSAL_YYYYMMDD_NNN.md` | 提案文件 | 不直接修改任何 `.agents/` 規則文件 |

### 動態注入設計的 Agent

以下 Agent 的核心行為由 `@Lead` 任務時傳入的外部文件決定，而非硬編碼在 rules 中：

| Agent | 注入來源 | 注入內容 |
|---|---|---|
| `@Consultant` | `domains/*.md` | 金融領域知識、投資流派邏輯 |
| `@Backend` | `tech-stacks/*.md`、`skills/telegram-bot-pattern.md`、`skills/deploy-oracle.md`、`skills/infra-constraints.md` | 程式語言規範、部署流程、資源限制 |
| `@Frontend` | `tech-stacks/*.md`、`skills/telegram-miniapp-pattern.md` | 前端框架規範、Telegram Mini App SDK |
| `@Reviewer` | 對應 Agent 的 DoD 章節、`skills/*.md`、`tasks/security-review.md` | 審查 Checklist（動態組合） |
| `@QA` | 對應 Agent 的 DoD 章節、`skills/*.md`、`tech-stacks/testing-nodejs.md` | 測試範疇、測試框架規範 |

## 二、完整 Workflow 流程圖
> 從 User 下達指令 → Planner → Architect → QA（Test Spec）→ Backend/Frontend → Reviewer → QA（Test Report）→ Architect（收斂）→ Planner（完成）→ Retro，標示各 Gate Check 位置

```
┌─────────────────────────────────────────────────────────────┐
│  User 下達開發指令                                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  @Lead：前置檢查                                              │
│  確認 PENDING_ACTIONS.md 的 🔴 區塊為空                       │
│  ❌ 有未處理 🔴 項目 → 拒絕啟動，回覆阻斷通知給 User            │
│  ✅ 無 🔴 項目 → 繼續                                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
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
              │ User 確認草案 │
              └───────┬───────┘
                      │ ✅ 確認
                      ▼
╔═════════════════════════════════════════════════════════════╗
║  STEP 2｜顧問審查階段                                         ║
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
│  @Planner 處理顧問建議                                         │
│  • 完全採納 → 更新 draft v2，通知 @Lead 繼續                    │
│  • 部分採納 → 更新 draft，產出 ADVICE_RESPONSE_*.md             │
│    └─ 若拒絕 🔴 高風險建議 → 標注 ⚠️ 未採納高風險建議             │
│  • 完全拒絕 → 記錄理由，流程繼續                                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
╔═════════════════════════════════════════════════════════════╗
║  STEP 3｜架構設計階段                                         ║
╚═════════════════════════════════════════════════════════════╝
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  @Lead 呼叫 @Architect（設計階段）                             │
│  • 讀取 infra-constraints.md（硬性限制）                       │
│  • 技術依賴審查：缺少 tech-stacks 規範 → 🚧 阻斷通知 → 等 User  │
│  • 產出：docs/api/<模組>_api.md（API Spec）                    │
│  • 定義資料結構（欄位、型別、範例值）                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
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
         │  @Lead Gate Check    │
         │  實作 → 審查          │
         └──────────┬───────────┘
                    │
                    ▼
╔═════════════════════════════════════════════════════════════╗
║  STEP 6｜程式碼審查階段                                       ║
╚═════════════════════════════════════════════════════════════╝
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  @Lead 呼叫 @Reviewer                                         │
│  • 動態載入對應 DoD 文件作為審查基準                             │
│  • 三級問題標注：🔴 BLOCKER / 🟡 WARNING / 🟢 SUGGEST          │
│  • 產出：REVIEW_REPORT.md                                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
   ❌ 有 BLOCKER              ✅ 無 BLOCKER
          │                       │
          ▼                       ▼
  開發者修正後重提          @Lead Gate Check
  （最多複審 2 次）          審查 → 測試
  超過 2 次 → 🔴 REVIEW_QUALITY
  @Assistant 自動偵測阻斷
                    │
                    ▼
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
  （最多重測 3 次）          測試 → 收斂
  超過 3 次 → 🔴 QA_QUALITY        │
  @Assistant 自動偵測阻斷           │
                                   ▼
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
              │ User 確認清單 │
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
╔═════════════════════════════════════════════════════════════╗
║  STEP 9｜進化階段                                             ║
╚═════════════════════════════════════════════════════════════╝
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  @Lead 呼叫 @Retro                                            │
│  • 分析 REVIEW_REPORT / TEST_REPORT 的根因                    │
│  • 比對歷史提案，偵測反覆問題（第 3 次 → 🚨 反覆問題警告）        │
│  • 產出：PROPOSAL_YYYYMMDD_NNN.md                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  @Lead 呼叫 @Assistant 巡邏                                   │
│  • 掃描所有產出文件，依 P-01 ~ P-09 偵測異常                    │
│  • 更新 PENDING_ACTIONS.md                                    │
│  • 自動關閉條件已消失的通知                                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
              ┌───────────────┐
              │  等待下一個    │
              │  User 開發指令 │
              └───────────────┘
```

### Gate Check 位置彙整

| Gate 名稱 | 位置 | 觸發者 | 通過條件 |
|---|---|---|---|
| `需求確認` | STEP 1 後 | User | User 確認 User Story 與 AC |
| `實作 → 審查` | STEP 5 後 | `@Lead` | Backend + Frontend DoD 自評全數通過 |
| `審查 → 測試` | STEP 6 後 | `@Lead` | REVIEW_REPORT 無 BLOCKER |
| `測試 → 收斂` | STEP 7 後 | `@Lead` | TEST_REPORT 全數通過 |
| `收斂 → 進化` | STEP 8 後 | User | User 確認 Artifact Checklist |

## 三、Agent 互動關係圖
> 誰可以呼叫誰、誰可以退回誰、通知路徑（一律透過 @Lead）

### 呼叫關係（誰可以呼叫誰）

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
         ├──→ @Reviewer（審查階段）
         └──→ @Retro（進化階段）
```

> **原則**：所有 Agent 只與 `@Lead` 溝通，**禁止 Agent 直接呼叫另一個 Agent**。跨 Agent 的訊息傳遞（例如 @Frontend 退回 API 給 @Architect）一律透過 `@Lead` 轉達。

***

### 退回關係（誰可以退回給誰）

```
@Consultant ──退件→ @Planner（透過 @Lead）
              └─ 觸發：ADVICE 含重大風險或邏輯衝突

@Architect ──退件→ @Planner（透過 @Lead）
             └─ 觸發：技術依賴缺失或需求無法在現有架構實作

@Frontend ──退回 API 規格→ @Architect（透過 @Lead）
             └─ 觸發：API Spec 無法滿足 UI 需求

@Reviewer ──退件→ @Backend / @Frontend（透過 @Lead）
             └─ 觸發：REVIEW_REPORT 含 [BLOCKER]

@QA ──退回→ @Backend / @Frontend（透過 @Lead）
      └─ 觸發：TEST_REPORT 含未解決 Bug
      └─ 觸發（前置）：開發者未完成自身 DoD 測試覆蓋
```

***

### 通知路徑（產出 → @Assistant 偵測）

所有 Agent 完成任務後，**不需要手動發出通知**，`@Assistant` 透過巡邏規則表自動偵測各產出文件的狀態：

```
@Reviewer 產出 REVIEW_REPORT.md
    └─ @Assistant 巡邏 P-01：複審 ≥ 2 次仍有 BLOCKER → 🔴 REVIEW_QUALITY

@QA 產出 TEST_REPORT.md
    └─ @Assistant 巡邏 P-02：重測 ≥ 3 次仍有 Bug → 🔴 QA_QUALITY

@Retro 產出 PROPOSAL_*.md（OPEN）
    └─ @Assistant 巡邏 P-05：新提案待審 → 🟡 RETRO_PROPOSAL
    └─ @Assistant 巡邏 P-04：含 🚨 反覆問題警告 → 🔴 RETRO_REPEAT
    └─ @Assistant 巡邏 P-03：IN_PROGRESS 超時 → 🟡 RETRO_TIMEOUT

@Consultant 產出 ADVICE_*.md
    └─ @Assistant 巡邏 P-06：含領域衝突警告且 strategyWeight 未填 → 🔴 CONSULTANT_CONFLICT
    └─ @Assistant 巡邏 P-07：含 ⚠️ 未採納高風險建議 → 🔴 CONSULTANT_RISK

@Frontend 發出 API 退回通知
    └─ @Assistant 巡邏 P-08：超過一個任務週期未回應 → 🟡 FRONTEND_API_BLOCK

@Reviewer 標記 Hotfix
    └─ @Assistant 巡邏 P-09：收斂文件尚未更新 → 🟡 HOTFIX_DOC_PENDING
```

***

### 文件所有權對應表

每份文件只有一個負責產出的 Agent，其他 Agent 只能讀取：

| 文件 / 目錄 | 產出者 | 可讀取者 |
|---|---|---|
| `PENDING_ACTIONS.md` | `@Assistant` / `@Lead` | 全體 |
| `ideas/preplan/draft/finishedplan_features.md` | `@Planner` | 全體 |
| `docs/plans/advice/ADVICE_*.md` | `@Consultant` | `@Planner`、`@Lead`、`@Assistant` |
| `ADVICE_RESPONSE_*.md` | `@Planner` | `@Consultant`、`@Lead` |
| `docs/api/<模組>_api.md` | `@Architect` | `@Backend`、`@Frontend`、`@Reviewer`、`@QA` |
| `docs/architecture.md` / `docs/modules/` | `@Architect`（收斂階段） | 全體 |
| `TEST_SPEC_*.md` | `@QA` | `@Backend`、`@Frontend`、`@Lead` |
| `TEST_REPORT.md` | `@QA` | `@Lead`、`@Assistant`、`@Retro`、`@Planner` |
| `REVIEW_REPORT.md` | `@Reviewer` | `@Lead`、`@Assistant`、`@Retro`、`@Backend`、`@Frontend` |
| `.agents/proposals/PROPOSAL_*.md` | `@Retro` | `@Lead`、`@Assistant`、User |
| `src/` | `@Backend` | `@Reviewer`、`@QA` |
| `webapp/` | `@Frontend` | `@Reviewer`、`@QA` |

## 四、阻斷機制對應表
> 9 條巡邏規則（P-01 ~ P-09）× 觸發來源 × 嚴重程度 × 阻斷新功能與否 × User 解除指令格式

### P-01 ~ P-09 巡邏規則完整對應

| 巡邏 ID | 掃描目標文件 | 偵測條件 | 通知類型 | 嚴重程度 | 阻斷新功能 | User 解除指令 |
|---|---|---|---|---|---|---|
| P-01 | `REVIEW_REPORT.md` | 審查結論為退件，且同功能**複審 ≥ 2 次** | `REVIEW_QUALITY` | 🔴 | ✅ | `重新評估實作方案 <功能名稱>` |
| P-02 | `TEST_REPORT.md` | 測試結論為未通過，且同功能**重測 ≥ 3 次** | `QA_QUALITY` | 🔴 | ✅ | `重新評估需求範圍 <功能名稱>` |
| P-03 | `.agents/proposals/*.md` | 狀態為 `IN_PROGRESS`，且距上次 Retro 執行後未更新 | `RETRO_TIMEOUT` | 🟡 | ❌ | `繼續執行提案 PROPOSAL_YYYYMMDD_NNN` 或 `拒絕提案 PROPOSAL_YYYYMMDD_NNN，原因：<說明>` |
| P-04 | `.agents/proposals/*.md` | 狀態為 `OPEN`，且文件頂部含 `🚨 反覆問題警告` | `RETRO_REPEAT` | 🔴 | ✅ | `採納提案 PROPOSAL_YYYYMMDD_NNN` |
| P-05 | `.agents/proposals/*.md` | 狀態為 `OPEN`（任何新提案） | `RETRO_PROPOSAL` | 🟡 | ❌ | `採納提案 PROPOSAL_YYYYMMDD_NNN` 或 `拒絕提案 PROPOSAL_YYYYMMDD_NNN，原因：<說明>` |
| P-06 | `docs/plans/advice/ADVICE_*.md` | 含 `🚨 領域衝突警告`，且 `strategyWeight` 欄位為空或未填 | `CONSULTANT_CONFLICT` | 🔴 | ✅ | 直接在 `ADVICE_*.md` 填寫 `strategyWeight: { <領域A>: 0.X, <領域B>: 0.X }`，完成後回覆 `已填寫 strategyWeight，請繼續` |
| P-07 | `docs/plans/advice/ADVICE_*.md` | 含 `⚠️ 未採納高風險建議` | `CONSULTANT_RISK` | 🔴 | ✅ | `確認接受風險 <ADVICE_*.md 檔名>` 或 `退回修改需求 <功能名稱>` |
| P-08 | `docs/api/*.md` 或任何架構文件 | `@Frontend` 正式發出 API 規格退回請求，且超過一個任務週期未回應 | `FRONTEND_API_BLOCK` | 🟡 | ❌ | `確認 API 規格修改 <模組名稱>` |
| P-09 | `REVIEW_REPORT.md` | 標記為 Hotfix 且收斂文件尚未更新的項目 | `HOTFIX_DOC_PENDING` | 🟡 | ❌ | （更新收斂文件後，`@Assistant` 自動關閉） |

***

### 阻斷層級說明

| 嚴重程度 | 行為 | 數量（本系統） |
|---|---|---|
| 🔴 **必須立即處理** | `@Lead` 拒絕啟動任何新功能開發，直到 User 處理並解除 | 6 條（P-01、P-02、P-04、P-06、P-07） |
| 🟡 **待處理** | 不阻斷開發，但 `@Lead` 在下次任務收斂時必須附帶提醒 | 4 條（P-03、P-05、P-08、P-09） |

***

### 阻斷通知標準格式

當 `@Lead` 因 🔴 項目拒絕啟動新功能時，回覆格式如下：

```
🚫 新功能啟動已阻斷

原因：PENDING_ACTIONS.md 存在以下未處理的 🔴 項目：
- [BLOCK_001] <通知類型>：<說明>

請先處理以上項目後，再重新下達開發指令。
處理指令：<對應的 User 標準指令格式>
```

***

### 自動關閉機制

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

***

### 重複偵測防呆

同一來源文件的同一條件，在同一功能週期內**只寫入一次**。判斷方式：`PENDING_ACTIONS.md` 中已存在相同 `type` + 相同 `ref` 的未關閉項目時，跳過不重複新增。

## 五、動態注入機制彙整
> 三個採用動態注入設計的 Agent（@Consultant / @Backend / @Frontend / @Reviewer / @QA）各自的注入來源

本系統有五個 Agent 採用「動態注入」設計——核心行為不硬編碼在 rules 中，而是由 `@Lead` 任務時傳入的外部文件決定。這個設計讓系統具備高度擴充性：新增領域知識、技術規範或技能手冊時，**只需新增對應文件，不需修改任何 Agent 的 rules 本體**。

***

### 注入來源文件目錄結構

```
.agents/
├── domains/          ← @Consultant 的領域知識庫（金融流派）
│   ├── <領域名稱>.md
│   └── ...
├── tech-stacks/      ← @Backend / @Frontend 的技術規範
│   ├── <技術名稱>.md
│   ├── testing-nodejs.md
│   └── ...
├── skills/           ← @Backend / @Frontend / @Reviewer / @QA 的技能手冊
│   ├── telegram-bot-pattern.md
│   ├── telegram-miniapp-pattern.md
│   ├── deploy-oracle.md
│   └── infra-constraints.md
└── tasks/            ← 特定任務型態的審查規範
    └── security-review.md
```

***

### 各 Agent 動態注入對應表

#### @Consultant — 領域知識注入

| 注入來源 | 目錄 | 決定內容 | 觸發時機 |
|---|---|---|---|
| `domains/<領域名稱>.md` | `.agents/domains/` | 發言視角、審查邏輯、衝突偵測依據 | 每次 @Lead 呼叫 @Consultant 時傳入 |

**注入行為規則**：
- 每次回覆必須以 `【領域：<名稱>】` 標示發言視角
- 傳入多個領域時，每段各自標示，禁止混合發言
- 若計畫出現 `domains/` 未涵蓋的術語 → 標示 `❓ 未知知識領域`，建議補充 domain 檔

**擴充方式**：新增一個金融流派只需在 `.agents/domains/` 建立對應 `.md`，`@Consultant` 即可化身為該領域專家。

***

#### @Backend — 技術棧注入

| 注入來源 | 目錄 | 決定內容 | 觸發條件 |
|---|---|---|---|
| `tech-stacks/<技術名稱>.md` | `.agents/tech-stacks/` | 程式語言規範、持久層存取方式、伺服器架構 | 每次任務必須傳入 |
| `skills/telegram-bot-pattern.md` | `.agents/skills/` | Telegram Bot、Webhook handler 開發模式 | 任務涉及 Telegram Bot / Webhook / Mini App 後端 |
| `skills/deploy-oracle.md` | `.agents/skills/` | Oracle VM 部署流程、PM2 操作 | 任務涉及部署操作說明 |
| `skills/infra-constraints.md` | `.agents/skills/` | 記憶體限制、資源上限、禁用技術清單 | 任務涉及系統資源 / 基礎設施評估 |

***

#### @Frontend — 技術棧注入

| 注入來源 | 目錄 | 決定內容 | 觸發條件 |
|---|---|---|---|
| `tech-stacks/<技術名稱>.md` | `.agents/tech-stacks/` | 前端框架規範、平台 SDK 要求 | 每次任務必須傳入 |
| `skills/telegram-miniapp-pattern.md` | `.agents/skills/` | Telegram Mini App UI、WebApp SDK、ThemeParams | 任務涉及 Telegram Mini App UI / WebApp SDK / 主題樣式 |
| `skills/infra-constraints.md` | `.agents/skills/` | 基礎設施限制評估 | 任務涉及系統資源或基礎設施限制評估 |

***

#### @Reviewer — 動態審查範疇注入

| 注入來源 | 決定內容 | 觸發條件（任務範疇） |
|---|---|---|
| `backend.md` 的「完成定義」+「排程任務規範」章節 | Backend 審查 Checklist | 任務涉及 `src/` |
| `frontend.md` 的「完成定義」章節 | Frontend 審查 Checklist | 任務涉及 `webapp/` |
| `skills/telegram-bot-pattern.md` | Bot / Webhook 審查重點 | 任務涉及 Telegram Bot / Webhook |
| `skills/telegram-miniapp-pattern.md` | Mini App UI 審查重點 | 任務涉及 Telegram Mini App UI |
| `tasks/security-review.md` | 安全性審查項目 | 任務涉及 API Token / Telegram Auth / 敏感金鑰 |
| `skills/deploy-oracle.md` | 部署變更審查項目 | 任務涉及 Oracle VM 部署相關變更 |

**設計優點**：`@Reviewer` 本身不持有任何 Checklist，永遠審查各 Agent DoD 的**最新版本**，不會因 `reviewer.md` 未同步更新而遺漏規範。

***

#### @QA — 動態測試範疇注入

| 注入來源 | 額外測試重點 | 觸發條件（任務範疇） |
|---|---|---|
| `backend.md` 的「排程任務規範」 | 冪等性、靜默失敗、執行日誌格式 | 任務涉及 `src/` 或排程任務 |
| `frontend.md` 的「完成定義」 | UI 三態、Empty State、響應式 | 任務涉及 `webapp/` |
| `skills/telegram-bot-pattern.md` | Webhook 重試行為、429 處理 | 任務涉及 Telegram Bot / Webhook |
| `skills/telegram-miniapp-pattern.md` | initData 驗證、ThemeParams、BackButton | 任務涉及 Telegram Mini App UI |
| `tasks/security-review.md` | 與 @Reviewer 安全審查結果對照 | 任務涉及安全性 |
| `tech-stacks/testing-nodejs.md` | 測試框架規範、可重複執行要求 | 每次測試任務必須傳入 |

***

### 動態注入 vs 硬編碼的設計對比

| 面向 | 動態注入（本系統） | 硬編碼 |
|---|---|---|
| **擴充成本** | 新增文件即可，不修改 rules | 每次擴充需修改 rules 本體 |
| **規範一致性** | @Reviewer / @QA 永遠讀最新版 DoD | 可能因未同步而審查舊規範 |
| **職責清晰度** | 知識來源單一，可追溯 | 知識分散在多個 rules 中 |
| **風險** | 傳入文件品質決定輸出品質 | 規範直接可見，但維護成本高 |

## 六、退件/重提次數上限一覽
> 各階段的上限設定與觸發後的連鎖動作

### 次數上限彙整表

| 階段 | 退件發出方 | 退件接收方 | 上限次數 | 超限觸發 | 對應巡邏規則 | 嚴重程度 |
|---|---|---|---|---|---|---|
| 審查階段 | `@Reviewer` | `@Backend` / `@Frontend` | **2 次複審** | 同功能複審達第 2 次仍有 BLOCKER | P-01 | 🔴 |
| 測試階段 | `@QA` | `@Backend` / `@Frontend` | **3 次重測** | 同功能重測達第 3 次仍有未解決 Bug | P-02 | 🔴 |
| 提案採納 | `@Retro` → User | `@Lead` | **無上限** | 同 Agent + 同根因累計第 3 次出現 | P-04 | 🔴 |
| 提案執行 | User 採納後 | `@Lead` | **1 個任務週期** | IN_PROGRESS 超過一個任務週期未完成 | P-03 | 🟡 |

***

### 次數計算規則

#### 審查複審次數（P-01）

```
計算單位：同一功能名稱的 REVIEW_REPORT.md

第 1 次：@Reviewer 初審 → 退件（有 BLOCKER）
          → @Backend / @Frontend 修正後重提
第 2 次：@Reviewer 複審 → 仍有 BLOCKER
          → @Assistant 巡邏偵測到 P-01 觸發條件成立
          → 自動產生 🔴 REVIEW_QUALITY 通知
          → @Lead 阻斷新功能啟動，等待 User 指令
```

**重置條件**：User 下達 `重新評估實作方案 <功能名稱>` 後，`@Lead` 重新規劃方案，計數器歸零。

***

#### 測試重測次數（P-02）

```
計算單位：同一功能名稱的 TEST_REPORT.md

第 1 次：@QA 初測 → 有未解決 Bug
          → @Backend / @Frontend 修正後重測
第 2 次：@QA 重測 → 仍有 Bug
          → 繼續，但 @Lead 於收斂時發出警示
第 3 次：@QA 重測 → 仍有 Bug
          → @Assistant 巡邏偵測到 P-02 觸發條件成立
          → 自動產生 🔴 QA_QUALITY 通知
          → @Lead 阻斷新功能啟動，等待 User 指令
```

**重置條件**：User 下達 `重新評估需求範圍 <功能名稱>` 後，`@Lead` 縮小或重新定義範圍，計數器歸零。

***

#### 提案反覆次數（P-04）

```
計算單位：同一 Agent + 同一根因分類（跨功能累計）

@Retro 執行歷史比對時，以「目標 Agent + 根因分類」為鍵值計數：

第 1 次：產出 PROPOSAL → OPEN，等待 User 決策
第 2 次：同 Agent + 同根因再次出現 → 於提案中標注歷史提案參考
第 3 次：同 Agent + 同根因第三度出現 → 提案頂部加上 🚨 反覆問題警告
          → 必須等待 User 明確確認才可進入 IN_PROGRESS
          → @Assistant 巡邏偵測到 P-04 觸發條件成立
          → 自動產生 🔴 RETRO_REPEAT 通知
```

**特殊計數規則**：
- `REJECTED` 狀態的提案**納入計數**（拒絕修正後再次發生，風險更高）
- `IN_PROGRESS` 狀態的提案**不計入已解決**（避免誤判）
- `ARCHIVED` 狀態的提案**不計入**（已套用完成）

***

#### 提案執行逾時（P-03）

```
計算單位：個別 PROPOSAL 的 IN_PROGRESS 停留時間

觸發邏輯：
@Retro 執行歷史比對時（每完成 3 個功能或即時觸發）：
  若發現某提案停留 IN_PROGRESS 超過一個任務週期
  → 在提案頂部加上 ⚠️ 提案執行逾時 標注
  → @Assistant 巡邏偵測後產生 🟡 RETRO_TIMEOUT 通知

「一個任務週期」定義：
  上一次 Retro 執行時間點 → 本次 Retro 執行時間點之間的期間
```

***

### 超限後的連鎖動作

```
超限事件發生
    │
    ▼
@Assistant 自動偵測（下次巡邏時）
    │
    ▼
PENDING_ACTIONS.md 新增 🔴 項目
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

***

### 次數設計的背後邏輯

| 階段 | 上限 | 設計理由 |
|---|---|---|
| 審查複審 | 2 次 | 第 2 次仍失敗代表問題可能源自架構或需求，繼續複審無法解決根本問題 |
| 測試重測 | 3 次 | 投資訊號錯誤的代價高，給予較多修正機會，但超過 3 次代表需重新審視需求範圍 |
| 提案反覆 | 3 次 | 同一問題三度出現代表規則本身有系統性缺失，需要 User 明確介入決策 |
| 提案執行 | 1 週期 | 被採納的規則更新若長期未執行，等同虛假承諾，需強制提醒 |

## 七、提案生命週期（@Retro）
> OPEN → IN_PROGRESS → ARCHIVED/REJECTED 狀態機圖示

### 狀態機圖示

```
                    @Retro 產出提案
                          │
                          ▼
                    ┌─────────────┐
                    │    OPEN     │  ← 初始狀態
                    │  （待審）   │     @Assistant 偵測後
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
       │ IN_PROGRESS │           │  REJECTED   │  ← 終態
       │  （執行中） │           │  （已拒絕） │     永久保留
       └──────┬──────┘           └─────────────┘
              │                         ↑
              │                  納入反覆問題計數
              │
       ┌──────┴──────────────────────┐
       │                             │
       ▼                             ▼
  @Lead 執行完成                超過一個任務週期
  規則更新套用                   未完成
       │                             │
       ▼                             ▼
  ┌─────────────┐           ⚠️ 逾時標注寫入提案頂部
  │  ARCHIVED   │  ← 終態    @Assistant 偵測後
  │  （已套用） │            產生 🟡 RETRO_TIMEOUT
  └─────────────┘            等待 User 確認
        ↑
  永久保留
  不納入反覆計數
```

***

### 四種狀態定義

| 狀態 | 說明 | 是否納入反覆問題計數 | 下一步 |
|---|---|---|---|
| `OPEN` | 提案已產出，等待 User 審查 | ❌（尚未決策） | User 採納或拒絕 |
| `IN_PROGRESS` | User 已採納，`@Lead` 正在執行規則更新 | ❌（視為進行中，不計入已解決） | `@Lead` 完成後改為 ARCHIVED |
| `ARCHIVED` | 規則更新已完成，永久保留供歷史參考 | ❌（已解決，不計入） | 無，終態 |
| `REJECTED` | User 拒絕採納，附原因永久保留 | ✅（問題未修正，納入再發計數） | 無，終態 |

***

### User 操作指令格式

#### 採納提案
```
採納提案 PROPOSAL_YYYYMMDD_NNN
```
`@Lead` 收到後執行對應 `.agents/` 規則文件的更新，完成後將狀態改為 `ARCHIVED`。

#### 拒絕提案
```
拒絕提案 PROPOSAL_YYYYMMDD_NNN，原因：<一句話說明>
```
`@Lead` 收到後將狀態改為 `REJECTED`，原因永久附記於提案文件。

#### 繼續執行逾時提案
```
繼續執行提案 PROPOSAL_YYYYMMDD_NNN
```
重新確認 `IN_PROGRESS`，清除逾時標注，`@Assistant` 下次巡邏後自動關閉 `RETRO_TIMEOUT`。

***

### 提案粒度規則

每份提案只能包含以下**一項修改**：

| 限制 | 說明 |
|---|---|
| **一個目標 Agent** | 禁止在單一提案中同時修改多個 Agent 的規則 |
| **一條規則變更** | 禁止在單一提案中同時新增多條規則或修改多個章節 |
| **一個根因層級** | 每份提案對應一個明確的根因（REQ / ARCH / DEV / TEST） |

**設計理由**：確保每份提案可以獨立採納或拒絕，避免「捆綁決策」讓 User 難以評估個別修改的必要性。

***

### 反覆問題警告觸發流程

```
@Retro 執行歷史比對
    │
    ▼
以「目標 Agent + 根因分類」為鍵值
掃描 .agents/proposals/ 所有提案（含所有狀態）
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
         @Assistant 巡邏 P-04 偵測後
         自動產生 🔴 RETRO_REPEAT 通知
         @Lead 阻斷新功能啟動
```

***

### 知識點保留規則

當提案內容包含新的 SOP、技術手冊或領域知識文件時，`@Retro` 必須在提案中同時標注：

```markdown
📌 請 @Lead 將新檔案路徑與觸發情境更新至 `lead.md` 的資源與上下文映射表
新增文件：.agents/<路徑>/<檔名>.md
觸發情境：<說明何時應傳入此文件>
```

確保新知識被正確納入 `@Lead` 的動態注入機制，而非孤立存在於 `.agents/` 目錄中。

***

### 提案目錄結構

```
.agents/
└── proposals/
    ├── PROPOSAL_20250101_001.md   ← ARCHIVED（已套用）
    ├── PROPOSAL_20250115_002.md   ← REJECTED（已拒絕，附原因）
    ├── PROPOSAL_20250201_003.md   ← IN_PROGRESS（執行中）
    └── PROPOSAL_20250210_004.md   ← OPEN（待審）
```

所有提案**永久保留**，不論狀態為何均不刪除，作為系統進化的歷史軌跡。
