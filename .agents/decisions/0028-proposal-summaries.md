---
adr_id: ADR-0028
title: 歷史提案摘要機制（summaries/）
status: Accepted
date: 2026-04-24
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260423_015
referenced_by:
  - scripts/generators/gen-proposal-summary.mjs
  - proposals/summaries/README.md
  - proposals/summaries/SUMMARY_2026Q2.md
  - FRAMEWORK_REQUIREMENTS.md §6
---

# ADR-0028: 歷史提案摘要機制（summaries/）

## Status

**Accepted** (2026-04-24)

## Context

框架累積 70+ 提案（~25,000 行）於 `proposals/completed/`；新 LLM session / 新成員 onboarding 時無法全讀。歷史脈絡仍需可查詢（§🔗 意圖繼承依賴），但需更輕量入口。

## Decision

建立 **季度 / 區間摘要自動化**：

### 目錄結構

```
.agents/proposals/
├── summaries/
│   ├── README.md                 ← 摘要索引 + 產生指令 + 搬運規範
│   └── SUMMARY_<period>.md       ← 各週期摘要
```

### Generator

`scripts/generators/gen-proposal-summary.mjs`：
- 支援 `--period 2026Q2` / `--period 2026-04`（季度/月）
- 支援 `--range ID1:ID2`（區間）
- 支援 `--workspace <name>`（project scope）

### 摘要格式

```markdown
---
period: 2026Q2
scope: framework
generated: <date>
total: <N>
tier_full / tier_lite / proposal_range: ...
---

# 提案摘要：<period>（scope: framework）

## 概觀
## 主題聚合（14 主題自動分類）
## 關鍵變更 Highlight（major bumps）
## 逐份 1 行摘要表
## 跨提案主題鏈
```

### 搬運規範

- **必帶**：`proposals/summaries/`（新 LLM onboarding 入口）
- **可選**：`proposals/completed/`（A/B/C 模式選擇，見 ADR-0024 + FRAMEWORK_REQUIREMENTS §6）

### 產生頻率

- 季度自動產（手動觸發；未來可納入 periodic-design-review 工作流）
- Major framework bump 後產一份
- 搬運前確認最新 summary 已存在

## Consequences

### 正面

- 新 LLM 讀 25k 行 → 300 行 summary（-98%）
- 搬運新專案可選 C 模式（只帶 summaries）
- 主題自動分類（14 標籤）提供橫向查詢
- 主題鏈與 §🔗（ADR-0020）互補

### 負面 / Tradeoffs

- 主題分類為啟發式（keyword matching）；需調整門檻
- 摘要為靜態快照；新提案需重產
- 摘要品質依賴 frontmatter 完整性（舊格式 bullet title 需相容）

## Alternatives Considered

### Alternative A: 不產摘要（靠 grep / file browsing）

**為何不採用**：onboarding 成本高；新 LLM 難快速掌握脈絡。

### Alternative B: 手動維護 README

**為何不採用**：維護成本高；易 stale。

## Related Proposals

- PROPOSAL_20260423_015（原始提案：Framework/Project 分離執行 + 歷史摘要）

## Referenced By

- `scripts/generators/gen-proposal-summary.mjs`
- `proposals/summaries/README.md`
- `proposals/summaries/SUMMARY_2026Q2.md`（首次產出；70 份提案）
- `FRAMEWORK_REQUIREMENTS.md §6`（搬運規範）

## Notes

- 首次摘要 SUMMARY_2026Q2.md 涵蓋 PROPOSAL_20260420_001 ~ 20260423_015（70 份）
- Workspace scope 亦支援（`--workspace <name>`）；當前 workspace 0 份無需產
- 本 ADR 完成後 Batch 4-5 將補 016 自身進摘要
