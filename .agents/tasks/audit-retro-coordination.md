---
task_id: audit-retro-coordination
file_type: workflow
owner: @Auditor + @Retro
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_005
purpose: |
  P-15 AUDIT_QUALITY 觸發後 @Auditor → @Retro 5 步協作流程
referenced_by:
  - rules/retro.md
  - rules/lead.md
  - rules/auditor.md
  - skills/templates/rule-update-proposal-full-template.md
  - tasks/periodic-design-review-workflow.md
  - tasks/framework-upgrade-workflow.md
---

# Task: @Auditor + @Retro 協作流程

> 對齊 PROPOSAL_008（@Auditor 定期評分）+ PROPOSAL_027（AUDIT_DECISION_LOG）+ PROPOSAL_007（整合性分析）。

---

## 觸發條件

任一情況觸發本協作流程：

1. `@Auditor` 評審後任一維度 < `AUDIT_DIMENSION_MIN_SCORE`（預設 3.0）→ P-15 🟡 `AUDIT_QUALITY`
2. `@Retro` 收到 `TEST_REPORT.md` / `REVIEW_REPORT.md` 啟動根因分析
3. User 同時手動觸發兩者

---

## 5 步驟協作流程

### Step 0：Memory Palace 跨 session 上下文（ADR-0039；新增）

協作開始前必：

- `mempalace.wake-up` 取最近 N 個工作對話的 retro / audit 活動上下文
- `mempalace.search "<觸發關鍵詞>"` 查 strategy_context（歷史評分趨勢）+ debug_graveyard（已處理 incident）
- 結果用於 Step 2 交接資訊的「歷史脈絡」欄位

**MCP down fallback**（PROPOSAL_502_023 C-7）：`mempalace status` probe 失敗時改用 `.agents/memory/.export/<wing>/<room>/` 全域 grep；標記 `audit_context: filesystem_fallback`；@Retro 知曉品質下降但不阻斷流程。

**baseline_comparison Δ aggregate 規則**（PROPOSAL_502_023 C-8）：

- 單維度 Δ：直接由 AUDIT_HISTORY 前次該維度分減本次
- 整體 Δ：5 維度 Δ 加權平均（各 0.2）
- 多維度同時降分（≥ 2 維度 Δ ≤ -0.5）→ 標 🔴 `BROAD_REGRESSION`；@Retro 優先處理

### Step 1：識別觸發來源

| 路徑 | 觸發源                | 下一步                           |
| ---- | --------------------- | -------------------------------- |
| A    | @Auditor P-15 觸發    | 直接走 Step 2                    |
| B    | @Retro 收 TEST_REPORT | 檢查 `AUDIT_HISTORY.md` 最新一行 |
| B-1  | 該維度本次有低分      | 合流 Step 2                      |
| B-2  | 該維度本次正常        | 純 @Retro 流程，跳過本協作       |
| C    | User 手動同時觸發     | 優先走 A 路徑（Auditor 優先）    |

### Step 2：交接資訊（@Auditor → @Retro）

`@Auditor` 透過 `@Lead` 通知 `@Retro` 時，**必須**附帶：

- **觸發維度**：如 3.2（模型分層路由）
- **critical_risks 清單**：5 維度評估輸出的關鍵風險（含編號 R16 / R17 等；mode-aware：serial 5 輪整合 / parallel 5 sub-agent 整合皆適用）
- **optimization_suggestions 摘要**：5 維度評估建議的改善方向
- **baseline_comparison Δ**：本次 vs 前次分數變化
- **AUDIT_DECISION_LOG.md 引用**：記錄位置（依 PROPOSAL_027）

交接格式範例（@Lead 轉發）：

```
@Retro 根因分析請求
觸發來源：@Auditor P-15 AUDIT_QUALITY
觸發維度：3.2 模型分層路由 = 2.8 (< 3.0)
關鍵風險：R16 CRITICAL（系統無 Haiku/Sonnet/Opus 分流）
優化建議：lead.md §Task Complexity Assessment + SYSTEM_THRESHOLDS MODEL_ROUTING
baseline Δ：4.0 → 2.8（-1.2）
決策日誌：.agents/docs/Reports/AUDIT_DECISION_LOG.md 2026-04-22 #3 維度 3
```

### Step 3：@Retro 根因分析

`@Retro` 接收後執行 `retro.md §s_root_cause`：

1. 將 `@Auditor` 的 risks 視為「**症狀**」
2. 進行 REQ / ARCH / DEV / TEST 四層根因追溯
3. 識別是否屬「反覆問題」（比對 `PROPOSAL_INDEX.md §🔗` 意圖繼承表）
4. 若發現推翻歷史提案意圖 → 必須於新提案標註意圖繼承（PROPOSAL_006）

### Step 4：提案產出（@Retro 主導）

**權限規則**：

- `@Retro` 是**唯一**有權產出提案的 Agent（`auditor.md §s05 核心禁止條款`）
- 提案內**必須**引用 `@Auditor` 觸發來源（如「依 AUDIT_HISTORY.md 2026-04-22 第三次評審 R16」）
- `@Auditor` 的 optimization_suggestions 可作為提案 §三 內容輸入，但需經 `@Retro` 根因分析**篩選**（不全盤採納）

