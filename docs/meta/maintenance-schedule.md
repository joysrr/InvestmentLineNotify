---
type: reference
status: current
last_updated: 2026-11-11
tags:
  - maintenance
  - schedule
  - automation
wiki_links:
  - [[Documentation]]
  - [[Operations]]
---

# 文件維護排程 (Documentation Maintenance Schedule)

## 📅 定期維護任務

### 每週 (Weekly)

**時間**: 每週五 23:00 UTC  
**負責**: 自動化 / 開發者

- [ ] 執行健康度檢查 (`node scripts/analyze-docs-health.mjs`)
- [ ] 檢視健康度報告 (`docs/meta/health-report.json`)
- [ ] 更新過時文件 (last_updated > 30 天的 current 文件)

### 每月 (Monthly)

**時間**: 每月 1 日  
**負責**: Tech Lead / 文件管理員

- [ ] 歸檔上月報告 (`docs/Reports/` → `docs/Reports/archive/YYYY-MM/`)
- [ ] 審查 active plans 進度
- [ ] 清理 backlog plans (移除過時 ideas)
- [ ] 更新 wiki-index.json
- [ ] 驗證 wiki links 有效性

### 每季 (Quarterly)

**時間**: 每季末月 15 日  
**負責**: 團隊全員 Review

- [ ] 全面文件審查 (status 狀態核實)
- [ ] 清理 1 年以上舊報告
- [ ] 更新架構決策記錄 (ADR)
- [ ] 刷新設計文件 (design/)
- [ ] Wiki 概念重整與連結優化

---

## 🎯 健康度目標

| 類別         | 目標分數 | 當前分數    |
| ------------ | -------- | ----------- |
| Reference    | ≥ 75     | 77 ✅       |
| Guide        | ≥ 70     | 58 ⚠️       |
| Tutorial     | ≥ 70     | -           |
| Explanation  | ≥ 60     | 50 ⚠️       |
| Report       | ≥ 50     | 45 ⚠️       |
| Plan         | ≥ 45     | 44 ⚠️       |
| **整體平均** | **≥ 60** | **54.1** ⚠️ |

---

## 🔧 維護工具

### 本地工具

```bash
# 健康度檢查
node scripts/analyze-docs-health.mjs

# 生成 Wiki 索引
node scripts/generate-wiki-index.mjs

# 驗證 frontmatter
node scripts/pre-commit-docs-check.mjs

# 自動添加 frontmatter
node scripts/add-frontmatter.mjs <file>
```

### CI/CD

- **GitHub Actions**: `.github/workflows/docs-validation.yml`
- **Pre-commit Hook**: `.husky/pre-commit`
- **健康度閾值**: 50/100 (低於此值 CI 失敗)

---

## 📦 本地生成物 (Local Artifacts)

以下檔案由驗證腳本產生，僅存在於本地，**不納入版本控制** (已在 `.gitignore` 排除)：

| 檔案                            | 產生腳本                  | 說明                              |
| ------------------------------- | ------------------------- | --------------------------------- |
| `docs/meta/health-report.json`  | `analyze-docs-health.mjs` | 文件健康度分析報告，本地查看用    |
| `docs/meta/graph-analysis.json` | `analyze-docs-health.mjs` | 知識圖譜分析數據，本地查看用      |
| `docs/meta/concept-graph.mmd`   | `generate-wiki-index.mjs` | 概念圖 Mermaid 原始碼，本地查看用 |

與上述不同，以下檔案由 `generate-wiki-index.mjs` 產生，**需 commit 至版本控制**：

| 檔案                   | 說明                                    |
| ---------------------- | --------------------------------------- |
| `docs/wiki-index.json` | Wiki 離線知識庫索引，LLM 離線查詢真理源 |
| `docs/wiki-graph.json` | Wiki 知識圖譜，節點與邊關係             |

---

## 📋 維護檢查清單

### 新增文件時

- [ ] 添加完整 frontmatter (type, status, last_updated, tags, wiki_links)
- [ ] 至少 2 個 wiki links 連結到相關概念
- [ ] 至少 1 個 related_code (如適用)
- [ ] 文件格式符合 Diátaxis 框架
- [ ] 執行 `node scripts/pre-commit-docs-check.mjs` 驗證

### 更新現有文件時

- [ ] 更新 `last_updated` 為今天日期
- [ ] 檢查 `status` 是否仍然正確
- [ ] 更新過時的 wiki links
- [ ] 添加新的 related_code (如有變更)
- [ ] 更新 `last_verified` (如已驗證)

### 歸檔文件時

- [ ] 變更 `status` 為 `archived`
- [ ] 添加 `completed_date` 或 `archived_date`
- [ ] 移至適當的 archive 目錄
- [ ] 更新引用此文件的其他文件

---

## 📊 健康度指標說明

### 分數計算

- **Frontmatter 完整度** (40%): 有效 frontmatter + 必要欄位
- **連結密度** (30%): wiki_links 數量
- **代碼映射** (20%): related_code 數量
- **時效性** (10%): last_updated 距今天數

### 狀態標籤

- `current`: 活躍維護、內容正確
- `needs-review`: 需要審查更新
- `in-progress`: 正在編寫中
- `archived`: 已歸檔、歷史參考
- `deprecated`: 已廢棄、不再使用
- `superseded`: 被新文件取代

---

## 🚨 告警與通知

### 自動告警條件

1. 健康度低於 50 (CI 失敗)
2. Reference 類平均低於 70
3. 超過 10 個文件 last_updated > 60 天
4. Wiki links 覆蓋率 < 80%

### 通知方式

- GitHub Actions 失敗通知
- PR 檢查失敗註解
- 每週健康度報告 (可選)

---

## 📖 參考資料

- [Diátaxis Framework](https://diataxis.fr/) - 文件分類框架
- [LLM Wiki Index](https://github.com/nashsu/llm_wiki) - Wiki 索引系統
- 本專案文件標準: `docs/meta/documentation-standards.md`

---

**最後更新**: 2026-09-11  
**維護者**: Han (@joysrr)
