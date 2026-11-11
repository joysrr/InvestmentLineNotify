---
type: reference
status: current
last_updated: 2026-10-23
last_verified: 2026-10-23
related_code:
  - src/modules/deployment/deploymentAgentServer.mjs
  - src/modules/deployment/executor.mjs
  - scripts/deployment-agent.mjs
tags:
  - operations
  - deployment
  - systemd
  - unix-socket
wiki_links: []
---

# Host Deployment Agent

## Purpose

Host Deployment Agent 讓 Docker、CLI 或後續 Bot 透過 Unix socket 請求三個受限操作：

- `sync-production-artifacts`
- `deploy-production`
- `deployments/:jobId`（唯讀狀態查詢）

它不開公開 HTTP port，也不接受任意 shell command。

## Installation on production host

以下步驟必須由管理者在正式 Host 手動執行；repository 測試不會代替正式安裝。

先定義已在 Host 確認過的專案路徑：

```bash
PROJECT_ROOT="__VERIFIED_PROJECT_ROOT__"
DIAGNOSTICS_DIR="__VERIFIED_EXTERNAL_DIAGNOSTICS_DIR__"
```

`PROJECT_ROOT`、`DIAGNOSTICS_DIR` 必須替換成該 Host 的真實路徑；不可直接使用 placeholder。

建立專用群組與診斷目錄：

```bash
sudo groupadd --system investnotify-deploy || true
sudo usermod -aG investnotify-deploy ubuntu
sudo install -d -o ubuntu -g investnotify-deploy -m 0770 "$DIAGNOSTICS_DIR"
sudo install -d -o root -g investnotify-deploy -m 0770 /etc/investnotify
```

建立 Host 專用設定檔：

```bash
sudo install -o root -g investnotify-deploy -m 0640 \
  "$PROJECT_ROOT/deploy/systemd/deploy-agent.env.example" \
  /etc/investnotify/deploy-agent.env
sudo editor /etc/investnotify/deploy-agent.env
```

請將所有 `__VERIFIED_*__` placeholder 替換完成。設定檔只放路徑與非敏感設定，不要放 token、密碼或 API key。

安裝 systemd template 前，先把 `__PROJECT_ROOT__` 替換成同一個已確認的專案路徑：

```bash
sed "s|__PROJECT_ROOT__|$PROJECT_ROOT|g" \
  "$PROJECT_ROOT/deploy/systemd/investnotify-deploy-agent.service" \
  | sudo tee /etc/systemd/system/investnotify-deploy-agent.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now investnotify-deploy-agent
```

啟動前必須確認 unit 內沒有殘留 `__PROJECT_ROOT__`。
確認 service：

```bash
sudo systemctl status investnotify-deploy --no-pager
sudo journalctl -u investnotify-deploy -n 100 --no-pager
stat -c '%A %U %G %n' /run/investnotify/deploy-agent.sock
```

預期 socket group 為 `investnotify-deploy`，不可使用 `chmod 777`。

## API contract

Unix socket：

```text
/run/investnotify/deploy-agent.sock
```

健康狀態：

```bash
curl --unix-socket /run/investnotify/deploy-agent.sock \
  http://localhost/status
```

只同步診斷資料：

```bash
curl --unix-socket /run/investnotify/deploy-agent.sock \
  -X POST http://localhost/sync-production-artifacts \
  -H 'content-type: application/json' \
  -d '{"dryRun":true}'
```

只建立程式部署任務：

```bash
curl --unix-socket /run/investnotify/deploy-agent.sock \
  -X POST http://localhost/deploy-production \
  -H 'content-type: application/json' \
  -d '{"rollback":false}'
```

部署 API 只回傳建立任務的確認，不代表部署成功：

```json
{ "jobId": "...", "status": "queued" }
```

使用 job ID 查詢實際狀態：

```bash
JOB_ID="your-job-id"
curl --fail-with-body \
  --unix-socket /run/investnotify/deploy-agent.sock \
  "http://localhost/deployments/$JOB_ID" \
  | jq '{jobId,status,completedAt,exitCode,error,verification}'
```

若遠端 `origin/main` 與正式機目前 `HEAD` 相同，job 會是 `skipped`，並附上 `skipReason: already-up-to-date`；此時不會執行 reset、依賴安裝、build 或 PM2 reload。

若版本不同，成功時 `status` 必須是 `completed`，且 `verification.ok` 必須是 `true`。驗證內容包括：

