---
adr_id: ADR-0009
title: Full/Lite Proposal 分級機制
status: Accepted
date: 2026-04-24
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260422_021
  - PROPOSAL_20260423_010
referenced_by:
  - skills/templates/rule-update-proposal-full-template.md
  - skills/templates/rule-update-proposal-lite-template.md
  - rules/retro.md §s06 提案輕重選擇
  - RULES_DESIGN_GUIDE.SCOPE §二十一
---

# ADR-0009: Full/Lite Proposal 分級機制

## Status

**Accepted** (2026-04-24)

## Context

單一 Proposal 模板適用於所有變更（從架構重整到 typo 修正），導致微型變更（如修正一個錯字 / 調整設定常數）也需撰寫 ~400 行 / ~45 分鐘完整格式。心理門檻過高時，傾向直接改檔不走提案流程，造成審計軌跡斷鏈。需要分級機制。

## Decision

建立 **Full / Lite** 二分：

| 類別     | 適用                               | 模板                                    | 典型長度 | 撰寫時間 |
| -------- | ---------------------------------- | --------------------------------------- | -------- | -------- |
| **Full** | 一般變更（新功能 / 架構 / 規則）   | `rule-update-proposal-full-template.md` | ~400 行  | ~45 min  |
| **Lite** | 微型變更（typo / 路徑 / 設定常數） | `rule-update-proposal-lite-template.md` | ~70 行   | ~10 min  |

**預設 Full**；Lite 需**全滿足**以下排除條件（決策樹由嚴至寬）：

1. 不動 Agent 行為
2. 不跨檔（單檔 + 至多 1 個 INDEX）
3. 不需根因分析
4. LOC diff ≤ 50
5. ≤ 2 phases / ≤ 1 小時

**不確定 → Full**（保守）。

**Lite 7 欄必填**：

```
- Why / Change / Impact / Rollback / Acceptance / 基於 / 採納指令
```

**禁止行為**（鐵律）：

- Lite 用於 Agent 行為變更
- Lite 跨 ≥ 2 主檔
- Lite 省略「基於」（§🔗 意圖繼承不可斷）
- Lite 執行中擴充範圍（觸頂 → 中止 → 改 Full）

## Consequences

### 正面

- 微型提案心理門檻降低（45 min → 10 min）
- 審計軌跡保留（不再因繁瑣而「直接改」）
- §🔗 意圖繼承強制保留（Lite 仍須「基於」）
- 已 dogfood 驗證（PROPOSAL_013 / 014 為首批 Lite）

### 負面 / Tradeoffs

- 判定 Full/Lite 本身需成本
- 邊界案例（2 檔以下但需根因分析）需人工判斷
- Lite 統計與 Full 需分開計（避免被當作「提案數暴增」）

## Alternatives Considered

### Alternative A: 無分級（一律 Full）

**為何不採用**：微型提案心理門檻過高導致繞過流程。

### Alternative B: 三級（Full / Medium / Lite）

**為何不採用**：二元覆蓋足夠；三級增加判定成本。

### Alternative C: 依行數機械分級

**為何不採用**：行數不等於複雜度；Agent 行為 1 行修改可能超 Full。

## Related Proposals

- PROPOSAL_20260422_021（原始 template 統一規範）
- PROPOSAL_20260423_010（Lite 分級；本 ADR 直接來源）

## Referenced By

- `skills/templates/rule-update-proposal-full-template.md`（Full 模板）
- `skills/templates/rule-update-proposal-lite-template.md`（Lite 模板 + 決策自檢）
- `rules/retro.md §s06 提案輕重選擇`（SOP）
- `RULES_DESIGN_GUIDE.SCOPE §二十一`（完整規範）

## Notes

- 本 ADR 與 ADR-0008（Hotfix 雙軌）設計範式一致：二元分級 + 由嚴判定 + 禁止擴充
- Lite 首批範例：PROPOSAL_20260423_013 / 014
