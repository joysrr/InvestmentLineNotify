# Agent Task Cache — Phase 2 技術選型確認

**Task**: Phase 2 — Telegram Mini App 整合  
**Status**: TECH_DECISION — 技術選型討論中，等待使用者確認後開始實作  
**Updated**: 2026-04-07  

---

## Pre-A 狀態
- [x] `docs/architecture.md` 已更新（新增 Bot Layer 5.8、修正 data/ 遺漏目錄、Mermaid flow 補 Bot 節點）
- [x] commit: `docs(Pre-A): update architecture.md — add Bot Layer, fix data/ dirs, prep for Phase 2`

---

## 技術選型討論結果（進行中）

### API 框架
- **決定**: ✅ Fastify
- 理由: ESM 原生支援、比 Express 快 3-5 倍、型別友好

### 前端框架
- **候選**: Vite + Vue 3 + ECharts（使用者提議）
- **討論要點**（詳見主對話）：
  - 優點: 元件化、Composition API、HMR 開發體驗、vue-echarts 整合自然
  - 需評估: build artifact 要部署到 Oracle VM 或靜態主機；需要 Vite build pipeline
  - 替代: Vanilla JS + ECharts（零建構、直接 HTML，Mini App 超簡單場景也適用）
- **狀態**: 🔄 等待使用者最終確認

### 前端部署
- **候選**: Oracle Cloud VM（使用者已有）
- **討論要點**（詳見主對話）：
  - 優點: 自行掌控、可同時跑 API Server 與 Static File Serve，一台搞定
  - 需評估: 需設定 Nginx/Caddy + SSL（Telegram Mini App 強制要求 HTTPS）
  - 替代: GitHub Pages（零成本但純靜態，API Server 需另安排）
- **狀態**: 🔄 等待使用者最終確認

### Mini App 圖表優先順序
- **決定**: ✅ (a) 收益率趨勢折線 → (b) 報告摘要列表 → (d) 新聞池列表
- 不需要 (c) 訊號次數長條圖

---

## 待確認後執行的 Phase 清單

### Phase 2-A：Fastify API Server（`src/api/server.mjs`）
- `GET /api/status`
- `GET /api/reports?limit=N`
- `GET /api/report/:date`
- `GET /api/news`
- initData HMAC-SHA256 middleware（可切 dev bypass）
- CORS
- `npm run api` 指令

### Phase 2-B：前端 Mini App（`webapp/`）
- 框架待確認（Vite + Vue 3 + ECharts 或 Vanilla + ECharts）
- 圖表: (a) 收益率折線 → (b) 報告列表 → (d) 新聞列表
- Telegram Web App SDK 整合
- 主題色跟隨 Telegram 主題

### Phase 2-C：Bot 整合
- `setMyCommands()` 指令選單
- Menu Button 指向 Mini App URL
- `/status` 等指令加 Inline Button 開啟 Mini App

### Phase 2-D：文件更新
- `architecture.md`（API 與 webapp 層補充）
- `entry_and_notifications.md`（Bot 指令 + Mini App 整合）

---

## 需要使用者回答的問題

1. **前端框架最終決定**: Vite + Vue 3 + ECharts 還是 Vanilla JS + ECharts？
2. **部署方案最終決定**: Oracle VM（需自建 Nginx + SSL）還是其他？
   - 若選 Oracle VM: API Server 與 Static File 是否都放同一台？
   - SSL 憑證: 已有 domain？或用 Certbot 自動申請？
