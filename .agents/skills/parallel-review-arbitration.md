---
skill_id: parallel-review-arbitration
file_type: skill
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_002
purpose: |
  @Reviewer 與 @Security 平行審查的職責切分、流程、衝突仲裁、共用計數器。
  自 rules/lead.md §s06 搬入（PROPOSAL_20260430_002 Phase B 試點瘦身）。
related_decision: decisions/0010-parallel-review.md
referenced_by:
  - rules/lead.md §s06 (immutable 鐵律)
  - rules/reviewer.md
  - rules/security.md
---

# 平行審查與衝突仲裁規則

## 為何要平行（@Reviewer + @Security）

防止序列審查造成循環退件（A 先審 → B 再審 → A 退又進 B → 無限退件）。
詳見 ADR-0010 設計動機。

## 防線 1：職責互斥（明文切分審查範疇）

| 審查者      | 專屬範疇                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `@Security` | `skills/security-audit.md §1` 10 條 SC-XX：Token 時效 / 金鑰 / strategyWeight / 資料刪除 / API 授權 / 併發原子性 / 錯誤訊息 / 第三方套件等 |
| `@Reviewer` | 程式碼可讀性 / Memory Leak / 非同步錯誤捕捉 / 單檔行數 / ESLint / 命名慣例 / 效能（未涉及安全）                                            |

**越界處理**：任一方審對方專屬範疇 → `@Lead` 判定該項**無效**，不計入 BLOCKER，通知越界方撤回。

## 防線 2：平行審查流程

第 6 / 6.5 階段觸發時，`@Lead` 依以下流程派發（**絕對禁止**序列派發）：

1. **同時派發** `@Reviewer`（第 6）+ `@Security`（第 6.5，若 SC 範疇觸發）
2. 兩方獨立產出 `REVIEW_REPORT.md` 與 `SECURITY_REPORT.md`
3. `@Lead` **合併**兩報告為「統一退件清單」（不分開退件）
4. `@Frontend` / `@Backend` **一次性修正**所有問題後重新送審
5. 複審時再次**同時派發**，計入 `REVIEW_CYCLE_LIMIT` 共用計數

## 防線 3：衝突仲裁規則

若兩份報告建議**互相矛盾**（例：`@Reviewer` 建議快取、`@Security` 要求每次重新驗證）：

| 衝突類型                             | 仲裁規則                                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 安全性 vs 可讀性                     | **`@Security` 優先**（零容忍，無例外）                                                         |
| 安全性 vs 效能                       | **`@Security` 優先**，但 `@Security` 必須提供 **3 個緩解方案**（含效能折衷選項）供開發者選擇   |
| 皆無明確歸屬                         | `@Lead` 升級 User 裁決                                                                         |
| 越界審查                             | `@Lead` 判定無效（見防線 1）                                                                   |
| 複審結論矛盾（PROPOSAL_502_017 Q-6） | **以最後一輪為準**；前後輪結論不一致 → 自動觸發 @Retro 提案分析（屬反覆問題；類別 = 流程缺漏） |

**仲裁記錄 SoT**（PROPOSAL_502_017 Q-5）：所有衝突仲裁結果**必同步寫** `.agents/docs/Reports/AUDIT_DECISION_LOG.md §衝突仲裁記錄`（PROPOSAL_027 預留表）；missing → @Retro 審計時補；連續 ≥ 3 missing → P-15 升級。

## 防線 4：共用計數器（單點配置）

- `@Reviewer` + `@Security` 複審次數**共用**一個計數器：`REVIEW_CYCLE_LIMIT`
- 配置位置：`RULES_DESIGN_GUIDE.QUALITY.md` §REVIEW_CYCLE_LIMIT（預設 2）
- 任一方於同一任務的複審都會 +1
- 達上限時：哪一方未通過就產對應通知（`REVIEW_QUALITY` 或 `SECURITY_AUDIT_FAIL`）
- 兩方同時未通過 → 同時產雙通知
- **可調整**：修改 `RULES_DESIGN_GUIDE.QUALITY.md` 即生效，**無需**同步修改 `reviewer.md` / `security.md` / `assistant.md`

## 禁止行為

- **絕對禁止** `@Lead` 序列派發 `@Reviewer` → `@Security`（造成先後退件循環）
- **絕對禁止** 未經 `@Lead` 仲裁，`@Reviewer` 與 `@Security` 直接跨 Agent 互動
- **絕對禁止** 因「共用計數」壓力而任一方降低審查標準（見 ADR-0010 共用計數設計意圖）

<!-- END: parallel-review-arbitration -->
