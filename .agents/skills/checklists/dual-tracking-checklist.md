---
skill_id: dual-tracking-checklist
file_type: checklist
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_004
purpose: |
  Phase 進度 vs 驗收條件雙維度追蹤 Checklist（多 Phase 提案執行用）
referenced_by:
  - rules/lead.md
  - skills/templates/pending-actions-template.md
  - skills/lead-context-mappings.md
  - skills/lead-orchestration-guide.md
  - skills/templates/global-status-summary-template.md
---

<!-- MACHINE_READABLE
type: checklist
category: F1
id: dual-tracking-checklist
related_proposals: [PROPOSAL_20260424_019]
related_decisions: [ADR-0001]
-->

# Skill: 雙維度追蹤 Checklist（Phase 進度 vs 驗收條件）

> 由 PROPOSAL_20260424_019 F-2 建立；F1 類（純通用原則；不引用 workspace 欄位）。
> 對齊 `rules/lead.md §狀態錨點` + `skills/stateless-routing-pattern.md`；退火 Batch 017+018 retro 暴露之「驗收條件取代 Phase 進度」路由誤差。

---

## 一、鐵律

每個**多 Phase 提案**執行過程，`@Lead` **必須同時追蹤兩個獨立維度**：

| 維度             | 工具                          | 回答的問題                                |
| ---------------- | ----------------------------- | ----------------------------------------- |
| **Phase 進度**   | TodoWrite（或手動 checklist） | 「當前在哪個 Phase？下一 Phase 是什麼？」 |
| **驗收條件對齊** | 提案 §驗收條件 逐項勾選       | 「每項驗收條件是否已 done？」             |

兩者**不可互相取代**；驗收條件是**結果驗證**，Phase 是**流程控制**。

---

## 二、觸發時機

- 提案含 ≥ 2 個 Phase（不論 full / lite tier）
- User 問「接下來應該做什麼？」「現在進度如何？」「還差什麼？」等開放性狀態查詢
- 任何 Phase 的最後一個 commit 推送完成後

---

## 三、必行動作（回答 User 前強制）

1. **先朗讀當前 Todo 狀態**（未完成 Phase 清單優先；格式：`Phase A ✅ / Phase B ✅ / Phase C 🔵 進行中 / Phase D ⭕ 未開始`）
2. **再對照驗收條件表**（逐項勾選）
3. **若兩維度打架** → **以 Phase 進度為準**（流程控制 > 結果驗證）
4. 禁止僅憑「驗收條件 100%」推導「提案完成」而略過 Phase 進度確認

---

## 四、反模式（禁止）

- ❌ 看到驗收條件全綠就 marked 提案為 DONE（可能 Phase E release 未做）
- ❌ User 問「接下來」直接從 §驗收條件 找空白項回答（應先看 Todo 狀態）
- ❌ 完成一個 Phase 後跳過「Phase 完結宣告」直接進入下一個
- ❌ 只維護其中一個維度（兩者**必須並存**）

---

## 五、違規偵測

| 違規樣態                                      | 判定        | 處理                                          |
| --------------------------------------------- | ----------- | --------------------------------------------- |
| `@Lead` 在多 Phase 提案執行中未使用 TodoWrite | 🟡 流程降級 | `@Assistant` P-14 🟡 WARN；提醒建立 todo 清單 |
| 驗收條件未逐項對照直接宣告 DONE               | 🔴 Flow Gap | `@Auditor` 「流程遵循」維度扣 0.5 分          |
| Phase 進度 vs 驗收條件不同步未宣告            | 🟡 追蹤誤差 | `@Retro` 下次審計時檢視                       |

---

## 六、範例

### ❌ 反模式

```
User: 接下來該做什麼？
Lead: 依 §驗收條件，Phase B 的 unit test 已加入，Phase C 的規則已寫入...
      [直接從驗收條件表推導，未朗讀 Phase 狀態]
```

### ✅ 正確做法

```
User: 接下來該做什麼？
Lead: 當前 Phase 狀態：
      - Phase A ✅（立案 + index regen）
      - Phase B ✅（unit tests + RULES_DESIGN_GUIDE 新規則）
      - Phase C 🔵 執行中
      - Phase D / E / Release ⭕ 未開始

      下一步：完成 Phase C（新 skill 建立 + rules/lead.md 引用）。
```

---

## 七、意圖繼承聲明

本 skill 為 PROPOSAL_20260422_001（`@Lead` 狀態錨點）的微細化擴充：

- **原鐵律**：讀取 `PENDING_ACTIONS.md §🎯` 的 `[CURRENT_STAGE]`
- **本延伸**：多 Phase 提案執行時，`CURRENT_STAGE` 之外再加 Phase 進度 + 驗收條件雙維度追蹤

---

## 八、關聯

- `rules/lead.md §狀態錨點與無狀態路由限制` — 狀態讀取鐵律（本 skill 之基）
- `skills/stateless-routing-pattern.md` — 完整 State Anchor 規範
- `skills/templates/pending-actions-template.md` — CURRENT_STAGE 格式
- `skills/templates/global-status-summary-template.md` — 全局狀態摘要模板
- ADR-0001 — Stateless Lead Routing（雙維度追蹤延伸此決策）

---

**維護紀錄**：

- 2026-04-24：由 PROPOSAL_20260424_019 F-2 建立（F1 類 skill）
