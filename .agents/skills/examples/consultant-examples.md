---
skill_id: consultant-examples
file_type: examples
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_004
purpose: |
  @Consultant 3 組標準 I/O 範例（領域注入 / 衝突警告 / Bypass）
referenced_by:
  - rules/consultant.md
---

# Skill: @Consultant Few-Shot 範例（3 組）

## 範例 1：技術面 vs 左側交易衝突

**輸入**：

- `domains/finance-technical.md` + `domains/finance-left-side.md` 同時注入
- 需求：「RSI < 30 時進場」vs 左側「破底建倉」邏輯矛盾

**預期 Agent 行為**：

```markdown
# ADVICE\_<功能>.md

🚨 領域衝突警告

【領域：技術面】RSI < 30 訊號建議進場，但成交量尚未放大，屬弱反彈訊號。
【領域：左側交易】當前跌幅僅 8%，未達破底建倉標準（通常 ≥ 15%）。

**衝突點**：技術面建議「立即進場」；左側建議「再等破底」。
**權重決定參數要求**：User 必須在 draft_features.md 明文填寫 `strategyWeight: { technical: 0.X, leftside: 0.Y }`，系統才會解除阻斷。
```

## 範例 2：生命週期 vs 總經分歧

**輸入**：

- `domains/finance-lifecycle.md` + `domains/math-quant.md` 注入
- 需求：退休前 5 年族群的槓桿率調整

**預期 Agent 行為**：

```markdown
【領域：生命週期投資法】退休前 10 年開始應降低槓桿至 ≤ 1.2x，避免爆倉風險
【領域：機率統計】當前持股波動率年化 35%，2 倍槓桿下 99% 置信區間極端回撤達 40%

**合流建議**：退休前 5 年族群槓桿應降至 1.1x，不啟用質押槓桿策略。
```

## 範例 3：未知知識領域

**輸入**：需求涉及「隱含波動率微笑曲線」，但 `domains/` 無對應檔案

**預期 Agent 行為**：

```markdown
❓ 未知知識領域

本功能涉及「隱含波動率微笑曲線」（options pricing skew），
但 `.agents/domains/` 目前無此領域知識。

**建議**：User 補充 `.agents/domains/options-pricing.md` 後，
重新呼叫 `@Consultant` 進行完整審查。
```

---

## Related Decisions

- [ADR-0002](../decisions/0002-workspace-context-injection.md) — Workspace 靜態注入
- [ADR-0011](../decisions/0011-security-conditional-intervention.md) — @Security 條件式介入（SC-01~10）
