---
type: reference
title: "Scripts 目錄腳本清單 (Scripts Inventory)"
category: "meta"
status: "current"
created: "2026-11-11"
last_updated: "2026-11-11"
tags:
  - scripts
  - inventory
  - automation
  - docs-governance
wiki_links:
  - docs/README.md
  - docs/meta/documentation-standards.md
  - docs/meta/maintenance-schedule.md
---

# Scripts 目錄腳本清單 (Scripts Inventory)

`scripts/` 目錄下所有 `.mjs` 腳本的用途、使用方式與產出物。

> **SSOT 聲明**：本專案全面採用 Node.js 原生 ESM（`.mjs`），scripts/ 下不應存在 `.py` 腳本。

---

## 📋 目錄

1. [文件治理](#文件治理)
2. [API 規格](#api-規格)
3. [驗證腳本](#驗證腳本)
4. [資料生成](#資料生成)
5. [部署腳本](#部署腳本)
6. [資料維護](#資料維護)

---

## 文件治理

### `add-frontmatter.mjs`

- **用途**：自動為 `docs/` 下的 `.md` 檔案添加 YAML frontmatter
- **使用方式**：`node scripts/add-frontmatter.mjs <file>`
- **產出物**：修改目標 `.md` 檔案的 frontmatter

### `analyze-docs-health.mjs`

- **用途**：分析 `docs/` 健康度（frontmatter 完整性、連結有效性、內容深度）
- **使用方式**：`node scripts/analyze-docs-health.mjs`
- **產出物**：`docs/meta/health-report.json`（本地生成物，不 commit）
- **基準**：Phase 7 結束時平均分數 59.8/100

### `generate-concept-graph.mjs`

- **用途**：從 `docs/` 生成概念關係圖
- **使用方式**：`node scripts/generate-concept-graph.mjs`
- **產出物**：`docs/meta/concept-graph.mmd`（本地生成物，不 commit）

### `generate-wiki-index.mjs`

- **用途**：掃描 `docs/` 生成 LLM 離線知識庫索引
- **使用方式**：`node scripts/generate-wiki-index.mjs`
- **產出物**：`docs/wiki-index.json`, `docs/wiki-graph.json`（需 commit）

### `pre-commit-docs-check.mjs`

- **用途**：pre-commit hook，檢查已 staged 的 `.md` 文件是否有合法 frontmatter
- **使用方式**：由 lint-staged 自動呼叫（`node scripts/pre-commit-docs-check.mjs`）
- **產出物**：無（exit 0 = 通過，exit 1 = 有缺少 frontmatter 的文件）

### `validate-docs-consistency.mjs` ⭐ Phase 7 新增

- **用途**：5 項內部文件一致性檢查（導航連結、frontmatter、DEC 密度、計畫書日期前綴、模組狀態）
- **使用方式**：`node scripts/validate-docs-consistency.mjs`
- **產出物**：無（輸出至 stdout）

### `validate-docs-code-consistency.mjs` ⭐ Phase 7 新增

- **用途**：2 項文件與程式碼對齊檢查（VIX 門檻、ceiling 條件）
- **使用方式**：`node scripts/validate-docs-code-consistency.mjs`
- **產出物**：無（輸出至 stdout，exit 1 = 不一致）

### `validate-wiki-index.mjs`

- **用途**：驗證 `docs/wiki-index.json` 的完整性與連結正確性
- **使用方式**：`node scripts/validate-wiki-index.mjs`
- **產出物**：無

---

## API 規格

### `generate-openapi.mjs`

- **用途**：從程式碼自動生成 OpenAPI 規格文件
- **使用方式**：`node scripts/generate-openapi.mjs`
- **產出物**：`docs/api/openapi.json`

### `check-openapi-diff.mjs`

- **用途**：比對 OpenAPI 規格是否有差異（CI 用）
- **使用方式**：`node scripts/check-openapi-diff.mjs`
- **產出物**：無

---

## 驗證腳本

### `verify-api-inventory.mjs`

- **用途**：驗證前端 ENDPOINTS 映射是否與後端路由一致
- **使用方式**：`node scripts/verify-api-inventory.mjs`
- **產出物**：`scripts/__endpoint_usage_report.md`（生成物，`.gitignore`）

### `verify-data-endpoint.mjs`

- **用途**：驗證 API 端點的資料與本地檔案是否一致
- **使用方式**：`node scripts/verify-data-endpoint.mjs`
- **產出物**：`scripts/__data_verification_report.md`（生成物，`.gitignore`）

### `verify-endpoint-usage.mjs`

- **用途**：分析前端對 API 端點的使用情況
- **使用方式**：`node scripts/verify-endpoint-usage.mjs`
- **產出物**：無（輸出至 stdout）

### `verify-leading-indicators.mjs`

- **用途**：驗證領先指標計算邏輯的正確性
- **使用方式**：`node scripts/verify-leading-indicators.mjs`
- **產出物**：無

### `verify-report.mjs`

- **用途**：驗證生成報告的完整性
- **使用方式**：`node scripts/verify-report.mjs`
- **產出物**：無

### `verify-theoretical-integration.mjs`

- **用途**：驗證理論整合計算的正確性
- **使用方式**：`node scripts/verify-theoretical-integration.mjs`
- **產出物**：無

### `dryrun-core.mjs`

- **用途**：執行核心策略邏輯的 Dry Run（不寫入資料）
- **使用方式**：`node scripts/dryrun-core.mjs`
- **產出物**：無

---

## 資料生成

### `generate-data-evidence-report.mjs`

- **用途**：生成資料佐證報告（data-evidence.json 的完整性報告）
- **使用方式**：`node scripts/generate-data-evidence-report.mjs`
- **產出物**：報告輸出至 stdout

---

## 部署腳本

### `deploy.mjs`

- **用途**：主部署腳本（執行 pre-deploy 驗證後透過 SSH 部署到 VM）
- **使用方式**：`node scripts/deploy.mjs` 或 `npm run deploy`
- **產出物**：部署日誌
- **參數**：`--dry-run` 僅驗證不部署、`--skip-pre` 跳過 pre-deploy
- **環境變數**：`VM_HOST`、`VM_PATH`、`DEPLOY_DOMAIN`、`VM_SSH_KEY`
- **相關文件**：`docs/operations/deploy-pipeline.md`

### `deploy-local.mjs`

- **用途**：本地開發環境部署，直接呼叫 `deploymentExecutor`
- **使用方式**：`node scripts/deploy-local.mjs [--rollback] [--tag TAG]`
- **產出物**：無
- **參數**：`--rollback` 執行回滾、`--tag` 指定回滾標籤
- **環境變數**：`DEPLOY_PATH`、`PM2_ECOSYSTEM`、`WEBAPP_PATH`
- **相關文件**：`docs/operations/deploy-pipeline.md`

### `deploy-production.mjs`

- **用途**：正式環境部署，透過 Unix socket 向 Host Deployment Agent 建立任務
- **使用方式**：`node scripts/deploy-production.mjs` 或 `npm run deploy:production`
- **產出物**：部署任務狀態 (jobId, status, verification)
- **參數**：`--deploy-path`、`--webapp-path`、`--pm2-ecosystem`、`--rollback`、`--tag`
- **相關文件**：`docs/operations/deploy-pipeline.md`、`docs/operations/production-code-deploy.md`

### `deployment-agent.mjs`

- **用途**：Host 部署代理服務，監聽 Unix socket 處理 sync/deploy/getJobStatus
- **使用方式**：`node scripts/deployment-agent.mjs` 或 `npm run deployment:agent`
- **產出物**：無（長駐服務）
- **相關文件**：`docs/operations/deploy-pipeline.md`、`docs/operations/deployment-agent.md`

### `trigger-production-deploy.mjs`

- **用途**：觸發正式環境部署（透過 Unix socket 通訊）
- **使用方式**：`node scripts/trigger-production-deploy.mjs`
- **產出物**：無

### `sync-production-artifacts.mjs`

- **用途**：同步正式環境資料產出物到 GitHub
- **使用方式**：`node scripts/sync-production-artifacts.mjs`
- **產出物**：Git commit

---

## 資料維護

### `backfill_stock_history.mjs`

- **用途**：補填股價歷史資料
- **使用方式**：`node scripts/backfill_stock_history.mjs`
- **產出物**：寫入 `data/` 目錄下的歷史資料檔案

### `fetch-longterm-data.mjs`

- **用途**：抓取長期歷史資料（>1 年）
- **使用方式**：`node scripts/fetch-longterm-data.mjs`
- **產出物**：寫入 `data/` 目錄

### `validate-phase-completion.mjs`

- **用途**：驗證 Phase 完成狀態（git status、本地/遠端 HEAD SHA、關鍵檔案存在性）
- **使用方式**：`node scripts/validate-phase-completion.mjs --phase "Phase 10" --files "docs/a.md,docs/b.md"`
- **產出物**：驗證摘要（通過/失敗），退出碼 0/1
- **無網路 fallback**：若無法連線 GitHub API，自動使用本地 `git rev-parse origin/main` 比對，輸出 `⚠️ 本地驗證通過（未能連線 GitHub API）`，退出碼仍為 0
- **對應 npm 指令**：`npm run verify-phase`

---

## 生成物 `.gitignore` 規則

以下模式已加入 `.gitignore`，不應 commit：

```
scripts/__*.md   # 驗證腳本產出的臨時報告
docs/meta/health-report.json
docs/meta/graph-analysis.json
docs/meta/concept-graph.mmd
```

---

> 本清單最後更新於 2026-11-11，對應 `scripts/` 目錄下所有 `.mjs` 腳本（共 28 個）。
> 腳本清單以 `ls scripts/*.mjs` 為 SSOT；本文件僅補充說明，不替代腳本本身的 JSDoc 注釋。
