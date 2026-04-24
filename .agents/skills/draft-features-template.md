# Skill: Draft Features 條目格式模板

> 本模板由 PROPOSAL-001 從 `planner.md` 外部化而來。
> `@Planner` 撰寫 `docs/plans/draft_features.md` 每個功能條目時必須符合本格式。

---

## 標準格式

```markdown
---
### 功能名稱：<功能簡稱>
**優先級**：🔴 高 / 🟡 中 / 🟢 低
**影響範圍**：Frontend / Backend / 兩者 / 基礎設施
**預計影響模組**：（例如：`src/strategies/`、`webapp/components/`）

#### User Story
> 身為 **<使用者角色>**，
> 我想要 **<功能描述>**，
> 以便 **<達成的目標/價值>**。

#### 驗收標準 (Acceptance Criteria)
**情境一：正常路徑**
- Given：<前置條件>
- When：<觸發動作>
- Then：<預期結果>

**情境二：異常路徑**
- Given：<前置條件>
- When：<異常觸發>
- Then：<系統應如何處理>

#### 排除範圍 (Out of Scope)
- 本次不處理：<明確說明這次不做什麼，避免範疇蔓延>

#### 依賴項目 (Dependencies)
- 依賴其他功能：<若有，列出功能名稱>
- 依賴外部服務：<例如 Line API、Yahoo Finance API>

---
<!-- 版本歷程 -->
**草案版本**：v1
**最後更新**：<日期>
**修改原因**：初版建立
```

---

## 欄位說明

| 欄位 | 必填 | 說明 |
|---|---|---|
| 功能名稱 | ✅ | 簡短、可辨識的功能名稱（例：「新增 RSI 指標通知」）|
| 優先級 | ✅ | 🔴 / 🟡 / 🟢 三級，由 `@Planner` 依 User 輸入與影響範圍判定 |
| 影響範圍 | ✅ | Frontend / Backend / 兩者 / 基礎設施 |
| 預計影響模組 | ✅ | 實際檔案路徑，禁止填「目前未知」 |
| User Story | ✅ | 參照 `.agents/skills/user-story-template.md` |
| 驗收標準 | ✅ | 至少正常 + 異常兩情境，參照 `.agents/skills/user-story-template.md` |
| 排除範圍 | ✅ | 明確標示「本次不做」的項目，避免範疇蔓延 |
| 依賴項目 | ⭕ | 有外部相依或內部前置才填 |
| 版本歷程 | ✅ | 每次修改後由 `@Planner` 更新版本號與修改原因 |

---

## 相關模板

- User Story 核心句型與 AC 格式：`.agents/skills/user-story-template.md`
- Consultant 建議採納回覆：`planner.md` §「ADVICE_RESPONSE 標準格式」

---

## Related Decisions

- [ADR-0014](../decisions/0014-prior-art-scan.md) — Prior Art Scan 強制程序
