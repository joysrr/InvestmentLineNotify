# Agent Task Cache — Phase 2-B 實作進度

**Task**: Phase 2-B — Vite + Vue 3 前端 Mini App(`webapp/`)  
**Status**: READY_TO_IMPLEMENT（分析完成，等待實作指令）  
**Updated**: 2026-04-07

---

## 前置確認（Phase 2-A 已完成）

- `src/api/server.mjs` ✅ Fastify 運行於 `http://localhost:3000`
- `GET /api/reports?limit=N` ✅ 回傳最多 100 份，預設 30 份
- `GET /api/report/:date` ✅ 單日報告
- `GET /api/news` ✅ 回傳物件 `{ generated_at, count, articles: [] }`
- `GET /api/status` ✅
- `BYPASS_INIT_DATA=true` ✅ 可用於本地開發繞過 initData 驗證
- 本機 CORS 允許 `http://localhost:5173`（Vite 預設 port）

---

## API Response Schema（已驗證，2026-04-07 從真實資料取得）

### `/api/reports` 各元素關鍵欄位

| 欄位路徑 | 型別 | 用途 |
|---|---|---|
| `date` | string | YYYY-MM-DD，X 軸 |
| `signals.currentPrice` | number | 當日收盤價 |
| `signals.priceChangePercent` | number | 漲跌幅（float，可為負） |
| `signals.priceChangePercentText` | string | 漲跌幅顯示用（如 "-2.57"） |
| `signals.weightScore` | number | 當日買進評分 |
| `signals.marketStatus` | string | 市場狀態標籤（含 emoji） |
| `signals.target` | string | 決策建議（如「👀 觀察等待」）|
| `signals.targetSuggestion` | string | 一行摘要文字 |
| `signals.RSI` | number | RSI 值 |
| `signals.KD_K` | number | KD K 值 |
| `signals.KD_D` | number | KD D 值 |
| `signals.bias240` | number | 240 日乖離率 |
| `signals.macroSentiment.direction` | string | "BULL" / "BEAR" / "NEUTRAL" |
| `ai.action_items` | string[] | 行動建議列表 |
| `ai.risk_warnings` | string[] | 風險警告列表 |
| `ai.mindset_advice` | string[] | 心態建議列表 |
| `ai.coach_internal_thinking` | string | AI 內部推理（可折疊顯示） |

### `/api/news` 回傳結構

```json
{
  "generated_at": "ISO timestamp",
  "count": 11,
  "articles": [
    {
      "id": "string",
      "title": "string",
      "url": "string",
      "pubDate": "RFC 2822 string",
      "source": "string",
      "_region": "TW | US",
      "age_band": "fresh | recent | old",
      "summary": "string（AI 摘要）"
    }
  ]
}
```

⚠️ `/api/news` 回傳是**物件**，不是陣列。若 `pool_filtered_active.json` 不存在，API 回傳空陣列 `[]`，前端需 fallback 處理。

---

## 待建立目錄結構

```
webapp/
├── package.json              # vite, @vitejs/plugin-vue, vue, vue-router, echarts, vue-echarts
├── vite.config.js            # base: "/", plugins: [vue()], build.outDir: "dist"
├── index.html                # 含 Telegram Web App SDK CDN script
└── src/
    ├── main.js               # createApp(App).use(router).mount('#app')
    ├── App.vue               # <router-view> + 底部 Tab Bar 導航 + useTelegram 初始化
    ├── router/
    │   └── index.js          # createWebHashHistory，routes: / /reports /news
    ├── api/
    │   └── index.js          # fetch wrapper，baseURL from VITE_API_BASE env
    │                         # 帶 X-Telegram-Init-Data header
    ├── composables/
    │   └── useTelegram.js    # window.Telegram?.WebApp 封裝
    └── views/
        ├── ChartView.vue     # (a) priceChangePercent 折線，漲綠跌紅
        ├── ReportsView.vue   # (b) 報告列表，展開 AI 內容
        └── NewsView.vue      # (d) articles 列表，tg.openLink 開連結
```

---

## 各檔案實作規格

### `webapp/package.json`

```json
{
  "name": "investment-webapp",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "echarts": "^5.x",
    "vue": "^3.x",
    "vue-echarts": "^7.x",
    "vue-router": "^4.x"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.x",
    "vite": "^5.x"
  }
}
```

