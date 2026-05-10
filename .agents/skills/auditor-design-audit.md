<!-- MACHINE_READABLE
type: skill
category: F1
id: auditor-design-audit
load_priority: lazy
load_when: "@Auditor 跑 dim 6 Design Coherence 評分時"
related_proposals: [PROPOSAL_20260502_048]
related_decisions: [ADR-0045, ADR-0005]
-->

# Skill: Auditor Design Audit（dim 6 Design Coherence 評分 rubric）

> 由 PROPOSAL_502_048 + ADR-0045 建立；F1 類（純通用評分）。
> @Auditor 既有 5 dim 偏行為層；本 skill 規範新增 dim 6 設計層評分。

## §1 5 子項評分

每子項 1 分；總 5 分。

### 6.1 條文-實作一致性（1 分）

**評分依據**：

- 跑 `tests/condition-claim-validator.py` 看 warning 數量
- 0 warn → 1.0 分
- 1-3 warn → 0.7 分
- 4-10 warn → 0.4 分
- > 10 warn → 0.0 分

**評分流程**：

```bash
python3 .agents/tests/condition-claim-validator.py 2>&1 | grep -c "WARN"
```

### 6.2 跨 module 邏輯一致（1 分）

**手動 audit**（@Auditor LLM 推理）：

- 抽 3-5 個關鍵鐵律 / 規則交集點檢查衝突
- 例：hotfix 鐵律 vs autonomy default vs B-1 hint vs mempalace skip
- 例：multi_signal 拆分 vs pending_group_inherited_from
- 評分：每發現 1 衝突 -0.3；最低 0.0

### 6.3 設計意圖偏移（1 分）

**Random Sample 5 ADR**：

- 隨機抽 5 個 ADR（含近 3 個月新建）
- 比對 ADR Decision 條目 vs 實際 skill/rule 行為條文
- 偏移 = ADR 寫 X 但 framework 實際做 Y
- 評分：每偏移 1 條 -0.2；最低 0.0

### 6.4 Schema Completeness（1 分）

**評分依據**：

- 跑 `tests/schema-completeness-validator.py` 看 warning 數量
- 過濾 noise（非 ROUTING_TICKET 欄位 reference）
- 真信號 0 → 1.0 分
- 1-2 真信號 → 0.6 分
- 3-5 真信號 → 0.3 分
- > 5 → 0.0 分

### 6.5 Governance Feedback Loop 健康（1 分）

**指標**：

- P-38 KEYWORD_LIST_EXPAND_PENDING 觸發率（@Auditor 月度報）
- KNOWN_ISSUES 累積率（KI 數量增長 vs 解除率）
- 最近 walkthrough 收斂趨勢（GR 是否穩降）

**評分**：

- LLM fallback < 20% + KI 解除率 > 0.5 + walkthrough GR 穩降 → 1.0 分
- 任 1 項異常 → 0.6 分
- 多項異常 → 0.3 分

## §2 跑頻

- **定期 audit**（既有觸發點；如 user 明示「跑 audit」）
- **stabilization milestone 凍結前必跑**（dim 6 < 2.0 → 阻斷凍結）
- **integration-walkthrough Step 4 達凍結門檻**時跑

## §3 結果處理

| dim 6 分數 | 動作                            |
| ---------- | ------------------------------- |
| 4.0-5.0    | 正常；可凍結 milestone          |
| 3.0-3.9    | 正常；建議補強（warn level）    |
| 2.0-2.9    | P-15 🟡 升 dim 6 觸發           |
| 0.0-1.9    | 🔴 阻斷凍結 milestone（不可凍） |

## §4 與 dim 1-5 既有規則協同

- dim 6 為**新增**；不取代既有 5 dim
- AUDIT_HISTORY.md 表加 dim6 欄位
- @Auditor 跑時間 +20%（5 dim → 6 dim）；可接受成本

## §5 鐵律

- ❌ **絕對禁止** dim 6 評分跳過 condition-claim / schema-completeness validator 跑（必有客觀 metric 支撐）
- ❌ **絕對禁止** 6.3 設計意圖偏移評分靠記憶（必抽 5 ADR random sample）
- ❌ **絕對禁止** dim 6 < 2.0 仍凍結 milestone

---

**維護紀錄**：

- 2026-05-07：PROPOSAL_502_048 + ADR-0045 建立

## Related Decisions

- [ADR-0045](../decisions/0045-design-audit-dimension.md) — 本 skill 之決策依據
- [ADR-0005](../decisions/0005-auditor-scoring.md) — 既有 5 dim；本 skill amends
- [ADR-0044](../decisions/0044-integration-walkthrough-protocol.md) — Walkthrough；協同觸發
