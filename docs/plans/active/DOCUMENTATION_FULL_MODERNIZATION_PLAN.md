---
type: plan
status: in-progress
last_updated: 2026-09-11
progress: 85%
tags:
  - documentation
  - modernization
  - sprint
wiki_links: []
---

# 文件系統全面改造計畫

**日期**: 2026-09-10  
**策略**: 一次做到位，系統化改造  
**目標**: 建立世界級的 AI-Agent 友善文件系統

---

## 🎯 核心目標

不是「整理文件」，而是：

1. **建立知識圖譜**：概念間的關係清晰可見
2. **Agent 優先**：設計給 AI Agent 使用的文件系統
3. **永續維護**：建立自動化機制，防止再次過時
4. **人機共讀**：人類和 Agent 都能高效使用

---

## 📊 全面改造 vs 增量改進對比

| 項目         | 增量改進  | 全面改造 ⭐ |
| ------------ | --------- | ----------- |
| **時間投入** | 3-4h 可用 | 20-25h 完整 |
| **文件品質** | 部分更新  | 100% 更新   |
| **知識圖譜** | 稀疏      | 完整        |
| **自動化**   | 手動為主  | 全自動      |
| **維護機制** | 基本      | 完善        |
| **最終效果** | 80 分     | 95+ 分      |

---

## 🏗️ 執行架構

### 三條並行軌道

```
軌道 1: Wiki 基礎設施 (技術層)
    ↓
軌道 2: 內容更新驗證 (內容層)
    ↓
軌道 3: 自動化與維護 (流程層)
```

三軌並行，互相支撐：

- Wiki 提供查詢能力 → 加速內容更新
- 內容更新 → 豐富 Wiki 索引
- 自動化 → 保持 Wiki 和內容同步

---

## 📋 詳細執行計畫

### 🔷 階段 1: 快速建立全局視野 (3-4h)

**目標**: 快速掃描全域，建立完整索引

#### 1.1 擴展 Wiki 索引到全部文件 (1h)

**任務**:

```bash
# 修改 scripts/generate-wiki-index.mjs
# 移除 PROTOTYPE_DIRS 限制
# 掃描全部 docs/ 目錄

const ALL_DIRS = [
  'modules',
  'architecture',
  'decisions',
  'design',
  'api',
  'plans',
  'Reports',
  'verification',
  // 根目錄文件
];
```

**產出**:

- `wiki-index.json` (141 個概念)
- `wiki-graph.json` (初始圖譜)
- 缺失元數據報告

#### 1.2 自動生成文件健康度報告 (1h)

**建立腳本**: `scripts/analyze-docs-health.mjs`

```javascript
// 分析每個文件：
// 1. 是否有 frontmatter
// 2. 是否有 related_code
// 3. 是否有 wiki-links
// 4. last_updated 是否過時 (>90天)
// 5. 文件與代碼是否同步

// 生成報告：
// - 健康度評分 (0-100)
// - 優先級排序
// - 缺失項目清單
```

**產出**:

- `docs/meta/health-report.json`
- 優先處理清單（按影響力排序）

#### 1.3 建立概念依賴圖譜 (1h)

**任務**:

- 分析模組間依賴關係
- 識別核心概念（被引用最多）
- 生成視覺化圖譜

**產出**:

- `docs/meta/concept-graph.svg` (Mermaid 生成)
- 核心概念清單 (Top 20)

#### 1.4 建立文件分類體系 (1h)

**按 Diátaxis 框架分類**:

```
docs/
├── 1-tutorials/          # 🆕 學習導向
│   └── getting-started/
├── 2-guides/             # 🆕 任務導向 (how-to)
│   ├── testing/
│   ├── deployment/
│   └── development/
├── 3-reference/          # 📚 資訊導向 (現有 modules, api)
│   ├── modules/
│   ├── api/
│   └── configuration/
├── 4-explanation/        # 💡 理解導向 (現有 architecture, design)
│   ├── architecture/
│   ├── decisions/
│   └── design/
└── meta/                 # 🆕 文件的文件
    ├── wiki-index.json
    ├── wiki-graph.json
    ├── health-report.json
    └── standards.md
```

**產出**:

- 新目錄結構
- 文件遷移計畫

---

### 🔷 階段 2: 核心文件深度更新 (8-10h)

**目標**: 優先處理高影響力文件，確保核心知識準確

