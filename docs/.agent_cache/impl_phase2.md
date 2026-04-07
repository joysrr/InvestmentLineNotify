# Agent Task Cache — Phase 2 實作計劃

**Task**: Phase 2 — Telegram Mini App 整合  
**Status**: READY_TO_IMPLEMENT — 技術選型已確認，等待使用者特命開始 Phase 2-A  
**Updated**: 2026-04-07  

---

## 已完成項目

- [x] **Pre-A**：`docs/architecture.md` 更新（Bot Layer 5.8、data/ 目錄、Mermaid flow）
  - commit: `docs(Pre-A): update architecture.md — add Bot Layer, fix data/ dirs, prep for Phase 2`
- [x] **preplan_features.md**：新增 Oracle Cloud VM 部署計劃（待取得 domain 後執行）
  - commit: `docs: add Oracle VM deployment plan to preplan_features.md`
- [x] **技術選型已全部確認**（詳見下方）

---

## 技術選型決議（已確認）

| 項目 | 決定 | 說明 |
|---|---|---|
| API 框架 | ✅ **Fastify** | ESM 原生支援、比 Express 快 3-5 倍、型別友好 |
| 前端框架 | ✅ **Vite + Vue 3 + ECharts** | Composition API、HMR、vue-echarts 反應式 resize |
| 前端目錄 | ✅ **`webapp/`** | build 產物輸出至 `webapp/dist/` |
| 部署方案 | ⏸️ **Oracle VM（下個計劃）** | 尚未有 domain，移入 `preplan_features.md` |
| 圖表優先 | ✅ **(a)→(b)→(d)** | 收益率折線 → 報告列表 → 新聞列表，不需 (c) |
| 圖表庫 | **ECharts** | 適合手機譜幕多變寬度的 resize |

---

## 待執行 Phase 清單

### Phase 2-A：Fastify API Server

**目標檔案**：`src/api/server.mjs`  
**npm 指令**：`npm run api`

需實作的端點：

| 路由 | 說明 |
|---|---|
| `GET /api/status` | 讀取 `data/market/latest.json`，回傳市場快取 |
| `GET /api/reports?limit=N` | 讀取 `data/reports/` 最新 N 份報告（預設 30） |
| `GET /api/report/:date` | 讀取指定日期報告（`YYYY-MM-DD`） |
| `GET /api/news` | 讀取 `data/news/pool_filtered_active.json` |

需實作的機制：
- Telegram `initData` HMAC-SHA256 驗證 middleware（`dev` 模式可 bypass）
- CORS 設定（開發期容許 localhost）
- 一律唯讀，不寫入 `data/`（防止與 GitHub Actions 衝突）

---

### Phase 2-B：Vite + Vue 3 前端 Mini App

**目標目錄**：`webapp/`  
**依賴**：`vite`, `vue`, `vue-echarts`, `echarts`, `@telegram-apps/sdk`

三個主要模組：

| 模組 | 圖表 / 功能 | 資料來源 |
|---|---|---|
| (a) 收益率折線 | ECharts LineChart，變動幅 ±色差異 | `/api/reports` |
| (b) 報告列表 | 日期 + AI 決策摘要，可點擊展開詳細 | `/api/reports` |
| (d) 新聞列表 | 標題 + 來源 + 時間，可點連結 | `/api/news` |

其他要求：
- Telegram Web App SDK：`expand()`、`MainButton`、`themeParams` 主題色同步
- 頁面切換利用 Vue Router（`hash` 模式，Mini App 不支援 history mode）
- `vite build` 輸出至 `webapp/dist/`，由外部 Web Server 提供靜態檔

---

### Phase 2-C：Bot 整合

在現有 `src/bot.mjs` 新增：
- `bot.api.setMyCommands([...])` — Telegram 左下角指令選單
- `bot.api.setChatMenuButton({ type: "web_app", ... })` — Menu Button 指向 Mini App URL
- `/status` 指令加附 Inline Button 「開啟 Mini App 」

> 注意：Mini App URL 待取得 HTTPS domain 後才能配置，此步驟待部署計劃完成後再實作。

---

### Phase 2-D：文件更新（實作結束後）

- `docs/architecture.md`：補充 API 層與 webapp 層說明
- `docs/modules/entry_and_notifications.md`：更新 Bot 指令選單與 Mini App 整合說明

---

## 部署最後解鎖（導往下個計劃）

Oracle VM 部署計劃已移入 `docs/plans/preplan_features.md`。  
待取得 domain 與 HTTPS 入口後，再執行「Oracle Cloud VM 正式部署」計劃。

---

## 遠端開發如何驗證 Mini App

在取得 HTTPS 內網 domain 之前，可用以下方式本機驗證：

```bash
# API Server 本機啟動
npm run api  # Fastify 席聽 localhost:3000

# 前端開發 server
npm run dev  # Vite dev server localhost:5173

# 或 ngrok 將 localhost 暴露為臨時 HTTPS URL 供 Telegram 測試
ngrok http 5173
```
