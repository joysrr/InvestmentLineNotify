# Skill: GLOBAL_STATUS_SUMMARY 標準格式模板

> 本模板由 PROPOSAL_20260422_004 建立，對應 `assistant.md §s_global_summary`。
> `@Assistant` 每次產出 `docs/Reports/GLOBAL_STATUS_SUMMARY.md` 時依本模板執行。

---

## 標準格式

<!-- TEMPLATE_START: GLOBAL_STATUS_SUMMARY -->
<!--
 最後更新：YYYY-MM-DD HH:MM by @Assistant
 觸發方式：主動指令 / 收斂階段 / 里程碑事件 / P-13 巡邏
 資料來源：PENDING_ACTIONS.md + proposals/active/ + REVIEW/SECURITY_REPORT + ADVICE
-->

# 🌐 全局狀態摘要 (Global Status Summary)

**最後更新**：YYYY-MM-DD HH:MM by `@Assistant`
**本次觸發**：<主動 / 被動：事件名稱>

---

## 📊 當前水位 (Current Level)

<一句話說明目前開發處於哪個階段與整體健康度，含最重要的 1~2 個指標>

## 🔥 熱點警示 (Hot Spots)

### 🔴 阻斷項目（<n> 筆）
- [ID] <類型>：<白話說明對專案的影響；對照 PENDING_ACTIONS.md>

### 🟡 待處理項目（<n> 筆）
- [ID] <類型>：<白話說明；對照 PENDING_ACTIONS.md>

若無熱點：`✅ 本階段無熱點；所有項目可控中`

## 🎯 進展肯定 (Progress Celebration)

近期完成的關鍵節點：
- ✅ <節點名稱>（<日期 / 對話輪次>）— <一句話說明價值>

若近期無完成項目：`暫無新進展；持續推進中`

## 🧭 下一步建議 (Next Steps Recommendation)

> 本節僅描述 Pending Actions 的推薦處理順序，**不構成**業務決策建議。

1. <優先處理項目 ID> — <理由：依優先級 / 依賴關係 / 風險等級>
2. <次優先項目 ID> — <理由>
3. <可延後項目 ID> — <理由>

## 🔁 對話承接提示 (Session Handoff Note)

> 給下次對話或換對話接手的 User 的快速上手提示。

- **當前 Sprint**：<Ticket 列表或「無」>
- **最近一個 Gate**：<階段轉移摘要；來自 PENDING_ACTIONS.md 狀態錨點>
- **最需關注**：<1 項最重要的關注點>

---

<!-- TEMPLATE_END -->

---

## 使用規範

- 此模板由 `@Assistant` 每次觸發時完整填寫；空欄位以 `（無）` 或 `暫無` 標注
- 前 `SUMMARY_HISTORY_LIMIT` 份歷史摘要（依 `RULES_DESIGN_GUIDE §十四`，預設 3 份）保留於 `docs/Reports/archive/summary/GLOBAL_STATUS_SUMMARY_<YYYYMMDD_HHMM>.md`
- 超過 `SUMMARY_HISTORY_LIMIT` 的歷史由 `@Assistant` 於下次巡邏時批次清理（保留最新 N 份）

## 設計原則

- **描述性而非決策性**：`@Assistant` 為觀察者，不跨越業務決策邊界
- **雙軌輸出（對齊 PROPOSAL_20260422_004）**：M2M 軌道（`@Lead` 短指令）+ HCI 軌道（本摘要）並行，互不干擾
- **自檢強制**：寫入前依 `assistant.md §s_global_summary` 第 5 條自檢 Checklist 執行

---

## Related Decisions

- [ADR-0001](../decisions/0001-stateless-lead-routing.md) — Stateless @Lead Routing 三鐵律
- [ADR-0029](../decisions/0029-assistant-patrol-catalog.md) — @Assistant 巡邏規則目錄
