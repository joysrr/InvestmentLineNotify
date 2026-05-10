# skills/ 目錄結構說明

> 由 PROPOSAL_20260502_012 建立；by-type 子目錄分組 + audience 標示。

## 目錄結構

```
skills/
├── README.md           （本檔；目錄說明 + audience 標示）
├── templates/    (16)   *-template.md（產出物模板；Agent 寫格式對齊）
├── examples/     (12)   *-examples.md（每 Agent few-shot I/O 範例）
├── checklists/    (7)   *-checklist.md（DoD / 路徑 / 流程強制檢核表）
└── (頂層 28 檔)         protocols / patterns / guides / playbooks / schemas / catalogs / mappings / operations
```

## 頂層檔案分類（功能性）

| 類別              | 範例                                                                         | 說明           |
| ----------------- | ---------------------------------------------------------------------------- | -------------- |
| **Protocols**     | routing-ticket-protocol / review-cycle-protocol / assistant-summary-protocol | M2M 介面協議   |
| **Patterns**      | concurrency-guard-pattern / orchestrator-pattern / stateless-routing-pattern | 設計模式       |
| **Guides**        | lead-orchestration-guide / lead-context-mappings                             | @Lead 操作指南 |
| **Playbooks**     | diagnostic-playbook / rule-slim-down-playbook                                | 緊急情境 SOP   |
| **Schemas**       | memory-palace-schema / blocking-notification-schema                          | Schema 定義    |
| **Catalogs**      | patrol-notification-catalog / assistant-user-commands                        | 規則目錄       |
| **Operations**    | memory-operations / git-pr-workflow / pm2-management                         | 操作流程       |
| **Audit support** | auditor-rubric-prompts / parallel-review-arbitration / dod-audit-template    | 審計輔助       |
| **Misc**          | api-spec-template / advice-template / consultant-bypass-policy / 等          | 其他           |

## Audience 標示

### User-invoked（User 直接讀；< 3 檔）

- `assistant-user-commands.md` — User 解除 P-01~P-26 通知時的指令對照（User 操作介面）

### Agent-invoked（其餘 ~63 檔）

絕大多數 skills 由 @Lead 派發時注入 sub-agent 上下文；User **無需直接讀**。

> 設計理由：audience 切割顯示 user-facing 候選 < 3 檔；以 README 標示替代獨立 `users/` 子目錄（避免不對稱）。

## 維護指引

- 新增 \*-template.md → 放 `templates/`
- 新增 \*-examples.md → 放 `examples/`
- 新增 \*-checklist.md → 放 `checklists/`
- 其他類型 → 頂層；命名遵循 `<scope>-<type>.md` 規則
- 新增 user-invoked skill → 在本 README 「Audience 標示」加列

## 驗證

```bash
python3 .agents/tests/ref-validator.py        # 含子目錄遞迴掃 !ref（PROPOSAL_502_012 L-1）
python3 .agents/tests/run-all.py               # 14 validators 全綠
```

## Related Decisions

ADR-0017（文件分層三原則；位置層級分類先例）/ ADR-0036（Rule Decomposition Patterns；模板外部化）— 在 `decisions/`。
