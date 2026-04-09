# Oracle Cloud VM 正式部署計畫

> **狀態：✅ 已完成**
> **完成日期：2026-04-10**
> **前置條件：✅ 已達成** — Telegram Mini App Phase 2（Bot UI / Mini App / Fastify API）全數完成。

---

此文件為部署計畫紀錄。

**完整安裝手冊請見：[`docs/appendix/deployment-oracle-vm.md`](../appendix/deployment-oracle-vm.md)**

---

## 計畫概述

### 目標

將 Fastify API Server（`src/api/server.mjs`）與 Vite + Vue 3 前端 build 產物（`webapp/dist/`）部署至 Oracle Cloud Free Tier VM（Ubuntu），提供 Telegram Mini App 穩定的外網 HTTPS 存取端點，同時維持現有 GitHub Actions 排程與 Bot daemon 架構完整運作。

### 設計原則

- API Server（Fastify）與靜態前端（Vue dist）部署於同一台 VM，由 Nginx 做反向代理（HTTPS 終止 + 路由分流）。
- GitHub Actions 排程 runner 維持不變，Actions 仍負責定時觸發各 runner 並 git push 結果。
- `data/` 目錄的 JSON 讀寫仍由 VM 上的 Fastify 直接存取，不引入額外資料庫。
- Bot daemon（`src/bot.mjs`）改由 VM 上的 pm2 常駐執行，GitHub Actions 不啟動 bot。
- `data/` 同步採用**方案 B**：Actions 完成後透過 SSH 通知 VM 執行 `git pull`。

---

## 部署後驗收 Checklist

```
基礎環境
  [x] Oracle VM Security List 已開放 80 / 443
  [x] ufw 已開放 80 / 443 / 22
  [x] DuckDNS subdomain 可正確解析至 VM IP

HTTPS / Nginx
  [x] HTTPS 回應 200
  [x] HTTP 301 跳轉正常
  [x] certbot renew --dry-run 通過

Fastify API Server
  [x] pm2 list 顯示 api-server online
  [x] /api/status 回應正常
  [x] /api/news 回應 JSON

Bot daemon
  [x] pm2 list 顯示 bot-daemon online
  [x] Telegram Bot 可正常回應 /start
  [x] 無 409 Conflict 錯誤

Mini App
  [x] BotFather 已設定 Menu Button URL
  [x] Mini App 正常開啟
  [x] 三個 View 資料正常載入

data/ 同步
  [x] SSH sync 步驟成功
  [x] VM commit 與 GitHub 一致

pm2 開機自動啟動
  [x] reboot 後兩個服務均 online
  [x] Nginx 開機自動啟動
```
