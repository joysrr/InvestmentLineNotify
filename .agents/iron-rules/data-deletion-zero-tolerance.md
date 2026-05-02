---
theme_id: data-deletion-zero-tolerance
file_type: iron_theme
version: v1.0
last_modified: 2026-05-01
last_proposal: PROPOSAL_20260501_002
audit_baseline: v1.0
immutable: true
applies_to:
  - backend
  - consultant
  - project_lead
  - security
  - system_prompt
modification_policy: |
  本檔變動必經提案流程；commit-time iron-theme-validator 檢查 diff；
  違反觸發 system-prompt.md §全局緊急阻斷條件三（rules 直修）。
  applies_to 列出的所有 rules 必同步審查。
  本 theme 涉跨 Agent 安全邊界（資料刪除 + strategyWeight + 金鑰 + .agents 直修），
  變動須 User 明確授權，不可由 @Lead 單獨核准。
---

# Iron Theme: Data Deletion + StrategyWeight Zero-Tolerance

> 跨切不可變鐵律；涉跨 Agent 安全邊界。
> 由 PROPOSAL_20260501_002 + ADR-0037 從 backend/consultant/lead/security/system-prompt 共用「零容忍」抽出。
> 涵蓋 4 條零容忍原則 + 1 條官方審核流程 + 違反處理鏈。

---

## 4 條零容忍原則（不可改詞；無豁免空間）

### 1. 資料刪除（Data Deletion）

**任何**刪除操作（含 `data/` `*.csv` / `*.jsonl` / Google Sheets rows / 30 天前歷史紀錄）**未經 User 字面授權**前**絕對禁止**執行。

- 無論任何理由均**不接受**豁免
- 必升級 User **字面授權**（標準詞彙；對齊 system-prompt §條件 3）；不可由 @Lead 單獨核准
- 違反 → 立即觸發 `system-prompt.md §全局緊急阻斷` 條件三

> **授權詞彙統一規範**：本檔「字面授權」= User 對 System 級操作的明確許可（5 級允許詞：「授權執行」/「授權刪除」/「授權變更 strategyWeight」/「授權寫入金鑰」/「授權修改 .agents/」）；@Lead 對 sub-Agent 的內部授權用「授權執行」（consultant.md §s07 規定）— 兩者層級不同，詞彙對應有別。

### 2. strategyWeight 異動（Value Modification）

**任何**數值變更（無論大小）**絕對禁止**繞過官方流程：

```
@Consultant 提出建議 → @Lead 審核 → @Backend 執行
```

- 無豁免空間（無例外）
- 違反 → 立即觸發 `system-prompt.md §全局緊急阻斷` 條件三

### 3. 金鑰 / API Key / Token

**絕對禁止**在程式碼 / commit / log / docs 任何位置寫入金鑰、API Key、Token、Secret。違反 → @Security SC-02 + 全局緊急阻斷條件三。

### 4. `.agents/` 原始 Rules 直修

**絕對禁止**未經 `PROPOSAL_ADOPT` 流程直接修改 `.agents/rules/*.md` / `.agents/RULES_DESIGN_GUIDE*.md` / `.agents/iron-rules/*.md`（採納提案 / Hotfix / 框架自動產出三情境除外）。違反 → 觸發 `lead.md §s10` 雙層防護 + 全局緊急阻斷條件三。

---

## 官方審核流程（strategyWeight）

| 步驟 | Agent       | 動作                                          | 產出                  |
| ---- | ----------- | --------------------------------------------- | --------------------- |
| 1    | @Consultant | 在 `ADVICE_*.md` 提出建議（含風險評估）       | ADVICE 文件           |
| 2    | @Lead       | 審核 + 啟動 HITL（升級 User）                 | Gate Check 通過       |
| 3    | @Backend    | 執行（依 §s06 量化門檻 + EXEMPTION_LOG 編號） | commit + 部署指令清單 |

完整 5 步驟流程：`skills/checklists/strategyweight-change-checklist.md`。

---

## 違反處理鏈

1. **Validator 偵測**：commit-time validator 識別違反
2. **全局緊急阻斷**：觸發 `system-prompt.md §條件三`；暫停所有 Workflow
3. **EXEMPTION_LOG**：必寫入豁免記錄（即使緊急豁免）
4. **User 確認**：等 User 明確發出恢復指令（「系統恢復」/「繼續執行」）
5. **@Retro 跟進**：違反案例必入週期審計 + 提案改善

---

## Applies_to Rules（雙向一致；iron-theme-validator 強制）

| Agent         | Rule Section                           | 角色責任（rule 保留）                                                     |
| ------------- | -------------------------------------- | ------------------------------------------------------------------------- |
| `@Backend`    | `rules/backend.md §s06`                | HITL 量化門檻（資料異動 5 entries + 效能 3 entries）+ 引用本 theme 4 原則 |
| `@Consultant` | `rules/consultant.md §s07`             | 唯讀原則 + 寫入授權鐵律 + 引用本 theme strategyWeight 流程                |
| `@Lead`       | `rules/lead.md §s11`                   | 兩鐵律（EXEMPTION_LOG 記錄 + 五條件升級 User）+ 引用本 theme              |
| `@Security`   | `rules/security.md §s02`               | SC-XX 邊界 + SC-04 資料刪除 / SC-03 strategyWeight 連結本 theme           |
| System Prompt | `rules/system-prompt.md §全局緊急阻斷` | 條件三（含本 theme 4 原則作觸發條件）                                     |

---

## Related Decisions

ADR-0001（Stateless Routing；豁免授權與 EXEMPTION_LOG）/ ADR-0011（@Security 條件式介入；SC-03 strategyWeight + SC-04 資料刪除）/ ADR-0037（Iron Themes；本 theme 抽出依據）— 在 `decisions/`。
