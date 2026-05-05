---
drawer_id: drawer_memory_general_3e920f3cf54ca409a5d5dc8a
wing: memory
room: general
exported_at: 2026-05-04T03:03:00.079Z
exported_by: mempalace-export.mjs (PROPOSAL_502_020 T-1)
---

# agent_framework Architecture INDEX

對齊 `skills/memory-palace-schema.md` Room 1 規範。

本 workspace 為 framework 自身（meta-project）；以下「模組」指 framework 的核心子系統。

## 條目

| 模組           | 實體路徑                                                      | Owner      | 詳細條目                       |
| -------------- | ------------------------------------------------------------- | ---------- | ------------------------------ |
| rules-system   | .agents/rules/ + RULES_DESIGN_GUIDE\*.md                      | @Architect | architecture/rules-system.md   |
| skills-library | .agents/skills/                                               | @Architect | architecture/skills-library.md |
| memory-palace  | .agents/memory/ + workspaces/<ws>/memory/                     | @Architect | architecture/memory-palace.md  |
| proposals-flow | .agents/proposals/ + scripts/generators/gen-proposal-\*.mjs   | @Retro     | architecture/proposals-flow.md |
| audit-trail    | .agents/docs/Reports/AUDIT_HISTORY.md + AUDIT_DECISION_LOG.md | @Auditor   | architecture/audit-trail.md    |
