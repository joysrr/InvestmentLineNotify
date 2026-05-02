---
adr_id: ADR-0011
title: @Security 條件式介入（SC-01~10 十項觸發）
status: Accepted
date: 2026-04-21
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260421_020
  - PROPOSAL_20260423_003
referenced_by:
  - rules/security.md
  - skills/security-audit.md §1
  - RULES_DESIGN_GUIDE.QUALITY §十九.C
  - tasks/emergency-shutdown-playbook.md
---

# ADR-0011: @Security 條件式介入（SC-01~10 十項觸發）

## Status

**Accepted** (2026-04-21；Hotfix 擴充於 2026-04-23)

## Context

`@Security`（ADR-0010）若每個任務都介入 → 資源浪費 + 週期拉長；但若完全由 @Lead 判斷是否介入 → 主觀漏判風險。需要**機械性觸發條件**列表。

## Decision

定義 **SC-01 ~ SC-10 十項資安觸發條件**；任一觸發 → @Security 強制介入：

| SC    | 觸發條件            | 範例                       |
| ----- | ------------------- | -------------------------- |
| SC-01 | Token 時效機制      | JWT expiry / refresh token |
| SC-02 | 金鑰 / 密碼處理     | env.SECRET / keystore      |
| SC-03 | strategyWeight 異動 | 策略權重檔案修改           |
| SC-04 | 資料刪除 / 覆蓋     | unlink / destructive write |
| SC-05 | API 授權            | Bearer / OAuth scope       |
| SC-06 | 初始資料驗證        | 使用者輸入 validation      |
| SC-07 | 錯誤訊息洩漏        | stacktrace 回應            |
| SC-08 | 併發原子性          | race condition / lock      |
| SC-09 | 第三方套件引入      | npm install 新 package     |
| SC-10 | Log 敏感資料        | console.log(password)      |

**介入方式**：

- 正常流程：第 6.5 平行審查（與 @Reviewer 並行）
- **Hotfix 流程**（依 ADR-0008 heavy 路徑）：擴充至 Step 2 平行審查
- **鐵律**：SC 任一觸發 → 即使 Hotfix 也必須 heavy 路徑（禁止 light）

**偵測記錄**：派發訊息含 `sc_evaluation: { triggered: bool, sc_codes: [...], reason: ... }` 欄位；即使不觸發也需明文理由（防事後追究）。

## Consequences

### 正面

- 介入決策機械化（降主觀漏判）
- 10 項覆蓋常見資安邊界
- 派發訊息可審計（sc_evaluation 必填）
- Hotfix 資安空窗補齊

### 負面 / Tradeoffs

- 10 項需定期校準（新型資安問題可能需 SC-11+）
- 清單可能冗餘（如 SC-02 / SC-05 有重疊）
- `reason` 填寫強制性增加派發訊息長度

## Alternatives Considered

### Alternative A: @Lead 主觀判斷

**為何不採用**：跨 session 不一致；漏判風險。

### Alternative B: 依檔案路徑機械觸發

**為何不採用**：路徑 whitelist 維護成本高；漏網大。

## Related Proposals

- PROPOSAL_20260421_020（原始提案：@Security + SC-01~10）
- PROPOSAL_20260423_003（Hotfix 三支柱擴充 SC 介入）

## Referenced By

- `rules/security.md`（10 項審查範疇）
- `skills/security-audit.md §1`（SC 對應 checklist）
- `RULES_DESIGN_GUIDE.QUALITY §十九.C`（Hotfix 介入規範）
- `tasks/emergency-shutdown-playbook.md §3.2.B`（heavy 路徑 Step 2）

## Notes

- SC 清單擴充需提 Full Proposal（涉及 Agent 行為變更）
- 與 ADR-0010（並行審查）共同構成資安審查完整機制
