---
task_id: emergency-shutdown-playbook
file_type: playbook
owner: @Lead
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_005
purpose: |
  中斷重啟 / 全局緊急阻斷三條件 / Hotfix Fast Lane 入口（Hotfix 詳細 SOP 見 hotfix-checklist）
referenced_by:
  - rules/system-prompt.md
  - rules/lead.md
  - skills/diagnostic-playbook.md
  - skills/examples/assistant-examples.md
  - skills/lead-context-mappings.md
  - skills/lead-dispatch-patterns.md
---

# Task: Emergency Shutdown & Hotfix Playbook（緊急阻斷與修復手冊）

> 處理「🔴/🟡 中斷觸發」+「Hotfix Fast Lane」的完整 SOP。

---

## 一、中斷與重啟機制 (Interrupt & Resume)

系統觸發 🔴 / 🟡 警告中斷後，User 解除阻斷時依下表退回對應節點：

| 介入代碼 | 觸發狀態                 | Resume Point                                                                                                   |
| :------- | :----------------------- | :------------------------------------------------------------------------------------------------------------- |
| **P-01** | `REVIEW_QUALITY` 🔴      | 退回 `@Planner` 重評實作架構或拆分任務                                                                         |
| **P-02** | `QA_QUALITY` 🔴          | 退回 `@Backend` / `@Frontend` 附 User 解法提示重實作                                                           |
| **P-03** | `RETRO_TIMEOUT` 🟡       | 追蹤 `PROPOSAL_*.md` 執行狀態；User 決策繼續→維持 IN_PROGRESS、放棄→改 REJECTED 附原因                         |
| **P-04** | `RETRO_REPEAT` 🔴        | 立即執行 User 同意的規則合併後繼續中斷任務                                                                     |
| **P-06** | `CONSULTANT_CONFLICT` 🔴 | 退回 `@Planner` 讀 `strategyWeight`；`@Assistant` 巡邏自動關閉                                                 |
| **P-07** | `CONSULTANT_RISK` 🔴     | User 確認接受→`@Architect` 標注風險續設計；要求修改→退回 `@Planner` 縮減需求                                   |
| **P-08** | `FRONTEND_API_BLOCK` 🟡  | 退回 `@Architect` 重產 API Spec                                                                                |
| **P-10** | `SECURITY_AUDIT_FAIL` 🔴 | 退回 `@Backend` / `@Frontend` 附 User 解法提示重實作；複審次數計入 `REVIEW_CYCLE_LIMIT`（與 `@Reviewer` 共用） |

**Resume 執行步驟**：

1. User 下達解除指令（對齊 `skills/assistant-user-commands.md`）
2. `@Lead` 讀取 `PENDING_ACTIONS.md` 中斷前狀態錨點
3. 依上表 Resume Point 派發對應 Agent
4. 中斷前完成的產出物保留（不重做）；僅重做違規或失敗的步驟

---

## 二、全局緊急阻斷三條件（對齊 `system-prompt.md §全局緊急阻斷`）

以下三條件**任一觸發**即進入全局緊急阻斷狀態：

1. **協調失敗**：@Lead 累積 ≥ 3 次違反 `stateless-routing-pattern` 三鐵律
2. **🔴 超時**：`PENDING_ACTIONS.md` 存在超過 `PENDING_RED_EXPIRE`（依 §十四，預設 2 工作對話）未處理的 🔴 項目
3. **strategyWeight 違規**：任何繞過 `@Consultant → @Lead → @Backend` 流程的異動

**觸發後處置**：

- 立即暫停所有派發與 Agent 執行
- `@Lead` 產出緊急通知（含觸發條件、違規證據、解除條件）
- 等待 User 明確指令解除（對齊 `system-prompt.md` 解除路徑）

**恢復流程**：

1. User 確認違規根因已移除
2. `@Retro` 根因分析（強制 `Model: opus + Lane: heavy`）
3. 產出改善提案（PROPOSAL_YYYYMMDD_NNN）
4. User 採納後 @Lead 執行；執行完成後阻斷解除

---

## 三、緊急修復通道 (Hotfix Fast Lane)

### 3.1 觸發條件（任一）

- 生產通知系統中斷
- cron job 停止超過一週期
- 伺服器異常、API 無法回應
- User 明確說「緊急」/「Hotfix」/「線上問題」

### 3.2 執行流程

#### 3.2.0 Step 0：@Lead 複雜度判定

**完整 SOP**：`tasks/hotfix-checklist.md` Step 0（yaml schema + 5 步驟 + 強制要求 + 違規偵測）

簡述：依 D1-D4 + SC-01~10 決策樹；SC/D 任一觸發強制 heavy；hotfix_tier 必填且與派發訊息 `Complexity-Tier` 一致。

