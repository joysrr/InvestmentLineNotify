---
adr_id: ADR-0003
title: Agent Drift Simulator — rules 結構 drift 量化偵測
status: Accepted
date: 2026-04-22
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260422_025
referenced_by:
  - tests/agent-drift-simulator.mjs
  - RULES_DESIGN_GUIDE.SCOPE §十二 Phase E.1
  - FRAMEWORK_VERSION
---

# ADR-0003: Agent Drift Simulator — rules 結構 drift 量化偵測

## Status

**Accepted** (2026-04-22)

## Context

規則變更（拆分章節 / 合併檔案 / 跨檔引用調整）可能在 LLM 讀取時造成語意漂移（drift）：同一情境下新舊規則引發不同行為。歷史無量化驗證手段；每次結構變更都憑感覺。需要一個**靜態分析**工具在不實際跑 LLM 的前提下估算 drift。

## Decision

引入 `.agents/tests/agent-drift-simulator.mjs` 作為 rules 結構變更的 drift 回歸驗證工具：

1. **Mode A（靜態分析）**：分析 rules 間的引用網絡、章節結構、token 預算分布；產出 `drift_score ∈ [0, 1]`
2. **Mode B（動態模擬）**：原設計需跑 LLM 執行抽驗；於 Claude Code 平台不適用，暫擱置
3. **觸發時機**：每次 rules/*.md 結構變更後執行（Phase E.1 強制項）
4. **閾值規則**：
   - `drift_score 下降 > 0.05` → 🟡 警示；@Lead 評估是否補強
   - `drift_score 下降 > 0.10` → 🔴 阻斷；必須修補才可合併

當前 baseline：`drift_score = 0.957`（2026-04-22 記錄於 FRAMEWORK_VERSION）。

## Consequences

### 正面

- 結構性重構有客觀指標可評估
- Phase E.1 驗證機械化，避免憑感覺合併
- 本 session 的多次大型重構（拆檔 / ADR 化）均可用此指標監控
- 歷史追蹤：AUDIT_HISTORY.md 記錄 drift_score 趨勢

### 負面 / Tradeoffs

- 僅 Mode A 有效；Mode B（最強驗證）暫不可用
- drift_score 計算公式為啟發式；絕對值意義有限，主要看**變化量**
- 對純 skills/tasks/tests 調整不適用（僅 rules/ 結構變更）

## Alternatives Considered

### Alternative A: 無量化工具，憑 review 判斷

**為何不採用**：主觀；跨 session / 跨 reviewer 不一致。

### Alternative B: 直接跑真實 LLM 對抽驗提示進行 A/B 對比

**為何不採用**：Claude Code 平台無法程式化呼叫；成本高；離線不可行。

## Related Proposals

- PROPOSAL_20260422_025（原始提案；選項 A Mode A 採用）

## Referenced By

- `tests/agent-drift-simulator.mjs`（實作）
- `RULES_DESIGN_GUIDE.SCOPE §十二 Phase E.1`（執行義務）
- `FRAMEWORK_VERSION` 欄位 `auditor_baseline.drift_score`
- `tests/run-all.sh` validator `drift`

## Notes

- 本 session（PROPOSAL_011 拆檔 / PROPOSAL_016 ADR 化）均未降低 drift_score 0.957 baseline
- Mode B 未來若平台支援（如透過 Claude Agent SDK）可重新啟用
