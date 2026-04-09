# Oracle Cloud VM 部署安裝手冊（附錄）

> **狀態：✅ 已完成**
> **完成日期：2026-04-10**
> **前置條件：✅ 已達成** — Telegram Mini App Phase 2（Bot UI / Mini App / Fastify API）全數完成。

此文件為 Oracle Cloud VM 正式部署的安裝參考手冊，記錄從環境初始化到驗收上線的完整步驟。部署已完成，本文件保留作為未來重新部署、VM 還原或環境遷移的參考依據。

---

## 計畫概述

### 目標

將 Fastify API Server（`src/api/server.mjs`）與 Vite + Vue 3 前端 build 產物（`webapp/dist/`）部署至 Oracle Cloud Free Tier VM（Ubuntu），提供 Telegram Mini App 穩定的外網 HTTPS 存取端點，同時維持現有 GitHub Actions 排程（dailyCheck / newsFetch / weeklyReport / monthlyReport）與 Bot daemon 架構完整運作。

### 設計原則

- API Server（Fastify）與靜態前端（Vue dist）部署於同一台 VM，由 Nginx 做反向代理（HTTPS 終止 + 路由分流）。
- GitHub Actions 排程 runner 維持不變，Actions 仍負責定時觸發各 runner 並 git push 結果。
- `data/` 目錄的 JSON 讀寫仍由 VM 上的 Fastify 直接存取，不引入額外資料庫。
- Bot daemon（`src/bot.mjs`）由 VM 上的 pm2 常駐執行，GitHub Actions 不啟動 bot。
- `data/` 同步採用**方案 B**：Actions 完成後透過 SSH 通知 VM 執行 `git pull`，確保 VM 資料即時更新。

---

## ✅ Step 0：取得可用的 domain 與 HTTPS 入口（第一優先）

> **這是整個計畫的解鎖點。** Telegram Mini App 強制要求 HTTPS，無法以裸 IP 作為 Mini App URL。請先完成此步驟，再進行後續部署。

### 方案 A：免費 subdomain + Certbot（Let's Encrypt）— 建議採用

#### A-1：取得免費 subdomain

推薦服務（免費、無需信用卡）：

