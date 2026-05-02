# Skill: Assistant User Commands（P-01 ~ P-25 User 解除指令完整對照）

> `@Lead` 在阻斷通知中**必須**於「處理指令」欄位提示 User 使用本表對應格式；不可只說「請處理」而不附具體指令。

---

## 完整指令對照表（P-01 ~ P-25）

| 介入代碼 | 通知類型                        | User 標準指令格式                                                                                                                  | 來源提案              |
| -------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| P-01     | `REVIEW_QUALITY`                | `重新評估實作方案 <功能名稱>`                                                                                                      | 基礎                  |
| P-02     | `QA_QUALITY`                    | `重新評估需求範圍 <功能名稱>`                                                                                                      | 基礎                  |
| P-03     | `RETRO_TIMEOUT`                 | `繼續執行提案 PROPOSAL_YYYYMMDD_NNN` 或 `拒絕提案 PROPOSAL_YYYYMMDD_NNN，原因：<說明>`                                             | 基礎                  |
| P-04     | `RETRO_REPEAT`                  | `採納提案 PROPOSAL_YYYYMMDD_NNN`                                                                                                   | 基礎                  |
| P-05     | `RETRO_PROPOSAL`                | `採納提案 PROPOSAL_YYYYMMDD_NNN` 或 `拒絕提案 PROPOSAL_YYYYMMDD_NNN，原因：<說明>`                                                 | 基礎                  |
| P-06     | `CONSULTANT_CONFLICT`           | 直接在 `ADVICE_*.md` 對應欄位填寫 `strategyWeight: { <領域A>: 0.X, <領域B>: 0.X }`，填寫完成後回覆 `已填寫 strategyWeight，請繼續` | 基礎                  |
| P-07     | `CONSULTANT_RISK`               | `確認接受風險 <ADVICE_*.md 檔名>` 或 `退回修改需求 <功能名稱>`                                                                     | 基礎                  |
| P-08     | `FRONTEND_API_BLOCK`            | `確認 API 規格修改 <模組名稱>`                                                                                                     | 基礎                  |
| P-09     | `HOTFIX_DOC_PENDING`            | （無需指令；@Lead 下次正常任務結束時提醒 @Architect 補文件）                                                                       | 基礎                  |
| P-10     | `EXEMPTION_ACCUMULATED`         | `@Retro 執行豁免審計` 或（由下次定期 Retro 自動處理）                                                                              | 基礎                  |
| P-11     | `SECURITY_AUDIT_FAIL`           | `重新評估實作方案 <功能名稱>`（共用 P-01 指令）                                                                                    | PROPOSAL_20260421_020 |
| P-12     | `WORKSPACE_MISSING`             | `執行 project-onboarding` 或 `切換 workspace <project_name>`                                                                       | PROPOSAL_20260422_002 |
| P-13     | `SUMMARY_STALE`                 | （無需指令；`@Assistant` 下次巡邏自動產出新摘要）                                                                                  | PROPOSAL_20260422_004 |
| P-14     | `PROPOSAL_INTENT_REGRESSION`    | `補建意圖繼承 PROPOSAL_YYYYMMDD_NNN → PROPOSAL_YYYYMMDD_MMM` 或 `確認為反覆問題 PROPOSAL_YYYYMMDD_NNN`                             | PROPOSAL_20260422_007 |
| P-15     | `AUDIT_QUALITY`                 | （自動觸發 `@Retro`，無需 User 指令；若需跨 Sprint 處理則由 @Lead 升級 User）                                                      | PROPOSAL_20260422_008 |
| P-16     | `WORKSPACE_REQUIRED_MISSING`    | `補填 workspace 欄位 <field_path>` 或 `執行 project-onboarding`                                                                    | PROPOSAL_20260422_022 |
| P-17     | `WORKSPACE_RECOMMENDED_MISSING` | （無需指令，為 🟡 警告；User 可選擇補填欄位解除）                                                                                  | PROPOSAL_20260422_022 |
| P-18     | `PROPOSAL_SCOPE_MISCLASSIFIED`  | `移動提案 <proposal_id> → <target_path>` 或 `補填 scope 欄位 <proposal_id>`                                                        | PROPOSAL_20260422_023 |
| P-19     | `MODEL_ROUTING_VIOLATION`       | `重新派發 <task_id> 並指定模型層級` 或 `確認跳過模型路由 <reason>`                                                                 | PROPOSAL_20260422_024 |
| P-20     | `LANE_ESCALATION`               | `調整 20 指標 <具體項目>` / `確認保留現行分級 <分析摘要>` / `升級 <lane> <任務描述>`                                               | PROPOSAL_20260422_032 |
| P-21     | `HOTFIX_LIGHT_MISUSE`           | `重新評估 hotfix_tier <事故描述>` 或 `補建 SC 評估記錄 <事故 ID>`                                                                  | PROPOSAL_20260423_009 |
| P-22     | `LITE_OVERUSE`                  | `提案改 Full <PROPOSAL_YYYYMMDD_NNN>` 或 `分拆提案 <PROPOSAL_YYYYMMDD_NNN>`                                                        | PROPOSAL_20260423_010 |
| P-23     | `TECH_STACK_AUDIT_OVERDUE`      | `執行 tech-stack 審計 <workspace>` 或 `延後審計 <workspace>，原因：<說明>`                                                         | PROPOSAL_20260424_018 |
| P-24     | `RULE_SIZE_OVERDUE`             | `提案拆檔 <rule>.md` 或 `確認拆檔已立案 <PROPOSAL_YYYYMMDD_NNN>`                                                                   | PROPOSAL_20260424_020 |
| P-25     | `PRIOR_ART_BYPASS_UNLOGGED`     | `補建豁免記錄 <PRIOR_ART_REPORT 路徑> → AUDIT_HISTORY` 或 `撤回 bypass <PRIOR_ART_REPORT 路徑>`                                    | PROPOSAL_20260430_004 |

