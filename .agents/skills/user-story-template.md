# Skill: User Story 格式模板

> 本模板由 PROPOSAL-001 從 `planner.md` 外部化而來。
> `@Planner` 撰寫 `docs/plans/draft_features.md` 條目時，User Story 與驗收標準（AC）部分必須符合本格式。

---

## 標準格式

### User Story 核心句型

```markdown
#### User Story
> 身為 **<使用者角色>**，
> 我想要 **<功能描述>**，
> 以便 **<達成的目標/價值>**。
```

### 驗收標準 (Acceptance Criteria) — Given / When / Then

每個 User Story 至少包含「正常路徑」與「異常路徑」兩個情境：

```markdown
#### 驗收標準 (Acceptance Criteria)

**情境一：正常路徑**
- Given：<前置條件>
- When：<觸發動作>
- Then：<預期結果>

**情境二：異常路徑**
- Given：<前置條件>
- When：<異常觸發>
- Then：<系統應如何處理>
```

---

## 撰寫守則

- 「使用者角色」須為具體的系統使用者（例：一般用戶、管理員、開發人員），禁止使用「使用者」此類泛稱。
- 「功能描述」須為可被實作的具體動作，禁止使用「系統變得更好」等模糊描述。
- 「目標/價值」須說明為什麼值得做，不僅描述「做什麼」。
- AC 的 Given/When/Then 句型每項僅描述一個可驗證條件，多條件請拆分情境。

---

## Related Decisions

- [ADR-0014](../decisions/0014-prior-art-scan.md) — Prior Art Scan 強制程序
