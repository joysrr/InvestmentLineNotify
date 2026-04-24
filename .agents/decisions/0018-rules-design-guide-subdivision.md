---
adr_id: ADR-0018
title: RULES_DESIGN_GUIDE 拆檔（DESIGN/SCOPE/QUALITY）
status: Accepted
date: 2026-04-24
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260423_011
referenced_by:
  - RULES_DESIGN_GUIDE.md（orchestrator）
  - RULES_DESIGN_GUIDE.DESIGN.md
  - RULES_DESIGN_GUIDE.SCOPE.md
  - RULES_DESIGN_GUIDE.QUALITY.md
---

# ADR-0018: RULES_DESIGN_GUIDE 拆檔（DESIGN/SCOPE/QUALITY）

## Status

**Accepted** (2026-04-24)

## Context

`RULES_DESIGN_GUIDE.md` 累積至 1194 行 / 21 章節；觸發 periodic-design-review §7 警示維度 #6（單檔 rules ≥ 800 行）。章節性質異質（結構設計 / 範圍治理 / 量化品質），LLM 讀取時載入大量無關章節增加 token 負擔。

## Decision

**自我應用 ADR-0017（文件分層原則）於 RULES_DESIGN_GUIDE 本身**：

拆為 1 個 orchestrator + 3 個主題子檔：

| 檔案 | 主題 | 章節 | 行數 |
|------|------|------|------|
| `RULES_DESIGN_GUIDE.md` | **Orchestrator** | TOC + 專案特化參照 + 相容層 | ~175 |
| `RULES_DESIGN_GUIDE.DESIGN.md` | 設計形式 | §一、三、五、六、九 | ~248 |
| `RULES_DESIGN_GUIDE.SCOPE.md` | 範圍治理 | §十一、十二、十五、十六、十七、二十、二十一 | ~483 |
| `RULES_DESIGN_GUIDE.QUALITY.md` | 品質與量化 | §二、四、七、八、十四、十八、十九 | ~457 |

**章節索引映射表**（orchestrator §TOC）：舊 §N → 新子檔 + §N

**相容層**（orchestrator 文末）：
- 歷史 60+ proposals/completed 引用「§N」保留可讀（透過 TOC 映射）
- 新提案強制用 `RULES_DESIGN_GUIDE.<subject>.md#<N>` 格式
- DEPRECATED 時程：2026-10-24 標記 / 2027-04-24 允許移除

**子檔 frontmatter 格式**：`parent: RULES_DESIGN_GUIDE.md` + `subject: DESIGN|SCOPE|QUALITY` + `source_sections: [...]`

**版本**：`RULES_DESIGN_GUIDE.md` v1.13 → **v2.0**（major bump；結構性變更）

## Consequences

### 正面

- 單檔最大行數 1194 → 483（遠低於 800 警示）
- LLM 載入特定主題子檔時 token 成本降低
- 章節歸屬清晰（新章節需判斷屬於哪個 subject）
- 自我應用驗證 ADR-0017 普適性

### 負面 / Tradeoffs

- 跨 subject 章節引用需加檔名前綴（如 `SCOPE #十七.B`）
- 外部引用需同步更新（執行 PROPOSAL_011 Phase D 完成）
- 新 LLM 需先讀 orchestrator TOC 了解結構
- 相容層增加 ~30 行開銷（值得）

## Alternatives Considered

### Alternative A: 單檔維持但分章節 token 預算

**為何不採用**：無法解決載入時整檔進入 context 的問題。

### Alternative B: 拆為 20 個單章節檔（每章一檔）

**為何不採用**：過度細化；導航成本過高。

### Alternative C: 拆為 6+ 個主題子檔

**為何不採用**：DESIGN/SCOPE/QUALITY 三主題已足夠覆蓋；更細增管理成本。

## Related Proposals

- PROPOSAL_20260423_011（原始提案：RULES_DESIGN_GUIDE 拆檔）

## Referenced By

- `RULES_DESIGN_GUIDE.md`（orchestrator + TOC + 相容層）
- `RULES_DESIGN_GUIDE.DESIGN.md`（設計形式子檔）
- `RULES_DESIGN_GUIDE.SCOPE.md`（範圍治理子檔）
- `RULES_DESIGN_GUIDE.QUALITY.md`（品質與量化子檔）

## Notes

- 本 ADR 為自我應用的典範：原則（ADR-0017）用於自身驗證
- 與 ADR-0009（Full/Lite proposal）/ ADR-0008（Hotfix 分軌）共同體現「二元/三元分層」設計範式
- 解除 `periodic-design-review §7 警示維度 #6`
