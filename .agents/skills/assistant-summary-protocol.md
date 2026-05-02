<!-- MACHINE_READABLE
type: summary-protocol
category: F1
id: assistant-summary-protocol
related_proposals: [PROPOSAL_20260424_020]
related_decisions: [ADR-0001, ADR-0030]
-->

# Skill: Assistant Summary Protocol（@Assistant 摘要與通知協定）

> 由 PROPOSAL_20260424_020 Phase E 建立；F1 類（純通用原則）。
> `rules/assistant.md` 保留核心觸發 + 鐵律 + 禁止條款；本文為完整操作細則。
> @Assistant 雙軌輸出（HCI 全局摘要 + M2M 巡邏摘要）+ 通知關閉規則完整規範。

---

## 目錄

- §一：HCI 全局摘要機制（對齊 `rules/assistant.md §s_global_summary`）
- §二：M2M 巡邏摘要輸出格式（對齊 `rules/assistant.md §s16`）
- §三：通知類型關閉條件對照（對齊 `rules/assistant.md §s15`）
- §四：PENDING_ACTIONS.md 狀態過期門檻

---

## 一、HCI 全局摘要機制

對齊 `rules/assistant.md §s_global_summary`；彌補 @Lead 無狀態化（ADR-0001）後喪失的溝通溫度。

### 1.1 雙軌輸出職責分工

| 軌道            | 負責 Agent                    | 輸出        | 目標     |
| --------------- | ----------------------------- | ----------- | -------- |
| **M2M（機讀）** | @Lead 短指令 + 審查類純淨報告 | 符號 + 路徑 | 解析穩定 |
| **HCI（人讀）** | @Assistant 全局摘要           | 溫度敘事    | 認知效率 |

本節定義 HCI 軌道；M2M 軌道依 `lead.md §s_state_anchor` + `reviewer.md / security.md / qa.md §s_output_strict` 執行。

### 1.2 觸發時機

**主動觸發**（User 下令）：

- `請求當前進度摘要` / `彙報戰況` / `全局狀態` / `Global Summary` 或語意等效指令

**被動觸發**（Workflow 事件）：

- 進入 Workflow **第 8 階段（收斂）**時，於 User 確認 Artifact Checklist **之前**自動產出
- `PENDING_ACTIONS.md` 由 🔴 項目轉為 0 🔴 的瞬間（重大里程碑）
- @Assistant 巡邏 P-13 `SUMMARY_STALE` 偵測到摘要逾期

### 1.3 執行邏輯

觸發後 @Assistant：

1. **遍歷讀取**：
   - `PENDING_ACTIONS.md`
   - `.agents/proposals/active/*.md`
   - `REVIEW_REPORT.md`（若有）
   - `SECURITY_REPORT.md`（若有）
   - `docs/plans/advice/ADVICE_*.md`
   - `docs/plans/draft_features.md`
2. **轉化**：將機器標籤與符號 → 具脈絡的自然語言摘要
3. **寫入**：`docs/Reports/GLOBAL_STATUS_SUMMARY.md`（覆寫模式；保留最新 `SUMMARY_HISTORY_LIMIT` 份歷史至 `docs/Reports/archive/summary/`）

### 1.4 產出格式

**鐵律**：摘要**獨立寫入檔案**，**不在對話中直接輸出原文**；不得干擾 @Lead 標準通知流。

摘要結構依 `skills/templates/global-status-summary-template.md` 含 **5 固定區塊**：

1. **當前水位**（階段 + 健康度一句話）
2. **熱點警示**（未解決 🔴 / 🟡 的白話影響）
3. **進展肯定**（近期 ✅ 正面回饋）
4. **下一步建議**（Pending Actions 推薦處理順序；**非業務決策**）
5. **對話承接提示**（換對話接手快速上手 1~2 行）

### 1.5 輸出前自檢 Checklist

- [ ] 5 個固定區塊齊全
- [ ] 檔案頂部含「最後更新：YYYY-MM-DD HH:MM by `@Assistant`」
- [ ] **無對 User 的業務決策建議**
- [ ] 摘要內容對齊實際 `PENDING_ACTIONS.md` 計數
- [ ] **無複製貼上任何報告原文**

### 1.6 與 §s16 巡邏摘要的區別