- 實際部署 commit
- `api-server`、`bot-daemon` 都是 `online`
- PM2 工作目錄符合正式專案路徑
- `/health` 回傳 `status: ok`

Agent 會在 PM2 reload 後對 `/health` 進行有限重試，以等待服務完成啟動；重試後仍失敗會將 job 標記為 `failed`。

## Isolated Terminal integration

若由隔離 Docker Terminal 觸發 Agent，必須同時滿足：

- **掛載父目錄** `/run/investnotify:/run/investnotify`，不要只掛載單一 socket 檔案
- 將 Terminal container 加入 `investnotify-deploy` supplementary group GID `988`
- 保持 Terminal container 不掛載 Host `/var/run/docker.sock`

只掛載 `/run/investnotify/deploy-agent.sock` 會固定住建立當下的 Unix socket inode。Host Agent 重啟後會重新建立 socket；此時 container 內檔案仍存在但會得到 `Connection refused`。掛載父目錄後，container 會透過相同路徑看到新 inode。若已使用舊的 file mount，必須重建 Terminal container（`up -d --force-recreate`），單純重啟 Host service 不會更新該 mount。

驗證 Terminal 實際連線：

```bash
curl --fail-with-body --silent --show-error \
  --unix-socket /run/investnotify/deploy-agent.sock \
  http://localhost/status
```

成功只代表 Agent 可達；部署仍必須等待 `GET /deployments/:jobId` 的 terminal status，並確認 `verification.ok: true`。

## Security boundary

- 不提供 `/exec`、shell、命令字串或任意路徑操作。
- 正式路徑由 systemd environment 固定設定。
- `data`／`logs` 同步仍不會進入 code deploy。
- socket 僅限專用 Unix group。
- 不掛載 Docker socket、不使用 host PID namespace、不授予 container root。

## Rollback / disable

停用 service：

```bash
sudo systemctl disable --now investnotify-deploy
```

移除 service：

```bash
sudo rm /etc/systemd/system/investnotify-deploy-agent.service
sudo systemctl daemon-reload
```

停用不會刪除既有診斷快照，也不會回滾任何程式或資料。

## Executor 內部機制

### 部署鎖（DEPLOY_LOCK_TTL_MS）

`src/modules/deployment/executor.mjs` 使用檔案鎖防止並發部署：

| 設定       | 值                                                                       |
| ---------- | ------------------------------------------------------------------------ |
| Lock TTL   | 15 分鐘（`DEPLOY_LOCK_TTL_MS = 15 * 60 * 1000`）                         |
| 存活性檢查 | `isProcessAlive(pid)` 以 `process.kill(pid, 0)` 確認鎖持有者進程是否存在 |
| Lock 路徑  | `data/deployments/.lock`（相對於 `DEPLOY_PROJECT_ROOT`）                 |
| 衝突處理   | 若存在有效 lock → 新部署任務標記為 `failed`，附上衝突 jobId              |

> 注意：此 Lock 為本機檔案鎖，不跨機器（與 Bot 層的 `runnerLock.mjs` 設計相同）。

### 版本門檻（deploymentVersionGate.mjs）

```
本機 HEAD == origin/main HEAD
  → skip: true, skipReason: "already-up-to-date"（不執行任何操作）

本機 HEAD != origin/main HEAD
  → 繼續執行完整部署流程
```

**實作邏輯**：

```js
buildVersionCheckCommands(); // 取得 git rev-parse HEAD / origin/main 的指令
shouldSkipDeployment(localCommit, remoteCommit);
// localCommit === remoteCommit → { skip: true, reason: "already-up-to-date" }
// 否則 → { skip: false, commit: remoteCommit }
```

### 部署後驗證（deploymentVerification.mjs）

部署完成後，Executor 執行三項驗證（全部通過才標記 `completed`）：

| 驗證項目    | 說明                                                             |
| ----------- | ---------------------------------------------------------------- |
| `commit`    | 確認正式機 HEAD 已更新至目標 commit                              |
| `health.ok` | `/health` 回傳 `{ status: "ok" }`                                |
| `pm2.ok`    | `api-server` + `bot-daemon` 均為 `online`，且 `cwd` 符合正式路徑 |

```
verification.ok = health.ok && pm2.ok && Boolean(commit)
```

PM2 reload 後執行有限重試等待服務啟動；重試耗盡後標記 `failed`，不自動回滾（需手動 `git reset`）。
