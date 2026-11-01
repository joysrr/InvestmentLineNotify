---
type: guide
status: current
last_updated: 2026-11-01
related_code:
  - src/bot.mjs
tags:
  - deployment
  - checklist
wiki_links:
  - [[Telegram Bot]]
---

# 部署檢查清單 - InvestmentLineNotify

> **用途**：每次部署至 Oracle VM 前/中/後必須確認的項目
> **版本**：v1.0
> **最後更新**：2026-08-07

---

## 📋 部署前檢查 (Pre-deploy)

### 代碼狀態

- [ ] `git status` 乾淨 (無未提交變更)
- [ ] 當前分支為 `main` 或已合併至 `main`
- [ ] 最新 commit 已推送到 GitHub (`git push origin HEAD`)

### 本地驗證 (必須全部通過)

- [ ] `npm run lint` - 0 errors
- [ ] `npm run test` - 後端 426+ tests passed
- [ ] `cd webapp && npm run test` - 前端 22 tests passed
- [ ] `cd webapp && npm run test:e2e` - E2E 10/10 passed
- [ ] `npm run verify` - 完整 pipeline 通過 (含 OpenAPI gen + breaking change check)
- [ ] `npm run pre-deploy` - 部署前完整驗證通過

### 環境變數確認 (VM 上)

| 變數                                    | 確認 | 備註                              |
| --------------------------------------- | ---- | --------------------------------- |
| `TELEGRAM_API_TOKEN`                    | ☐    | BotFather 取得                    |
| `TELEGRAM_LOG_API_TOKEN`                | ☐    | 系統訊息專用 Bot                  |
| `TELEGRAM_USER_ID` / `TELEGRAM_CHAT_ID` | ☐    | 你的 Telegram ID                  |
| `TELEGRAM_WEBAPP_URL`                   | ☐    | `https://your-domain.duckdns.org` |
| `GEMINI_API_KEY1`                       | ☐    | Google AI Studio                  |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`          | ☐    | GCP Service Account               |
| `GOOGLE_PRIVATE_KEY`                    | ☐    | 換行符需正確 (含 `\n`)            |
| `GOOGLE_SHEET_ID`                       | ☐    | 試算表 ID                         |
| `FRED_API_KEY`                          | ☐    | St. Louis Fed                     |
| `BASE_PRICE_URL`                        | ☐    | 價格 API 端點                     |
| `LANGFUSE_PUBLIC_KEY` / `SECRET_KEY`    | ☐    | 選填                              |
| `NODE_ENV=production`                   | ☐    | 必須設定                          |
| `BYPASS_INIT_DATA=false`                | ☐    | 生產環境關閉                      |

---

## 🚀 部署執行 (Deploy)

### 單一指令部署

```bash
# 完整部署 (含 pre-deploy)
npm run deploy

# 僅驗證不部署 (二次確認)
npm run deploy:dry

# 緊急部署 (跳過 pre-deploy，謹慎使用)
npm run deploy -- --skip-pre
```

### 手動步驟 (腳本失效時備用)

```bash
# 1. SSH 到 VM
ssh user@vm-ip

# 2. 進入專案目錄
cd ~/investnotify

# 3. 拉取最新代碼
git pull

# 4. 安裝依賴 (含 devDependencies)
npm ci --include=dev

# 5. 建置前端
cd webapp && npm run build && cd ..

# 6. 重啟 PM2 服務
pm2 reload ecosystem.config.cjs --env production

# 7. 等待穩定
sleep 3 && pm2 status
```

---

## 🏥 部署後驗證 (Post-deploy)

### 自動檢查 (腳本內建)

- [ ] `https://your-domain.duckdns.org/health` → 200 OK
- [ ] `pm2 list` → `api-server` / `bot-daemon` 皆為 `online`
- [ ] `https://your-domain.duckdns.org/api/status` → 200 + JSON 回應

### 手動功能驗收

| 功能             | 驗證方式                   | 預期結果               |
| ---------------- | -------------------------- | ---------------------- |
| **Telegram Bot** | 發送 `/start`              | 正常回應選單           |
| **Mini App**     | 開啟選單按鈕               | 正常載入儀表板         |
| **API 模擬器**   | `#/simulator` 輸入價格執行 | 回傳策略分數、指標表格 |
| **週/月報**      | 觸發排程或等待定時         | Telegram 收到報告      |
| **新聞抓取**     | 觸發排程                   | Log 顯示 pool 更新     |

### 日誌檢查

```bash
# PM2 即時日誌
pm2 logs api-server --lines 50
pm2 logs bot-daemon --lines 50

# 錯誤關鍵字搜尋
pm2 logs | grep -i error
```

---

## 🔄 回滾流程 (Rollback)

### PM2 版本回滾 (最快)

```bash
# 查看部署歷史
pm2 list

# 回滾到前一版本 (pm2 內建)
pm2 reload ecosystem.config.cjs --env production --update-env
# 或指定版本重啟
pm2 restart api-server --update-env
```

### Git 代碼回滾

```bash
# 本機
git revert HEAD          # 建立反向 commit
git push origin main

# VM 上
ssh user@vm "cd ~/investnotify && git pull && npm ci --include=dev && cd webapp && npm run build && pm2 reload ecosystem.config.cjs"
```

### 完全重建 (最後手段)

```bash
# VM 上
cd ~/investnotify
git fetch --all
git reset --hard origin/main
npm ci --include=dev
cd webapp && npm run build
pm2 reload ecosystem.config.cjs --env production
```

---

## 📝 部署記錄模板

每次部署後記錄：

| 欄位         | 內容                                   |
| ------------ | -------------------------------------- |
| **日期時間** | 2026-08-07 14:30 (UTC+8)               |
| **Commit**   | `a1b2c3d` (main)                       |
| **訊息**     | `feat: add new feature`                |
| **部署者**   | LuLuLaLaHaHa                           |
| **耗時**     | 120s                                   |
| **驗證結果** | ✅ 全通過 / ⚠️ 有警告 / ❌ 失敗        |
| **備註**     | 例如：首次啟用新環境變數、資料庫遷移等 |

---

## 🚨 緊急聯繫與資源

| 項目             | 資訊                                                                  |
| ---------------- | --------------------------------------------------------------------- |
| **VM SSH**       | `ssh user@vm-ip`                                                      |
| **PM2 管理**     | `pm2 list`, `pm2 logs`, `pm2 restart <id>`                            |
| **Nginx 狀態**   | `systemctl status nginx`, `nginx -t`                                  |
| **SSL 憑證**     | `certbot renew --dry-run`                                             |
| **DuckDNS 更新** | `curl "https://www.duckdns.org/update?domains=your-domain&token=xxx"` |
| **GitHub Repo**  | `https://github.com/joysrr/InvestmentLineNotify`                      |

---

## ✅ 快速核對卡 (貼在終端機旁)

```
□ git status 乾淨
□ npm run pre-deploy 綠燈
□ npm run deploy 執行
□ health endpoint 200
□ pm2 list 全 online
□ Mini App 可開啟
□ Telegram Bot 回應
□ 部署日誌已存檔
```