| 項目     | §s16 巡邏摘要                 | §s_global_summary 全局摘要（本節）           |
| -------- | ----------------------------- | -------------------------------------------- |
| 輸出媒介 | 對話內回報 @Lead              | 寫入 `docs/Reports/GLOBAL_STATUS_SUMMARY.md` |
| 內容性質 | 機讀結構化（計數 + 下次巡邏） | 人讀敘事化（溫度 + 脈絡）                    |
| 讀者     | @Lead + 自動化工具            | User（人類）                                 |
| 觸發     | 每次 @Lead 呼叫巡邏時         | 主動指令 / 收斂階段 / 里程碑事件             |

兩者**並存且互補**，不可合併或取代。

### 1.7 違反處理

- 於對話中直接輸出摘要原文（非寫入檔案）→ @Lead 退件
- 摘要含業務決策建議 → 違反 `assistant.md §s19` 執行準則第 3 條，由 @Retro 提案強化
- 摘要與 `PENDING_ACTIONS.md` 計數不一致 → 重新產出

---

## 二、M2M 巡邏摘要輸出格式

對齊 `rules/assistant.md §s16`；對齊 ADR-0030 通知分級標準。

### 2.1 強制輸出要求

每次完整巡邏結束後，@Assistant **必須**向 @Lead 輸出以下格式。**標頭必須包含本次巡邏發現的最高級別符號**（依 `RULES_DESIGN_GUIDE §九 通知分級標準`）：

```
【@Assistant 巡邏摘要】<最高級別符號> <最高級別一句話摘要>
─────────────────────────────
巡邏週期：第 <n> 個工作對話
PENDING_ACTIONS：🔴 <n> | 🟡 <n> | ✅ <n>
異常清單：
  🔴 <具體描述> × <n> 項
  🟡 <具體描述> × <n> 項
  🟢 <具體描述> × <n> 項（或「無異常」）
下次巡邏：第 <n+3> 個工作對話
─────────────────────────────
```

### 2.2 範例：完整無異常

```
【@Assistant 巡邏摘要】✅ 無異常，PENDING_ACTIONS 清空
─────────────────────────────
巡邏週期：第 17 個工作對話
PENDING_ACTIONS：🔴 0 | 🟡 0 | ✅ 2
異常清單：無異常
下次巡邏：第 20 個工作對話
─────────────────────────────
```

### 2.3 範例：發現 🔴 異常

```
【@Assistant 巡邏摘要】🔴 CRITICAL：PROPOSAL_20260420_001 IN_PROGRESS 逾時
─────────────────────────────
巡邏週期：第 23 個工作對話
PENDING_ACTIONS：🔴 1 | 🟡 3 | ✅ 4
異常清單：
  🔴 PROPOSAL 逾時 × 1 項
  🟡 豁免累積 ≥ 5 × 1 項、Sprint 完成率 < 50% × 2 項
下次巡邏：第 26 個工作對話
─────────────────────────────
```

### 2.4 違反處理

- **絕對禁止** 執行完整巡邏後不輸出巡邏摘要；巡邏摘要為 @Lead 和 User 驗證巡邏有效性的**唯一依據**
- **絕對禁止** 將巡邏摘要與其他回報合併為自由格式輸出；標頭與欄位順序固定
- **絕對禁止** 標頭使用 `RULES_DESIGN_GUIDE §九` 以外的通知符號

---

## 三、通知類型關閉條件對照

對齊 `rules/assistant.md §s15`；@Assistant 巡邏時依此判定 🔴 條目是否可自動關閉。

### 3.1 通知類型完整對照（主要 14 類；全 25 類見 `patrol-notification-catalog.md §B` + `assistant-user-commands.md`）

