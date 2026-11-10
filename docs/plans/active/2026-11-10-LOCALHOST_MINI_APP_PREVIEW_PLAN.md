---
type: plan
status: in-progress
last_updated: 2026-11-10
tags:
  - webapp
  - preview
  - localhost
wiki_links: []
---

# localhost Mini App 預覽頁面建設計畫

## 目標

建立一個 localhost 頁面（不開放對外），讓 Han 可直接在瀏覽器查看 Mini App 完整介面，無需每次打開 Telegram 確認。重點解決 Telegram `initData` 認證問題，讓 localhost 頁面可正常調用後端 API。

## 評估結果

### 可行性：高

關鍵發現（已驗證代碼）：

| 項目                 | 說明                                                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 前端開發伺服器       | `npm run dev` (webapp/) → `localhost:5173` (Vite)                                                                                        |
| 後端 API 伺服器      | `npm run api` → `node src/api/server.mjs`                                                                                                |
| `initDataGuard` 豁免 | `NODE_ENV === 'dev'` 或 `'development'` 或 `BYPASS_INIT_DATA === 'true'` → 直接放行所有請求 (src/api/middleware/initDataGuard.mjs:45-51) |
| 前端 initData 降級   | `import.meta.env.DEV` 時 `getInitData()` 回傳 `"dev-bypass"`，不會拋出錯誤 (webapp/src/api/index.js)                                     |
| `waitReady()` 降級   | 非 Telegram 環境立即 resolve，頁面正常渲染 (webapp/src/composables/useTelegram.js:7-13)                                                  |

### 認證處理方案

後端 API 以 `NODE_ENV=dev` 啟動，`initDataGuard` 會跳過 HMAC 驗證，直接放行所有請求。前端在 Vite dev mode 下發送 `X-Telegram-Init-Data: dev-bypass`，後端不檢查該 header 內容。無需生成真實 Telegram initData。

### 架構

```
瀏覽器 (localhost:5173)
    │ Vite dev server (前端)
    │──────────────────────────────────────
    │ fetch API → localhost:3000 (後端 API, NODE_ENV=dev)
    │    initDataGuard: NODE_ENV=dev → 放行
    │──────────────────────────────────────
    │ 後端讀取 archive / TAIFEX 等數據源
```

## 執行步驟

### Phase 1：啟動後端 API (NODE_ENV=dev)

在終端執行：

```bash
cd /workspace/projects/InvestmentLineNotify
NODE_ENV=dev npm run api
```

驗證：後端監聽端口，`/health` 端點可存取。

### Phase 2：啟動前端 Vite dev server

在另一終端執行：

```bash
cd /workspace/projects/InvestmentLineNotify/webapp
npm run dev
```

驗證：Vite 監聽 `localhost:5173`。

### Phase 3：瀏覽器訪問

打開 `http://localhost:5173`，確認：

- Mini App 介面完整渲染（無 Telegram 也正常顯示）
- 各 API 端點數據正常載入（VIX、市場雷達、健康面板等）
- 沒有 `403 Missing X-Telegram-Init-Data` 錯誤

### Phase 4：問題排查（如有）

若 API 回傳 403，檢查後端是否以 `NODE_ENV=dev` 啟動；若前端 API 請求拋錯，檢查 `VITE_API_BASE` 是否正確指向 localhost 後端。

## 驗收標準

- [ ] 後端 API 在 `NODE_ENV=dev` 下正常啟動
- [ ] 前端 Vite dev server 在 `localhost:5173` 正常啟動
- [ ] 瀏覽器打開 localhost 頁面，Mini App 介面完整渲染
- [ ] 主要 API 端點（/portfolio/health, /status, /reports, /news 等）回傳正常數據，無 403 認證錯誤
- [ ] 頁面不需 Telegram 環境即可查看，適合本地除錯與確認問題

## 注意事項

- 此 localhost 頁面僅供本地開發除錯使用，**不得開放對外網路**
- 生產環境仍需正確的 Telegram initData 認證，不受此計畫影響
- 後端以 `NODE_ENV=dev` 啟動時，`initDataGuard` 會放行所有請求，僅限本地使用
