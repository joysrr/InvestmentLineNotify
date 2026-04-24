# Skill: @Retro Few-Shot 範例（3 組）


## 範例 1：根因分析 4 層級判定

**輸入**：`REVIEW_REPORT.md` 含 BLOCKER「@Backend 忘記加 initData 驗證」

**@Retro 應判定**：
```markdown
## 根因分析（`PROPOSAL_20260422_XXX.md §二`）

| 根因層級 | 代碼 | 分析 |
|---------|------|------|
| 開發層 | `DEV` | @Backend 實作時未檢視 `tech-stacks/messaging/telegram-miniapp-sdk.md` initData 雙重鐵律 |
| 測試層 | `TEST` | @QA Test Spec 未涵蓋 initData 缺失情境 → 開發者失誤未被攔截 |

**跨層標注**：DEV + TEST（開發者未做且 QA 也未攔截）
```

## 範例 2：反覆問題警告觸發

**情境**：`@Backend` + `DEV` 已累積第 3 次相同類型問題

**@Retro 應產出提案**：
```markdown
# PROPOSAL_20260422_XXX

🚨 反覆問題警告

**累積次數**：第 3 次
**目標 Agent**：@Backend
**根因分類**：DEV
**歷史提案**：PROPOSAL_20260420_001 / PROPOSAL_20260421_005

> ⚠️ 此提案狀態為 OPEN，但**必須等待 User 明確確認**才可進入 IN_PROGRESS。

（... 完整提案內容 ...）
```

觸發 @Assistant P-04 🔴 `RETRO_REPEAT` → 阻斷新功能直到 User 採納或拒絕。

## 範例 3：意圖繼承登記

**情境**：新提案推翻歷史提案方向

**@Retro 應在 §七 備註**：
```markdown
## 七、備註

### 意圖繼承聲明（對齊 PROPOSAL_20260422_006）

本提案推翻 PROPOSAL_20260421_011 的設計方向（Rules 內化 → workspace 注入）。

**繼承登記**：於 `PROPOSAL_INDEX.md §🔗 提案意圖繼承關係` 表新增：
| 歷史提案 | 原意圖 | 繼承提案 | 繼承方式 |
| PROPOSAL_20260421_011 | Rules 內化錨定 | PROPOSAL_20260422_002 + 006 | 意圖保留，實作改為 workspace 注入 |
```

未登記 → @Assistant P-14 `PROPOSAL_INTENT_REGRESSION` 🔴 觸發。

---

## Related Decisions

- [ADR-0009](../decisions/0009-proposal-full-lite-tier.md) — Full/Lite Proposal 分級
- [ADR-0020](../decisions/0020-proposal-intent-inheritance.md) — 提案意圖繼承機制
- [ADR-0021](../decisions/0021-proposal-lifecycle.md) — 提案生命週期