**提案格式**：依 `skills/templates/rule-update-proposal-full-template.md`（Full；預設）或 `rule-update-proposal-lite-template.md`（Lite；微型變更）；scope 判定依 `RULES_DESIGN_GUIDE §十七.B`；Full/Lite 判定依 `§二十一.B`。

### Step 5：閉環驗證（@Auditor 後續介入）

1. User 採納提案 → `@Lead` 執行（依 `lead.md §s_pre_adoption_check`）
2. 執行完成後通知 `@Auditor`
3. `@Auditor` 下次評審時**優先檢視該維度**，驗證改善是否成效
4. **必 append AUDIT_HISTORY.md**（PROPOSAL_502_016 P-1 強化）：細項變化（如 3.2: 2.8 → 4.5）+ baseline 更新；missing append → @Assistant P-15 升級觸發為 🔴 `AUDIT_HISTORY_APPEND_MISSING`
5. 同步寫入 `AUDIT_DECISION_LOG.md`（依 PROPOSAL_027 auditor.md §3.0 第 5 條）
6. **drift_score 同步**（PROPOSAL_502_016 P-2）：每次 minor bump（FRAMEWORK_VERSION 變更）@Lead 必跑 `node .agents/tests/agent-drift-simulator.mjs` 並同步至 AUDIT_HISTORY.md + FRAMEWORK_VERSION `drift_score` 欄位（單一 SoT = AUDIT_HISTORY；FRAMEWORK_VERSION 鏡像最新）

---

## 衝突仲裁規則

若 `@Auditor` 建議與 `@Retro` 根因分析建議**不一致**時：

### 仲裁原則

`@Lead` 依 **「根因深度優先」** 原則仲裁：

- `@Auditor` 視角：量化評分 + 症狀盤點
- `@Retro` 視角：四層根因分析（REQ/ARCH/DEV/TEST）

→ **採 `@Retro` 方向**（根因比症狀更深）

### 記錄位置

衝突記錄於 `docs/Reports/AUDIT_DECISION_LOG.md §衝突仲裁記錄`（依 PROPOSAL_027）：

| 日期 | 衝突來源 | @Auditor 建議 | @Retro 根因分析 | @Lead 仲裁結果 | 採納方向 |

### User 介入點

若 @Lead 仲裁結果 User 不滿意，可下令：

- `推翻仲裁 <衝突編號>，採 @Auditor 建議` → 直接走 @Auditor 方向，@Retro 補上根因註記

---

## 禁止行為

- **絕對禁止** `@Auditor` 越權撰寫提案（`auditor.md §s05` 明文）
- **絕對禁止** `@Retro` 略過 `@Auditor` 觸發資訊獨立產提案（當兩者同時觸發時）
- **絕對禁止** User 同時採納 `@Auditor` 與 `@Retro` 兩方衝突建議（必擇一，避免分歧）
- **絕對禁止** 跳過 Step 5 閉環驗證；若跳過則視同提案未完成執行

---

## 優先級明文化（對齊 `lead.md §s04 通知接收優先級`）

當 P-15 `AUDIT_QUALITY` 🟡 與其他通知同時觸發時：

| 優先級                  | 情境                                                                                                                           | @Lead 動作                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| 🔴 P-15 最優先於其他 🟡 | 若 P-15 為「任一維度 < 3.0」且**連續 2 次出現**（PROPOSAL_502_016 P-7 明文：**同一維度** 連續 2 次審計皆 < 3.0；非跨維度合計） | 視為 🔴 升級；暫停其他派發     |
| 🟡 P-15 正常            | 單次觸發                                                                                                                       | 走本 task Step 1 B 路徑合流    |
| 🟡 其他                 | 與 P-15 並存                                                                                                                   | 依 `lead.md §s04` 處理時限並行 |

---

## 與其他規則對齊

- `auditor.md §s02 觸發條件`：P-15 觸發定義
- `auditor.md §s05 核心禁止條款`：@Auditor 不得越權提案
- `retro.md §s02 觸發條件與資料收集`：@Retro 根因分析入口
- `retro.md §s04 歷史提案比對機制`：反覆問題偵測
- `lead.md §s04 通知接收優先級`：通知處理時限
- `PROPOSAL_027` AUDIT_DECISION_LOG.md：協作軌跡記錄
- `PROPOSAL_006` 意圖繼承：推翻歷史意圖的提案要求

---

## 溯源

本 task 為 PROPOSAL_20260422_031 新建；對齊 PROPOSAL_008（@Auditor）+ PROPOSAL_027（AUDIT_DECISION_LOG）。

**修訂方式**：透過 RULE_UPDATE_PROPOSAL 提案；若 @Auditor 與 @Retro 協作流程有重大調整，修訂本 task 與對應 rules 引用。

---

## Related Decisions

- [ADR-0005](../decisions/0005-auditor-periodic-scoring.md) — @Auditor 5 維度評分
- [ADR-0020](../decisions/0020-proposal-intent-inheritance.md) — 提案意圖繼承機制