> **SSOT**：本節僅引導；完整 yaml 範例 / 強制要求 / 違規回應全在 `hotfix-checklist.md` Step 0；本檔不複製避免漂移。

---

#### 3.2.A 🟢 輕量路徑（light；3 步驟；恢復 PROPOSAL_20260422_026 原設計）

**適用條件**：Step 0 判定為 `light`；SC/D 全否 + 單檔 + 純文字/設定

1. **Step 1：修復實作**

- `@Backend` / `@Frontend` 實作修復（限縮單檔內）

2. **Step 2：@Reviewer 快速審查**

- 職責回歸；關注「是否真為 typo 級變更」+「是否無意外牽動」

3. **Step 3：@Lead Gate Check 3 條件**

- (1) 修復說明單行敘述（< 50 字）
- (2) `@Reviewer` 結論「通過」
- (3) 事後補文件**可免**（light 路徑專屬豁免）

**light 路徑禁止項**：

- ❌ 不可跳過 Step 0 判定（防 bypass）
- ❌ 不可用於 SC/D 任一觸發場景（即使判定者認為「很小」）
- ❌ 不可擴充範圍（若修復過程發現需跨檔 → 立即升級為 heavy 重走 Step 0）

---

#### 3.2.B 🔴 重型路徑（heavy；5 步驟；依 PROPOSAL_20260423_003 三支柱全流程）

**適用條件**：Step 0 判定為 `heavy`；SC/D 任一觸發 或 跨檔 或 業務邏輯變更

1. **Step 1：診斷階段**（依 §十九.B）

- **單人診斷**（D1-D4 全否）：`@Backend` / `@Frontend` 獨立執行 `skills/diagnostic-playbook.md` 五步 SOP
- **診斷組**（D1-D4 任一觸發）：`@Backend|@Frontend` + `@Reviewer` 雙眼診斷
- 產出 `docs/plans/diagnosis/<事故名稱>.md`

2. **Step 2：修復實作 + 條件式資安審查**

- `@Backend` / `@Frontend` 實作修復（限縮至 `DIAGNOSIS_NOTE.md § 六 修復範圍`）
- `@Reviewer` 快速審查
- **若 SC 觸發** → `@Security` **平行**快速審查（§十九.C）

3. **Step 3：@QA 核心路徑驗證**

- 不要求完整回歸；僅驗證「修復涉及的核心路徑」

4. **Step 4：@Lead Hotfix Gate Check 4 條件**

- (1) `@Backend` / `@Frontend` 修復說明已產出，範圍已限縮
- (2) `@Reviewer` 快速審查結論「通過」
- (3) `@QA` 核心路徑驗證通過
- **(4)**（若 SC 觸發）`@Security` 審查結論「通過」且無 🔴 BLOCKER

5. **Step 5：事後補文件**

- 合併後 `@Lead` 於下一正常任務結束時提醒 `@Architect` 補充
- 若 D1-D4 觸發 → `@Retro` 根因分析入 retro queue

### 3.3 行為守則

- **跳過階段**：Planner / Consultant / Architect 全部跳過
- **診斷組條件式組成**（新）：依 `RULES_DESIGN_GUIDE §十九.B` D1-D4 判定
- **@Security 條件式介入**（新）：依 `§十九.C` SC-01~SC-10 判定；**預設必評估，不預設跳過**
- **上下文注入強制**（新）：`@Lead` 派發訊息**必須**附 `Incident-Context`（對齊 §十九.D）
- **事後補文件**：合併後 `@Lead` 於下一正常任務結束時提醒 `@Architect` 補充
- **不可濫用**：功能新增 / 效能優化 / UI 調整**一律不可用 Hotfix 通道**
- **強制升等**：依 PROPOSAL_024 `force_complex_scenarios`，Hotfix 路徑強制 `Model: opus + Lane: heavy`

### 3.4 Hotfix vs Fast Lane 語意區分（對齊 PROPOSAL_032）

| 項目      | Hotfix Fast Lane（本 task）    | Fast Lane（PROPOSAL_032）     |
| --------- | ------------------------------ | ----------------------------- |
| 觸發      | 生產環境緊急事件               | 日常低風險任務（錯字 / 樣式） |
| User 授權 | 必須明示「啟動 Hotfix」        | 自動路由（無需特別指令）      |
| 審查等級  | 跳過大部分但保留緊急審查       | 零交叉審查                    |
| 事後      | 強制執行 @Retro 根因           | 可略過                        |
| 模型      | **強制 opus**（force_complex） | **haiku**（simple 對應）      |

**兩者可共存、不衝突**：Hotfix 為生產事故緊急通道；Fast Lane 為日常敏捷通道。

### 3.5 事故分類決策樹（協助 @Lead 在 Step 0 快速判定；依 PROPOSAL_20260423_003）