| 服務 | Subdomain 格式 | 說明 |
|---|---|---|
| [DuckDNS](https://www.duckdns.org/) | `yourname.duckdns.org` | 最簡單，填入 VM IP 即可，支援 Let's Encrypt |
| [FreeDNS (afraid.org)](https://freedns.afraid.org/) | 多種頂級域可選 | 可選較短域名，設定稍複雜 |

**DuckDNS 操作步驟（推薦）：**

```bash
# 1. 前往 https://www.duckdns.org，使用 Google / GitHub 登入
# 2. 建立一個 subdomain，例如 investnotify.duckdns.org
# 3. 填入 Oracle VM 的公網 IP（Oracle Console → Instance → Public IP）
# 4. 點擊 update ip，確認 current ip 與 VM IP 一致

# 驗證 DNS 解析（在 VM 上執行）
ping investnotify.duckdns.org
# 應解析至 VM 的公網 IP
```

> **Oracle VM 公網 IP 查詢**：Oracle Cloud Console → Compute → Instances → 點入你的 instance → Public IP address。

#### A-2：安裝 Nginx 與 Certbot

```bash
sudo apt update
sudo apt install -y nginx
sudo apt install -y certbot python3-certbot-nginx
```

#### A-3：建立暫時 Nginx 設定（供 Certbot 驗證用）

```bash
sudo nano /etc/nginx/sites-available/investnotify
```

填入以下內容：

```nginx
server {
    listen 80;
    server_name investnotify.duckdns.org;  # 替換為你的 subdomain

    location / {
        root /var/www/html;
        index index.html;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/investnotify /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### A-4：申請 SSL 憑證

```bash
sudo certbot --nginx -d investnotify.duckdns.org
# 依提示輸入 email（用於憑證到期通知），同意 TOS
```

#### A-5：驗證自動續約

```bash
sudo certbot renew --dry-run
# 應顯示：Congratulations, all simulated renewals succeeded
```

> Certbot 安裝後會自動建立 systemd timer（`certbot.timer`），每 12 小時檢查一次，憑證剩餘 30 天內自動續約，無需手動維護。

#### A-6：確認 Oracle Cloud Security List

```
Oracle Cloud Console
  → Networking → Virtual Cloud Networks → 你的 VCN
  → Security Lists → Default Security List
  → Add Ingress Rules：
      來源 CIDR: 0.0.0.0/0
      IP Protocol: TCP
      Destination Port Range: 80
  → Add Ingress Rules：
      來源 CIDR: 0.0.0.0/0
      IP Protocol: TCP
      Destination Port Range: 443
```

```bash
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 22
sudo ufw enable
sudo ufw status verbose
```

---

## Step 1：Oracle VM 基礎環境初始化

```bash
sudo apt update && sudo apt upgrade -y

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

node -v  # 應為 v22.x.x
npm -v

npm install -g pm2
pm2 -v
```

---

## Step 2：專案部署至 VM

#### 2-1：設定 GitHub Deploy Key

```bash
ssh-keygen -t ed25519 -C "oracle-vm-deploy" -f ~/.ssh/deploy_key -N ""
cat ~/.ssh/deploy_key.pub
```

前往 GitHub repo Settings → Deploy keys → Add deploy key：
- Title: `oracle-vm`
- Key: 貼上公鑰內容
- Allow write access: **不勾選**（唯讀即可）

```bash
nano ~/.ssh/config
```

```
Host github.com
  IdentityFile ~/.ssh/deploy_key
  StrictHostKeyChecking no
```

#### 2-2：Clone 專案

```bash
git clone git@github.com:joysrr/InvestmentLineNotify.git ~/investnotify
cd ~/investnotify
```

#### 2-3：安裝依賴與設定環境變數

```bash
npm install
cp .env.example .env
nano .env
```

`.env` 必填項目清單：

| 變數名稱 | 說明 | 來源 |
|---|---|---|
| `TELEGRAM_API_TOKEN` | Bot 主帳號 Token | BotFather |
| `TELEGRAM_LOG_API_TOKEN` | Log Bot Token（推播至 log 頻道） | BotFather |
| `TELEGRAM_CHAT_ID` | 主推播頻道 ID | Telegram |
| `TELEGRAM_LOG_CHAT_ID` | Log 頻道 ID | Telegram |
| `TELEGRAM_USER_ID` | 白名單使用者 ID（adminGuard） | Telegram |
| `GEMINI_API_KEY1` | Gemini API Key（newsFetcher / TTS） | Google AI Studio |
| `GEMINI_API_KEY2` | Gemini API Key（aiCoach / periodReport） | Google AI Studio |
| `LANGFUSE_PUBLIC_KEY` | Langfuse 公鑰 | Langfuse Dashboard |
| `LANGFUSE_SECRET_KEY` | Langfuse 私鑰 | Langfuse Dashboard |
| `LANGFUSE_BASE_URL` | Langfuse 伺服器 URL | Langfuse Dashboard |
| `GOOGLE_SHEET_ID` | Google Sheet ID（持股 / 每日紀錄） | Google Sheets URL |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google Service Account JSON（Base64 或路徑） | Google Cloud Console |
| `BYPASS_INIT_DATA` | 設為 `false`（VM 正式環境不 bypass 驗證） | — |
| `NODE_ENV` | 設為 `production` | — |
| `MINI_APP_URL` | 設為 HTTPS domain（例如 `https://investnotify.duckdns.org`） | DuckDNS |

#### 2-4：Build 前端

```bash
cd ~/investnotify/webapp
npm install
npm run build
ls webapp/dist/
# 應有 index.html 與 assets/ 目錄
```

---

## Step 3：Nginx 反向代理設定

```bash
sudo nano /etc/nginx/sites-available/investnotify
```

完整設定：

```nginx
# /etc/nginx/sites-available/investnotify
server {
    listen 443 ssl;
    server_name investnotify.duckdns.org;  # 替換為你的 subdomain

    ssl_certificate     /etc/letsencrypt/live/investnotify.duckdns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/investnotify.duckdns.org/privkey.pem;

    # Telegram Mini App 安全要求：允許在 iframe 中嵌入
    add_header X-Frame-Options "ALLOWALL";
    add_header X-Content-Type-Options "nosniff";

    # Gzip 壓縮
    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    # API 路由 → Fastify (port 3000)
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 靜態資源長快取
    location /assets/ {
        root /home/ubuntu/investnotify/webapp/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 靜態前端 → Vue dist（SPA fallback）
    location / {
        root /home/ubuntu/investnotify/webapp/dist;
        try_files $uri $uri/ /index.html;
    }
}

# HTTP → HTTPS 強制跳轉
server {
    listen 80;
    server_name investnotify.duckdns.org;
    return 301 https://$host$request_uri;
}
```

```bash
sudo nginx -t
sudo systemctl reload nginx
curl -I https://investnotify.duckdns.org/api/status
```

---

## Step 4：pm2 管理服務

#### 4-1：建立 ecosystem.config.cjs

```bash
nano ~/investnotify/ecosystem.config.cjs
```

```js
module.exports = {
  apps: [
    {
      name: "api-server",
      script: "src/api/server.mjs",
      interpreter: "node",
      cwd: "/home/ubuntu/investnotify",
      env_production: {
        NODE_ENV: "production",
      },
      max_memory_restart: "300M",
      restart_delay: 5000,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
    {
      name: "bot-daemon",
      script: "src/bot.mjs",
      interpreter: "node",
      cwd: "/home/ubuntu/investnotify",
      env_production: {
        NODE_ENV: "production",
      },
      max_memory_restart: "200M",
      restart_delay: 5000,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
```

#### 4-2：啟動服務

```bash
cd ~/investnotify
pm2 start ecosystem.config.cjs --env production
pm2 startup
# 依提示執行輸出的 sudo 指令
pm2 save
pm2 list
```

#### 4-3：常用維護指令

```bash
pm2 logs api-server --lines 50
pm2 logs bot-daemon --lines 50
pm2 monit
pm2 restart api-server
pm2 restart bot-daemon
pm2 reload api-server  # zero-downtime reload
```

---

## Step 5：data/ 目錄同步策略（方案 B：Actions SSH 通知 VM git pull）

### 架構說明

```
GitHub Actions（排程 runner 完成後）
  └─ SSH 連線至 Oracle VM
       └─ 執行 cd ~/investnotify && git pull
            └─ VM 的 data/ 更新至最新狀態
```

### 5-1：產生 Actions 專用 SSH Key

```bash
ssh-keygen -t ed25519 -C "github-actions-sync" -f ./actions_sync_key -N ""
cat actions_sync_key.pub  # 公鑰 → 加入 VM authorized_keys
cat actions_sync_key      # 私鑰 → 加入 GitHub Secrets
```

### 5-2：將公鑰加入 VM 的 authorized_keys

```bash
nano ~/.ssh/authorized_keys
# 將 actions_sync_key.pub 內容貼入新的一行
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

### 5-3：將私鑰加入 GitHub Secrets

| Secret 名稱 | 值 |
|---|---|
| `VM_SSH_PRIVATE_KEY` | `actions_sync_key` 的完整私鑰內容 |
| `VM_HOST` | Oracle VM 的公網 IP |
| `VM_USER` | `ubuntu` |

### 5-4：在各 workflow 中新增同步步驟

在每個 workflow 的 git push 步驟**之後**加入：

```yaml
- name: Sync data to Oracle VM
  uses: appleboy/ssh-action@v1.0.3
  with:
    host: ${{ secrets.VM_HOST }}
    username: ${{ secrets.VM_USER }}
    key: ${{ secrets.VM_SSH_PRIVATE_KEY }}
    script: |
      cd ~/investnotify
      git pull origin main
      echo "[data-sync] $(date) git pull 完成"
```

---

## Step 6：GitHub Actions 排程衝突確認

| 類型 | 執行位置（部署後） | 說明 |
|---|---|---|
| `runDailyCheck` | GitHub Actions runner | 保持不變 |
| `runNewsFetch` | GitHub Actions runner | 保持不變 |
| `runWeeklyReport` | GitHub Actions runner | 保持不變 |
| `runMonthlyReport` | GitHub Actions runner | 保持不變 |
| `runOptimizer` | GitHub Actions runner | 保持不變 |
| `src/bot.mjs` | Oracle VM（pm2） | **改由 VM 常駐，Actions 不再觸發** |
| `src/api/server.mjs` | Oracle VM（pm2） | 新增常駐服務，Actions 不涉及 |

```bash
# 確認 Actions 無 bot 啟動指令
grep -r "bot.mjs\|npm run bot" .github/workflows/
# 應無輸出
```

---

## Step 7：BotFather 設定 Mini App URL

```
# 在 Telegram 與 BotFather 對話
/setmenubutton
選擇你的 Bot
輸入 URL：https://investnotify.duckdns.org
輸入 Button Text：📊 投資儀表板
```

```bash
# webapp/.env.production
VITE_API_BASE=https://investnotify.duckdns.org
```

```bash
cd ~/investnotify/webapp
npm run build
# Nginx 直接讀取 dist/，無需重啟
```

---

## ⚠️ 潛在挑戰與防禦機制

### 1. Telegram Bot 雙重 Long-Polling 衝突
- **風險**：Actions 與 VM pm2 同時啟動 `bot.mjs`，Telegram 拋出 `409 Conflict`。
- **防禦**：Step 6 的 grep 確認 + `pm2 list` 驗證僅一個 bot-daemon 進程。

### 2. data/ 同步衝突
- **防禦**：同步步驟設計在 git push **完成後**才執行 SSH git pull，兩者為串行關係。Fastify API 採唯讀模式，衝突面極小。

### 3. Oracle Cloud Free Tier 記憶體限制（1GB RAM）
- **預估**：Nginx ~30MB，bot-daemon ~40-60MB，api-server ~60-80MB，合計 < 200MB。
- **防禦**：`ecosystem.config.cjs` 已設定 `max_memory_restart`，超限自動重啟。

### 4. SSL 憑證到期
- **防禦**：Certbot systemd timer 每 12 小時自動檢查與續約。

### 5. DuckDNS IP 更新（Oracle VM IP 變動）
- **防禦**：設定 DuckDNS 自動更新 cron：
  ```bash
  crontab -e
  # 加入：
  */5 * * * * curl -s "https://www.duckdns.org/update?domains=investnotify&token=YOUR_DUCKDNS_TOKEN&ip=" > /dev/null
  ```
  或在 Oracle Console 設定**靜態 IP**（Reserved Public IP）。

---

## ✅ 部署後驗收 Checklist

```
基礎環境
  [x] Oracle VM Security List 已開放 80 / 443
  [x] ufw 已開放 80 / 443 / 22
  [x] DuckDNS subdomain 可正確解析至 VM IP（ping 測試）

HTTPS / Nginx
  [x] curl -I https://investnotify.duckdns.org 回應 200（不是 SSL 錯誤）
  [x] HTTP 301 跳轉正常（curl -I http://investnotify.duckdns.org）
  [x] certbot renew --dry-run 通過

Fastify API Server
  [x] pm2 list 顯示 api-server online
  [x] curl https://investnotify.duckdns.org/api/status 回應 200
  [x] curl https://investnotify.duckdns.org/api/news 回應 JSON

Bot daemon
  [x] pm2 list 顯示 bot-daemon online
  [x] Telegram Bot 可正常回應 /start
  [x] pm2 logs bot-daemon 無 409 Conflict 錯誤

Mini App
  [x] BotFather 已設定 Menu Button URL 為 https://investnotify.duckdns.org
  [x] 在 Telegram 點擊 Menu Button，Mini App 正常開啟
  [x] ChartView / ReportsView / NewsView 資料正常載入

data/ 同步
  [x] 手動觸發一次 Actions workflow，確認 SSH sync 步驟成功
  [x] VM 上執行 git log --oneline -3，確認最新 commit 與 GitHub 一致

pm2 開機自動啟動
  [x] sudo reboot 後，pm2 list 顯示兩個服務均 online
  [x] Nginx 開機自動啟動（sudo systemctl is-enabled nginx → enabled）
```
