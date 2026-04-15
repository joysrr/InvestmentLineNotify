# 排程總覽 / Schedule Overview

> **最後更新：2026-04-15**
> 本文件集中記錄所有排程的觸發方式、執行位置、時間設定與設計說明。

---

## 設計原則

| 執行平台 | 適合任務類型 | 時間準確性 |
|---|---|---|
| **Oracle VM crontab** | 所有定時排程任務 | ✅ 準時（秒級精度） |
| **VM PM2 長駐** | 需即時回應的常駐服務 | ✅ 持續運行 |
| **GitHub Actions（手動觸發）** | 緊急補跑、除錯用途 | ⚠️ 僅手動觸發，不再使用自動排程 |

> 所有自動排程已於 2026-04-13 **全面移轉至 Oracle VM crontab** 執行，GitHub Actions 的 `schedule` cron 已停用。
> VM crontab 以 `TZ=Asia/Taipei` 直接設定台灣時間，無需換算 UTC。

---

## 排程總表

### Oracle VM crontab（`crontab -e`，TZ=Asia/Taipei）

| 台灣時間 | Cron 表達式 | 執行腳本 | 用途 | 時間敏感度 |
|---|---|---|---|---|
| 每 5 分鐘 | `*/5 * * * *` | `curl duckdns update` | DuckDNS IP 自動更新（防 Oracle IP 漂移） | 低 |
| 07:30 每日 | `30 7 * * *` | `scripts/vm-daily-check.sh` | 🔴 盤前完整報告（09:00 開盤前） | 高 |
| 10:30 每日 | `30 10 * * *` | `scripts/vm-daily-check.sh` | 🟡 盤中觀測 | 中 |
| 12:00 每日 | `0 12 * * *` | `scripts/vm-daily-check.sh` | 🟡 午盤回報 | 中 |
| 13:45 每日 | `45 13 * * *` | `scripts/vm-daily-check.sh` | 🟡 收盤後總結（13:30 收盤後 15 分） | 中 |
| 21:30 每日 | `30 21 * * *` | `scripts/vm-daily-check.sh` | 🌙 夜間美股開盤觀測 | 中 |
| 每 4 小時 | `0 */4 * * *` | `scripts/vm-news-fetch.sh` | 新聞池更新 | 低 |
| 02:00 每日 | `0 2 * * *` | `scripts/vm-optimizer.sh` | Rule Optimizer（新聞治理規則優化） | 低 |
| 09:30 每週一 | `30 9 * * 1` | `scripts/vm-weekly-report.sh` | AI 週報生成 | 低 |
| 09:00 每月 1 日 | `0 9 1 * *` | `scripts/vm-monthly-report.sh` | AI 月報生成 | 低 |
| 03:00 每週日 | `0 3 * * 0` | `find ... -mtime +30 -delete` | Log 輪替（清理 30 天前的 `.log` 檔） | 低 |

**VM crontab 完整設定：**
```cron
SHELL=/bin/bash
TZ=Asia/Taipei

# ── DuckDNS IP 自動更新 ──────────────────────────────────────
*/5 * * * * curl -s "https://www.duckdns.org/update?domains=YOUR_DOMAIN&token=YOUR_TOKEN&ip=" > /dev/null

# ── runDailyCheck（每日 5 次）────────────────────────────────
# 盤前報告 07:30
30 7  * * * /bin/bash /home/ubuntu/investnotify/scripts/vm-daily-check.sh
# 盤中觀測 10:30
30 10 * * * /bin/bash /home/ubuntu/investnotify/scripts/vm-daily-check.sh
# 午盤 12:00
0  12 * * * /bin/bash /home/ubuntu/investnotify/scripts/vm-daily-check.sh
# 收盤後總結 13:45
45 13 * * * /bin/bash /home/ubuntu/investnotify/scripts/vm-daily-check.sh
# 夜間美股觀測 21:30
30 21 * * * /bin/bash /home/ubuntu/investnotify/scripts/vm-daily-check.sh

# ── runNewsFetch（每 4 小時）─────────────────────────────────
0  */4 * * * /bin/bash /home/ubuntu/investnotify/scripts/vm-news-fetch.sh

# ── runOptimizer（每日 02:00）────────────────────────────────
0  2  * * * /bin/bash /home/ubuntu/investnotify/scripts/vm-optimizer.sh

# ── runWeeklyReport（每週一 09:30）──────────────────────────
30 9  * * 1 /bin/bash /home/ubuntu/investnotify/scripts/vm-weekly-report.sh

# ── runMonthlyReport（每月 1 日 09:00）──────────────────────
0  9  1 * * /bin/bash /home/ubuntu/investnotify/scripts/vm-monthly-report.sh

# ── Log 輪替（每週日 03:00 清理 30 天前的 log）──────────────
0  3  * * 0 find /home/ubuntu/investnotify/logs -name "*.log" -mtime +30 -delete
```