---

## 錯誤指令處理

User 輸入不符合本表格式時，`@Lead` 依下列順序處理：

1. **模糊匹配**：若指令含關鍵字（如「採納」、「重評」）但格式略有偏差 → `@Lead` 確認意圖並重述為標準格式，等待 User 確認
2. **無法匹配**：`@Lead` 回覆：「指令格式不符。請使用以下格式：`<標準指令>`」並引用本表對應列
3. **跨 P-XX 模糊**：若指令可能對應多條 P-XX → `@Lead` 列出候選並請 User 明確選擇

---

## 變體指令建議

以下為等效變體（User 可用任一形式，`@Lead` 視為相同意圖）：

| 標準指令                                       | 允許變體                                          |
| ---------------------------------------------- | ------------------------------------------------- |
| `採納提案 PROPOSAL_YYYYMMDD_NNN`               | `執行提案 PROPOSAL_YYYYMMDD_NNN` / `通過提案 NNN` |
| `拒絕提案 PROPOSAL_YYYYMMDD_NNN，原因：<說明>` | `駁回提案 NNN，因：<說明>`                        |
| `執行 project-onboarding`                      | `啟動 onboarding` / `初始化專案`                  |
| `切換 workspace <project_name>`                | `切到 workspace <name>`                           |

**擴充**：新變體由 `@Retro` 觀察 User 實際使用後提案納入。

---

## 禁止行為

- **絕對禁止** `@Lead` 阻斷通知僅說「請處理」而不附具體指令格式
- **絕對禁止** `@Lead` 自創非本表定義的指令格式要求 User 使用
- **絕對禁止** 省略指令中的必填參數（如 `<功能名稱>` / `<proposal_id>` 等）

---

## 與其他規則對齊

- `assistant.md §s08`：入口引用本 skill
- `patrol-notification-catalog.md §B`：通知類型完整定義
- `lead.md §s04 通知接收與處理優先級`：`@Lead` 收通知後的處理時限
- `skills/lead-dispatch-patterns.md`：@Lead 派發格式（與本表對照使用）

---

## 溯源

本檔案抽出自：`assistant.md §s08 User 指令格式定義`

**修訂方式**：新增巡邏規則 P-XX 時（通常伴隨新提案），對應 User 指令同步補入本表；透過 RULE_UPDATE_PROPOSAL 統一維護。

---

## Related Decisions

- [ADR-0029](../decisions/0029-assistant-patrol-catalog.md) — @Assistant 巡邏規則目錄
- [ADR-0030](../decisions/0030-notification-classification.md) — 通知分級標準
