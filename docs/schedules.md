# 排程總覽 / Schedule Overview

> **最後更新：2026-04-12**
> 本文件集中記錄所有排程的觸發方式、執行位置、時間設定與設計說明。

---

## 設計原則

| 執行平台 | 適合任務類型 | 時間準確性 |
|---|---|---|
| **Oracle VM crontab** | 時間敏感、需準時觸發的任務 | ✅ 準時（秒級精度） |
| **GitHub Actions schedule** | 可容忍 15~30 分鐘延遲的任務 | ⚠️ 延遲 15~60 分鐘（平台排隊） |
| **VM PM2 長駐** | 需即時回應的常駐服務 | ✅ 持續運行 |

> GitHub Actions 的 `schedule` cron 為平台共享資源，繁忙時段延遲 15~60 分鐘屬正常現象。
> 盤前報告（07:30）與收盤後總結（13:45）為時間敏感任務，已移轉至 VM crontab 執行。

---

## 排程總表

### Oracle VM crontab（`crontab -e`，TZ=Asia/Taipei）

| 台灣時間 | Cron 表達式 | 執行腳本 | 用途 | 時間敏感度 |
|---|---|---|---|---|
| 07:30 每日 | `30 7 * * *` | `scripts/vm-daily-check.sh` | 🔴 盤前完整報告（09:00 開盤前） | 高 |
| 13:45 每日 | `45 13 * * *` | `scripts/vm-daily-check.sh` | 🟡 收盤後總結（13:30 收盤後 15 分） | 中 |
| 每 5 分鐘 | `*/5 * * * *` | `curl duckdns update` | DuckDNS IP 自動更新（防 Oracle IP 漂移） | 低 |

**VM crontab 完整設定：**
```cron
SHELL=/bin/bash
TZ=Asia/Taipei

# 盤前報告
30 7 * * * /bin/bash /home/ubuntu/investnotify/scripts/vm-daily-check.sh

# 收盤後總結
45 13 * * * /bin/bash /home/ubuntu/investnotify/scripts/vm-daily-check.sh

# DuckDNS IP 更新
*/5 * * * * curl -s "https://www.duckdns.org/update?domains=investnotify&token=YOUR_TOKEN&ip=" > /dev/null
```

---

### GitHub Actions（`.github/workflows/`）

| Workflow 檔案 | 台灣時間 | UTC Cron | 用途 | 時間敏感度 |
|---|---|---|---|---|
| `line_notify.yml` | 10:30 每日 | `30 2 * * *` | 盤中觀測 | 低 |
| `line_notify.yml` | 12:00 每日 | `0 4 * * *` | 午盤回報 | 低 |
| `line_notify.yml` | 21:30 每日 | `30 13 * * *` | 夜間美股開盤觀測 | 低 |
| `news-fetch.yml` | 每 4 小時 | `0 */4 * * *` | 新聞池更新 | 低 |
| `optimizer.yml` | 02:00 每日 | `0 18 * * *` | Rule Optimizer | 低 |
| `weekly-report.yml` | 週一 09:30 | `30 1 * * 1` | AI 週報生成 | 低 |
| `monthly-report.yml` | 每月 1 日 09:30 | `30 1 1 * *` | AI 月報生成 | 低 |

> ⚠️ `line_notify.yml` 的 07:30（盤前）與 13:45（收盤後）排程已**移除**，改由 VM crontab 執行。

---

### Oracle VM PM2 長駐程序

| 程序名稱 | 執行腳本 | 用途 | 重啟策略 |
|---|---|---|---|
| `api-server` | `src/api/server.mjs` | Fastify HTTP API（Port 3000），供 Mini App 呼叫 | 記憶體超過 300MB 自動重啟 |
| `bot-daemon` | `src/bot.mjs` | Telegram Bot Long-Polling，處理即時指令 | 記憶體超過 200MB 自動重啟 |

```bash
# 查看服務狀態
pm2 list
pm2 monit
```

---

## data/ 同步機制

```
┌─────────────────────────────────────────────────────────────┐
│  VM crontab 執行路徑                                         │
│                                                             │
│  scripts/vm-daily-check.sh                                  │
│    1. git fetch & reset --hard origin/main  ← 先拉最新      │
│    2. node src/runDailyCheck.mjs            ← 執行          │
│    3. git add data/ && git commit && push   ← 寫回 GitHub   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  GitHub Actions 執行路徑                                     │
│                                                             │
│  line_notify.yml（盤中 / 午盤 / 夜間）                       │
│    1. node src/runDailyCheck.mjs            ← 執行          │
│    2. git-auto-commit-action                ← 寫回 GitHub   │
│    3. SSH → VM: git reset --hard origin/main ← VM 同步      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**衝突防護：**
- VM crontab 腳本內建 `lockfile`（`/tmp/investnotify-daily.lock`），防止並發執行
- VM 端的 `git reset --hard` 優先以 GitHub 為 source of truth
- Actions 端的 SSH sync 步驟設有 `continue-on-error: true`，不阻塞主流程

---

## VM 排程腳本說明

### `scripts/vm-daily-check.sh`

| 項目 | 說明 |
|---|---|
| 位置 | `/home/ubuntu/investnotify/scripts/vm-daily-check.sh` |
| Log 輸出 | `logs/vm-cron.log` |
| Lock 檔案 | `/tmp/investnotify-daily.lock`（執行結束自動清除） |
| 執行步驟 | git pull → runDailyCheck → git commit/push |

```bash
# 手動測試執行
bash /home/ubuntu/investnotify/scripts/vm-daily-check.sh

# 查看 log
tail -f /home/ubuntu/investnotify/logs/vm-cron.log

# 確認 crontab 設定
crontab -l
```

---

## 台灣股市時程參考

| 時間 | 事件 |
|---|---|
| 08:30 | 盤前試算開始 |
| 09:00 | 正式開盤 |
| 13:30 | 收盤 |
| 15:00 前 | 三大法人籌碼公布 |
| 21:30 | 美股開盤（EST 夏令時） |
| 22:30 | 美股開盤（EST 冬令時） |

---

## 維護備忘

- crontab 時區設定：`TZ=Asia/Taipei`（直接用台灣時間，不需換算 UTC）
- GitHub Actions 的 cron 時區固定為 **UTC**，需手動換算（台灣 = UTC+8）
- DuckDNS token 請勿 commit 至 repo，僅設定於 VM crontab
- `logs/vm-cron.log` 建議定期清理，或設定 logrotate
