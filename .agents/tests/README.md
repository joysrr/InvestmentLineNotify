# .agents/tests/ — Agent 行為自動化驗收框架

> 由 PROPOSAL_20260422_009 建立。提供 4 個 Node.js ESM 驗證腳本，實現 Schema / 行為 / 格式 / 意圖一致性的自動化檢測。

## 檔案清單

| 腳本 | 用途 | 驗證對象 |
|------|------|---------|
| `schema-validator.mjs` | 驗證 rules frontmatter + XML section 合規性 | `.agents/rules/*.md` |
| `lead-stateless-audit.mjs` | 驗證 @Lead 無狀態路由三鐵律 | `PENDING_ACTIONS.md` + 最近對話歷史 |
| `artifact-format-validator.mjs` | 驗證 REVIEW/SECURITY/TEST_REPORT M2M 合約 | 各 `.md` 產出物 |
| `proposal-intent-consistency.mjs` | 驗證 `§🔗 提案意圖繼承關係` 表完整性 | `PROPOSAL_INDEX.md` + `proposals/completed/` |

## 執行方式（依 PROPOSAL_20260423_008 升級為 3 模式）

```bash
# Full 模式（預設；7 並行 + scripts 序列；< 30 sec）
bash .agents/tests/run-all.sh

# Fast 模式（依 git diff 跳過無關 validators；通常 < 5 sec）
bash .agents/tests/run-all.sh --fast

# 單一 validator
bash .agents/tests/run-all.sh --validator <name>

# 顯示說明
bash .agents/tests/run-all.sh --help
```

### Validator 列表（9）

| # | Name | 用途 | 平均時長 |
|---|-----|-----|---------|
| 1 | schema | rules schema validation | < 1 sec |
| 2 | intent | proposal intent consistency | < 1 sec |
| 3 | workspace | workspace schema + skills/tasks F2 | < 1 sec |
| 4 | drift | agent drift simulator (Mode A) | < 1 sec |
| 5 | ref | !ref validator + cycle | < 1 sec |
| 6 | sync | agents-overview sync | < 1 sec |
| 7 | loc | docs location | < 1 sec |
| 8 | scripts | scripts/ tests (L1 + L3) | ~15 sec |

### 模式選擇建議

| 情境 | 推薦模式 |
|-----|---------|
| 提案執行 Phase E 收尾 | `full`（兜底覆蓋；禁用 fast）|
| Pre-commit hook | `--fast`（速度優先；保守跳過）|
| 開發特定 validator | `--validator <name>`（極速反覆測試）|
| CI / 完整稽核 | `full` |

詳見 `RULES_DESIGN_GUIDE §十二 Validator 執行模式`。

## 退出碼

- `0` — 通過
- `1` — 有警告（WARNING，可繼續）
- `2` — 有錯誤（ERROR，必須修正）

## 觸發時機

- **手動**：開發者執行 `node .agents/tests/<script>.mjs`
- **提案採納後**：`@Lead` 執行 Gate Check 前呼叫（依 `RULES_DESIGN_GUIDE §十一`）
- **pre-commit hook**：配置於 `.claude/settings.json`（選用）

## 與既有提案的關係

- 支撐 PROPOSAL_20260422_008（`@Auditor` 可呼叫本目錄腳本作為評審工具）
- 完成 PROPOSAL-021 §六 未來工具路徑的前 4 項實作
- 補齊 PROPOSAL_20260422_007 P-14 的機械化偵測（由 `proposal-intent-consistency.mjs` 實現）
