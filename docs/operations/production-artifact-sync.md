---
type: reference
status: current
last_updated: 2026-10-22
tags:
  - operations
  - production
  - diagnostics
  - snapshots
wiki_links: []
---

# Production Artifact Sync

## Purpose

此流程只把正式環境的 `data/` 與 `logs/` 複製成診斷快照，供問題復現與測試驗證使用。

它與程式部署完全分離，不會執行：

- `git pull` 或 `git reset`
- npm 安裝
- 前端 build
- PM2 reload 或 restart
- 修改正式區程式碼

## Command

在正式主機上執行：

```bash
npm run sync:production-artifacts -- \
  --data-dir /home/ubuntu/investnotify/data \
  --logs-dir /home/ubuntu/investnotify/logs \
  --output-dir /home/ubuntu/investnotify-diagnostics
```

先預覽檔案清單，不建立快照：

```bash
npm run sync:production-artifacts -- --dry-run \
  --data-dir /home/ubuntu/investnotify/data \
  --logs-dir /home/ubuntu/investnotify/logs \
  --output-dir /home/ubuntu/investnotify-diagnostics
```

## Snapshot layout

```text
/home/ubuntu/investnotify-diagnostics/
└── 2026-10-22T04-00-00-000Z/
    ├── data/
    ├── logs/
    └── manifest.json
```

每次同步建立新的不可變時間戳目錄，不覆蓋既有快照。`manifest.json` 記錄來源路徑、同步時間、相對檔案路徑、檔案大小與 SHA-256。

## Exclusions

以下檔案不會進入快照：

- `.env`
- `.env.local`
- `.env.production`
- `.bot_lock`
- 任一層級名稱以 `.secret` 結尾的檔案

同步前仍應確認正式資料目錄沒有其他 credentials、tokens、private keys 或連線字串。發現敏感資料時，應先更新排除規則再同步。

## Reproduction rule

測試與問題分析必須明確指定某一個時間戳快照，不使用會變動的 `latest` 目錄。分析報告應引用 `manifest.json`，以確認測試輸入與正式資料一致。

目前此 CLI 不提供 restore/import 功能，也不會把診斷快照自動寫回正式區。
