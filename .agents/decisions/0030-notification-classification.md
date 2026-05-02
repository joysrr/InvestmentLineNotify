---
adr_id: ADR-0030
title: 通知分級標準（五級符號體系）
status: Accepted
date: 2026-04-21
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260421_017
referenced_by:
  - RULES_DESIGN_GUIDE.DESIGN §九
  - rules/lead.md §s04 通知接收與處理優先級
  - rules/assistant.md §巡邏
  - skills/patrol-notification-catalog.md
---

# ADR-0030: 通知分級標準（五級符號體系）

## Status

**Accepted** (2026-04-21)

## Context

跨 Agent 回報使用自由格式文字時，@Lead 需逐字判斷優先級，易誤判或漏處理。需要統一**機械可 grep** 的符號體系，配合 ADR-0001 三鐵律「僅 grep 符號，不讀報告原文」。

## Decision

建立 **五級通知符號** + **處理優先級對應**：

| 符號            | 級別       | 處理時限             | 動作                           |
| --------------- | ---------- | -------------------- | ------------------------------ |
| 🔴 **CRITICAL** | 立即       | 暫停其他任務         | 處理阻斷原因；未解除前禁新派發 |
| ❌ **BLOCKED**  | 立即       | 暫停其他任務         | 同 🔴（執行失敗的 BLOCKER）    |
| 🟡 **WARNING**  | 本對話內   | 評估是否升級         | 依情境決定是否通知 User        |
| ✅ **DONE**     | 確認即可   | 更新 PENDING_ACTIONS | 正常結束                       |
| 🟢 **INFO**     | 下次巡邏前 | 寫入日誌             | 紀錄性通知                     |

### 多通知處理順序

```
🔴 / ❌  →  🟡  →  ✅ / 🟢
```

### 格式規範

**標頭行**：每個報告必以符號開頭

```markdown
🔴 CRITICAL: <一句話說明>
🟡 WARNING: ...
✅ DONE: ...
```

### 禁止行為

- **絕對禁止** 存在未處理 🔴 / ❌ 通知時派發新任務
- **絕對禁止** 將多級別通知合併為自由格式回覆（必須分級明示）
- **絕對禁止** 以文字描述替代符號（如「嚴重問題：」而不加 🔴）

### ADR-0001 關聯

ADR-0001 三鐵律第 2 條「禁止文本合併」明確要求 @Lead 僅 grep 符號判斷狀態；本 ADR 規範符號體系的完整性。

## Consequences

### 正面

- @Lead grep 即可判優先級（ADR-0001 三鐵律可行性基礎）
- 跨 Agent 回報格式一致
- 視覺辨識容易（emoji）
- 機械統計友善（grep -c）

### 負面 / Tradeoffs

- Emoji 在部分終端顯示不正常（但主要目的是 grep 非顯示）
- 五級可能過細（某些情境 🟡 vs 🟢 邊界模糊）
- 新 Agent 加入需學習符號規範

## Alternatives Considered

### Alternative A: 三級（嚴重/警告/訊息）

**為何不採用**：無法區分執行失敗（BLOCKED）vs 偵測警示（CRITICAL）；細分有價值。

### Alternative B: 純文字標籤（[CRITICAL] 等）

**為何不採用**：視覺辨識不如 emoji；grep 無差別（emoji 亦可 grep）。

## Related Proposals

- PROPOSAL_20260421_017（原始提案：@Assistant 通知分級統一）

## Referenced By

- `RULES_DESIGN_GUIDE.DESIGN §九 通知分級標準`（完整規範）
- `rules/lead.md §s04 通知接收與處理優先級`
- `rules/assistant.md §巡邏`（P-XX 通知使用本分級）
- `skills/patrol-notification-catalog.md`（每 P-XX 標通知級別）

## Notes

- 與 ADR-0001（三鐵律）互為依賴：本 ADR 是三鐵律第 2 條「僅 grep 符號」的規範基礎
- 與 ADR-0029（P-XX 目錄）協同：每 P-XX 必明示通知級別
