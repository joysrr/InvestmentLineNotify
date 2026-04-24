# Skill: Git & PR Workflow (版本控制規範)

## 1. 分支命名規則 (Branch Naming)
所有開發任務必須在獨立分支進行，嚴禁直接 commit 到 `main` 或 `master`。
- 新功能：`feat/<功能簡述>` (例如: `feat/add-rsi-indicator`)
- Bug 修復：`fix/<問題簡述>` (例如: `fix/telegram-webhook-timeout`)
- 緊急修復：`hotfix/<問題簡述>` (例如: `hotfix/crash-on-zero-division`)
- 架構與文件：`docs/<文件簡述>` 或 `chore/<雜項>`

## 2. Commit Message 規範 (Conventional Commits)
必須採用標準化格式：`<type>(<scope>): <subject>`
- `type`：feat, fix, docs, style, refactor, test, chore
- `scope`：影響的模組 (如 `api`, `strategy`, `webapp`, `bot`)
- 範例：`fix(strategy): 修正 marginManager 在空陣列時的除以零錯誤`
- **注意**：Commit message 必須精簡且具備說明性。

## 3. Pull Request (PR) 開立標準
當 `@Frontend` 或 `@Backend` 完成開發準備交由 `@Reviewer` 與 `@QA` 檢查時，必須確認：
- 已完成本地端的基礎 Linter 檢查。
- 不可包含 `.env` 或任何敏感金鑰變更。
- 必須在 PR 描述中條列：1. 解決了什麼問題 2. 影響了哪些核心檔案。

---

## Related Decisions

- [ADR-0021](../decisions/0021-proposal-lifecycle.md) — 提案生命週期
