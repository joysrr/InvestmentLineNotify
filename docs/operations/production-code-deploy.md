---
type: reference
status: current
last_updated: 2026-10-22
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
6. 保存 job 狀態與部署日誌。
7. 失敗時釋放鎖並回傳失敗狀態。

## Separation rule

`deploy-production` 不接受以下參數：

- `--data-dir`
- `--logs-dir`
- `--output-dir`

這些是診斷快照流程的參數。部署時若需要同步正式證據，必須先另行執行 `sync:production-artifacts`，再執行部署；兩次操作的 snapshot 與 job 狀態分開保存。

## Current limitation

目前 CLI 已完成 Host-side 執行入口，但尚未建立 systemd／Unix socket service。Docker、Telegram 或其他外部觸發器仍不能直接控制 Host PM2；下一階段再建立受限的 Host service。
