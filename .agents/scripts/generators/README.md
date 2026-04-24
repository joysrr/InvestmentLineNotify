# `.agents/scripts/generators/` — 索引自動產生器

> 由 PROPOSAL_20260423_007 建立。降低提案執行 Phase E 的手動同步成本。
> 對齐 `RULES_DESIGN_GUIDE §十二 Phase E 自動化`。

## 設計原則

- **SSOT（Single Source of Truth）**：rules / proposals frontmatter 為真相；INDEX 為派生視圖
- **Dry-run 預設**：所有 generator 預設僅 console.log；加 `--write` 才實際寫檔
- **零依賴**：純 Node.js 內建模組（沿用 `framework-diff.mjs` 風格）
- **不取代 LLM 判斷**：執行摘要 / 意圖繼承 / Notes 等內容判斷仍由 `@Lead` 處理

## 工具清單

| Generator | 用途 | CLI |
|----------|-----|-----|
| `gen-rules-version-index.mjs` | RULES_VERSION_INDEX 版本表 | `[--write]` |
| `gen-changelog.mjs` | CHANGELOG `[vX.Y]` 條目模板 | `--proposal <path> [--write] [--bump minor\|major]` |
| `gen-proposal-index.mjs` | PROPOSAL_INDEX 統計 + OPEN/IN_PROGRESS | `[--write]`（write 模式於 Phase G 後啟用）|
| `gen-framework-version.mjs` | FRAMEWORK_VERSION bump | `--bump <minor\|major> --proposal <id> [--write]` |

## 一鍵執行

```bash
bash .agents/tests/run-all.sh --regenerate-indexes
```

執行內容：
1. `gen-rules-version-index.mjs --write` — 自動更新版本表
2. `gen-proposal-index.mjs`（dry-run；markdown 替換待 Phase G 後啟用 --write）
3. CHANGELOG / FRAMEWORK_VERSION 印提示（仍需 @Lead 配合提案路徑手動執行）

## 仍需手動處理（內容判斷無法自動化）

| 索引 | 手動部分 |
|-----|---------|
| RULES_VERSION_INDEX | 「執行摘要章節」（PROPOSAL_XXX 摘要 + 核心成就 + 預期效益）|
| CHANGELOG | 「Notes」段落（設計原則 / 對偶說明 / 警告）|
| PROPOSAL_INDEX | 「§🔗 提案意圖繼承關係表」（從提案 §七.2 撈但語意需 @Lead 確認）|
| PROPOSAL_INDEX | 「DONE 列表 append」（編號 + 標題 + 優先級 + 完成日期 + 執行者）|

詳見 `RULES_DESIGN_GUIDE §十二 Phase E 自動化`。

## 退出碼

- `0` — 成功
- `2` — 錯誤（檔案缺失 / parse 失敗 / 替換失敗）

## 限制與已知問題

| 限制 | 說明 | 處理 |
|-----|-----|-----|
| `RULES_METADATA_SCHEMA.md` 無 frontmatter | 顯示 `<unknown>` | 後續可獨立提案補 frontmatter |
| `gen-proposal-index --write` 未實作 markdown 替換 | 當前僅 dry-run | Phase G 後啟用（需設計 AUTO-GENERATED 標記區塊）|
| Frontmatter parser 為簡化實作 | 不支援 nested YAML / multi-line value | 保守設計；未來如需擴充改用 `node:fs` + 完整 YAML library（需放棄零依賴）|

## 維護

- 新增追蹤檔案 → 更新 `gen-rules-version-index.mjs` 的 `TRACKED_FILES` 陣列
- Schema 結構變更 → 同步調整 generators 對應的 parsing 邏輯
- 變更須透過 `RULE_UPDATE_PROPOSAL`
