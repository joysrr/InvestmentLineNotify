# Skill: Concurrency Guard Pattern (File-based 並行防護模板)

> `@Backend` 實作涉及 File 寫入時**必須**參照本模板；違反視為 🔴 BLOCKER（對齊 `reviewer.md §s07 資料寫入路徑`）。

---

## 一、核心鐵律（對齊 PROPOSAL_20260420_001）

1. **絕對禁止** `existsSync + write` 的 TOCTOU 分段寫法
2. **絕對禁止** 跨排程無 Lock 直接寫入同一檔案
3. **絕對禁止** 假設「單機執行無並發」— PM2 cluster / cron 重入皆為並發源

## 二、標準實作範例

### 2.1 原子鎖（fs.openSync 'wx' 模式）

```javascript
import { openSync, writeFileSync, unlinkSync, closeSync } from "node:fs";

function acquireLock(lockPath) {
  try {
    const fd = openSync(lockPath, "wx"); // 'wx' = exclusive, fail if exists
    closeSync(fd);
    return true;
  } catch (err) {
    if (err.code === "EEXIST") return false;
    throw err;
  }
}

async function writeWithLock(targetFile, data) {
  const lockPath = `${targetFile}.lock`;
  if (!acquireLock(lockPath)) {
    throw new Error(`Concurrent write blocked: ${targetFile}`);
  }
  try {
    writeFileSync(targetFile, data);
  } finally {
    unlinkSync(lockPath); // 確保釋放，含失敗路徑
  }
}
```

### 2.2 批次寫入原子性（rename 技巧）

```javascript
import { writeFileSync, renameSync } from "node:fs";

function atomicBatchWrite(targetFile, records) {
  const tmpFile = `${targetFile}.tmp.${Date.now()}`;
  writeFileSync(tmpFile, JSON.stringify(records));
  renameSync(tmpFile, targetFile); // rename 為原子操作（POSIX 保證）
}
```

### 2.3 Cron Job 重入防護

```javascript
import { openSync, closeSync, unlinkSync } from "node:fs";

const SCHEDULER_LOCK = "data/.scheduler.lock";

function runScheduler(taskName, taskFn) {
  let fd;
  try {
    fd = openSync(SCHEDULER_LOCK, "wx");
    closeSync(fd);
  } catch (err) {
    console.log(`[SCHEDULER][${taskName}] Already running, skip this cycle`);
    return;
  }
  try {
    taskFn();
  } finally {
    unlinkSync(SCHEDULER_LOCK);
  }
}
```

## 三、審查 Checklist（`@Reviewer` 使用）

- [ ] 所有 File 寫入操作使用 `openSync 'wx'` 或 `renameSync` 模式
- [ ] Lock 檔釋放在 `finally` 區塊（確保異常路徑也釋放）
- [ ] Cron job 有重入防護 Lock
- [ ] 批次寫入 ≥ 50 筆時使用 tmp + rename 原子替換
- [ ] 對外 API 呼叫 + File 寫入的組合有 timeout 保護

## 四、違反處理

違反上述任一項 → `@Reviewer` 標 🔴 `[BLOCKER]` 退件，計入 `REVIEW_CYCLE_LIMIT`。

## 五、與既有規則對齊

- `reviewer.md §s07 資料寫入路徑`：最後一條 TOCTOU 鐵律引用本 skill
- `backend.md §排程任務開發規範`：並行防護強制條款引用本 skill
- `tech-stacks/storage/file-based-storage.md`：實作細節對齊

## 六、測試建議

單元測試範例（對齊 `qa.md §Policy 模組測試規範`）：

```javascript
import { test } from "node:test";
import assert from "node:assert";

test("acquireLock prevents concurrent writes", async () => {
  // 模擬兩個並行寫入
  const p1 = writeWithLock("<TEMP_DIR>/test.json", "data1");
  const p2 = writeWithLock("<TEMP_DIR>/test.json", "data2");
  const results = await Promise.allSettled([p1, p2]);
  const rejected = results.filter((r) => r.status === "rejected");
  assert.strictEqual(rejected.length, 1, "One write should be blocked");
});
```

---

<!-- MACHINE_READABLE
type: project-specific-references
schema_version: v1.0
category: F2
skill_or_task: concurrency-guard-pattern
-->

## 🔗 專案特化參照 (Project-Specific References)

> 本 skill 描述**通用併發鎖模式**；專案特定路徑與測試資料根由 workspace 注入。
> 請參照 `.agents/workspaces/<CURRENT_WORKSPACE>.md` 對應欄位。

| 通用概念           | Workspace 欄位                     | Fallback 行為                                    |
| ------------------ | ---------------------------------- | ------------------------------------------------ |
| 併發鎖模組實作位置 | `PATHS.source_modules.concurrency` | 阻斷：無鎖模組禁止併發寫入                       |
| 併發測試資料根     | `PATHS.data_root`                  | 警告：使用預設 `./test-data/`（CI 可能偏離預期） |

---

## Related Decisions

- [ADR-0004](../decisions/0004-file-based-concurrency-protection.md) — File-based 並行防護 + PM2
- [ADR-0011](../decisions/0011-security-conditional-intervention.md) — @Security 條件式介入（SC-01~10）
