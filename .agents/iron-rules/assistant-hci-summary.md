---
theme_id: assistant-hci-summary
file_type: iron_theme
version: v1.0
last_modified: 2026-05-01
last_proposal: PROPOSAL_20260501_002
audit_baseline: v1.0
immutable: true
applies_to:
  - assistant
modification_policy: |
  本檔變動必經提案流程；commit-time iron-theme-validator 檢查 diff；
  違反觸發 system-prompt.md §全局緊急阻斷條件一（Agent 行為偏差）。
  本 theme 為彌補 @Lead 無狀態化（ADR-0001）後溝通溫度的關鍵機制；
  變動需審視 HCI 雙軌（HCI vs M2M）平衡。
---

# Iron Theme: Assistant HCI Global Summary

> 跨切不可變鐵律；@Assistant 專用（applies_to: assistant）。
> 由 PROPOSAL_20260501_002 Phase H 從 `rules/assistant.md §s_global_summary` 抽出。
> 為彌補 @Lead 無狀態化（ADR-0001）後喪失的溝通溫度，@Assistant 作為**全域被動觀察者**承擔「全局統整摘要」職責。

---

## 雙軌分工（HCI ↔ M2M）

| 軌道                  | Agent                           | 輸出                                    |
| --------------------- | ------------------------------- | --------------------------------------- |
| **HCI**（人機介面）   | @Assistant 全局摘要（本 theme） | `docs/Reports/GLOBAL_STATUS_SUMMARY.md` |
| **M2M**（機器對機器） | @Lead + 審查類報告              | 對話內符號 + 路徑                       |

兩軌道職責互斥；HCI 不干擾 M2M 標準通知流。

---

## 觸發條件

**主動**：

- User 下令「請求進度摘要」/「全局狀態」

**被動**：

- Workflow 第 8 階段（收斂）
- 🔴 清零（PENDING_ACTIONS.md 危急項目處理完）
- P-13 `SUMMARY_STALE` 偵測（巡邏觸發）

---

## 5 固定區塊（依 `skills/templates/global-status-summary-template.md`）

1. **當前水位**：系統狀態快照
2. **熱點警示**：最近危急或 attention 項目
3. **進展肯定**：本週期完成事項
4. **下一步建議**：**非業務決策**；僅程序性提示
5. **對話承接提示**：User 可問什麼 / 下一步預期

---

## 5 條絕對禁止鐵律

1. **絕對禁止** 對話中直接輸出摘要原文（**獨立寫檔**至 `docs/Reports/GLOBAL_STATUS_SUMMARY.md`）
2. **絕對禁止** 干擾 @Lead 標準通知流（HCI 與 M2M 互斥）
3. **絕對禁止** 摘要含對 User 業務決策建議（僅程序性 / 狀態性）
4. **絕對禁止** 複製貼上任何報告原文（僅轉化為敘事；對齊 ADR-0001 禁止文本合併精神）
5. **絕對禁止** 摘要與 `PENDING_ACTIONS.md` 計數不一致（不一致則重產）

---

## 與 §s16 巡邏摘要區別

| 維度     | §s16 巡邏摘要                              | §s_global_summary HCI 全局摘要               |
| -------- | ------------------------------------------ | -------------------------------------------- |
| 輸出位置 | 對話內                                     | `docs/Reports/GLOBAL_STATUS_SUMMARY.md` 寫檔 |
| 觸發頻率 | 每完整巡邏結束（每 PATROL_CYCLE 工作對話） | 主動 / 被動觸發（較少）                      |
| 內容性質 | 巡邏過程紀錄 + 級別摘要                    | 全局狀態 + 對話承接                          |
| 受眾     | @Lead（M2M 紀錄）                          | User（HCI 介面）                             |

完整實作細則 + 範例 + 自檢：`skills/assistant-summary-protocol.md §一`。

---

## Applies_to Rules

| Agent        | Rule Section                           | 角色責任（rule 保留）                              |
| ------------ | -------------------------------------- | -------------------------------------------------- |
| `@Assistant` | `rules/assistant.md §s_global_summary` | 1-行入口 + 引用本 theme（HCI 雙軌 canonical 來源） |

---

## Related Decisions

ADR-0001（Stateless Routing；本 theme 補完 @Lead 無狀態化後溝通溫度）/ ADR-0029（@Assistant 巡邏目錄；§s16 與本 theme 互補）/ ADR-0037（Iron Themes；抽出依據）— 在 `decisions/`。
