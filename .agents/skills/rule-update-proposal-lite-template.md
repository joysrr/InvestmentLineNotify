---
skill_id: rule-update-proposal-lite-template
skill_name: "RULE_UPDATE_PROPOSAL (Lite)"
file_type: skill
class: F1
version: v1.0
last_modified: 2026-04-24
last_proposal: PROPOSAL_20260423_010
trigger: when_drafting_micro_proposal
related_skills:
 - rule-update-proposal-template # Full 版本
references:
 design_guide: RULES_DESIGN_GUIDE.md#二十一
 full_template: rule-update-proposal-template.md
 retro_lifecycle: rules/retro.md#s06
---

# Skill: RULE_UPDATE_PROPOSAL (Lite) — 輕量提案模板

> 依 `PROPOSAL_20260423_010` 建立；用於**微型變更**（typo / 路徑更新 / 設定常數）。
> 不確定用 Lite 或 Full？→ 先用 Full（由嚴）。

---

## 🔍 決策自檢（任一「否」 → 改用 Full）

- [ ] 不動 Agent 行為（不改 rules/* 邏輯）
- [ ] 變更不跨檔（單檔主體 + 至多 1 個 INDEX 同步）
- [ ] 不需根因分析（改動意圖明顯）
- [ ] LOC diff ≤ 50 行
- [ ] ≤ 2 phases 可完成
- [ ] ≤ 1 小時可執行

**全「是」** → 可用 Lite；否則改 `rule-update-proposal-template.md`（Full）。

---

## 📋 Lite 模板（複製並填寫）

```markdown
---
id: PROPOSAL_YYYYMMDD_NNN
title: <一句話標題；≤ 40 字>
status: OPEN
tier: lite
scope: framework | project
date: YYYY-MM-DD
---

# PROPOSAL_YYYYMMDD_NNN: <title>

- **Why**：<為何需要此變更；1-2 句>
- **Change**：<具體變更點>
 - <point 1>
 - <point 2>
- **Impact**：<影響面；單檔或跨檔數；≤ 2>
- **Rollback**：<一句話如何回退>
- **Acceptance**：<驗收條件>
 - [ ] <condition 1>
 - [ ] <condition 2>
- **基於**：<前置提案 PROPOSAL_YYYYMMDD_NNN / 觸發事件>
- **採納指令**：`採納提案 PROPOSAL_YYYYMMDD_NNN`
```

---

## 📚 使用時機範例

| 場景 | Lite 適用？ | 範例標題 |
|-----|-----------|---------|
| Typo 修正（文字錯字） | ✅ | 修正 RULES_DESIGN_GUIDE §十九 "d1" 應為 "D1" |
| 路徑常數更新 | ✅ | 更新 CRITICAL_PATHS.cron 為 `*/15 * * * *`（從 30 分改 15 分）|
| Token budget 微調（-5% 內）| ✅ | lead.md token_budget 1000 → 950 |
| 新增禁止行為條款 | 🟡 條件 | 單檔內新增 + 配合既有設計 → Lite；否則 Full |
| 新增 validator | ❌ | 需跨檔 + 需測試 → Full |
| 改動 Agent 職責 | ❌ | Agent 行為變更 → Full |
| 新增 skills/* 檔案 | ❌ | 通常需配 tasks/* 或 rules/* 引用 → Full |
| rules/*.md frontmatter version bump（純）| ✅ | 若僅手誤或派生同步觸發 |

---

## 🔧 立案/採納後 SOP（對齐 retro.md §s06）

### 立案時

```bash
node .agents/scripts/generators/gen-proposal-index.mjs --write
bash .agents/tests/index-drift-validator.sh
```

### 採納 Phase A/B 完成時

```bash
git mv .agents/proposals/active/PROPOSAL_YYYYMMDD_NNN.md \
 .agents/proposals/completed/

# 若動 rules/* version
node .agents/scripts/generators/gen-rules-version-index.mjs --write

# 索引同步
node .agents/scripts/generators/gen-proposal-index.mjs --write

# 自檢
bash .agents/tests/run-all.sh --fast
```

---

## ⚠️ 禁止行為（違者必阻斷）

- **絕對禁止** Lite 用於 Agent 行為變更
- **絕對禁止** Lite 跨 ≥ 2 主檔
- **絕對禁止** Lite 省略「基於」欄位
- **絕對禁止** Lite 執行中擴充範圍（觸頂 → 立即中止 + 改立 Full）

---

## 溯源

- **源提案**：PROPOSAL_20260423_010（Lite Proposal 流程）
- **詳細規範**：`RULES_DESIGN_GUIDE §二十一`
- **Full 版本**：`rule-update-proposal-template.md`

---

## Related Decisions

- [ADR-0009](../decisions/0009-proposal-full-lite-tier.md) — Full/Lite Proposal 分級
- [ADR-0019](../decisions/0019-proposal-scope-tiering.md) — Proposal Scope 分層
- [ADR-0020](../decisions/0020-proposal-intent-inheritance.md) — 提案意圖繼承機制
