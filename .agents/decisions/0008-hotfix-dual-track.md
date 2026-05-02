---
adr_id: ADR-0008
title: Hotfix 雙軌流程（light 3 步 / heavy 5 步）
status: Accepted
date: 2026-04-24
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260422_026
  - PROPOSAL_20260423_003
  - PROPOSAL_20260423_009
referenced_by:
  - tasks/emergency-shutdown-playbook.md §三
  - tasks/hotfix-checklist.md
  - rules/lead.md §s07
  - RULES_DESIGN_GUIDE.QUALITY §十九
---

# ADR-0008: Hotfix 雙軌流程（light 3 步 / heavy 5 步）

## Status

**Accepted** (2026-04-24；修正 2026-04-22 的單一 5 步流程)

## Context

初版 Hotfix 流程一律 5 步（診斷組 + @Security 條件式 + @Lead 上下文注入 + Gate Check + 事後補文件）。實務遭遇兩類事故：

- **簡單事故**（cron typo / 純設定字串修正）：5 步流程過於繁瑣，實際生產中斷期間拖延修復
- **複雜事故**（跨檔 / 涉資安 / 業務邏輯）：5 步仍必要

需依事故**複雜度**分流；保留資安完整性同時恢復簡單事故的敏捷。

## Decision

建立 **Step 0 複雜度判定決策樹** → 依結果分流：

```
Step 0（所有 Hotfix 必執行；防 bypass）：
├─ SC-01~10 任一觸發？       → YES → heavy 鎖定
├─ D1-D4 任一觸發？           → YES → heavy
├─ 影響範圍 > 1 檔案？         → YES → heavy
├─ 涉及業務邏輯/state？        → YES → heavy
├─ 全為 typo / 設定常數？      → YES → light
└─ 不確定？                    → heavy（預設保守）
```

判定順序**由嚴至寬**（資安 > 複雜度 > 範圍 > 性質），防止判定者選小路。

**light 路徑（3 步）**：

1. 修復實作（單檔內；禁擴充）
2. @Reviewer 快速審查
3. @Lead Gate Check 3 條件（事後補文件可免）

**heavy 路徑（5 步）**（依 ADR-0011 / 0012 三支柱）：

1. 診斷階段（條件式診斷組）
2. 修復 + 條件式 @Security 平行審查
3. @QA 核心路徑驗證
4. @Lead Gate Check 4 條件
5. 事後補文件（D1-D4 觸發加入 @Retro 根因）

**禁止行為**（鐵律）：

- 跳過 Step 0 判定
- SC/D 任一觸發仍派 light
- light 路徑中擴充至跨檔

## Consequences

### 正面

- 簡單事故恢復敏捷（cron typo 從 5 步 → 3 步）
- 複雜事故資安完整性不變（heavy 路徑保留三支柱）
- 判定順序防 bypass（資安優先鎖定）
- 派發訊息含 `Complexity-Tier` + `Tier-Reason` 可審計

### 負面 / Tradeoffs

- 判定 Step 0 本身有成本（即使 typo 也需走判定）
- light 路徑省事後補文件 → 需記錄「豁免理由」
- 判定錯誤風險（誤判 heavy 為 light）需 @Reviewer 兜底

## Alternatives Considered

### Alternative A: 維持單一 5 步

**為何不採用**：簡單事故拖延生產恢復。

### Alternative B: 完全由 LLM 動態判斷

**為何不採用**：判斷結果可能漂移；需 Step 0 yaml 固化理由。

### Alternative C: 三軌（light/medium/heavy）

**為何不採用**：二元即可覆蓋多數情境；三軌增加決策成本。

## Related Proposals

- PROPOSAL_20260422_026（最初 3 步設計）
- PROPOSAL_20260423_003（擴為 5 步加三支柱）
- PROPOSAL_20260423_009（修正範圍 → 分輕重；本 ADR 的直接來源）

## Referenced By

- `tasks/emergency-shutdown-playbook.md §三`（完整流程）
- `tasks/hotfix-checklist.md`（雙軌 checklist）
- `rules/lead.md §s07`（派發規則）
- `RULES_DESIGN_GUIDE.QUALITY §十九.G`（分流決策表）

## Notes

- 本 ADR 為「修正範圍」而非推翻；三支柱（ADR-0011/0012）保留於 heavy 路徑
- light 路徑恢復 PROPOSAL_20260422_026 原設計
- 資安零容忍（SC/D 任一觸發立即鎖 heavy）為不可妥協原則