> ⚠️ DuckDNS 的 `domains` 與 `token` 為敏感資訊，請勿 commit 至 repo，僅設定於 VM crontab。

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

## VM 排程腳本說明

### 共同特性

所有 `scripts/vm-*.sh` 腳本均具備以下機制：

- **Lock 檔案**：防止同一任務並發執行（例：`/tmp/investnotify-daily.lock`）
- **Log 輸出**：寫入 `logs/` 目錄對應的 `.log` 檔案
- **錯誤通知**：執行失敗時透過 `scripts/notify-error.sh` 發送 Telegram 告警

### `scripts/vm-daily-check.sh`

| 項目 | 說明 |
|---|---|
| 位置 | `/home/ubuntu/investnotify/scripts/vm-daily-check.sh` |
| Log 輸出 | `logs/vm-cron.log` |
| Lock 檔案 | `/tmp/investnotify-daily.lock`（執行結束自動清除） |
| 每日執行次數 | 5 次（07:30 / 10:30 / 12:00 / 13:45 / 21:30） |

### `scripts/vm-news-fetch.sh`

| 項目 | 說明 |
|---|---|
| 對應 Runner | `src/runNewsFetch.mjs` |
| Log 輸出 | `logs/vm-news-fetch.log` |
| 執行頻率 | 每 4 小時 |

### `scripts/vm-optimizer.sh`

| 項目 | 說明 |
|---|---|
| 對應 Runner | `src/runOptimizer.mjs` |
| Log 輸出 | `logs/vm-optimizer.log` |
| 執行頻率 | 每日 02:00 |

### `scripts/vm-weekly-report.sh`

| 項目 | 說明 |
|---|---|
| 對應 Runner | `src/runWeeklyReport.mjs` |
| Log 輸出 | `logs/vm-weekly-report.log` |
| 執行頻率 | 每週一 09:30 |

### `scripts/vm-monthly-report.sh`

| 項目 | 說明 |
|---|---|
| 對應 Runner | `src/runMonthlyReport.mjs` |
| Log 輸出 | `logs/vm-monthly-report.log` |
| 執行頻率 | 每月 1 日 09:00 |

```bash
# 手動測試執行
bash /home/ubuntu/investnotify/scripts/vm-daily-check.sh

# 查看各 runner log
tail -f /home/ubuntu/investnotify/logs/vm-cron.log
tail -f /home/ubuntu/investnotify/logs/vm-news-fetch.log
tail -f /home/ubuntu/investnotify/logs/vm-optimizer.log

# 確認 crontab 設定
crontab -l
```

---

## 各資料 Slot 更新時機對照

> `runDailyCheck.mjs` 每次執行時都會呼叫 `fetchAllMacroData()`，但各 provider 依快取策略決定是否真正打外部 API。以下說明每個 Slot 在一天 5 次 dailyCheck 中的實際更新行為。
> 詳細快取策略設計請見 [`docs/modules/providers.md`](docs/modules/providers.md) 第 3.4 節。

