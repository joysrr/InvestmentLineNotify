---
skill_id: backend-examples
file_type: examples
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_004
purpose: |
  @Backend 3 組標準 I/O 範例（並行防護 / HITL 阻斷 / DoD 自評）
referenced_by:
  - rules/backend.md
  - skills/templates/dod-audit-template.md
---

# Skill: @Backend Few-Shot 範例（3 組）

## 範例 1：排程並行防護實作

**輸入**：新增 `runDailyCheck` cron job

**@Backend 應產出**：

```javascript
// src/schedulers/dailyCheck.mjs
// 依 skills/concurrency-guard-pattern.md §2.3 實作

import { openSync, closeSync, unlinkSync } from "node:fs";

const LOCK_FILE = "data/.dailyCheck.lock";

export async function runDailyCheck() {
  let fd;
  try {
    fd = openSync(LOCK_FILE, "wx"); // 原子鎖
    closeSync(fd);
  } catch (err) {
    if (err.code === "EEXIST") {
      console.log("[SCHEDULER][dailyCheck] Already running, skip");
      return;
    }
    throw err;
  }

  try {
    // 業務邏輯
    await performDailyCheck();
  } finally {
    unlinkSync(LOCK_FILE); // 確保釋放
  }
}
```

**禁止實作**：

```javascript
// ❌ TOCTOU 分段寫法（Reviewer 標 🔴 BLOCKER）
if (!fs.existsSync(LOCK_FILE)) {
  fs.writeFileSync(LOCK_FILE, "locked");
}
```

## 範例 2：HITL 資料異動申請

**情境**：需批次寫入 80 筆歷史訊號記錄

**@Backend 應執行**：

```
【@Backend HITL 升級】🟡 WARNING
觸發數值：批次寫入 80 筆，超過 ≥ 50 門檻（backend.md §HITL）
業務必要性：歷史回測需一次性寫入
資料安全保障：tmp + rename 原子替換；備份已確認
申請豁免：EX-20260422-001（單次有效）

等待 @Lead 回應「授權執行」後才執行。
```

## 範例 3：DoD 自評回報

**@Backend 完成後回報**：

```
【@Backend DoD 自評】✅
任務：新增 /api/status 端點
通用核心：✅ 5/5（依 dod-audit-template.md）
Agent 擴充：✅ 6/6（依 backend.md §s09 DoD 自評）
待說明項目：無
豁免編號：無
對應階段：S5（實作 → 審查）

請 @Lead 執行 Gate Check。
```

---

## Related Decisions

- [ADR-0004](../decisions/0004-file-based-concurrency-protection.md) — File-based 並行防護 + PM2
- [ADR-0013](../decisions/0013-dod-self-audit.md) — DoD 自評 + Gate Check
- [ADR-0014](../decisions/0014-prior-art-scan.md) — Prior Art Scan 強制程序
