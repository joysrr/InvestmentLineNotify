---
type: reference
status: current
last_updated: 2026-09-10
last_verified: 2026-09-10
tags:
  - architecture
  - decisions
  - adr
  - dec
wiki_links:
  - [[Architecture]]
  - [[AI Pipeline]]
  - [[Strategy Engine]]
---

# 架構決策記錄索引 (ADR/DEC)

> **摘要**: 所有架構決策記錄的索引與分類

## 概念關係

- [[Architecture]] - 架構總覽
- [[AI Pipeline]] - AI 管線
- [[Strategy Engine]] - 策略引擎
- [[Operations]] - 運維

---

## 📋 全部決策記錄

| ID      | 標題               | 狀態        | 完成日期 | 影響模組                 |
| ------- | ------------------ | ----------- | -------- | ------------------------ |
| DEC-005 | 監控與告警         | ✅ archived | 2026-08  | ai_news, operations      |
| DEC-006 | 部署自動化         | ✅ archived | 2026-08  | operations, presentation |
| DEC-016 | Vitest Worker 崩潰 | ✅ archived | 2026-08  | testing                  |

---

## 📊 按主題分類

### 基礎設施

- [DEC-006: 部署自動化](DEC-006-deployment-automation.md)

### 可觀測性

- [DEC-005: 監控與告警](DEC-005-monitoring-alerting.md)

### 測試

- [DEC-016: Vitest Worker 崩潰](DEC-016-vitest-worker-crash.md)

---

## 📅 建立新決策記錄流程

### 1. 判斷是否需要 ADR

當你面臨以下情況時，應記錄一個 ADR：

- ⚠️ **架構權衡**: 選擇不同的設計方案
- ⚠️ **技術依賴**: 添加新的外部依賴
- ⚠️ **API 變更**: 影響多模組的改動
- ⚠️ **部署策略**: 影響部署流程的改變

### 2. ADR 命名規則

```
docs/architecture/DEC-XXX-descriptive-name.md
```

- `XXX`: 3 位數字，按順序遞增
- `descriptive-name`: 簡短描述 (kebab-case)

### 3. ADR 範本

```markdown
---
type: explanation
status: proposed | accepted | superseded | deprecated
title: 簡短描述
author: 姓名
date: YYYY-MM-DD
decides:
  - 影響的模組/類別
  - 相關決策
related_to:
  - DEC-001: 其他相關決策
---

# DEC-XXX: 標題

## Context

面臨何種情況/問題？

## Decision

做出什麼決定？

## Consequences

什麼好處和後果？

## Alternatives Considered

考慮過哪些其他選項？
```

### 4. 生命週期

```
Proposed → Accepted → (Superseded/Deprecated)
```

- **Proposed**: 初稿，未正式接受
- **Accepted**: 經過討論，正式接受
- **Superseded**: 被新決策取代
- **Deprecated**: 不再推薦使用
