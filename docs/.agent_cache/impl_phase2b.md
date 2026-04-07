# Agent Task Cache — Phase 2-B 實作進度

**Task**: Phase 2-B — Vite + Vue 3 前端 Mini App（`webapp/`）  
**Status**: PENDING  
**Updated**: 2026-04-07

---

## 前置確認（Phase 2-A 已完成）

- `src/api/server.mjs` ✅ 運行於 `http://localhost:3000`
- API 路由 ✅：`/api/status`、`/api/reports`、`/api/report/:date`、`/api/news`
- `BYPASS_INIT_DATA=true` 可用於本地開發繞過 initData 驗證

---

## 待建立目錄結構

```
webapp/
├── package.json              # vite, vue, vue-router, echarts, vue-echarts
├── vite.config.js            # base: "/", build outDir: dist
├── index.html
└── src/
    ├── main.js               # createApp + router
    ├── App.vue               # <router-view> + TG themeParams 套用
    ├── router/
    │   └── index.js          # hash mode, routes: /, /reports, /news
    ├── api/
    │   └── index.js          # axios/fetch wrapper，baseURL 從 env 取得
    ├── composables/
    │   └── useTelegram.js    # window.Telegram.WebApp 封裝：expand、themeParams
    └── views/
        ├── ChartView.vue     # (a) 收益率折線圖
        ├── ReportsView.vue   # (b) 報告摘要列表
        └── NewsView.vue      # (d) 新聞池列表
```

---

## 各 View 規格

### ChartView.vue — 收益率趨勢折線
- 資料來源：`GET /api/reports?limit=30`
- X 軸：`report.date`
- Y 軸：`report.signals.priceChangePercent`（每日漲跌幅）
- 上漲用綠色，下跌用紅色線段（ECharts piecewise 顏色）
- 選用 `vue-echarts` + `use` 組合式 API

### ReportsView.vue — 報告摘要列表
- 資料來源：`GET /api/reports?limit=30`
- 每筆顯示：日期、`signals.suggestion`（建議方向）、`ai.action_items[0]`（首要行動）
- 點擊可展開完整 `ai.risk_warnings` + `ai.mindset_advice`
- 依日期 DESC 排序

### NewsView.vue — 新聞池列表
- 資料來源：`GET /api/news`
- 每筆顯示：標題、來源、時間（相對時間如「3 小時前」）
- 標題可點擊，開新 tab 至原文（Telegram Mini App 用 `window.Telegram.WebApp.openLink()`）

---

## 關鍵實作注意事項

1. **Vue Router 必須使用 hash 模式**：Telegram Mini App 不支援 history mode
2. **API baseURL**：開發期 `http://localhost:3000`，透過 `.env` 或 `import.meta.env.VITE_API_BASE` 設定
3. **Telegram SDK**：在 `index.html` 加入 `<script src="https://telegram.org/js/telegram-web-app.js">`
4. **主題色同步**：`useTelegram.js` 需從 `window.Telegram.WebApp.themeParams` 讀取並套用 CSS variables
5. **build 輸出**：`vite.config.js` 的 `build.outDir` 設為 `dist`，相對路徑正確

---

## 待建立檔案清單

- [ ] `webapp/package.json`
- [ ] `webapp/vite.config.js`
- [ ] `webapp/index.html`
- [ ] `webapp/src/main.js`
- [ ] `webapp/src/App.vue`
- [ ] `webapp/src/router/index.js`
- [ ] `webapp/src/api/index.js`
- [ ] `webapp/src/composables/useTelegram.js`
- [ ] `webapp/src/views/ChartView.vue`
- [ ] `webapp/src/views/ReportsView.vue`
- [ ] `webapp/src/views/NewsView.vue`
- [ ] `webapp/.env.example`（說明 `VITE_API_BASE`）
