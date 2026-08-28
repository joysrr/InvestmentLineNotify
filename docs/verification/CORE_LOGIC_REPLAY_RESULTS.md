# Core Logic 驗證結果 — Replay 階段

> 本文件記錄 production-grade dailyCheck 流程在「真實報告累積」階段的驗證結果。
> 與計畫 `docs/plans/active/CORE_LOGIC_VALIDATION_PLAN.md` §14 同步。

## 1. 報告清單盤點（截至 2026-08-28）

- 實際掃描 `data/reports/*.json`：
  1. `2026-08-27.json` (45,748 bytes) — `replay.status: "available"`, 12 筆 provenance ✅
  2. `2026-08-28.json` (45,805 bytes) — `replay.status: "available"`, 12 筆 provenance ✅

## 2. Interim Replay 比對結果

執行 `node scripts/run-interim-replay.mjs` 結果：

```text
[2026-08-27] ✅ MATCH
  - Strategy Hash: sha256:65d115e89e754ea290b8784e462149ac880ab659a155e274ceb68609db2b87df
  - Expected Signal: 🚧 槓桿封鎖
  - Replay Signal:   🚧 槓桿封鎖

[2026-08-28] ✅ MATCH
  - Strategy Hash: sha256:65d115e89e754ea290b8784e462149ac880ab659a155e274ceb68609db2b87df
  - Expected Signal: 🚧 槓桿封锁
  - Replay Signal:   🚧 槓桿封鎖

🎯 Overall Result Hash: sha256:baad7e75bafc9a8a9de2d9fc73b23a280ea955425e78bc8b761c183e57e56119
📈 成功比對筆數: 2 / 2 (100% MATCH)
```

## 3. 累積與驗證進度

- 當前：**2 / 3** 交易日
- 下個交易日：第 3 份報告（8/31 交易日）落地後即可進行最終收尾驗證。
