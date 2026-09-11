---
type: report
status: current
last_updated: 2026-09-10
tags:
  - audit
  - definition-of-done
wiki_links: []
---

# DoD Audit Log

> 由 PROPOSAL_20260422_012 建立。每次 Workflow 階段轉移時由 @Lead append 一行。
> 供 @Auditor（PROPOSAL_008）定期統計 DoD 達成率。

## 紀錄格式

| 日期       | Ticket  | 階段轉移 | Agent    | 通用核心 | 擴充 | 豁免編號 | 備註                                                         |
| ---------- | ------- | -------- | -------- | -------- | ---- | -------- | ------------------------------------------------------------ |
| 2026-04-22 | INIT    | —        | @Lead    | N/A      | N/A  | —        | 初始化（PROPOSAL_012 採納執行）                              |
| 2026-04-25 | ILN_006 | DONE     | @Backend | ✅       | ✅   | —        | 測試對照表更新、DoD 規範強化、測試骨架建立                   |
| 2026-04-25 | ILN_005 | DONE     | @Backend | ✅       | ✅   | —        | envGuard 警告機制建立、文檔與實作落差對齊                    |
| 2026-04-25 | ILN_007 | DONE     | @Backend | ✅       | ✅   | —        | API Contract 測試架構建立、Webapp 測試環境配置、API 異動 SOP |
| 2026-04-25 | ILN_002 | DONE     | @Backend | ✅       | ✅   | —        | 資料新鮮度標籤注入、關鍵資料過期告警、FX 快取保護            |
| 2026-04-25 | ILN_001 | DONE     | @Backend | ✅       | ✅   | —        | Langfuse 降級策略 (三層)、AI 過期感知標籤注入                |
| 2026-04-25 | ILN_003 | DONE     | @Backend | ✅       | ✅   | —        | LLM Judge 雙層觸發機制、高風險日強制評估                     |
| 2026-04-25 | ILN_004 | DONE     | @Backend | ✅       | ✅   | —        | 黑名單優化器批次上限保護、Rollback 復原腳本                  |

## 使用規範

- **觸發時機（強制）**：每次 PR merge 至 `main` 時，`@Lead` 必須在 24 小時內 append 至少一行 Gate Check 紀錄；若 Gate Check 未通過，以 `BLOCKED` 標示並附原因
- 每列必須 append-only，不可修改歷史
- 若連續 **3 個自然日** 無任何 append，視為 DoD 機制中斷，需在下次 Retro 列為議題討論
- `@Auditor` 每週執行 DoD 達成率統計（通過 ✅ / 全部 Gate Check 次數），統計結果寫入 `docs/reports/AUDIT_HISTORY.md` 作為維度 5.1 評分依據
