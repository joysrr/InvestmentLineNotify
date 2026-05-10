# `.agents/scripts/generators/` — 索引自動產生器

> 由 PROPOSAL_20260423_007 建立。降低提案執行 Phase E 的手動同步成本。
> 對齊 `RULES_DESIGN_GUIDE §十二 Phase E 自動化`。
> 2026-04-30 更新（PROPOSAL_20260430_005）：補完整 generator 清單 + lib 應用真實狀態 + 退出碼契約。

## 設計原則

- **SSOT（Single Source of Truth）**：rules / proposals frontmatter 為真相；INDEX 為派生視圖
- **Dry-run 預設**：所有 generator 預設僅 console.log；加 `--write` 才實際寫檔
- **零依賴**：純 Node.js 內建模組（沿用 `framework-diff.mjs` 風格）
- **不取代 LLM 判斷**：執行摘要 / 意圖繼承 / Notes 等內容判斷仍由 `@Lead` 處理

## 工具清單（共 6 個 generator）

| Generator                     | 用途                                   | CLI                                                 |
| ----------------------------- | -------------------------------------- | --------------------------------------------------- |
| `gen-rules-version-index.mjs` | RULES_VERSION_INDEX 版本表             | `[--write] [--check]`                               |
| `gen-proposal-index.mjs`      | PROPOSAL_INDEX 統計 + OPEN/IN_PROGRESS | `[--write] [--check]`                               |
| `gen-proposal-summary.mjs`    | 提案摘要批次產出（dev tool）           | `[--write] [<glob>]`                                |
| `gen-adr-index.mjs`           | decisions/README.md ADR 表             | `[--write] [--check]`                               |
| `gen-changelog.mjs`           | CHANGELOG `[vX.Y]` 條目模板            | `--proposal <path> [--write] [--bump minor\|major]` |
| `gen-framework-version.mjs`   | FRAMEWORK_VERSION bump                 | `--bump <minor\|major> --proposal <id> [--write]`   |

## Lib 共用模組

| Lib                        | 路徑                           | 使用 generator                                                                                                                              |
| -------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `auto-generated-block.mjs` | `lib/auto-generated-block.mjs` | gen-rules-version-index / gen-proposal-index / gen-adr-index（**3 個**；不含 changelog/framework-version 因其用 inline regex 替換特定欄位） |
| `frontmatter.mjs`          | `lib/frontmatter.mjs`          | gen-rules-version-index / gen-proposal-summary（**2 個**；2026-04-30 抽出；其他 generator 因僅取單一欄位不需用）                            |

## 一鍵執行

```bash
python3 .agents/tests/run-all.py --regenerate-indexes
```

執行內容（自動跑 2/4；其餘需 `--proposal` 參數）：

1. `gen-rules-version-index.mjs --write` — 自動更新版本表
2. `gen-proposal-index.mjs --write` — 自動更新提案索引
3. `gen-changelog.mjs` / `gen-framework-version.mjs` — 印提示（需 `--proposal` 參數，由 @Lead 手動執行）
4. `gen-adr-index.mjs --write` — 可手動補入 run-all 的 regen 流程（非 framework version-bump 場景無需頻繁重生）

## 仍需手動處理（內容判斷無法自動化）

| 索引                | 手動部分                                                         |
| ------------------- | ---------------------------------------------------------------- |
| RULES_VERSION_INDEX | 「執行摘要章節」（PROPOSAL_XXX 摘要 + 核心成就 + 預期效益）      |
| CHANGELOG           | 「Notes」段落（設計原則 / 對偶說明 / 警告）                      |
| PROPOSAL_INDEX      | 「§🔗 提案意圖繼承關係表」（從提案 §七.2 撈但語意需 @Lead 確認） |
| PROPOSAL_INDEX      | 「DONE 列表 append」（編號 + 標題 + 優先級 + 完成日期 + 執行者） |

詳見 `RULES_DESIGN_GUIDE §十二 Phase E 自動化`。

## 退出碼契約（所有 generator 一致）

| 模式                    | 退出碼 | 語意                                                  |
| ----------------------- | ------ | ----------------------------------------------------- |
| `--check`（驗證 drift） | `0`    | 無 drift；可 commit                                   |
|                         | `1`    | 有 drift；commit blocked；提示跑 `--write`            |
|                         | `2`    | 錯誤（檔案缺失 / parse 失敗 / 取得 frontmatter 失敗） |
| `--write`（重生）       | `0`    | 寫檔成功                                              |
|                         | `2`    | 錯誤（同上）                                          |
| 預設（dry-run）         | `0`    | 印 preview                                            |
|                         | `2`    | 錯誤                                                  |

**對齊**：`tests/run-all.sh` 的 `index_drift` validator 將 generator `--check` 退出碼直接映射至 validator 結果（exit 1 = 🟡 warn；exit 2 = 🔴 error）。

## 限制與已知問題

| 限制                                                                            | 說明                                                  | 處理                                                                 |
| ------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| `RULES_METADATA_SCHEMA.md` 無 frontmatter                                       | 顯示 `<unknown>`                                      | 後續可獨立提案補 frontmatter                                         |
| Frontmatter parser 為簡化實作                                                   | 不支援 nested YAML / multi-line value                 | 保守設計；如需擴充改用 `node:fs` + 完整 YAML library（需放棄零依賴） |
| `parseYaml` 在 `init-workspace.mjs` vs `tech-stack-manage.mjs` 分歧（**故意**） | init 版不支援 list-of-objects；tech-stack-manage 自實 | 命名空間分離；不強制統一以避免破壞既有測試                           |
| gen-changelog / gen-framework-version 不用 auto-generated-block                 | 兩者用 inline regex 替換特定欄位（非 block-based）    | 設計差異；不適合接入本 lib                                           |

## 維護

- 新增追蹤檔案 → 更新 `gen-rules-version-index.mjs` 的 `TRACKED_FILES` 陣列
- Schema 結構變更 → 同步調整 generators 對應的 parsing 邏輯（優先用 `lib/frontmatter.mjs`）
- 新 generator → 加入本 README 工具清單 + 對應退出碼契約
- 變更須透過 `RULE_UPDATE_PROPOSAL`
