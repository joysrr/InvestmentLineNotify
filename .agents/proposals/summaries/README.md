# Proposals Summaries — Framework Scope

> 季度 / 區間摘要索引。依 PROPOSAL_20260423_015 Phase C 建立。
> 用途：新 LLM session / onboarding 時的**快速歷史概覽入口**，替代逐份閱讀 `completed/` 全部提案。

## 產生指令

```bash
# 季度摘要
node .agents/scripts/generators/gen-proposal-summary.mjs --period 2026Q2 --write

# 月摘要
node .agents/scripts/generators/gen-proposal-summary.mjs --period 2026-04 --write

# 區間摘要
node .agents/scripts/generators/gen-proposal-summary.mjs \
  --range PROPOSAL_20260423_001:PROPOSAL_20260423_015 --write

# Project scope（workspace）
node .agents/scripts/generators/gen-proposal-summary.mjs \
  --workspace <name> --period 2026Q2 --write
```

## 建議產生頻率

- **季度**：每季末自動產（手動觸發；未來可納入 periodic-design-review 工作流）
- **里程碑**：major framework bump 後產一份（如 v5.0 發布）
- **搬運前**：複製 `.agents/` 到新專案前，確認最新 summary 已存在

## 已產生摘要

| 期間   | 檔案                | 提案數 | 備註                                                |
| ------ | ------------------- | ------ | --------------------------------------------------- |
| 2026Q2 | `SUMMARY_2026Q2.md` | 70     | 首次摘要；涵蓋 PROPOSAL_20260420_001 ~ 20260423_015 |

## 讀取順序建議

新 LLM / 新成員 onboarding：

1. **本 README** → 理解摘要機制與索引
2. **最新 `SUMMARY_<latest>.md`** → 5 分鐘掌握近期概況
3. **必要時**才展開 `completed/<ID>.md` 查單份細節

## 搬運規範

- 本目錄（`.agents/proposals/summaries/`）在搬運到新專案時 **必帶**
- 理由：新專案即使清除 `completed/`（保留框架基石）也能透過 summaries 了解框架演進史
