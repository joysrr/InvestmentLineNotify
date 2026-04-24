# Skill: @Reviewer Few-Shot 範例（3 組）


## 範例 1：BLOCKER / WARNING / SUGGEST 判斷

**程式碼片段**：
```javascript
const data = fs.readFileSync('/data/users.json'); // 問題 A
const result = data.users.filter(u => u.active); // 問題 B
console.log('debug:', result); // 問題 C
```

**@Reviewer 應產出**：
```markdown
🔴 REVIEW_REPORT

## 問題 A：硬編碼絕對路徑
- **等級**：🔴 [BLOCKER]（違反 `backend.md §s02` 技術棧執行標準）
- **修正**：使用相對路徑 `path.join('data', 'users.json')`

## 問題 B：無 try/catch 保護
- **等級**：🔴 [BLOCKER]（違反「靜默失敗防護」）
- **修正**：包覆 `try { ... } catch (err) { ... }`

## 問題 C：console.log 遺留
- **等級**：🟢 [SUGGEST]
- **修正**：改用統一 logger（或於發版前清除）
```

## 範例 2：退件流程

**情境**：`@Backend` 提交 PR，含 2 個 BLOCKER + 1 WARNING

**@Reviewer 操作**：
```markdown
🔴 REVIEW_REPORT: <功能名稱>

## 審查結論：**退件**
- 🔴 BLOCKER：2 項（詳見下）
- 🟡 WARNING：1 項
- 複審計數：1 / 2（REVIEW_CYCLE_LIMIT）

退件清單（@Backend 必修）：
1. strategyWeight 異動未經 @Lead → @Security 流程
2. File 寫入未使用原子鎖（對齊 concurrency-guard-pattern.md）
```

下一步：`@Lead` 收到 → 傳路徑給 `@Backend` 修復（不複製原文）。

## 範例 3：越界識別（PROPOSAL-020）

**情境**：`@Reviewer` 收到的 PR 含 `strategyWeight` 異動

**@Reviewer 正確行為**：
```markdown
🟡 REVIEW_REPORT

本 PR 涉及 `strategyWeight` 異動，屬 `@Security` 專屬範疇（SC-03）。
依 PROPOSAL-020 §審查職責邊界，`@Reviewer` 不審查該路徑。

其他部分審查結果：✅ 通過（程式碼品質 / 效能 / 可讀性）

請 @Lead 確保 @Security 平行審查此 PR 的 SC-03 部分。
```

---

## Related Decisions

- [ADR-0010](../decisions/0010-parallel-review.md) — 平行審查制度
- [ADR-0013](../decisions/0013-dod-self-audit.md) — DoD 自評 + Gate Check
