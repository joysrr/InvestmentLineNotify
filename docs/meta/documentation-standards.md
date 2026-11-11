---
type: reference
status: current
last_updated: 2026-09-11
tags:
  - standards
  - documentation
  - guidelines
wiki_links:
  - [[Documentation]]
  - [[Wiki Index]]
---

# 文件標準 (Documentation Standards)

## 📐 Frontmatter 規範

所有 `docs/` 下的 `.md` 文件必須包含 YAML frontmatter。

### 必要欄位

```yaml
---
type: reference|tutorial|explanation|plan|report
status: current|archived|deprecated|in-progress|needs-review
last_updated: YYYY-MM-DD
tags:
  - tag1
  - tag2
wiki_links: []
---
```

### 可選欄位

```yaml
last_verified: YYYY-MM-DD # 最後驗證日期
completed_date: YYYY-MM-DD # 完成日期 (archived/completed)
superseded_by: file-name.md # 被取代的文件
related_code: # 相關代碼路徑
  - src/modules/xxx/
related_docs: # 相關文件
  - other-doc.md
progress: 85% # 進度 (in-progress)
```

---

## 📚 文件類型 (Diátaxis Framework)

### 1. Tutorial (教學)

**目標**: 幫助新手學習  
**特徵**: 循序漸進、實作導向

```yaml
type: tutorial
status: current
tags:
  - tutorial
  - getting-started
```

**範例**: `TESTING.md`, `E2E_TESTING_GUIDE.md`

### 2. Reference (參考)

**目標**: 提供精確資訊  
**特徵**: 結構化、API 文件

```yaml
type: reference
status: current
related_code:
  - src/modules/xxx/
tags:
  - api
  - reference
```

**範例**: `API_CONTRACT.md`, `modules/*/`

### 3. Explanation (說明)

**目標**: 解釋設計決策  
**特徵**: 理論、背景、權衡

```yaml
type: explanation
status: archived
completed_date: 2026-08-15
tags:
  - architecture
  - adr
```

**範例**: `architecture/DEC-*.md`, `design/`

### 4. Plan (計畫)

**目標**: 追蹤開發計畫  
**特徵**: 里程碑、進度、任務

```yaml
type: plan
status: in-progress
progress: 75%
tags:
  - plan
  - feature
```

**範例**: `plans/active/*.md`

### 5. Report (報告)

**目標**: 記錄審計與驗證  
**特徵**: 數據、發現、建議

```yaml
type: report
status: archived
tags:
  - audit
  - security
```

**範例**: `Reports/*.md`, `verification/*.md`

---

## 🔗 Wiki Links 規範

### 連結格式

```markdown
[[Concept Name]] # 標準格式
[[Strategy Engine]] # 模組名稱
[[AI Pipeline]] # 管線名稱
[[Langfuse]] # 整合服務
```

### 概念命名規則

- **模組**: 大寫開頭，空格分隔 (e.g., `Strategy Engine`)
- **功能**: 動詞 + 名詞 (e.g., `News Fetcher`)
- **整合**: 服務名稱 (e.g., `Langfuse`, `Telegram Bot`)
- **概念**: 名詞片語 (e.g., `Portfolio Health`)

### 最低連結數

- **Reference**: ≥ 2 個 wiki links
- **Tutorial**: ≥ 2 個 wiki links
- **Explanation**: ≥ 3 個 wiki links
- **Plan**: ≥ 1 個 wiki link (關聯模組)
- **Report**: ≥ 1 個 wiki link

---

## 📝 內容規範

### 文件結構

```markdown
---
frontmatter
---

# 標題

> **摘要**: 一句話描述本文件目的

## 概念關係

- [[Related Concept 1]]
- [[Related Concept 2]]

---

## 主要內容

### 子章節

...

---

## 參考資料

- 外部連結
- 相關文件
```

### 撰寫原則

1. **簡潔明確**: 一句話能說清楚就不要兩句
2. **結構化**: 使用標題、列表、表格
3. **可操作**: Tutorial 要有明確步驟
4. **可驗證**: Reference 要有代碼路徑
5. **可追溯**: Explanation 要有決策背景

### 語言風格

- **人機共讀**: 既要 LLM 能理解，也要人能讀
- **繁體中文**: 說明用中文，代碼/日誌用英文
- **專業但友善**: Tech Lead 語氣，不冷不熱

---

## 🏷️ Tags 規範

### 核心 Tags

```yaml
# 模組類
- ai-news
- strategy
- presentation
- operations

# 功能類
- testing
- deployment
- api
- integration

# 狀態類
- archived
- deprecated
- backlog

# 主題類
- langfuse
- telegram
- vue
- e2e
```

### 命名規則

- 小寫
- 連字號分隔 (kebab-case)
- 簡短精確 (1-2 詞)
- 避免重複 (用 wiki_links 表達關聯)

