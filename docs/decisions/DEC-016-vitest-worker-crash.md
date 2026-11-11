---
type: explanation
status: archived
completed_date: 2026-08-14
last_updated: 2026-09-10
tags:
  - vitest
  - crash
  - debugging
wiki_links:
  - [[Testing]]
  - [[Vitest]]
last_verified: "2026-11-11"
related_code:
  - src/modules/verification/
related_docs:
  - docs/TESTING.md
  - docs/modules/infrastructure/monitoring.md
summary: "Vitest worker crash investigation and mitigation plan"
---

# DEC-016: Vitest Worker Crash Investigation (Phase 6.0)

**Date**: 2026-08-13
**Status**: Investigated, Deferred to Phase 7
**Impact**: Cosmetic — 1398/1398 tests pass; only CI exit code affected

## 現象

- `npx vitest run` 結束時出現 "Worker forks emitted error" / "Worker exited unexpectedly"
- 所有 1398 個測試 PASS（89 files passed, 2 skipped）
- vitest exit code = 1，導致 CI 失敗

## 已嘗試方案

1. `--pool=threads` → Node 20 與 worker_threads 的 segfault（環境問題）
2. `--pool=forks` with single fork → 無效果
3. `--no-isolate` → 49 個測試失敗
4. `--maxWorkers=1` → 仍報錯
5. **Global langfuse alias mock** → 移除後所有測試仍通過，但 worker crash 仍在
6. **Per-file vi.mock("langfuse")** → 已加到 5 個 transitively-importing 測試檔案；dailyCheck、newsFetch、monthlyReport、optimizer、weeklyReport、keywords

## 結論

Worker crash 與 langfuse **無直接關聯**。`kgiProvider.test.mjs` 等無關測試也會在退出時觸發。

這是 **vitest 4.1.x 在 Node 20 + fork pool + Docker 環境下的已知問題**：測試全部跑完後，worker process 在 cleanup 階段沒有乾淨退出（可能有 pending timer/handle 未關閉）。測試結果本身是綠的，只是 exit code 不為 0。

## 緩解措施（Phase 6 — 已評估，未應用）

經 2026-11-10 文件一致性審查，上述 Phase 6 緩解措施 **並未實際應用**：

- `package.json` test script 仍為 `"vitest run"`（未加 `|| true`）
- `vitest.config.mjs` 未加入 `passWithNoTests` / `dangerouslyIgnoreUnhandledErrors` 設定
- CI 仍可能因 vitest worker crash 導致 exit code = 1，雖然所有測試案例本身皆通過

本 DEC 維持「Deferred to Phase 7」狀態，緩解措施待 Phase 7 實作（升級 vitest 到 4.2+、切換 Node 22 LTS 或評估 `pool: 'vmThreads'`）。

## 下一步（Phase 7+）

- 升級 vitest 到 4.2+ 或等待 upstream fix
- 切換到 Node 22 LTS（vitest 5.x 對 Node 22 支援更好）
- 評估遷移到 `pool: 'vmThreads'`

## 驗證

```bash
cd /workspace/projects/InvestmentLineNotify
npx vitest run 2>&1 | tail -5
# 預期: 1398 tests passed, 但 exit code = 1（worker crash）
```
