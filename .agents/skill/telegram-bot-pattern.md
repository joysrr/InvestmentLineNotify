# Skill: Telegram Bot Development Pattern
# Telegram Bot 開發規範

> 本文件定義所有涉及 Telegram Bot API 的後端開發規範。
> `@Backend` 在實作 Bot 功能或 Webhook handler 時必須讀取並遵守本文件。

## Webhook Handler 規範

### 核心鐵律
- **必須在 3 秒內回應 HTTP 200**：Telegram 的 Webhook 超時為 60 秒，
  但為避免重試風暴，handler 必須立即回應 200，再非同步處理業務邏輯
- **標準結構**：
```
收到 Webhook 請求
  → 立即回應 200 OK
  → 非同步執行業務邏輯（使用 setImmediate 或獨立 async function）
  → 業務邏輯內的錯誤由自身捕捉，不影響已回應的 200
```

### initData 驗證（Mini App 請求）
所有來自 Telegram Mini App 的後端 API 請求，必須在路由層驗證 `initData`：
1. 從 request header 或 body 取得 `initData` 字串
2. 使用 Bot Token 進行 HMAC-SHA256 驗證
3. 驗證失敗時回傳 `401 Unauthorized`，不執行任何業務邏輯
4. 驗證通過的 `initData` 有效期限為 **24 小時**，超期視為無效

## 訊息發送規範

### 發送前檢查
- 確認訊息長度不超過 4,096 字元（純文字）
- 若訊息包含 Markdown 格式，使用 `parse_mode: 'MarkdownV2'`，
  並確保特殊字元已正確跳脫（`. ! - ( )` 等需加 `\`）

### 錯誤處理
| 錯誤碼 | 情境 | 處理方式 |
|--------|------|---------|
| 429 | 超過頻率限制 | 讀取 `retry_after` 欄位，等待後重試（Exponential Backoff） |
| 403 | Bot 被使用者封鎖 | 記錄日誌，跳過此用戶，不中斷整體流程 |
| 400 | 訊息格式錯誤 | 記錄完整錯誤訊息與原始內容，通知 User |

### 重試策略
```
第 1 次失敗 → 等待 1 秒後重試
第 2 次失敗 → 等待 5 秒後重試
第 3 次失敗 → 記錄到錯誤日誌，放棄本次發送並觸發告警
```

## Bot Command 處理規範
- 所有 `/command` 處理必須有對應的 fallback（未知指令回應提示訊息）
- 長時間操作（例如：計算回測）必須先回應「處理中...」再執行

<!--
  維護說明：當新增 Bot 功能或 Telegram API 有重大更新時，
  由 @Backend 提案更新此文件，並通知 @Lead 更新 Skills Mapping。
-->