### `webapp/vite.config.js`

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/',
  build: { outDir: 'dist' }
})
```

### `webapp/index.html`

必須包含：
- `<script src="https://telegram.org/js/telegram-web-app.js"></script>` 放在 `<head>`
- `<div id="app"></div>` + `<script type="module" src="/src/main.js"></script>`

### `webapp/src/composables/useTelegram.js`

```js
export function useTelegram() {
  const tg = window.Telegram?.WebApp
  return {
    tg,
    initData: tg?.initData ?? '',
    themeParams: tg?.themeParams ?? {},
    expand: () => tg?.expand(),
    openLink: (url) => tg ? tg.openLink(url) : window.open(url, '_blank')
  }
}
```

### `webapp/src/api/index.js`

```js
const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'

async function apiFetch(path) {
  const initData = window.Telegram?.WebApp?.initData || ''
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Telegram-Init-Data': initData }
  })
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`)
  return res.json()
}

export const fetchReports = (limit = 30) => apiFetch(`/api/reports?limit=${limit}`)
export const fetchNews = () => apiFetch('/api/news')
export const fetchStatus = () => apiFetch('/api/status')
```

### `webapp/src/router/index.js`

```js
import { createRouter, createWebHashHistory } from 'vue-router'
import ChartView from '../views/ChartView.vue'
import ReportsView from '../views/ReportsView.vue'
import NewsView from '../views/NewsView.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: ChartView },
    { path: '/reports', component: ReportsView },
    { path: '/news', component: NewsView }
  ]
})
```

### `ChartView.vue` 重點

- `fetchReports(30)` 取得資料
- X 軸：`report.date`（倒序排列後正序顯示，最新在右）
- Y 軸：`report.signals.priceChangePercent`
- 每個資料點 `itemStyle.color`：`>= 0` → `#26a17b`（綠），`< 0` → `#e84855`（紅）
- Tooltip 顯示：日期、漲跌幅、`signals.target`、`signals.weightScore`
- 加入 markLine 水平線 y=0

### `ReportsView.vue` 重點

- `fetchReports(30)` 取得資料
- 列表項預設顯示：日期、`signals.marketStatus`、`signals.targetSuggestion`
- 點擊展開（v-show + 切換 expanded 狀態）：
  - `ai.action_items`（行動建議）
  - `ai.risk_warnings`（風險警告）
  - `ai.mindset_advice`（心態）
  - `ai.coach_internal_thinking`（可選折疊）

### `NewsView.vue` 重點

- `fetchNews()` 取得資料
- 取 `data.articles`（注意：回傳是物件，需判斷是否為陣列）
- `pubDate` 格式化：`new Date(article.pubDate).toLocaleString('zh-TW')`
- 連結：`useTelegram().openLink(article.url)`
- `age_band` 顯示標籤：fresh → 🔴 最新，recent → 🟡 近期，old → ⚪ 舊聞
- `_region` 顯示：TW → 🇹🇼，US → 🇺🇸

### `App.vue` 重點

- `onMounted` 呼叫 `useTelegram().expand()` 展開視窗
- 底部 Tab Bar（3 個 tab）：
  - 📈 圖表 → `/`
  - 📋 報告 → `/reports`  
  - 📰 新聞 → `/news`
- 使用 `router-link` 或 `router.push()` 切換

---

## 本機開發指令

```bash
# 終端機 1：啟動 API server（bypass initData 驗證）
BYPASS_INIT_DATA=true npm run api

# 終端機 2：啟動前端 dev server
cd webapp
npm install
npm run dev
# → http://localhost:5173
```

---

## 完成判斷標準

- [ ] `webapp/` 所有檔案建立完成
- [ ] `npm run dev` 可在 localhost:5173 正常啟動
- [ ] ChartView：折線圖可渲染，漲跌顏色正確
- [ ] ReportsView：列表顯示，點擊可展開 AI 內容
- [ ] NewsView：新聞列表顯示，連結可點擊
- [ ] `npm run build` 可成功產出 `webapp/dist/`
- [ ] 無 console error（API 404 以外）

---

## 下一步（Phase 2-B 完成後）

→ Phase 2-C：在 `src/bot.mjs` 設定 `setMyCommands`、Menu Button 指向 Mini App URL（需 HTTPS domain）