---

## 📊 健康度標準

### 優秀 (≥ 80)

- ✅ 完整 frontmatter (所有必要欄位)
- ✅ ≥ 3 個 wiki links
- ✅ ≥ 1 個 related_code
- ✅ last_updated 在 30 天內
- ✅ status = current

### 良好 (60-79)

- ✅ 完整 frontmatter
- ✅ ≥ 2 個 wiki links
- ⚠️ last_updated 在 60 天內

### 一般 (40-59)

- ✅ 基本 frontmatter
- ⚠️ < 2 個 wiki links
- ⚠️ last_updated > 60 天

### 差 (< 40)

- ❌ 缺少 frontmatter
- ❌ 無 wiki links
- ❌ last_updated > 180 天

---

## 🔧 工具使用

### 驗證文件

```bash
# 驗證 frontmatter
node scripts/pre-commit-docs-check.mjs

# 健康度分析
node scripts/analyze-docs-health.mjs

# 生成 Wiki 索引
node scripts/generate-wiki-index.mjs
```

### 自動修復

```bash
# 自動添加 frontmatter
node scripts/add-frontmatter.mjs docs/path/to/file.md
```

### Git Hooks

- **Pre-commit**: 自動驗證 staged 文件的 frontmatter
- **Lint-staged**: 自動格式化 markdown

### CI/CD

- **GitHub Actions**: 自動驗證 PR 中的文件變更
- **健康度閾值**: 平均分數 ≥ 50 (否則 CI 失敗)

---

## 📖 最佳實踐

### 新增文件時

1. 從範本開始 (或使用 `add-frontmatter.mjs`)
2. 至少添加 2 個 wiki links
3. 如是代碼相關，添加 related_code
4. 使用適當的 Diátaxis 類型
5. 添加至少 2 個有意義的 tags

### 更新文件時

1. 更新 `last_updated` 日期
2. 檢查 wiki links 是否仍然有效
3. 更新 related_code (如代碼已變更)
4. 考慮是否需要變更 status

### 歸檔文件時

1. 變更 status 為 `archived`
2. 添加 `completed_date` 或 `archived_date`
3. 移至 `archive/` 或 `completed/` 目錄
4. 更新引用此文件的其他文件

---

## 🚨 常見錯誤

### ❌ 錯誤的 frontmatter

```yaml
---
type: docs # 應使用標準類型
status: done # 應使用 completed 或 archived
updated: 2026-09-11 # 應使用 last_updated
---
```

### ❌ 無效的 wiki links

```markdown
[[strategy]] # 應大寫: [[Strategy]]
[[strategyEngine]] # 應加空格: [[Strategy Engine]]
[Strategy Engine](...) # 應使用 [[...]] 格式
```

### ❌ 缺少關鍵資訊

```markdown
# 標題

內容...
```

應包含摘要和概念關係:

```markdown
# 標題

> **摘要**: 簡短描述

## 概念關係

- [[Related Concept]]

---

## 內容
```

---

## 🔄 文件生命週期 (Documentation Lifecycle)

所有 `docs/` 下的文件應遵循以下生命週期，確保文件與程式碼保持同步：

| 階段       | 動作                                                    | 負責人             |
| ---------- | ------------------------------------------------------- | ------------------ |
| 新增文件   | 補入 `docs/README.md` 導航地圖與 `docs/wiki-index.json` | 提交 PR 的開發者   |
| 修改程式碼 | 同步更新對應文件（SSOT = 程式碼，文件過時則更新文件）   | 修改程式碼的開發者 |
| 文件過時   | 標記 `status: superseded` 或刪除，並同步更新導航        | 維護者             |
| 文件刪除   | 從導航地圖與 Wiki 索引中移除，並檢查斷鏈                | 維護者             |

### 自動化檢查

> 完整腳本清單與用途說明請見 [`docs/meta/scripts-inventory.md`](scripts-inventory.md)。

- `scripts/validate-docs-consistency.mjs`：每次 CI 運行，檢查 frontmatter、導航路徑、DEC 集中、plans 日期前綴、modules status
- `scripts/validate-docs-code-consistency.mjs`：每季 CI 運行，檢查關鍵數值與程式碼常數一致性
- `scripts/analyze-docs-health.mjs`：每次 CI 運行，評分 ≥ 50 為通過門檻

### 週期健康度檢查

- 每月最後一個週五：執行 `validate-docs-consistency.mjs` + `analyze-docs-health.mjs`
- 每季最後一個週五：執行 `validate-docs-code-consistency.mjs` + 人工抽查 3 份文件
- 每年 1 月：全庫盤點，更新文件清單

---

**最後更新**: 2026-11-11  
**版本**: 1.0  
**維護者**: Han (@joysrr)
