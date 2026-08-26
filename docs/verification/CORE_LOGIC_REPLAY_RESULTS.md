# Core Logic 驗證結果 — Replay 階段

> 本文件記錄 production-grade dailyCheck 流程在「真實報告累積」階段的驗證結果。
> 與計畫 `docs/plans/active/CORE_LOGIC_VALIDATION_PLAN.md` §14 同步。

## 1. 報告清單盤點（截至 2026-08-26）

- 實際掃描 `data/reports/*.json`：目前僅有 `2026-08-26.json` 一份（45,851 bytes，含完整 `replay` envelope、`replay.status: "available"`、12 筆 provider provenance）作為本次重新累積的 baseline。
- 先前 2026-08-19 ~ 2026-08-25 的報告檔案未留存；先前累積進度紀錄（6/10）為誤判，已於 2026-08-26 確認後決定「方案 A」從 baseline 重新累積。

## 2. Replay Envelope 檢查（`2026-08-26.json`）

- `replay.schemaVersion = "1.0"` ✅
- `replay.status = "available"` ✅
- `replay.strategy.hash` 存在（SHA-256，sha256:65d115e89e754ea29...）✅
- `replay.dataProvenance` 共 12 筆 ✅
- `replay.finalDecision` 為完整 `signals` 物件快照 ✅

## 3. 累積進度

- 當前：1 / 10（baseline）
- 下個交易日（2026-08-27）執行後：2 / 10
- 中途審核（5 / 10）：第 5 份報告保存後進行 schema/provenance audit
- 正式 replay（10 / 10）：達成後進入 §14 production replay fixture 階段

## 4. 已知限制

- `data/reports/` 未被 git 追蹤（不在 `.gitignore` 但歷史上從未 commit），實際報告落地於本地工作目錄。CRON job 部署於正式區後，須確認 `process.cwd()` 與 `archiveManager` 的 `DATA_DIR` 解析路徑一致。
- 8/19 ~ 8/25 報告曾因同名檔案覆寫／清理流程而未留存。如需更早歷史，建議建立 date-keyed 的 `data/reports/YYYY-MM-DD/<run-id>.json` 結構以避免同日覆寫。