```
┌─ 事故涉及 ≥ 2 個模組？
│ ├─ 是 → D1 觸發：組診斷組
│ └─ 否 → 進入下一判定
│
├─ 疑似 race condition / memory leak / 併發？
│ ├─ 是 → D2 觸發：組診斷組
│ └─ 否 → 進入下一判定
│
├─ 同模組 24h 內第 2 次 Hotfix？
│ ├─ 是 → D3 觸發：組診斷組
│ └─ 否 → 進入下一判定
│
├─ User 明示「複雜」/「跨層」？
│ ├─ 是 → D4 觸發：組診斷組
│ └─ 否 → 單人診斷
│
└─ SC-01~SC-10 任一觸發？
 ├─ 是 → @Security 強制平行介入
 └─ 否 → 記錄「SC 評估：不觸發 + 理由」
```

### 3.6 診斷組 vs @Security 關係

| 場景                   | 診斷組  | @Security   | 說明                                                    |
| ---------------------- | ------- | ----------- | ------------------------------------------------------- |
| D1-D4 任一 + SC 任一   | ✅ 組成 | ✅ 平行介入 | 最複雜 Hotfix：三方並行（實作者 + Reviewer + Security） |
| D1-D4 任一 + SC 不觸發 | ✅ 組成 | ❌ 不介入   | 複雜事故但非資安類                                      |
| D1-D4 排除 + SC 任一   | ❌ 單人 | ✅ 平行介入 | 簡單事故但涉資安（如單檔 XSS）                          |
| D1-D4 排除 + SC 不觸發 | ❌ 單人 | ❌ 不介入   | 最單純 Hotfix（原流程）                                 |

**協作規範**：

- 診斷組的 `@Reviewer` 與資安審查的 `@Security` 職責仍互斥（對齊 PROPOSAL-020 §防線 1）
- 診斷組於 Step 1 產出 `DIAGNOSIS_NOTE.md` 後，`@Security` 於 Step 2 基於該文件執行審查
- 衝突處理：若 `@Security` 審查發現需補做診斷（如隱藏 SC）→ 回退至 Step 1 重啟診斷

---

## 四、禁止行為

- **絕對禁止** 以「趕時間」為由跳過緊急通道條件判斷
- **絕對禁止** Hotfix 用於非生產事故（功能 / 效能 / UI 調整）
- **絕對禁止** 全局緊急阻斷解除前繼續派發（`@Lead` 必須暫停）
- **絕對禁止** @Retro 根因分析跳過 force_complex_scenarios 強制升等（必 opus + heavy）

---

## 五、與其他規則對齊

- `system-prompt.md §全局緊急阻斷`：三條件定義源頭
- `assistant.md §s07 阻斷機制`：🔴 未處理時阻斷派發
- `patrol-notification-catalog.md §A`：P-01~P-18 巡邏規則
- `skills/assistant-user-commands.md`：User 解除指令清單
- `tasks/audit-retro-coordination.md`（若 PROPOSAL_031 採納）：@Auditor / @Retro 協作
- `skills/lead-dispatch-patterns.md §6.1`：Hotfix 派發範例

---

## 六、溯源

本檔案合併抽出自：

- `lead.md §s07 中斷與重啟機制`
- `lead.md §s08 緊急修復通道`
- 參照 `system-prompt.md §全局緊急阻斷`（保留引用關係）

**修訂限制**：修改需透過 RULE_UPDATE_PROPOSAL 提案；本 task 與 `lead.md` / `system-prompt.md` 引用保持同步。

---

<!-- MACHINE_READABLE
type: project-specific-references
schema_version: v1.0
category: F2
skill_or_task: emergency-shutdown-playbook
-->

## 🔗 專案特化參照 (Project-Specific References)

> 本 task 描述**通用緊急阻斷與 Hotfix SOP**；專案特定回滾流程與部署約束由 workspace 注入。
> 請參照 `.agents/workspaces/<CURRENT_WORKSPACE>.md` 對應欄位。

| 通用概念          | Workspace 欄位             | Fallback 行為                        |
| ----------------- | -------------------------- | ------------------------------------ |
| 部署 SOP 回滾步驟 | `DEPLOYMENT_SOP.rollback`  | 升級 User：無回滾流程禁止執行 Hotfix |
| 部署約束          | `DEPLOYMENT_CONSTRAINTS.*` | 警告（用於 Hotfix 範圍判斷）         |

---

## Related Decisions

- [ADR-0008](../decisions/0008-hotfix-dual-track.md) — Hotfix 雙軌流程
- [ADR-0011](../decisions/0011-security-conditional-intervention.md) — @Security 條件式介入（SC-01~10）
- [ADR-0012](../decisions/0012-diagnostic-team.md) — 診斷組機制（D1-D4）
