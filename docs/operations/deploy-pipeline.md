---
type: reference
status: current
last_updated: 2026-11-11
last_verified: 2026-11-11
related_code:
  - scripts/deploy.mjs
  - scripts/deploy-local.mjs
  - scripts/deploy-production.mjs
  - scripts/deployment-agent.mjs
  - src/modules/deployment/executor.mjs
  - src/modules/deployment/deploymentVerification.mjs
  - src/modules/deployment/deploymentAgentServer.mjs
tags:
  - operations
  - deployment
  - pipeline
wiki_links:
  - docs/operations/deployment-agent.md
  - docs/operations/production-code-deploy.md
  - docs/meta/scripts-inventory.md
---

# 部署管線說明 (Deploy Pipeline)

本文件說明 `scripts/` 下 4 個部署腳本的職責、執行順序、參數與失敗處理流程。

## 腳本職責與分工

| 腳本                    | 職責                                                                                   | 執行層級  | 對應 docs                                   |
| ----------------------- | -------------------------------------------------------------------------------------- | --------- | ------------------------------------------- |
| `deploy-local.mjs`      | 本地開發環境部署，直接呼叫 `deploymentExecutor`，支援 `--rollback` 與 `--tag`          | 本地開發  | —                                           |
| `deploy.mjs`            | 主部署流程，執行 pre-deploy 驗證後透過 SSH 部署到 VM，支援 `--dry-run` 與 `--skip-pre` | 本地/預備 | —                                           |
| `deploy-production.mjs` | 正式環境部署，透過 Unix socket 向 Host Deployment Agent 建立部署任務並等待完成         | 生產      | `docs/operations/production-code-deploy.md` |
| `deployment-agent.mjs`  | Host 部署代理服務，監聽 Unix socket，處理 sync/deploy/getJobStatus 三種受限操作        | 生產 Host | `docs/operations/deployment-agent.md`       |

## 執行順序

### 本地開發部署流程

```text
deploy-local.mjs
  └── 檢查部署路徑存在
  └── 呼叫 deploymentExecutor.createDeployJob({ rollback, rollbackTarget })
  └── deploymentExecutor 執行：
      1. 取得部署鎖 (executorLock)
      2. 拉取並切換 Git 程式碼
      3. 安裝後端與前端依賴
      4. 建置前端
      5. reload PM2
      6. 驗證部署 commit、PM2 程序、cwd 與 /health
      7. 保存 job 狀態與 verification 摘要
      8. 失敗時釋放鎖並回傳失敗狀態
```

### 生產環境部署流程

```text
1. deploy-production.mjs
   └── 解析參數 (--deploy-path, --webapp-path, --pm2-ecosystem, --rollback, --tag)
   └── 檢查路徑存在
   └── 呼叫 deploymentExecutor.createDeployJob() 建立部署任務
   └── waitForCompletion(jobId) 輪詢直到 completed/failed/cancelled
   └── 回傳 job 狀態 (包含 verification.ok)

2. deployment-agent.mjs (作為 Host 服務長駐)
   └── 監聽 Unix socket /run/investnotify/deploy-agent.sock
   └── 接收 deploy-production 請求，委派給 deploymentExecutor
   └── 接收 sync-production-artifacts 請求，同步 data/logs 到診斷目錄
   └── 接收 deployments/:jobId 唯讀狀態查詢
```

### 典型部署時序

| 步驟 | 腳本/命令                                   | 說明                                       |
| ---- | ------------------------------------------- | ------------------------------------------ |
| 1    | `npm run deploy:dry`                        | 僅執行 pre-deploy 驗證，不實際部署         |
| 2    | `npm run deploy`                            | 執行完整部署 (pre-deploy + SSH 部署到 VM)  |
| 3    | `npm run deploy:production`                 | 正式環境：透過 Unix socket 建立部署任務    |
| 4    | `curl --unix-socket .../deployments/:jobId` | 查詢部署狀態，確認 `verification.ok: true` |

## 參數與環境變數

### deploy.mjs

| 參數         | 說明                                      | 預設值 |
| ------------ | ----------------------------------------- | ------ |
| `--dry-run`  | 僅執行 pre-deploy 驗證，不部署            | false  |
| `--skip-pre` | 跳過 pre-deploy 驗證，直接部署 (緊急時用) | false  |

| 環境變數        | 說明                      | 預設值                  |
| --------------- | ------------------------- | ----------------------- |
| `VM_HOST`       | SSH 連線目標 (user@vm-ip) | user@your-vm-ip         |
| `VM_PATH`       | VM 上的部署路徑           | ~/investnotify          |
| `DEPLOY_DOMAIN` | 健康檢查用域名            | your-domain.duckdns.org |
| `VM_SSH_KEY`    | SSH 私鑰路徑              | (空)                    |

### deploy-local.mjs

| 參數                | 說明             |
| ------------------- | ---------------- |
| `--rollback` / `-r` | 執行回滾         |
| `--tag` / `-t`      | 指定回滾標籤名稱 |

| 環境變數        | 說明             | 預設值              |
| --------------- | ---------------- | ------------------- |
| `DEPLOY_PATH`   | 部署路徑         | PROJECT_ROOT        |
| `PM2_ECOSYSTEM` | PM2 生態系統檔案 | ecosystem.config.js |
| `WEBAPP_PATH`   | 前端應用路徑     | PROJECT_ROOT/webapp |

### deploy-production.mjs

| 參數              | 說明             |
| ----------------- | ---------------- |
| `--deploy-path`   | 正式環境部署路徑 |
| `--webapp-path`   | 前端應用路徑     |
| `--pm2-ecosystem` | PM2 生態系統檔案 |
| `--rollback`      | 執行回滾         |
| `--tag`           | 指定回滾標籤     |

### deployment-agent.mjs

無 CLI 參數，透過 Unix socket 接收請求。設定透過 `deploymentAgentConfig.mjs` 讀取環境變數與設定檔。

## 失敗處理流程

| 失敗階段            | 處理方式                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------- |
| pre-deploy 驗證失敗 | `deploy.mjs` 終止，不繼續部署；需修正後重新執行                                           |
| 部署鎖衝突          | 新任務標記為 `failed`，附上衝突 jobId；需等待既有部署完成                                 |
| Git 拉取失敗        | 任務標記為 `failed`，釋放部署鎖                                                           |
| 依賴安裝/建置失敗   | 任務標記為 `failed`，釋放部署鎖                                                           |
| PM2 reload 失敗     | 任務標記為 `failed`，需手動檢查 PM2 程序狀態                                              |
| /health 檢查失敗    | 執行有限重試；重試耗盡後標記為 `failed`，不自動回滾                                       |
| 生產部署 job 失敗   | 查詢 `GET /deployments/:jobId` 確認 error 與 verification 詳情；需手動回滾 (`--rollback`) |

## 驗證門檻

只有以下全部條件成立時，部署才視為成功：

- `status: completed`
- `exitCode: 0`
- `error: null`
- `verification.ok: true`
- `verification.commit` 符合預期
- `api-server` 與 `bot-daemon` 均為 `online`
- PM2 cwd 為正式專案目錄
- `/health` 回傳 `status: ok`

若 production HEAD 與 `origin/main` 相同，結果為 `skipped`，附上 `skipReason: already-up-to-date`；不會執行重複 reload。

---

_產出：Phase 9-C 部署管線說明_
_建立：2026-11-11 | 負責人：Han_
