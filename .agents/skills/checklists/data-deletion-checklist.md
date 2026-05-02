---
skill_id: data-deletion-checklist
file_type: skill
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_004
purpose: |
  資料刪除操作五步驟強制流程；對齊 strategyweight-change-checklist 的 zero-tolerance
  對稱性原則。違反 → 觸發 system-prompt §全局緊急阻斷條件三。
referenced_by:
  - rules/lead.md §s11
  - rules/backend.md §s06 §s07
  - rules/security.md §s02 (SC-04)
  - rules/system-prompt.md §全局緊急阻斷條件三
  - rules/consultant.md §s07
related_decision: decisions/0011-security-conditional-intervention.md
---

# Skill: 資料刪除操作強制 Checklist（零容忍 · 無豁免）

## 為何零容忍

資料刪除為**不可逆操作**；錯誤刪除可能導致：

- 業務資料永久遺失（無備援回滾）
- 審計追溯斷鏈（合規風險）
- 連鎖反應：其他 module 依賴的資料消失 → 系統雪崩

歷史踩坑：見 `memory/debug_graveyard/` 任何 `category: data_loss`條目。

## 適用範圍

任何涉及**移除既有資料**的操作（不限於 SQL DELETE）：

- File-based：`fs.unlink` / `fs.rm` / `fs.rmdir` / 覆寫舊檔（`writeFile` 替換現有檔的非 append 寫法）
- 資料庫：`DELETE FROM` / `DROP TABLE` / `TRUNCATE`
- Google Sheets：`clearValues` / `batchClear` / 刪除 rows
- 外部 API：`DELETE` method / `removeAll` 端點
- **歷史資料修改**：對 30 天前的任何記錄做寫入操作（視為「以新覆舊」的隱性刪除）

## 五步驟強制流程（對齊 strategyweight-change-checklist）

### Step 1：@Backend 識別 + 阻斷

`@Backend` 收到含刪除意圖的指令時**立即阻斷**：

- 不執行刪除
- 產出 `DELETION_REQUEST_<功能名稱>.md` 含：
  - 刪除目標（具體檔案路徑 / 表名 / row 識別 ID）
  - 預估刪除筆數
  - 影響範圍（哪些 module 依賴此資料）
  - 替代方案（如：軟刪除標記 `deleted: true` / 移至 archive 而非真刪）
- 通知 `@Lead`

**絕對禁止**：自行決定執行刪除（即使 User 直接下令也須走完本流程）。

### Step 2：@Lead 評估 + 升級 User

`@Lead` 不可單獨授權（依 `lead.md §s11` 五條件）。必：

1. 讀 `DELETION_REQUEST_*.md`
2. 評估替代方案是否可行（軟刪除 / 歸檔）
3. 升級 User，明列：
   - 刪除目標 + 數量
   - 替代方案利弊
   - 預估影響（含「不可逆」警示）

### Step 3：User 字面授權（唯一有效方式）

User **必須**回應字面關鍵字：

- `授權刪除：<具體目標>`（明確指明範圍）
- 或 `授權執行 DELETION_REQUEST_<功能名稱>`

**不視為有效授權**（即使語意接近）：

- 「可以」「好」「執行吧」
- 「OK」「Yes」「Go ahead」
- 「依專業判斷」「你決定」

理由：刪除為不可逆；含糊回應一律保守解讀為「未授權」。

### Step 4：備份 / 回滾機制就緒

User 授權後 `@Backend` 執行前**必先**：

- [ ] 備份目標資料至 `data/.archive/<YYYYMMDD>/<原路徑>`（保留 ≥ 30 天）
- [ ] 確認備份可讀（`stat` + 樣本內容驗證）
- [ ] 撰寫回滾腳本（一鍵還原）
- [ ] 在 `DELETION_REQUEST_*.md` 標注備份路徑 + 回滾指令

備份失敗 → 不執行刪除；回報 `@Lead`。

### Step 5：執行 + 審計日誌

執行刪除：

1. 寫入 `data/audit/deletion_log.jsonl` 一行：
   ```json
   {"date":"YYYY-MM-DD","actor":"@Backend","authorizer":"<User>",
    "target":"<具體目標>","count":<n>,"backup_path":"<path>",
    "rollback_cmd":"<command>","exemption_log":"EX-YYYYMMDD-NNN"}
   ```
2. 執行刪除操作
3. 驗證刪除成功（目標已不存在）
4. 通知 `@Lead`：`【@Backend 刪除完成】<目標> × <n>；備份：<path>`

`@Lead` 收到後：

- 寫入 `PENDING_ACTIONS.md §豁免記錄`（`EXEMPTION_LOG` 編號）
- 依 `lead.md §s11` 同步 `AUDIT_HISTORY.md`

## SC-04 平行審查觸發

依 `security.md §s02 SC-04`，本流程**必觸發** `@Security` 平行審查：

- @Security 檢查 Step 4 備份完整性
- @Security 檢查 Step 5 審計日誌格式
- 衝突依 `parallel-review-arbitration.md`（安全性優先）

## 絕對禁止（保留於 rules）

- **絕對禁止** 跳過 Step 1 識別阻斷（即使 User 直接下令）
- **絕對禁止** `@Lead` 單獨授權（五條件之一；依 `lead.md §s11`）
- **絕對禁止** 以「可以」「好」等含糊回應為授權依據（必字面「授權刪除」）
- **絕對禁止** 跳過 Step 4 備份（不可逆；無備份等於資料遺失）
- **絕對禁止** 缺 `data/audit/deletion_log.jsonl` 條目即執行（審計追溯斷鏈）
- **絕對禁止** 30 天前歷史紀錄修改未走本流程（隱性刪除同等對待）

## 與其他鐵律的對齊

| 文件                             | 條款               | 對齊點                                 |
| -------------------------------- | ------------------ | -------------------------------------- |
| `system-prompt.md §全局緊急阻斷` | 條件三             | 違反本流程 → 立即觸發全局阻斷          |
| `lead.md §s11`                   | 豁免授權邊界五條件 | 「資料刪除」明列；@Lead 不可單獨授權   |
| `backend.md §s06`                | 量化門檻 #5        | 「任何刪除操作（零容忍、無豁免空間）」 |
| `backend.md §s07`                | 零容忍禁止條款     | 「資料刪除任何理由不接受豁免」         |
| `consultant.md §s07`             | 唯讀原則           | @Consultant 不可在 ADVICE 示範刪除     |
| `security.md §s02`               | SC-04              | 平行審查強制觸發                       |

## 範例：完整流程

**情境**：User「請刪掉 30 天前的 `data/strategy_history/*.csv`」

**錯誤路徑（違反鐵律）**：

```
@Backend：好，我幫你 unlink 這 47 個檔案 → ❌ 跳 Step 1 阻斷
```

**正確路徑（本 Checklist）**：

```
@Backend → 阻斷 + 產 DELETION_REQUEST_strategy_history_cleanup.md
@Lead → 評估替代（移至 archive/strategy_history/）→ 升級 User
User → 「授權刪除：data/strategy_history/ 30 天前 CSV 共 47 檔」
@Backend → 備份至 data/.archive/20260501/strategy_history/ → 驗證可讀
       → 寫 deletion_log.jsonl → 執行 unlink → 驗證刪除
       → 回報 @Lead
@Lead → 寫 PENDING_ACTIONS §豁免記錄 + AUDIT_HISTORY
@Security → SC-04 平行審查通過
```

<!-- END: data-deletion-checklist -->
