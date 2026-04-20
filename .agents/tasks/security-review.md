# Task: Security Review
# 安全審查任務

> 本任務在以下條件被觸發時由 `@Lead` 呼叫 `@Reviewer` 執行：
> - PR 涉及 API Token、Bot Token、任何形式的金鑰處理
> - PR 涉及 Telegram `initData` 驗證邏輯新增或修改
> - PR 涉及新增對外 API 端點（任何可被外部呼叫的路由）

## 安全審查 Checklist

### 金鑰與憑證
- [ ] 程式碼中無任何硬寫的 Token、API Key、Secret
- [ ] 所有敏感值均透過 `process.env` 讀取
- [ ] `.env.example` 已更新但不含真實值
- [ ] Git history 中無敏感資訊（確認 `.gitignore` 覆蓋 `.env`）

### Telegram 驗證
- [ ] 所有來自 Mini App 的請求均有 `initData` HMAC-SHA256 驗證
- [ ] `initData` 有效期限檢查已實作（24 小時內）
- [ ] 驗證失敗時回傳 `401`，不執行任何業務邏輯
- [ ] Bot Token 未出現在任何前端程式碼或 `docs/` 文件中

### API 端點安全
- [ ] 新增的 API 端點有明確的授權驗證機制
- [ ] 錯誤回應不洩漏系統內部資訊（Stack Trace、檔案路徑等）
- [ ] 輸入參數有基本的型別與範圍驗證

## 安全審查結論格式
安全審查結論必須附加在對應的 `REVIEW_REPORT.md` 末尾，標注：

```
## 安全審查結果
審查日期：<日期>
結論：✅ 通過 / 🔴 發現安全疑慮（見 BLOCKER 項目）
```
<!-- END: 安全審查任務 -->