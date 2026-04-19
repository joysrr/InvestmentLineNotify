# Tech Stack: Telegram Mini App SDK

## 前端 UI/UX 限制 (Frontend)
1. **Mobile-First**：介面設計必須考量 Telegram 手機版內建瀏覽器的呈現。避免過度複雜的視窗堆疊，保持極簡。
2. **原生互動**：盡可能呼叫 `window.Telegram.WebApp` 內建方法（如 `MainButton`, `HapticFeedback`）來增強使用者體驗。
3. **主題適配**：必須支援並跟隨 Telegram 的日/夜間模式 (Theme Params)，確保文字與背景顏色不突兀。

## API 安全介接與認證 (Frontend & Backend)
1. **前端請求**：前端所有發送到後端 API 的 HTTP Request，必須將 `window.Telegram.WebApp.initData` 附帶於 Header 中（例如 `Authorization: tma <initData>`）。請善用 `useTelegram.js` 處理此邏輯。
2. **後端驗證與雙重鐵律 (initData Security Guard)**：
   - 後端新增的 API 路由，必須掛載 `src/api/middleware/initDataGuard.mjs`。嚴禁實作任何繞過 HMAC-SHA256 驗證的公開路由。
   - **必須驗證時效**：實作 `initData` 驗證時，除了驗證 HMAC-SHA256 保證資料不可篡改外，還必須同時解析並檢驗被加密的 `auth_date` (Unix Timestamp)。若該 Token 產生時間超過伺服器現在時間 24 小時（86400秒），立即拒絕授權 (丟出 HTTP 401 錯誤)，徹底防範舊 Token 遭竊取後的重放攻擊 (Replay Attack)。