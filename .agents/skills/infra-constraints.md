# Skill: Infrastructure Constraints
# 基礎設施限制手冊

> 本文件定義 InvestmentLineNotify 的生產環境硬性限制。
> 所有架構設計必須在這些限制內進行，違反限制的設計方案不得進入開發階段。

## Oracle VM Free Tier 限制
- **記憶體上限**：24 GB RAM（Ampere A1 Free Tier 最大配置）
- **CPU**：4 OCPU（ARM 架構，Ampere A1）
- **儲存**：50 GB 區塊儲存，禁止無限增長的 Log 或快取策略
- **網路**：每月 10 TB 出口流量（不可設計大量 Polling 架構）

**設計限制**：
- 記憶體充裕，但仍需對歷史資料載入實作批次處理（Batching）或串流（Streaming），避免單次全量載入
- 背景服務總數（PM2 process）建議不超過 6 個，保留系統 overhead 餘裕
- CPU 為 ARM 架構，引入原生套件時需確認支援 ARM（`linux/arm64`）

---

## PM2 使用規範
- **Process 命名**：統一以 `iln-<功能簡稱>` 命名（例如：`iln-api`、`iln-scheduler`）
- **重啟策略**：使用 `max_memory_restart: 1G`，避免單一 process 記憶體洩漏累積
- **Log 管理**：搭配 `pm2-logrotate` 設定，單檔上限 20 MB，保留最近 10 個檔案
- **Cluster 模式**：4 OCPU 環境下可使用 cluster 模式，但須評估各 process 的記憶體需求後再啟用

---

## Nginx 角色定義
- **職責範圍**：反向代理（轉發至 PM2）、SSL 終止（Certbot）、靜態資源服務（`webapp/dist/`）
- **禁止事項**：不在 Nginx 層做任何業務邏輯判斷
- **設定檔位置**：`/etc/nginx/sites-available/investmentlinenotify`

---

## Telegram Bot API 限制
- **訊息發送頻率**：同一 Bot 對同一聊天室每秒不超過 1 則，全局每秒不超過 30 則
- **訊息長度**：
  - 純文字訊息：最多 4,096 字元
  - Caption（圖片說明）：最多 1,024 字元
- **Webhook 規範**：
  - Webhook endpoint 必須使用 HTTPS（Certbot 已覆蓋）
  - 每次 Webhook 回應必須在 **60 秒內**完成，超時 Telegram 會重試
  - 禁止在 Webhook handler 內執行長時間運算，應立即回應 200 再非同步處理
- **錯誤處理**：HTTP 429 必須實作退避重試（Exponential Backoff），不可直接丟棄訊息

---

## Telegram Mini App 限制
- **執行環境**：運行於 Telegram WebView（iOS / Android / Desktop），非標準瀏覽器
- **initData 驗證**：所有 Mini App 對後端的請求，後端必須驗證 `initData` 合法性，防止偽造請求
- **本地儲存限制**：`localStorage` 在部分 Telegram 版本有限制，敏感資料不可存於前端
- **網路請求**：Mini App 只能發出 HTTPS 請求，HTTP 請求會被封鎖
- **介面限制**：
  - 主色調需遵循 Telegram ThemeParams，避免硬寫顏色造成深色/淺色主題衝突
  - 禁止使用需要額外權限的瀏覽器 API（例如：地理位置、相機）

---

## 擴充說明
<!-- 
  維護說明：當新增外部服務或調整基礎設施時，
  由 @Backend 或 @Architect 提案更新此文件，
  並通知 @Lead 更新 Skills Mapping。
-->