| Slot Key | providerId | 快取策略 | 07:30 | 10:30 | 12:00 | 13:45 | 21:30 |
|---|---|---|---|---|---|---|---|
| `rawNdc` | `ndcBusinessIndicator` | 每日一次（比對日期） | 🔄 重抓 | 📦 快取 | 📦 快取 | 📦 快取 | 📦 快取 |
| `rawMargin` | `marginKgi` | 16:00 後且距上次 > 2h 才重抓 | 📦 快取 | 📦 快取 | 📦 快取 | 📦 快取 | 🔄 重抓¹ |
| `rawCnn` | `cnnFearGreed` | 21:00–05:00 強制重抓，其餘 24h 快取 | 📦 快取 | 📦 快取 | 📦 快取 | 📦 快取 | 🔄 重抓 |
| `rawUsMarket` | `usMarketFred` | 每日一次（比對日期） | 🔄 重抓 | 📦 快取 | 📦 快取 | 📦 快取 | 📦 快取 |
| `rawValuation` | `twMarketValuation` | 每日一次（比對日期） | 🔄 重抓 | 📦 快取 | 📦 快取 | 📦 快取 | 📦 快取 |
| `rawFx` | `usdTwdYahoo` | 永遠重抓（無快取） | 🔄 重抓 | 🔄 重抓 | 🔄 重抓 | 🔄 重抓 | 🔄 重抓 |
| `rawMarketOverview` | `twMarketOverview` | 每日一次（比對日期）² | 🔄 重抓 | 📦 快取 | 📦 快取 | 📦 快取 | 📦 快取 |
| `quote` | `dailyQuote` | 每日一次（內部比對日期） | 🔄 重抓 | 📦 快取 | 📦 快取 | 📦 快取 | 📦 快取 |

> ¹ `rawMargin`（融資餘額）：台股收盤後（約 15:00 前後）更新，因此 13:45 的 dailyCheck 多半仍為前一日數字；21:30 執行時若距上次超過 2 小時且已過 16:00，將重新抓取當日數據。  
> ² `rawMarketOverview`（大盤量價）：TWSE FMTQIK API 在收盤後才提供當日數據，07:30 時抓到的通常是前一個交易日收盤資料。

**圖例**：🔄 重抓（呼叫外部 API）　📦 快取（直接讀 `data/market/latest.json`）

---

## data/ 同步機制

```
┌─────────────────────────────────────────────────────────────┐
│  VM crontab 執行路徑（所有 runner）                           │
│                                                             │
│  scripts/vm-*.sh                                            │
│    1. git fetch & reset --hard origin/main  ← 先拉最新      │
│    2. node src/run*.mjs                     ← 執行          │
│    3. git add data/ && git commit && push   ← 寫回 GitHub   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**衝突防護：**
- 各腳本均內建 `lockfile`，防止並發執行
- VM 端的 `git reset --hard` 優先以 GitHub 為 source of truth
- `data/` 不進版本控制（`.gitignore`），僅作為 VM 本地快取使用

---

## Log 管理

| Log 檔案 | 對應任務 |
|---|---|
| `logs/vm-cron.log` | runDailyCheck（每日 5 次） |
| `logs/vm-news-fetch.log` | runNewsFetch（每 4 小時） |
| `logs/vm-optimizer.log` | runOptimizer（每日 02:00） |
| `logs/vm-weekly-report.log` | runWeeklyReport（每週一） |
| `logs/vm-monthly-report.log` | runMonthlyReport（每月 1 日） |

- **自動輪替**：每週日 03:00 自動刪除 30 天前的 `.log` 檔
- **手動查看**：`tail -f logs/<檔名>.log`

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
- DuckDNS `domains` 與 `token` 請勿 commit 至 repo，僅設定於 VM crontab
- 新增排程腳本時，請同步更新本文件與 `README.md` 的排程總覽
- 新增或修改 provider 快取策略時，請同步更新上方「各資料 Slot 更新時機對照」表格
