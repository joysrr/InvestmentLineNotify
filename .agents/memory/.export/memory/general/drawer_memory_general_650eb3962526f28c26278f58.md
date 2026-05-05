---
drawer_id: drawer_memory_general_650eb3962526f28c26278f58
wing: memory
room: general
exported_at: 2026-05-04T03:03:00.081Z
exported_by: mempalace-export.mjs (PROPOSAL_502_020 T-1)
---

nts/docs/Reports/AUDIT_HISTORY.md + AUDIT_DECISION_LOG.md | @Auditor | architecture/audit-trail.md |
| validators | .agents/tests/\*.mjs + run-all.sh | @Auditor | architecture/validators.md |
| langgraph-poc | poc/langgraph-mcp/ | @Backend | architecture/langgraph-poc.md |

## 依賴關係（高階）

```
rules-system ──► skills-library ──► memory-palace
     │                  │                  │
     └──► proposals-flow ◄──── audit-trail ◄──── validators
                                                    │
                                                    └──► langgraph-poc
```

## 維護規範

新增模組時：

1. 寫入此 INDEX 表
2. 建立 `architecture/<module>.md` 條目
3. 若涉及 framework 鐵律 → 同步寫 ADR

<!-- END: agent_framework architecture index -->
