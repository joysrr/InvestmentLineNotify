# Skill: PENDING_ACTIONS.md 標準格式模板

> 本模板由 PROPOSAL_20260422_005 建立，對應 `assistant.md §s10`。
> `@Lead` 於每次任務收斂時依本模板更新 `PENDING_ACTIONS.md`。

---

## 標準格式

<!-- TEMPLATE_START: PENDING_ACTIONS -->
<!--
 監控模式：ACTIVE / PASSIVE
 推播設定：ALL / RED_ONLY / OFF
 最後更新：YYYY-MM-DD HH:MM by @Lead
-->

# Pending Actions

> 監控模式：`ACTIVE` ｜ 推播設定：`ALL` ｜ 最後更新：`YYYY-MM-DD HH:MM by @Lead`

---

## 🎯 工作流狀態錨點（State Anchor）

> 由 `@Lead` 於每次 Gate Check 後更新。
> `@Lead` 啟動對話第一動作：讀取本區塊。

- **[CURRENT_STAGE]**：<0 / 1 / 2 / 3 / 4 / 5 / 6 / 6.5 / 7 / 8 / 9 / IDLE / HOTFIX>
- **[CURRENT_TICKET]**：<TICKET-XXX 或 none>
- **[NEXT_AGENT]**：<@Agent 或 none>
- **[ARTIFACT_PATHS]**：<本階段涉及的產出物檔案路徑 list，一行一個>
 - <例：`docs/plans/draft_features.md`>
- **[LAST_UPDATED]**：<YYYY-MM-DD HH:MM by @Lead>

---

## 🔴 需要立即處理（新功能已阻斷）

> ⚠️ 以下項目未處理前，`@Lead` 拒絕啟動任何新功能開發。

<details>
<summary>共 N 筆 🔴 項目（點擊展開）</summary>

| ID | 類型 | 說明 | 來源 | 建立時間 | 處理指令 |
|----|------|------|------|---------|---------|
| BLOCK_001 | `<類型>` | <說明> | <來源> | <YYYY-MM-DD> | `<User 指令>` |

</details>

---

## 🟡 待處理（不阻斷，但需回覆）

<details>
<summary>共 N 筆 🟡 項目（點擊展開）</summary>

| ID | 類型 | 說明 | 來源 | 建立時間 | 處理指令 |
|----|------|------|------|---------|---------|
| PEND_001 | `<類型>` | <說明> | <來源> | <YYYY-MM-DD> | `<User 指令>` |

</details>

---

## ✅ 最近已處理（最近 5 筆）

| ID | 類型 | 說明 | 處理方式 | 處理時間 |
|----|------|------|---------|---------|
| PEND_000 | `<類型>` | <說明> | `<處理方式>` | <YYYY-MM-DD> |

---

## 📋 豁免記錄 (EXEMPTION_LOG)

> 對齊 `lead.md §豁免授權與記錄機制`。由 `@Lead` 統一寫入，其他 Agent 禁止直接編輯。

<details>
<summary>共 N 筆豁免記錄（點擊展開）</summary>

| 豁免編號 | 申請 Agent | 豁免規則 | 授權來源 | 有效期 | 建立時間 | 狀態 |
|---------|-----------|---------|---------|-------|---------|------|
| EX-YYYYMMDD-001 | `@Agent` | <規則> | <授權來源> | <有效期> | <日期> | <狀態> |

</details>

**累積警示**：當未歸檔豁免記錄 ≥ `EXEMPTION_AUDIT_THRESHOLD`（依 `RULES_DESIGN_GUIDE.md §十四`，預設 5 筆），`@Assistant` 巡邏產生 🟡 `EXEMPTION_ACCUMULATED` 通知。

<!-- TEMPLATE_END -->

---

## 使用規範

- 本模板由 `@Lead` 於每次任務收斂時依 `assistant.md §s05 巡邏規則表` 結果更新
- 模板結構變更必須透過 `RULE_UPDATE_PROPOSAL` 提案（不可直接改模板）
- 本模板對應 `assistant.md §s10` 的引用入口
- 🎯 狀態錨點區塊由 PROPOSAL_20260422_001 定義，`@Lead` 啟動對話的第一個讀取項目

---

## Related Decisions

- [ADR-0001](../decisions/0001-stateless-lead-routing.md) — Stateless @Lead Routing 三鐵律
- [ADR-0029](../decisions/0029-assistant-patrol-catalog.md) — @Assistant 巡邏規則目錄
