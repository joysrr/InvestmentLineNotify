---
skill_id: security-examples
file_type: examples
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_004
purpose: |
  @Security 3 組標準 I/O 範例（SC-01 Token / SC-03 strategyWeight / SC-06 TOCTOU）
referenced_by:
  - rules/security.md
  - rules/reviewer.md
  - skills/examples/reviewer-security-boundary-examples.md
  - skills/examples/reviewer-examples.md
  - docs/Reports/AUDIT_HISTORY.md
  - docs/agents-overview.md
---

# Skill: @Security Few-Shot 範例（3 組）

## 範例 1：SC-01 Token 時效驗證

**違規程式碼**：

```javascript
// initData 僅驗證簽章，忽略 auth_date
function verifyInitData(initData) {
  const hash = computeHMAC(initData);
  return hash === expectedHash;
}
```

**@Security 判定**：

```
【@Security 資安審查報告】🔴 SC-01 BLOCKER：Token 時效驗證缺失

## 審查結論
> 🔴 退件

## 觸發範疇
依 `.agents/skills/security-audit.md §1`：SC-01

## 問題清單
### 🔴 [BLOCKER] 資安阻斷項目
| # | 檔案 | 行號 | 風險類型 | SC 代碼 | 建議修正方式 |
|---|------|------|---------|--------|------------|
| 1 | auth.mjs | 5 | Token 時效未檢查 | SC-01 | 加入 auth_date 解析 + 24h 上限檢查 |
```

## 範例 2：SC-03 strategyWeight 異動（流程違規）

**情境**：PR 含 `src/strategy/weights.mjs` 修改，但無 ADVICE 紀錄

**@Security 判定**：

```
【@Security 資安審查報告】🔴 SC-03 BLOCKER：strategyWeight 異動流程違規

## 問題清單
| 1 | weights.mjs | - | 異動未經 @Consultant → @Lead → User 流程 | SC-03 |

**修正指引**：
參照 `.agents/skills/checklists/strategyweight-change-checklist.md` 五步驟重新執行：
Step 1 @Consultant ADVICE → Step 2 @Lead 審核 → Step 3 User「授權執行」
→ Step 4 @Backend 執行 → Step 5 @Assistant 巡邏
```

## 範例 3：SC-06 TOCTOU 防護

**違規程式碼**：

```javascript
if (!fs.existsSync(lockFile)) {
  fs.writeFileSync(lockFile, "locked"); // TOCTOU 分段寫法
  // ... 業務邏輯
}
```

**@Security 判定**：

```
【@Security 資安審查報告】🔴 SC-06 BLOCKER：TOCTOU 風險

## 問題清單
| 1 | scheduler.mjs | 12 | existsSync + write 分段寫法 | SC-06 |

**修正**：依 `.agents/skills/concurrency-guard-pattern.md` §2.1 使用 `fs.openSync(path, 'wx')` 原子模式
```

---

## Related Decisions

- [ADR-0011](../decisions/0011-security-conditional-intervention.md) — @Security 條件式介入（SC-01~10）
