---
type: reference
status: current
last_updated: 2026-10-22
tags:
  - operations
  - deployment
  - systemd
  - unix-socket
wiki_links: []
---

# Host Deployment Agent

## Purpose

Host Deployment Agent 讓 Docker、CLI 或後續 Bot 透過 Unix socket 請求兩個受限操作：

- `sync-production-artifacts`
- `deploy-production`

它不開公開 HTTP port，也不接受任意 shell command。

## Installation on production host

以下指令必須由管理者在正式 Host 手動執行；repository 測試不會代替正式安裝：

```bash
sudo groupadd --system investnotify-deploy || true
sudo usermod -aG investnotify-deploy ubuntu
sudo install -d -o ubuntu -g investnotify-deploy -m 0770 /home/ubuntu/investnotify-diagnostics
sudo install -d -o root -g investnotify-deploy -m 0770 /etc/investnotify
sudo install -o root -g root -m 0644 \
  deploy/systemd/investnotify-deploy-agent.service \
  /etc/systemd/system/investnotify-deploy-agent.service
sudo systemctl daemon-reload
sudo systemctl enable --now investnotify-deploy-agent
```

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

目前 API 回傳部署 job 建立結果；部署狀態應使用既有 job state 查詢機制。後續若要由 Docker 顯示完整進度，需新增唯讀 status endpoint，不應讓 Docker 直接執行 PM2。

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
