# Core Logic 驗證結果 — Replay 階段

> 本文件記錄 production-grade dailyCheck 流程在「真實報告累積」階段的驗證結果。
> 與計畫 `docs/plans/active/CORE_LOGIC_VALIDATION_PLAN.md` §14 同步。

## 1. 報告清單盤點（截至 2026-08-31）

- 實際掃描 `data/reports/*.json`：
  1. `2026-08-27.json` (45,748 bytes) — `replay.status: "available"`, 12 筆 provenance ✅
  2. `2026-08-28.json` (45,805 bytes) — `replay.status: "available"`, 12 筆 provenance ✅
  3. `2026-08-31.json` (45,729 bytes) — `replay.status: "available"`, 12 筆 provenance ✅

## 2. Interim Replay 比對結果

執行 `node scripts/run-interim-replay.mjs` 結果：

```text
[2026-08-27] ✅ MATCH
[2026-08-28] ✅ MATCH
[2026-08-31] ✅ MATCH

Strategy Hash（三日一致）: sha256:65d115e89e754ea290b8784e462149ac880ab659a155e274ceb68609db2b87df
Expected Signal: 🚧 槓桿封鎖（三日一致）
Replay Signal:   🚧 槓桿封鎖（三日一致）

🎯 Overall Result Hash: sha256:9cdff8131e871d9bbc6e72f4bedcf69d7f4e885016aa120bdf73f116a1b4a567
📈 成功比對筆數: 3 / 3 (100% MATCH)
```

## 3. 驗證結論

- **達標**：3 個真實交易日報告，replay 全部 100% MATCH。
- **確定性驗證通過**：相同策略版本（strategy hash 一致）下，核心評分邏輯對三組跨日真實輸入產出完全一致的決策。
- **方案 A（減量確定性驗證）** 已達成門檻。
