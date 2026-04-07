# Agent Task Cache — 項目二分析與規劃

**Task Started**: 2026-04-07  
**Status**: PLANNING ()等待使用者確認後開始實作  

---

## 計畫書項目二目標摘要

利用 Telegram Mini App (Web App) 技術，在對話框內嵌網頁。將 JSON 報表與歷史回測數據轉化為可互動圖表。

影響範圍：
- 新增 `src/api/server.mjs`—輕量級 Web 伺服器 (HTTP API)
- 新增 `webapp/`—前端小程式 (Mini App UI)
- `src/bot.mjs` 加入 Menu Button / Inline Button 開啟 Web App

---

## 技術決策記錄（待使用者確認）

1. **API 框架**：建議 Fastify（輕量、ESM 原生支援、比 Express 快 3-5 倍）
2. **前端架構**：建議 Vanilla JS + ECharts（零建構成本，適合個人專案）；如果對前端有興趣可改 React
3. **前端部署**：建議 GitHub Pages （對單人專案最簡單）或 Cloudflare Pages
4. **API 部署**：待項目一的主機選定後再確認
5. **initData 驗證**：使用 Telegram 官方 HMAC-SHA256 驗證機制

---

## 文件 / 程式碼不一致問題（需修正）

### 問題 1：`docs/architecture.md` 缺少 Bot 長駐層記載
- **現狀**：`architecture.md` 的 Runner Layer、Mermaid flow、目錄責任對照表均未包含 `src/bot.mjs`、`src/modules/bot/` 相關檔案。
- **建議**：在項目二實作前，一並更新 `architecture.md`，新增 Bot Layer 記載與 Mermaid flow 更新。

### 問題 2：`data/` 目錄結構與文件不一致
- **現狀**：`architecture.md` 的 data 層說明列出 `data/news/pool_active.json` 與 `data/news/pool_filtered_active.json`，但實際目錄列表發現還有 `data/cache/`、`data/config/`、`data/news_logs/`、`data/last_buy.json` 未在文件中記載。
- **建議**：一並补充記載這幾個目錄的用途。

### 問題 3：`src/runOptimizer.mjs` 沒有導出 `export`
- **現狀**：項目一實作時，`runNewsFetch`、`runWeeklyReport`、`runMonthlyReport` 均對內部函數追加了 export，但 `runOptimizer.mjs` 主要逻輯仍在 `main()` 內直接呼叫。`bot.mjs` 目前是 import `runRuleOptimizer` 自 `./modules/ai/ruleOptimizerAgent.mjs`，這樣是正確的，沒有必要修改 `runOptimizer.mjs`。

---

## Phase 清單

### 前置修正（實作前）
- [ ] Phase 2-pre-A：更新 `docs/architecture.md`（新增 Bot Layer、data 目錄補充）

### API 層
- [ ] Phase 2-A：新增 `src/api/server.mjs`（Fastify）
  - `GET /api/status` — 讀取 `data/market/latest.json`
  - `GET /api/reports` — 讀取最新 N 筆 `data/reports/`
  - `GET /api/report/:date` — 讀取指定日期報告
  - `GET /api/news` — 讀取 `data/news/pool_active.json`
  - initData 驗證 middleware
  - CORS 設定
  - `package.json` 加入 `fastify` + `npm run api` 指令

### 前端層
- [ ] Phase 2-B：建立 `webapp/` 目錄（Vanilla JS + ECharts）
  - `webapp/index.html` — Mini App 主頁，引入 Telegram WebApp SDK
  - `webapp/index.js` — 主邏輯，初始化 Telegram WebApp、呼叫 API、渲染圖表
  - `webapp/style.css` — 基礎樣式，對齊 Telegram 主題色彩
  - 圖表內容：0050 近 30 天收益艦占圖 + 訊號次數折線圖

### Bot 整合
- [ ] Phase 2-C：更新 `src/bot.mjs`
  - 加入 `setMyCommands()`（讓 Telegram 顯示指令列表提示）
  - 加入 Menu Button（主選單按鈕）指向 Mini App URL
  - 沿現有指令回覆加入 Inline Button 開啟 Mini App

### 文件更新
- [ ] Phase 2-D：更新 `docs/architecture.md`、`docs/modules/entry_and_notifications.md` 全面記載項目二成果

---

## 關鍵技術决策（待使用者確認）

| 項目 | 建議 | 備選 |
|---|---|---|
| API 框架 | Fastify | Express |
| 前端 | Vanilla JS + ECharts | React + Recharts |
| 前端部署 | GitHub Pages | Cloudflare Pages / Vercel |
| API 部署 | 需配合主機調整 | - |

---

## 需要使用者回答的問題

1. API 框架偏好：Fastify vs Express？
2. 前端架構：Vanilla JS vs React？
3. 前端部署：GitHub Pages vs Cloudflare Pages/Vercel？
4. Mini App 主要展示哪些圖表最有價値？
   候選：(a) 0050 近 30 天收益率尾粿 + K 線圖、(b) 報告展示列表、(c) 訊號次數分布圖、(d) 新聞池瀏覽
