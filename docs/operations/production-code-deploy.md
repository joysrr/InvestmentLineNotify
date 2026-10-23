---
type: reference
status: current
last_updated: 2026-10-23
last_verified: 2026-10-23
related_code:
  - src/modules/deployment/executor.mjs
  - src/modules/deployment/deploymentVerification.mjs
  - scripts/deploy-production.mjs
tags:
  - operations
  - production
  - deployment
  - pm2
wiki_links: []
---

# Production Code Deployment

## Purpose

此流程只部署程式碼與前端 build 產物。它不會複製、匯入或覆蓋正式環境的 `data/` 與 `logs/`。

正式資料／日誌的復現快照請使用 [`production-artifact-sync.md`](./production-artifact-sync.md)。兩者必須分開執行。

## Command

在正式主機的專案目錄執行：

```bash
npm run deploy:production -- \
  --deploy-path /home/ubuntu/investnotify \
  --webapp-path /home/ubuntu/investnotify/webapp \
  --pm2-ecosystem ecosystem.config.cjs
```

回滾到最近一次部署標籤：

```bash
npm run deploy:production -- \
  --deploy-path /home/ubuntu/investnotify \
  --webapp-path /home/ubuntu/investnotify/webapp \
  --pm2-ecosystem ecosystem.config.cjs \
  --rollback
```

回滾到指定標籤：

```bash
npm run deploy:production -- \
  --deploy-path /home/ubuntu/investnotify \
  --webapp-path /home/ubuntu/investnotify/webapp \
  --pm2-ecosystem ecosystem.config.cjs \
  --rollback --tag deploy-example
```

## Execution boundary

CLI 只負責解析參數、檢查路徑並委派既有 `deploymentExecutor`。executor 負責：

1. 取得部署鎖。
2. 拉取並切換 Git 程式碼。
3. 安裝後端與前端依賴。
4. 建置前端。
5. reload PM2。
6. 驗證部署 commit、PM2 程序／cwd 與 `/health`；health check 具有有限啟動重試。
7. 保存 job 狀態、部署日誌與 `verification` 摘要。
8. 失敗時釋放鎖並回傳失敗狀態。

## Separation rule

`deploy-production` 不接受以下參數：

- `--data-dir`
- `--logs-dir`
- `--output-dir`

這些是診斷快照流程的參數。部署時若需要同步正式證據，必須先另行執行 `sync:production-artifacts`，再執行部署；兩次操作的 snapshot 與 job 狀態分開保存。

## Automated trigger and verification

目前正式流程由隔離 Docker Terminal 透過 Host Deployment Agent 的 Unix socket 觸發。Terminal container 只掛載 `/run/investnotify/deploy-agent.sock`，並加入 `investnotify-deploy` supplementary group GID `988`；不掛載 Host Docker socket。

觸發回應 `{ jobId, status: "queued" }` 只是 acknowledgement，不代表成功。必須使用唯讀 job status 查詢，直到狀態為 `completed`、`skipped` 或 `failed`。

只有以下條件成立時才能宣稱完成：

- `status: completed`
- `exitCode: 0`
- `error: null`
- `verification.ok: true`
- verification commit 符合預期
- `api-server` 與 `bot-daemon` 為 `online`
- PM2 cwd 為正式專案目錄
- `/health` 回傳 `status: ok`

若 production HEAD 已與 `origin/main` 相同，結果應為 `skipped` 並帶有 `skipReason: already-up-to-date`；這代表沒有重複 reload，不應誤報成新的 deployment。

正式環境實際驗證紀錄（2026-10-23）：job `8dff8d59-775f-4cd9-a754-ce521cc935ce` 完成，commit `be79cd5`，`verification.ok: true`，兩個 PM2 程序 online，health status 為 `ok`。