| 通知類型                     | 條件消失的判斷標準                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `CONSULTANT_CONFLICT`        | `ADVICE_*.md` 中的 `strategyWeight` 欄位已填寫（非空、非未填）                                                                        |
| `CONSULTANT_RISK`            | `ADVICE_*.md` 中的 `⚠️ 未採納高風險建議` 標記已移除，或 User 明確下達確認風險指令                                                     |
| `REVIEW_QUALITY`             | `REVIEW_REPORT.md` 審查結論已更新為「✅ 通過」                                                                                        |
| `SECURITY_AUDIT_FAIL`        | `SECURITY_REPORT.md` 審查結論已更新為「✅ 通過」                                                                                      |
| `QA_QUALITY`                 | `TEST_REPORT.md` 測試結論已更新為「✅ 通過」                                                                                          |
| `RETRO_REPEAT`               | 對應 `PROPOSAL_*.md` 狀態已更新為 `DONE` / `ARCHIVED`                                                                                 |
| `RETRO_TIMEOUT`              | 對應 `PROPOSAL_*.md` 狀態已從 `IN_PROGRESS` 更新為 `DONE` / `REJECTED` / `CANCELLED`                                                  |
| `RETRO_PROPOSAL`             | 對應 `PROPOSAL_*.md` 狀態已從 `OPEN` 更新為 `IN_PROGRESS` / `DONE` / `REJECTED` / `CANCELLED`                                         |
| `EXEMPTION_ACCUMULATED`      | `PENDING_ACTIONS.md §豁免記錄` 區塊未歸檔項目 < 5 筆，或 @Retro 完成豁免審計後歸檔                                                    |
| `FRONTEND_API_BLOCK`         | `docs/api/*.md` 已更新，或 @Frontend 確認不再等待此規格                                                                               |
| `HOTFIX_DOC_PENDING`         | @Architect 已完成對應收斂文件更新，`docs/architecture.md` 或 `docs/modules/` 已反映 Hotfix 變更                                       |
| `WORKSPACE_MISSING`          | `.agents/CURRENT_WORKSPACE` 已指向 `workspaces/` 下存在的有效檔案，且該檔 `PROJECT_CONTEXT` / `TECH_STACK` 區塊已填寫                 |
| `SUMMARY_STALE`              | `docs/Reports/GLOBAL_STATUS_SUMMARY.md` 最後更新時間在 `SUMMARY_STALE_THRESHOLD` 範圍內（通常 @Assistant 下次巡邏自動觸發產出後關閉） |
| `PROPOSAL_INTENT_REGRESSION` | `PROPOSAL_INDEX.md §🔗 提案意圖繼承關係` 表已新增對應條目，且歷史提案條目標題已加註「意圖繼承至...」                                  |

### 3.2 嚴重程度與關閉執行者

| 嚴重程度               | 關閉條件                                        | 執行者                |
| ---------------------- | ----------------------------------------------- | --------------------- |
| 🔴（主動關閉）         | User 明確下達處理指令後，@Lead 確認對應動作完成 | User 下令，@Lead 執行 |
| 🔴（條件消失自動關閉） | @Assistant 巡邏時重新偵測該條目原始條件已不成立 | @Assistant 自動       |
| 🟡                     | @Lead 確認對應任務已完成，自動關閉              | @Lead 自動            |

**關閉後動作**：將該項目移至「最近已處理」區塊，超過 5 筆時移除最舊的一筆。

---

## 四、PENDING_ACTIONS.md 狀態過期門檻

> **本節為 SoT**：`rules/assistant.md §s15` 為 quick-ref 摘要；過期門檻完整定義以本 §四 為準（任何修改必先改本檔）。依 `SYSTEM_THRESHOLDS.patrol`：

| 狀態標記   | 過期門檻                                                                                           | 處理方式                   |
| ---------- | -------------------------------------------------------------------------------------------------- | -------------------------- |
| 🟡 PENDING | 超過 `PENDING_YELLOW_EXPIRE` 個工作對話未更新（預設 3）                                            | 升級為 🔴 並回報 @Lead     |
| 🔴 BLOCKED | 超過 `PENDING_RED_EXPIRE` 個工作對話未處理（預設 2；對齊 `system-prompt.md §全局緊急阻斷` 條件二） | 立即回報 @Lead（高優異常） |
| ✅ DONE    | 超過 `PENDING_DONE_EXPIRE` 個工作對話未歸檔（預設 5）                                              | 提醒 @Lead 執行歸檔清理    |

---

## 關聯

- `rules/assistant.md` — @Assistant 核心 rule
- `skills/templates/global-status-summary-template.md` — 5 固定區塊摘要模板
- `skills/patrol-notification-catalog.md` — P-01~P-29 巡邏目錄
- `RULES_DESIGN_GUIDE §九` — 通知分級標準（DESIGN.md）
- `SYSTEM_THRESHOLDS.yaml patrol` — 巡邏週期 / 過期門檻
- ADR-0001 — Stateless Lead Routing
- ADR-0030 — Notification Classification

---

**維護紀錄**：

- 2026-04-24：Phase E 建立（PROPOSAL_20260424_020 Phase E 分批執行）
