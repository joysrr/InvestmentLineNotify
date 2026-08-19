# Scoring Replay Runner Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 使用版本化 replay fixture 逐日重跑 scoring，驗證輸入、決策與 provenance 能被完整重建。

**Architecture:** 新增最小 replay runner，讀取 fixture 中每一天的 `replay` snapshot，重建 strategy input 並呼叫既有 scoring engine。runner 只負責 orchestration 與結果比對，不複製 scoring 規則。synthetic fixture 與 production report 分開標記，避免測試資料被誤認為真實市場證據。

**Tech Stack:** Node.js ESM、Vitest、既有 replay snapshot、strategy engine。

---

## 目前狀態

- Replay snapshot schema：已完成。
- Provider provenance／raw-normalized hash：已完成。
- Simulator margin／FX policy：已完成。
- Synthetic 三日 fixture：`data/replay-fixtures/core-logic-v1.json` 已存在。
- Production reports：目前只有一份 legacy report，沒有 `replay` 欄位，不能作為完整 replay input。

## Task 1: 定義 replay runner 輸入契約

**Files:**

- Create: `src/modules/replay/replayRunner.mjs`
- Test: `src/modules/replay/replayRunner.test.mjs`

**Step 1: Write failing test**

驗證 runner 能讀取 fixture，依日期排序，並回傳每一天的：

```js
{
  date,
  status: "available",
  expectedDecision,
  replayDecision,
  matches
}
```

測試命令：

```bash
npx vitest run src/modules/replay/replayRunner.test.mjs -t "依日期重播" --no-coverage
```

預期：FAIL，runner 尚未存在。

**Step 2: Implement minimal loader**

只實作：

- 讀取 fixture JSON。
- 驗證 `schemaVersion` 與 `fixtureSource`。
- 依 `date` 排序。
- 缺少 replay input 時回傳明確錯誤，不猜測或補資料。

**Step 3: Verify**

同一個測試應 PASS。

**Step 4: Commit**

```bash
git add src/modules/replay/replayRunner.mjs src/modules/replay/replayRunner.test.mjs
git commit -m "feat: add replay fixture loader"
```

## Task 2: 接入既有 scoring engine

**Files:**

- Modify: `src/modules/replay/replayRunner.mjs`
- Modify: `src/modules/replay/replayRunner.test.mjs`

**Step 1: Write failing test**

使用 fixture 的三日 `signalData`，驗證 runner：

- 每日呼叫既有 scoring／decision path。
- 不直接複製 scoring 公式。
- 保存 replay output 與 fixture expected decision。
- 每日產生 `matches` boolean。

**Step 2: Run RED**

```bash
npx vitest run src/modules/replay/replayRunner.test.mjs -t "重建每日 scoring 決策" --no-coverage
```

預期：FAIL，尚未接入 engine。

**Step 3: Implement minimal adapter**

只新增 adapter 所需的欄位轉換；不得修改既有 strategy scoring 規則。

**Step 4: Run GREEN**

```bash
npx vitest run src/modules/replay/replayRunner.test.mjs --no-coverage
```

預期：測試通過，三日結果可輸出。

**Step 5: Commit**

```bash
git add src/modules/replay/replayRunner.mjs src/modules/replay/replayRunner.test.mjs
git commit -m "feat: replay daily scoring decisions"
```

## Task 3: 加入 provenance 與 deterministic output

**Files:**

- Modify: `src/modules/replay/replayRunner.mjs`
- Modify: `src/modules/replay/replayRunner.test.mjs`

**Step 1: Write failing test**

驗證每筆 replay result 保存：

- `dataProvenance`
- `strategy.hash`
- `dataAsOf`
- `fixtureSource`
- deterministic result hash

同一 fixture 執行兩次，結果 hash 必須相同。

**Step 2: Run RED**

```bash
npx vitest run src/modules/replay/replayRunner.test.mjs -t "deterministic provenance" --no-coverage
```

**Step 3: Implement minimal metadata output**

重用 `canonicalizeJson()` 與 `sha256()`，不新增 dependency。

**Step 4: Run GREEN**

確認兩次執行輸出一致。

**Step 5: Commit**

```bash
git add src/modules/replay/replayRunner.mjs src/modules/replay/replayRunner.test.mjs
git commit -m "feat: add deterministic replay provenance"
```

## Task 4: 文件與 production data boundary

**Files:**

- Modify: `docs/verification/CORE_LOGIC_REPLAY_RESULTS.md`
- Modify: `docs/plans/active/CORE_LOGIC_VALIDATION_PLAN.md`

記錄：

- synthetic fixture replay 是 schema／流程證據，不是真實市場準確度證據。
- legacy report 仍標記 `unavailable`。
- 真實多日 report 需要至少三個含 replay inputs 的 production reports。
- 真實資料累積後，使用同一 runner 執行，不修改 runner 契約。

驗證命令：

```bash
npx vitest run src/modules/replay src/test/unit/replayFixture.test.mjs src/test/unit/replaySnapshot.test.mjs --no-coverage
```

## 執行狀態

- Task 1：完成，loader 測試通過，commit `1179584`。
- Task 2：完成，可注入 evaluator 逐日 replay，commit `ccfbb27`。
- Task 3：完成，provenance 與 deterministic result hash，commit `ca79071`。
- Task 4：本次已回填總計畫與驗證文件。
- Task 5：完成，全量回歸 `106 test files / 1598 tests passed / 6 todo`。

## Task 5: 完整回歸

```bash
npx vitest run --no-coverage
```

成功條件：

- 新增 replay runner 測試通過。
- 原有全量測試無回歸。
- 工作區只包含本階段相關檔案。
- 文件沒有把 synthetic fixture 宣稱為 production evidence。

## 風險與邊界

- 不修改既有 scoring 規則。
- 不把 legacy report 自動轉成可 replay report。
- 不新增真實或看似真實的市場資料。
- 若既有 strategy engine 需要完整 runtime context，先增加 adapter 測試；不要在 runner 內重建另一套 scoring。
- 若 synthetic fixture 只能驗證 schema、不能完成實際 scoring replay，保留該限制並停止，不製造虛假的 match 結果。

## 下一個 checkpoint

完成 Task 1 後先回報 loader contract 與測試結果，再進入 scoring engine adapter。

**建議執行順序：** Task 1 → Task 2 → Task 3 → Task 4 → Task 5。
