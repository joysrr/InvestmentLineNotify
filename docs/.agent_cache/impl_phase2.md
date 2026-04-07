# Agent Task Cache — Phase 2 實作計劃

**Task**: Phase 2 — Telegram Mini App 整合  
**Status**: IN_PROGRESS — Phase 2-A ✅ Phase 2-B ✅，目前執行 Phase 2-C  
**Updated**: 2026-04-07

---

## 已完成項目

- [x] **Pre-A**：`docs/architecture.md` 更新（Bot Layer 5.8、data/ 目錄、Mermaid flow）
- [x] **preplan_features.md**：新增 Oracle Cloud VM 部署計劃（待取得 domain 後執行）
- [x] **技術選型已全部確認**
- [x] **Phase 2-A：Fastify API Server**
  - `src/api/server.mjs`（Fastify Port 3000，CORS，initDataGuard）
  - `src/api/middleware/initDataGuard.mjs`（HMAC-SHA256，dev bypass）
  - `src/api/routes/status.mjs`、`reports.mjs`、`news.mjs`
  - `package.json` 新增 `fastify`、`@fastify/cors`、`api` script
- [x] **Phase 2-B：Vite + Vue 3 前端 Mini App（`webapp/`）**
  - commit: `af43a233d9c040ef0b9ddb8185afe69b8076b3e8`
  - `webapp/package.json`、`vite.config.js`、`index.html`
  - `webapp/src/main.js`、`App.vue`（底部 Tab Bar + useTelegram.expand()）
  - `webapp/src/router/index.js`（hash mode，/ /reports /news）
  - `webapp/src/api/index.js`（fetch wrapper + X-Telegram-Init-Data header）
  - `webapp/src/composables/useTelegram.js`（window.Telegram?.WebApp 封裝）
  - `webapp/src/views/ChartView.vue`（priceChangePercent 折線，漲綠跌紅）
  - `webapp/src/views/ReportsView.vue`（報告列表，展開 AI 內容）
  - `webapp/src/views/NewsView.vue`（新聞列表，tg.openLink）
- [x] **文件同步（Phase 2-B 後）**
  - `docs/plans/telegram_intergration_plan.md` → v1.6，Phase 2-B 標記完成
  - `docs/architecture.md` → 新增 5.10 webapp 層說明、Frontend Layer、目錄表

---

## 技術選型決議（已確認）

| 項目 | 決定 | 說明 |
|---|---|---|
| API 框架 | ✅ Fastify | ESM 原生、比 Express 快 3-5 倍 |
| 前端框架 | ✅ Vite + Vue 3 + ECharts | Composition API、HMR、vue-echarts |
| 前端目錄 | ✅ `webapp/` | build 產物輸出至 `webapp/dist/` |
| 部署方案 | ⏸️ Oracle VM（下個計劃） | 尚無 domain，移入 `preplan_features.md` |
| 圖表優先 | ✅ (a)→(b)→(d) | 不實作 (c) 訊號次數長條圖 |

---

## 當前任務：Phase 2-C — Bot 整合

### 目標
在現有 `src/bot.mjs` 新增以下功能：

| 功能 | 說明 |
|---|---|
| `bot.api.setMyCommands([...])` | 設定 Telegram 左下角指令選單（含現有 8 個指令的說明文字） |
| `bot.api.setChatMenuButton(...)` | Menu Button 指向 Mini App URL（需 HTTPS domain，可先 skip） |
| `/status` Inline Button | `/status` 回覆訊息附加「開啟儀表板」Inline Button |

### 實作策略

> ⚠️ Mini App URL 需 HTTPS domain，目前尚未取得。  
> **策略**：`setMyCommands` 與 `/status` Inline Button 可立即實作；`setChatMenuButton` 待 domain 就緒後補上。

#### 1. `setMyCommands` — 指令選單（可立即實作）

在 `src/bot.mjs` bot 初始化後呼叫：

```js
await bot.api.setMyCommands([
  { command: 'status',   description: '查看最新市場快取狀態' },
  { command: 'daily',    description: '手動觸發每日報告' },
  { command: 'news',     description: '手動更新新聞池' },
  { command: 'weekly',   description: '手動觸發週報' },
  { command: 'monthly',  description: '手動觸發月報' },
  { command: 'optimize', description: '手動觸發規則優化' },
  { command: 'help',     description: '顯示指令說明' },
])
```

#### 2. `/status` Inline Button（可立即實作）

修改 `src/bot.mjs` 的 `/status` handler，回覆時附加 Inline Keyboard：

```js
// 有 MINI_APP_URL 時顯示「開啟儀表板」按鈕，否則略過
const inlineKeyboard = process.env.MINI_APP_URL
  ? new InlineKeyboard().webApp('📊 開啟儀表板', process.env.MINI_APP_URL)
  : undefined

await ctx.reply(statusText, {
  parse_mode: 'HTML',
  reply_markup: inlineKeyboard
})
```

#### 3. `setChatMenuButton`（待 HTTPS domain 後實作）

```js
// 待 MINI_APP_URL 就緒後加入
if (process.env.MINI_APP_URL) {
  await bot.api.setChatMenuButton({
    chat_id: Number(process.env.TELEGRAM_USER_ID),
    menu_button: {
      type: 'web_app',
      text: '📊 儀表板',
      web_app: { url: process.env.MINI_APP_URL }
    }
  })
}
```

### 影響檔案
- `src/bot.mjs`：新增 `setMyCommands`、修改 `/status` handler
- `.env.example`（若存在）：新增 `MINI_APP_URL` 說明

### 完成判斷標準
- [ ] `setMyCommands` 呼叫成功，Telegram 左下角可看到指令清單
- [ ] `/status` 回覆訊息在有 `MINI_APP_URL` 時顯示 Inline Button
- [ ] `setChatMenuButton` 邏輯已寫入，條件式啟用（有 env 才執行）
- [ ] 無 console error

---

## 待執行 Phase 清單

### Phase 2-C：Bot 整合 ← **當前任務**
（詳見上方「當前任務」章節）

### Phase 2-D：文件更新（Phase 2-C 完成後執行）
- `docs/modules/entry_and_notifications.md`：更新 Bot 指令選單清單與 Mini App 整合說明

---

## 部署最後解鎖（導往下個計劃）

Oracle VM 部署計劃已移入 `docs/plans/preplan_features.md`。  
待取得 domain 與 HTTPS 入口後，再執行「Oracle Cloud VM 正式部署」計劃，  
同時補上 `setChatMenuButton` 與前端 `VITE_API_BASE` 正式 URL 設定。

---

## 本機開發驗證指令

```bash
# 終端機 1：啟動 API（bypass initData 驗證）
BYPASS_INIT_DATA=true npm run api

# 終端機 2：啟動前端 dev server
cd webapp && npm install && npm run dev
# → http://localhost:5173

# 或 ngrok 暴露為臨時 HTTPS URL 供 Telegram Mini App 測試
ngrok http 5173
```
