# Agent Task Cache — Phase 2 實作計劃

**Task**: Phase 2 — Telegram Mini App 整合  
**Status**: IN_PROGRESS — Phase 2-A ✅ Phase 2-B ✅ Phase 2-C ✅，目前執行 Phase 2-D  
**Updated**: 2026-04-08

---

## 已完成項目

- [x] **Pre-A**：`docs/architecture.md` 更新（Bot Layer 5.8、data/ 目錄、Mermaid flow）
- [x] **preplan_features.md**：新增 Oracle Cloud VM 部署計劃
- [x] **Phase 2-A：Fastify API Server**
  - `src/api/server.mjs`、`middleware/initDataGuard.mjs`、`routes/status.mjs`、`routes/reports.mjs`、`routes/news.mjs`
- [x] **Phase 2-B：Vite + Vue 3 Mini App（`webapp/`）**
  - commit: `af43a233d9c040ef0b9ddb8185afe69b8076b3e8`
- [x] **Phase 2-C：Bot 整合**
  - commit: `1dcb2b752c443f3d885ff32822774623569db474`
  - `InlineKeyboard` import 新增
  - `syncBotCommands()`：7 項指令選單（不含 /start），失敗封閉不中斷 Bot
  - `syncMenuButton()`：有 `MINI_APP_URL` 才執行，`TELEGRAM_USER_ID` NaN 防護，失敗封閉
  - `/status` handler：有 `MINI_APP_URL` 時附加 WebApp Inline Button
  - `onStart` callback 新增同步呼叫兩函數
- [x] **文件同步（Phase 2-B 後）**
  - `docs/plans/telegram_intergration_plan.md` → v1.6
  - `docs/architecture.md` → 新增 5.10 webapp 層、Frontend Layer

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

## 當前任務：Phase 2-D — 文件更新

### 目標
更新 `docs/modules/entry_and_notifications.md`，补充 Phase 2-C 的實作內容。

### 需要更新的內容

1. **Bot 指令選單清單**：訪明 `setMyCommands` 的 7 項指令、啟動時自動同步機制、失敗容錯。
2. **`/status` Inline Button**：說明有 `MINI_APP_URL` 時附加 WebApp 按鈕的行為。
3. **`setChatMenuButton` 機制**：說明條件式啟用、`TELEGRAM_USER_ID` NaN 防護、尿需設定的 env 變數。
4. **相關 env 變數**：新增 `MINI_APP_URL`（可選，取得 HTTPS domain 後填入）說明。

---

## 待執行 Phase 清單

### Phase 2-D：文件更新 ← **當前任務**
- `docs/modules/entry_and_notifications.md`：补充 Bot 指令選單、Inline Button、setChatMenuButton 說明
- `docs/plans/telegram_intergration_plan.md`：標記 Phase 2-C 完成，Phase 2-D 為待執行

---

## 部署最後解鎖（導往下個計劃）

Oracle VM 部署計劃已移入 `docs/plans/preplan_features.md`。  
待取得 domain 與 HTTPS 入口後，執行「Oracle Cloud VM 正式部署」計劃，  
同時補上 `MINI_APP_URL` env 即自動啟用 Inline Button 與 Menu Button。

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

# Bot 啟動驗證 setMyCommands
npm run bot
# → 應可看到: [Bot] ✅ setMyCommands 同步完成。
```
