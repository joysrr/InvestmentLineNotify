---
skill_id: advice-template
file_type: template
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_004
purpose: |
  @Consultant ADVICE_*.md 標準格式（採納/部分/未採納 三層分類）
referenced_by:
  - rules/consultant.md
  - skills/lead-context-mappings.md
  - skills/templates/advice-response-template.md
  - docs/agents-overview.md
---

# Skill: ADVICE 標準格式模板

> 本模板由 PROPOSAL-001 從 `consultant.md` 外部化而來。
> `@Consultant` 在 Workflow 第 2 步（戰略審查階段）依本格式產出 `ADVICE_<功能名稱>.md`，存放於 `docs/plans/advice/`。

---

## 標準格式

```markdown
# Domain Advice Report

**功能名稱**：<功能簡稱>
**對應草案版本**：draft v<N>
**建立日期**：<日期>
**啟用領域**：<列出本次傳入的所有 domain 檔案名稱>

---

<!-- 若無領域衝突，移除此區塊 -->

## 🚨 領域衝突警告

**衝突領域**：`<領域 A>` vs `<領域 B>`
**衝突描述**：<說明兩個領域在此功能中產生的具體矛盾>
**強制要求**：`@Planner` 必須在需求草案中加入以下權重參數後，才可繼續推進架構設計：
```

strategyWeight: { <領域A的key>: 0.X, <領域B的key>: 0.X }

```

---

## 建議新增的運算參數

| 參數名稱 | 建議預設值 | 來源領域 | 說明 |
|---------|----------|---------|------|
| `<paramName>` | `<value>` | 【領域：<名稱>】 | <為何需要此參數> |

---

## 風險警告

| 等級 | 風險描述 | 來源領域 | 建議處理方式 |
|------|---------|---------|------------|
| 🔴 高 | <風險描述> | 【領域：<名稱>】 | <建議> |
| 🟡 中 | <風險描述> | 【領域：<名稱>】 | <建議> |

---

## 策略防護建議

<!-- 每條建議必須標示來源領域 -->
- 【領域：<名稱>】<防護建議內容>
- 【領域：<名稱>】<防護建議內容>

---

## 未知知識領域（若有）

| 未知術語 / 演算法 | 出現位置 | 建議補充的 domain 檔案名稱 |
|----------------|---------|------------------------|
| `❓ <術語名稱>` | `draft_features.md` 第 <N> 段 | `domains/<建議檔名>.md` |

---

## 給 @Planner 的整合建議

> 以下為本次顧問審查的整合優先順序，請 `@Planner` 逐項回覆採納狀態：

| # | 建議摘要 | 優先級 | 採納狀態 |
|---|---------|--------|---------|
| 1 | <建議摘要> | 🔴/🟡/🟢 | ⬜ 待評估 |
| 2 | <建議摘要> | 🔴/🟡/🟢 | ⬜ 待評估 |
```

---

## 撰寫守則（節錄自 `consultant.md`）

- **動態化身**：每條建議必須以 `【領域：<領域名稱>】` 前綴標示發言視角
- **領域衝突仲裁**：若多領域衝突，必須在頂部加 `🚨 領域衝突警告`，並強制要求 `strategyWeight` 權重參數
- **知識越界防護**：若計畫中出現領域知識檔未涵蓋的術語，必須標示 `❓ 未知知識領域`
- **唯讀原則**：本文件只是獨立的 ADVICE，禁止直接修改 `docs/plans/draft_features.md`，該動作由 `@Planner` 依「ADVICE_RESPONSE」流程處理

---

## Related Decisions

- [ADR-0002](../decisions/0002-workspace-context-injection.md) — Workspace 靜態注入
