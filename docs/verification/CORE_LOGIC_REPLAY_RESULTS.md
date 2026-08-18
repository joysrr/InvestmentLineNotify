# Core Logic Replay Results

> **查核日期**：2026-08-18
> **範圍**：Replay schema、legacy compatibility、daily report replay status
> **結論**：目前可判定 replay input 是否足夠；尚未完成完整逐日 decision replay。

## 已驗證契約

`report.replay` 目前包含：

- `schemaVersion: "1.0"`
- Scoring 相關 `signalData`
- `institutionalHistory`
- `dataAsOf`
- strategy snapshot、version、canonical JSON SHA-256 hash
- `rawDecision`
- `finalDecision`
- `scoringMatrixExecuted`
- `status`: `available` 或 `unavailable`

`assessReplayAvailability()` 以必要欄位判定：

- `signalData`
- `dataAsOf`
- `strategy.hash`
- `finalDecision`

缺少任一必要欄位時，回傳 `status: "unavailable"` 與缺少欄位清單；不猜測、不回填舊報告。

## Legacy report 行為

沒有 `report.replay` 的舊報告會由 compatibility layer 標記：

```json
{
  "status": "unavailable",
  "schemaVersion": null,
  "reason": "legacy_report_without_replay_inputs"
}
```

## 測試證據

執行命令：

```bash
npx vitest run \
  src/test/unit/replaySnapshot.test.mjs \
  src/test/unit/dataFreshness.test.mjs \
  src/test/unit/dataFreshnessConfig.test.mjs \
  src/test/unit/scheduler/dailyCheck.test.mjs \
  src/test/unit/strategyEngine.test.mjs \
  src/test/unit/ilnState.test.mjs \
  --no-coverage
```

結果：

- Test files: `7 passed`
- Tests: `57 passed`

## 目前 provenance 進度

- `buildDataProvenance()`：已完成 raw／normalized hash 與 `verified`／`unverified` 判定。
- `buildSourceProvenance()`：已完成 `_meta.sources` 到 dataset provenance 的 deterministic adapter。
- `buildReportReplaySnapshot()`：已接收 `sourceMetadata`。
- `fetchAllMacroData()` → `dailyRunContext` → scheduler：已傳遞 `_meta.sources` 與 slot/provider dataset mapping。
- 目前 provenance 仍為 `unverified`，因 provider pipeline 尚未保存 raw payload 與 normalized payload hash。

## 尚未完成

以下項目仍不能宣稱完成：

1. 對版本化 historical report fixture 執行完整 scoring replay。
2. 保存 provider、dataset、workspace-relative path、raw file hash、normalized data hash。
3. 對每一份正式報告產生可追蹤的 replay result artifact。
4. Simulator 的 margin／FX／market direction raw bridge。

因此目前結論是：**Replay availability classification 已完成；完整逐日 decision replay 尚未完成。**