#### 2.1 Langfuse v5 全面更新 (2h)

**範圍**:

- ✅ `langfuse_prompt_management_v5.md` (已完成)
- ⚠️ `langfuse_score_analytics.md` (需更新)
- ⚠️ `langfuse_score_configs.md` (需更新)
- ⚠️ `ai_pipeline.md` (需檢查)
- ⚠️ `env_vars.md` (需檢查)

**標準流程**:

1. 讀取舊文件
2. 對照當前代碼 (`src/modules/ai/langfuseClient.mjs`)
3. 更新 API 範例
4. 添加完整 frontmatter
5. 添加 `[[wiki-links]]`
6. 更新 `last_verified: 2026-09-10`

#### 2.2 模組文件系統化更新 (4h)

**優先順序**:

1. **ai_news/** (9 個文件) - 1.5h
   - AI 管線
   - Prompt 管理
   - 新聞採集

2. **strategy/** (9 個文件) - 1.5h
   - 策略引擎
   - 訊號計算
   - 狀態機

3. **presentation/** (6 個文件) - 1h
   - Bot 指令
   - API 端點
   - 通知系統

**更新模板**:

```markdown
---
type: reference
status: current
last_updated: 2026-09-10
last_verified: 2026-09-10
related_code:
  - src/path/to/implementation.mjs
  - src/path/to/tests.mjs
related_docs:
  - docs/architecture/DEC-XXX.md
  - docs/modules/other-module/file.md
dependencies:
  - package@version
tags:
  - tag1
  - tag2
---

# 模組標題

> **摘要**: 一句話說明職責

## 概念關係

- [[Related Concept 1]] - 說明關係
- [[Related Concept 2]] - 說明關係

## 職責與邊界

...

## API 參考

...

## 使用範例

...

## 疑難排解

...
```

#### 2.3 ADR/DEC 決策記錄補完 (1h)

**任務**:

- 檢查現有 4 個 DEC
- 補充決策背景、影響模組
- 添加 `[[wiki-links]]` 到相關概念
- 建立決策時間軸

#### 2.4 API 文件驗證與整合 (1.5h)

**任務**:

- 整合散落的 API 文件到 `docs/api/`
- 驗證 API 合約與實作一致性
- 添加請求/回應範例
- 生成 OpenAPI spec (選用)

#### 2.5 測試文件現代化 (1h)

**任務**:

- 移動到 `docs/guides/testing/`
- 更新 E2E 測試指南
- 補充 Vitest 使用範例
- 添加測試策略說明

---

### 🔷 階段 3: 批次處理與知識圖譜建立 (4-5h)

**目標**: 大規模處理剩餘文件，建立完整知識網絡

#### 3.1 批次添加 frontmatter (2h)

**工具**: `scripts/batch-add-frontmatter.mjs`

```javascript
// 自動生成基本 frontmatter:
// - type: 從目錄推斷 (modules→reference, architecture→explanation)
// - status: 預設 needs-review
// - last_updated: 從 git log 取得
// - tags: 從檔名和內容推斷

// 處理優先級:
// 1. modules/ 下所有文件
// 2. architecture/, decisions/, design/
// 3. plans/completed/
// 4. 其餘文件
```

**產出**:

- 所有文件都有基本 frontmatter
- 需要人工補充的清單

#### 3.2 知識圖譜密集編織 (2h)

**任務**:

- 人工審查核心概念
- 添加 `[[wiki-links]]` 連結相關概念
- 建立概念階層 (parent-child 關係)
- 識別孤立概念 (沒有連結的)

**目標**:

- 平均每個概念有 3-5 個連結
- 形成連通的知識網絡

#### 3.3 代碼映射完善 (1h)

**任務**:

- 為每個模組文件補充 `related_code`
- 驗證代碼路徑存在
- 建立反向映射（代碼→文件）

**工具**: `scripts/verify-code-mappings.mjs`

---

### 🔷 階段 4: 自動化與維護機制 (3-4h)

**目標**: 建立自動化系統，防止文件再次過時

#### 4.1 Git Hooks 自動化 (1h)

**Pre-commit hook**:

```bash
#!/bin/bash
# .git/hooks/pre-commit

# 1. 重新生成 Wiki 索引
node scripts/generate-wiki-index.mjs

# 2. 驗證索引完整性
node scripts/validate-wiki-index.mjs

# 3. 檢查斷裂的連結
node scripts/check-broken-links.mjs

# 4. 如果有變更，自動加入 commit
if git diff --quiet docs/wiki-*.json; then
  exit 0
else
  git add docs/wiki-index.json docs/wiki-graph.json
  echo "✓ Wiki 索引已自動更新"
fi
```

**Post-commit hook**:

```bash
#!/bin/bash
# 檢查是否有代碼變更
# 如果有，標記相關文件為 needs-review
```

#### 4.2 CI/CD 整合 (1h)

**GitHub Actions**: `.github/workflows/docs-validation.yml`

```yaml
name: Documentation Validation

on: [push, pull_request]

jobs:
  validate-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "26"

      - name: Install dependencies
        run: npm ci

      - name: Validate Wiki Index
        run: node scripts/validate-wiki-index.mjs

      - name: Check Documentation Health
        run: node scripts/analyze-docs-health.mjs

      - name: Verify Code Mappings
        run: node scripts/verify-code-mappings.mjs

      - name: Check Broken Links
        run: node scripts/check-broken-links.mjs

      - name: Upload Health Report
        uses: actions/upload-artifact@v3
        with:
          name: docs-health-report
          path: docs/meta/health-report.json
```

#### 4.3 定期同步檢測 (1h)

**工具**: `scripts/detect-stale-docs.mjs`

```javascript
// 掃描所有文件，檢測：
// 1. last_verified > 90 天
// 2. related_code 的文件有變更（git log）
// 3. 依賴的 package 版本變更

// 自動標記為 needs-review
// 生成待處理清單
```

**Cron 排程**: 每週日自動執行

#### 4.4 文件儀表板 (1h)

**建立 HTML 儀表板**: `docs/meta/dashboard.html`

```javascript
// 視覺化顯示：
// - 文件健康度總分
// - 各模組健康度雷達圖
// - 知識圖譜視覺化 (D3.js)
// - 需要更新的文件清單
// - 最近更新的文件
// - 孤立概念 (沒有連結)
```

---

### 🔷 階段 5: 最終驗收與文件化 (2-3h)

**目標**: 確保品質，建立規範

#### 5.1 全面驗證 (1h)

**檢查清單**:

- [ ] 所有文件都有 frontmatter
- [ ] 核心文件 100% 有 `related_code`
- [ ] 知識圖譜連通性 > 90%
- [ ] 斷裂連結 = 0
- [ ] 代碼路徑驗證通過
- [ ] 文件健康度 > 85 分
- [ ] Wiki 索引查詢正常

**工具**: `scripts/final-validation.mjs`

#### 5.2 建立文件標準與規範 (1h)

**產出**: `docs/meta/documentation-standards.md`

涵蓋：

- Frontmatter 格式
- Wiki-links 使用規範
- 文件類型定義
- 命名慣例
- 更新流程
- Review checklist

#### 5.3 撰寫維護手冊 (1h)

**產出**: `docs/meta/maintenance-guide.md`

涵蓋：

- 如何新增文件
- 如何更新文件
- 如何使用 Wiki 索引
- 自動化工具說明
- 疑難排解

---

## 📅 建議執行時程

### 🚀 Sprint 1 (第 1-2 天，8-10h)

**目標**: 建立全局視野 + 核心更新

- Day 1 上午 (4h): 階段 1 完成
- Day 1 下午 (4h): 階段 2.1-2.2 開始
- Day 2 上午 (4h): 階段 2.2-2.3 完成
- Day 2 下午 (2h): 階段 2.4-2.5 完成

**里程碑**:

- ✅ 完整索引建立
- ✅ 核心文件更新完成

---

### ✅ Sprint 2 (完成，實際 8h)

**目標**: 批次處理 + 知識圖譜 ✅

**實際執行**: 2026-09-11

**里程碑**:

- ✅ 所有文件有 frontmatter (99.3%, 141/142)
- ✅ 知識圖譜完整 (150 links, 39 code mappings)
- ✅ 健康度提升 27.1 → 54.1 (+100%)
- ✅ Reference 類平均達 77/100 (優秀水平)

**成果**:

- Wiki links: 20 → 150 (+650%)
- Code mappings: 2 → 39 (+1850%)
- Frontmatter 覆蓋率: 99.3%
- 批次更新 93 個文件

---

### ✅ Sprint 3 (第 5 天，3-5h)

**目標**: 自動化 + 驗收

- Day 5 上午 (2h): 階段 4.3-4.4
- Day 5 下午 (3h): 階段 5 全部

**里程碑**:

- ✅ 自動化機制運作
- ✅ 全面驗收通過
- ✅ 文件標準建立

---

## 📊 預期產出

### 文件資產

- ✅ **141 個文件** 全部更新到最新狀態
- ✅ **完整 Wiki 索引** (概念、代碼、圖譜)
- ✅ **知識圖譜** (平均 3-5 連結/概念)
- ✅ **健康度報告** (持續監控)
- ✅ **文件儀表板** (可視化狀態)

### 工具鏈

- ✅ `generate-wiki-index.mjs` - 索引生成
- ✅ `validate-wiki-index.mjs` - 索引驗證
- ✅ `analyze-docs-health.mjs` - 健康度分析
- ✅ `batch-add-frontmatter.mjs` - 批次處理
- ✅ `verify-code-mappings.mjs` - 代碼映射驗證
- ✅ `detect-stale-docs.mjs` - 過時檢測
- ✅ `check-broken-links.mjs` - 連結檢查
- ✅ `final-validation.mjs` - 最終驗收

### 自動化機制

- ✅ Git hooks (pre-commit, post-commit)
- ✅ CI/CD 驗證流程
- ✅ 定期同步檢測 (每週)
- ✅ 文件儀表板 (即時監控)

### 規範文件

- ✅ `documentation-standards.md` - 文件標準
- ✅ `maintenance-guide.md` - 維護手冊
- ✅ `docs/README.md` - 導航中心

---

## ✅ 驗收標準

### 量化指標

- [ ] **文件覆蓋率**: 100% (141/141)
- [ ] **元數據完整度**: 100% (所有文件有 frontmatter)
- [ ] **代碼映射覆蓋率**: > 80% (核心模組)
- [ ] **知識圖譜連通性**: > 90%
- [ ] **斷裂連結**: 0
- [ ] **文件健康度**: > 85 分
- [ ] **查詢速度**: < 5ms

### 質化指標

- [ ] Agent 能在 3 步內找到任何文件
- [ ] 文件與代碼 100% 同步
- [ ] 新手能透過文件快速上手
- [ ] 自動化機制正常運作
- [ ] 知識圖譜清晰可導航

---

## 🎯 成功指標

### 立即效益

- **查詢速度**: 傳統方式 ~1350ms → Wiki < 5ms (快 270x)
- **查找準確度**: 關鍵字匹配 ~70% → 概念導向 100%
- **更新效率**: 手動搜尋 → 自動識別相關文件

### 長期效益

- **維護成本**: 降低 80% (自動化)
- **知識傳承**: 新成員上手時間減半
- **Agent 效率**: 文件查找時間減少 90%
- **代碼品質**: 文件-代碼同步，減少誤解

---

## 🚨 風險與緩解

### 風險 1: 時間超支

**緩解**:

- 嚴格按階段執行
- 每個階段都有獨立產出
- 可隨時中斷並保留成果

### 風險 2: 批次處理錯誤

**緩解**:

- 先在小範圍測試腳本
- 使用 Git 備份
- 人工審查關鍵文件

### 風險 3: 自動化機制失效

**緩解**:

- 充分測試 Git hooks
- CI/CD 有失敗通知
- 定期人工抽查

---

## 💡 關鍵成功因素

1. **系統化思維**: 不是修文件，是建系統
2. **自動化優先**: 工具鏈比單次產出更重要
3. **Agent 視角**: 設計給 AI 用，不只是人
4. **持續演進**: 建立機制，而非一次性工程
5. **實用主義**: 完成比完美更重要

---

## 🎬 開始執行

**準備工作**:

```bash
# 1. 建立工作分支
git checkout -b docs/full-modernization

# 2. 備份當前狀態
git tag -a docs-backup-20260910 -m "Before full modernization"

# 3. 確認工具準備
node --version  # >= 26
npm ci

# 4. 開始階段 1
node scripts/generate-wiki-index.mjs --full
```

**執行口號**:

> "一次做到位，建立世界級 AI-Agent 友善文件系統！"

---

**建立日期**: 2026-09-10  
**預計完成**: 2026-09-15  
**總時間**: 20-25 小時  
**負責人**: Hermes Agent + Han
