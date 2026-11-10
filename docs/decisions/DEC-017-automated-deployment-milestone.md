---
type: explanation
status: current
last_updated: 2026-10-23
last_verified: 2026-10-23
related_code:
  - src/modules/deployment/deploymentAgentClient.mjs
  - src/modules/deployment/deploymentAgentServer.mjs
  - src/modules/deployment/executor.mjs
  - src/api/routes/deployRoutes.mjs
  - webapp/src/components/common/DeploymentControl.vue
  - webapp/src/views/AccountView.vue
tags:
  - operations
  - deployment
  - automation
  - docker
  - unix-socket
  - telegram-mini-app
wiki_links:
  - [[Host Deployment Agent]]
  - [[Production Code Deployment]]
  - [[Operations]]
---

# DEC-017: 自動化開發與正式部署架構決策與里程碑

## 里程碑結論

InvestmentLineNotify 已完成一條可重複使用的自動化開發與部署流程：

```text
隔離 Terminal Docker
  → Host Deployment Agent Unix socket
  → 固定部署 API
  → job status polling
  → production commit / PM2 / health verification
```

此流程已於正式環境實際執行並驗證，不只是 repository 測試或 queued acknowledgement。

## 已驗證的執行邊界

### 1. 隔離 Terminal

Terminal 維持獨立 Docker sandbox，不直接取得 Host shell、Host PM2 或任意命令執行能力。Terminal 只需要：

- `/run/investnotify/deploy-agent.sock` 的 bind mount
- `investnotify-deploy` supplementary group GID `988`
- Unix socket 的讀寫權限

Terminal 不需要也不應掛載 Host `/var/run/docker.sock`。

### 2. Host Deployment Agent

Host Agent 以 systemd service 執行，透過 Unix socket 提供固定路由：

- `GET /status`
- `POST /sync-production-artifacts`
- `POST /deploy-production`
- `GET /deployments/:jobId`

Agent 不接受任意 shell command、command string、Host path 或 request body 中的執行控制參數。

### 3. API 與 Mini App

後端 `/api/deploy` 與 `/api/deploy/:jobId` 是受 Telegram initData 與管理員權限保護的窄代理。Mini App 的部署控制位於 `Account / 設定` 頁籤，不能放在主要市場 Dashboard。

前端流程：

1. 發送固定 `POST /api/deploy`。
2. 取得 `jobId`。
3. 輪詢唯讀 `GET /api/deploy/:jobId`。
4. 將 `queued`、`running`、`completed`、`skipped`、`failed` 映射為真實狀態。
5. 終止狀態或元件卸載時清除 polling timer。

## 正式環境驗證證據

2026-10-23 透過隔離 Terminal 實際呼叫 Host Agent：

```text
Agent status: {"service":"investnotify-deploy-agent","status":"ok"}
Job ID: 8dff8d59-775f-4cd9-a754-ce521cc935ce
Job status: completed
Exit code: 0
Production commit: be79cd5
verification.ok: true
```

同日完成 `/api/deploy` route 修正後，再次由 Docker Terminal 實際部署並完成驗證：

```text
Agent status: {"service":"investnotify-deploy-agent","status":"ok"}
Job ID: 3086d7b1-82b2-4e18-ae7a-3ed0d6da2939
Job status: completed
Exit code: 0
Production commit: e027369
verification.ok: true
```

本次故障排除確認：Terminal 若只 bind mount `/run/investnotify/deploy-agent.sock`，Host Agent 重啟後會保留舊 socket inode，造成 `Connection refused`。永久配置應掛載父目錄 `/run/investnotify:/run/investnotify`；若既有 container 已使用 file mount，需重建 Terminal container 才會取得新 mount。之後 Docker Terminal 可直接自動觸發部署，不需改以 Host shell 執行。

Production verification：

- `api-server`: `online`
- `bot-daemon`: `online`
- PM2 cwd: `/home/ubuntu/investnotify`
- `/health`: `status: ok`
- `error`: `null`

## 與資料快照的邊界

程式部署與 production `data/`／`logs/` snapshot 維持獨立：

- code deploy 不覆蓋 production data 或 logs
- artifact sync 不執行 Git reset、npm install、build 或 PM2 reload
- 需要證據快照時，先執行獨立的 `sync-production-artifacts`

## 未來重用規則

後續任何需要正式機自動化操作的功能，優先沿用這條邊界：

1. 在 repository 建立可測試的窄 API 或 job handler。
2. 由 Host Agent 執行需要 Host 權限的固定操作。
3. 透過 Unix socket 連接，不開公開管理 port。
4. 以唯讀 job status 查詢實際結果。
5. 只有完成 commit、服務狀態與 health verification 後，才能宣稱正式操作成功。

禁止為新功能新增第二套任意 command executor、公開部署 port 或繞過 Telegram 管理員授權的路徑。
