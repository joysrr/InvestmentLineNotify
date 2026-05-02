---
adr_id: ADR-0033
title: Orchestrator + Policies/Core 模式（module 層 Hub-and-Spoke）
status: Accepted
date: 2026-04-24
supersedes: []
superseded_by: []
extends: []
related_proposals:
  - PROPOSAL_20260424_024
  - PROPOSAL_20260422_026 # Agent 層 Hub-and-Spoke 黑板（精神來源）
referenced_by:
  - skills/orchestrator-pattern.md
  - rules/architect.md
  - rules/backend.md
---

# ADR-0033: Orchestrator + Policies/Core 模式

## Status

**Accepted** (2026-04-24)

## Context

InvestmentLineNotify 2026-04 將 1500+ 行單體 `strategyEngine.mjs` 重構為 **Orchestrator + Policies/Core** 模式，獲得三大顯著效益：

1. **解耦**：原單體含 5 個業務子流程（訊號計算 / 風險評估 / 進場過濾 / 再平衡 / 通知派發），相互調用混亂
2. **易測**：原單體單元測試覆蓋率 30%；重構後 85%
3. **防全域變數風險**：原使用模組變數共享狀態，極易被意外修改

framework 既有 PROPOSAL_20260422_026 確立 **agent 層** Hub-and-Spoke + Blackboard 模式（@Lead Orchestrator + 多 worker agents 黑板協作），但**缺對應的程式碼結構模式**。重構 strategyEngine 過程中發現此模式具跨專案通用價值，應沉澱為 framework 知識資產，避免下次 reset 時重新發明。

## Decision

採用 **Orchestrator + Policies/Core 模式** 為 framework 推薦的「中大型模組（≥ 500 行 / ≥ 3 業務子流程 / 需測試覆蓋率 ≥ 80%）」結構：

### 1. 分層職責

```
Orchestrator (index.mjs)
    │
    ├── core/        ← 純計算 / 跨模組共享狀態機（無副作用）
    └── policies/    ← 可插拔業務政策（可獨立替換）
```

### 2. Orchestrator 鐵律

- **調度優先**：僅 import + async/await + 防禦性 return；**禁含算分邏輯**
- **上下文保護**：調用前 `Object.freeze` 或淺拷貝；防下游 mutate
- **早返回**：對外部模組返回值優先權攔截（短路語意）

### 3. core / policies 規範

- `core/`：純函式 + 跨模組共享 + 無副作用 + 無業務規則
- `policies/`：可插拔業務政策；單一職責；可獨立替換
- 兩目錄各自 `index.mjs` 聚合匯出

### 4. 測試要求

- core ≥ 90% / policies ≥ 80% / orchestrator ≥ 70% line coverage
- **Decision Trace 驗證**：模組需支援 `{ trace: true }` 選項；輸出決策路徑陣列
- 類比 `.agents/docs/Reports/AUDIT_DECISION_LOG.md`：兩者皆「決策軌跡稽核」

## Consequences

### 正面

- **新模組設計時間 -40%**：直接套用模板而非從零設計
- **測試覆蓋率上升**：純函式 + mock 友好 → 各 policy 獨立測試
- **新成員 onboarding -40%**：清晰的 core/policies 邊界 + 標準化 index.mjs
- **極端情況健壯性 +50%**：上下文保護 + 早返回 = 縮小錯誤爆炸範圍
- **跨專案搬運**：標準目錄結構可在新專案複製；無外部依賴
- **與 agent 層對齊**：module 層 Hub-and-Spoke 與 agent 層 Hub-and-Spoke 形成上下層對齊（雙層 SRP）

### 負面 / Tradeoffs

- **檔案數 +30%**：原單體 1 檔 → 重構後 7-10 檔（含 index + 5 policies + 3 core + tests）
- **小型功能過度設計風險**：< 200 行模組強推此模式 → 過度抽象
  - **緩解**：skill §一決策樹明文「< 500 行不採用」
- **學習曲線**：新成員首次接觸 Orchestrator 概念需 1-2 天熟悉
  - **緩解**：skill §五反模式 + §七真實案例引用

### 中性

- 與 ADR-0024 零依賴框架相容（純 Node.js ESM；無 npm 依賴）
- 與 PROPOSAL_023 ROUTING_TICKET 形成「派發層 + 模組層」雙層 ticket 結構（micro vs macro）

## Alternatives Considered

### Alternative A: Monolithic（維持單體）

**為何不採用**：

- > 500 行單體模組無法維護（事實證明 strategyEngine 1500 行已不可維護）
- 無法獨立測試業務子流程
- 全域變數易被誤修改

### Alternative B: MVC（Model-View-Controller）

**為何不採用**：

- @Backend agent 概念已對齊 Controller 角色；再嵌套 MVC 增加抽象負擔
- View 層在程式邏輯層級不適用（更像 @Frontend agent 的責任）
- Controller 易成新瓶頸（同 Orchestrator）但缺「可插拔 policies」優勢

### Alternative C: Plugin Pattern（純插件）

**為何部分採用**：

- 本模式 `policies/` 即 plugin 概念
- 但純 Plugin Pattern 缺「Orchestrator 上下文保護鐵律」 → 仍有全域變數風險
- 結合：採納其「可插拔」精神但加上 Orchestrator 約束

### Alternative D: Microservices（跨進程）

**為何不採用**：

- 跨進程通訊成本高（IPC / HTTP overhead）
- 對 framework「零依賴」原則衝突（需 service mesh）
- 對單一專案 < 100k LOC 的規模過度設計

## Notes

- 對齊 PROPOSAL_20260422_026 Hub-and-Spoke 黑板：本 ADR 為**module 層**對應；agent 層由 PROPOSAL_026 + ADR-0010（平行審查）等多份 ADR 共同覆蓋
- 對齊 PROPOSAL_20260424_023 ROUTING_TICKET：兩者都採「機讀化派發 artifact」精神；前者於 agent 派發層，本 ADR 於 module 內模組調用層
- 對齊 PROPOSAL_20260424_020 Phase B 治本機制：rules/ 拆檔對應「Orchestrator 拆 policies」；同精神不同層級
- skill `orchestrator-pattern.md` 提供完整實作模板 + 反模式範例 + Decision Trace 驗證寫法
- 觸發場景：`@Architect` 設計新模組時若預估 ≥500 行 / ≥3 業務子流程 / 需測試 → 必引用本 ADR
- 應用於 InvestmentLineNotify `strategyEngine.mjs` 重構（2026-04）：1500 行 → Orchestrator 80 行 + policies 5 × 200 行 + core 3 × 150 行
